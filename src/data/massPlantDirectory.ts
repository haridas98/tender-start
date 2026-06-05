import previewFeed from './massPlantDirectoryPreview.generated.json'
import { visiblePlantEntries } from './market'
import type { Plant, SourceLevel } from './market'

type DirectoryPreviewProfile = {
  city?: string
  country?: string
  dataQuality?: SourceLevel
  entityLevel?: Plant['entityLevel']
  hasAddress?: boolean
  hasProductEvidence?: boolean
  industry?: string
  logoLabel?: string
  name: string
  needsOfficialVerification?: boolean
  products?: string[]
  purchaseCategories?: string[]
  region: string
  slug: string
  sourceName?: string
  sourceUrl?: string
  verification?: string[]
  website?: string
}

const preview = previewFeed as { items?: DirectoryPreviewProfile[] }

function directoryPlant(profile: DirectoryPreviewProfile): Plant {
  return {
    city: profile.city,
    country: profile.country ?? 'Россия',
    dataQuality: profile.dataQuality ?? 'lead',
    entityLevel: profile.entityLevel,
    equipment: [],
    hasAddress: profile.hasAddress,
    hasProductEvidence: profile.hasProductEvidence,
    industry: profile.industry ?? 'промышленность',
    logoLabel: profile.logoLabel,
    logistics: [],
    name: profile.name,
    needs: [],
    needsOfficialVerification: profile.needsOfficialVerification ?? true,
    products: profile.products ?? [],
    purchaseCategories: profile.purchaseCategories ?? [],
    region: profile.region,
    source: profile.sourceName ?? 'mass plant feed',
    sourceUrl: profile.sourceUrl,
    slug: profile.slug,
    verification: profile.verification,
    website: profile.website,
  }
}

export const massPlantDirectory: Record<string, Plant> = Object.fromEntries(
  visiblePlantEntries(
    (preview.items ?? []).map((profile) => [
      profile.slug,
      directoryPlant(profile),
    ]),
  ),
) as Record<string, Plant>
