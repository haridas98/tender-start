import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_OUTPUT = 'src/data/chemicalCatalog.generated.json'
const DEFAULT_MARKET_PATH = 'src/data/market.ts'
const DEFAULT_SNHZ_PATH = 'src/data/snhzChemicalIndex.generated.json'
const DEFAULT_SIBUR_PATH = 'src/data/siburProcurementFeed.json'
const PUBCHEM_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'
const PUBCHEM_VIEW_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view'

const DOCUMENT_DOSSIER = [
  'SDS/MSDS',
  'TDS/specification',
  'COA/passport per batch',
  'certificate of origin',
  'invoice',
  'packing list',
  'contract / incoterms',
]

const NAME_RULES = [
  [/triethanolamine|триэтаноламин/i, 'triethanolamine'],
  [/glycidol|глицидол/i, 'glycidol'],
  [/ferric chloride|хлорид железа|железо хлорное/i, 'ferric chloride'],
  [/titanium dioxide|диоксид титана/i, 'titanium dioxide'],
  [/silica gel|силикагель/i, 'silica gel'],
  [/sulfur|сера/i, 'sulfur'],
  [/caustic soda|sodium hydroxide|едк(ий|ого) натр|каустичес/i, 'sodium hydroxide'],
  [/soda ash|sodium carbonate|сода кальцинир/i, 'sodium carbonate'],
  [/phenol|фенол/i, 'phenol'],
  [/formaldehyde|формалин|формальдегид/i, 'formaldehyde'],
  [/isopropyl alcohol|изопропил/i, 'isopropyl alcohol'],
  [/butanol|бутиловый спирт/i, '1-butanol'],
  [/methanol|метанол/i, 'methanol'],
  [/styrene|стирол/i, 'styrene'],
  [/ethylene glycol|этиленгликоль/i, 'ethylene glycol'],
  [/toluene|толуол/i, 'toluene'],
  [/cyclohexanone|циклогексанон/i, 'cyclohexanone'],
  [/hydrogen peroxide|пероксид водорода|перекись водорода/i, 'hydrogen peroxide'],
]

export async function collectChemicalCatalog({
  fetchImpl = fetch,
  includeSafety = true,
  limit = Infinity,
  marketPath = DEFAULT_MARKET_PATH,
  outputPath = DEFAULT_OUTPUT,
  refresh = false,
  siburPath = DEFAULT_SIBUR_PATH,
  snhzPath = DEFAULT_SNHZ_PATH,
} = {}) {
  const existing = refresh ? { records: [] } : await readJson(outputPath, { records: [] })
  const existingByKey = new Map((existing.records ?? []).map((record) => [candidateKey(record), record]))
  const candidates = await loadChemicalCandidates({ marketPath, siburPath, snhzPath })
  const selected = candidates.slice(0, Number.isFinite(limit) ? limit : candidates.length)
  const records = []

  for (const candidate of selected) {
    const cached = existingByKey.get(candidateKey(candidate))
    const pubchem = cached?.pubchem && !refresh
      ? cached.pubchem
      : await fetchPubChem(candidate, fetchImpl)
    const safety = includeSafety
      ? cached?.safety && !refresh
        ? cached.safety
        : await fetchSafety(pubchem?.cid, fetchImpl)
      : null
    records.push(buildChemicalRecord(candidate, pubchem, safety))
  }

  const feed = {
    generatedAt: new Date().toISOString(),
    records,
    source: 'TenderStart chemical catalog collector',
    sourceUrls: [
      'https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest',
      'https://pubchem.ncbi.nlm.nih.gov/docs/pug-view',
    ],
    totalCandidates: candidates.length,
  }

  await mkdir(dirname(resolve(outputPath)), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(feed, null, 2)}\n`, 'utf8')
  return feed
}

export async function loadChemicalCandidates({
  marketPath = DEFAULT_MARKET_PATH,
  siburPath = DEFAULT_SIBUR_PATH,
  snhzPath = DEFAULT_SNHZ_PATH,
} = {}) {
  const [marketSource, snhzFeed, siburFeed] = await Promise.all([
    readFile(resolve(marketPath), 'utf8').catch(() => ''),
    readJson(snhzPath, { records: [] }),
    readJson(siburPath, { items: [] }),
  ])

  return dedupeCandidates([
    ...extractMarketMaterials(marketSource),
    ...extractSnhzChemicals(snhzFeed),
    ...extractSiburChemicals(siburFeed),
  ])
}

export function extractMarketMaterials(source) {
  const start = source.indexOf('export const materials')
  const end = source.indexOf('const plantRecords')
  if (start === -1 || end === -1 || end <= start) return []

  const block = source.slice(start, end)
  const candidates = [...block.matchAll(/^(\s{2,})(['"]?[\w-]+['"]?):\s*\{/gm)]
  const minIndent = Math.min(...candidates.map((entry) => entry[1].length))
  const entries = candidates.filter((entry) => entry[1].length === minIndent)
  return entries.map((entry, index) => {
    const rawSlug = entry[2].replace(/['"]/g, '')
    const next = entries[index + 1]?.index ?? block.length
    const item = block.slice(entry.index, next)
    const propertyIndent = entry[1].length + 2
    const name = pickStringProperty(item, 'name', propertyIndent)
    const cas = pickStringProperty(item, 'cas', propertyIndent)
    if (!name || !cas) return null
    return {
      cas,
      documents: pickStringArrayProperty(item, 'documents', propertyIndent),
      hs: pickStringProperty(item, 'hs', propertyIndent),
      name,
      query: pickQuery(`${name} ${cas}`) ?? name,
      slug: rawSlug,
      sourceRefs: [{
        sourceName: 'TenderStart material card',
        sourceType: 'internal_material',
        sourceUrl: `/materials/${rawSlug}`,
      }],
      standards: extractStandards(item),
    }
  }).filter(Boolean)
}

export function extractSnhzChemicals(feed) {
  return (feed.records ?? []).map((record) => ({
    cas: record.cas,
    documents: record.documents ?? [],
    name: record.name,
    query: record.pubchemQuery ?? pickQuery(`${record.name} ${record.cas ?? ''}`) ?? record.name,
    slug: record.slug,
    sourceRefs: [{
      sourceName: record.source ?? 'SNHZ chemical matrix',
      sourceType: 'plant_need',
      sourceUrl: record.sourceUrl,
    }],
    standards: record.standards ?? [],
    tenderSpecs: [record.tenderSpec].filter(Boolean),
    volume: record.volume,
  })).filter((candidate) => candidate.name)
}

export function extractSiburChemicals(feed) {
  const candidates = []
  for (const procurement of feed.items ?? []) {
    const text = [
      procurement.title,
      procurement.productId,
      procurement.category,
      procurement.sourceDocumentText,
      ...(procurement.documents ?? []).map((doc) => doc.title),
    ].filter(Boolean).join(' ')
    const query = pickQuery(text)
    if (!query) continue

    candidates.push({
      cas: null,
      documents: [
        ...(procurement.documents ?? []).map((doc) => doc.title).filter(Boolean),
        ...DOCUMENT_DOSSIER,
      ],
      name: procurement.title ?? query,
      procurementRefs: [{
        noticeNumber: procurement.noticeNumber,
        sourceName: procurement.source ?? 'SIBUR procurement parser',
        sourceUrl: procurement.procurementUrl,
        status: procurement.status,
      }],
      query,
      slug: `sibur-${slugify(query)}`,
      sourceRefs: [{
        sourceName: procurement.source ?? 'SIBUR procurement parser',
        sourceType: 'procurement',
        sourceUrl: procurement.procurementUrl,
      }],
      tenderSpecs: (procurement.items ?? []).map((item) => item.spec).filter(Boolean),
    })
  }
  return candidates
}

async function fetchPubChem(candidate, fetchImpl) {
  const lookup = firstCas(candidate.cas) ?? candidate.query ?? candidate.name
  if (!lookup) return null
  try {
    const propertyUrl = `${PUBCHEM_BASE}/compound/name/${encodeURIComponent(lookup)}/property/MolecularFormula,MolecularWeight,IUPACName,InChIKey,CanonicalSMILES/JSON`
    const propertyResponse = await fetchImpl(propertyUrl, { headers: { 'user-agent': 'TenderStart chemical catalog collector' } })
    if (!propertyResponse.ok) return null
    const propertyJson = await propertyResponse.json()
    const property = propertyJson?.PropertyTable?.Properties?.[0]
    if (!property?.CID) return null

    const synonymsUrl = `${PUBCHEM_BASE}/compound/cid/${property.CID}/synonyms/JSON`
    const synonymsResponse = await fetchImpl(synonymsUrl, { headers: { 'user-agent': 'TenderStart chemical catalog collector' } })
    const synonymsJson = synonymsResponse.ok ? await synonymsResponse.json() : null
    const synonyms = synonymsJson?.InformationList?.Information?.[0]?.Synonym ?? []

    return {
      canonicalSmiles: property.CanonicalSMILES ?? null,
      cas: firstCas(candidate.cas) ?? synonyms.find((synonym) => /^\d{2,7}-\d{2}-\d$/.test(synonym)) ?? null,
      cid: property.CID,
      inchiKey: property.InChIKey ?? null,
      iupacName: property.IUPACName ?? null,
      molecularFormula: property.MolecularFormula ?? null,
      molecularWeight: property.MolecularWeight ?? null,
      pubchemUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${property.CID}`,
      synonyms: synonyms.slice(0, 24),
    }
  } catch {
    return null
  }
}

async function fetchSafety(cid, fetchImpl) {
  if (!cid) return null
  try {
    const response = await fetchImpl(`${PUBCHEM_VIEW_BASE}/data/compound/${cid}/JSON?heading=GHS%20Classification`, {
      headers: { 'user-agent': 'TenderStart chemical catalog collector' },
    })
    if (!response.ok) return null
    const json = await response.json()
    const strings = extractPugViewStrings(json).filter((value) =>
      /H\d{3}|Pictogram|signal|warning|danger|GHS|hazard/i.test(value),
    )
    return {
      ghs: unique(strings).slice(0, 20),
      sourceUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=GHS-Classification`,
    }
  } catch {
    return null
  }
}

function buildChemicalRecord(candidate, pubchem, safety) {
  const slug = candidate.slug ?? slugify(pubchem?.cas ?? candidate.query ?? candidate.name)
  const documents = unique([...(candidate.documents ?? []), ...DOCUMENT_DOSSIER])
  return {
    cas: pubchem?.cas ?? firstCas(candidate.cas) ?? null,
    documents,
    dossier: {
      coaFields: ['assay/purity', 'impurities', 'water/moisture', 'lot number', 'manufacturing date', 'expiry/retest date'],
      logisticsDocs: ['invoice', 'packing list', 'certificate of origin', 'dangerous goods declaration when applicable'],
      requiredBeforeDeal: documents,
      sdsFields: ['hazard classification', 'transport class', 'storage conditions', 'PPE', 'spill/fire measures'],
    },
    hs: candidate.hs ?? null,
    name: candidate.name,
    procurementRefs: candidate.procurementRefs ?? [],
    pubchem,
    query: candidate.query ?? null,
    safety,
    slug,
    sourceLevel: pubchem?.cid ? 'pubchem_enriched' : 'needs_manual_mapping',
    sourceRefs: candidate.sourceRefs ?? [],
    standards: unique(candidate.standards ?? []),
    tenderSpecs: unique(candidate.tenderSpecs ?? []),
    updatedAt: new Date().toISOString(),
    volume: candidate.volume ?? null,
  }
}

function pickStringProperty(text, property, indent = null) {
  const prefix = Number.isFinite(indent) ? `^\\s{${indent}}` : ''
  const match = new RegExp(`${prefix}${property}:\\s*'([^']*)'`, 'm').exec(text)
  return match?.[1] ?? null
}

function pickStringArrayProperty(text, property, indent = null) {
  const prefix = Number.isFinite(indent) ? `^\\s{${indent}}` : ''
  const match = new RegExp(`${prefix}${property}:\\s*\\[([^\\]]*)\\]`, 'm').exec(text)
  if (!match) return []
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1])
}

function extractStandards(text) {
  return unique([...String(text).matchAll(/\b(?:ГОСТ|ТУ|СТО|ОСТ|ISO|EN|ASTM)\s*[^'",;\]\n]+/gi)].map((match) => match[0].trim()))
}

function pickQuery(text) {
  const rule = NAME_RULES.find(([regexp]) => regexp.test(String(text)))
  return rule?.[1] ?? null
}

function firstCas(value) {
  const match = String(value ?? '').match(/\d{2,7}-\d{2}-\d/)
  return match?.[0] ?? null
}

function extractPugViewStrings(value, result = []) {
  if (typeof value === 'string') result.push(value)
  else if (Array.isArray(value)) value.forEach((item) => extractPugViewStrings(item, result))
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => extractPugViewStrings(item, result))
  return result
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(resolve(path), 'utf8'))
  } catch {
    return fallback
  }
}

function dedupeCandidates(candidates) {
  const merged = new Map()
  for (const candidate of candidates) {
    const key = candidateKey(candidate)
    const previous = merged.get(key)
    if (!previous) {
      merged.set(key, candidate)
      continue
    }
    merged.set(key, {
      ...previous,
      documents: unique([...(previous.documents ?? []), ...(candidate.documents ?? [])]),
      procurementRefs: [...(previous.procurementRefs ?? []), ...(candidate.procurementRefs ?? [])],
      sourceRefs: [...(previous.sourceRefs ?? []), ...(candidate.sourceRefs ?? [])],
      standards: unique([...(previous.standards ?? []), ...(candidate.standards ?? [])]),
      tenderSpecs: unique([...(previous.tenderSpecs ?? []), ...(candidate.tenderSpecs ?? [])]),
      volume: previous.volume ?? candidate.volume,
    })
  }
  return [...merged.values()]
}

function candidateKey(candidate) {
  return firstCas(candidate.cas) ?? normalize(candidate.query ?? candidate.name)
}

function normalize(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'chemical'
}

function unique(values) {
  return [...new Set((values ?? []).filter(Boolean))]
}

function isMain() {
  return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')
}

if (isMain()) {
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))?.slice(8)
  const outputArg = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9)
  const feed = await collectChemicalCatalog({
    includeSafety: !process.argv.includes('--no-safety'),
    limit: limitArg ? Number(limitArg) : Infinity,
    outputPath: outputArg ?? DEFAULT_OUTPUT,
    refresh: process.argv.includes('--refresh'),
  })
  const enriched = feed.records.filter((record) => record.pubchem?.cid).length
  console.log(`Chemical catalog updated: ${feed.records.length}/${feed.totalCandidates} records, ${enriched} PubChem enriched`)
}
