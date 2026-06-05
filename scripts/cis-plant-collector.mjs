import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BANNED_PATTERN } from './russia-plant-collector.mjs'

export const DEFAULT_OUTPUT = 'src/data/cisMassPlantLeads.json'
export const DEFAULT_COVERAGE_OUTPUT = 'src/data/cisCoverage.generated.json'
export const DEFAULT_TARGET_PER_COUNTRY = 50
export const DEFAULT_MAX_PAGES = 12
export const DEFAULT_CONCURRENCY = 4

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

export const CIS_COUNTRIES = [
  { country: 'Казахстан', countrySlug: 'kazakhstan', iso2: 'KZ', manufacturersSlug: 'kz-kazakhstan' },
  { country: 'Беларусь', countrySlug: 'belarus', iso2: 'BY', manufacturersSlug: 'be-respublika-belarus' },
  { country: 'Узбекистан', countrySlug: 'uzbekistan', iso2: 'UZ', manufacturersSlug: 'uz-uzbekistan' },
  { country: 'Кыргызстан', countrySlug: 'kyrgyzstan', iso2: 'KG', manufacturersSlug: 'kg-kyrgyzstan' },
  { country: 'Армения', countrySlug: 'armenia', iso2: 'AM', manufacturersSlug: 'am-armeniya' },
  { country: 'Азербайджан', countrySlug: 'azerbaijan', iso2: 'AZ', manufacturersSlug: 'az-azerbaydzhan' },
  {
    country: 'Таджикистан',
    countrySlug: 'tajikistan',
    iso2: 'TJ',
    manufacturersSlug: 'tj-tadzhikistan',
    osmBboxes: [
      '38.45,68.62,38.65,68.90',
      '40.15,69.45,40.45,69.85',
      '37.75,68.65,37.95,68.95',
      '39.45,67.45,39.65,67.75',
      '38.30,69.00,38.45,69.25',
      '39.85,69.00,40.05,69.25',
      '37.55,69.65,37.75,69.95',
    ],
  },
  {
    country: 'Молдова',
    countrySlug: 'moldova',
    iso2: 'MD',
    manufacturersSlug: 'md-moldova',
    osmBboxes: [
      '46.85,28.70,47.15,29.10',
      '47.60,27.75,47.90,28.10',
      '46.75,29.35,47.05,29.75',
      '46.65,29.20,46.95,29.55',
      '47.65,28.85,48.10,29.30',
      '45.85,28.05,46.45,28.75',
    ],
  },
  {
    country: 'Туркменистан',
    countrySlug: 'turkmenistan',
    iso2: 'TM',
    manufacturersSlug: 'tm-turkmeniya',
    extraSources: ['madeinturkmenistan'],
  },
]

export const tenderPlatforms = {
  Азербайджан: [
    { name: 'Электронные закупки Азербайджана', url: 'https://etender.gov.az/' },
  ],
  Армения: [
    { name: 'Gnumner.am', url: 'https://gnumner.am/' },
    { name: 'Armeps', url: 'https://armeps.am/' },
  ],
  Беларусь: [
    { name: 'Госзакупки Беларуси', url: 'https://goszakupki.by/' },
    { name: 'ICETRADE', url: 'https://icetrade.by/' },
  ],
  Казахстан: [
    { name: 'Госзакупки Казахстана', url: 'https://goszakup.gov.kz/' },
    { name: 'Samruk-Kazyna', url: 'https://zakup.sk.kz/' },
  ],
  Кыргызстан: [
    { name: 'Госзакупки Кыргызстана', url: 'https://zakupki.gov.kg/' },
  ],
  Молдова: [
    { name: 'MTender Moldova', url: 'https://mtender.gov.md/' },
    { name: 'Achizitii.md', url: 'https://achizitii.md/' },
  ],
  Таджикистан: [
    { name: 'Госзакупки Таджикистана', url: 'https://zakupki.gov.tj/' },
  ],
  Туркменистан: [
    { name: 'Туркменистан: товарно-сырьевая биржа', url: 'https://exchange.gov.tm/' },
  ],
  Узбекистан: [
    { name: 'Xarid.uz', url: 'https://xarid.uz/' },
    { name: 'UzEx закупки', url: 'https://dxarid.uzex.uz/' },
  ],
}

const CIS_BANNED_PATTERN =
  /пив|алког|водоч|спирт|ликер|винн|вино|шароб|шароб|милешт|miles|wine|winery|çakyr|cakyr|şerap|sarap|мяс|рыб|икр|осетр|морепродукт|хмел|солод|птиц|индей|гусь|chicken|poultry|колбас|убойн|хладобойн|slaughter/i

export function companySlugToCisPlantSlug(countrySlug, companySlug) {
  return `cis-${countrySlug}-${cleanSlug(companySlug)}`
}

export function parseManufacturerEnterpriseLinks(html, baseUrl = 'https://manufacturers.ru') {
  const links = []
  const seen = new Set()
  const enterpriseRegexp = /href="\/enterprise\/([^"#?]+)\/([^"#?]+)[^"]*"[^>]*>(.*?)<\/a>/gis
  const companyRegexp = /href="\/company\/([^"#?]+)[^"]*"[^>]*>(.*?)<\/a>/gis

  for (const match of html.matchAll(enterpriseRegexp)) {
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

  for (const match of html.matchAll(companyRegexp)) {
    const companySlug = cleanSlug(match[1])
    const name = cleanHtml(match[2])
    addParsedLink(links, seen, {
      companySlug,
      name,
      sourceName: 'manufacturers.ru',
      sourceUrl: `${baseUrl}/company/${companySlug}`,
    })
  }

  return links
}

export function parseOsmWorks(osmJson, country) {
  return (osmJson.elements ?? [])
    .map((element) => {
      const tags = element.tags ?? {}
      const name = cleanHtml(tags.name ?? tags.operator ?? tags.brand ?? '')
      const type = element.type ?? 'node'
      return {
        city: cleanHtml(tags['addr:city'] ?? tags['addr:place'] ?? ''),
        companySlug: `osm-${country.countrySlug}-${type}-${element.id}`,
        name,
        sourceName: 'OpenStreetMap works',
        sourceUrl: `https://www.openstreetmap.org/${type}/${element.id}`,
      }
    })
    .filter((link) => link.name && !isBanned(link.name))
}

export function buildTenderSearchUrl(country, query) {
  const platform = tenderPlatforms[country]?.[0]
  if (!platform) return ''
  const url = new URL(platform.url)
  if (country === 'Казахстан') url.searchParams.set('search', query)
  if (country === 'Беларусь') url.searchParams.set('search_text', query)
  if (country === 'Узбекистан') url.searchParams.set('search', query)
  if (country === 'Армения') url.searchParams.set('query', query)
  return url.toString()
}

export async function collectCountryFromSources({
  country,
  fetchImpl = fetch,
  maxPages = DEFAULT_MAX_PAGES,
  targetPerCountry = DEFAULT_TARGET_PER_COUNTRY,
  useOsm = true,
} = {}) {
  const collected = []
  const seen = new Set()

  for (let page = 0; page < maxPages && collected.length < targetPerCountry; page += 1) {
    const url = `https://manufacturers.ru/enterprises/${country.manufacturersSlug}${page ? `?page=${page}` : ''}`
    const html = await fetchText(fetchImpl, url)
    if (!html) continue
    addLinksToCountry({ collected, country, html, seen, targetPerCountry })
  }

  if (country.extraSources?.includes('madeinturkmenistan') && collected.length < targetPerCountry) {
    for (let page = 1; page <= maxPages && collected.length < targetPerCountry; page += 1) {
      const html = await fetchText(fetchImpl, `https://madeinturkmenistan.co.tm/Company?page=${page}`)
      if (!html) continue
      for (const link of parseMadeInTurkmenistanLinks(html)) {
        const key = normalizeKey(`${country.country}:${link.name}`)
        if (seen.has(key)) continue
        seen.add(key)
        collected.push(profileFromLink({ country, link, sourceName: 'Made in Turkmenistan' }))
        if (collected.length >= targetPerCountry) break
      }
    }
  }

  if (useOsm && country.iso2 && collected.length < targetPerCountry) {
    const osmLinks = await fetchOsmWorks(fetchImpl, country, targetPerCountry - collected.length)
    for (const link of osmLinks) {
      const key = normalizeKey(`${country.country}:${link.name}`)
      if (seen.has(key)) continue
      seen.add(key)
      collected.push(profileFromLink({ country, link, sourceName: link.sourceName }))
      if (collected.length >= targetPerCountry) break
    }
  }

  return { country: country.country, complete: collected.length >= targetPerCountry, items: collected, target: targetPerCountry }
}

export async function collectCisPlantLeads({
  concurrency = DEFAULT_CONCURRENCY,
  countries = null,
  fetchImpl = fetch,
  maxPages = DEFAULT_MAX_PAGES,
  outputPath = DEFAULT_OUTPUT,
  targetPerCountry = DEFAULT_TARGET_PER_COUNTRY,
  useOsm = true,
} = {}) {
  const selectedCountries = filterCisCountries(countries)
  const selectedNames = new Set(selectedCountries.map((country) => country.country))
  const tasks = selectedCountries.map((country) => async () =>
    collectCountryFromSources({ country, fetchImpl, maxPages, targetPerCountry, useOsm }),
  )
  const results = await runLimited(tasks, concurrency)
  const previousFeed = countries?.length ? await readPreviousFeed(outputPath) : null
  const coverage = { ...(previousFeed?.coverage ?? {}) }
  const items = []

  for (const result of results) {
    coverage[result.country] = {
      collected: result.items.length,
      complete: result.complete,
      target: result.target,
    }
    items.push(...result.items)
  }

  const preservedItems = countries?.length
    ? (previousFeed?.items ?? []).filter((item) => !selectedNames.has(item.country))
    : []
  const finalItems = dedupeProfiles([...preservedItems, ...items]).sort((a, b) =>
    `${a.country} ${a.name}`.localeCompare(`${b.country} ${b.name}`, 'ru'),
  )
  const feed = {
    updatedAt: new Date().toISOString(),
    targetPerCountry,
    source: 'manufacturers.ru foreign enterprises + Made in Turkmenistan + OpenStreetMap works + local tender platform registry',
    tenderPlatforms,
    coverage: buildActualCoverage(coverage, finalItems, targetPerCountry),
    items: finalItems,
  }

  await mkdir(dirname(resolve(outputPath)), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(feed, null, 2)}\n`, 'utf8')
  if (resolve(outputPath) === resolve(DEFAULT_OUTPUT)) {
    await writeCoverageSnapshot(feed)
  }
  return feed
}

function addLinksToCountry({ collected, country, html, seen, targetPerCountry }) {
  for (const link of parseManufacturerEnterpriseLinks(html)) {
    const key = normalizeKey(`${country.country}:${link.name}`)
    if (seen.has(key)) continue
    seen.add(key)
    collected.push(profileFromLink({ country, link, sourceName: link.sourceName }))
    if (collected.length >= targetPerCountry) break
  }
}

function profileFromLink({ country, link }) {
  const profile = inferByName(link.name)
  const coreNeeds = profile.purchaseCategories.slice(0, 4)
  const tenderUrl = buildTenderSearchUrl(country.country, `${link.name} ${coreNeeds.join(' ')}`)

  return {
    city: link.city || country.country,
    country: country.country,
    demandItems: profile.demandItems.map((item) => ({
      ...item,
      source: `${link.sourceName} + локальные тендерные площадки`,
      sourceUrl: tenderUrl || link.sourceUrl,
    })),
    documents: ['карточка производителя', 'локальные тендерные документы после выгрузки', 'сертификат/паспорт партии', 'договор поставки'],
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
    slug: companySlugToCisPlantSlug(country.countrySlug, link.companySlug),
    sourceName: link.sourceName,
    sourceUrl: link.sourceUrl,
    tenderPlatforms: tenderPlatforms[country.country] ?? [],
    volume: profile.volume,
  }
}

function parseMadeInTurkmenistanLinks(html) {
  const links = []
  const seen = new Set()
  const regexp = /href="\/Company\/Detail\/([^"]+)"[^>]*>(.*?)<\/a>/gis

  for (const match of html.matchAll(regexp)) {
    const companySlug = cleanSlug(match[1])
    const name = cleanHtml(match[2])
    addParsedLink(links, seen, {
      companySlug,
      name,
      sourceName: 'Made in Turkmenistan',
      sourceUrl: `https://madeinturkmenistan.co.tm/Company/Detail/${companySlug}`,
    })
  }

  return links
}

async function fetchOsmWorks(fetchImpl, country, needed) {
  const links = []
  const seen = new Set()
  const queries = country.osmBboxes?.length
    ? country.osmBboxes.map((bbox) => buildOsmBboxQuery(bbox, needed))
    : [buildOsmCountryQuery(country.iso2, needed)]

  for (const query of queries) {
    if (links.length >= needed) break
    const text = await fetchFirstText(fetchImpl, country.osmBboxes?.length ? [OVERPASS_ENDPOINTS[0]] : OVERPASS_ENDPOINTS, {
      body: new URLSearchParams({ data: query }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'TenderStart CIS plant collector',
      },
      method: 'POST',
      signal: AbortSignal.timeout(country.osmBboxes?.length ? 25_000 : 45_000),
    })
    if (!text) continue
    try {
      for (const link of parseOsmWorks(JSON.parse(text), country)) {
        const key = normalizeKey(`${link.name}:${link.sourceUrl}`)
        if (seen.has(key)) continue
        seen.add(key)
        links.push(link)
        if (links.length >= needed) break
      }
    } catch {
      continue
    }
  }

  return links
}

function buildOsmCountryQuery(iso2, needed) {
  const limit = Math.max(1, Math.min(180, needed * 3))
  return `[out:json][timeout:35];
area["ISO3166-1"="${iso2}"]->.a;
(
  nwr(area.a)["man_made"="works"]["name"];
  nwr(area.a)["landuse"="industrial"]["name"];
);
out tags center ${limit};`
}

function buildOsmBboxQuery(bbox, needed) {
  const limit = Math.max(1, Math.min(120, needed * 2))
  return `[out:json][timeout:20];
(
  nwr(${bbox})["man_made"="works"]["name"];
  nwr(${bbox})["landuse"="industrial"]["name"];
  nwr(${bbox})["industrial"]["name"];
);
out tags center ${limit};`
}

function addParsedLink(links, seen, link) {
  if (!link.companySlug || !link.name || isBanned(link.name)) return
  const key = normalizeKey(`${link.companySlug}:${link.name}`)
  if (seen.has(key)) return
  seen.add(key)
  links.push(link)
}

function inferByName(name) {
  const lower = name.toLowerCase()

  if (/хим|chem|нефт|газ|oil|gas|poly|полимер|пласт|каучук|азот|фосфат|карбамид|сульфат|реагент/.test(lower)) {
    return profile(
      'химия, нефтегаз и полимеры',
      ['химическая продукция', 'полимерные материалы', 'промышленное сырье'],
      ['реакторы/смесители', 'фасовка', 'лабораторный контроль', 'склад сырья'],
      ['химсырье', 'катализаторы', 'тара', 'SDS/MSDS', 'логистика опасных грузов'],
      'Химическая/полимерная продукция',
      'марка, чистота/состав, COA, SDS/MSDS',
      'Химическое сырье',
      'концентрация, COA, SDS/MSDS, тара',
    )
  }

  if (/цемент|бетон|кирпич|строй|glass|стекл|керамик|плит|гипс|извест/.test(lower)) {
    return profile(
      'стройматериалы',
      ['строительные материалы', 'цемент/бетон/стекло', 'минеральные изделия'],
      ['дробление/помол', 'смешивание', 'формование', 'печь/обжиг'],
      ['цемент', 'песок', 'минеральное сырье', 'пигменты', 'ГСМ', 'мешки/биг-бэги'],
      'Строительные материалы',
      'ГОСТ/ТУ, марка, фракция, паспорт качества',
      'Минеральное сырье',
      'фракция/активность, паспорт качества, партия',
    )
  }

  if (/металл|steel|темир|лит|арматур|маш|станк|трактор|кабель|электр|прибор|насос|клапан/.test(lower)) {
    return profile(
      'машиностроение и металл',
      ['металлоизделия', 'промышленное оборудование', 'электротехнические изделия'],
      ['металлообработка', 'сварка/сборка', 'покраска', 'испытания'],
      ['металлопрокат', 'кабель', 'подшипники', 'ЛКМ', 'инструмент', 'электрика'],
      'Промышленное оборудование/металлоизделия',
      'чертеж/ТЗ, материал, покрытие, паспорт изделия',
      'Металлопрокат и комплектующие',
      'марка стали/цветмета, размер, сертификат качества',
    )
  }

  if (/текст|tex|cotton|jersey|швей|одеж|обув|кожа|fiber|волок/.test(lower)) {
    return profile(
      'легкая промышленность',
      ['текстиль', 'одежда/обувь', 'волокно и фурнитура'],
      ['раскрой', 'швейные линии', 'крашение/отделка', 'упаковка'],
      ['ткань', 'нитки', 'фурнитура', 'красители', 'упаковка', 'логистика'],
      'Текстильная продукция',
      'состав, плотность, цвет, сертификат/декларация',
      'Ткань/волокно/фурнитура',
      'состав, плотность, цвет, партия',
    )
  }

  return profile(
    'промышленное производство',
    ['промышленная продукция', 'комплектующие', 'производственные услуги'],
    ['производственная линия', 'склад сырья', 'фасовка/сборка', 'контроль качества'],
    ['сырье по профилю', 'упаковка', 'запчасти', 'лабораторные анализы', 'логистика'],
    'Промышленная продукция',
    'ТУ/ГОСТ/локальный стандарт, партия, паспорт качества',
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
    documents: ['ТЗ/спецификация', 'паспорт качества', 'сертификат/декларация', 'договор поставки'],
    name,
    spec,
    status: 'lead',
    volume,
  }
}

async function fetchText(fetchImpl, url) {
  try {
    const response = await fetchImpl(url, {
      headers: {
        'user-agent': 'TenderStart CIS plant collector',
      },
    })
    if (!response.ok) return ''
    return await response.text()
  } catch {
    return ''
  }
}

async function fetchFirstText(fetchImpl, urls, options) {
  for (const url of urls) {
    try {
      const response = await fetchImpl(url, {
        ...options,
        signal: options?.signal ?? AbortSignal.timeout(45_000),
      })
      if (!response.ok) continue
      return await response.text()
    } catch {
      continue
    }
  }
  return ''
}

function dedupeProfiles(items) {
  const byKey = new Map()
  for (const item of items) {
    const text = `${item.name} ${item.industry} ${item.products.join(' ')} ${item.purchaseCategories.join(' ')}`
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

function filterCisCountries(countries) {
  if (!countries?.length) return CIS_COUNTRIES
  const wanted = new Set(countries.map((country) => normalizeKey(country)))
  return CIS_COUNTRIES.filter((country) =>
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

function buildActualCoverage(previousCoverage, items, defaultTarget) {
  const counts = items.reduce((acc, item) => {
    acc[item.country] = (acc[item.country] ?? 0) + 1
    return acc
  }, {})
  return Object.fromEntries(
    CIS_COUNTRIES.map((country) => {
      const target = previousCoverage[country.country]?.target ?? defaultTarget
      const collected = counts[country.country] ?? 0
      return [
        country.country,
        {
          collected,
          complete: collected >= target,
          target,
        },
      ]
    }),
  )
}

async function writeCoverageSnapshot(feed, outputPath = DEFAULT_COVERAGE_OUTPUT) {
  const countries = CIS_COUNTRIES.map((country) => {
    const countryItems = feed.items.filter((item) => item.country === country.country)
    const sourceBreakdown = countryItems.reduce((acc, item) => {
      acc[item.sourceName] = (acc[item.sourceName] ?? 0) + 1
      return acc
    }, {})
    return {
      collected: countryItems.length,
      complete: feed.coverage[country.country]?.complete ?? false,
      country: country.country,
      countrySlug: country.countrySlug,
      sourceBreakdown,
      target: feed.coverage[country.country]?.target ?? feed.targetPerCountry,
      tenderPlatforms: tenderPlatforms[country.country] ?? [],
    }
  })

  await mkdir(dirname(resolve(outputPath)), { recursive: true })
  await writeFile(
    outputPath,
    `${JSON.stringify({
      countries,
      generatedAt: feed.updatedAt,
      source: feed.source,
      total: feed.items.length,
    }, null, 2)}\n`,
    'utf8',
  )
}

function isBanned(value) {
  return BANNED_PATTERN.test(value) || CIS_BANNED_PATTERN.test(value)
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
  return letters.toUpperCase() || 'CIS'
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
  const feed = await collectCisPlantLeads({
    concurrency: Number(getArg('concurrency', DEFAULT_CONCURRENCY)),
    countries: getListArg('countries'),
    maxPages: Number(getArg('max-pages', DEFAULT_MAX_PAGES)),
    outputPath: getArg('output', DEFAULT_OUTPUT),
    targetPerCountry: Number(getArg('target', DEFAULT_TARGET_PER_COUNTRY)),
    useOsm: !process.argv.includes('--no-osm'),
  })
  const complete = Object.values(feed.coverage).filter((item) => item.complete).length
  console.log(
    `CIS plant leads updated: ${feed.items.length} records; complete countries ${complete}/${Object.keys(feed.coverage).length}`,
  )
}
