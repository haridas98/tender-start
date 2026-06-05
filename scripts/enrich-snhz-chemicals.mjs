import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SNHZ_SOURCE_URL = 'https://snhz.ru/?event=article&cat=55'
const DEFAULT_INPUT = 'src/data/snhzDemand.ts'
const DEFAULT_OUTPUT = 'src/data/snhzChemicalIndex.generated.json'
const PUBCHEM_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'

const QUERY_RULES = [
  [/глицидол/i, 'glycidol'],
  [/железо сернокислое|железный купорос/i, 'iron(II) sulfate'],
  [/изобутилен/i, 'isobutylene'],
  [/изопрен/i, 'isoprene'],
  [/фенол/i, 'phenol'],
  [/формалин|формальдегид/i, 'formaldehyde'],
  [/калий едкий|гидроксид калия/i, 'potassium hydroxide'],
  [/каолин/i, 'kaolin'],
  [/ферроцен/i, 'ferrocene'],
  [/алкилбензолсульфокисл/i, 'dodecylbenzenesulfonic acid'],
  [/альфаметилстирол/i, 'alpha-methylstyrene'],
  [/парафин/i, 'paraffin'],
  [/спирт бутиловый/i, '1-butanol'],
  [/спирт изопропиловый/i, 'isopropyl alcohol'],
  [/стекло натриевое/i, 'sodium silicate'],
  [/сульфат алюминия/i, 'aluminum sulfate'],
  [/тетрохлорид титана|тетрахлорид титана/i, 'titanium tetrachloride'],
  [/триэтаноламин/i, 'triethanolamine'],
  [/ангидрид молибден/i, 'molybdenum trioxide'],
  [/ангидрид хром/i, 'chromium trioxide'],
  [/калий углекислый|поташ/i, 'potassium carbonate'],
  [/карбонат церия/i, 'cerium carbonate'],
  [/магний оксид/i, 'magnesium oxide'],
  [/малеиновый ангидрид/i, 'maleic anhydride'],
  [/натрий едкий|натр твёрдый|каустическая сода/i, 'sodium hydroxide'],
  [/никель сернокислый/i, 'nickel sulfate'],
  [/нитрит натрия/i, 'sodium nitrite'],
  [/пропановая фракция/i, 'propane'],
  [/толуол/i, 'toluene'],
  [/циклогексанон/i, 'cyclohexanone'],
  [/азот газообразный/i, 'nitrogen'],
  [/водород/i, 'hydrogen'],
  [/литий металлический/i, 'lithium'],
  [/оксид алюминия|глинозем/i, 'aluminum oxide'],
  [/аммиак/i, 'ammonia'],
  [/бутадиен/i, '1,3-butadiene'],
  [/диметиламин/i, 'dimethylamine'],
  [/кислота серная/i, 'sulfuric acid'],
  [/кислота уксусная/i, 'acetic acid'],
  [/медь катодная/i, 'copper'],
  [/метанол/i, 'methanol'],
  [/ортофосфорная кислота/i, 'phosphoric acid'],
  [/сода кальцинированная/i, 'sodium carbonate'],
  [/стирол/i, 'styrene'],
  [/уротропин/i, 'hexamethylenetetramine'],
  [/диметилформамид|дмфа/i, 'dimethylformamide'],
  [/дифенилоксид/i, 'diphenyl ether'],
  [/морфолин/i, 'morpholine'],
  [/неодима оксид/i, 'neodymium oxide'],
  [/неодима хлорид/i, 'neodymium chloride'],
  [/пара-крезол/i, 'p-cresol'],
  [/перхлорэтилен/i, 'tetrachloroethylene'],
  [/бихромат натрия/i, 'sodium dichromate'],
  [/глицерин/i, 'glycerol'],
  [/окись пропилена/i, 'propylene oxide'],
  [/тальк/i, 'talc'],
  [/этиленгликоль/i, 'ethylene glycol'],
]

export async function enrichSnhzChemicals({
  fetchImpl = fetch,
  inputPath = DEFAULT_INPUT,
  outputPath = DEFAULT_OUTPUT,
  refresh = false,
} = {}) {
  const source = await readFile(resolve(inputPath), 'utf8')
  const items = extractSnhzItems(source)
  const existing = refresh ? { records: [] } : await readExisting(outputPath)
  const existingByName = new Map((existing.records ?? []).map((record) => [normalizeKey(record.name), record]))
  const records = []

  for (const item of items) {
    const query = pickPubChemQuery(item.name)
    const cached = existingByName.get(normalizeKey(item.name))
    const pubchem = cached?.pubchem && !refresh ? cached.pubchem : await fetchPubChem(query, fetchImpl)
    records.push(buildRecord(item, query, pubchem))
  }

  const feed = {
    generatedAt: new Date().toISOString(),
    records,
    source: 'SNHZ official raw material matrix + PubChem PUG REST enrichment',
    sourceUrl: SNHZ_SOURCE_URL,
  }

  await mkdir(dirname(resolve(outputPath)), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(feed, null, 2)}\n`, 'utf8')
  return feed
}

export function extractSnhzItems(source) {
  const block = source.slice(source.indexOf('export const snhzDemandItems'))
  const itemRegexp = /\{\s*"documents":\s*\[([\s\S]*?)\],\s*"name":\s*"([^"]+)"[\s\S]*?"note":\s*"([^"]*)"[\s\S]*?"source":\s*"([^"]+)"[\s\S]*?"sourceUrl":\s*"([^"]+)"[\s\S]*?"spec":\s*"([^"]*)"[\s\S]*?"status":\s*"([^"]*)"[\s\S]*?"volume":\s*"([^"]*)"\s*\}/g
  const items = []
  for (const match of block.matchAll(itemRegexp)) {
    const documents = [...match[1].matchAll(/"([^"]+)"/g)].map((doc) => doc[1])
    items.push({
      documents,
      name: match[2],
      note: match[3],
      responsible: parseResponsible(match[3]),
      source: match[4],
      sourceUrl: match[5],
      spec: match[6],
      standards: extractStandards([...documents, match[6]].join('; ')),
      status: match[7],
      volume: match[8],
    })
  }
  return items
}

function buildRecord(item, query, pubchem) {
  const slug = `snhz-${slugify(query || item.name)}`
  const pubchemSource = pubchem?.cid ? `https://pubchem.ncbi.nlm.nih.gov/compound/${pubchem.cid}` : null
  return {
    cas: pubchem?.cas ?? null,
    documents: item.documents,
    formula: pubchem?.molecularFormula ?? null,
    inchiKey: pubchem?.inchiKey ?? null,
    iupacName: pubchem?.iupacName ?? null,
    molecularWeight: pubchem?.molecularWeight ?? null,
    name: item.name,
    pubchem,
    pubchemQuery: query,
    pubchemSource,
    responsible: item.responsible,
    slug,
    source: item.source,
    sourceUrl: item.sourceUrl || SNHZ_SOURCE_URL,
    standards: item.standards,
    status: pubchem?.cid ? 'pubchem_enriched' : query ? 'pubchem_not_found' : 'needs_manual_mapping',
    tenderSpec: item.spec,
    volume: item.volume,
  }
}

function parseResponsible(note) {
  const match = String(note).match(/Ответственный:\s*([^,]+),\s*([^;]+);\s*тел\.\s*([^;]+);\s*([^\s]+@[^\s.]+\.[^\s.]+)/i)
  if (!match) return null
  return {
    email: cleanContactValue(match[4]),
    name: cleanContactValue(match[1]),
    phone: cleanContactValue(match[3]),
    role: cleanContactValue(match[2]),
  }
}

function cleanContactValue(value) {
  return String(value).replace(/[.,;]+$/g, '').trim()
}

function pickPubChemQuery(name) {
  const rule = QUERY_RULES.find(([regexp]) => regexp.test(name))
  return rule?.[1] ?? null
}

async function fetchPubChem(query, fetchImpl) {
  if (!query) return null
  try {
    const propertyUrl = `${PUBCHEM_BASE}/compound/name/${encodeURIComponent(query)}/property/MolecularFormula,MolecularWeight,IUPACName,InChIKey/JSON`
    const propertyResponse = await fetchImpl(propertyUrl, { headers: { 'user-agent': 'TenderStart chemical enrichment' } })
    if (!propertyResponse.ok) return null
    const propertyJson = await propertyResponse.json()
    const property = propertyJson?.PropertyTable?.Properties?.[0]
    if (!property?.CID) return null

    const synonymsUrl = `${PUBCHEM_BASE}/compound/cid/${property.CID}/synonyms/JSON`
    const synonymsResponse = await fetchImpl(synonymsUrl, { headers: { 'user-agent': 'TenderStart chemical enrichment' } })
    const synonymsJson = synonymsResponse.ok ? await synonymsResponse.json() : null
    const synonyms = synonymsJson?.InformationList?.Information?.[0]?.Synonym ?? []
    const cas = synonyms.find((synonym) => /^\d{2,7}-\d{2}-\d$/.test(synonym)) ?? null

    return {
      cas,
      cid: property.CID,
      inchiKey: property.InChIKey ?? null,
      iupacName: property.IUPACName ?? null,
      molecularFormula: property.MolecularFormula ?? null,
      molecularWeight: property.MolecularWeight ?? null,
      synonyms: synonyms.slice(0, 12),
    }
  } catch {
    return null
  }
}

function extractStandards(text) {
  const candidates = String(text).split(/[,;]/).map((item) => item.trim())
  return [...new Set(candidates.filter((item) => /^(ГОСТ|ТУ|СТО|СТ ТОО|ОСТ|ISO|НТД)/i.test(item)))]
}

function slugify(value) {
  const transliterated = String(value)
    .toLowerCase()
    .replace(/ё/g, 'e')
    .replace(/[а-я]/g, (char) => CYRILLIC[char] ?? char)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return transliterated || 'chemical'
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/\s+/g, ' ').trim()
}

async function readExisting(outputPath) {
  try {
    return JSON.parse(await readFile(resolve(outputPath), 'utf8'))
  } catch {
    return { records: [] }
  }
}

const CYRILLIC = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
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

function isMain() {
  return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')
}

if (isMain()) {
  const feed = await enrichSnhzChemicals({ refresh: process.argv.includes('--refresh') })
  const enriched = feed.records.filter((record) => record.pubchem?.cid).length
  console.log(`SNHZ chemical index updated: ${feed.records.length} records, ${enriched} PubChem enriched`)
}
