import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  ASIA_OSM_CLUSTERS,
  ASIA_TENDER_PLATFORMS,
  buildAsiaCoverageSnapshot,
  buildClusterOverpassQuery,
  buildIndiaCompanyMasterUrl,
  buildOverpassQuery,
  collectAsiaPlantLeads,
  INDIA_REGIONS,
  CHINA_REGIONS,
  hasOsmClusters,
  osmQueriesForRegion,
  parseIndiaCompanyMasterRecords,
  parseOsmIndustrialElements,
  parseWikidataIndustrialRecords,
} from './india-china-plant-collector.mjs'

describe('India/China plant collector', () => {
  it('defines region targets for India and China', () => {
    expect(INDIA_REGIONS).toHaveLength(36)
    expect(CHINA_REGIONS).toHaveLength(31)
    expect(INDIA_REGIONS.every((region) => region.target === 100)).toBe(true)
    expect(CHINA_REGIONS.every((region) => region.target === 150)).toBe(true)
    expect(buildOverpassQuery(INDIA_REGIONS[0])).toContain('IN-AP')
    const gujarat = INDIA_REGIONS.find((region) => region.iso === 'IN-GJ')
    expect(hasOsmClusters(gujarat)).toBe(true)
    expect(osmQueriesForRegion(gujarat)[0]).toMatchObject({ type: 'cluster' })
    expect(buildClusterOverpassQuery(ASIA_OSM_CLUSTERS['IN-GJ'][0])).toContain('nwr(21.4,72.9')
    expect(buildClusterOverpassQuery(ASIA_OSM_CLUSTERS['IN-GJ'][0])).not.toContain('ISO3166-2')
  })

  it('parses OSM industrial objects into plant leads', () => {
    const region = INDIA_REGIONS.find((item) => item.iso === 'IN-GJ')
    const items = parseOsmIndustrialElements({
      elements: [
        {
          id: 101,
          tags: { industrial: 'chemical', name: 'Gujarat Chemical Works' },
          type: 'way',
        },
        {
          id: 102,
          tags: { name: 'Unnamed Industrial Estate' },
          type: 'way',
        },
        {
          id: 103,
          tags: { industrial: 'factory', name: 'Sysnet Info-Tech' },
          type: 'node',
        },
      ],
    }, region)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      country: 'India',
      industry: 'chemicals and materials',
      name: 'Gujarat Chemical Works',
      region: 'Gujarat',
      sourceName: 'OpenStreetMap Overpass',
    })
    expect(items[0].demandItems[0].documents).toContain('quality certificate/COA')
    expect(items[0]).toMatchObject({
      entityLevel: 'plant',
      hasAddress: false,
      needsOfficialVerification: true,
    })
    expect(Array.isArray(items[0].verification)).toBe(true)
    expect(items[0].hasProductEvidence).toBe(true)
    expect(items[0].verification).toContain('entity level: plant')
  })

  it('rejects plantation-only OSM names but keeps explicit works evidence', () => {
    const region = INDIA_REGIONS.find((item) => item.iso === 'IN-AS')
    const items = parseOsmIndustrialElements({
      elements: [
        { id: 111, tags: { industrial: 'plant', name: 'Assam Tea Plantation' }, type: 'node' },
        { id: 112, tags: { industrial: 'chemical', name: 'Assam Plantation Chemical Works' }, type: 'way' },
      ],
    }, region)

    expect(items.map((item) => item.name)).toEqual(['Assam Plantation Chemical Works'])
    expect(items[0].entityLevel).toBe('plant')
  })

  it('does not embed a data.gov.in API key in generated URLs', () => {
    const region = INDIA_REGIONS.find((item) => item.iso === 'IN-GJ')
    const url = buildIndiaCompanyMasterUrl(region)

    expect(url).not.toContain('api-key=')
    expect(new URL(url).searchParams.has('api-key')).toBe(false)
  })

  it('parses India MCA company master rows into source-backed plant leads', () => {
    const region = INDIA_REGIONS.find((item) => item.iso === 'IN-GJ')
    const items = parseIndiaCompanyMasterRecords([
      {
        company_name: 'Gujarat Fluorochemicals Limited',
        corporate_identity_number: 'L24110GJ1987PLC009362',
        company_status: 'Active',
        company_category: 'Company limited by shares',
        date_of_registration: '04/12/1987',
        principal_business_activity: 'Manufacturing',
        registered_office_address: 'Gujarat, India',
      },
      {
        company_name: 'Gujarat Finance Services Limited',
        principal_business_activity: 'Finance',
      },
      {
        company_name: 'Gujarat Farmer Producer Company Limited',
        company_status: 'Active',
        principal_business_activity: 'Agriculture producer company',
        registered_state: 'Gujarat',
      },
      {
        company_name: 'Gujarat Plantation Development Limited',
        company_status: 'Active',
        principal_business_activity: 'Plantation',
        registered_state: 'Gujarat',
      },
      {
        company_name: 'Dormant Chemicals Limited',
        company_status: 'Not Available for eFiling',
        principal_business_activity: 'Manufacturing',
        registered_state: 'Gujarat',
      },
    ], region)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      country: 'India',
      legalName: 'Gujarat Fluorochemicals Limited',
      name: 'Gujarat Fluorochemicals Limited',
      region: 'Gujarat',
      sourceName: 'India MCA Company Master Data',
    })
    expect(items[0].documents).toContain('CIN L24110GJ1987PLC009362')
    expect(items[0].dataQuality).toBe('lead')
    expect(items[0]).toMatchObject({
      entityLevel: 'company',
      hasAddress: true,
      needsOfficialVerification: true,
    })
    expect(items[0].verification).toContain('registry: India MCA Company Master Data')
    expect(items[0].procurementEvidence[0].source).toBe(ASIA_TENDER_PLATFORMS.india[0].label)
    expect(items[0].productionItems[0].source).toBe('India MCA Company Master Data')
    expect(items[0].sourceUrl).toContain('data.gov.in')
  })

  it('filters inactive MCA statuses including compact and e-filing forms', () => {
    const region = INDIA_REGIONS.find((item) => item.iso === 'IN-GJ')
    const records = [
      ['Active Chemical Works Limited', 'Active'],
      ['Striking Off Chemical Works Limited', 'Under Process of Striking Off'],
      ['Stof Chemical Works Limited', 'STOF'],
      ['Upso Chemical Works Limited', 'UPSO'],
      ['Naef Chemical Works Limited', 'NAEF'],
      ['Dormant Chemical Works Limited', 'Dormant'],
      ['Efiling Chemical Works Limited', 'Not available for e-filing'],
    ].map(([company_name, company_status]) => ({
      company_name,
      company_status,
      principal_business_activity: 'Manufacturing of chemicals',
      registered_state: 'Gujarat',
    }))

    const items = parseIndiaCompanyMasterRecords(records, region)

    expect(items.map((item) => item.name)).toEqual(['Active Chemical Works Limited'])
  })

  it('allows farmer producer, agri and plantation MCA rows only with explicit plant evidence', () => {
    const region = INDIA_REGIONS.find((item) => item.iso === 'IN-GJ')
    const items = parseIndiaCompanyMasterRecords([
      {
        company_name: 'Gujarat Farmer Producer Chemical Works Limited',
        company_status: 'Active',
        principal_business_activity: 'Farmer producer chemical works',
        registered_state: 'Gujarat',
      },
      {
        company_name: 'Gujarat Agri Manufacturing Limited',
        company_status: 'Active',
        principal_business_activity: 'Agri manufacturing',
        registered_state: 'Gujarat',
      },
      {
        company_name: 'Gujarat Plantation Steel Mill Limited',
        company_status: 'Active',
        principal_business_activity: 'Plantation steel mill',
        registered_state: 'Gujarat',
      },
      {
        company_name: 'Gujarat Plantation Plant Limited',
        company_status: 'Active',
        principal_business_activity: 'Plantation plant operation',
        registered_state: 'Gujarat',
      },
    ], region)

    expect(items.map((item) => item.name)).toEqual([
      'Gujarat Farmer Producer Chemical Works Limited',
      'Gujarat Plantation Steel Mill Limited',
    ])
  })

  it('parses Wikidata industrial records into China plant leads', () => {
    const region = CHINA_REGIONS.find((item) => item.iso === 'CN-GD')
    const items = parseWikidataIndustrialRecords({
      results: {
        bindings: [
          {
            item: { value: 'http://www.wikidata.org/entity/Q123' },
            itemLabel: { value: 'Guangdong Chemical Works' },
            industryLabel: { value: 'chemical industry' },
          },
          {
            item: { value: 'http://www.wikidata.org/entity/Q124' },
            itemLabel: { value: 'Guangdong Bank' },
            industryLabel: { value: 'banking' },
          },
          {
            item: { value: 'http://www.wikidata.org/entity/Q125' },
            itemLabel: { value: 'Hilton Garden Inn Surat City Centre' },
            industryLabel: { value: 'hospitality industry' },
          },
          {
            item: { value: 'http://www.wikidata.org/entity/Q126' },
            itemLabel: { value: 'Game Science' },
            industryLabel: { value: 'video game industry' },
          },
          {
            item: { value: 'http://www.wikidata.org/entity/Q127' },
            itemLabel: { value: 'Longhua Science and Technology Park' },
            industryLabel: { value: 'industrial park' },
          },
          {
            item: { value: 'http://www.wikidata.org/entity/Q128' },
            itemLabel: { value: 'Evergrande Auto City' },
            industryLabel: { value: 'factory' },
          },
          {
            item: { value: 'http://www.wikidata.org/entity/Q129' },
            itemLabel: { value: 'B.CMAY PICTURES' },
            industryLabel: { value: 'manufacturing lead' },
          },
          {
            item: { value: 'http://www.wikidata.org/entity/Q130' },
            itemLabel: { value: 'China Academy of Launch Vehicle Technology' },
            industryLabel: { value: 'aerospace industry' },
          },
          {
            item: { value: 'http://www.wikidata.org/entity/Q131' },
            itemLabel: { value: 'Hindi Olympiad Foundation' },
            industryLabel: { value: 'education industry' },
          },
          {
            item: { value: 'http://www.wikidata.org/entity/Q132' },
            itemLabel: { value: 'Finezza.in' },
            industryLabel: { value: 'fintech' },
          },
          {
            item: { value: 'http://www.wikidata.org/entity/Q133' },
            itemLabel: { value: 'Maharashtra State Road Transport Corporation' },
            industryLabel: { value: 'public transport bus service' },
          },
        ],
      },
    }, region)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      country: 'China',
      industry: 'chemicals and materials',
      name: 'Guangdong Chemical Works',
      region: 'Guangdong',
      sourceName: 'Wikidata industrial companies',
    })
    expect(items[0].procurementEvidence[0].source).toBe(ASIA_TENDER_PLATFORMS.china[0].label)
    expect(items[0].entityLevel).toBe('plant')
    expect(items[0].verification).toContain('entity level: plant')
    expect(items[0].sourceUrl).toBe('http://www.wikidata.org/entity/Q123')
  })

  it('treats empty Wikidata responses as zero records', () => {
    const region = CHINA_REGIONS.find((item) => item.iso === 'CN-GD')
    expect(parseWikidataIndustrialRecords(null, region)).toEqual([])
  })

  it('collects a feed with coverage from mocked Overpass responses', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-asia-'))
    const outputPath = join(dir, 'asia.json')
    const feed = await collectAsiaPlantLeads({
      countries: ['india'],
      fetchImpl: async () => ({
        json: async () => ({
          elements: [
            { id: 201, tags: { industrial: 'factory', name: 'Alpha Factory' }, type: 'node' },
          ],
        }),
        ok: true,
      }),
      outputPath,
    })

    expect(Object.keys(feed.coverage)).toHaveLength(36)
    expect(feed.items.length).toBe(36)
    expect(feed.standardVersion).toBe('tenderstart-plant-profile-v1')
    expect(feed.coverage['India:Gujarat'].sourceBreakdown).toBeDefined()
    expect(JSON.parse(await readFile(outputPath, 'utf8')).items.length).toBe(36)

    await rm(dir, { force: true, recursive: true })
  })

  it('uses OSM bbox clusters before region fallback and dedupes cluster hits', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-asia-osm-cluster-'))
    const outputPath = join(dir, 'asia.json')
    const queries = []

    const feed = await collectAsiaPlantLeads({
      countries: ['india'],
      fetchImpl: async (_url, init) => {
        const query = decodeURIComponent(String(init.body).replace(/^data=/, ''))
        queries.push(query)
        return {
          json: async () => ({
            elements: query.includes('ISO3166-2')
              ? [{ id: 402, tags: { industrial: 'chemical', name: 'Region Fallback Chemical Works' }, type: 'way' }]
              : [
                  { id: 401, tags: { industrial: 'chemical', name: 'Cluster Chemical Works' }, type: 'node' },
                  { id: 403, tags: { industrial: 'chemical', name: 'Cluster Chemical Works' }, type: 'way' },
                  { id: 404, tags: { name: 'Dahej Industrial Estate' }, type: 'way' },
                ],
          }),
          ok: true,
        }
      },
      outputPath,
      previousFallback: false,
      regionCodes: ['IN-GJ'],
      sources: ['osm'],
      targetIndia: 2,
    })

    expect(queries[0]).toContain('21.4,72.9')
    expect(queries.some((query) => query.includes('ISO3166-2'))).toBe(true)
    expect(feed.items.map((item) => item.name)).toEqual(['Cluster Chemical Works', 'Region Fallback Chemical Works'])

    await rm(dir, { force: true, recursive: true })
  })

  it('writes an Asia coverage snapshot with source breakdown and tender platforms', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-asia-coverage-'))
    const outputPath = join(dir, 'asia.json')
    const coverageOutputPath = join(dir, 'coverage.json')
    const feed = await collectAsiaPlantLeads({
      countries: ['china'],
      coverageOutputPath,
      fetchImpl: async () => ({
        json: async () => ({
          elements: [
            { id: 301, tags: { industrial: 'chemical', name: 'Shandong Chemical Factory' }, type: 'node' },
          ],
        }),
        ok: true,
      }),
      outputPath,
      regionCodes: ['CN-SD'],
      sources: ['osm'],
    })
    const snapshot = buildAsiaCoverageSnapshot(feed)
    const written = JSON.parse(await readFile(coverageOutputPath, 'utf8'))

    expect(snapshot.total).toBe(1)
    expect(written.countries.find((country) => country.country === 'China').regions).toHaveLength(1)
    expect(written.tenderPlatforms.china[0].label).toBe('China Government Procurement Network')

    await rm(dir, { force: true, recursive: true })
  })

  it('does not shrink an existing region when a source returns fewer records', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-asia-preserve-'))
    const outputPath = join(dir, 'asia.json')
    await writeFile(outputPath, JSON.stringify({
      coverage: {
        'India:Gujarat': { collected: 2, complete: false, iso: 'IN-GJ', target: 100 },
      },
      items: [
        { country: 'India', name: 'Alpha Factory', region: 'Gujarat', slug: 'alpha' },
        { country: 'India', name: 'Beta Factory', region: 'Gujarat', slug: 'beta' },
      ],
      updatedAt: new Date().toISOString(),
    }), 'utf8')

    const feed = await collectAsiaPlantLeads({
      countries: ['india'],
      fetchImpl: async () => ({
        json: async () => ({
          elements: [
            { id: 201, tags: { industrial: 'factory', name: 'Alpha Factory' }, type: 'node' },
          ],
        }),
        ok: true,
      }),
      outputPath,
      regionCodes: ['IN-GJ'],
      sources: ['osm'],
    })

    expect(feed.items.filter((item) => item.region === 'Gujarat')).toHaveLength(2)
    expect(feed.items.every((item) => item.entityLevel && item.verification?.length)).toBe(true)
    expect(feed.items.every((item) => Array.isArray(item.verification))).toBe(true)
    expect(feed.items.every((item) => typeof item.hasAddress === 'boolean')).toBe(true)
    expect(feed.items.every((item) => typeof item.hasProductEvidence === 'boolean')).toBe(true)
    expect(feed.items.every((item) => item.needsOfficialVerification === true)).toBe(true)

    await rm(dir, { force: true, recursive: true })
  })

  it('removes rejected non-plant items from previous checkpoints', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-asia-clean-'))
    const outputPath = join(dir, 'asia.json')
    await writeFile(outputPath, JSON.stringify({
      coverage: {
        'China:Guangdong': { collected: 2, complete: false, iso: 'CN-GD', target: 150 },
      },
      items: [
        { country: 'China', name: 'Longhua Science and Technology Park', region: 'Guangdong', slug: 'bad-park' },
        { country: 'China', name: 'Evergrande Auto City', region: 'Guangdong', slug: 'bad-city' },
        { country: 'China', name: 'China Academy of Launch Vehicle Technology', region: 'Beijing', slug: 'bad-academy' },
        { country: 'China', name: 'Sysnet Info-Tech', region: 'Beijing', slug: 'bad-it' },
      ],
      updatedAt: new Date().toISOString(),
    }), 'utf8')

    const feed = await collectAsiaPlantLeads({
      countries: ['china'],
      fetchImpl: async () => ({ json: async () => ({ results: { bindings: [] } }), ok: true }),
      outputPath,
      regionCodes: ['CN-GD'],
      sources: ['wikidata'],
    })

    expect(feed.items).toHaveLength(0)

    await rm(dir, { force: true, recursive: true })
  })
})
