import { describe, expect, it } from 'vitest'
import {
  buildTenderSearchUrl,
  CIS_COUNTRIES,
  collectCountryFromSources,
  companySlugToCisPlantSlug,
  parseManufacturerEnterpriseLinks,
  parseOsmWorks,
  tenderPlatforms,
} from './cis-plant-collector.mjs'

describe('cis plant collector', () => {
  it('keeps CIS country targets explicit', () => {
    expect(CIS_COUNTRIES.map((country) => country.country)).toEqual([
      'Казахстан',
      'Беларусь',
      'Узбекистан',
      'Кыргызстан',
      'Армения',
      'Азербайджан',
      'Таджикистан',
      'Молдова',
      'Туркменистан',
    ])
  })

  it('parses manufacturers.ru country enterprise cards and skips banned categories', () => {
    const html = `
      <a href="/company/kazphosphate">Казфосфат</a>
      <a href="/company/minskiy-traktornyy-zavod">Минский тракторный завод</a>
      <a href="/company/pivzavod">Пивоваренный завод</a>
      <a href="/company/myasokombinat">Мясокомбинат</a>
      <a href="/company/ocean-fish">Ocean Fish LLC</a>
    `
    const links = parseManufacturerEnterpriseLinks(html, 'https://manufacturers.ru')

    expect(links).toEqual([
      {
        companySlug: 'kazphosphate',
        name: 'Казфосфат',
        sourceName: 'manufacturers.ru',
        sourceUrl: 'https://manufacturers.ru/company/kazphosphate',
      },
      {
        companySlug: 'minskiy-traktornyy-zavod',
        name: 'Минский тракторный завод',
        sourceName: 'manufacturers.ru',
        sourceUrl: 'https://manufacturers.ru/company/minskiy-traktornyy-zavod',
      },
    ])
  })

  it('collects a country to the requested target from paged source HTML', async () => {
    const htmlByUrl = new Map([
      [
        'https://manufacturers.ru/enterprises/kz-kazakhstan',
        '<a href="/company/a">Алматы кабель</a><a href="/company/b">Казполимер</a>',
      ],
      [
        'https://manufacturers.ru/enterprises/kz-kazakhstan?page=1',
        '<a href="/company/c">Казцемент</a>',
      ],
    ])
    const country = CIS_COUNTRIES.find((item) => item.country === 'Казахстан')
    const result = await collectCountryFromSources({
      country,
      fetchImpl: async (url) => ({
        ok: true,
        text: async () => htmlByUrl.get(url) ?? '',
      }),
      maxPages: 2,
      targetPerCountry: 3,
    })

    expect(result.items).toHaveLength(3)
    expect(result.items[0]).toMatchObject({
      country: 'Казахстан',
      slug: companySlugToCisPlantSlug('kazakhstan', 'a'),
      sourceName: 'manufacturers.ru',
    })
  })

  it('uses OpenStreetMap works as fallback for underfilled countries', async () => {
    const country = CIS_COUNTRIES.find((item) => item.country === 'Таджикистан')
    const result = await collectCountryFromSources({
      country,
      fetchImpl: async (url) => {
        if (String(url).includes('overpass')) {
          return {
            ok: true,
            text: async () => JSON.stringify({
              elements: [
                { id: 11, tags: { 'addr:city': 'Душанбе', man_made: 'works', name: 'Dushanbe Cement Plant' }, type: 'way' },
                { id: 12, tags: { man_made: 'works', name: 'Tajik Aluminium Company' }, type: 'node' },
              ],
            }),
          }
        }
        return { ok: true, text: async () => '' }
      },
      maxPages: 1,
      targetPerCountry: 2,
    })

    expect(result.complete).toBe(true)
    expect(result.items.map((item) => item.name)).toEqual(['Dushanbe Cement Plant', 'Tajik Aluminium Company'])
    expect(result.items[0].city).toBe('Душанбе')
    expect(result.items[0].sourceName).toBe('OpenStreetMap works')
    expect(result.items[0].productionItems[0].sourceUrl).toContain('openstreetmap.org/way/11')
  })

  it('parses OSM industrial objects and skips banned names', () => {
    const country = CIS_COUNTRIES.find((item) => item.country === 'Молдова')
    const links = parseOsmWorks({
      elements: [
        { id: 1, tags: { name: 'Ciment Moldova', operator: 'ignored' }, type: 'way' },
        { id: 2, tags: { name: 'Wine Factory' }, type: 'node' },
      ],
    }, country)

    expect(links).toEqual([
      {
        city: '',
        companySlug: 'osm-moldova-way-1',
        name: 'Ciment Moldova',
        sourceName: 'OpenStreetMap works',
        sourceUrl: 'https://www.openstreetmap.org/way/1',
      },
    ])
  })

  it('keeps local tender platforms by country', () => {
    expect(tenderPlatforms.Казахстан.map((item) => item.url)).toContain('https://goszakup.gov.kz/')
    expect(tenderPlatforms.Беларусь.map((item) => item.url)).toContain('https://goszakupki.by/')
    expect(tenderPlatforms.Узбекистан.map((item) => item.url)).toContain('https://xarid.uz/')
    expect(tenderPlatforms.Армения.map((item) => item.url)).toContain('https://gnumner.am/')
    expect(buildTenderSearchUrl('Казахстан', 'сера')).toContain('goszakup.gov.kz')
  })
})
