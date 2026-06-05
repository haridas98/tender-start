import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_PRODUCTS = [
  {
    id: 'caustic-soda',
    search: ['каустическая сода', 'гидроксид натрия', 'натр едкий', 'NaOH'],
  },
  {
    id: 'soda-ash',
    search: ['кальцинированная сода', 'карбонат натрия', 'Na2CO3'],
  },
  {
    id: 'sodium-nitrite',
    search: ['нитрит натрия', 'NaNO2'],
  },
  {
    id: 'pigment-blue',
    search: ['пигмент синий', 'фталоцианиновый синий', 'PB15'],
  },
  {
    id: 'titanium-dioxide',
    search: ['диоксид титана', 'двуокись титана', 'титановый диоксид', 'TiO2'],
  },
  {
    id: 'silica-gel',
    search: ['силикагель', 'силика гель', 'silica gel', 'адсорбент осушки'],
  },
]

export const DEFAULT_OUTPUT = 'src/data/russianDemandFeed.json'

export function matchProduct(text, products = DEFAULT_PRODUCTS) {
  const normalized = normalizeText(text)

  return (
    products.find((product) =>
      product.search.some((term) => normalized.includes(normalizeText(term))),
    )?.id ?? null
  )
}

export function parseEisSearchHtml(html, products = DEFAULT_PRODUCTS) {
  const blocks = html
    .split(/<div[^>]+class="[^"]*search-registry-entry-block[^"]*"[^>]*>/i)
    .slice(1)

  return blocks
    .map((block) => normalizeDemandRecord(block, products))
    .filter(Boolean)
}

export function normalizeDemandRecord(block, products = DEFAULT_PRODUCTS) {
  const text = stripHtml(block)
  const productId = matchProduct(text, products)

  if (!productId) return null

  const organization =
    pick(text, /Заказчик\s+([^]+?)(?:Размещено|Начальная|Цена|Объект|$)/i) ??
    pick(text, /Организация\s+([^]+?)(?:Размещено|Начальная|Цена|Объект|$)/i) ??
    'неизвестный заказчик'
  const region =
    pick(text, /Регион\s+([^]+?)(?:Заказчик|Размещено|Начальная|Цена|$)/i) ??
    'РФ'
  const priceRub = parseRub(
    pick(text, /(?:Начальная|Максимальная|Цена)[^0-9]*(\d[\d\s,.]*)/i),
  )
  const volumeTons = parseVolumeTons(text)
  const href = pick(block, /href="([^"]*\/epz\/order\/notice[^"]+)"/i)
  const idSeed = pick(block, /№\s*([0-9]{6,})/i) ?? hashText(text)

  return {
    id: `eis-${productId}-${idSeed}`,
    organization: cleanValue(organization),
    region: cleanValue(region),
    productId,
    monthlyVolumeTons: volumeTons,
    targetPriceRubPerTon: volumeTons > 0 ? Math.round(priceRub / volumeTons) : 0,
    source: 'ЕИС daily parser',
    buyerContact: 'нужно обогатить',
    procurementUrl: href ? `https://zakupki.gov.ru${href}` : 'https://zakupki.gov.ru/',
    publishedAt: new Date().toISOString().slice(0, 10),
    confidence: volumeTons > 0 && priceRub > 0 ? 'medium' : 'low',
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

export async function collectRussianDemand({
  outputPath = DEFAULT_OUTPUT,
  products = DEFAULT_PRODUCTS,
  fetchImpl = fetch,
} = {}) {
  const collected = []

  for (const product of products) {
    for (const query of product.search.slice(0, 2)) {
      const url = buildEisSearchUrl(query)
      try {
        const response = await fetchImpl(url, {
          headers: {
            'user-agent': 'TenderStart daily demand collector',
          },
        })
        if (!response.ok) continue
        const html = await response.text()
        collected.push(...parseEisSearchHtml(html, products))
      } catch {
        continue
      }
    }
  }

  const existing = await readDemandFeed(outputPath)
  const merged = mergeDemands(existing.items, collected)
  const feed = {
    updatedAt: new Date().toISOString(),
    source: 'ЕИС daily parser + seed',
    items: merged,
  }

  await mkdir(dirname(resolve(outputPath)), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(feed, null, 2)}\n`, 'utf8')
  return feed
}

export function mergeDemands(existing, incoming) {
  const byId = new Map()
  for (const item of [...existing, ...incoming]) {
    if (!item?.id) continue
    byId.set(item.id, item)
  }
  return [...byId.values()].sort((a, b) => a.productId.localeCompare(b.productId))
}

function normalizeText(text) {
  return String(text).toLowerCase().replace(/\s+/g, ' ').trim()
}

function stripHtml(html) {
  return String(html)
    .replace(/<script[^]*?<\/script>/gi, ' ')
    .replace(/<style[^]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function pick(text, regexp) {
  return regexp.exec(text)?.[1]?.trim() ?? null
}

function parseRub(value) {
  if (!value) return 0
  return Number(value.replace(/\s/g, '').replace(',', '.')) || 0
}

function parseVolumeTons(text) {
  const ton = /(\d+(?:[,.]\d+)?)\s*(?:т|тонн)/i.exec(text)
  if (ton) return Number(ton[1].replace(',', '.'))

  const kg = /(\d+(?:[,.]\d+)?)\s*кг/i.exec(text)
  if (kg) return Number((Number(kg[1].replace(',', '.')) / 1000).toFixed(3))

  return 1
}

function cleanValue(value) {
  return value.replace(/\s+/g, ' ').replace(/^[:\-–]+/, '').trim()
}

function hashText(text) {
  let hash = 0
  for (const char of text) {
    hash = (hash << 5) - hash + char.charCodeAt(0)
    hash |= 0
  }
  return String(Math.abs(hash))
}

async function readDemandFeed(outputPath) {
  try {
    return JSON.parse(await readFile(outputPath, 'utf8'))
  } catch {
    return { updatedAt: new Date(0).toISOString(), source: 'empty', items: [] }
  }
}

function isMain() {
  return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')
}

if (isMain()) {
  const feed = await collectRussianDemand()
  console.log(`Russian demand feed updated: ${feed.items.length} records`)
}
