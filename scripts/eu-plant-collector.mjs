import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BANNED_PATTERN } from './russia-plant-collector.mjs'

export const DEFAULT_OUTPUT = 'src/data/euMassPlantLeads.json'
export const DEFAULT_MIN_PER_COUNTRY = 50
export const DEFAULT_MAX_PAGES = 25
export const DEFAULT_CONCURRENCY = 2
export const DEFAULT_MAX_PER_COUNTRY = 220

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

export const EU_COUNTRIES = [
  { country: 'Австрия', countrySlug: 'austria', iso2: 'AT', wikidataQid: 'Q40' },
  { country: 'Бельгия', countrySlug: 'belgium', iso2: 'BE', wikidataQid: 'Q31' },
  { country: 'Болгария', countrySlug: 'bulgaria', iso2: 'BG', wikidataQid: 'Q219' },
  { country: 'Хорватия', countrySlug: 'croatia', iso2: 'HR', wikidataQid: 'Q224' },
  { country: 'Кипр', countrySlug: 'cyprus', iso2: 'CY', wikidataQid: 'Q229' },
  { country: 'Чехия', countrySlug: 'czechia', iso2: 'CZ', wikidataQid: 'Q213' },
  { country: 'Дания', countrySlug: 'denmark', iso2: 'DK', wikidataQid: 'Q35' },
  { country: 'Эстония', countrySlug: 'estonia', iso2: 'EE', manufacturersSlug: 'ee-estoniya', wikidataQid: 'Q191' },
  { country: 'Финляндия', countrySlug: 'finland', iso2: 'FI', wikidataQid: 'Q33' },
  { country: 'Франция', countrySlug: 'france', iso2: 'FR', wikidataQid: 'Q142' },
  {
    country: 'Германия',
    countrySlug: 'germany',
    iso2: 'DE',
    wikidataQid: 'Q183',
    maxPerCountry: 500,
    osmAreas: ['DE-BW', 'DE-BY', 'DE-BE', 'DE-BB', 'DE-HB', 'DE-HH', 'DE-HE', 'DE-MV', 'DE-NI', 'DE-NW', 'DE-RP', 'DE-SL', 'DE-SN', 'DE-ST', 'DE-SH', 'DE-TH'],
  },
  { country: 'Греция', countrySlug: 'greece', iso2: 'GR', wikidataQid: 'Q41' },
  { country: 'Венгрия', countrySlug: 'hungary', iso2: 'HU', wikidataQid: 'Q28' },
  { country: 'Ирландия', countrySlug: 'ireland', iso2: 'IE', wikidataQid: 'Q27' },
  { country: 'Италия', countrySlug: 'italy', iso2: 'IT', wikidataQid: 'Q38' },
  { country: 'Латвия', countrySlug: 'latvia', iso2: 'LV', manufacturersSlug: 'lv-latviya', wikidataQid: 'Q211' },
  { country: 'Литва', countrySlug: 'lithuania', iso2: 'LT', manufacturersSlug: 'lt-litva', wikidataQid: 'Q37' },
  { country: 'Люксембург', countrySlug: 'luxembourg', iso2: 'LU', wikidataQid: 'Q32' },
  { country: 'Мальта', countrySlug: 'malta', iso2: 'MT', wikidataQid: 'Q233' },
  { country: 'Нидерланды', countrySlug: 'netherlands', iso2: 'NL', wikidataQid: 'Q55' },
  { country: 'Польша', countrySlug: 'poland', iso2: 'PL', wikidataQid: 'Q36' },
  { country: 'Португалия', countrySlug: 'portugal', iso2: 'PT', wikidataQid: 'Q45' },
  { country: 'Румыния', countrySlug: 'romania', iso2: 'RO', wikidataQid: 'Q218' },
  { country: 'Словакия', countrySlug: 'slovakia', iso2: 'SK', wikidataQid: 'Q214' },
  { country: 'Словения', countrySlug: 'slovenia', iso2: 'SI', wikidataQid: 'Q215' },
  { country: 'Испания', countrySlug: 'spain', iso2: 'ES', wikidataQid: 'Q29' },
  { country: 'Швеция', countrySlug: 'sweden', iso2: 'SE', wikidataQid: 'Q34' },
]

export const tenderPlatforms = {
  EU: [
    { name: 'TED Europa', url: 'https://ted.europa.eu/' },
    { name: 'EU Funding & Tenders', url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/' },
  ],
  Австрия: [{ name: 'USP/BVergG tenders', url: 'https://www.usp.gv.at/' }],
  Бельгия: [{ name: 'e-Procurement Belgium', url: 'https://www.publicprocurement.be/' }],
  Болгария: [{ name: 'Public Procurement Portal Bulgaria', url: 'https://app.eop.bg/' }],
  Германия: [{ name: 'service.bund.de', url: 'https://www.service.bund.de/' }],
  Дания: [{ name: 'Udbud.dk', url: 'https://udbud.dk/' }],
  Испания: [{ name: 'Plataforma de Contratacion', url: 'https://contrataciondelestado.es/' }],
  Италия: [{ name: 'Acquisti in Rete', url: 'https://www.acquistinretepa.it/' }],
  Нидерланды: [{ name: 'TenderNed', url: 'https://www.tenderned.nl/' }],
  Польша: [{ name: 'Platforma e-Zamowienia', url: 'https://ezamowienia.gov.pl/' }],
  Франция: [{ name: 'Marches publics', url: 'https://www.marches-publics.gouv.fr/' }],
  Швеция: [{ name: 'Upphandlingsmyndigheten', url: 'https://www.upphandlingsmyndigheten.se/' }],
}

const EU_BANNED_PATTERN =
  /пив|алког|водоч|спирт|ликер|винн|вино|wine|winery|brew|brasserie|distill|liquor|whisk|cognac|champagne|bier|beer|meat|fish|seafood|poultry|slaughter|мяс|рыб|икр|осетр|морепродукт|хмел|солод|птиц|индей|гусь|колбас|убойн|хладобойн/i

export function companySlugToEuPlantSlug(countrySlug, companySlug) {
  return `eu-${countrySlug}-${cleanSlug(companySlug)}`
}

export function parseManufacturersEuLinks(html, baseUrl = 'https://manufacturers.ru') {
  const links = []
  const seen = new Set()
  const regexp = /href="\/enterprise\/([^"#?]+)\/([^"#?]+)[^"]*"[^>]*>(.*?)<\/a>/gis

  for (const match of html.matchAll(regexp)) {
    const countryCode = cleanSlug(match[1])
    const companySlug = cleanSlug(match[2])
    const name = cleanHtml(match[3])
    addParsedLink(links, seen, {
      companySlug,
      name,
      sourceName: 'manufacturers.ru',
      sourceUrl: `${baseUrl}/enterprise/${countryCode}/${companySlug}`,
    })
  }

  return links
}

export function parseOsmWorks(osmJson, country) {
  return (osmJson.elements ?? [])
    .map((element) => {
      const name = cleanHtml(element.tags?.name ?? element.tags?.operator ?? '')
      const type = element.type ?? 'node'
      return {
        companySlug: `osm-${countryToSlug(country)}-${type}-${element.id}`,
        name,
        sourceName: 'OpenStreetMap works',
        sourceUrl: `https://www.openstreetmap.org/${type}/${element.id}`,
      }
    })
    .filter((link) => link.name && !isBanned(link.name))
}

export function parseWikidataFactories(wikidataJson, country) {
  return (wikidataJson.results?.bindings ?? [])
    .map((binding) => {
      const sourceUrl = binding.item?.value ?? ''
      const qid = sourceUrl.split('/').pop()?.toLowerCase() ?? ''
      const name = cleanHtml(binding.itemLabel?.value ?? '')
      return {
        companySlug: `wikidata-${countryToSlug(country)}-${qid}`,
        name,
        sourceName: 'Wikidata factories',
        sourceUrl,
      }
    })
    .filter((link) => link.sourceUrl && link.name && !/^q\d+$/i.test(link.name) && !isBanned(link.name))
}

export function parseWikidataIndustrialBusinesses(wikidataJson, country) {
  const links = []
  const seen = new Set()

  for (const binding of wikidataJson.results?.bindings ?? []) {
    const sourceUrl = binding.item?.value ?? ''
    const qid = sourceUrl.split('/').pop()?.toLowerCase() ?? ''
    const name = cleanHtml(binding.itemLabel?.value ?? '')
    const industry = cleanHtml(binding.industryLabel?.value ?? '')
    const text = `${name} ${industry}`
    if (!sourceUrl || !name || /^q\d+$/i.test(name) || isBanned(text) || !isIndustrialBusiness(text)) continue
    addParsedLink(links, seen, {
      companySlug: `wikidata-industrial-${countryToSlug(country)}-${qid}`,
      name,
      sourceName: 'Wikidata industrial companies',
      sourceUrl,
    })
  }

  return links
}

export function buildTedSearchUrl(query) {
  const url = new URL('https://ted.europa.eu/en/search/result')
  url.searchParams.set('query', query)
  return url.toString()
}

export async function collectEuCountry({
  country,
  fetchImpl = fetch,
  maxPages = DEFAULT_MAX_PAGES,
  maxPerCountry = country?.maxPerCountry ?? DEFAULT_MAX_PER_COUNTRY,
  minPerCountry = DEFAULT_MIN_PER_COUNTRY,
  useOsm = true,
} = {}) {
  const collected = []
  const seen = new Set()

  if (country.manufacturersSlug) {
    for (let page = 0; page < maxPages && collected.length < maxPerCountry; page += 1) {
      const url = `https://manufacturers.ru/enterprises/${country.manufacturersSlug}${page ? `?page=${page}` : ''}`
      const html = await fetchText(fetchImpl, url)
      if (!html) break
      const before = collected.length
      addLinksToCountry({ collected, country, links: parseManufacturersEuLinks(html), seen, maxPerCountry })
      if (collected.length === before && page > 0) break
    }
  }

  if (useOsm && collected.length < maxPerCountry) {
    const osmLinks = await fetchOsmWorks(fetchImpl, country, maxPerCountry)
    addLinksToCountry({ collected, country, links: osmLinks, seen, maxPerCountry })
  }

  if (country.wikidataQid && collected.length < maxPerCountry) {
    const wikidataLinks = await fetchWikidataFactories(fetchImpl, country, maxPerCountry)
    addLinksToCountry({ collected, country, links: wikidataLinks, seen, maxPerCountry })
  }

  if (country.wikidataQid && collected.length < minPerCountry) {
    const industrialLinks = await fetchWikidataIndustrialBusinesses(fetchImpl, country, maxPerCountry)
    addLinksToCountry({ collected, country, links: industrialLinks, seen, maxPerCountry })
  }

  return {
    complete: collected.length >= minPerCountry,
    country: country.country,
    items: collected,
    min: minPerCountry,
    target: minPerCountry,
  }
}

export async function collectEuPlantLeads({
  concurrency = DEFAULT_CONCURRENCY,
  countries = null,
  fetchImpl = fetch,
  maxPages = DEFAULT_MAX_PAGES,
  maxPerCountry = DEFAULT_MAX_PER_COUNTRY,
  minPerCountry = DEFAULT_MIN_PER_COUNTRY,
  outputPath = DEFAULT_OUTPUT,
  useOsm = true,
} = {}) {
  const selectedCountries = filterEuCountries(countries)
  const selectedNames = new Set(selectedCountries.map((country) => country.country))
  const tasks = selectedCountries.map((country) => async () =>
    collectEuCountry({ country, fetchImpl, maxPages, maxPerCountry: country.maxPerCountry ?? maxPerCountry, minPerCountry, useOsm }),
  )
  const results = await runLimited(tasks, concurrency)
  const previousFeed = countries?.length ? await readPreviousFeed(outputPath) : null
  const coverage = { ...(previousFeed?.coverage ?? {}) }
  const items = []

  for (const result of results) {
    coverage[result.country] = {
      collected: result.items.length,
      complete: result.complete,
      min: result.min,
    }
    items.push(...result.items)
  }

  const preservedItems = countries?.length
    ? (previousFeed?.items ?? []).filter((item) => !selectedNames.has(item.country))
    : []
  const feed = {
    updatedAt: new Date().toISOString(),
    minPerCountry,
    source: 'manufacturers.ru EU/Baltics + OpenStreetMap works + TED/local tender platform registry',
    tenderPlatforms,
    coverage,
    items: dedupeProfiles([...preservedItems, ...items]).sort((a, b) =>
      `${a.country} ${a.name}`.localeCompare(`${b.country} ${b.name}`, 'ru'),
    ),
  }

  if (feed.items.length === 0) {
    const previousFeed = await readPreviousFeed(outputPath)
    if (previousFeed?.items?.length) return previousFeed
  }

  await mkdir(dirname(resolve(outputPath)), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(feed, null, 2)}\n`, 'utf8')
  return feed
}

function filterEuCountries(countries) {
  if (!countries?.length) return EU_COUNTRIES
  const wanted = new Set(countries.map((country) => normalizeKey(country)))
  return EU_COUNTRIES.filter((country) =>
    wanted.has(normalizeKey(country.country)) ||
    wanted.has(normalizeKey(country.countrySlug)) ||
    wanted.has(normalizeKey(country.iso2)),
  )
}

async function readPreviousFeed(outputPath) {
  try {
    return JSON.parse(await readFile(outputPath, 'utf8'))
  } catch {
    return null
  }
}

async function fetchOsmWorks(fetchImpl, country, maxPerCountry) {
  const areaCodes = country.osmAreas?.length ? country.osmAreas : [country.iso2]
  const links = []
  const seen = new Set()

  for (const areaCode of areaCodes) {
    if (links.length >= maxPerCountry) break
    const limit = Math.max(1, Math.min(100, maxPerCountry - links.length))
    const areaTag = areaCode.includes('-') ? 'ISO3166-2' : 'ISO3166-1'
    const query = `[out:json][timeout:70];
area["${areaTag}"="${areaCode}"]->.a;
(
  nwr(area.a)["man_made"="works"]["name"];
);
out tags center ${limit};`
    const text = await fetchFirstText(fetchImpl, OVERPASS_ENDPOINTS, {
      body: new URLSearchParams({ data: query }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'TenderStart EU plant collector',
      },
      method: 'POST',
    })
    if (!text) continue
    try {
      for (const link of parseOsmWorks(JSON.parse(text), country.country)) {
        const key = normalizeKey(`${link.name}:${link.sourceUrl}`)
        if (seen.has(key)) continue
        seen.add(key)
        links.push(link)
        if (links.length >= maxPerCountry) break
      }
    } catch {
      continue
    }
  }

  return links
}

async function fetchWikidataFactories(fetchImpl, country, maxPerCountry) {
  const limit = Math.min(500, Math.max(100, maxPerCountry * 3))
  const query = `SELECT DISTINCT ?item ?itemLabel WHERE {
  ?item wdt:P17 wd:${country.wikidataQid}.
  {
    ?item wdt:P31/wdt:P279* wd:Q83405.
  } UNION {
    ?item wdt:P31/wdt:P279* wd:Q13235160.
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ru,en". }
}
LIMIT ${limit}`
  const url = new URL('https://query.wikidata.org/sparql')
  url.searchParams.set('format', 'json')
  url.searchParams.set('query', query)
  const text = await fetchText(fetchImpl, url.toString(), {
    headers: {
      accept: 'application/sparql-results+json',
      'user-agent': 'TenderStart EU plant collector',
    },
  })
  if (!text || !text.trim().startsWith('{')) return []
  try {
    return parseWikidataFactories(JSON.parse(text), country.country)
  } catch {
    return []
  }
}

async function fetchWikidataIndustrialBusinesses(fetchImpl, country, maxPerCountry) {
  const limit = Math.min(500, Math.max(120, maxPerCountry * 4))
  const query = `SELECT DISTINCT ?item ?itemLabel ?industryLabel WHERE {
  ?item wdt:P17 wd:${country.wikidataQid}.
  ?item wdt:P452 ?industry.
  ?item wdt:P31/wdt:P279* ?class.
  VALUES ?class { wd:Q4830453 wd:Q6881511 wd:Q783794 wd:Q13235160 }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ru,en". }
}
LIMIT ${limit}`
  const url = new URL('https://query.wikidata.org/sparql')
  url.searchParams.set('format', 'json')
  url.searchParams.set('query', query)
  const text = await fetchText(fetchImpl, url.toString(), {
    headers: {
      accept: 'application/sparql-results+json',
      'user-agent': 'TenderStart EU plant collector',
    },
  })
  if (!text || !text.trim().startsWith('{')) return []
  try {
    return parseWikidataIndustrialBusinesses(JSON.parse(text), country.country)
  } catch {
    return []
  }
}

function addLinksToCountry({ collected, country, links, maxPerCountry, seen }) {
  for (const link of links) {
    const key = normalizeKey(`${country.country}:${link.name}`)
    if (seen.has(key)) continue
    seen.add(key)
    collected.push(profileFromLink({ country, link }))
    if (collected.length >= maxPerCountry) break
  }
}

function addParsedLink(links, seen, link) {
  if (!link.companySlug || !link.name || isBanned(link.name)) return
  const key = normalizeKey(`${link.companySlug}:${link.name}`)
  if (seen.has(key)) return
  seen.add(key)
  links.push(link)
}

function profileFromLink({ country, link }) {
  const profile = inferByName(link.name)
  const coreNeeds = profile.purchaseCategories.slice(0, 4)

  return {
    city: country.country,
    country: country.country,
    demandItems: profile.demandItems.map((item) => ({
      ...item,
      source: `${link.sourceName} + TED/local tenders`,
      sourceUrl: buildTedSearchUrl(`${link.name} ${item.name}`),
    })),
    documents: ['карточка источника', 'TED/локальные тендерные документы после выгрузки', 'COA/паспорт партии', 'договор поставки'],
    equipment: profile.equipment,
    industry: profile.industry,
    logoLabel: makeLogoLabel(link.name),
    name: link.name,
    productionItems: profile.productionItems.map((item) => ({
      ...item,
      source: link.sourceName,
      sourceUrl: link.sourceUrl,
    })),
    products: profile.products,
    purchaseCategories: profile.purchaseCategories,
    region: country.country,
    slug: companySlugToEuPlantSlug(country.countrySlug, link.companySlug),
    sourceName: link.sourceName,
    sourceUrl: link.sourceUrl,
    tenderPlatforms: [...(tenderPlatforms.EU ?? []), ...(tenderPlatforms[country.country] ?? [])],
    volume: profile.volume,
  }
}

function inferByName(name) {
  const lower = name.toLowerCase()

  if (/chem|basf|bayer|solvay|poly|plastic|pharma|oil|gas|raffin|paint|coating|rubber|werk|chemical|хим|нефт|газ/.test(lower)) {
    return profile(
      'химия, фарма и полимеры',
      ['химическая продукция', 'фарма/реагенты', 'полимеры и ЛКМ'],
      ['реакторные линии', 'фасовка', 'лабораторный контроль', 'склад сырья'],
      ['химсырье', 'катализаторы', 'тара', 'SDS/MSDS', 'опасная логистика'],
      'Химическая/полимерная продукция',
      'марка, чистота/состав, COA, SDS/MSDS, REACH',
      'Химическое сырье',
      'концентрация, COA, SDS/MSDS, REACH/CLP',
    )
  }

  if (/steel|metal|maschinen|machine|siemens|bosch|werk|plant|factory|auto|cable|electr|pump|valve|маш|металл|кабель/.test(lower)) {
    return profile(
      'машиностроение, металл и электротехника',
      ['промышленное оборудование', 'металлоизделия', 'электротехнические изделия'],
      ['металлообработка', 'сборка', 'покрытия', 'испытания'],
      ['металлопрокат', 'кабель', 'электроника', 'ЛКМ', 'инструмент', 'комплектующие'],
      'Промышленное оборудование/комплектующие',
      'чертеж/ТЗ, материал, покрытие, CE/паспорт изделия',
      'Металлопрокат и комплектующие',
      'марка стали/цветмета, размер, сертификат качества',
    )
  }

  if (/cement|concrete|glass|brick|ceramic|building|stone|lime|гипс|цемент/.test(lower)) {
    return profile(
      'стройматериалы',
      ['цемент/бетон', 'стекло/керамика', 'минеральные изделия'],
      ['дробление/помол', 'печь/обжиг', 'формование', 'склад готовой продукции'],
      ['минеральное сырье', 'пигменты', 'мешки/биг-бэги', 'ГСМ', 'запчасти'],
      'Строительные материалы',
      'EN/локальный стандарт, марка, фракция, паспорт качества',
      'Минеральное сырье',
      'фракция/активность, паспорт качества, партия',
    )
  }

  return profile(
    'промышленное производство',
    ['промышленная продукция', 'комплектующие', 'производственные услуги'],
    ['производственная линия', 'склад сырья', 'сборка/фасовка', 'контроль качества'],
    ['сырье по профилю', 'упаковка', 'запчасти', 'лабораторные анализы', 'логистика'],
    'Промышленная продукция',
    'EN/ISO/локальный стандарт, партия, паспорт качества',
    'Сырье по профилю производства',
    'спецификация, паспорт качества, партия',
  )
}

function profile(industry, products, equipment, purchaseCategories, productName, productSpec, demandName, demandSpec) {
  return {
    demandItems: [lineItem(demandName, demandSpec, 'по производственной программе')],
    equipment,
    industry,
    productionItems: [lineItem(productName, productSpec, 'по заказам/производственной программе')],
    products,
    purchaseCategories,
    volume: 'нужно подтверждать по RFQ и закупочным документам',
  }
}

function lineItem(name, spec, volume) {
  return {
    documents: ['ТЗ/спецификация', 'COA/паспорт качества', 'сертификат/декларация', 'договор поставки'],
    name,
    spec,
    status: 'lead',
    volume,
  }
}

async function fetchText(fetchImpl, url, options = {}) {
  try {
    const response = await fetchImpl(url, {
      headers: {
        'user-agent': 'TenderStart EU plant collector',
        ...(options.headers ?? {}),
      },
      method: options.method,
      body: options.body,
    })
    if (!response.ok) return ''
    return await response.text()
  } catch {
    return ''
  }
}

async function fetchFirstText(fetchImpl, urls, options = {}) {
  for (const url of urls) {
    const text = await fetchText(fetchImpl, url, options)
    if (text) return text
  }
  return ''
}

function dedupeProfiles(items) {
  const byKey = new Map()
  for (const item of items) {
    const text = `${item.name} ${item.industry ?? ''} ${(item.products ?? []).join(' ')} ${(item.purchaseCategories ?? []).join(' ')}`
    if (isBanned(text)) continue
    const key = normalizeKey(`${item.country}:${item.name}`)
    if (!byKey.has(key)) byKey.set(key, item)
  }
  return [...byKey.values()]
}

async function runLimited(tasks, concurrency) {
  const results = []
  let index = 0

  async function worker() {
    while (index < tasks.length) {
      const current = tasks[index]
      index += 1
      results.push(await current())
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()))
  return results
}

function isBanned(value) {
  return BANNED_PATTERN.test(value) || EU_BANNED_PATTERN.test(value)
}

function isIndustrialBusiness(value) {
  const rejected =
    /bank|financial|finance|insurance|gambl|betting|casino|porn|adult|television|media|retail|software|video game|market research|real estate|theatre|music|news|publishing|telecom|mobile phone|religious|investment|stock exchange|creative|football|sport club|banking/i
  const accepted =
    /manufactur|industry|industrial|chemical|pharma|petroleum|refined petroleum|oil|gas|plastic|polymer|steel|metal|machin|automotive|aerospace|aircraft|electronics|glass|cement|ceramic|construction|building|mining|energy|power|rail freight|shipping|shipyard|logistics|agribusiness|agricultur|food industry|footwear|textile|paper|packag|furniture|wood|rubber|transport|port|water transport|freight|equipment|consumer electronics/i
  return accepted.test(value) && !rejected.test(value)
}

function countryToSlug(country) {
  return EU_COUNTRIES.find((item) => item.country === country)?.countrySlug ?? cleanSlug(country)
}

function cleanHtml(value) {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtml(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
}

function makeLogoLabel(name) {
  const letters = cleanHtml(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
  return letters.toUpperCase() || 'EU'
}

function cleanSlug(value) {
  return String(value).replace(/[^a-z0-9-]/gi, '').toLowerCase()
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[«»"()]/g, '').replace(/\s+/g, ' ').trim()
}

function isMain() {
  return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')
}

function getArg(name, fallback) {
  const value = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (!value) return fallback
  const raw = value.slice(name.length + 3)
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : raw
}

function getListArg(name) {
  const value = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (!value) return null
  return value.slice(name.length + 3).split(',').map((item) => item.trim()).filter(Boolean)
}

if (isMain()) {
  const feed = await collectEuPlantLeads({
    concurrency: Number(getArg('concurrency', DEFAULT_CONCURRENCY)),
    countries: getListArg('countries'),
    maxPages: Number(getArg('max-pages', DEFAULT_MAX_PAGES)),
    maxPerCountry: Number(getArg('max-per-country', DEFAULT_MAX_PER_COUNTRY)),
    minPerCountry: Number(getArg('min', DEFAULT_MIN_PER_COUNTRY)),
    outputPath: getArg('output', DEFAULT_OUTPUT),
    useOsm: !process.argv.includes('--no-osm'),
  })
  const complete = Object.values(feed.coverage).filter((item) => item.complete).length
  console.log(
    `EU plant leads updated: ${feed.items.length} records; complete countries ${complete}/${Object.keys(feed.coverage).length}`,
  )
}
