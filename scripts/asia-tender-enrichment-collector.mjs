import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_ASIA_TENDER_OUTPUT = 'src/data/asiaTenderDemandFeed.generated.json'
export const DEFAULT_ASIA_TENDER_DOCUMENT_DIR = 'data/procurement-documents/asia'
export const DEFAULT_CPPP_LATEST_URL = 'https://eprocure.gov.in/cppp/latestactivetendersnew/cpppdata'
export const DEFAULT_CCGP_SEARCH_URL = 'https://search.ccgp.gov.cn/bxsearch'

const DEFAULT_KEYWORDS = [
  'chemical',
  'chemicals',
  'acid',
  'alkali',
  'caustic',
  'soda',
  'sulfur',
  'sulphur',
  'chloride',
  'ferric',
  'resin',
  'rubber',
  'polymer',
  'solvent',
  'pigment',
  'titanium',
  'silica',
  'gel',
  'sheet',
  'powder',
  'reagent',
  'fertilizer',
  'paint',
  'coating',
  'oil',
  'lubricant',
  'packaging',
]

export async function collectAsiaTenderDemand({
  ccgpSearchUrl = DEFAULT_CCGP_SEARCH_URL,
  cpppLatestUrl = DEFAULT_CPPP_LATEST_URL,
  fetchImpl = fetch,
  includeChina = true,
  includeIndia = true,
  keywords = DEFAULT_KEYWORDS,
  maxPages = 1,
  mirrorDocuments = false,
  documentDir = DEFAULT_ASIA_TENDER_DOCUMENT_DIR,
  outputPath = DEFAULT_ASIA_TENDER_OUTPUT,
  previousFallback = true,
} = {}) {
  const items = []

  if (includeIndia) {
    for (let page = 1; page <= maxPages; page += 1) {
      const url = page === 1 ? cpppLatestUrl : withPage(cpppLatestUrl, page)
      const html = await fetchText(fetchImpl, url, 'TenderStart Asia tender collector')
      if (!html) continue
      items.push(...parseCpppLatestTendersHtml(html, { baseUrl: url, keywords }))
    }
  }

  if (includeChina) {
    const html = await fetchText(fetchImpl, buildCcgpSearchUrl(ccgpSearchUrl, 'chemical'), 'TenderStart Asia tender collector')
    if (html) items.push(...parseCcgpSearchHtml(html, { baseUrl: ccgpSearchUrl, keywords }))
  }

  const previous = previousFallback ? await readDemandFeed(outputPath) : { items: [] }
  const mergedItems = mergeTenderItems(previous.items ?? [], items)
  const feedItems = mirrorDocuments ? await mirrorAsiaTenderDocuments(mergedItems, { documentDir }) : mergedItems
  const feed = {
    items: feedItems,
    source: 'GeM-CPPP latest active tenders + CCGP search parser',
    sourceUrl: cpppLatestUrl,
    updatedAt: new Date().toISOString(),
  }

  await mkdir(dirname(resolve(outputPath)), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(feed, null, 2)}\n`, 'utf8')
  return feed
}

export function parseCpppLatestTendersHtml(html, { baseUrl = DEFAULT_CPPP_LATEST_URL, keywords = DEFAULT_KEYWORDS } = {}) {
  return extractTableRows(html)
    .map((row) => normalizeCpppRow(row, { baseUrl, keywords }))
    .filter(Boolean)
}

export function parseCcgpSearchHtml(html, { baseUrl = DEFAULT_CCGP_SEARCH_URL, keywords = DEFAULT_KEYWORDS } = {}) {
  if (/frequent|captcha|访问|頻繁|频繁/i.test(html)) return []
  const rows = []
  const itemRegexp = /<li[^>]*>([\s\S]*?)<\/li>/gi
  for (const match of String(html).matchAll(itemRegexp)) {
    const block = match[1]
    const link = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(block)
    if (!link) continue
    const title = cleanValue(htmlToText(link[2]))
    const text = cleanValue(htmlToText(block))
    if (!title || !isIndustrialTender(`${title} ${text}`, keywords)) continue
    const noticeNumber = stableId(`${title}:${link[1]}`)
    rows.push(buildTenderItem({
      closingAt: null,
      country: 'China',
      idPrefix: 'ccgp',
      law: 'China Government Procurement Network',
      noticeNumber,
      openingAt: null,
      organization: extractCcgpBuyer(text) ?? 'China government buyer',
      procurementUrl: absoluteUrl(link[1], baseUrl),
      publishedAt: extractDate(text),
      region: 'China',
      source: 'CCGP search parser',
      sourceText: text,
      title,
    }))
  }
  return dedupeBy(rows, (item) => item.noticeNumber)
}

function extractCcgpBuyer(text) {
  const buyer = extractAfter(text, /(?:采购人|采购单位)[:：]\s*([^。]+)/)
  if (!buyer) return null
  return cleanValue(buyer
    .replace(/\s*(?:发布时间|发布日期|公告时间)[:：]?.*$/u, '')
    .replace(/\s*20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}.*$/u, ''))
}

function normalizeCpppRow(row, { baseUrl, keywords }) {
  const cells = row.cells
  if (cells.length < 6) return null
  const titleCell = cells[4]
  const link = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(titleCell.html)
  const title = cleanValue(link ? htmlToText(link[2]) : titleCell.text)
  const ref = cleanValue(titleCell.text.replace(title, '').replace(/^\/+/, ''))
  const organization = cleanValue(cells[5].text)
  const fullText = `${title} ${ref} ${organization}`
  if (!title || !isIndustrialTender(fullText, keywords)) return null
  const procurementUrl = absoluteUrl(link?.[1] ?? baseUrl, baseUrl)
  const noticeNumber = ref.split('/').find((part) => /20\d{2}_[A-Z0-9]+_\d+/i.test(part)) ?? ref ?? stableId(`${title}:${organization}`)

  return buildTenderItem({
    closingAt: parseCpppDate(cells[2].text),
    country: 'India',
    idPrefix: 'cppp',
    law: ref.toUpperCase().includes('GEM/') ? 'GeM bid / CPPP mirror' : 'GeM-CPPP public procurement',
    noticeNumber,
    openingAt: parseCpppDate(cells[3].text),
    organization,
    procurementUrl,
    publishedAt: parseCpppDate(cells[1].text),
    region: inferIndiaRegion(`${title} ${organization}`),
    source: 'GeM-CPPP latest active tenders parser',
    sourceText: cleanValue(`${title}. Ref: ${ref}. Organization: ${organization}. Published: ${cells[1].text}. Closing: ${cells[2].text}. Opening: ${cells[3].text}.`),
    title,
  })
}

function buildTenderItem({
  closingAt,
  country,
  idPrefix,
  law,
  noticeNumber,
  openingAt,
  organization,
  procurementUrl,
  publishedAt,
  region,
  source,
  sourceText,
  title,
}) {
  const quantity = parseQuantity(title)
  const documents = [
    {
      localPath: null,
      status: 'parsed_notice',
      title: 'Tender notice page',
      type: 'procurement_notice',
      url: procurementUrl,
    },
    {
      localPath: null,
      status: 'required_for_full_spec',
      title: 'Technical specification / buyer document',
      type: 'technical_specification',
      url: procurementUrl,
    },
    {
      localPath: null,
      status: 'required_for_contracting',
      title: 'Bid terms and draft contract',
      type: 'contract_template',
      url: procurementUrl,
    },
  ]
  const spec = [
    title,
    closingAt ? `Bid submission closing: ${closingAt}` : '',
    openingAt ? `Tender opening: ${openingAt}` : '',
    'Full grade/spec, COA/SDS/TDS, packaging and delivery terms must be extracted from buyer documents when downloadable.',
  ].filter(Boolean).join(' | ')

  return {
    buyerContact: null,
    buyerEmail: null,
    buyerName: organization,
    buyerPhone: null,
    confidence: 'medium',
    country,
    documents,
    id: `${idPrefix}-${slugify(noticeNumber || stableId(title))}`,
    items: [{
      documents: documents.map((document) => document.title),
      name: inferItemName(title),
      okpd2: null,
      price: null,
      quantity: quantity?.value ?? null,
      spec,
      unit: quantity?.unit ?? null,
    }],
    law,
    noticeNumber: noticeNumber || stableId(`${organization}:${title}`),
    organization,
    procurementUrl,
    publishedAt,
    region,
    source,
    sourceDocumentText: [
      `${country} procurement notice ${noticeNumber}: ${title}.`,
      `Buyer: ${organization}.`,
      region ? `Region: ${region}.` : '',
      publishedAt ? `Published: ${publishedAt}.` : '',
      closingAt ? `Bid closing: ${closingAt}.` : '',
      openingAt ? `Opening: ${openingAt}.` : '',
      quantity ? `Detected quantity: ${quantity.value} ${quantity.unit}.` : '',
      `Documents inside TenderStart: ${documents.map((document) => `${document.title} (${document.status})`).join('; ')}.`,
      sourceText,
    ].filter(Boolean).join(' '),
    status: 'parsed_public_tender_notice',
    targetPriceRubPerTon: null,
    title,
  }
}

export async function mirrorAsiaTenderDocuments(items, { documentDir = DEFAULT_ASIA_TENDER_DOCUMENT_DIR } = {}) {
  const mirrored = []
  for (const item of items) {
    const countrySlug = slugify(item.country ?? 'asia')
    const fileName = `${slugify(item.id ?? item.noticeNumber ?? item.title)}-notice.txt`
    const localPath = join(documentDir, countrySlug, fileName)
    await mkdir(dirname(resolve(localPath)), { recursive: true })
    await writeFile(resolve(localPath), [
      item.sourceDocumentText ?? item.title,
      '',
      `TenderStart local snapshot for: ${item.title}`,
      `Buyer: ${item.organization ?? item.buyerName ?? 'unknown'}`,
      `Source URL: ${item.procurementUrl ?? ''}`,
      `Parsed at: ${new Date().toISOString()}`,
    ].filter(Boolean).join('\n'), 'utf8')

    mirrored.push({
      ...item,
      documents: (item.documents ?? []).map((document) => document.type === 'procurement_notice'
        ? {
            ...document,
            localPath: localPath.replace(/\\/g, '/'),
            status: 'mirrored_text_snapshot',
          }
        : document),
    })
  }
  return mirrored
}

function extractTableRows(html) {
  const rows = []
  const rowRegexp = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
  for (const rowMatch of String(html).matchAll(rowRegexp)) {
    const cellMatches = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
    if (cellMatches.length === 0) continue
    rows.push({
      cells: cellMatches.map((match) => ({
        html: match[1],
        text: cleanValue(htmlToText(match[1])),
      })),
    })
  }
  return rows
}

function isIndustrialTender(value, keywords) {
  const text = String(value).toLowerCase()
  return keywords.some((keyword) => text.includes(String(keyword).toLowerCase()))
    && !/consultancy|training|hotel|canteen|food|meat|fish|security guard|manpower|vehicle hiring|construction of road|civil work|school|hospital|software|website/i.test(text)
}

function inferItemName(title) {
  const text = cleanValue(title)
  const known = [
    ['ferric chloride', /ferric chloride|iron chloride/i],
    ['titanium dioxide', /titanium dioxide|tio2/i],
    ['silica gel', /silica gel/i],
    ['caustic soda', /caustic soda|sodium hydroxide|naoh/i],
    ['sulfur', /sulphur|sulfur/i],
    ['rubber sheet', /rubber sheet/i],
    ['chemical raw material', /chemical|reagent|solvent|acid|alkali/i],
  ]
  return known.find(([, regexp]) => regexp.test(text))?.[0] ?? text.slice(0, 140)
}

function parseQuantity(text) {
  const patterns = [
    [/(\d+(?:[,.]\d+)?)\s*(?:metric\s*)?(?:tonnes?|tons?|mt)\b/i, 't'],
    [/(\d+(?:[,.]\d+)?)\s*(?:kg|kilograms?)\b/i, 'kg'],
    [/(\d+(?:[,.]\d+)?)\s*(?:ltr|litres?|liters?)\b/i, 'l'],
    [/(\d+(?:[,.]\d+)?)\s*(?:mtr|meters?|metres?)\b/i, 'm'],
    [/(\d+(?:[,.]\d+)?)\s*(?:nos|pcs|pieces?)\b/i, 'pcs'],
  ]
  for (const [regexp, unit] of patterns) {
    const match = regexp.exec(text)
    if (match) return { unit, value: Number(match[1].replace(',', '.')).toString() }
  }
  return null
}

function parseCpppDate(value) {
  const match = /(\d{2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2})\s*([AP]M)?/i.exec(String(value ?? ''))
  if (!match) return null
  const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(match[2].toLowerCase()) + 1
  if (!month) return null
  let hour = Number(match[4])
  if (/PM/i.test(match[6] ?? '') && hour < 12) hour += 12
  if (/AM/i.test(match[6] ?? '') && hour === 12) hour = 0
  return `${match[3]}-${String(month).padStart(2, '0')}-${match[1]}T${String(hour).padStart(2, '0')}:${match[5]}:00+05:30`
}

function inferIndiaRegion(value) {
  const text = String(value)
  const matches = [
    ['Gujarat', /gujarat|vadodara|surat|bharuch|dahej/i],
    ['Maharashtra', /maharashtra|mumbai|pune|nagpur/i],
    ['Tamil Nadu', /tamil nadu|chennai|coimbatore/i],
    ['Karnataka', /karnataka|bengaluru|bangalore/i],
    ['Telangana', /telangana|hyderabad/i],
    ['Andhra Pradesh', /andhra|visakhapatnam|vijayawada/i],
    ['Odisha', /odisha|paradip|kalinganagar/i],
    ['Rajasthan', /rajasthan|jaipur|kota/i],
  ]
  return matches.find(([, regexp]) => regexp.test(text))?.[0] ?? 'India'
}

function buildCcgpSearchUrl(baseUrl, keyword) {
  const url = new URL(baseUrl)
  url.searchParams.set('searchtype', '1')
  url.searchParams.set('page_index', '1')
  url.searchParams.set('bidSort', '0')
  url.searchParams.set('pinMu', '0')
  url.searchParams.set('bidType', '0')
  url.searchParams.set('dbselect', 'bidx')
  url.searchParams.set('kw', keyword)
  url.searchParams.set('timeType', '6')
  return url.toString()
}

async function fetchText(fetchImpl, url, userAgent) {
  try {
    const response = await fetchImpl(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': userAgent,
      },
    })
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  }
}

async function readDemandFeed(outputPath) {
  try {
    return JSON.parse(await readFile(resolve(outputPath), 'utf8'))
  } catch {
    return { items: [] }
  }
}

function mergeTenderItems(previous, incoming) {
  return dedupeBy([...incoming, ...previous], (item) => item.noticeNumber || item.id)
}

function withPage(baseUrl, page) {
  const url = new URL(baseUrl)
  url.searchParams.set('page', String(page - 1))
  return url.toString()
}

function absoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return href
  }
}

function extractAfter(text, regexp) {
  return regexp.exec(String(text))?.[1]?.trim() ?? null
}

function extractDate(text) {
  return /20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/.exec(String(text))?.[0] ?? null
}

function htmlToText(html) {
  return decodeHtml(String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(?:p|div|span|td|th|tr|li|a)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
}

function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#034;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function cleanValue(value) {
  return String(value).replace(/\s+/g, ' ').trim()
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'tender'
}

function stableId(text) {
  let hash = 0
  for (const char of String(text)) {
    hash = (hash << 5) - hash + char.charCodeAt(0)
    hash |= 0
  }
  return String(Math.abs(hash))
}

function dedupeBy(items, keyFn) {
  const seen = new Set()
  return items.filter((item) => {
    const key = keyFn(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function isMain() {
  return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')
}

if (isMain()) {
  const outputPath = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ?? DEFAULT_ASIA_TENDER_OUTPUT
  const maxPages = Number(process.argv.find((arg) => arg.startsWith('--max-pages='))?.slice(12) ?? '1')
  const documentDir = process.argv.find((arg) => arg.startsWith('--document-dir='))?.slice(15) ?? DEFAULT_ASIA_TENDER_DOCUMENT_DIR
  const keywordsArg = process.argv.find((arg) => arg.startsWith('--keywords='))?.slice(11)
  const feed = await collectAsiaTenderDemand({
    documentDir,
    includeChina: !process.argv.includes('--no-china'),
    includeIndia: !process.argv.includes('--no-india'),
    keywords: keywordsArg ? keywordsArg.split(',').map((item) => item.trim()).filter(Boolean) : DEFAULT_KEYWORDS,
    maxPages,
    mirrorDocuments: process.argv.includes('--mirror-docs'),
    outputPath,
    previousFallback: !process.argv.includes('--no-previous'),
  })
  console.log(`Asia tender demand updated: ${feed.items.length} records`)
}
