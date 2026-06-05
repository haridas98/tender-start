import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'

export const DEFAULT_OUTPUT = 'src/data/russiaMassPlantLeads.json'
export const DEFAULT_TARGET_PER_REGION = 50
export const DEFAULT_MAX_PAGES = 6
export const DEFAULT_CONCURRENCY = 6

export const BANNED_PATTERN =
  /пив|алког|водоч|спирт|ликер|винн|вино|wine|winery|beer|brew|alcohol|meat|fish|seafood|chicken|poultry|мяс|рыб|икр|осетр|морепродукт|хмел|солод|птиц|индей|гусь|колбас|убойн|хладобойн/i

const SOURCE_KINDS = [
  {
    name: 'manufacturers.ru',
    baseUrl: 'https://manufacturers.ru',
    path: (regionSlug, page) =>
      `/companies/${regionSlug}${page > 0 ? `?page=${page}` : ''}`,
  },
  {
    name: 'FoodSuppliers',
    baseUrl: 'https://foodsuppliers.ru',
    path: (regionSlug, page) =>
      `/region/${regionSlug}${page > 0 ? `?page=${page}` : ''}`,
  },
]

const FABRICATORS_SOURCE = {
  name: 'Fabricators',
  baseUrl: 'https://fabricators.ru',
}

const GISP_SOURCE = {
  name: 'ГИСП/Apicrafter 2021',
  zipUrl: 'https://data.apicrafter.ru/packages/gisporgs/build/gisporgs_20211009-12-08-23/get',
}

export function extractRussiaRegions(marketSource) {
  const start = marketSource.indexOf('export const russiaRegionStages = [')
  if (start < 0) return []
  const end = marketSource.indexOf(']', start)
  if (end < 0) return []
  const block = marketSource.slice(start, end)
  return [...block.matchAll(/'([^']+)'/g)].map((match) => match[1])
}

export function regionToUrlSlug(region) {
  return transliterate(region)
    .replace(/\s*-\s*/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function companySlugToPlantSlug(regionSlug, companySlug) {
  return `mass-${regionSlug}-${companySlug}`
}

export function parseCompanyLinks(html, sourceKind) {
  const links = []
  const regexp = /href="\/company\/([^"#?]+)[^"]*"[^>]*>(.*?)<\/a>/gi

  for (const match of html.matchAll(regexp)) {
    const companySlug = cleanSlug(match[1])
    const name = cleanHtml(match[2])
    if (!companySlug || !name || BANNED_PATTERN.test(name)) continue
    links.push({
      companySlug,
      name,
      sourceName: sourceKind.name,
      sourceUrl: `${sourceKind.baseUrl}/company/${companySlug}`,
    })
  }

  return links
}

export function parseFabricatorsRegionLinks(html) {
  const links = []
  const seen = new Set()
  const regexp = /href="\/zavody\/([^"#?]+)"[^>]*>(.*?)<\/a>/gis

  for (const match of html.matchAll(regexp)) {
    const slug = cleanSlug(match[1])
    const name = cleanHtml(match[2]).replace(/\s*\(\d+\)\s*$/, '')
    if (!slug || !name || /\(\d+\)\s*$/.test(cleanHtml(match[2]))) continue
    const key = normalizeKey(`${slug}:${name}`)
    if (seen.has(key)) continue
    seen.add(key)
    links.push({ name, slug })
  }

  return links
}

export function parseFabricatorsCityLinks(html) {
  const links = []
  const seen = new Set()
  const regexp = /href="\/zavody\/([^"#?]+)"[^>]*>(.*?)<\/a>/gis

  for (const match of html.matchAll(regexp)) {
    const rawName = cleanHtml(match[2])
    const countMatch = /\((\d+)\)\s*$/.exec(rawName)
    if (!countMatch) continue
    const citySlug = cleanSlug(match[1])
    if (!citySlug || seen.has(citySlug)) continue
    seen.add(citySlug)
    links.push({
      city: rawName.replace(/\s*\(\d+\)\s*$/, ''),
      citySlug,
      count: Number(countMatch[1]),
    })
  }

  return links.sort((a, b) => b.count - a.count)
}

export function parseFabricatorsProducerLinks(html) {
  const links = []
  const seen = new Set()
  const regexp = /href="\/proizvoditel\/([^"]+)"[^>]*>(.*?)<\/a>/gis

  for (const match of html.matchAll(regexp)) {
    const href = match[1]
    if (href.includes('#')) continue
    const companySlug = cleanSlug(href.split('?')[0])
    const name = cleanHtml(match[2])
    if (!companySlug || !name || /^\d+\s+(?:отзыв|товар)/i.test(name) || BANNED_PATTERN.test(name)) continue
    const key = normalizeKey(`${companySlug}:${name}`)
    if (seen.has(key)) continue
    seen.add(key)
    links.push({
      companySlug,
      name,
      sourceName: FABRICATORS_SOURCE.name,
      sourceUrl: `${FABRICATORS_SOURCE.baseUrl}/proizvoditel/${companySlug}`,
    })
  }

  return links
}

export function findFabricatorsRegionSlug(region, regionLinks) {
  const aliases = regionAliasKeys(region)
  return regionLinks.find((link) => aliases.has(regionCompareKey(link.name)))?.slug ?? null
}

export function parseGispJsonl(jsonl) {
  return String(jsonl)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((row) => row?.org_name && row?.org_addr)
}

export function isGispRowInRegion(row, region) {
  const address = normalizeAddressText(`${row.org_addr ?? ''} ${row.org_name ?? ''}`)
  return regionAddressKeys(region).some((key) => address.includes(key))
}

export function inferPlantProfile({ companySlug, name, region, regionSlug, sourceName, sourceUrl }) {
  const profile = inferByName(name)

  return {
    city: region,
    demandItems: profile.demandItems.map((item) => ({
      ...item,
      source: `${sourceName} + поиск ЕИС`,
      sourceUrl: buildEisSearchUrl(`${name} ${item.name} закупка`),
    })),
    equipment: profile.equipment,
    industry: profile.industry,
    logoLabel: makeLogoLabel(name),
    name,
    productionItems: profile.productionItems.map((item) => ({
      ...item,
      source: sourceName,
      sourceUrl,
    })),
    products: profile.products,
    purchaseCategories: profile.purchaseCategories,
    region,
    slug: companySlugToPlantSlug(regionSlug, companySlug),
    sourceName,
    sourceUrl,
    volume: profile.volume,
  }
}

export async function collectRussiaPlantLeads({
  concurrency = DEFAULT_CONCURRENCY,
  fetchImpl = fetch,
  marketPath = 'src/data/market.ts',
  maxPages = DEFAULT_MAX_PAGES,
  outputPath = DEFAULT_OUTPUT,
  targetPerRegion = DEFAULT_TARGET_PER_REGION,
} = {}) {
  const marketSource = await readFile(marketPath, 'utf8')
  const regions = extractRussiaRegions(marketSource)
  const fabricatorsRegionLinks = await loadFabricatorsRegionLinks(fetchImpl)
  const gispRows = await loadGispRows(fetchImpl)
  const regionTasks = regions.map((region) => async () =>
    collectRegion({ fabricatorsRegionLinks, fetchImpl, gispRows, maxPages, region, targetPerRegion }),
  )

  const regionResults = await runLimited(regionTasks, concurrency)
  const items = []
  const coverage = {}

  for (const result of regionResults) {
    items.push(...result.items)
    coverage[result.region] = {
      collected: result.items.length,
      complete: result.items.length >= targetPerRegion,
      target: targetPerRegion,
    }
  }

  const feed = {
    updatedAt: new Date().toISOString(),
    targetPerRegion,
    source: 'manufacturers.ru + FoodSuppliers + Fabricators + ГИСП/Apicrafter mass collector',
    coverage,
    items: dedupeProfiles(items).sort((a, b) =>
      `${a.region} ${a.name}`.localeCompare(`${b.region} ${b.name}`, 'ru'),
    ),
  }

  await mkdir(dirname(resolve(outputPath)), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(feed, null, 2)}\n`, 'utf8')
  return feed
}

async function collectRegion({ fabricatorsRegionLinks, fetchImpl, gispRows, maxPages, region, targetPerRegion }) {
  const regionSlug = regionToUrlSlug(region)
  const collected = []
  const seen = new Set()

  for (const sourceKind of SOURCE_KINDS) {
    for (let page = 0; page < maxPages && collected.length < targetPerRegion; page += 1) {
      const url = `${sourceKind.baseUrl}${sourceKind.path(regionSlug, page)}`
      const html = await fetchText(fetchImpl, url)
      if (!html) continue

      for (const link of parseCompanyLinks(html, sourceKind)) {
        const key = normalizeKey(`${region}:${link.name}`)
        if (seen.has(key)) continue
        seen.add(key)
        collected.push(inferPlantProfile({ ...link, region, regionSlug }))
        if (collected.length >= targetPerRegion) break
      }
    }
  }

  if (collected.length < targetPerRegion) {
    await collectFabricatorsRegion({
      collected,
      fabricatorsRegionLinks,
      fetchImpl,
      maxPages,
      region,
      regionSlug,
      seen,
      targetPerRegion,
    })
  }

  if (collected.length < targetPerRegion) {
    collectGispRegion({
      collected,
      gispRows,
      region,
      regionSlug,
      seen,
      targetPerRegion,
    })
  }

  return { items: collected, region, regionSlug }
}

async function collectFabricatorsRegion({
  collected,
  fabricatorsRegionLinks,
  fetchImpl,
  maxPages,
  region,
  regionSlug,
  seen,
  targetPerRegion,
}) {
  const fabricatorsRegionSlug = findFabricatorsRegionSlug(region, fabricatorsRegionLinks) ?? regionToUrlSlug(region)
  const regionUrl = `${FABRICATORS_SOURCE.baseUrl}/zavody/${fabricatorsRegionSlug}`
  const regionHtml = await fetchText(fetchImpl, regionUrl)
  if (!regionHtml) return

  addFabricatorsLinks({
    collected,
    html: regionHtml,
    region,
    regionSlug,
    seen,
    targetPerRegion,
  })

  const cityLinks = parseFabricatorsCityLinks(regionHtml)
  for (const cityLink of cityLinks) {
    for (let page = 0; page < maxPages && collected.length < targetPerRegion; page += 1) {
      const cityUrl = `${FABRICATORS_SOURCE.baseUrl}/zavody/${cityLink.citySlug}${page > 0 ? `?page=${page}` : ''}`
      const cityHtml = page === 0 && cityLink.citySlug === fabricatorsRegionSlug ? regionHtml : await fetchText(fetchImpl, cityUrl)
      if (!cityHtml) continue
      addFabricatorsLinks({
        collected,
        html: cityHtml,
        region,
        regionSlug,
        seen,
        targetPerRegion,
      })
    }
  }
}

function addFabricatorsLinks({ collected, html, region, regionSlug, seen, targetPerRegion }) {
  for (const link of parseFabricatorsProducerLinks(html)) {
    const key = normalizeKey(`${region}:${link.name}`)
    if (seen.has(key)) continue
    seen.add(key)
    collected.push(inferPlantProfile({ ...link, region, regionSlug }))
    if (collected.length >= targetPerRegion) break
  }
}

async function loadFabricatorsRegionLinks(fetchImpl) {
  const html = await fetchText(fetchImpl, `${FABRICATORS_SOURCE.baseUrl}/zavody/adygeya`)
  return html ? parseFabricatorsRegionLinks(html) : []
}

function collectGispRegion({ collected, gispRows, region, regionSlug, seen, targetPerRegion }) {
  for (const row of gispRows) {
    if (collected.length >= targetPerRegion) break
    if (!isGispRowInRegion(row, region)) continue

    const name = cleanGispName(row.org_name)
    const key = normalizeKey(`${region}:${name}`)
    if (!name || BANNED_PATTERN.test(name) || seen.has(key)) continue
    seen.add(key)

    const inn = String(row.org_inn ?? '').trim()
    const profile = inferPlantProfile({
      companySlug: `gisp-${cleanSlug(inn || hashText(`${region}:${name}`))}`,
      name,
      region,
      regionSlug,
      sourceName: GISP_SOURCE.name,
      sourceUrl: row.gisp_url || 'https://gisp.gov.ru/',
    })

    collected.push({
      ...profile,
      address: cleanGispAddress(row.org_addr),
      city: inferGispCity(row.org_addr) ?? region,
      documents: [
        'запись ГИСП',
        inn ? `ИНН ${inn}` : '',
        row.org_ogrn ? `ОГРН ${row.org_ogrn}` : '',
        row.prod_url ? 'карточка продукции ГИСП' : '',
      ].filter(Boolean),
      legalName: row.org_name,
    })
  }
}

async function loadGispRows(fetchImpl) {
  try {
    const response = await fetchImpl(GISP_SOURCE.zipUrl, {
      headers: {
        'user-agent': 'TenderStart plant lead collector',
      },
    })
    if (!response.ok) return []
    const zipBuffer = Buffer.from(await response.arrayBuffer())
    return parseGispJsonl(readZipTextEntry(zipBuffer, 'gisporgs_current.jsonl'))
  } catch {
    return []
  }
}

function readZipTextEntry(zipBuffer, entryName) {
  let offset = 0

  while (offset < zipBuffer.length - 30) {
    if (zipBuffer.readUInt32LE(offset) !== 0x04034b50) {
      offset += 1
      continue
    }

    const method = zipBuffer.readUInt16LE(offset + 8)
    const compressedSize = zipBuffer.readUInt32LE(offset + 18)
    const nameLength = zipBuffer.readUInt16LE(offset + 26)
    const extraLength = zipBuffer.readUInt16LE(offset + 28)
    const nameStart = offset + 30
    const dataStart = nameStart + nameLength + extraLength
    const name = zipBuffer.subarray(nameStart, nameStart + nameLength).toString('utf8')
    const dataEnd = dataStart + compressedSize
    const data = zipBuffer.subarray(dataStart, dataEnd)

    if (name === entryName) {
      if (method === 0) return data.toString('utf8')
      if (method === 8) return inflateRawSync(data).toString('utf8')
      throw new Error(`Unsupported zip compression method: ${method}`)
    }

    offset = dataEnd
  }

  throw new Error(`Zip entry not found: ${entryName}`)
}

async function fetchText(fetchImpl, url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetchImpl(url, {
      headers: {
        'user-agent': 'TenderStart plant lead collector',
      },
      signal: controller.signal,
    })
    if (!response.ok) return ''
    return await response.text()
  } catch {
    return ''
  } finally {
    clearTimeout(timeout)
  }
}

function inferByName(name) {
  const lower = name.toLowerCase()

  if (/мол|сыр|йогур|маслосыр/.test(lower)) {
    return {
      equipment: ['приемка молока', 'пастеризация', 'фасовка', 'холодильный склад'],
      industry: 'молочная промышленность',
      products: ['молочная продукция', 'сыр/творог', 'кисломолочная продукция'],
      productionItems: [
        lineItem('Молочная продукция', 'партия, жирность/срок годности, декларация', 'по производственной программе'),
      ],
      purchaseCategories: ['молоко-сырье', 'закваски', 'ферменты', 'упаковка', 'моющие средства', 'лабораторные анализы', 'холодовая логистика'],
      demandItems: [
        lineItem('Молоко-сырье', 'сырье высшего/первого сорта, ветеринарные документы, температура приемки', 'ежедневно/по сезону'),
        lineItem('Закваски и ферменты', 'пищевая спецификация, температурный режим, сертификат партии', 'по ассортименту'),
      ],
      volume: 'ежедневные поставки сырого молока',
    }
  }

  if (/хлеб|булк|кондитер|печен|ваф|пищекомбинат/.test(lower)) {
    return {
      equipment: ['пищевые линии', 'выпечка/смешивание', 'фасовка', 'склад сухого сырья'],
      industry: 'хлебобулочная и кондитерская промышленность',
      products: ['хлебобулочная продукция', 'кондитерские изделия', 'фасованная продукция'],
      productionItems: [
        lineItem('Хлебобулочная/кондитерская продукция', 'рецептура, срок годности, декларация', 'по производственной программе'),
      ],
      purchaseCategories: ['мука', 'сахар', 'растительные масла', 'какао-продукты', 'упаковка', 'этикетка', 'моющие средства'],
      demandItems: [
        lineItem('Мука хлебопекарная', 'ГОСТ/ТУ, клейковина, влажность, паспорт качества', 'регулярно'),
        lineItem('Упаковочная пленка/пакеты', 'пищевая упаковка, маркировка, декларация', 'по выпуску'),
      ],
    }
  }

  if (/мель|круп|зерн|элеватор|хлебопродукт/.test(lower)) {
    return {
      equipment: ['элеватор', 'мельница/крупоцех', 'сушка', 'лабораторный контроль'],
      industry: 'зернопереработка',
      products: ['мука', 'крупы', 'зернопродукты'],
      productionItems: [
        lineItem('Мука/крупы', 'сорт, влажность, зольность/крупность, паспорт качества', 'по производственной программе'),
      ],
      purchaseCategories: ['зерно', 'мешки', 'лабораторные анализы', 'фумигация', 'ГСМ', 'запчасти мельницы', 'логистика зерна'],
      demandItems: [
        lineItem('Пшеница продовольственная', 'класс, клейковина, влажность, зараженность, паспорт качества', 'сезонно/регулярно'),
        lineItem('Мешки полипропиленовые', '25/50 кг, пищевая маркировка, прочность', 'по фасовке'),
      ],
    }
  }

  if (/кабель|провод|электро/.test(lower)) {
    return {
      equipment: ['волочение', 'изоляция', 'электросборка', 'испытания'],
      industry: 'электротехническая промышленность',
      products: ['кабельная продукция', 'провода', 'электротехнические изделия'],
      productionItems: [
        lineItem('Кабельная/электротехническая продукция', 'сертификат, протокол испытаний, паспорт изделия', 'серийное производство'),
      ],
      purchaseCategories: ['медная катанка', 'алюминий', 'ПВХ-пластикат', 'полиэтилен', 'кабель', 'упаковка', 'испытания'],
      demandItems: [
        lineItem('Медная катанка', 'Cu-ETP, сертификат химсостава, бухты/катушки', 'по производственной программе'),
        lineItem('ПВХ-пластикат', 'кабельная марка, паспорт качества, SDS/MSDS', 'по выпуску'),
      ],
    }
  }

  if (/труб|арматур|нефтегаз|газов|бур|клапан|фланц/.test(lower)) {
    return {
      equipment: ['металлообработка', 'сварка', 'испытания давления', 'покрытия'],
      industry: 'нефтегазовое оборудование и трубная продукция',
      products: ['трубопроводная арматура', 'трубы/детали трубопроводов', 'нефтегазовые компоненты'],
      productionItems: [
        lineItem('Детали трубопроводов/арматура', 'ГОСТ/ТУ, давление, материал, паспорт изделия', 'по заказам'),
      ],
      purchaseCategories: ['трубы', 'металлопрокат', 'уплотнения', 'КИПиА', 'сварочные материалы', 'ЛКМ', 'испытания'],
      demandItems: [
        lineItem('Труба стальная', 'марка стали, диаметр/стенка, сертификат партии', 'по заказам'),
        lineItem('Сварочные материалы', 'марка электрода/проволоки, сертификат, партия', 'по производству'),
      ],
    }
  }

  if (/металл|лит|маш|станк|завод|конвейер|техник|пром|механ/.test(lower)) {
    return {
      equipment: ['металлообработка', 'сварка/сборка', 'покраска', 'контроль качества'],
      industry: 'машиностроение и металлообработка',
      products: ['металлоизделия', 'промышленное оборудование', 'машиностроительные узлы'],
      productionItems: [
        lineItem('Металлоизделия/промышленное оборудование', 'чертеж/ТЗ, материал, покрытие, паспорт изделия', 'по заказам'),
      ],
      purchaseCategories: ['металлопрокат', 'крепеж', 'подшипники', 'ЛКМ', 'инструмент', 'электрика', 'упаковка'],
      demandItems: [
        lineItem('Металлопрокат', 'марка стали, размер, сертификат качества', 'по производственной программе'),
        lineItem('ЛКМ промышленная', 'цвет/стойкость, паспорт качества, SDS/MSDS', 'по заказам'),
      ],
    }
  }

  if (/хим|фарма|реагент|каучук|пласт|полимер|композит|пэт|битум/.test(lower)) {
    return {
      equipment: ['реакторные линии', 'фасовка', 'лабораторный контроль', 'склад сырья'],
      industry: 'химическая промышленность',
      products: ['химическая продукция', 'полимерные материалы', 'промышленное сырье'],
      productionItems: [
        lineItem('Химическая/полимерная продукция', 'марка, чистота/состав, паспорт качества, SDS/MSDS', 'по производственной программе'),
      ],
      purchaseCategories: ['химсырье', 'катализаторы', 'стабилизаторы', 'тара', 'лабораторные реактивы', 'СИЗ', 'логистика опасных грузов'],
      demandItems: [
        lineItem('Химическое сырье', 'марка/концентрация, COA, SDS/MSDS, тара', 'по производственной программе'),
        lineItem('Промышленная тара', 'канистра/бочка/биг-бэг, совместимость с продуктом', 'по выпуску'),
      ],
    }
  }

  if (/бетон|цемент|кирпич|строит|камень|кварц|щеб|плит|неруд/.test(lower)) {
    return {
      equipment: ['дробление/помол', 'смесительный узел', 'формование', 'склад готовой продукции'],
      industry: 'стройматериалы',
      products: ['строительные материалы', 'бетонные/минеральные изделия', 'нерудные материалы'],
      productionItems: [
        lineItem('Строительные материалы', 'ГОСТ/ТУ, марка/фракция, паспорт качества', 'по заказам'),
      ],
      purchaseCategories: ['цемент', 'песок', 'щебень', 'пигменты', 'формы', 'мешки/биг-бэги', 'ГСМ'],
      demandItems: [
        lineItem('Цемент', 'марка, активность, паспорт качества', 'по заказам'),
        lineItem('Мешки/биг-бэги', 'тип упаковки, грузоподъемность, маркировка', 'по фасовке'),
      ],
    }
  }

  return {
    equipment: ['производственная линия', 'фасовка/сборка', 'склад сырья', 'контроль качества'],
    industry: 'промышленное производство',
    products: ['промышленная продукция', 'комплектующие', 'производственные услуги'],
    productionItems: [
      lineItem('Промышленная продукция', 'ТУ/ГОСТ, паспорт качества, партия', 'по производственной программе'),
    ],
    purchaseCategories: ['сырье по профилю', 'упаковка', 'запчасти', 'инструмент', 'лабораторные анализы', 'логистика', 'СИЗ'],
    demandItems: [
      lineItem('Сырье по профилю производства', 'спецификация, паспорт качества, партия', 'по производственной программе'),
      lineItem('Упаковка/расходные материалы', 'тип упаковки, маркировка, партия', 'по выпуску'),
    ],
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

export function buildEisSearchUrl(query) {
  const url = new URL('https://zakupki.gov.ru/epz/order/extendedsearch/results.html')
  url.searchParams.set('searchString', query)
  url.searchParams.set('morphology', 'on')
  url.searchParams.set('recordsPerPage', '_10')
  url.searchParams.set('sortBy', 'UPDATE_DATE')
  url.searchParams.set('sortDirection', 'false')
  return url.toString()
}

function dedupeProfiles(items) {
  const byKey = new Map()
  for (const item of items) {
    const text = `${item.name} ${item.industry} ${item.products.join(' ')} ${item.purchaseCategories.join(' ')}`
    if (BANNED_PATTERN.test(text)) continue
    const key = normalizeKey(`${item.region}:${item.name}`)
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

function regionAliasKeys(region) {
  const key = regionCompareKey(region)
  return new Set([
    key,
    key.replace(/^республика /, ''),
    key.replace(/\s+-\s+алания$/, ''),
    key.replace(/^республика /, '').replace(/\s+-\s+алания$/, ''),
    key.replace(/^республика /, '').replace(/\s+\(.+\)$/, ''),
  ])
}

function regionCompareKey(value) {
  return String(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/автономный округ/g, 'ао')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/[«»"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function regionAddressKeys(region) {
  const normalized = normalizeAddressText(region)
  const keys = new Set([normalized])

  const oblast = /^(.+?) ОБЛАСТЬ$/.exec(normalized)
  if (oblast) keys.add(`ОБЛАСТЬ ${oblast[1]}`)

  const kray = /^(.+?) КРАЙ$/.exec(normalized)
  if (kray) keys.add(`КРАЙ ${kray[1]}`)

  const republic = /^РЕСПУБЛИКА (.+)$/.exec(normalized)
  if (republic) {
    keys.add(`РЕСПУБЛИКА ${republic[1].replace(/\s+\(.+\)$/, '')}`)
    keys.add(`${republic[1].replace(/\s+\(.+\)$/, '')} РЕСП`)
  }

  const autonomousOblast = /^(.+?) АВТОНОМНАЯ ОБЛАСТЬ$/.exec(normalized)
  if (autonomousOblast) keys.add(`ОБЛАСТЬ ${autonomousOblast[1]} АВТОНОМНАЯ`)

  if (normalized.includes('САХА')) {
    keys.add('РЕСПУБЛИКА САХА')
    keys.add('ЯКУТИЯ')
  }
  if (normalized.includes('ХАНТЫ-МАНСИЙСКИЙ')) {
    keys.add('ХАНТЫ-МАНСИЙСКИЙ')
    keys.add('ЮГРА')
  }
  if (normalized.includes('ЯМАЛО-НЕНЕЦКИЙ')) keys.add('ЯМАЛО-НЕНЕЦКИЙ')
  if (normalized.includes('ЧУКОТСКИЙ')) keys.add('ЧУКОТСКИЙ')
  if (normalized === 'НЕНЕЦКИЙ АВТОНОМНЫЙ ОКРУГ') {
    keys.add('НЕНЕЦКИЙ АВТОНОМНЫЙ ОКРУГ')
    keys.add('НЕНЕЦКИЙ АО')
  }
  if (normalized.includes('СЕВЕРНАЯ ОСЕТИЯ')) {
    keys.add('СЕВЕРНАЯ ОСЕТИЯ')
    keys.add('АЛАНИЯ')
  }
  if (normalized === 'РЕСПУБЛИКА КРЫМ') keys.add('КРЫМ')

  return [...keys].filter((key) => key.length > 3)
}

function normalizeAddressText(value) {
  return String(value)
    .toUpperCase()
    .replace(/Ё/g, 'Е')
    .replace(/[«»"]/g, '')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanGispName(value) {
  return String(value)
    .replace(/^(АКЦИОНЕРНОЕ ОБЩЕСТВО|ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ|ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО|ЗАКРЫТОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО)\s+/i, '')
    .replace(/^"|"$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanGispAddress(value) {
  return String(value).replace(/\s+/g, ' ').trim()
}

function inferGispCity(value) {
  const match = /(?:ГОРОД|Г\.)\s+([^,]+)/i.exec(String(value))
  return match?.[1]?.replace(/\s+/g, ' ').trim()
}

function transliterate(value) {
  const map = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'c',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  }
  return String(value)
    .toLowerCase()
    .split('')
    .map((char) => map[char] ?? char)
    .join('')
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
    .replace(/&#039;/g, "'")
}

function makeLogoLabel(name) {
  const letters = cleanHtml(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
  return letters.toUpperCase() || 'ЗД'
}

function cleanSlug(value) {
  return String(value).replace(/[^a-z0-9-]/gi, '').toLowerCase()
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/["«»()]/g, '').replace(/\s+/g, ' ').trim()
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

if (isMain()) {
  const feed = await collectRussiaPlantLeads({
    concurrency: Number(getArg('concurrency', DEFAULT_CONCURRENCY)),
    maxPages: Number(getArg('max-pages', DEFAULT_MAX_PAGES)),
    targetPerRegion: Number(getArg('target', DEFAULT_TARGET_PER_REGION)),
  })
  const complete = Object.values(feed.coverage).filter((item) => item.complete).length
  console.log(
    `Russia plant leads updated: ${feed.items.length} records; complete regions ${complete}/${Object.keys(feed.coverage).length}`,
  )
}
