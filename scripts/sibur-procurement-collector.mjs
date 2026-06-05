import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_PRODUCTS, matchProduct, mergeDemands } from './russia-demand-collector.mjs'

export const DEFAULT_SIBUR_TENDERS_URL = 'https://www.sibur.ru/ru/procurement/buy/'
export const DEFAULT_SIBUR_OUTPUT = 'src/data/siburProcurementFeed.json'

const METHOD_REGEXP = /^(Запрос предложений|Запрос цен|Конкурс|Аукцион|Маркетинговое исследование|Предквалификация)$/i
const STATUS_REGEXP = /^(Прием предложений|Приём предложений|Завершена|Завершено|Отменена|Отменено|Архив)$/i
const TOGGLE_REGEXP = /^(Развернуть|Свернуть|Показать еще|Показать ещё)$/i

export async function collectSiburProcurements({
  baseUrl = DEFAULT_SIBUR_TENDERS_URL,
  downloadDocuments = false,
  documentDir = 'data/procurement-documents/sibur',
  fetchImpl = fetch,
  maxPages = 1,
  outputPath = null,
  products = DEFAULT_PRODUCTS,
} = {}) {
  const collected = []

  for (let page = 1; page <= maxPages; page += 1) {
    const url = page === 1 ? baseUrl : withPage(baseUrl, page)
    try {
      const response = await fetchImpl(url, {
        headers: { 'user-agent': 'TenderStart SIBUR procurement collector' },
      })
      if (!response.ok) continue
      const html = await response.text()
      const records = parseSiburProcurementHtml(html, { baseUrl: url, products })
      collected.push(...records)
    } catch {
      continue
    }
  }

  const deduped = mergeDemands([], collected)
  if (downloadDocuments) {
    await downloadProcurementDocuments(deduped, { documentDir, fetchImpl })
  }

  const feed = {
    updatedAt: new Date().toISOString(),
    source: 'SIBUR procurement parser',
    sourceUrl: baseUrl,
    items: deduped,
  }

  if (outputPath) {
    const existing = await readDemandFeed(outputPath)
    const merged = mergeDemands(existing.items ?? [], feed.items)
    const outputFeed = { ...feed, items: merged }
    await mkdir(dirname(resolve(outputPath)), { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(outputFeed, null, 2)}\n`, 'utf8')
    return outputFeed
  }

  return feed
}

export function parseSiburProcurementHtml(html, { baseUrl = DEFAULT_SIBUR_TENDERS_URL, products = DEFAULT_PRODUCTS } = {}) {
  return splitSiburRows(html)
    .map((row) => normalizeSiburTender(row, { baseUrl, products }))
    .filter(Boolean)
}

export function normalizeSiburTender({ number, href, html }, { baseUrl, products }) {
  const lines = htmlToLines(html).filter((line) => !TOGGLE_REGEXP.test(line) && line !== number)
  const methodIndex = lines.findIndex((line) => METHOD_REGEXP.test(line))
  if (methodIndex < 1) return null

  const title = lines[0]
  const subject = lines.slice(1, methodIndex).join(' ')
  const method = lines[methodIndex]
  const publishedIndex = lines.findIndex((line, index) => index > methodIndex && /^\d{2}\.\d{2}\.\d{4}$/.test(line))
  const deadlineIndex = lines.findIndex((line, index) => index > publishedIndex && /^\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}:\d{2}$/.test(line))
  const phoneIndex = lines.findIndex((line) => /^\+7\s*\(/.test(line) || /^8\s*\(/.test(line))
  const emailIndex = lines.findIndex((line) => /^[\w.+-]+@[\w.-]+\.[a-zа-я]{2,}$/i.test(line))
  const statusIndex = lines.findIndex((line, index) => index > deadlineIndex && STATUS_REGEXP.test(line))
  const organizer = cleanValue(lines[deadlineIndex + 1] ?? '')
  const buyerName = cleanValue(lines[statusIndex + 1] ?? '')
  const category = cleanValue(lines[emailIndex + 1] ?? '')
  const documents = extractDocumentLinks(html, baseUrl, href)
  const productId = matchProduct(`${title} ${subject} ${category}`, products) ?? 'industrial-procurement'
  const quantity = parseQuantity(`${title} ${subject}`)

  if (!title || !subject) return null

  const sourceUrl = absoluteUrl(href, baseUrl)
  const spec = [
    subject,
    category ? `Категория: ${category}` : '',
    method ? `Способ: ${method}` : '',
    lines[publishedIndex] ? `Опубликовано: ${lines[publishedIndex]}` : '',
    lines[deadlineIndex] ? `Подача до: ${lines[deadlineIndex]}` : '',
    buyerName ? `Закупщик: ${buyerName}` : '',
    phoneIndex >= 0 ? `Телефон: ${lines[phoneIndex]}` : '',
    emailIndex >= 0 ? `Email: ${lines[emailIndex]}` : '',
    documents.length ? `Документы: ${documents.map((doc) => doc.title).join(', ')}` : '',
  ].filter(Boolean).join(' | ')

  return {
    buyerContact: [buyerName, lines[phoneIndex], lines[emailIndex]].filter(Boolean).join(', '),
    buyerEmail: emailIndex >= 0 ? lines[emailIndex] : null,
    buyerName,
    buyerPhone: phoneIndex >= 0 ? lines[phoneIndex] : null,
    category,
    confidence: 'high',
    documents,
    id: `sibur-${number.replace(/\W+/g, '-')}`,
    items: [{
      documents: documents.map((doc) => doc.title),
      name: title,
      okpd2: null,
      price: null,
      quantity: quantity?.value ?? null,
      spec,
      unit: quantity?.unit ?? null,
    }],
    law: 'SIBUR SRM / commercial procurement',
    monthlyVolumeTons: quantity?.unit === 'т' ? Number(quantity.value) : 1,
    noticeNumber: number,
    organization: organizer || 'ПАО "СИБУР Холдинг"',
    procurementMethod: method,
    procurementUrl: sourceUrl,
    productId,
    publishedAt: toIsoDate(lines[publishedIndex]),
    region: inferRegion(`${organizer} ${buyerName} ${lines[phoneIndex] ?? ''}`),
    source: 'SIBUR procurement parser',
    sourceDocumentText: buildSourceText({
      buyerName,
      category,
      documents,
      method,
      number,
      organizer,
      phone: lines[phoneIndex],
      email: lines[emailIndex],
      publishedAt: lines[publishedIndex],
      deadline: lines[deadlineIndex],
      status: lines[statusIndex],
      subject,
      title,
    }),
    status: lines[statusIndex] ?? 'parsed_sibur_notice',
    targetPriceRubPerTon: 0,
    title,
  }
}

function splitSiburRows(html) {
  const rows = []
  const anchorRegexp = /<a[^>]+href=["']([^"']*srm\.sibur\.ru[^"']*)["'][^>]*>\s*(\d{5,}\/\d+)\s*<\/a>/gi
  const anchors = [...String(html).matchAll(anchorRegexp)]
  for (let index = 0; index < anchors.length; index += 1) {
    const current = anchors[index]
    const next = anchors[index + 1]
    const start = current.index ?? 0
    const end = next?.index ?? html.length
    rows.push({
      href: current[1],
      html: html.slice(start, end),
      number: current[2],
    })
  }
  return rows
}

function htmlToLines(html) {
  return decodeHtml(String(html)
    .replace(/<\/(?:a|div|li|p|span|td|th|tr|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<script[^]*?<\/script>/gi, ' ')
    .replace(/<style[^]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .split(/\n+/)
    .map(cleanValue)
    .filter(Boolean)
}

function extractDocumentLinks(html, baseUrl, procedureHref) {
  const docs = []
  const links = String(html).matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([^]*?)<\/a>/gi)
  for (const link of links) {
    const href = link[1]
    const title = htmlToLines(link[2]).join(' ') || cleanValue(decodeURIComponent(href.split('/').pop() ?? ''))
    if (!title || href === procedureHref || /^\d{5,}\/\d+$/.test(title)) continue
    if (!/\.(docx?|xlsx?|xlsm|pdf|zip|rar)$/i.test(title) && !/док|тз|техничес|форма|руководство|manual/i.test(title)) continue
    docs.push({
      localPath: null,
      status: 'available_for_download',
      title,
      type: inferDocumentType(title),
      url: absoluteUrl(href, baseUrl),
    })
  }
  return dedupeBy(docs, (doc) => `${doc.title}:${doc.url}`)
}

async function downloadProcurementDocuments(records, { documentDir, fetchImpl }) {
  for (const record of records) {
    for (const document of record.documents ?? []) {
      if (!document.url) continue
      try {
        const response = await fetchImpl(document.url, {
          headers: { 'user-agent': 'TenderStart SIBUR document mirror' },
        })
        if (!response.ok) continue
        const buffer = Buffer.from(await response.arrayBuffer())
        const filename = safeFileName(document.title)
        const localPath = resolve(documentDir, record.noticeNumber.replace(/\W+/g, '-'), filename)
        await mkdir(dirname(localPath), { recursive: true })
        await writeFile(localPath, buffer)
        document.localPath = localPath
        document.status = 'downloaded'
      } catch {
        document.status = 'download_failed'
      }
    }
  }
}

function parseQuantity(text) {
  const tons = /(\d+(?:[,.]\d+)?)\s*(?:т|тонн)/i.exec(text)
  if (tons) return { unit: 'т', value: Number(tons[1].replace(',', '.')).toString() }
  const kg = /(\d+(?:[,.]\d+)?)\s*кг/i.exec(text)
  if (kg) return { unit: 'кг', value: Number(kg[1].replace(',', '.')).toString() }
  const pieces = /(\d+(?:[,.]\d+)?)\s*(?:шт|штук)/i.exec(text)
  if (pieces) return { unit: 'шт', value: Number(pieces[1].replace(',', '.')).toString() }
  return null
}

function buildSourceText(record) {
  return [
    `СИБУР закупка ${record.number}: ${record.title}.`,
    `Предмет: ${record.subject}.`,
    record.method ? `Способ закупки: ${record.method}.` : '',
    record.publishedAt ? `Дата публикации: ${record.publishedAt}.` : '',
    record.deadline ? `Срок подачи предложений: ${record.deadline}.` : '',
    record.organizer ? `Организатор: ${record.organizer}.` : '',
    record.status ? `Статус: ${record.status}.` : '',
    record.buyerName ? `Закупщик: ${record.buyerName}.` : '',
    record.phone ? `Телефон закупщика: ${record.phone}.` : '',
    record.email ? `Email закупщика: ${record.email}.` : '',
    record.category ? `Номенклатурная категория: ${record.category}.` : '',
    record.documents?.length ? `Документы: ${record.documents.map((doc) => doc.title).join(', ')}.` : '',
  ].filter(Boolean).join(' ')
}

function withPage(baseUrl, page) {
  const url = new URL(baseUrl)
  url.searchParams.set('PAGEN_1', String(page))
  return url.toString()
}

function absoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return href
  }
}

function cleanValue(value) {
  return String(value).replace(/\s+/g, ' ').replace(/^[:\-–]+/, '').trim()
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

function inferDocumentType(title) {
  if (/тз|техничес/i.test(title)) return 'technical_specification'
  if (/договор|nda|dpr/i.test(title)) return 'contract_template'
  if (/форма|ткп|xlsx|xlsm/i.test(title)) return 'supplier_form'
  if (/manual|руковод/i.test(title)) return 'supplier_manual'
  return 'procurement_document'
}

function inferRegion(text) {
  if (/\+7\s*\(347\)|ПОЛИЭФ|Баш/i.test(text)) return 'Республика Башкортостан'
  if (/\+7\s*\(843\)|\+7\s*\(855\)|Нижнекамск|Казань|rt\.sibur/i.test(text)) return 'Республика Татарстан'
  if (/\+7\s*\(345\)|Тобольск|tobolsk/i.test(text)) return 'Тюменская область'
  if (/\+7\s*\(346\)|stg\.sibur|Сургут/i.test(text)) return 'Ханты-Мансийский автономный округ'
  return 'Россия'
}

function toIsoDate(value) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(value ?? '').trim())
  if (!match) return null
  return `${match[3]}-${match[2]}-${match[1]}`
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

function safeFileName(value) {
  return String(value)
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 180)
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
  const feed = await collectSiburProcurements({
    downloadDocuments: process.argv.includes('--download-docs'),
    maxPages: Number(process.argv.find((arg) => arg.startsWith('--pages='))?.split('=')[1] ?? 1),
    outputPath: DEFAULT_SIBUR_OUTPUT,
  })
  console.log(`SIBUR procurement feed updated: ${feed.items.length} records`)
}
