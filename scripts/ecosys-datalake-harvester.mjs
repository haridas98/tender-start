import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_ECOSYS_ROOT = 'D:/Projects/ECOSYS'
const PUBCHEM_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'
const PUBCHEM_VIEW_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view'

const DEFAULT_STRUCTURE = [
  'chemicals/by-cid',
  'chemicals/by-cas',
  'chemicals/by-name',
  'documents/blobs/sha256',
  'documents/manifests',
  'images/pubchem-2d',
  'manifests',
  'templates/contracts',
  'templates/supplier-forms',
  'tenders/sibur',
]

export async function ensureEcosysStructure(root = DEFAULT_ECOSYS_ROOT) {
  await Promise.all(DEFAULT_STRUCTURE.map((folder) => mkdir(resolve(root, folder), { recursive: true })))
  await writeJsonIfMissing(resolve(root, 'README.ecosys.json'), {
    createdAt: new Date().toISOString(),
    purpose: 'TenderStart / ECOSYS industrial data lake: chemicals, CAS, documents, images, tenders, supplier forms.',
    dedupe: 'Documents are stored once by sha256 in documents/blobs/sha256/{prefix}/{hash}.{ext}.',
    sources: ['PubChem PUG REST', 'PubChem PUG View', 'local tender documents', 'TenderStart generated feeds'],
  })
}

export async function harvestPubChemCidRange({
  batchSize = 50,
  count = 100,
  downloadImages = true,
  fetchImpl = fetch,
  root = DEFAULT_ECOSYS_ROOT,
  startCid = 1,
} = {}) {
  await ensureEcosysStructure(root)
  const manifestPath = resolve(root, 'manifests/pubchem-cid-harvest.jsonl')
  const casIndexPath = resolve(root, 'manifests/cas-index.jsonl')
  const records = []

  for (let cid = startCid; cid < startCid + count; cid += batchSize) {
    const cids = Array.from({ length: Math.min(batchSize, startCid + count - cid) }, (_, index) => cid + index)
    const properties = await fetchPubChemProperties(cids, fetchImpl)
    const synonyms = await fetchPubChemSynonyms(cids, fetchImpl)

    for (const property of properties) {
      const cidSynonyms = synonyms.get(Number(property.CID)) ?? []
      const casNumbers = cidSynonyms.filter((synonym) => isCasNumber(synonym))
      const image = downloadImages ? await downloadPubChemImage(Number(property.CID), { fetchImpl, root }) : null
      const record = buildPubChemDossier({ casNumbers, image, property, synonyms: cidSynonyms })
      await writeChemicalDossier(root, record)
      await appendJsonl(manifestPath, {
        cas: record.cas,
        cid: record.cid,
        imagePath: image?.path ?? null,
        name: record.name,
        sourceUrl: record.sourceUrl,
        status: record.status,
      })
      for (const cas of casNumbers) {
        await appendJsonl(casIndexPath, {
          cas,
          cid: record.cid,
          name: record.name,
          sourceUrl: record.sourceUrl,
        })
      }
      records.push(record)
    }
  }

  await writeFile(resolve(root, 'manifests/pubchem-cursor.json'), `${JSON.stringify({
    lastCid: startCid + count - 1,
    nextCid: startCid + count,
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8')

  return {
    casRecords: records.filter((record) => record.cas.length > 0).length,
    nextCid: startCid + count,
    records: records.length,
    root,
  }
}

export async function mirrorLocalTenderDocuments({
  inputDir = 'data/procurement-documents',
  root = DEFAULT_ECOSYS_ROOT,
} = {}) {
  await ensureEcosysStructure(root)
  const files = await listFiles(resolve(inputDir))
  const manifestPath = resolve(root, 'documents/manifests/local-procurement-documents.jsonl')
  const seen = new Set()
  let copied = 0
  let duplicates = 0

  for (const filePath of files) {
    const buffer = await readFile(filePath)
    const saved = await saveBlob({
      buffer,
      originalName: basename(filePath),
      root,
      sourcePath: filePath,
      sourceUrl: pathToSourceUrl(filePath),
      type: inferDocumentType(filePath),
    })
    const key = `${saved.sha256}:${filePath}`
    if (seen.has(key)) continue
    seen.add(key)
    await appendJsonl(manifestPath, saved)
    if (saved.created) copied += 1
    else duplicates += 1
  }

  return {
    copied,
    duplicates,
    files: files.length,
    root,
  }
}

export async function mirrorTenderStartChemicalCatalog({
  catalogPath = 'src/data/chemicalCatalog.generated.json',
  root = DEFAULT_ECOSYS_ROOT,
} = {}) {
  await ensureEcosysStructure(root)
  const catalog = JSON.parse(await readFile(resolve(catalogPath), 'utf8'))
  let written = 0
  for (const item of catalog.records ?? []) {
    const record = {
      cas: item.cas ? [item.cas] : [],
      cid: item.pubchem?.cid ?? null,
      documents: item.documents ?? [],
      formula: item.pubchem?.molecularFormula ?? null,
      identifiers: {
        canonicalSmiles: item.pubchem?.canonicalSmiles ?? null,
        inchiKey: item.pubchem?.inchiKey ?? null,
        iupacName: item.pubchem?.iupacName ?? null,
      },
      name: item.name,
      source: 'TenderStart chemicalCatalog.generated.json',
      sourceUrl: item.pubchem?.pubchemUrl ?? item.sourceRefs?.[0]?.sourceUrl ?? null,
      status: item.sourceLevel ?? 'local_catalog',
      synonyms: item.pubchem?.synonyms ?? [],
      updatedAt: new Date().toISOString(),
    }
    await writeChemicalDossier(root, record)
    written += 1
  }
  return { records: written, root }
}

export async function saveBlob({ buffer, originalName, root = DEFAULT_ECOSYS_ROOT, sourcePath = null, sourceUrl = null, type = 'document' }) {
  await ensureEcosysStructure(root)
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const ext = safeExtension(originalName)
  const targetPath = resolve(root, 'documents/blobs/sha256', sha256.slice(0, 2), `${sha256}${ext}`)
  const created = !existsSync(targetPath)
  if (created) {
    await mkdir(dirname(targetPath), { recursive: true })
    if (sourcePath && resolve(sourcePath) !== targetPath) await copyFile(sourcePath, targetPath)
    else await writeFile(targetPath, buffer)
  }
  return {
    created,
    originalName,
    sha256,
    size: buffer.length,
    sourcePath,
    sourceUrl,
    storedPath: targetPath,
    type,
  }
}

async function fetchPubChemProperties(cids, fetchImpl) {
  const url = `${PUBCHEM_BASE}/compound/cid/${cids.join(',')}/property/MolecularFormula,MolecularWeight,IUPACName,InChIKey,CanonicalSMILES/JSON`
  try {
    const response = await fetchImpl(url, { headers: { 'user-agent': 'TenderStart ECOSYS CAS harvester' } })
    if (!response.ok) return []
    const json = await response.json()
    return json?.PropertyTable?.Properties ?? []
  } catch {
    return []
  }
}

async function fetchPubChemSynonyms(cids, fetchImpl) {
  const url = `${PUBCHEM_BASE}/compound/cid/${cids.join(',')}/synonyms/JSON`
  const result = new Map()
  try {
    const response = await fetchImpl(url, { headers: { 'user-agent': 'TenderStart ECOSYS CAS harvester' } })
    if (!response.ok) return result
    const json = await response.json()
    for (const row of json?.InformationList?.Information ?? []) {
      result.set(Number(row.CID), row.Synonym ?? [])
    }
  } catch {
    return result
  }
  return result
}

async function downloadPubChemImage(cid, { fetchImpl, root }) {
  const url = `${PUBCHEM_BASE}/compound/cid/${cid}/PNG?record_type=2d`
  try {
    const response = await fetchImpl(url, { headers: { 'user-agent': 'TenderStart ECOSYS image mirror' } })
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length < 100) return null
    const path = resolve(root, 'images/pubchem-2d', String(cid).padStart(9, '0').slice(0, 3), `${cid}.png`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, buffer)
    return {
      path,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      sourceUrl: url,
      type: 'pubchem_2d_png',
    }
  } catch {
    return null
  }
}

function buildPubChemDossier({ casNumbers, image, property, synonyms }) {
  const cid = Number(property.CID)
  return {
    cas: [...new Set(casNumbers)],
    cid,
    documents: ['SDS/MSDS required', 'COA/passport per batch required', 'TDS/specification required'],
    formula: property.MolecularFormula ?? null,
    image,
    identifiers: {
      canonicalSmiles: property.CanonicalSMILES ?? null,
      inchiKey: property.InChIKey ?? null,
      iupacName: property.IUPACName ?? null,
    },
    molecularWeight: property.MolecularWeight ?? null,
    name: pickPrimaryName(property, synonyms),
    source: 'PubChem PUG REST',
    sourceUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
    status: casNumbers.length ? 'cas_extracted' : 'no_cas_synonym_found',
    synonyms: synonyms.slice(0, 80),
    updatedAt: new Date().toISOString(),
  }
}

async function writeChemicalDossier(root, record) {
  const cidPart = record.cid ? String(record.cid).padStart(9, '0') : null
  if (cidPart) {
    await writeJson(resolve(root, 'chemicals/by-cid', cidPart.slice(0, 3), `${record.cid}.json`), record)
  }
  for (const cas of record.cas ?? []) {
    await writeJson(resolve(root, 'chemicals/by-cas', cas.slice(0, 2), `${cas}.json`), record)
  }
  const nameSlug = slugify(record.name)
  if (nameSlug) await writeJson(resolve(root, 'chemicals/by-name', nameSlug.slice(0, 2), `${nameSlug}.json`), record)
}

async function listFiles(folder) {
  if (!existsSync(folder)) return []
  const output = []
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const full = join(folder, item.name)
    if (item.isDirectory()) output.push(...await listFiles(full))
    else if (item.isFile()) output.push(full)
  }
  return output
}

function inferDocumentType(path) {
  const name = basename(path).toLowerCase()
  if (/тз|tz|technical|tt_|spec|техн/.test(name)) return 'technical_specification'
  if (/договор|dogovor|contract|nda|dpr|euf/.test(name)) return 'contract_or_supplier_terms'
  if (/форма|form|tkp|xlsx|xlsm/.test(name)) return 'supplier_form'
  if (/manual|руковод/.test(name)) return 'supplier_manual'
  if (/coa|паспорт|quality/.test(name)) return 'coa_or_quality_passport'
  if (/sds|msds/.test(name)) return 'sds_msds'
  return 'procurement_document'
}

function pickPrimaryName(property, synonyms) {
  return property.IUPACName || synonyms.find((item) => !isCasNumber(item) && item.length <= 80) || `CID ${property.CID}`
}

function isCasNumber(value) {
  return /^\d{2,7}-\d{2}-\d$/.test(String(value))
}

function safeExtension(name) {
  const ext = extname(name).toLowerCase()
  return /^[.][a-z0-9]{1,8}$/.test(ext) ? ext : '.bin'
}

function pathToSourceUrl(path) {
  return `file:///${resolve(path).replace(/\\/g, '/')}`
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function writeJsonIfMissing(path, value) {
  if (existsSync(path)) return
  await writeJson(path, value)
}

async function appendJsonl(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value)}\n`, { flag: 'a' })
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

function getArg(name, fallback) {
  const arg = process.argv.find((item) => item.startsWith(`--${name}=`))
  if (!arg) return fallback
  const raw = arg.slice(name.length + 3)
  const numeric = Number(raw)
  return Number.isFinite(numeric) ? numeric : raw
}

function isMain() {
  return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')
}

if (isMain()) {
  const root = getArg('root', DEFAULT_ECOSYS_ROOT)
  const result = {
    structure: await ensureEcosysStructure(root).then(() => 'ready'),
  }
  if (!process.argv.includes('--no-local-catalog')) {
    result.localCatalog = await mirrorTenderStartChemicalCatalog({ root })
  }
  if (!process.argv.includes('--no-docs')) {
    result.documents = await mirrorLocalTenderDocuments({ root })
  }
  if (!process.argv.includes('--no-pubchem')) {
    result.pubchem = await harvestPubChemCidRange({
      batchSize: Number(getArg('batch', 50)),
      count: Number(getArg('count', 100)),
      downloadImages: !process.argv.includes('--no-images'),
      root,
      startCid: Number(getArg('start-cid', 1)),
    })
  }
  console.log(JSON.stringify(result, null, 2))
}
