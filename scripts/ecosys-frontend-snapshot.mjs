import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_ECOSYS_ROOT = 'D:/Projects/ECOSYS'
export const DEFAULT_OUTPUT = 'src/data/ecosysChemicalCatalog.generated.json'

export async function buildEcosysFrontendSnapshot({
  limit = 5000,
  output = DEFAULT_OUTPUT,
  root = DEFAULT_ECOSYS_ROOT,
} = {}) {
  const byCidRoot = resolve(root, 'chemicals/by-cid')
  const files = await listJsonFiles(byCidRoot)
  const records = []

  for (const filePath of files) {
    const record = await readJson(filePath)
    const normalized = normalizeEcosysRecord(record, filePath, root)
    if (normalized) records.push(normalized)
  }

  records.sort((a, b) => a.cid - b.cid)

  const snapshot = {
    generatedAt: new Date().toISOString(),
    root,
    stats: {
      byCasFiles: await countJsonFiles(resolve(root, 'chemicals/by-cas')),
      byCidFiles: files.length,
      documentBlobs: await countFiles(resolve(root, 'documents/blobs/sha256')),
      imageFiles: await countFiles(resolve(root, 'images/pubchem-2d')),
      pubchemHarvested: await readPubChemHarvestedCount(root),
    },
    records: records.slice(0, limit),
  }

  await mkdir(dirname(resolve(output)), { recursive: true })
  await writeFile(resolve(output), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  return snapshot
}

export function normalizeEcosysRecord(record, filePath = '', root = DEFAULT_ECOSYS_ROOT) {
  const cid = Number(record?.cid)
  if (!Number.isFinite(cid)) return null

  const identifiers = record.identifiers ?? {}
  const synonyms = uniqueStrings(record.synonyms).filter((item) => item.length <= 120).slice(0, 12)
  const cas = uniqueStrings(record.cas).filter(isCasNumber)
  const name = firstString(record.name, identifiers.iupacName, synonyms.find((item) => !isCasNumber(item)), `CID ${cid}`)

  return {
    cas,
    cid,
    documents: uniqueStrings(record.documents).slice(0, 8),
    formula: firstString(record.formula, record.molecularFormula, null),
    iupacName: firstString(identifiers.iupacName, record.iupacName, null),
    molecularWeight: firstString(record.molecularWeight, null),
    name,
    source: firstString(record.source, 'PubChem PUG REST'),
    sourceUrl: firstString(record.sourceUrl, `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`),
    status: firstString(record.status, 'pubchem_record'),
    storagePath: filePath ? relative(resolve(root), filePath).replace(/\\/g, '/') : null,
    synonyms,
  }
}

async function readPubChemHarvestedCount(root) {
  const cursorPath = resolve(root, 'manifests/pubchem-cursor.json')
  if (!existsSync(cursorPath)) return 0
  const cursor = await readJson(cursorPath)
  return Number(cursor?.lastCid) || 0
}

async function countJsonFiles(folder) {
  return (await listJsonFiles(folder)).length
}

async function countFiles(folder) {
  if (!existsSync(folder)) return 0
  let count = 0
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const fullPath = join(folder, item.name)
    if (item.isDirectory()) count += await countFiles(fullPath)
    else if (item.isFile()) count += 1
  }
  return count
}

async function listJsonFiles(folder) {
  if (!existsSync(folder)) return []
  const output = []
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const fullPath = join(folder, item.name)
    if (item.isDirectory()) output.push(...await listJsonFiles(fullPath))
    else if (item.isFile() && item.name.endsWith('.json')) output.push(fullPath)
  }
  return output
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function uniqueStrings(value) {
  const list = Array.isArray(value) ? value : value ? [value] : []
  return [...new Set(list.map((item) => String(item).trim()).filter(Boolean))]
}

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) ?? null
}

function isCasNumber(value) {
  return /^\d{2,7}-\d{2}-\d$/.test(String(value))
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
  const snapshot = await buildEcosysFrontendSnapshot({
    limit: Number(getArg('limit', 5000)),
    output: String(getArg('output', DEFAULT_OUTPUT)),
    root: String(getArg('root', DEFAULT_ECOSYS_ROOT)),
  })
  console.log(
    `ECOSYS frontend snapshot written: ${snapshot.records.length} records, ${snapshot.stats.byCasFiles} CAS files, ${snapshot.stats.documentBlobs} document blobs`,
  )
}
