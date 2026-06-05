import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const DEFAULT_OUTPUT = 'src/data/massPlantDirectoryPreview.generated.json'
export const DEFAULT_PER_REGION_LIMIT = 12

const SOURCES = [
  { country: 'Россия', file: 'src/data/russiaMassPlantLeads.json', label: 'Russia' },
  { file: 'src/data/cisMassPlantLeads.json', label: 'CIS' },
  { file: 'src/data/euMassPlantLeads.json', label: 'EU' },
  { file: 'src/data/asiaMassPlantLeads.json', label: 'Asia' },
]

const BANNED_PATTERN =
  /пиво|алког|водоч|ликер|винн|вино|wine|winery|brew|brasserie|distill|liquor|whisk|cognac|champagne|bier|beer|meat|fish|seafood|poultry|slaughter|мяс|рыб|икр|осетр|морепродукт|хмел|солод|птиц|индей|гусь|колбас|убойн/i

function visibleText(profile) {
  return [
    profile.name,
    profile.legalName,
    profile.industry,
    ...(profile.products ?? []),
    ...(profile.purchaseCategories ?? []),
    ...(profile.equipment ?? []),
  ].join(' ')
}

function normalizeCountry(profile, fallbackCountry) {
  return profile.country ?? fallbackCountry ?? 'Россия'
}

function normalizeRegion(profile, country) {
  return profile.region ?? country
}

function toDirectoryPreview(profile, fallbackCountry) {
  const country = normalizeCountry(profile, fallbackCountry)
  const region = normalizeRegion(profile, country)

  return {
    city: profile.city,
    country,
    dataQuality: profile.dataQuality ?? 'lead',
    entityLevel: profile.entityLevel,
    hasAddress: profile.hasAddress ?? Boolean(profile.address),
    hasProductEvidence: profile.hasProductEvidence ?? Boolean(profile.productionItems?.length || profile.products?.length),
    industry: profile.industry ?? 'промышленность',
    logoLabel: profile.logoLabel,
    name: profile.name,
    needsOfficialVerification: profile.needsOfficialVerification ?? true,
    products: (profile.products ?? []).slice(0, 6),
    purchaseCategories: (profile.purchaseCategories ?? []).slice(0, 6),
    region,
    slug: profile.slug,
    sourceName: profile.sourceName ?? 'mass plant feed',
    sourceUrl: profile.sourceUrl,
    verification: (profile.verification ?? []).slice(0, 3),
    website: profile.website,
  }
}

function dedupe(items) {
  const seen = new Set()
  const result = []

  for (const item of items) {
    const key = `${item.country}:${item.region}:${item.name}`.toLowerCase().replace(/["«»()]/g, '').replace(/\s+/g, ' ').trim()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }

  return result
}

export async function buildDirectoryPreview({
  output = DEFAULT_OUTPUT,
  perRegionLimit = DEFAULT_PER_REGION_LIMIT,
} = {}) {
  const selected = []
  const regionCounts = new Map()
  const sourceStats = []

  for (const source of SOURCES) {
    const payload = JSON.parse(await readFile(resolve(source.file), 'utf8'))
    const sourceItems = payload.items ?? []
    let accepted = 0

    for (const profile of sourceItems) {
      if (!profile.slug || !profile.name || BANNED_PATTERN.test(visibleText(profile))) continue

      const country = normalizeCountry(profile, source.country)
      const region = normalizeRegion(profile, country)
      const key = `${country}::${region}`
      const count = regionCounts.get(key) ?? 0
      if (count >= perRegionLimit) continue

      selected.push(toDirectoryPreview(profile, source.country))
      regionCounts.set(key, count + 1)
      accepted += 1
    }

    sourceStats.push({ accepted, label: source.label, sourceItems: sourceItems.length })
  }

  const items = dedupe(selected)
  const snapshot = {
    generatedAt: new Date().toISOString(),
    itemShape: 'directory-preview-v2',
    items,
    perRegionLimit,
    sourceStats,
    total: items.length,
    totalRegions: regionCounts.size,
  }

  const target = resolve(output)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')

  return snapshot
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const snapshot = await buildDirectoryPreview()
  console.log(`Wrote ${snapshot.total} directory plants across ${snapshot.totalRegions} regions to ${DEFAULT_OUTPUT}`)
}
