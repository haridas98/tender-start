import { regionalLeadPlant, visiblePlantEntries } from './market'
import type { Plant, RegionalLeadProfile } from './market'

type RawRegionalLeadProfile = Partial<RegionalLeadProfile>

function safeArray<T>(value: T[] | undefined) {
  return Array.isArray(value) ? value : []
}

function normalizeRegionalLeadProfile(profile: RawRegionalLeadProfile): RegionalLeadProfile | null {
  if (!profile.slug || !profile.name || !profile.region) return null

  const products = safeArray(profile.products)
  const purchaseCategories = safeArray(profile.purchaseCategories)

  return {
    ...profile,
    equipment: safeArray(profile.equipment),
    industry: profile.industry ?? 'промышленное производство',
    logoLabel: profile.logoLabel ?? profile.name.slice(0, 2).toUpperCase(),
    products,
    purchaseCategories: purchaseCategories.length ? purchaseCategories : products,
    region: profile.region,
    slug: profile.slug,
    sourceName: profile.sourceName ?? 'mass plant feed',
    sourceUrl: profile.sourceUrl ?? '',
  } as RegionalLeadProfile
}

export function buildMassPlants(feed: { items?: RawRegionalLeadProfile[] }) {
  return Object.fromEntries(
    visiblePlantEntries(
      (feed.items ?? []).flatMap((profile) => {
        const normalizedProfile = normalizeRegionalLeadProfile(profile)
        if (!normalizedProfile) return []
        return [[normalizedProfile.slug, regionalLeadPlant(normalizedProfile)]]
      }),
    ),
  ) as Record<string, Plant>
}
