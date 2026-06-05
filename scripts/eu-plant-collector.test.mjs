import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  buildTedSearchUrl,
  collectEuCountry,
  collectEuPlantLeads,
  companySlugToEuPlantSlug,
  EU_COUNTRIES,
  parseManufacturersEuLinks,
  parseOsmWorks,
  parseWikidataIndustrialBusinesses,
  parseWikidataFactories,
  tenderPlatforms,
} from './eu-plant-collector.mjs'

describe('eu plant collector', () => {
  it('keeps all 27 EU countries explicit', () => {
    expect(EU_COUNTRIES).toHaveLength(27)
    expect(EU_COUNTRIES.map((country) => country.country)).toContain('Германия')
    expect(EU_COUNTRIES.map((country) => country.country)).toContain('Франция')
    expect(EU_COUNTRIES.map((country) => country.country)).toContain('Польша')
  })

  it('parses manufacturers EU enterprise links and skips banned categories', () => {
    const html = `
      <a href="/enterprise/de/basf">BASF</a>
      <a href="/enterprise/de/siemens">Siemens</a>
      <a href="/enterprise/de/winery">Wine Factory</a>
      <a href="/enterprise/de/meat">Meat plant</a>
    `

    expect(parseManufacturersEuLinks(html)).toEqual([
      {
        companySlug: 'basf',
        name: 'BASF',
        sourceName: 'manufacturers.ru',
        sourceUrl: 'https://manufacturers.ru/enterprise/de/basf',
      },
      {
        companySlug: 'siemens',
        name: 'Siemens',
        sourceName: 'manufacturers.ru',
        sourceUrl: 'https://manufacturers.ru/enterprise/de/siemens',
      },
    ])
  })

  it('parses OpenStreetMap works into source-backed plant links', () => {
    const osm = {
      elements: [
        { id: 1, tags: { name: 'BASF Werk Ludwigshafen', operator: 'BASF', industrial: 'chemical' }, type: 'way' },
        { id: 2, tags: { name: 'Seafood Factory', industrial: 'food' }, type: 'node' },
      ],
    }

    expect(parseOsmWorks(osm, 'Германия')).toEqual([
      {
        companySlug: 'osm-germany-way-1',
        name: 'BASF Werk Ludwigshafen',
        sourceName: 'OpenStreetMap works',
        sourceUrl: 'https://www.openstreetmap.org/way/1',
      },
    ])
  })

  it('parses Wikidata factories and filters unnamed or banned records', () => {
    const wikidata = {
      results: {
        bindings: [
          { item: { value: 'https://www.wikidata.org/entity/Q1' }, itemLabel: { value: 'BASF Werk' } },
          { item: { value: 'https://www.wikidata.org/entity/Q2' }, itemLabel: { value: 'Q12345' } },
          { item: { value: 'https://www.wikidata.org/entity/Q3' }, itemLabel: { value: 'Dreher Breweries' } },
          { item: { value: 'https://www.wikidata.org/entity/Q4' }, itemLabel: { value: 'Brasserie Nationale' } },
        ],
      },
    }

    expect(parseWikidataFactories(wikidata, 'Германия')).toEqual([
      {
        companySlug: 'wikidata-germany-q1',
        name: 'BASF Werk',
        sourceName: 'Wikidata factories',
        sourceUrl: 'https://www.wikidata.org/entity/Q1',
      },
    ])
  })

  it('keeps only industrial Wikidata businesses for fallback enrichment', () => {
    const wikidata = {
      results: {
        bindings: [
          {
            industryLabel: { value: 'pharmaceutical industry' },
            item: { value: 'https://www.wikidata.org/entity/Q10' },
            itemLabel: { value: 'Pliva' },
          },
          {
            industryLabel: { value: 'automotive industry' },
            item: { value: 'https://www.wikidata.org/entity/Q11' },
            itemLabel: { value: 'Dacia' },
          },
          {
            industryLabel: { value: 'bank' },
            item: { value: 'https://www.wikidata.org/entity/Q12' },
            itemLabel: { value: 'Bank of Cyprus' },
          },
          {
            industryLabel: { value: 'gambling' },
            item: { value: 'https://www.wikidata.org/entity/Q13' },
            itemLabel: { value: 'Betway' },
          },
          {
            industryLabel: { value: 'brewing industry' },
            item: { value: 'https://www.wikidata.org/entity/Q14' },
            itemLabel: { value: 'Karlsberg Bulgaria AD' },
          },
        ],
      },
    }

    expect(parseWikidataIndustrialBusinesses(wikidata, 'Хорватия')).toEqual([
      {
        companySlug: 'wikidata-industrial-croatia-q10',
        name: 'Pliva',
        sourceName: 'Wikidata industrial companies',
        sourceUrl: 'https://www.wikidata.org/entity/Q10',
      },
      {
        companySlug: 'wikidata-industrial-croatia-q11',
        name: 'Dacia',
        sourceName: 'Wikidata industrial companies',
        sourceUrl: 'https://www.wikidata.org/entity/Q11',
      },
    ])
  })

  it('collects beyond the minimum target when more source pages exist', async () => {
    const country = { country: 'Германия', countrySlug: 'germany', iso2: 'DE', manufacturersSlug: 'de-germaniya' }
    const htmlByUrl = new Map([
      ['https://manufacturers.ru/enterprises/de-germaniya', '<a href="/enterprise/de/a">Alpha Werk</a>'],
      ['https://manufacturers.ru/enterprises/de-germaniya?page=1', '<a href="/enterprise/de/b">Beta Chem</a>'],
      ['https://manufacturers.ru/enterprises/de-germaniya?page=2', '<a href="/enterprise/de/c">Gamma Maschinenbau</a>'],
    ])
    const result = await collectEuCountry({
      country,
      fetchImpl: async (url) => ({
        ok: true,
        text: async () => htmlByUrl.get(url) ?? '',
      }),
      maxPages: 3,
      minPerCountry: 2,
      useOsm: false,
    })

    expect(result.items).toHaveLength(3)
    expect(result.items[0]).toMatchObject({
      country: 'Германия',
      slug: companySlugToEuPlantSlug('germany', 'a'),
    })
    expect(result.complete).toBe(true)
  })

  it('uses OSM subareas for large countries', async () => {
    const requestedBodies = []
    const country = {
      country: 'Германия',
      countrySlug: 'germany',
      iso2: 'DE',
      osmAreas: ['DE-BW', 'DE-BY'],
    }
    const result = await collectEuCountry({
      country,
      fetchImpl: async (_url, options = {}) => {
        requestedBodies.push(String(options.body))
        const isBw = String(options.body).includes('DE-BW')
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              elements: [
                {
                  id: isBw ? 10 : 20,
                  tags: { name: isBw ? 'BASF Werk' : 'Siemens Werk' },
                  type: 'way',
                },
              ],
            }),
        }
      },
      maxPages: 0,
      minPerCountry: 2,
      useOsm: true,
    })

    expect(requestedBodies.some((body) => body.includes('DE-BW'))).toBe(true)
    expect(requestedBodies.some((body) => body.includes('DE-BY'))).toBe(true)
    expect(result.items.map((item) => item.name)).toEqual(['BASF Werk', 'Siemens Werk'])
  })

  it('keeps EU tender platforms and TED search URL', () => {
    expect(tenderPlatforms.EU.map((item) => item.url)).toContain('https://ted.europa.eu/')
    expect(tenderPlatforms.Германия.map((item) => item.url)).toContain('https://www.service.bund.de/')
    expect(tenderPlatforms.Франция.map((item) => item.url)).toContain('https://www.marches-publics.gouv.fr/')
    expect(buildTedSearchUrl('sulfur')).toContain('ted.europa.eu')
  })

  it('does not overwrite a previous feed when every source is unavailable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eu-collector-'))
    const outputPath = join(dir, 'eu.json')
    const previousFeed = {
      updatedAt: '2026-06-01T00:00:00.000Z',
      minPerCountry: 50,
      source: 'previous',
      coverage: { Германия: { collected: 1, complete: false, min: 50 } },
      items: [{ country: 'Германия', name: 'Existing Werk', slug: 'eu-germany-existing' }],
    }

    await writeFile(outputPath, `${JSON.stringify(previousFeed, null, 2)}\n`, 'utf8')
    const result = await collectEuPlantLeads({
      fetchImpl: async () => {
        throw new Error('network down')
      },
      maxPages: 1,
      maxPerCountry: 1,
      outputPath,
    })

    expect(result.items).toHaveLength(1)
    expect(JSON.parse(await readFile(outputPath, 'utf8')).items).toHaveLength(1)
    await rm(dir, { force: true, recursive: true })
  })

  it('updates selected EU countries without dropping the rest of the feed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eu-collector-batch-'))
    const outputPath = join(dir, 'eu.json')
    const previousFeed = {
      updatedAt: '2026-06-01T00:00:00.000Z',
      minPerCountry: 50,
      source: 'previous',
      coverage: {
        Эстония: { collected: 1, complete: false, min: 50 },
        Франция: { collected: 1, complete: false, min: 50 },
      },
      items: [
        { country: 'Эстония', name: 'Old Estonia Werk', slug: 'eu-estonia-old' },
        { country: 'Франция', name: 'Existing French Plant', slug: 'eu-france-existing' },
      ],
    }

    await writeFile(outputPath, `${JSON.stringify(previousFeed, null, 2)}\n`, 'utf8')
    const result = await collectEuPlantLeads({
      countries: ['estonia'],
      fetchImpl: async () => ({
        ok: true,
        text: async () => `
          <a href="/enterprise/de/basf-werk">BASF Werk</a>
        `,
      }),
      maxPages: 1,
      maxPerCountry: 1,
      minPerCountry: 1,
      outputPath,
      useOsm: false,
    })

    expect(result.items.map((item) => item.name).sort()).toEqual(['BASF Werk', 'Existing French Plant'])
    expect(result.items.some((item) => item.name === 'Old Estonia Werk')).toBe(false)
    await rm(dir, { force: true, recursive: true })
  })
})
