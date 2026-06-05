import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BANNED_PATTERN } from './russia-plant-collector.mjs'

export const DEFAULT_OUTPUT = 'src/data/asiaMassPlantLeads.json'
export const DEFAULT_COVERAGE_OUTPUT = 'src/data/asiaCoverage.generated.json'
export const DEFAULT_INDIA_TARGET = 100
export const DEFAULT_CHINA_TARGET = 150
export const DEFAULT_CONCURRENCY = 1
export const DATA_GOV_IN_COMPANY_MASTER_RESOURCE = 'ec58dab7-d891-4abb-936e-d5d274a6ce9b'
export const DATA_GOV_IN_COMPANY_MASTER_URL = 'https://data.gov.in/catalog/company-master-data'
export const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'

const COUNTRY_QIDS = {
  china: 'Q148',
  india: 'Q668',
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

export const ASIA_TENDER_PLATFORMS = {
  china: [
    { label: 'China Government Procurement Network', url: 'https://www.ccgp.gov.cn/', searchUrl: 'https://search.ccgp.gov.cn/bxsearch' },
    { label: 'CCGP search', url: 'https://search.ccgp.gov.cn/' },
  ],
  india: [
    { label: 'Government e-Marketplace (GeM)', url: 'https://gem.gov.in/' },
    { label: 'Central Public Procurement Portal', url: 'https://eprocure.gov.in/cppp/' },
  ],
}

const STANDARD_VERSION = 'tenderstart-plant-profile-v1'

export const INDIA_REGIONS = [
  ['IN-AP', 'Andhra Pradesh'], ['IN-AR', 'Arunachal Pradesh'], ['IN-AS', 'Assam'], ['IN-BR', 'Bihar'],
  ['IN-CT', 'Chhattisgarh'], ['IN-GA', 'Goa'], ['IN-GJ', 'Gujarat'], ['IN-HR', 'Haryana'],
  ['IN-HP', 'Himachal Pradesh'], ['IN-JH', 'Jharkhand'], ['IN-KA', 'Karnataka'], ['IN-KL', 'Kerala'],
  ['IN-MP', 'Madhya Pradesh'], ['IN-MH', 'Maharashtra'], ['IN-MN', 'Manipur'], ['IN-ML', 'Meghalaya'],
  ['IN-MZ', 'Mizoram'], ['IN-NL', 'Nagaland'], ['IN-OR', 'Odisha'], ['IN-PB', 'Punjab'],
  ['IN-RJ', 'Rajasthan'], ['IN-SK', 'Sikkim'], ['IN-TN', 'Tamil Nadu'], ['IN-TG', 'Telangana'],
  ['IN-TR', 'Tripura'], ['IN-UP', 'Uttar Pradesh'], ['IN-UT', 'Uttarakhand'], ['IN-WB', 'West Bengal'],
  ['IN-AN', 'Andaman and Nicobar Islands'], ['IN-CH', 'Chandigarh'], ['IN-DH', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['IN-DL', 'Delhi'], ['IN-JK', 'Jammu and Kashmir'], ['IN-LA', 'Ladakh'], ['IN-LD', 'Lakshadweep'], ['IN-PY', 'Puducherry'],
].map(([iso, region]) => ({ country: 'India', countrySlug: 'india', iso, region, regionSlug: slugify(region), target: DEFAULT_INDIA_TARGET }))

export const CHINA_REGIONS = [
  ['CN-AH', 'Anhui'], ['CN-BJ', 'Beijing'], ['CN-CQ', 'Chongqing'], ['CN-FJ', 'Fujian'], ['CN-GD', 'Guangdong'],
  ['CN-GS', 'Gansu'], ['CN-GX', 'Guangxi'], ['CN-GZ', 'Guizhou'], ['CN-HA', 'Henan'], ['CN-HB', 'Hubei'],
  ['CN-HE', 'Hebei'], ['CN-HI', 'Hainan'], ['CN-HL', 'Heilongjiang'], ['CN-HN', 'Hunan'], ['CN-JL', 'Jilin'],
  ['CN-JS', 'Jiangsu'], ['CN-JX', 'Jiangxi'], ['CN-LN', 'Liaoning'], ['CN-NM', 'Inner Mongolia'], ['CN-NX', 'Ningxia'],
  ['CN-QH', 'Qinghai'], ['CN-SC', 'Sichuan'], ['CN-SD', 'Shandong'], ['CN-SH', 'Shanghai'], ['CN-SN', 'Shaanxi'],
  ['CN-SX', 'Shanxi'], ['CN-TJ', 'Tianjin'], ['CN-XJ', 'Xinjiang'], ['CN-XZ', 'Tibet'], ['CN-YN', 'Yunnan'],
  ['CN-ZJ', 'Zhejiang'],
].map(([iso, region]) => ({ country: 'China', countrySlug: 'china', iso, region, regionSlug: slugify(region), target: DEFAULT_CHINA_TARGET }))

const ALL_ASIA_REGIONS = [...INDIA_REGIONS, ...CHINA_REGIONS]

export const ASIA_OSM_CLUSTERS = {
  'CN-FJ': [
    { bbox: [24.25, 117.75, 24.95, 118.45], name: 'Xiamen/Quanzhou industrial corridor' },
    { bbox: [25.8, 119.05, 26.25, 119.55], name: 'Fuzhou industrial area' },
  ],
  'CN-GD': [
    { bbox: [22.45, 113.75, 23.35, 114.65], name: 'Guangzhou/Shenzhen/Dongguan corridor' },
    { bbox: [22.75, 112.65, 23.25, 113.35], name: 'Foshan industrial area' },
  ],
  'CN-HB': [
    { bbox: [30.25, 113.7, 30.85, 114.65], name: 'Wuhan industrial area' },
    { bbox: [30.55, 111.0, 30.95, 111.65], name: 'Yichang chemical corridor' },
  ],
  'CN-JS': [
    { bbox: [31.0, 120.0, 32.35, 121.25], name: 'Suzhou/Wuxi/Changzhou corridor' },
    { bbox: [31.75, 118.45, 32.35, 119.25], name: 'Nanjing industrial area' },
  ],
  'CN-LN': [
    { bbox: [38.75, 121.05, 41.95, 123.95], name: 'Dalian/Yingkou/Shenyang industrial corridor' },
  ],
  'CN-SD': [
    { bbox: [35.75, 119.65, 36.55, 120.75], name: 'Qingdao industrial area' },
    { bbox: [36.45, 117.7, 37.0, 118.35], name: 'Zibo/Dongying chemical corridor' },
  ],
  'CN-SH': [
    { bbox: [30.75, 120.85, 31.55, 122.05], name: 'Shanghai industrial area' },
  ],
  'CN-ZJ': [
    { bbox: [29.6, 121.05, 30.35, 122.0], name: 'Ningbo petrochemical/port area' },
    { bbox: [30.05, 119.75, 30.55, 120.45], name: 'Hangzhou industrial area' },
  ],
  'IN-AP': [
    { bbox: [17.35, 82.95, 17.95, 83.55], name: 'Visakhapatnam industrial area' },
    { bbox: [15.8, 80.1, 16.7, 81.0], name: 'Vijayawada/Guntur industrial area' },
  ],
  'IN-GJ': [
    { bbox: [21.4, 72.9, 22.35, 73.55], name: 'Dahej/Bharuch/Vadodara chemical belt' },
    { bbox: [22.75, 72.15, 23.25, 72.85], name: 'Ahmedabad industrial area' },
  ],
  'IN-KA': [
    { bbox: [12.65, 77.25, 13.35, 78.1], name: 'Bengaluru industrial area' },
    { bbox: [12.75, 74.65, 13.25, 75.15], name: 'Mangaluru industrial/port area' },
  ],
  'IN-MH': [
    { bbox: [18.65, 72.75, 19.45, 73.35], name: 'Mumbai/Navi Mumbai industrial area' },
    { bbox: [18.25, 73.55, 18.85, 74.25], name: 'Pune industrial area' },
  ],
  'IN-OR': [
    { bbox: [20.15, 85.7, 20.95, 86.85], name: 'Paradip/Kalinganagar industrial corridor' },
  ],
  'IN-RJ': [
    { bbox: [26.55, 75.45, 27.15, 76.2], name: 'Jaipur industrial area' },
    { bbox: [24.9, 75.55, 25.35, 76.05], name: 'Kota industrial area' },
  ],
  'IN-TG': [
    { bbox: [17.1, 78.05, 17.85, 78.85], name: 'Hyderabad industrial/pharma area' },
  ],
  'IN-TN': [
    { bbox: [12.65, 79.75, 13.35, 80.4], name: 'Chennai industrial area' },
    { bbox: [10.75, 76.75, 11.25, 77.25], name: 'Coimbatore industrial area' },
  ],
}

export function buildOverpassQuery(region, limit = region.target) {
  return `
    [out:json][timeout:45];
    area["ISO3166-2"="${region.iso}"]->.searchArea;
    (
      nwr(area.searchArea)["man_made"="works"]["name"];
      nwr(area.searchArea)["industrial"]["name"];
      nwr(area.searchArea)["landuse"="industrial"]["name"];
    );
    out tags center ${Math.min(limit * 3, 600)};
  `
}

export function buildClusterOverpassQuery(cluster, limit = 80) {
  const bbox = cluster.bbox.join(',')
  return `
    [out:json][timeout:45];
    (
      nwr(${bbox})["man_made"="works"]["name"];
      nwr(${bbox})["industrial"]["name"];
      nwr(${bbox})["building"="industrial"]["name"];
      nwr(${bbox})["landuse"="industrial"]["name"];
    );
    out tags center ${Math.min(limit * 4, 500)};
  `
}

export function osmQueriesForRegion(region) {
  const clusters = ASIA_OSM_CLUSTERS[region.iso] ?? []
  return [
    ...clusters.map((cluster) => ({
      label: cluster.name,
      query: buildClusterOverpassQuery(cluster, Math.ceil(region.target / Math.max(1, clusters.length))),
      type: 'cluster',
    })),
    { label: `${region.region} ISO3166-2 area`, query: buildOverpassQuery(region), type: 'region' },
  ]
}

export function hasOsmClusters(region) {
  return Boolean(ASIA_OSM_CLUSTERS[region.iso]?.length)
}

export function parseOsmIndustrialElements(osmJson, region, target = region.target) {
  const seen = new Set()
  const items = []

  for (const element of osmJson.elements ?? []) {
    const tags = element.tags ?? {}
    const name = cleanName(tags.name ?? tags.operator ?? tags.brand ?? '')
    const industrial = cleanName(tags.industrial ?? tags.man_made ?? tags.landuse ?? 'industrial')
    const text = `${name} ${industrial}`
    if (!name || BANNED_PATTERN.test(name) || ASIA_BANNED_PATTERN.test(text) || isNonPlantName(name) || !passesAgriculturePlantationGate(text)) continue

    const key = normalizeKey(`${region.country}:${region.region}:${name}`)
    if (seen.has(key)) continue
    seen.add(key)
    items.push(toPlantLead({ element, industrial, name, region }))
    if (items.length >= target) break
  }

  return items
}

export function parseIndiaCompanyMasterRecords(records, region, target = region.target) {
  const seen = new Set()
  const items = []

  for (const record of records ?? []) {
    const name = cleanName(pickFirst(record, [
      'company_name',
      'companyName',
      'Company Name',
      'COMPANY_NAME',
      'company',
      'name',
    ]))
    const activity = cleanName(pickFirst(record, [
      'principal_business_activity',
      'principal_business_activity_as_per_cin',
      'industrial_class',
      'industrial_class_description',
      'nic_code_description',
      'business_activity',
      'activity',
    ]))
    const status = cleanName(pickFirst(record, [
      'company_status',
      'company_status_for_efiling',
      'status',
      'Company Status',
    ]))
    const registeredState = cleanName(pickFirst(record, [
      'registered_state',
      'state',
      'registered_office_state',
      'roc',
    ]))

    if (!name || BANNED_PATTERN.test(name) || ASIA_BANNED_PATTERN.test(`${name} ${activity}`)) continue
    if (status && isInactiveStatus(status)) continue
    if (registeredState && !stateMatchesRegion(registeredState, region.region)) continue
    if (!isLikelyManufacturingCompany(`${name} ${activity}`)) continue

    const key = normalizeKey(`${region.country}:${region.region}:${name}`)
    if (seen.has(key)) continue
    seen.add(key)
    items.push(toRegistryPlantLead({ record, name, activity, region, status }))
    if (items.length >= target) break
  }

  return items
}

export function parseWikidataIndustrialRecords(wikidataJson, region, target = region.target) {
  const seen = new Set()
  const items = []

  for (const binding of wikidataJson?.results?.bindings ?? []) {
    const sourceUrl = binding.item?.value ?? ''
    const qid = sourceUrl.split('/').pop()?.toLowerCase() ?? ''
    const name = cleanName(binding.itemLabel?.value ?? '')
    const industry = cleanName(binding.industryLabel?.value ?? binding.classLabel?.value ?? '')
    const text = `${name} ${industry}`
    if (!sourceUrl || !qid || !name || /^q\d+$/i.test(name) || isNonPlantName(name)) continue
    if (ASIA_BANNED_PATTERN.test(text) || BANNED_PATTERN.test(text) || !isIndustrialBusiness(text)) continue

    const key = normalizeKey(`${region.country}:${region.region}:${name}`)
    if (seen.has(key)) continue
    seen.add(key)
    items.push(toExternalPlantLead({
      documents: ['Wikidata entity', industry ? `Industry: ${industry}` : 'industry classification required'],
      id: qid,
      industrial: industry || 'industrial company',
      name,
      region,
      sourceName: 'Wikidata industrial companies',
      sourceUrl,
    }))
    if (items.length >= target) break
  }

  return items
}

export function buildWikidataIndustrialQuery(region, limit = region.target) {
  const countryQid = COUNTRY_QIDS[region.countrySlug]
  return `SELECT DISTINCT ?item ?itemLabel ?industryLabel ?classLabel WHERE {
  ?region wdt:P300 "${region.iso}".
  ?item wdt:P17 wd:${countryQid}.
  ?item wdt:P131* ?region.
  {
    ?item wdt:P31/wdt:P279* wd:Q83405.
  } UNION {
    ?item wdt:P31/wdt:P279* wd:Q4830453.
    ?item wdt:P452 ?industry.
  } UNION {
    ?item wdt:P31/wdt:P279* wd:Q6881511.
    ?item wdt:P452 ?industry.
  }
  OPTIONAL { ?item wdt:P452 ?industry. }
  OPTIONAL { ?item wdt:P31 ?class. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ru,zh". }
}
LIMIT ${Math.min(800, Math.max(100, limit * 5))}`
}

export function buildIndiaCompanyMasterUrl(region, { apiKey = '', limit = 1000, offset = 0 } = {}) {
  const url = new URL(`https://api.data.gov.in/resource/${DATA_GOV_IN_COMPANY_MASTER_RESOURCE}`)
  if (apiKey) url.searchParams.set('api-key', apiKey)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))
  url.searchParams.set('filters[registered_state]', region.region)
  return url.toString()
}

export async function collectAsiaPlantLeads({
  coverageOutputPath = null,
  countries = ['india', 'china'],
  fetchImpl = fetch,
  limitRegions = null,
  onProgress = null,
  outputPath = DEFAULT_OUTPUT,
  previousFallback = true,
  regionCodes = null,
  sources = ['mca', 'wikidata', 'osm'],
  target = null,
  targetChina = null,
  targetIndia = null,
} = {}) {
  let regions = applyTargetOverrides([
    ...(countries.includes('india') ? INDIA_REGIONS : []),
    ...(countries.includes('china') ? CHINA_REGIONS : []),
  ], { target, targetChina, targetIndia })
  if (regionCodes?.length) {
    const allowed = new Set(regionCodes.map((code) => code.toUpperCase()))
    regions = regions.filter((region) => allowed.has(region.iso.toUpperCase()))
  }
  if (limitRegions) regions = regions.slice(0, limitRegions)
  const previous = previousFallback ? await readPreviousFeed(outputPath) : null
  const items = sanitizeLeadItems(previous?.items ?? [])
  const coverageRegions = buildCoverageRegionScope(regions, items, previous?.coverage)
  const coverage = buildActualCoverage(previous?.coverage ?? {}, items, { target, targetChina, targetIndia }, coverageRegions)

  for (const region of regions) {
    const coverageKey = regionKey(region)
    const previousRegionItems = items.filter((item) => item.country === region.country && item.region === region.region)
    const result = await collectRegion(region, fetchImpl, sources)
    const regionItems = mergeRegionItems(previousRegionItems, result).slice(0, region.target)
    coverage[coverageKey] = {
      collected: regionItems.length,
      complete: regionItems.length >= region.target,
      iso: region.iso,
      sourceBreakdown: countBy(regionItems, 'sourceName'),
      sources,
      target: region.target,
      tenderPlatforms: ASIA_TENDER_PLATFORMS[region.countrySlug] ?? [],
    }
    removeRegionItems(items, region)
    items.push(...regionItems)
    const feed = buildFeed({ coverage, items, regions: coverageRegions })
    await writeFeed(outputPath, feed)
    onProgress?.({ coverage: coverage[coverageKey], region })
  }

  const feed = buildFeed({ coverage, items, regions: coverageRegions })

  await writeFeed(outputPath, feed)
  if (coverageOutputPath) await writeCoverageSnapshot(feed, coverageOutputPath)
  return feed
}

async function collectRegion(region, fetchImpl, sources = ['mca', 'wikidata', 'osm']) {
  const collected = []

  if (region.countrySlug === 'india' && sources.includes('mca')) {
    collected.push(...await collectIndiaCompanyMasterRegion(region, fetchImpl))
  }

  if (collected.length < region.target && sources.includes('wikidata')) {
    collected.push(...await collectWikidataRegion(region, fetchImpl))
  }

  if (collected.length < region.target && sources.includes('osm')) {
    collected.push(...await collectOsmRegion(region, fetchImpl))
  }

  return dedupeProfiles(collected).slice(0, region.target)
}

async function collectIndiaCompanyMasterRegion(region, fetchImpl) {
  const env = { ...loadProjectEnv(), ...process.env }
  const apiKey = env.DATA_GOV_IN_API_KEY
  if (!apiKey) return []
  const rows = []
  const pageLimit = 1000

  for (let offset = 0; offset < 3000 && rows.length < region.target * 4; offset += pageLimit) {
    const json = await fetchJson(fetchImpl, buildIndiaCompanyMasterUrl(region, { apiKey, limit: pageLimit, offset }))
    const records = json?.records ?? []
    if (!records.length) break
    rows.push(...records)
    if (records.length < pageLimit) break
  }

  return parseIndiaCompanyMasterRecords(rows, region)
}

async function collectWikidataRegion(region, fetchImpl) {
  const countryQid = COUNTRY_QIDS[region.countrySlug]
  if (!countryQid) return []

  const url = new URL(WIKIDATA_SPARQL_ENDPOINT)
  url.searchParams.set('format', 'json')
  url.searchParams.set('query', buildWikidataIndustrialQuery(region))
  const json = await fetchJson(fetchImpl, url.toString(), {
    accept: 'application/sparql-results+json',
    'user-agent': 'TenderStart Asia plant collector',
  })
  return parseWikidataIndustrialRecords(json, region)
}

async function collectOsmRegion(region, fetchImpl) {
  const collected = []

  for (const queryPlan of osmQueriesForRegion(region)) {
    const remaining = Math.max(1, region.target - collected.length)
    const osmJson = await fetchOsmQuery(fetchImpl, queryPlan.query)
    if (!osmJson) continue
    collected.push(...parseOsmIndustrialElements(osmJson, region, remaining))
    const deduped = dedupeProfiles(collected)
    collected.length = 0
    collected.push(...deduped)
    if (collected.length >= region.target) return collected.slice(0, region.target)
  }

  return collected.slice(0, region.target)
}

async function fetchOsmQuery(fetchImpl, query) {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)
    try {
      const response = await fetchImpl(endpoint, {
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'TenderStart/0.1 (chemical supply-chain research; contact: tenderstart.local)',
        },
        method: 'POST',
        signal: controller.signal,
      })
      if (!response.ok) continue
      return await response.json()
    } catch {
      continue
    } finally {
      clearTimeout(timeout)
    }
  }
  return []
}

async function fetchJson(fetchImpl, url, headers = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetchImpl(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'TenderStart Asia plant collector',
        ...headers,
      },
      signal: controller.signal,
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function toPlantLead({ element, industrial, name, region }) {
  const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`
  const entityLevel = inferEntityLevel({ industrial, name, sourceName: 'OpenStreetMap Overpass', tags: element.tags })
  return toExternalPlantLead({
    documents: ['OpenStreetMap object', 'supplier website required', 'SDS/COA required for chemical raw materials', 'contract/RFQ required'],
    entityLevel,
    id: element.id,
    industrial,
    name,
    region,
    sourceName: 'OpenStreetMap Overpass',
    sourceUrl,
  })
}

function toRegistryPlantLead({ activity, name, record, region, status }) {
  const cin = cleanName(pickFirst(record, ['corporate_identity_number', 'cin', 'CIN']))
  const address = cleanName(pickFirst(record, [
    'registered_office_address',
    'registered_address',
    'address',
    'Registered Office Address',
  ]))
  const category = cleanName(pickFirst(record, ['company_category', 'category', 'company_class']))
  const registeredAt = cleanName(pickFirst(record, ['date_of_registration', 'registration_date', 'incorporation_date']))
  const profile = inferIndustrialProfile(name, activity)
  const sourceUrl = DATA_GOV_IN_COMPANY_MASTER_URL
  const verification = normalizeVerification([
    'registry: India MCA Company Master Data',
    cin ? `CIN: ${cin}` : '',
    status ? `company status: ${status}` : '',
    category ? `company category: ${category}` : '',
  ])

  return {
    address: address || null,
    city: region.region,
    country: region.country,
    dataQuality: 'lead',
    demandItems: profile.demandItems.map((item) => ({
      ...item,
      source: 'India MCA Company Master Data + tender/RFQ enrichment required',
      sourceUrl,
    })),
    documents: [
      'India MCA Company Master Data row',
      cin ? `CIN ${cin}` : '',
      status ? `Status: ${status}` : '',
      category ? `Category: ${category}` : '',
      registeredAt ? `Registered: ${registeredAt}` : '',
      'supplier website required',
      'SDS/COA required for chemical raw materials',
      'contract/RFQ required',
    ].filter(Boolean),
    equipment: profile.equipment,
    industry: profile.industry,
    entityLevel: 'company',
    hasAddress: Boolean(address),
    hasProductEvidence: hasProductEvidence(profile.productionItems),
    legalName: name,
    logoLabel: makeLogoLabel(name),
    logistics: buildAsiaLogistics(region),
    name,
    needsOfficialVerification: true,
    procurementContacts: ['procurement contact not public yet; enrich through official site, GeM/CPPP, RFQ and export documents'],
    procurementEvidence: buildAsiaProcurementEvidence({ plantName: name, region, needs: profile.purchaseCategories, sourceUrl }),
    productionItems: profile.productionItems.map((item) => ({
      ...item,
      source: 'India MCA Company Master Data',
      sourceUrl,
    })),
    products: profile.products,
    purchaseCategories: profile.purchaseCategories,
    region: region.region,
    slug: `asia-india-${region.regionSlug}-${slugify(name)}-${slugify(cin || hashText(name))}`,
    sourceName: 'India MCA Company Master Data',
    sourceUrl,
    verification,
    volume: 'needs confirmation from plant/RFQ/export records',
  }
}

function toExternalPlantLead({ documents, entityLevel = null, id, industrial, name, region, sourceName, sourceUrl }) {
  const profile = inferIndustrialProfile(name, industrial)
  const resolvedEntityLevel = entityLevel ?? inferEntityLevel({ industrial, name, sourceName })
  return {
    address: null,
    city: region.region,
    country: region.country,
    dataQuality: 'lead',
    demandItems: profile.demandItems.map((item) => ({
      ...item,
      source: `${sourceName} + tender/RFQ enrichment required`,
      sourceUrl,
    })),
    documents,
    equipment: profile.equipment,
    entityLevel: resolvedEntityLevel,
    hasAddress: false,
    hasProductEvidence: hasProductEvidence(profile.productionItems),
    industry: profile.industry,
    legalName: null,
    logoLabel: makeLogoLabel(name),
    logistics: buildAsiaLogistics(region),
    name,
    needsOfficialVerification: true,
    procurementContacts: ['procurement contact not public yet; enrich through official site, local tender portal, RFQ and export documents'],
    procurementEvidence: buildAsiaProcurementEvidence({ plantName: name, region, needs: profile.purchaseCategories, sourceUrl }),
    productionItems: profile.productionItems.map((item) => ({ ...item, source: sourceName, sourceUrl })),
    products: profile.products,
    purchaseCategories: profile.purchaseCategories,
    region: region.region,
    slug: `asia-${region.countrySlug}-${region.regionSlug}-${slugify(name)}-${slugify(id)}`,
    sourceName,
    sourceUrl,
    verification: buildVerification({ entityLevel: resolvedEntityLevel, sourceName, sourceUrl }),
    volume: 'needs confirmation',
  }
}

function inferIndustrialProfile(name, industrial) {
  const text = `${name} ${industrial}`.toLowerCase()
  if (/chemical|chem|pharma|drug|fertili|paint|polymer|plastic|resin|petro|rubber|dye|pigment/.test(text)) {
    return {
      demandItems: [lineItem('chemical raw materials', 'SDS/MSDS, COA, purity, impurity profile, packaging, storage class', 'monthly/contract basis')],
      equipment: ['reactors/mixers', 'storage tanks', 'filling/packaging', 'QC laboratory'],
      industry: 'chemicals and materials',
      productionItems: [lineItem('chemical/material product', 'grade, concentration, CAS/HS, COA required', 'needs confirmation')],
      products: ['chemical/material products'],
      purchaseCategories: ['solvents', 'surfactants', 'additives', 'packaging', 'lab reagents', 'logistics'],
    }
  }
  if (/steel|metal|foundry|machine|auto|engine|parts|electronics|cable|wire|battery|cement|glass|textile|mill/.test(text)) {
    return {
      demandItems: [lineItem('industrial inputs', 'grade/specification, certificate, batch, delivery terms', 'production program')],
      equipment: ['production line', 'warehouse', 'quality control', 'maintenance'],
      industry: 'industrial manufacturing',
      productionItems: [lineItem('industrial product', 'technical specification, certificate, batch', 'needs confirmation')],
      products: ['industrial products'],
      purchaseCategories: ['metals', 'polymers', 'chemicals', 'spare parts', 'packaging', 'logistics'],
    }
  }
  return {
    demandItems: [lineItem('raw materials by production profile', 'specification, quality passport, certificates, delivery terms', 'production program')],
    equipment: ['production line', 'warehouse', 'quality control'],
    industry: 'manufacturing lead',
    productionItems: [lineItem('manufactured product', 'technical specification and quality documents required', 'needs confirmation')],
    products: ['manufactured products'],
    purchaseCategories: ['raw materials', 'packaging', 'equipment parts', 'lab/control', 'logistics'],
  }
}

function lineItem(name, spec, volume) {
  return {
    documents: ['specification', 'quality certificate/COA', 'contract', 'delivery documents'],
    name,
    spec,
    status: 'lead',
    volume,
  }
}

function buildAsiaLogistics(region) {
  if (region.countrySlug === 'india' || normalizeKey(region.country) === 'india') {
    return [
      'domestic trucking/rail to Indian port or airport',
      'export customs and DGFT/IEC document check',
      'sea route to Russia via west/east India ports; sanctions and bank compliance require separate check',
      'SDS/MSDS, COA, packing list, invoice and HS code required before quotation',
    ]
  }
  return [
    'domestic trucking/rail to Chinese port or border hub',
    'export customs and HS code/classification check',
    'sea or rail route to Russia; alternative route and compliance require separate check',
    'SDS/MSDS, COA, packing list, invoice and certificate of origin required before quotation',
  ]
}

function buildAsiaProcurementEvidence({ plantName, region, needs, sourceUrl }) {
  const platforms = ASIA_TENDER_PLATFORMS[region.countrySlug] ?? []
  const inferredNeeds = needs?.slice(0, 7) ?? ['raw materials', 'packaging', 'spare parts', 'logistics']
  const platformSignals = platforms.slice(0, 2).map((platform) => ({
    documents: ['tender notice/RFQ', 'technical specification', 'draft contract', 'supplier qualification documents'],
    extractionTasks: [
      'find plant official website and procurement page',
      'search tender portal by legal name and product categories',
      'extract item names, specs, volumes, delivery terms and documents into TenderStart',
    ],
    inferredNeeds,
    note: `${platform.label}: источник для подтверждения закупок; данные нужно вытаскивать в карточку, а ссылку оставлять только для аудита.`,
    source: platform.label,
    sourceUrl: buildTenderSearchUrl(platform, plantName),
    status: 'поиск в ЕИС/ЭТП',
    title: `${platform.label}: закупки ${plantName}`,
  }))

  return [
    ...platformSignals,
    {
      documents: ['official registry/profile', 'manufacturer website', 'SDS/COA/TDS if chemical product', 'export/RFQ documents'],
      extractionTasks: ['confirm producer status', 'extract product list', 'extract contacts and certificates', 'link products to CAS/HS where possible'],
      inferredNeeds,
      note: 'Lead-карточка производителя: подтверждать через официальный сайт, тендеры, RFQ и документы партии.',
      source: 'TenderStart Asia enrichment queue',
      sourceUrl,
      status: 'профильная гипотеза',
      title: `Очередь обогащения: ${plantName}`,
    },
  ]
}

function buildTenderSearchUrl(platform, query) {
  if (platform.searchUrl?.includes('ccgp')) {
    const url = new URL(platform.searchUrl)
    url.searchParams.set('searchtype', '1')
    url.searchParams.set('kw', query)
    return url.toString()
  }
  return platform.url
}

function inferEntityLevel({ industrial = '', name = '', sourceName = '', tags = {} } = {}) {
  const text = `${name} ${industrial} ${sourceName} ${Object.values(tags).join(' ')}`.toLowerCase()
  if (/industrial park|industrial estate|industrial area|science and technology park|technology park|sez|zone/.test(text)) return 'park'
  if (/man_made.*works|\bworks\b|\bfactory\b|\bplant\b|\brefinery\b|\bshipyard\b|\bmill\b|\bfoundry\b|\bsmelter\b|\bcement\b|chemical works/.test(text)) return 'plant'
  if (/plantation/.test(text)) return 'company'
  if (/wikidata|mca|company|limited|ltd|corporation|industries|group|co\./.test(text)) return 'company'
  return 'unknown'
}

function buildVerification({ entityLevel, sourceName, sourceUrl }) {
  return normalizeVerification([
    `${sourceName}: source record`,
    `entity level: ${entityLevel}`,
    sourceUrl ? `source URL: ${sourceUrl}` : '',
  ])
}

function normalizeVerification(value) {
  const raw = Array.isArray(value) ? value : [value]
  return raw
    .flatMap((item) => String(item ?? '').split('|'))
    .map((item) => item.trim())
    .filter(Boolean)
}

function hasProductEvidence(items = []) {
  return items.some((item) => item.status !== 'lead' || /cas|hs|tds|grade|concentration|purity|assay|gost|tu|sto|batch/i.test(`${item.name} ${item.spec}`))
}

function dedupeProfiles(items) {
  const seen = new Set()
  const result = []
  for (const item of items) {
    const key = normalizeKey(`${item.country}:${item.region}:${item.name}`)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

function buildFeed({ coverage, items, regions = null }) {
  const normalizedItems = sanitizeLeadItems(items)
  const actualCoverage = buildActualCoverage(coverage, normalizedItems, {}, regions ?? buildCoverageRegionScope([], normalizedItems, coverage))
  return {
    updatedAt: new Date().toISOString(),
    standardVersion: STANDARD_VERSION,
    source: 'India MCA Company Master Data + Wikidata industrial companies + OpenStreetMap Overpass',
    sourceRegistry: {
      indiaMca: DATA_GOV_IN_COMPANY_MASTER_URL,
      openStreetMap: 'https://www.openstreetmap.org/',
      overpass: OVERPASS_ENDPOINTS,
      wikidata: WIKIDATA_SPARQL_ENDPOINT,
    },
    targetPerRegion: {
      china: DEFAULT_CHINA_TARGET,
      india: DEFAULT_INDIA_TARGET,
    },
    tenderPlatforms: ASIA_TENDER_PLATFORMS,
    coverage: actualCoverage,
    items: dedupeProfiles(normalizedItems).sort((a, b) => `${a.country} ${a.region} ${a.name}`.localeCompare(`${b.country} ${b.region} ${b.name}`)),
  }
}

function sanitizeLeadItems(items) {
  return dedupeProfiles(items.map(withRequiredLeadDefaults).filter(isAcceptableLeadItem))
}

function isAcceptableLeadItem(item) {
  const text = `${item.name ?? ''} ${item.industry ?? ''} ${(item.documents ?? []).join(' ')}`
  return Boolean(item.name && item.slug) && !ASIA_BANNED_PATTERN.test(text) && !BANNED_PATTERN.test(text) && !isNonPlantName(item.name) && passesAgriculturePlantationGate(text)
}

function withRequiredLeadDefaults(item) {
  const profile = inferIndustrialProfile(item.name ?? '', item.industry ?? '')
  const sourceName = item.sourceName ?? 'legacy Asia lead checkpoint'
  const sourceUrl = item.sourceUrl ?? 'https://www.openstreetmap.org/'
  const purchaseCategories = item.purchaseCategories ?? profile.purchaseCategories
  const entityLevel = item.entityLevel ?? inferEntityLevel({ industrial: item.industry, name: item.name, sourceName })
  const productionItems = normalizeLineItems(item.productionItems, profile.productionItems, sourceName, sourceUrl)
  return {
    ...item,
    dataQuality: item.dataQuality ?? 'lead',
    demandItems: normalizeLineItems(item.demandItems, profile.demandItems, sourceName, sourceUrl),
    documents: item.documents ?? ['plant lead card', 'official source required', 'SDS/COA/TDS required for chemical raw materials', 'tender/RFQ documents required'],
    equipment: item.equipment ?? profile.equipment,
    entityLevel,
    hasAddress: item.hasAddress ?? Boolean(item.address),
    hasProductEvidence: item.hasProductEvidence ?? hasProductEvidence(productionItems),
    industry: item.industry ?? profile.industry,
    logistics: item.logistics ?? buildAsiaLogistics({ country: item.country, countrySlug: normalizeKey(item.country), region: item.region }),
    logoLabel: item.logoLabel ?? makeLogoLabel(item.name),
    needsOfficialVerification: item.needsOfficialVerification ?? true,
    procurementContacts: item.procurementContacts ?? ['procurement contact not public yet; enrich through official site, tender portal and RFQ'],
    procurementEvidence: item.procurementEvidence ?? buildAsiaProcurementEvidence({
      plantName: item.name,
      region: { country: item.country, countrySlug: normalizeKey(item.country), region: item.region },
      needs: purchaseCategories,
      sourceUrl,
    }),
    productionItems,
    products: item.products ?? profile.products,
    purchaseCategories,
    sourceName,
    sourceUrl,
    verification: normalizeVerification(item.verification?.length ? item.verification : buildVerification({ entityLevel, sourceName, sourceUrl })),
  }
}

function normalizeLineItems(items, fallbackItems, sourceName, sourceUrl) {
  return (items?.length ? items : fallbackItems).map((item) => ({
    ...item,
    documents: item.documents ?? ['specification', 'quality certificate/COA', 'contract', 'delivery documents'],
    source: item.source ?? sourceName,
    sourceUrl: item.sourceUrl ?? sourceUrl,
    status: item.status ?? 'lead',
  }))
}

async function writeFeed(outputPath, feed) {
  await mkdir(dirname(resolve(outputPath)), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(feed, null, 2)}\n`, 'utf8')
}

function removeRegionItems(items, region) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index].country === region.country && items[index].region === region.region) {
      items.splice(index, 1)
    }
  }
}

function mergeRegionItems(previousItems, newItems) {
  const merged = []
  const seen = new Set()
  for (const item of [...newItems, ...previousItems]) {
    const key = normalizeKey(`${item.country}:${item.region}:${item.name}`)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }
  return merged
}

function cleanName(value) {
  return String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function pickFirst(record, keys) {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null && String(record[key]).trim()) return record[key]
  }

  const normalized = Object.fromEntries(Object.entries(record ?? {}).map(([key, value]) => [normalizeKey(key), value]))
  for (const key of keys) {
    const value = normalized[normalizeKey(key)]
    if (value !== undefined && value !== null && String(value).trim()) return value
  }

  return ''
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function isNonPlantName(name) {
  return /industrial area|industrial estate|industrial park|science and technology park|technology park|auto city|estate|zone|sez|warehouse|godown|depot|market|mall|office|school|hospital|station|film studio|pictures|comics|publisher|broadcast|airport group|transport undertaking|academy|university|research institute|institute of technology|launch vehicle technology|info[- ]?tech|infotech|information technology|software|systems integrator/i.test(name)
}

const ASIA_BANNED_PATTERN =
  /beer|brewery|brewing|wine|winery|distiller|distillery|liquor|alcohol|spirits|meat|pork|beef|chicken|poultry|fish|seafood|slaughter|casino|betting|tobacco|hotel|inn|restaurant|hospitality|video game|gaming|film|pictures|cinema|television|media|comics|animation|publisher|broadcast|bank|finance|insurance|securities|airport group|transport undertaking|academy|foundation|olympiad|education|fintech|lending|technology industry|information technology|software|systems integrator|entertainment|public transport|road transport|rail transit|bus service|resort|travel|tourism/i

const EXPLICIT_PLANT_EVIDENCE_PATTERN =
  /\bfactory\b|\bworks\b|\bmill\b|\brefinery\b|\bchemical\b|\bchemicals\b|\bpharma\b|\bpharmaceuticals?\b|\bsteel\b|\bcement\b|\bfoundry\b|\bsmelter\b/i

const AGRICULTURE_PLANTATION_PATTERN =
  /\bfarmer\b|\bfarmers\b|\bfarm\b|\bfarms\b|\bfarming\b|\bproducer company\b|\bproducer companylimited\b|\bagri(?:business|cultur\w*|[-\s]?producer|[-\s]?tech)?\b|\borganic producer\b|\bplantation\b|\bplantations\b/i

function isInactiveStatus(status) {
  return /strike|struck|striking off|\bstof\b|\bupso\b|\bnaef\b|not available for e[-\s]?filing|dormant|dissolved|liquidat|inactive|converted|amalgamat|\bamal\b|closed|defunct/i.test(status)
}

function stateMatchesRegion(value, region) {
  const source = normalizeKey(value)
  const target = normalizeKey(region)
  return source.includes(target) || target.includes(source.replace(/^roc /, ''))
}

function isLikelyManufacturingCompany(value) {
  const text = String(value).toLowerCase()
  if (!passesAgriculturePlantationGate(text)) return false
  if (/finance|financial|bank|insurance|investment|trading|retail|real estate|consult|software|hospital|school|hotel|restaurant|media|telecom|education|foundation|olympiad|fintech|lending|travel|tourism/i.test(text)) {
    return isIndustrialBusiness(text)
  }
  return /manufactur|factory|works|industrial|industries|chemical|chem|pharma|drug|laborator|fertili|paint|pigment|dye|polymer|plastic|resin|petro|rubber|textile|spinning|weaving|mill|paper|packag|steel|metal|alloy|engineering|machine|machinery|auto|cement|concrete|ceramic|glass|battery|electrical|electronics|cable|wire|refinery|foundry|\bplant\b/i.test(text)
}

function isIndustrialBusiness(value) {
  if (!passesAgriculturePlantationGate(value)) return false
  const rejected =
    /bank|financial|finance|insurance|gambl|betting|casino|adult|media|film|pictures|cinema|television|comics|animation|retail|software|market research|real estate|theatre|music|news|publishing|telecom|religious|investment|stock exchange|football|sport club|banking|hotel|hospitality|restaurant|video game|gaming|education|foundation|olympiad|fintech|lending|technology industry|information technology|entertainment|public transport|road transport|rail transit|bus service|resort|travel|tourism/i
  const accepted =
    /manufactur|industry|industrial|factory|works|chemical|pharma|petroleum|refined petroleum|oil|gas|plastic|polymer|steel|metal|machin|automotive|aerospace|electronics|glass|cement|ceramic|construction|building|mining|energy|power|shipyard|logistics|agribusiness|food industry|textile|paper|packag|wood|rubber|transport|port|equipment|consumer electronics/i
  return accepted.test(value) && !rejected.test(value)
}

function passesAgriculturePlantationGate(value) {
  const text = String(value)
  return !AGRICULTURE_PLANTATION_PATTERN.test(text) || EXPLICIT_PLANT_EVIDENCE_PATTERN.test(text)
}

function hashText(value) {
  let hash = 0
  for (const char of String(value)) {
    hash = (hash << 5) - hash + char.charCodeAt(0)
    hash |= 0
  }
  return String(Math.abs(hash))
}

function makeLogoLabel(name) {
  const letters = cleanName(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
  return letters.toUpperCase() || 'AS'
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'plant'
}

async function readPreviousFeed(outputPath) {
  try {
    return JSON.parse(await readFile(outputPath, 'utf8'))
  } catch {
    return null
  }
}

function loadProjectEnv(path = '.env') {
  const fullPath = resolve(path)
  if (!existsSync(fullPath)) return {}
  return Object.fromEntries(
    readFileSync(fullPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, '')]
      }),
  )
}

function applyTargetOverrides(regions, { target = null, targetChina = null, targetIndia = null } = {}) {
  return regions.map((region) => {
    const override = region.countrySlug === 'india' ? targetIndia : targetChina
    const nextTarget = Number(override ?? target ?? region.target)
    return {
      ...region,
      target: Number.isFinite(nextTarget) && nextTarget > 0 ? nextTarget : region.target,
    }
  })
}

function buildActualCoverage(previousCoverage = {}, items = [], targetOptions = {}, regions = ALL_ASIA_REGIONS) {
  const scopedRegions = applyTargetOverrides(regions, targetOptions)
  return Object.fromEntries(
    scopedRegions.map((region) => {
      const key = regionKey(region)
      const regionItems = items.filter((item) => item.country === region.country && item.region === region.region)
      const previous = previousCoverage[key] ?? {}
      const target = previous.target ?? region.target
      return [
        key,
        {
          collected: regionItems.length,
          complete: regionItems.length >= target,
          iso: region.iso,
          sourceBreakdown: countBy(regionItems, 'sourceName'),
          sources: previous.sources ?? [],
          target,
          tenderPlatforms: ASIA_TENDER_PLATFORMS[region.countrySlug] ?? [],
        },
      ]
    }),
  )
}

function buildCoverageRegionScope(selectedRegions, items = [], previousCoverage = {}) {
  const keys = new Set(selectedRegions.map(regionKey))
  for (const item of items) keys.add(`${item.country}:${item.region}`)
  for (const key of Object.keys(previousCoverage ?? {})) keys.add(key)
  return ALL_ASIA_REGIONS.filter((region) => keys.has(regionKey(region)))
}

function regionKey(region) {
  return `${region.country}:${region.region}`
}

export function buildAsiaCoverageSnapshot(feed) {
  const countries = ['India', 'China'].map((country) => {
    const countryItems = feed.items.filter((item) => item.country === country)
    const regions = Object.entries(feed.coverage)
      .filter(([key]) => key.startsWith(`${country}:`))
      .map(([key, coverage]) => ({
        collected: coverage.collected,
        complete: coverage.complete,
        iso: coverage.iso,
        region: key.slice(country.length + 1),
        sourceBreakdown: coverage.sourceBreakdown ?? {},
        target: coverage.target,
        tenderPlatforms: coverage.tenderPlatforms ?? [],
      }))
    return {
      collected: countryItems.length,
      completeRegions: regions.filter((region) => region.complete).length,
      country,
      regions,
      sourceBreakdown: countBy(countryItems, 'sourceName'),
      target: regions.reduce((sum, region) => sum + region.target, 0),
    }
  })

  return {
    countries,
    generatedAt: feed.updatedAt,
    source: feed.source,
    standardVersion: feed.standardVersion,
    tenderPlatforms: ASIA_TENDER_PLATFORMS,
    total: feed.items.length,
    totalCompleteRegions: countries.reduce((sum, country) => sum + country.completeRegions, 0),
    totalRegions: countries.reduce((sum, country) => sum + country.regions.length, 0),
    totalTarget: countries.reduce((sum, country) => sum + country.target, 0),
  }
}

async function writeCoverageSnapshot(feed, outputPath = DEFAULT_COVERAGE_OUTPUT) {
  await mkdir(dirname(resolve(outputPath)), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(buildAsiaCoverageSnapshot(feed), null, 2)}\n`, 'utf8')
}

function countBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] ?? 'unknown'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
}

function isMain() {
  return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')
}

if (isMain()) {
  const coverageOutputPath = process.argv.find((arg) => arg.startsWith('--coverage-output='))?.slice(18) ?? DEFAULT_COVERAGE_OUTPUT
  const countriesArg = process.argv.find((arg) => arg.startsWith('--countries='))?.slice(12)
  const limitRegionsArg = process.argv.find((arg) => arg.startsWith('--limit-regions='))?.slice(16)
  const outputPath = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ?? DEFAULT_OUTPUT
  const regionsArg = process.argv.find((arg) => arg.startsWith('--regions='))?.slice(10)
  const sourcesArg = process.argv.find((arg) => arg.startsWith('--sources='))?.slice(10)
  const targetArg = process.argv.find((arg) => arg.startsWith('--target='))?.slice(9)
  const targetChinaArg = process.argv.find((arg) => arg.startsWith('--target-china='))?.slice(15)
  const targetIndiaArg = process.argv.find((arg) => arg.startsWith('--target-india='))?.slice(15)
  const countries = countriesArg ? countriesArg.split(',').map((item) => item.trim()) : ['india', 'china']
  if (process.argv.includes('--normalize-only')) {
    const previous = await readPreviousFeed(outputPath)
    const feed = buildFeed({ coverage: previous?.coverage ?? {}, items: previous?.items ?? [] })
    await writeFeed(outputPath, feed)
    await writeCoverageSnapshot(feed, coverageOutputPath)
    console.log(`Asia plant leads normalized: ${feed.items.length} records`)
    process.exit(0)
  }
  const feed = await collectAsiaPlantLeads({
    coverageOutputPath,
    countries,
    limitRegions: limitRegionsArg ? Number(limitRegionsArg) : null,
    onProgress: ({ coverage, region }) => {
      console.log(`${region.country} / ${region.region}: ${coverage.collected}/${coverage.target}`)
    },
    outputPath,
    previousFallback: !process.argv.includes('--no-previous'),
    regionCodes: regionsArg ? regionsArg.split(',').map((item) => item.trim()) : null,
    sources: sourcesArg ? sourcesArg.split(',').map((item) => item.trim()) : undefined,
    target: targetArg ? Number(targetArg) : null,
    targetChina: targetChinaArg ? Number(targetChinaArg) : null,
    targetIndia: targetIndiaArg ? Number(targetIndiaArg) : null,
  })
  const complete = Object.values(feed.coverage).filter((item) => item.complete).length
  console.log(`Asia plant leads updated: ${feed.items.length} records; complete regions ${complete}/${Object.keys(feed.coverage).length}`)
}
