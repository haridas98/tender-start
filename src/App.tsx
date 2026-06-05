import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  FlaskConical,
  Landmark,
  Mail,
  Map,
  PackageCheck,
  Search,
  ShieldCheck,
  Ship,
  SlidersHorizontal,
  Sparkles,
  UserRoundCheck,
  Warehouse,
} from 'lucide-react'
import './App.css'
import { materials, plants as corePlants, russiaRegionStages, sourceDirectory } from './data/market'
import type { Buyer, Material, Plant, PlantLineItem, PlantProcurementSignal, SourceQualityMetadata, SourceRecord, Supplier } from './data/market'
import asiaCoverageRaw from './data/asiaCoverage.generated.json'
import cisCoverageRaw from './data/cisCoverage.generated.json'
import plantDetailsRaw from './data/plantDetails.generated.json'
import { globalComplianceSources, priorityTradeLanes, tradeRuleProfiles } from './data/tradeRules'

type Section =
  | 'buyers'
  | 'chemicals'
  | 'deals'
  | 'demo'
  | 'map'
  | 'materials'
  | 'plants'
  | 'producer'
  | 'producers'
  | 'rules'
  | 'search'
  | 'sources'
  | 'suppliers'

type RouteState = {
  section: Section
  slug: string
}

type SupplierMode = 'best' | 'price' | 'reliable'
type MassPlantSource = 'all' | 'asia' | 'cis' | 'eu' | 'russia'

const defaultMaterial = materials.sulfur
const materialCatalog = Object.values(materials)
const asiaCoverage = asiaCoverageRaw as unknown as AsiaCoverageSnapshot
const cisCoverage = cisCoverageRaw as unknown as CisCoverageSnapshot
const plantDetails = plantDetailsRaw as Record<string, PlantDetail>

type CisCoverageSnapshot = {
  countries: Array<{
    collected: number
    complete: boolean
    country: string
    countrySlug: string
    sourceBreakdown: Record<string, number>
    target: number
    tenderPlatforms: Array<{ name: string; url: string }>
  }>
  generatedAt: string
  source: string
  total: number
}

type AsiaCoverageSnapshot = {
  countries: Array<{
    collected: number
    completeRegions: number
    country: string
    regions: Array<{
      collected: number
      complete: boolean
      iso: string
      region: string
      sourceBreakdown: Record<string, number>
      target: number
      tenderPlatforms: Array<{ label?: string; name?: string; url: string }>
    }>
    sourceBreakdown: Record<string, number>
    target: number
  }>
  generatedAt: string
  source: string
  standardVersion: string
  total: number
  totalCompleteRegions: number
  totalRegions: number
  totalTarget: number
}

type EcosysChemicalRecord = {
  cas: string[]
  cid: number
  documents: string[]
  formula: string | null
  iupacName: string | null
  molecularWeight: string | null
  name: string
  source: string
  sourceUrl: string
  status: string
  storagePath: string | null
  synonyms: string[]
}

type EcosysChemicalSnapshot = {
  generatedAt: string
  root: string
  stats: {
    byCasFiles: number
    byCidFiles: number
    documentBlobs: number
    imageFiles: number
    pubchemHarvested: number
  }
  records: EcosysChemicalRecord[]
}

const emptyEcosysChemicalCatalog: EcosysChemicalSnapshot = {
  generatedAt: '',
  records: [],
  root: 'D:/Projects/ECOSYS',
  stats: {
    byCasFiles: 0,
    byCidFiles: 0,
    documentBlobs: 0,
    imageFiles: 0,
    pubchemHarvested: 0,
  },
}

function dealPathForMaterial(slug: string) {
  return slug === 'sulfur' ? '/deals/sulfur-ufa-rfq' : `/deals/${slug}-import-rfq`
}

function buyerPathForMaterial(material: Material) {
  const buyer = material.buyers[0]
  if (!buyer) return '/search'
  return buyerPathForBuyer(buyer)
}

function buyerPathForBuyer(buyer: Buyer) {
  if (buyer.slug === 'snhz') return '/plants/snhz'
  return `/buyers/${buyer.slug}`
}

function findMaterialFromDealSlug(slug: string) {
  return materialCatalog.find((item) => slug === item.slug || slug.includes(item.slug))
}

function materialSlugFromRoute(route: RouteState) {
  if ((route.section === 'materials' || route.section === 'map') && materials[route.slug]) return route.slug
  if (route.section === 'deals') return findMaterialFromDealSlug(route.slug)?.slug
  if (route.section === 'suppliers') return findSupplierHit(route.slug)?.material.slug
  if (route.section === 'buyers') return findBuyerHit(route.slug)?.material.slug
  return undefined
}

function routeNeedsMassPlantDirectory(route: RouteState) {
  return route.section === 'search' || (route.section === 'plants' && route.slug === 'sulfur')
}

function routeNeedsFullMassPlantIndex(
  route: RouteState,
  detailPlantIndex: Record<string, Plant>,
  searchQuery = '',
) {
  if (route.section === 'search') return massPlantSourceForSearchQuery(searchQuery) !== null
  if (routeNeedsMassPlantDirectory(route)) return false

  const isUnknownPlantCard =
    route.section === 'plants' && !corePlants[route.slug] && !detailPlantIndex[route.slug]

  return isUnknownPlantCard
}

function massPlantSourceForRoute(route: RouteState, searchQuery = ''): MassPlantSource {
  if (route.section === 'search') return massPlantSourceForSearchQuery(searchQuery) ?? 'russia'
  return massPlantSourceForSlug(route.slug)
}

function massPlantSourceForSearchQuery(query: string): MassPlantSource | null {
  const normalizedQuery = query.trim().toLowerCase()
  if (normalizedQuery.length < 3) return null

  if (
    /[\u4e00-\u9fff]/.test(normalizedQuery) ||
    /(china|india|sinopec|reliance|tata|gujarat|maharashtra|jiangsu|shandong|zhejiang|guangdong|китай|индия)/i.test(normalizedQuery)
  ) {
    return 'asia'
  }

  if (
    /(basf|germany|deutschland|france|netherlands|italy|austria|belgium|spain|poland|europe|германия|франц|нидерланд|итал|австр|бельг|польш|европа)/i.test(normalizedQuery)
  ) {
    return 'eu'
  }

  if (
    /(kazakhstan|uzbekistan|azerbaijan|belarus|armenia|georgia|tajikistan|kyrgyzstan|turkmenistan|moldova|казахстан|узбек|азербайджан|беларус|армени|грузия|таджик|киргиз|туркмен|молд)/i.test(normalizedQuery)
  ) {
    return 'cis'
  }

  if (/[а-яё]/i.test(normalizedQuery)) return 'russia'

  return normalizedQuery.length >= 5 ? 'russia' : null
}

function massPlantSourceForSlug(slug: string): MassPlantSource {
  if (slug.startsWith('asia-')) return 'asia'
  if (slug.startsWith('cis-')) return 'cis'
  if (slug.startsWith('eu-')) return 'eu'
  return 'russia'
}

function massPlantSourceLabel(source: MassPlantSource) {
  if (source === 'asia') return 'Азия: Индия / Китай'
  if (source === 'cis') return 'СНГ'
  if (source === 'eu') return 'Европа'
  if (source === 'russia') return 'Россия'
  return 'Все регионы'
}

async function importMassPlantsBySource(source: MassPlantSource) {
  if (source === 'asia') return (await import('./data/massPlantsAsia')).massPlantsAsia
  if (source === 'cis') return (await import('./data/massPlantsCis')).massPlantsCis
  if (source === 'eu') return (await import('./data/massPlantsEu')).massPlantsEu
  if (source === 'russia') return (await import('./data/massPlantsRussia')).massPlantsRussia
  return (await import('./data/massPlants')).massPlants
}

function routeNeedsEcosysSnapshot(route: RouteState) {
  return route.section === 'search' || route.section === 'chemicals' || route.section === 'materials'
}

type DetailCompany = {
  address: string | null
  city?: string | null
  country?: string | null
  data_level: string
  display_name: string
  emails: string[]
  inn: string | null
  kpp: string | null
  legal_name: string | null
  ogrn: string | null
  phones: string[]
  region?: string | null
  source_name?: string
  source_url: string
  website: string | null
}

type DetailFact = {
  fact_type?: string
  label: string
  source_name: string
  source_url: string
  status: string
  value: string | null
}

type DetailProduct = {
  brand: string | null
  confidence: string
  name: string
  source_name?: string
  source_url: string
  spec: string
  volume: string
}

type DetailNeed = {
  documents: string[]
  estimated_volume: string
  frequency: string
  name: string
  source_name: string
  source_url: string
  spec: string
  status: string
}

type DetailDocument = {
  document_type: string
  id?: number
  procurement_event_id?: number | null
  source_name: string
  status: string
  title: string
  url: string | null
}

type DetailProcurementEvent = {
  customer: string | null
  id?: number
  items: Array<{
    documents: string[]
    name: string
    quantity: string | null
    spec: string
    unit: string | null
  }>
  law: string | null
  price: string | null
  source_name?: string
  source_url: string
  status: string
  title: string
}

type DetailOwnership = {
  owner_name: string
  role: string
  share: string | null
  source_url: string
  status: string
}

type DetailFinancial = {
  metric: string
  period: string
  source_url: string
  status: string
  value: string | null
}

type DetailSanctions = {
  list_name: string
  result_note: string
  source_url: string
  status: string
}

type PlantDetail = {
  company: DetailCompany
  documents: DetailDocument[]
  facts: DetailFact[]
  financials: DetailFinancial[]
  needs: DetailNeed[]
  ownership: DetailOwnership[]
  procurementEvents: DetailProcurementEvent[]
  products: DetailProduct[]
  ragChunks: Array<{ source_url: string; text: string }>
  sanctionsChecks: DetailSanctions[]
}

type PlantVisualReference = {
  caption: string
  imageUrl: string
  keywords: string[]
  source: string
  title: string
}

type PlantVisualCard = {
  caption: string
  documents: string[]
  imageUrl: string
  kind: string
  meta: string
  source: string
  title: string
}

function buildDetailPlantIndex(details: Record<string, PlantDetail>): Record<string, Plant> {
  return Object.fromEntries(Object.entries(details).map(([slug, detail]) => {
    const sourceUrl = detail.company.source_url ?? detail.procurementEvents[0]?.source_url ?? ''
    const documents = detail.documents.map((document) => document.title)
    const sourceName = detail.company.source_name ?? detail.procurementEvents[0]?.source_name ?? 'TenderStart DB'
    const hasAddress = Boolean(detail.company.address)
    const hasProductEvidence = detail.products.length > 0
    const isVerifiedProfile = detail.company.data_level === 'verified_profile'
    const verification = [
      detail.procurementEvents.length ? `${detail.procurementEvents.length} parsed tender notice${detail.procurementEvents.length === 1 ? '' : 's'}` : null,
      detail.documents.length ? `${detail.documents.length} source document${detail.documents.length === 1 ? '' : 's'} in TenderStart` : null,
      detail.company.website ? 'official website linked' : 'official website missing',
    ].filter((item): item is string => Boolean(item))
    return [slug, {
      address: detail.company.address ?? undefined,
      city: detail.company.city ?? undefined,
      country: detail.company.country ?? undefined,
      dataQuality: isVerifiedProfile ? 'verified' : 'lead',
      demandItems: detail.needs.map((need) => ({
        documents: need.documents,
        name: need.name,
        source: need.source_name,
        sourceUrl: need.source_url,
        spec: need.spec,
        status: need.status,
        volume: need.estimated_volume,
      })),
      documents,
      emails: detail.company.emails,
      entityLevel: detail.products.length ? 'plant' : detail.procurementEvents.length || detail.needs.length ? 'company' : 'unknown',
      equipment: detail.facts
        .filter((fact) => fact.fact_type === 'equipment')
        .map((fact) => fact.value)
        .filter((value): value is string => Boolean(value)),
      hasAddress,
      hasProductEvidence,
      industry: detail.facts.find((fact) => fact.fact_type === 'industry')?.value ?? detail.facts.find((fact) => fact.label === 'industry')?.value ?? 'procurement buyer',
      legalName: detail.company.legal_name ?? undefined,
      logistics: [],
      name: detail.company.display_name,
      needsOfficialVerification: !isVerifiedProfile,
      needs: detail.needs.map((need) => ({
        materialName: need.name,
        note: need.frequency,
        spec: need.spec,
        status: need.status,
        volume: need.estimated_volume,
      })),
      phones: detail.company.phones,
      procurementEvidence: detail.procurementEvents.map((event) => ({
        documents: [...new Set([
          ...event.items.flatMap((item) => item.documents),
          ...detail.documents.filter((document) => document.procurement_event_id === event.id).map((document) => document.title),
        ])],
        inferredNeeds: event.items.map((item) => item.name),
        note: event.items.map((item) => item.spec).join('; '),
        source: event.source_name ?? sourceName,
        sourceUrl: event.source_url,
        status: event.status as PlantProcurementSignal['status'],
        title: event.title || event.source_name || 'Закупка / потребность',
      })),
      productionItems: detail.products.map((product) => ({
        documents: [],
        name: product.name,
        source: product.source_name ?? sourceName,
        sourceUrl: product.source_url,
        spec: product.spec,
        status: product.confidence,
        volume: product.volume,
      })),
      products: detail.products.map((product) => product.name),
      purchaseCategories: detail.needs.map((need) => need.name),
      region: detail.company.region ?? detail.company.country ?? 'unknown',
      source: sourceName,
      sourceUrl,
      slug,
      verification,
      website: detail.company.website ?? undefined,
    } satisfies Plant]
  })) as Record<string, Plant>
}

const plantVisualReferences: PlantVisualReference[] = [
  {
    caption: 'Жёлтые кристаллы/гранулы; для сделки всё равно нужен паспорт партии и фракционный состав.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Sulfur-sample.jpg',
    keywords: ['сера', 'sulfur'],
    source: 'Wikimedia Commons',
    title: 'Сера: гранулы или кристаллы',
  },
  {
    caption: 'Белый пигментный порошок; важны TiO2 %, белизна, укрывистость, маслоёмкость и обработка поверхности.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Titanium%28IV%29_oxide.jpg',
    keywords: ['диоксид титана', 'titanium dioxide', 'tio2'],
    source: 'Wikimedia Commons',
    title: 'Диоксид титана: пигментный порошок',
  },
  {
    caption: 'Гранулы/шарики сорбента; в ТЗ проверяют размер гранул, влагопоглощение, индикацию и тару.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Silica_gel_bag_open_with_beads.jpg',
    keywords: ['силикагель', 'silica gel', 'сорбент'],
    source: 'Wikimedia Commons',
    title: 'Силикагель: гранулы сорбента',
  },
  {
    caption: 'Пластиковые гранулы в мешках; нужны марка, MFI, плотность, добавки, цвет и стабильность партии.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Bags_of_plastic_granules.jpg',
    keywords: ['пласт', 'полимер', 'полиэтилен', 'polymer', 'polyethylene', 'гранул'],
    source: 'Wikimedia Commons',
    title: 'Полимерное сырьё: гранулы',
  },
  {
    caption: 'Бухты кабеля/проводов; важны сечение, материал жилы, изоляция, ГОСТ/ТУ и условия поставки.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Cable_wires.jpg',
    keywords: ['кабель', 'провод', 'cable', 'wire'],
    source: 'Wikimedia Commons',
    title: 'Кабельная продукция',
  },
  {
    caption: 'Каучук/латекс как промышленное сырьё; нужны марка, вязкость, содержание сухого вещества, тара и паспорт партии.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/09/Bales_of_plantation_rubber%2C_Brazil_LCCN2001705615.jpg',
    keywords: ['каучук', 'латекс', 'rubber', 'latex'],
    source: 'Wikimedia Commons',
    title: 'Каучук и латекс',
  },
  {
    caption: 'Топливные компоненты поставляются в цистернах/бочках; нужны фракционный состав, октановое число, паспорт и допуски.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fb/Fuel_depot%2C_military%2C_storage%2C_barrel_Fortepan_72469.jpg',
    keywords: ['топлив', 'бензин', 'авиацион', 'fuel', 'gasoline'],
    source: 'Wikimedia Commons',
    title: 'Топливные компоненты',
  },
  {
    caption: 'Химическая продукция в металлических бочках; проверяются UN-код, класс опасности, тара и SDS/MSDS.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/64/Galvanized_chemical_drums.jpg',
    keywords: ['хим', 'реагент', 'кислот', 'щелоч', 'глицидол', 'ионол', 'антиоксидант', 'нефтехим', 'масло'],
    source: 'Wikimedia Commons',
    title: 'Жидкая/опасная химия в таре',
  },
  {
    caption: 'Гранулированное удобрение; в закупке нужны NPK/состав, влажность, фракция и сертификаты качества.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/DAP_%28Diammonium_Phosphate%29_Granules_%281%29.jpg',
    keywords: ['удобр', 'dap', 'npk', 'фосфат', 'премикс', 'корм'],
    source: 'Wikimedia Commons',
    title: 'Удобрения и минеральные добавки',
  },
  {
    caption: 'Мешки строительного материала; критичны марка, прочность, дата производства и условия хранения.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Portland_Cement_Bags.jpg',
    keywords: ['цемент', 'строительн', 'смесь', 'бетон'],
    source: 'Wikimedia Commons',
    title: 'Строительные сухие материалы',
  },
  {
    caption: 'Промышленный редуктор/металлоузел; нужны чертежи, материал, допуски, термообработка и паспорт изделия.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Manufactures_of_industrial_gearbox.jpg',
    keywords: ['редуктор', 'машиностро', 'металл', 'сталь', 'узлы', 'подшип', 'гидравл', 'мехобработ', 'gearbox'],
    source: 'Wikimedia Commons',
    title: 'Машиностроительные изделия',
  },
  {
    caption: 'Образец упаковки/тары; для сделки нужны размеры, материал, барьерные свойства и прочность.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/64/Galvanized_chemical_drums.jpg',
    keywords: ['тара', 'упаков', 'пленка', 'мешок', 'короб', 'паллет'],
    source: 'Wikimedia Commons',
    title: 'Тара и промышленная упаковка',
  },
]

const navItems: Array<{ href: string; icon: typeof Search; label: string; section: Section }> = [
  { href: '/demo', icon: Sparkles, label: 'Демо', section: 'demo' },
  { href: '/search', icon: Search, label: 'Поиск сырья', section: 'search' },
  { href: '/materials/sulfur', icon: FlaskConical, label: 'Вещества', section: 'materials' },
  { href: '/plants', icon: Building2, label: 'Заводы', section: 'plants' },
  { href: '/suppliers/reliance-industries', icon: Warehouse, label: 'Поставщики', section: 'suppliers' },
  { href: '/buyers/kazanorgsintez', icon: BriefcaseBusiness, label: 'Покупатели', section: 'buyers' },
  { href: '/deals/sulfur-ufa-rfq', icon: ClipboardCheck, label: 'Сделки', section: 'deals' },
  { href: '/map/sulfur', icon: Map, label: 'Карта', section: 'map' },
  { href: '/rules', icon: ShieldCheck, label: 'Пошлины', section: 'rules' },
  { href: '/sources', icon: FileText, label: 'Источники', section: 'sources' },
]

const roleModes = ['Закупщик', 'ИП', 'Производитель', 'Логист', 'Аналитик']

function App() {
  const [route, setRoute] = useState<RouteState>(() => readRoute())
  const [query, setQuery] = useState('')
  const [activeRole, setActiveRole] = useState('Закупщик')
  const [activeMaterialSlug, setActiveMaterialSlug] = useState(() =>
    materialSlugFromRoute(route) ?? defaultMaterial.slug,
  )
  const [selectedSource, setSelectedSource] = useState<SourceRecord | null>(null)
  const [selectedSupplierSlug, setSelectedSupplierSlug] = useState('reliance-industries')
  const [massPlantDirectoryIndex, setMassPlantDirectoryIndex] = useState<Record<string, Plant>>({})
  const [massPlantIndex, setMassPlantIndex] = useState<Record<string, Plant>>({})
  const [massPlantLoadedSources, setMassPlantLoadedSources] = useState<Partial<Record<MassPlantSource, boolean>>>({})
  const [ecosysSnapshot, setEcosysSnapshot] = useState<EcosysChemicalSnapshot | null>(null)
  const detailPlantIndex = useMemo(() => buildDetailPlantIndex(plantDetails), [])

  useEffect(() => {
    const onPopState = () => {
      const nextRoute = readRoute()
      setRoute(nextRoute)
      const nextMaterialSlug = materialSlugFromRoute(nextRoute)
      if (nextMaterialSlug) setActiveMaterialSlug(nextMaterialSlug)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const needsMassPlantDirectory = routeNeedsMassPlantDirectory(route)

    if (!needsMassPlantDirectory || Object.keys(massPlantDirectoryIndex).length > 0) return

    let cancelled = false
    import('./data/massPlantDirectory').then(({ massPlantDirectory }) => {
      if (!cancelled) setMassPlantDirectoryIndex(massPlantDirectory)
    })

    return () => {
      cancelled = true
    }
  }, [massPlantDirectoryIndex, route])

  useEffect(() => {
    const needsMassPlantIndex = routeNeedsFullMassPlantIndex(route, detailPlantIndex, query)
    const massPlantSource = massPlantSourceForRoute(route, query)

    if (!needsMassPlantIndex || massPlantLoadedSources[massPlantSource]) return

    let cancelled = false
    importMassPlantsBySource(massPlantSource).then((massPlants) => {
      if (cancelled) return
      setMassPlantIndex((current) => ({ ...current, ...massPlants }))
      setMassPlantLoadedSources((current) => ({
        ...current,
        ...(massPlantSource === 'all' ? { asia: true, cis: true, eu: true, russia: true } : {}),
        [massPlantSource]: true,
      }))
    })

    return () => {
      cancelled = true
    }
  }, [detailPlantIndex, massPlantLoadedSources, query, route])

  useEffect(() => {
    if (!routeNeedsEcosysSnapshot(route) || ecosysSnapshot) return

    let cancelled = false
    import('./data/ecosysChemicalCatalog.generated.json').then((module) => {
      if (!cancelled) setEcosysSnapshot(module.default as EcosysChemicalSnapshot)
    })

    return () => {
      cancelled = true
    }
  }, [ecosysSnapshot, route])

  const plantIndex = useMemo(
    () => ({ ...corePlants, ...detailPlantIndex, ...massPlantDirectoryIndex, ...massPlantIndex }),
    [detailPlantIndex, massPlantDirectoryIndex, massPlantIndex],
  )
  const plantCatalog = useMemo(() => Object.values(plantIndex), [plantIndex])
  const isPlantDirectoryLoading =
    routeNeedsMassPlantDirectory(route) && Object.keys(massPlantDirectoryIndex).length === 0
  const isFullMassPlantIndexLoading =
    routeNeedsFullMassPlantIndex(route, detailPlantIndex, query) &&
    !massPlantLoadedSources[massPlantSourceForRoute(route, query)]
  const ecosysChemicalCatalog = ecosysSnapshot ?? emptyEcosysChemicalCatalog
  const ecosysRecords = ecosysChemicalCatalog.records

  const routeMaterialSlug = materialSlugFromRoute(route)
  const material = materials[routeMaterialSlug ?? activeMaterialSlug] ?? defaultMaterial

  const dealMaterial = useMemo(() => findMaterialFromDealSlug(route.slug), [route.slug])

  const selectedSupplier =
    material.suppliers.find((supplier) => supplier.slug === selectedSupplierSlug) ??
    material.suppliers[0]

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
    }
    const nextRoute = readRoute()
    setRoute(nextRoute)
    const nextMaterialSlug = materialSlugFromRoute(nextRoute)
    if (nextMaterialSlug) setActiveMaterialSlug(nextMaterialSlug)
  }

  const onNav = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    event.preventDefault()
    navigateTo(path)
  }

  const selectMaterial = (slug: string) => {
    const material = materials[slug] ?? defaultMaterial
    setQuery(material.name.toLowerCase())
    navigateTo(`/materials/${material.slug}`)
  }

  const openDeal = (slug: string) => navigateTo(dealPathForMaterial(slug))

  return (
    <main className="deal-shell">
      <Sidebar onNav={onNav} route={route} />
      <section className="deal-main">
        <TopBar
          activeRole={activeRole}
          ecosysRecords={ecosysRecords}
          material={material}
          navigateTo={navigateTo}
          plantCatalog={plantCatalog}
          query={query}
          selectMaterial={selectMaterial}
          setActiveRole={setActiveRole}
          setQuery={setQuery}
        />

        {route.section === 'demo' ? (
          <FederalDemoPage navigateTo={navigateTo} />
        ) : route.section === 'search' ? (
          <SearchPage
            ecosysChemicalCatalog={ecosysChemicalCatalog}
            ecosysRecords={ecosysRecords}
            isEcosysLoading={!ecosysSnapshot}
            navigateTo={navigateTo}
            query={query}
            plantCatalog={plantCatalog}
            selectMaterial={selectMaterial}
            setQuery={setQuery}
            setSelectedSource={setSelectedSource}
          />
        ) : route.section === 'deals' ? (
          dealMaterial ? (
            <DealRoom material={dealMaterial} navigateTo={navigateTo} setSelectedSource={setSelectedSource} />
          ) : (
            <NotFoundPage navigateTo={navigateTo} title="Сделка не найдена" />
          )
        ) : route.section === 'map' ? (
          <ImportMapPage material={material} navigateTo={navigateTo} setSelectedSource={setSelectedSource} />
        ) : route.section === 'rules' ? (
          <TradeRulesPage />
        ) : route.section === 'producer' ? (
          route.slug === 'register' ? (
            <ProducerRegistrationPage navigateTo={navigateTo} />
          ) : (
            <NotFoundPage navigateTo={navigateTo} title="Раздел производителя не найден" />
          )
        ) : route.section === 'producers' ? (
          route.slug === 'demo-verified-chemical' ? (
            <ProducerProfilePage navigateTo={navigateTo} />
          ) : (
            <NotFoundPage navigateTo={navigateTo} title="Профиль производителя не найден" />
          )
        ) : route.section === 'sources' ? (
          <SourcesPage />
        ) : route.section === 'chemicals' ? (
          <EcosysChemicalPage
            ecosysChemicalCatalog={ecosysChemicalCatalog}
            isEcosysLoading={!ecosysSnapshot}
            navigateTo={navigateTo}
            record={findEcosysChemicalRecord(route.slug, ecosysRecords)}
            setSelectedSource={setSelectedSource}
          />
        ) : route.section === 'plants' ? (
          plantIndex[route.slug] ? (
            <PlantPage navigateTo={navigateTo} plant={plantIndex[route.slug]} setSelectedSource={setSelectedSource} />
          ) : isFullMassPlantIndexLoading && route.slug !== 'sulfur' ? (
            <PlantLookupLoadingPage slug={route.slug} />
          ) : route.slug !== 'sulfur' ? (
            <PlantNotFoundPage navigateTo={navigateTo} plantCatalog={plantCatalog} slug={route.slug} />
          ) : (
            <PlantDirectory
              isPlantDirectoryLoading={isPlantDirectoryLoading || isFullMassPlantIndexLoading}
              navigateTo={navigateTo}
              plantCatalog={plantCatalog}
            />
          )
        ) : route.section === 'suppliers' ? (
          <SupplierPage navigateTo={navigateTo} supplierHit={findSupplierHit(route.slug) ?? { ...selectedSupplier, material }} />
        ) : route.section === 'buyers' ? (
          <BuyerPage buyerHit={findBuyerHit(route.slug) ?? { ...defaultMaterial.buyers[0], material: defaultMaterial }} navigateTo={navigateTo} />
        ) : (
          <MaterialWorkspace
            ecosysRecords={ecosysRecords}
            material={material}
            navigateTo={navigateTo}
            onOpenDeal={() => openDeal(material.slug)}
            selectedSupplier={selectedSupplier}
            selectedSupplierSlug={selectedSupplierSlug}
            setSelectedSource={setSelectedSource}
            setSelectedSupplierSlug={setSelectedSupplierSlug}
          />
        )}
      </section>

      {selectedSource ? (
        <SourceDrawer source={selectedSource} onClose={() => setSelectedSource(null)} />
      ) : null}
    </main>
  )
}

function Sidebar({
  onNav,
  route,
}: {
  onNav: (event: MouseEvent<HTMLAnchorElement>, path: string) => void
  route: RouteState
}) {
  return (
    <aside className="deal-sidebar">
      <a className="deal-brand" href="/materials/sulfur" onClick={(event) => onNav(event, '/materials/sulfur')}>
        <FlaskConical aria-hidden="true" size={30} />
        <span>
          <strong>TenderStart</strong>
          <small>Deal OS</small>
        </span>
      </a>
      <nav aria-label="Основные разделы" className="deal-nav">
        {navItems.map((item) => (
          <a
            aria-current={route.section === item.section ? 'page' : undefined}
            className={route.section === item.section ? 'active' : ''}
            href={item.href}
            key={item.label}
            onClick={(event) => onNav(event, item.href)}
          >
            <item.icon aria-hidden="true" size={18} />
            {item.label}
          </a>
        ))}
      </nav>
      <div className="sidebar-status">
        <span>Фокус MVP</span>
        <strong>Индия / Китай → РФ</strong>
        <small>сырье, закупки, логистика, RFQ</small>
      </div>
    </aside>
  )
}

function NotFoundPage({ navigateTo, title }: { navigateTo: (path: string) => void; title: string }) {
  return (
    <section className="page-stack">
      <div className="page-hero not-found-panel">
        <span className="screen-label">Не найдено</span>
        <h1>{title}</h1>
        <p>
          TenderStart не подменяет неизвестный slug другой карточкой. Нужно открыть существующий кейс или вернуться в поиск.
        </p>
        <div className="page-action-row">
          <button className="primary-action inline" type="button" onClick={() => navigateTo('/demo')}>
            <Sparkles aria-hidden="true" size={18} />
            Демо-сценарий
          </button>
          <button className="ghost-action" type="button" onClick={() => navigateTo('/search')}>
            <Search aria-hidden="true" size={18} />
            Поиск
          </button>
        </div>
      </div>
    </section>
  )
}

function PlantLookupLoadingPage({ slug }: { slug: string }) {
  return (
    <section className="page-stack">
      <div className="page-hero not-found-panel">
        <span className="screen-label">Загрузка карточки</span>
        <h1>Подтягиваем завод</h1>
        <p>
          TenderStart ищет профиль <strong>{slug}</strong> в нужном региональном индексе. После загрузки откроется карточка
          с продукцией, потребностями, документами и контактами внутри сервиса.
        </p>
        <section className="registry-loading-panel" aria-live="polite">
          <strong>Загружаем профиль завода</strong>
          <span>Не показываем общий реестр вместо карточки, чтобы не сбивать сценарий презентации.</span>
        </section>
      </div>
    </section>
  )
}

function PlantNotFoundPage({
  navigateTo,
  plantCatalog,
  slug,
}: {
  navigateTo: (path: string) => void
  plantCatalog: Plant[]
  slug: string
}) {
  const source = massPlantSourceForSlug(slug)
  const suggestions = suggestPlantMatches(slug, plantCatalog)

  return (
    <section className="page-stack">
      <div className="page-hero not-found-panel">
        <span className="screen-label">Завод</span>
        <h1>Завод не найден</h1>
        <p>
          Проверили индекс <strong>{massPlantSourceLabel(source)}</strong>, но slug <strong>{slug}</strong> не найден.
          Клиента не уводим наружу: даём похожие карточки и возврат в рабочие разделы TenderStart.
        </p>
        <div className="page-action-row">
          <button className="primary-action inline" type="button" onClick={() => navigateTo('/plants')}>
            <Building2 aria-hidden="true" size={18} />
            Открыть реестр заводов
          </button>
          <button className="ghost-action" type="button" onClick={() => navigateTo('/search')}>
            <Search aria-hidden="true" size={18} />
            Поиск сырья и заводов
          </button>
          <button className="ghost-action" type="button" onClick={() => navigateTo('/plants/snhz')}>
            Демо-карточка СНХЗ
          </button>
        </div>
      </div>

      <section className="search-section">
        <div className="section-title">
          <div>
            <span className="screen-label">Подсказки</span>
            <h2>Похожие заводы</h2>
          </div>
          <strong>{massPlantSourceLabel(source)}</strong>
        </div>
        <div className="search-list compact branded-list">
          {suggestions.map((plant) => (
            <article key={plant.slug}>
              <PlantLogo plant={plant} />
              <div>
                <strong>{plant.name}</strong>
                <span>{plant.country ?? 'Россия'} · {plant.region} · {plant.industry ?? 'промышленность'}</span>
                <small>{plant.products.slice(0, 3).join(' · ') || 'продукция требует уточнения'}</small>
              </div>
              <button type="button" onClick={() => navigateTo(`/plants/${plant.slug}`)}>
                открыть
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="registry-loading-panel" aria-label="Что проверить в базе">
        <strong>Что проверить в парсере</strong>
        <span>slug, источник feed, дедупликацию, фильтр запрещённых отраслей и наличие карточки после ежедневного обновления.</span>
      </section>
    </section>
  )
}

function FederalDemoPage({ navigateTo }: { navigateTo: (path: string) => void }) {
  const demoRoute = [
    ['0:00', 'Проблема', 'Заводы и поставщики тратят время на ручной поиск сырья, документов, цен и логистики.', '/demo', 'Остаться на сценарии'],
    ['0:45', 'Завод', 'Открываем СНХЗ: что производит, что закупает, кто отвечает за конкретную позицию.', '/plants/snhz', 'Показать СНХЗ'],
    ['2:00', 'Вещество', 'Переходим в глицидол: CAS, ТУ, требуемые документы, прямые производители.', '/materials/snhz-glycidol', 'Глицидол: карточка'],
    ['3:30', 'Сравнение', 'Смотрим таблицу поставщиков: характеристики, цена, мощность, документы, логистика.', '/materials/snhz-glycidol', 'Сравнить поставщиков'],
    ['4:45', 'Сделка', 'Открываем RFQ: что запросить, какие документы приложить, какой следующий шаг.', '/deals/snhz-glycidol-import-rfq', 'Собрать RFQ'],
    ['6:00', 'Маршрут', 'Показываем импортозамещение, маршрут, пошлины и риски доставки до завода.', '/map/snhz-glycidol', 'Маршрут и пошлины'],
  ]

  const demoStages = [
    {
      icon: Building2,
      label: '1',
      title: 'Завод и потребность',
      text: 'СНХЗ: видим, что завод производит, что закупает, кто отвечает за сырье и какие документы нужны.',
      action: 'Открыть СНХЗ',
      path: '/plants/snhz',
    },
    {
      icon: FlaskConical,
      label: '2',
      title: 'Вещество',
      text: 'Глицидол: CAS, ТУ, требования к партии, список потенциальных прямых производителей и сравнение.',
      action: 'Открыть глицидол',
      path: '/materials/snhz-glycidol',
    },
    {
      icon: ClipboardCheck,
      label: '3',
      title: 'RFQ и экономика',
      text: 'Один экран для цены, COA/SDS/MSDS, маршрута, пошлин, НДС, риска и следующего шага сделки.',
      action: 'Собрать RFQ',
      path: '/deals/snhz-glycidol-import-rfq',
    },
    {
      icon: UserRoundCheck,
      label: '4',
      title: 'Профиль производителя',
      text: 'Будущая страница производителя: мощности, продукты, документы, контакты, Incoterms и верификация.',
      action: 'Профиль производителя',
      path: '/producers/demo-verified-chemical',
    },
  ]

  const demoCases = [
    {
      accent: 'СНХЗ',
      title: 'Глицидол для нефтехимии',
      text: 'Показывает главный принцип: завод → конкретная потребность → вещество → прямые производители → RFQ.',
      facts: ['CAS 556-52-5', 'ТУ 38402-62-162-96', 'COA/SDS/MSDS', 'постоянная закупка'],
      primaryAction: 'Открыть кейс глицидола',
      primaryPath: '/materials/snhz-glycidol',
      secondaryAction: 'RFQ по глицидолу',
      secondaryPath: '/deals/snhz-glycidol-import-rfq',
    },
    {
      accent: 'Водоканалы / ETP',
      title: 'Хлорид железа под тендер',
      text: 'Готовый импортный сценарий: кому нужен реагент, какие индийские заводы подходят, сколько заложить на логистику и таможню.',
      facts: ['FeCl3 40-46%', '12-60 т', 'UN 2582 / class 8', 'Индия → РФ'],
      primaryAction: 'Открыть хлорид железа',
      primaryPath: '/materials/ferric-chloride',
      secondaryAction: 'RFQ по FeCl3',
      secondaryPath: '/deals/ferric-chloride-import-rfq',
    },
    {
      accent: 'Башкортостан / Татарстан',
      title: 'Сера как базовый рынок',
      text: 'Понятный пример для закупщика: покупатели, поставщики, цены, объёмы, документы и сделка без ручного сбора ссылок.',
      facts: ['99.9%', '100 т/мес', 'ГОСТ 127.1-93', 'сравнение поставщиков'],
      primaryAction: 'Открыть серу',
      primaryPath: '/materials/sulfur',
      secondaryAction: 'Deal room по сере',
      secondaryPath: '/deals/sulfur-ufa-rfq',
    },
  ]

  const proofCards = [
    ['Потребность внутри сервиса', 'ТЗ, характеристики, объем, ответственное лицо, документы и источник аудита хранятся в карточке TenderStart.'],
    ['Прямой производитель', 'Отдельно отмечаем manufacturer/trader, страну происхождения, мощность, MOQ и документы качества.'],
    ['Landed cost', 'Цена сырья + морской/сухопутный маршрут + брокер + пошлина + НДС + риск задержки.'],
    ['AI-агент', 'Агент объясняет, почему поставщик подходит или не подходит под конкретное ТУ/СТО/CAS.'],
  ]

  const userBenefits = [
    ['ИП / участник тендера', 'Быстро понять, где есть спрос, какой товар реально закрыть и какую цену дать без слепого поиска.'],
    ['Завод-закупщик', 'Видеть альтернативных производителей, документы, цену до склада и риск поставки до запуска закупки.'],
    ['Производитель', 'Получить страницу с продукцией, CAS, мощностями, COA/SDS/MSDS и входящими RFQ от покупателей.'],
    ['Регион / страна', 'Находить неэффективный импорт, локальные замены и узкие места в цепочках поставок.'],
  ]

  const moneyModels = [
    ['Success fee', '1-3% от успешно проведенной сделки или фикс за закрытый RFQ.'],
    ['Подписка', 'Рабочее место закупщика/аналитика: поиск, сравнение, экспорт RFQ, мониторинг закупок.'],
    ['Верификация производителя', 'Платная проверка документов, профиля, происхождения, мощностей и контактов.'],
    ['Логистика и комплаенс', 'Партнёрская комиссия за маршрут, брокера, страхование, проверку санкций и документов.'],
  ]

  const pitchBlocks = [
    ['Проблема', 'Данные о спросе, производителях, качестве, документах, логистике и ценах разрознены. Из-за этого закупки дороже, дольше и рискованнее.'],
    ['Решение', 'TenderStart собирает карточку вещества, завода и поставщика в одном месте и помогает собрать сделку с документами.'],
    ['MVP', 'Сегодня показываем 3 работающих кейса: СНХЗ/глицидол, хлорид железа, сера. Дальше ежедневно добираем тендеры и заводы.'],
    ['Запрос к жюри', 'Пилот с промышленными закупщиками, доступ к экспертам по ВЭД/таможне, обратная связь от заводов и поддержка на первые RFQ.'],
  ]

  const tomorrowChecklist = [
    'Показать, что TenderStart не уводит клиента на сторонний сайт, а собирает данные внутри карточки.',
    'Открыть завод, перейти в вещество, сравнить производителей и собрать RFQ.',
    'Показать, как производитель сможет зарегистрироваться и подтвердить свою продукцию документами.',
    'Честно разделить: подтверждено документом, расчет, лид на проверку.',
  ]

  return (
    <section className="page-stack demo-page">
      <div className="page-hero demo-hero">
        <span className="screen-label">Демо на завтра</span>
        <h1>TenderStart: от потребности завода до готового RFQ</h1>
        <p>
          Показываем не каталог ссылок, а рабочую сделочную карту: кому нужно сырье, какие характеристики требуются,
          кто может произвести, какие документы есть, сколько будет стоить доставка до завода и что делать дальше.
        </p>
        <div className="page-action-row">
          <button className="primary-action inline" type="button" onClick={() => navigateTo('/plants/snhz')}>
            <Building2 aria-hidden="true" size={18} />
            Начать с СНХЗ
          </button>
          <button className="ghost-action" type="button" onClick={() => navigateTo('/materials/snhz-glycidol')}>
            <FlaskConical aria-hidden="true" size={18} />
            Открыть глицидол
          </button>
          <button className="ghost-action" type="button" onClick={() => navigateTo('/producer/register')}>
            <UserRoundCheck aria-hidden="true" size={18} />
            Регистрация производителя
          </button>
        </div>
      </div>

      <section className="demo-route-board" aria-label="Маршрут показа">
        <div className="section-title">
          <div>
            <span className="screen-label">7 минут</span>
            <h2>Маршрут показа на завтра</h2>
          </div>
          <strong>идти строго сверху вниз</strong>
        </div>
        <div className="demo-route-list">
          {demoRoute.map(([time, title, text, path, action]) => (
            <article key={`${time}-${title}`}>
              <strong>{time}</strong>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <button type="button" onClick={() => navigateTo(path)}>
                {action}
                <ArrowRight aria-hidden="true" size={15} />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="demo-stage-grid" aria-label="Сценарий демо">
        {demoStages.map((stage) => (
          <article key={stage.path}>
            <div className="demo-stage-head">
              <span>{stage.label}</span>
              <stage.icon aria-hidden="true" size={22} />
            </div>
            <h2>{stage.title}</h2>
            <p>{stage.text}</p>
            <button type="button" onClick={() => navigateTo(stage.path)}>
              {stage.action}
              <ArrowRight aria-hidden="true" size={16} />
            </button>
          </article>
        ))}
      </section>

      <section className="demo-case-grid" aria-label="Кейсы для демонстрации">
        <div className="section-title">
          <div>
            <span className="screen-label">Кейсы</span>
            <h2>3 готовых примера для жюри</h2>
          </div>
          <strong>завод → вещество → поставщик → RFQ</strong>
        </div>
        <div>
          {demoCases.map((item) => (
            <article className="demo-case-card" key={item.title}>
              <span>{item.accent}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <div className="demo-fact-row">
                {item.facts.map((fact) => (
                  <small key={fact}>{fact}</small>
                ))}
              </div>
              <div className="demo-case-actions">
                <button className="primary-action inline" type="button" onClick={() => navigateTo(item.primaryPath)}>
                  {item.primaryAction}
                </button>
                <button className="ghost-action" type="button" onClick={() => navigateTo(item.secondaryPath)}>
                  {item.secondaryAction}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="demo-proof-grid" aria-label="Что нужно показать инвестору">
        {proofCards.map(([title, text]) => (
          <article key={title}>
            <CheckCircle2 aria-hidden="true" size={20} />
            <div>
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="demo-user-grid" aria-label="Кому полезен сервис">
        <div className="section-title">
          <div>
            <span className="screen-label">Польза</span>
            <h2>Кому это нужно</h2>
          </div>
        </div>
        <div>
          {userBenefits.map(([title, text]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="demo-money-grid" aria-label="Монетизация">
        <div className="section-title">
          <div>
            <span className="screen-label">Деньги</span>
            <h2>Как TenderStart зарабатывает</h2>
          </div>
          <strong>сначала закупки, потом аналитика</strong>
        </div>
        <div>
          {moneyModels.map(([title, text]) => (
            <article key={title}>
              <BriefcaseBusiness aria-hidden="true" size={20} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="demo-pitch-board" aria-label="Питч для федерального этапа">
        <div className="section-title">
          <div>
            <span className="screen-label">Питч</span>
            <h2>Формулировка для федерального этапа</h2>
          </div>
          <button type="button" onClick={() => navigateTo('/sources')}>
            Источники данных
            <ArrowRight aria-hidden="true" size={15} />
          </button>
        </div>
        <div>
          {pitchBlocks.map(([title, text]) => (
            <article key={title}>
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="demo-checklist">
        <div className="section-title">
          <div>
            <span className="screen-label">Фокус показа</span>
            <h2>Что завтра должно прозвучать понятно</h2>
          </div>
          <strong>3-5 проверенных кейсов важнее тысяч пустых строк</strong>
        </div>
        <div>
          {tomorrowChecklist.map((item) => (
            <span key={item}>
              <ShieldCheck aria-hidden="true" size={16} />
              {item}
            </span>
          ))}
        </div>
      </section>
    </section>
  )
}

function ProducerRegistrationPage({ navigateTo }: { navigateTo: (path: string) => void }) {
  const sections = [
    ['Юрлицо', 'Название, регистрационный номер, страна, адрес площадки, сайт, санкционный/комплаенс-статус.'],
    ['Продукция', 'CAS, HS/ТН ВЭД, марка, концентрация, чистота, упаковка, MOQ, мощность в месяц.'],
    ['Документы', 'COA по партии, SDS/MSDS, TDS, ISO, REACH, происхождение, паспорт качества, условия поставки.'],
    ['Логистика', 'Incoterms, порт отгрузки, допустимая тара, опасный груз, температурный режим, экспортные ограничения.'],
    ['Контакты', 'Продажи, экспорт, качество, логистика, закупки, ответственные по конкретным веществам.'],
    ['Проверка', 'Статусы: заявлено производителем, проверяется TenderStart, подтверждено документом.'],
  ]

  const sampleProducts = [
    ['Глицидол', 'CAS 556-52-5', '99% min', 'MOQ 1 т', 'COA/SDS/MSDS'],
    ['Диоксид титана', 'CAS 13463-67-7', 'рутиль R-996', 'MOQ 20 т', 'TDS/COA'],
    ['Силикагель', 'CAS 7631-86-9', 'индикаторный/осушитель', 'MOQ 5 т', 'SDS/TDS'],
  ]
  const formFields = [
    ['Юрлицо', 'Demo Verified Chemical Works Pvt. Ltd.'],
    ['Страна / площадка', 'India, Gujarat, chemical industrial zone'],
    ['Сайт производителя', 'https://producer.example'],
    ['Контакт RFQ', 'export@producer.example'],
    ['Основной продукт', 'Glycidol, CAS 556-52-5'],
    ['Incoterms', 'FOB Mundra / Nhava Sheva, CIF по запросу'],
  ]

  return (
    <section className="page-stack producer-page">
      <div className="page-hero">
        <span className="screen-label">Производитель</span>
        <h1>Регистрация производителя в TenderStart</h1>
        <p>
          Производитель получает полноценную страницу: что выпускает, какие характеристики подтверждены, какие документы
          приложены и какие потребности заводов он может закрыть без посредников.
        </p>
        <div className="page-action-row">
          <button className="primary-action inline" type="button" onClick={() => navigateTo('/producers/demo-verified-chemical')}>
            <UserRoundCheck aria-hidden="true" size={18} />
            Открыть демо-профиль
          </button>
          <button className="ghost-action" type="button" onClick={() => navigateTo('/demo')}>
            Вернуться в демо
          </button>
        </div>
      </div>

      <section className="producer-registration-form" aria-label="Форма регистрации производителя">
        <div className="section-title">
          <div>
            <span className="screen-label">Mock form</span>
            <h2>Что производитель заполняет сам</h2>
          </div>
          <strong>статус: заявлено производителем</strong>
        </div>
        <div className="producer-field-grid">
          {formFields.map(([label, value]) => (
            <label key={label}>
              <span>{label}</span>
              <input readOnly value={value} />
            </label>
          ))}
        </div>
        <div className="producer-upload-row">
          {['COA по партии', 'SDS/MSDS', 'TDS', 'ISO/REACH', 'Certificate of origin', 'Фото упаковки'].map((item) => (
            <span key={item}>
              <FileText aria-hidden="true" size={14} />
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="producer-form-grid" aria-label="Анкета производителя">
        {sections.map(([title, text]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className="table-panel">
        <div className="section-title">
          <div>
            <span className="screen-label">Пример заполнения</span>
            <h2>Продуктовая матрица производителя</h2>
          </div>
        </div>
        <div className="comparison-table producer-products-table">
          <div className="comparison-row header">
            <span>Продукт</span>
            <span>CAS</span>
            <span>Спецификация</span>
            <span>MOQ</span>
            <span>Документы</span>
          </div>
          {sampleProducts.map((row) => (
            <div className="comparison-row" key={row[0]}>
              {row.map((cell) => (
                <span key={cell}>{cell}</span>
              ))}
            </div>
          ))}
        </div>
      </section>
    </section>
  )
}

function ProducerProfilePage({ navigateTo }: { navigateTo: (path: string) => void }) {
  const profileFacts = [
    ['Юрлицо', 'Demo Verified Chemical Works Pvt. Ltd.'],
    ['Площадка', 'Gujarat, India, химическая промышленная зона'],
    ['Роль', 'Прямой производитель, не трейдер'],
    ['Экспорт', 'FOB Nhava Sheva / Mundra, CIF Санкт-Петербург по запросу'],
    ['Проверка', 'документы партии и сайт производителя нужно перепроверять перед сделкой'],
  ]

  const productRows = [
    ['Глицидол', '556-52-5', '99% min, вода <=0.2%', '8-12 т/мес', '$2 800-3 400/т FOB', 'COA, SDS/MSDS, TDS'],
    ['Эпихлоргидрин', '106-89-8', '99.5% min', '60 т/мес', '$1 350-1 700/т FOB', 'COA, SDS/MSDS'],
    ['Силикагель', '7631-86-9', '2-5 мм, индикаторный', '120 т/мес', '$620-900/т FOB', 'SDS, TDS'],
  ]

  const status = [
    ['Заявлено производителем', 'мощности, MOQ, Incoterms'],
    ['Проверяется TenderStart', 'санкции, сайт, регистрация, экспортная история'],
    ['Подтверждать перед RFQ', 'COA по партии, SDS/MSDS, договор, происхождение'],
  ]

  return (
    <section className="page-stack producer-page">
      <div className="page-hero producer-hero">
        <span className="screen-label">Профиль производителя</span>
        <h1>Demo Verified Chemical Works</h1>
        <p>
          Так должна выглядеть страница производителя после регистрации: продукты связаны с CAS и потребностями заводов,
          документы лежат внутри TenderStart, а цены и мощности отделены от подтвержденных фактов.
        </p>
        <div className="page-action-row">
          <button className="primary-action inline" type="button" onClick={() => navigateTo('/deals/snhz-glycidol-import-rfq')}>
            <ClipboardCheck aria-hidden="true" size={18} />
            Добавить в RFQ по глицидолу
          </button>
          <button className="ghost-action" type="button" onClick={() => navigateTo('/materials/snhz-glycidol')}>
            Сравнить с другими
          </button>
        </div>
      </div>

      <section className="producer-status-grid" aria-label="Статусы данных производителя">
        {status.map(([title, text]) => (
          <article key={title}>
            <ShieldCheck aria-hidden="true" size={18} />
            <strong>{title}</strong>
            <span>{text}</span>
          </article>
        ))}
      </section>

      <section className="producer-profile-grid">
        <article>
          <h2>Паспорт производителя</h2>
          <dl className="plant-passport-grid">
            {profileFacts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </article>
        <article>
          <h2>Контакты для сделки</h2>
          <div className="plant-contact-list">
            <p>Export sales: export@demo-chemical.example</p>
            <p>Quality/COA: qa@demo-chemical.example</p>
            <p>Logistics: logistics@demo-chemical.example</p>
            <p>Responsible for glycidol: экспортный менеджер, проверка перед RFQ</p>
          </div>
        </article>
      </section>

      <section className="table-panel">
        <div className="section-title">
          <div>
            <span className="screen-label">Продукция</span>
            <h2>Что производит и чем может закрыть потребности</h2>
          </div>
        </div>
        <div className="comparison-table producer-products-table wide">
          <div className="comparison-row header">
            <span>Продукт</span>
            <span>CAS</span>
            <span>Характеристики</span>
            <span>Мощность</span>
            <span>Цена</span>
            <span>Документы</span>
          </div>
          {productRows.map((row) => (
            <div className="comparison-row" key={row[0]}>
              {row.map((cell, index) =>
                index === 0 ? (
                  <button key={cell} type="button" onClick={() => navigateTo(cell === 'Глицидол' ? '/materials/snhz-glycidol' : '/search')}>
                    {cell}
                  </button>
                ) : (
                  <span key={cell}>{cell}</span>
                ),
              )}
            </div>
          ))}
        </div>
      </section>
    </section>
  )
}

function TopBar({
  activeRole,
  ecosysRecords,
  material,
  navigateTo,
  plantCatalog,
  query,
  selectMaterial,
  setActiveRole,
  setQuery,
}: {
  activeRole: string
  ecosysRecords: EcosysChemicalRecord[]
  material: Material
  navigateTo: (path: string) => void
  plantCatalog: Plant[]
  query: string
  selectMaterial: (slug: string) => void
  setActiveRole: (role: string) => void
  setQuery: (value: string) => void
}) {
  const roleContext = roleContextFor(activeRole, material)

  return (
    <header className="deal-topbar">
      <label className="global-command">
        <Search aria-hidden="true" size={20} />
        <input
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              navigateTo(pathForGlobalQuery(query, plantCatalog, ecosysRecords))
            }
          }}
          placeholder="Введите вещество, завод или страну"
          value={query}
        />
      </label>
      <div className="role-switch" aria-label="Роль пользователя">
        {roleModes.map((role) => (
          <button
            className={role === activeRole ? 'active' : ''}
            key={role}
            onClick={() => setActiveRole(role)}
            type="button"
          >
            {role}
          </button>
        ))}
      </div>
      <div className="role-context" aria-live="polite">
        <span>{activeRole}</span>
        <strong>{roleContext.title}</strong>
        <small>{roleContext.note}</small>
        <button type="button" onClick={() => navigateTo(roleContext.path)}>
          {roleContext.action}
          <ArrowRight aria-hidden="true" size={15} />
        </button>
      </div>
      <div className="scenario-actions">
        <button type="button" onClick={() => selectMaterial('sulfur')}>
          <PackageCheck aria-hidden="true" size={17} />
          Мне нужна сера
        </button>
        <button type="button" onClick={() => navigateTo(buyerPathForMaterial(material))}>
          <UserRoundCheck aria-hidden="true" size={17} />
          Хочу найти покупателя
        </button>
        <button type="button" onClick={() => navigateTo(`/materials/${material.slug}`)}>
          <SlidersHorizontal aria-hidden="true" size={17} />
          Сравнить поставщиков
        </button>
        <button type="button" onClick={() => navigateTo(`/map/${material.slug}`)}>
          <Landmark aria-hidden="true" size={17} />
          Найти импортозамещение
        </button>
      </div>
    </header>
  )
}

function roleContextFor(role: string, material: Material) {
  const index = roleModes.indexOf(role)
  if (index === 1) {
    return {
      action: 'Открыть поиск ниш',
      note: 'Быстрый вход для ИП: выбрать сырье, проверить спрос и собрать первую RFQ.',
      path: '/search',
      title: 'Ниши, где можно зайти в сделку',
    }
  }
  if (index === 2) {
    return {
      action: 'Показать покупателей',
      note: `Для производителя: кто может покупать ${material.name}, какие объемы и документы нужны.`,
      path: buyerPathForMaterial(material),
      title: 'Спрос и прямые покупатели',
    }
  }
  if (index === 3) {
    return {
      action: 'Открыть правила',
      note: 'Маршрут, пошлины, документы, риски перевозки и альтернативные коридоры.',
      path: '/rules',
      title: 'Логистика и таможня',
    }
  }
  if (index === 4) {
    return {
      action: 'Открыть карту',
      note: 'Сравнение рынков, поставщиков, потребителей и импортозамещения по веществу.',
      path: `/map/${material.slug}`,
      title: 'Ситуационная карта рынка',
    }
  }
  return {
    action: 'Открыть сравнение',
    note: `Для закупщика: характеристики, поставщики, цена, документы и сделка по ${material.name}.`,
    path: `/materials/${material.slug}`,
    title: 'Закупка сырья под потребность',
  }
}

function pathForGlobalQuery(query: string, plantCatalog: Plant[], ecosysRecords: EcosysChemicalRecord[]) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return '/search'

  const materialHit = materialCatalog.find((item) => matchesMaterial(item, normalizedQuery))
  if (materialHit) return `/materials/${materialHit.slug}`

  const ecosysHit = ecosysRecords.find((record) => matchesEcosysChemical(record, normalizedQuery))
  if (ecosysHit) return `/chemicals/${ecosysHit.cid}`

  const plantHit = plantCatalog.find((plant) => matchesPlant(plant, normalizedQuery))
  if (plantHit) return `/plants/${plantHit.slug}`

  const supplierHit = materialCatalog
    .flatMap((item) => item.suppliers.map((supplier) => ({ material: item, supplier })))
    .find(({ material, supplier }) => matchesSupplier(supplier, material, normalizedQuery))
  if (supplierHit) return `/suppliers/${supplierHit.supplier.slug}`

  const buyerHit = materialCatalog
    .flatMap((item) => item.buyers.map((buyer) => ({ buyer, material: item })))
    .find(({ buyer, material }) => matchesBuyer(buyer, material, normalizedQuery))
  if (buyerHit) return buyerPathForBuyer(buyerHit.buyer)

  return '/search'
}

type SupplierHit = Supplier & { material: Material }
type BuyerHit = Buyer & { material: Material }

function findSupplierHit(slug: string): SupplierHit | undefined {
  for (const material of materialCatalog) {
    const supplier = material.suppliers.find((item) => item.slug === slug)
    if (supplier) return { ...supplier, material }
  }
  return undefined
}

function findBuyerHit(slug: string): BuyerHit | undefined {
  for (const material of materialCatalog) {
    const buyer = material.buyers.find((item) => item.slug === slug)
    if (buyer) return { ...buyer, material }
  }
  return undefined
}

function SearchPage({
  ecosysChemicalCatalog,
  ecosysRecords,
  isEcosysLoading,
  navigateTo,
  plantCatalog,
  query,
  selectMaterial,
  setQuery,
  setSelectedSource,
}: {
  ecosysChemicalCatalog: EcosysChemicalSnapshot
  ecosysRecords: EcosysChemicalRecord[]
  isEcosysLoading: boolean
  navigateTo: (path: string) => void
  plantCatalog: Plant[]
  query: string
  selectMaterial: (slug: string) => void
  setQuery: (value: string) => void
  setSelectedSource: (source: SourceRecord) => void
}) {
  const normalizedQuery = query.trim().toLowerCase()
  const materialResults = materialCatalog.filter((material) => matchesMaterial(material, normalizedQuery))
  const supplierResults = materialCatalog.flatMap((material) =>
    material.suppliers
      .filter((supplier) => matchesSupplier(supplier, material, normalizedQuery))
      .map((supplier) => ({ ...supplier, material })),
  )
  const buyerResults = materialCatalog.flatMap((material) =>
    material.buyers
      .filter((buyer) => matchesBuyer(buyer, material, normalizedQuery))
      .map((buyer) => ({ ...buyer, material })),
  )
  const plantResults = sortPlantSearchResults(
    plantCatalog.filter((plant) => matchesPlant(plant, normalizedQuery)),
    normalizedQuery,
  )
  const ecosysResults = ecosysRecords
    .filter((record) => matchesEcosysChemical(record, normalizedQuery))
    .slice(0, normalizedQuery ? 8 : 6)

  return (
    <section className="page-stack">
      <div className="search-hero">
        <div>
          <span className="screen-label">Командный центр</span>
          <h1>Поиск сырья и сделки</h1>
          <p>
            Один экран для первого вопроса: что это за вещество, кто производит,
            кому нужно, какая цена до склада и какие документы запросить.
          </p>
        </div>
        <div className="search-command-card">
          <label className="search-command-input">
            <Search aria-hidden="true" size={20} />
            <input
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Сера, диоксид титана, силикагель, завод или страна"
              value={query}
            />
          </label>
          <div className="quick-searches">
            {materialCatalog.map((material) => (
              <button key={material.slug} type="button" onClick={() => setQuery(material.name.toLowerCase())}>
                {material.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="search-summary-grid">
        <article>
          <span>Вещества</span>
          <strong>{materialResults.length}</strong>
          <small>карточки с CAS, ТН ВЭД, требованиями</small>
        </article>
        <article>
          <span>Поставщики</span>
          <strong>{supplierResults.length}</strong>
          <small>производители и лиды для RFQ</small>
        </article>
        <article>
          <span>Покупатели</span>
          <strong>{buyerResults.length}</strong>
          <small>спрос, объемы, регион, контакты</small>
        </article>
        <article>
          <span>Заводы</span>
          <strong>{plantResults.length}</strong>
          <small>страна, регион, отрасль, потребности</small>
        </article>
        <article>
          <span>CAS/ECOSYS</span>
          <strong>{formatCount(ecosysChemicalCatalog.stats.pubchemHarvested || ecosysChemicalCatalog.stats.byCidFiles)}</strong>
          <small>записей PubChem/CAS, документы и 2D-изображения сохранены локально</small>
        </article>
      </section>

      <section className="search-section">
        <div className="section-title">
          <div>
            <span className="screen-label">Матрица рынка</span>
            <h2>Каталог веществ</h2>
          </div>
        </div>
        <div className="material-card-grid">
          {materialResults.map((material) => (
            <article className="material-card" key={material.slug}>
              <div>
                <h3>{material.name}</h3>
                <p>{material.requirement.grade}</p>
              </div>
              <div className="material-card-meta">
                <DataChip label="CAS" value={material.cas} />
                <DataChip label="ТН ВЭД" value={material.hs} />
              </div>
              <div className="deal-mini-metrics">
                <span>{material.suppliers.length} поставщика</span>
                <span>{material.buyers.length} покупателя</span>
                <span>{material.requirement.volume}</span>
              </div>
              <button type="button" onClick={() => selectMaterial(material.slug)}>
                Открыть {material.name}
                <ArrowRight aria-hidden="true" size={15} />
              </button>
            </article>
          ))}
        </div>
      </section>

      <EcosysCatalogPanel
        ecosysChemicalCatalog={ecosysChemicalCatalog}
        isLoading={isEcosysLoading}
        navigateTo={navigateTo}
        records={ecosysResults}
        setSelectedSource={setSelectedSource}
        totalRecords={ecosysChemicalCatalog.stats.pubchemHarvested || ecosysChemicalCatalog.stats.byCidFiles}
      />

      <section className="search-result-grid">
        <SearchSuppliers
          navigateTo={navigateTo}
          setSelectedSource={setSelectedSource}
          suppliers={supplierResults}
        />
        <div className="search-side-stack">
          <SearchBuyers buyers={buyerResults} navigateTo={navigateTo} />
          <SearchPlants navigateTo={navigateTo} plants={plantResults.slice(0, 8)} />
        </div>
      </section>
    </section>
  )
}

function EcosysCatalogPanel({
  ecosysChemicalCatalog,
  isLoading,
  navigateTo,
  records,
  setSelectedSource,
  totalRecords,
}: {
  ecosysChemicalCatalog: EcosysChemicalSnapshot
  isLoading: boolean
  navigateTo: (path: string) => void
  records: EcosysChemicalRecord[]
  setSelectedSource: (source: SourceRecord) => void
  totalRecords: number
}) {
  return (
    <section className="search-section ecosys-section">
      <div className="section-title">
        <div>
          <span className="screen-label">Внутренняя база данных</span>
          <h2>ECOSYS CAS-база</h2>
        </div>
        <small>{isLoading ? 'загружаем CAS-базу' : `${formatCount(totalRecords)} записей PubChem/CAS`}</small>
      </div>
      <div className="ecosys-catalog-list">
        {isLoading ? (
          <article className="ecosys-record-card ecosys-loading-card">
            <div>
              <strong>CAS-база загружается по требованию</strong>
              <span>Тяжёлый ECOSYS snapshot не входит в старт карточек заводов.</span>
            </div>
          </article>
        ) : records.length ? (
          records.map((record) => {
            const visibleSynonyms = record.synonyms
              .filter((synonym) => !record.cas.includes(synonym))
              .slice(0, 4)

            return (
              <article className="ecosys-record-card" key={record.cid}>
                <div>
                  <span className="record-kicker">CID {record.cid}</span>
                  <h3>{record.name}</h3>
                  {record.iupacName && record.iupacName !== record.name ? <p>{record.iupacName}</p> : null}
                </div>
                <div className="material-card-meta">
                  <DataChip label="CAS" value={record.cas[0] ?? 'нет CAS'} />
                  <DataChip label="Формула" value={record.formula ?? 'нет данных'} />
                  <DataChip label="Масса" value={record.molecularWeight ?? 'нет данных'} />
                </div>
                <div className="deal-mini-metrics">
                  {visibleSynonyms.map((synonym) => (
                    <span key={synonym}>{synonym}</span>
                  ))}
                </div>
                <div className="document-grid muted">
                  {record.documents.slice(0, 3).map((documentName) => (
                    <span key={documentName}>{documentName}</span>
                  ))}
                </div>
                <div className="ecosys-card-actions">
                  <button
                    aria-label={`Открыть карточку CID ${record.cid}`}
                    type="button"
                    onClick={() => navigateTo(`/chemicals/${record.cid}`)}
                  >
                    <ArrowRight aria-hidden="true" size={15} />
                    Открыть
                  </button>
                  <button type="button" onClick={() => setSelectedSource(sourceFromEcosysRecord(record, ecosysChemicalCatalog))}>
                    <FileText aria-hidden="true" size={15} />
                    Паспорт ECOSYS
                  </button>
                </div>
              </article>
            )
          })
        ) : (
          <article className="ecosys-record-card empty">
            <h3>Нет записи в текущем фронтовом срезе</h3>
            <p>Нужно продолжить harvest или добавить источник в ECOSYS, затем обновить snapshot.</p>
          </article>
        )}
      </div>
    </section>
  )
}

function EcosysChemicalPage({
  ecosysChemicalCatalog,
  isEcosysLoading,
  navigateTo,
  record,
  setSelectedSource,
}: {
  ecosysChemicalCatalog: EcosysChemicalSnapshot
  isEcosysLoading: boolean
  navigateTo: (path: string) => void
  record: EcosysChemicalRecord | undefined
  setSelectedSource: (source: SourceRecord) => void
}) {
  if (isEcosysLoading) {
    return (
      <section className="page-stack">
        <div className="page-hero not-found-panel">
          <span className="screen-label">ECOSYS</span>
          <h1>Загружаем химический паспорт</h1>
          <p>CAS-база подгружается отдельно, чтобы карточки заводов открывались быстрее.</p>
        </div>
      </section>
    )
  }

  if (!record) {
    return (
      <section className="page-stack">
        <div className="page-hero">
          <span className="screen-label">ECOSYS: химический паспорт</span>
          <h1>Запись не найдена</h1>
          <p>Этого CID нет в текущем фронтовом snapshot. Нужно продолжить harvest и обновить snapshot.</p>
          <button className="primary-action inline" type="button" onClick={() => navigateTo('/search')}>
            Вернуться в поиск
          </button>
        </div>
      </section>
    )
  }

  const source = sourceFromEcosysRecord(record, ecosysChemicalCatalog)
  const linkedMaterial = findMaterialForEcosysChemical(record)
  const usefulSynonyms = record.synonyms.filter((synonym) => !record.cas.includes(synonym)).slice(0, 18)
  const enrichmentTasks = [
    'найти прямых производителей по CAS и официальным страницам продукта',
    'загрузить SDS/MSDS, TDS, COA или паспорт качества от производителя',
    'проверить HS/ТН ВЭД, UN/DG-класс, ограничения перевозки и таможенные документы',
    'связать вещество с закупками заводов, объемами, ценами и ответственными лицами',
    'проверить, где вещество используется как сырье, реагент, растворитель или вспомогательный материал',
  ]

  return (
    <section className="page-stack">
      <div className="page-hero chemical-hero">
        <div>
          <span className="screen-label">ECOSYS: химический паспорт</span>
          <h1>{record.name}</h1>
          <p>
            Внутренняя карточка вещества из ECOSYS. Здесь фиксируются идентификаторы, документы, локальное
            хранилище и задачи, которые превращают справочник CAS в закупочную карточку TenderStart.
          </p>
          <div className="code-row">
            <DataChip label="CID" value={String(record.cid)} />
            <DataChip label="CAS" value={record.cas[0] ?? 'нет CAS'} />
            <DataChip label="Формула" value={record.formula ?? 'нет данных'} />
            <DataChip label="Масса" value={record.molecularWeight ?? 'нет данных'} />
          </div>
        </div>
        <div className="chemical-hero-actions">
          <button className="primary-action inline" type="button" onClick={() => setSelectedSource(source)}>
            <FileText aria-hidden="true" size={16} />
            Паспорт источника
          </button>
          <button className="ghost-action" type="button" onClick={() => navigateTo('/search')}>
            Назад к поиску
          </button>
        </div>
      </div>

      <section className="chemical-detail-grid">
        {linkedMaterial ? (
          <article className="wide chemical-market-card">
            <div>
              <span className="screen-label">TenderStart: рыночная карточка</span>
              <h2>{linkedMaterial.name}</h2>
              <p>
                По этому CAS уже есть рабочая карточка рынка: требования, покупатели, поставщики,
                цены, логистика и сценарий сделки.
              </p>
            </div>
            <div className="chemical-market-metrics">
              <span>{linkedMaterial.suppliers.length} поставщика</span>
              <span>{linkedMaterial.buyers.length} покупателя</span>
              <span>{linkedMaterial.requirement.volume}</span>
            </div>
            <button className="primary-action inline" type="button" onClick={() => navigateTo(`/materials/${linkedMaterial.slug}`)}>
              Открыть рынок {linkedMaterial.name}
            </button>
          </article>
        ) : (
          <article className="wide chemical-market-card">
            <div>
              <span className="screen-label">TenderStart: рыночная карточка</span>
              <h2>Рыночная карточка еще не создана</h2>
              <p>Нужно связать CAS с производителями, покупателями, тендерами, ценами и логистикой.</p>
            </div>
          </article>
        )}

        <article>
          <h2>Идентификаторы</h2>
          <dl className="chemical-fact-list">
            <dt>CAS</dt>
            <dd>{record.cas.length ? record.cas.join(', ') : 'не найден в текущих синонимах PubChem'}</dd>
            <dt>IUPAC</dt>
            <dd>{record.iupacName ?? 'нет данных'}</dd>
            <dt>Формула</dt>
            <dd>{record.formula ?? 'нет данных'}</dd>
            <dt>Молекулярная масса</dt>
            <dd>{record.molecularWeight ?? 'нет данных'}</dd>
          </dl>
        </article>

        <article>
          <h2>Документы</h2>
          <div className="document-grid">
            {record.documents.map((documentName) => (
              <span key={documentName}>{documentName}</span>
            ))}
          </div>
          <p>Файлы должны храниться в ECOSYS с дедупликацией SHA-256, а не просто ссылкой на внешний сайт.</p>
        </article>

        <article>
          <h2>Локальное хранение</h2>
          <dl className="chemical-fact-list">
            <dt>ECOSYS root</dt>
            <dd>{ecosysChemicalCatalog.root}</dd>
            <dt>JSON-досье</dt>
            <dd>{record.storagePath ?? 'нет локального пути'}</dd>
            <dt>Источник</dt>
            <dd>{record.source}</dd>
          </dl>
        </article>

        <article>
          <h2>Синонимы</h2>
          <div className="deal-mini-metrics">
            {usefulSynonyms.length ? usefulSynonyms.map((synonym) => <span key={synonym}>{synonym}</span>) : <span>нет данных</span>}
          </div>
        </article>

        <article className="wide">
          <h2>Что нужно дозагрузить</h2>
          <ul className="chemical-task-list">
            {enrichmentTasks.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ul>
        </article>
      </section>
    </section>
  )
}

function SearchSuppliers({
  navigateTo,
  setSelectedSource,
  suppliers,
}: {
  navigateTo: (path: string) => void
  setSelectedSource: (source: SourceRecord) => void
  suppliers: SupplierHit[]
}) {
  return (
    <article className="search-section">
      <div className="section-title">
        <div>
          <span className="screen-label">Предложение</span>
          <h2>Поставщики</h2>
        </div>
      </div>
      <div className="search-list">
        {suppliers.map((supplier) => (
          <article key={`${supplier.material.slug}-${supplier.slug}`}>
            <div>
              <strong>{supplier.name}</strong>
              <span>{supplier.material.name} · {supplier.country} · {supplier.kind}</span>
              <small>{supplier.grade} · {supplier.spec}</small>
            </div>
            <div className="result-economics">
              <strong>{supplier.landed}</strong>
              <small>{supplier.capacity} · MOQ {supplier.moq}</small>
            </div>
            <div className="result-actions">
              <button type="button" onClick={() => navigateTo(`/materials/${supplier.material.slug}`)}>
                Сравнить
              </button>
              <button
                type="button"
                onClick={() =>
                  setSelectedSource({
                    description: supplier.source,
                    level: supplier.kind === 'Производитель' ? 'verified' : 'lead',
                    name: supplier.name,
                    update: 'нужно обновлять при RFQ',
                    url: supplier.sourceUrl ?? '#',
                  })
                }
              >
                Источник
              </button>
            </div>
          </article>
        ))}
      </div>
    </article>
  )
}

function SearchBuyers({
  buyers,
  navigateTo,
}: {
  buyers: BuyerHit[]
  navigateTo: (path: string) => void
}) {
  return (
    <article className="search-section">
      <div className="section-title">
        <div>
          <span className="screen-label">Спрос</span>
          <h2>Покупатели</h2>
        </div>
      </div>
      <div className="search-list compact">
        {buyers.map((buyer) => (
          <article key={`${buyer.material.slug}-${buyer.slug}`}>
            <div>
              <strong>{buyer.name}</strong>
              <span>{buyer.material.name} · {buyer.region} · {buyer.volume}</span>
              <small>{buyer.status} · {buyer.source}</small>
            </div>
            <button type="button" onClick={() => navigateTo(dealPathForMaterial(buyer.material.slug))}>
              КП
            </button>
          </article>
        ))}
      </div>
    </article>
  )
}

function SearchPlants({
  navigateTo,
  plants,
}: {
  navigateTo: (path: string) => void
  plants: Plant[]
}) {
  return (
    <article className="search-section">
      <div className="section-title">
        <div>
          <span className="screen-label">Производственная база</span>
          <h2>Заводы</h2>
        </div>
        <button type="button" onClick={() => navigateTo('/plants')}>
          Весь реестр
          <ArrowRight aria-hidden="true" size={15} />
        </button>
      </div>
      <div className="search-list compact branded-list">
        {plants.map((plant) => (
          <article key={plant.slug}>
            <PlantLogo plant={plant} />
            <div>
              <strong>{plant.name}</strong>
              <span>{plant.country ?? 'Россия'} · {plant.region} · {plant.industry ?? 'промышленность'}</span>
              <small>{plant.products.slice(0, 3).join(' · ')}</small>
            </div>
            <button type="button" onClick={() => navigateTo(`/plants/${plant.slug}`)}>
              открыть
            </button>
          </article>
        ))}
      </div>
    </article>
  )
}

function matchesMaterial(material: Material, query: string) {
  if (!query) return true
  return [
    material.name,
    material.cas,
    material.hs,
    material.okpd,
    material.description,
    material.requirement.grade,
    ...material.chips,
  ]
    .join(' ')
    .toLowerCase()
    .includes(query)
}

function matchesSupplier(supplier: Supplier, material: Material, query: string) {
  if (!query) return true
  return [
    material.name,
    supplier.name,
    supplier.country,
    supplier.grade,
    supplier.kind,
    supplier.spec,
    supplier.source,
  ]
    .join(' ')
    .toLowerCase()
    .includes(query)
}

function matchesBuyer(buyer: Buyer, material: Material, query: string) {
  if (!query) return true
  return [material.name, buyer.name, buyer.region, buyer.status, buyer.source, buyer.volume]
    .join(' ')
    .toLowerCase()
    .includes(query)
}

function matchesPlant(plant: Plant, query: string) {
  if (!query) return true
  return [
    plant.address,
    plant.name,
    plant.country,
    plant.region,
    plant.city,
    plant.industry,
    plant.website,
    plant.logoLabel,
    plant.source,
    ...(plant.phones ?? []),
    ...(plant.emails ?? []),
    ...plant.products,
    ...(plant.productionItems ?? []).flatMap((item) => [
      item.name,
      item.spec,
      item.volume,
      item.status,
      item.source,
      item.note,
      item.cas,
      item.formula,
      item.materialSlug,
      item.chemicalStatus,
      item.responsible?.name,
      item.responsible?.role,
      item.responsible?.phone,
      item.responsible?.email,
      ...(item.standards ?? []),
      ...(item.documents ?? []),
    ]),
    ...plant.equipment,
    ...plant.logistics,
    ...(plant.purchaseCategories ?? []),
    ...(plant.demandItems ?? []).flatMap((item) => [
      item.name,
      item.spec,
      item.volume,
      item.status,
      item.source,
      item.note,
      item.cas,
      item.formula,
      item.materialSlug,
      item.chemicalStatus,
      item.responsible?.name,
      item.responsible?.role,
      item.responsible?.phone,
      item.responsible?.email,
      ...(item.standards ?? []),
      ...(item.documents ?? []),
    ]),
    ...(plant.procurementContacts ?? []),
    ...(plant.procurementEvidence ?? []).flatMap((evidence) => [
      evidence.title,
      evidence.source,
      evidence.status,
      evidence.note,
      ...evidence.documents,
      ...evidence.inferredNeeds,
    ]),
    ...plant.needs.flatMap((need) => [need.materialName, need.spec, need.status, need.note]),
  ]
    .join(' ')
    .toLowerCase()
    .includes(query)
}

function sortPlantSearchResults(plants: Plant[], query: string) {
  if (!query) return plants
  return [...plants].sort((a, b) => plantSearchScore(a, query) - plantSearchScore(b, query) || a.name.localeCompare(b.name, 'ru'))
}

function plantSearchScore(plant: Plant, query: string) {
  const name = plant.name.toLowerCase()
  const legalName = plant.legalName?.toLowerCase() ?? ''
  const slug = plant.slug.toLowerCase()
  const products = plant.products.join(' ').toLowerCase()
  const categories = (plant.purchaseCategories ?? []).join(' ').toLowerCase()

  if (name === query || legalName === query) return 0
  if (name.includes(query) || legalName.includes(query)) return 1
  if (slug.includes(query)) return 2
  if (products.includes(query)) return 3
  if (categories.includes(query)) return 4
  return 5
}

function suggestPlantMatches(slug: string, plantCatalog: Plant[]) {
  const source = massPlantSourceForSlug(slug)
  const tokens = plantSuggestionTokens(slug)
  const candidates = plantCatalog.filter((plant) => plantMatchesMassSource(plant, source) && plant.slug !== slug)
  const scoredCandidates = candidates
    .map((plant) => ({ plant, score: plantSuggestionScore(plant, tokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.plant.name.localeCompare(b.plant.name, 'ru'))
    .map(({ plant }) => plant)

  return (scoredCandidates.length ? scoredCandidates : candidates.sort(sortPlantDirectoryItems)).slice(0, 5)
}

function plantSuggestionTokens(slug: string) {
  const ignored = new Set(['asia', 'cis', 'demo', 'eu', 'mass', 'no', 'plant', 'slug', 'such'])
  return slug
    .toLowerCase()
    .split(/[^a-zа-яё0-9]+/gi)
    .filter((token) => token.length > 2 && !ignored.has(token))
}

function plantSuggestionScore(plant: Plant, tokens: string[]) {
  if (!tokens.length) return 0

  const haystack = [
    plant.slug,
    plant.name,
    plant.legalName,
    plant.country,
    plant.region,
    plant.city,
    plant.industry,
    ...plant.products,
    ...(plant.purchaseCategories ?? []),
  ]
    .join(' ')
    .toLowerCase()

  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0)
}

function plantMatchesMassSource(plant: Plant, source: MassPlantSource) {
  if (source === 'asia') return plant.slug.startsWith('asia-')
  if (source === 'cis') return plant.slug.startsWith('cis-')
  if (source === 'eu') return plant.slug.startsWith('eu-')
  if (source === 'russia') return !plant.slug.startsWith('asia-') && !plant.slug.startsWith('cis-') && !plant.slug.startsWith('eu-')
  return true
}

function matchesEcosysChemical(record: EcosysChemicalRecord, query: string) {
  if (!query) return true
  return [
    record.name,
    `cid ${record.cid}`,
    String(record.cid),
    record.formula,
    record.iupacName,
    record.molecularWeight,
    record.source,
    record.status,
    record.storagePath,
    ...record.cas,
    ...record.synonyms,
    ...record.documents,
  ]
    .join(' ')
    .toLowerCase()
    .includes(query)
}

function findEcosysChemicalRecord(slug: string, ecosysRecords: EcosysChemicalRecord[]) {
  const cid = Number(slug)
  if (!Number.isFinite(cid)) return undefined
  return ecosysRecords.find((record) => record.cid === cid)
}

function findEcosysChemicalForMaterial(material: Material, ecosysRecords: EcosysChemicalRecord[]) {
  return ecosysRecords.find((record) => record.cas.includes(material.cas))
}

function findMaterialForEcosysChemical(record: EcosysChemicalRecord) {
  return materialCatalog.find((material) => record.cas.includes(material.cas))
}

function formatCount(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function MaterialWorkspace({
  ecosysRecords,
  material,
  navigateTo,
  onOpenDeal,
  selectedSupplier,
  selectedSupplierSlug,
  setSelectedSource,
  setSelectedSupplierSlug,
}: {
  ecosysRecords: EcosysChemicalRecord[]
  material: Material
  navigateTo: (path: string) => void
  onOpenDeal: () => void
  selectedSupplier?: Supplier
  selectedSupplierSlug: string
  setSelectedSource: (source: SourceRecord) => void
  setSelectedSupplierSlug: (slug: string) => void
}) {
  const [supplierMode, setSupplierMode] = useState<SupplierMode>('best')
  const rankedSuppliers = sortSuppliers(material.suppliers, supplierMode)
  const activeSupplierSlug = rankedSuppliers.some((supplier) => supplier.slug === selectedSupplierSlug)
    ? selectedSupplierSlug
    : rankedSuppliers[0]?.slug

  return (
    <div className="workspace-grid">
      <section className="workspace-flow">
        <ProcurementHero
          ecosysRecords={ecosysRecords}
          material={material}
          navigateTo={navigateTo}
          setSelectedSource={setSelectedSource}
        />
        <KpiStrip material={material} />
        <RequirementBoard material={material} />
      </section>
      <AiDealPanel
        material={material}
        onOpenDeal={onOpenDeal}
        selectedSupplier={selectedSupplier}
        setSelectedSource={setSelectedSource}
      />
      <section className="comparison-flow">
        <SupplierTabs
          mode={supplierMode}
          setMode={setSupplierMode}
          supplierCount={material.suppliers.filter((supplier) => !isSupplierSearchPlaceholder(supplier)).length}
        />
        <SupplierTable
          activeSupplierSlug={activeSupplierSlug}
          material={material}
          mode={supplierMode}
          navigateTo={navigateTo}
          rankedSuppliers={rankedSuppliers}
          setSelectedSource={setSelectedSource}
          setSelectedSupplierSlug={setSelectedSupplierSlug}
        />
        <MarketLowerGrid material={material} navigateTo={navigateTo} setSelectedSource={setSelectedSource} />
      </section>
    </div>
  )
}

function ProcurementHero({
  ecosysRecords,
  material,
  navigateTo,
  setSelectedSource,
}: {
  ecosysRecords: EcosysChemicalRecord[]
  material: Material
  navigateTo: (path: string) => void
  setSelectedSource: (source: SourceRecord) => void
}) {
  const ecosysRecord = findEcosysChemicalForMaterial(material, ecosysRecords)

  return (
    <section className="procurement-hero">
      <div>
        <span className="screen-label">Поиск сырья → карточка вещества → сделка</span>
        <h1>{material.name}</h1>
        <p>{material.description}</p>
        <div className="code-row">
          <DataChip label="CAS" value={material.cas} />
          <DataChip label="ТН ВЭД" value={material.hs} />
          <DataChip label="ОКПД2" value={material.okpd} />
          <DataChip label="Перевозка" value={material.un} />
        </div>
      </div>
      <div className="hero-source-card">
        <strong>Доверие к данным</strong>
        <span>цены и объемы разделены по типу источника</span>
        {ecosysRecord ? (
          <button
            type="button"
            onClick={() => navigateTo(`/chemicals/${ecosysRecord.cid}`)}
          >
            <FlaskConical aria-hidden="true" size={15} />
            ECOSYS паспорт CAS {material.cas}
          </button>
        ) : null}
        <button type="button" onClick={() => setSelectedSource(material.sources[0] ?? sourceDirectory[0])}>
          <ExternalLink aria-hidden="true" size={15} />
          источник
        </button>
      </div>
    </section>
  )
}

function DataChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="data-chip">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  )
}

function KpiStrip({ material }: { material: Material }) {
  return (
    <section className="kpi-strip">
      {material.kpis.map((item) => (
        <article className="deal-kpi" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.note}</small>
        </article>
      ))}
    </section>
  )
}

function RequirementBoard({ material }: { material: Material }) {
  const requirement = material.requirement

  return (
    <section className="requirement-board">
      <div className="section-title">
        <div>
          <span className="screen-label">Заявка на закупку</span>
          <h2>{requirement.grade}</h2>
        </div>
        <strong>{requirement.volume}</strong>
      </div>
      <div className="requirement-grid">
        <Fact label="Характеристики" value={requirement.purity} />
        <Fact label="Форма / упаковка" value={requirement.form} />
        <Fact label="Доставка" value={requirement.destination} />
        <Fact label="Период" value={requirement.period} />
        <Fact label="Документы" value={requirement.docs} />
        <Fact label="Бюджет" value={requirement.budget} />
      </div>
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SupplierTabs({
  mode,
  setMode,
  supplierCount,
}: {
  mode: SupplierMode
  setMode: (mode: SupplierMode) => void
  supplierCount: number
}) {
  const tabs: Array<{ label: string; mode: SupplierMode }> = [
    { label: `Лучшие поставщики (${supplierCount})`, mode: 'best' },
    { label: 'Самая низкая цена', mode: 'price' },
    { label: 'Самый надежный вариант', mode: 'reliable' },
  ]

  return (
    <div className="supplier-tabs" role="tablist" aria-label="Режим подбора поставщиков">
      {tabs.map((tab) => (
        <button
          aria-selected={tab.mode === mode}
          className={tab.mode === mode ? 'active' : ''}
          key={tab.mode}
          role="tab"
          type="button"
          onClick={() => setMode(tab.mode)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function SupplierTable({
  activeSupplierSlug,
  material,
  mode,
  navigateTo,
  rankedSuppliers,
  setSelectedSource,
  setSelectedSupplierSlug,
}: {
  activeSupplierSlug?: string
  material: Material
  mode: SupplierMode
  navigateTo: (path: string) => void
  rankedSuppliers: Supplier[]
  setSelectedSource: (source: SourceRecord) => void
  setSelectedSupplierSlug: (slug: string) => void
}) {
  const hasOnlySearchPlaceholder =
    rankedSuppliers.length === 1 && isSupplierSearchPlaceholder(rankedSuppliers[0])

  return (
    <section className="table-panel">
      <div className="section-title">
        <div>
          <span className="screen-label">Подбор под требования · {supplierModeLabel(mode)}</span>
          <h2>Сравнение поставщиков</h2>
        </div>
        <span className="confidence-pill">
          <ShieldCheck aria-hidden="true" size={16} />
          проверка производителя отдельно
        </span>
      </div>
      {hasOnlySearchPlaceholder ? (
        <SupplierResearchState
          material={material}
          navigateTo={navigateTo}
          setSelectedSource={setSelectedSource}
          supplier={rankedSuppliers[0]}
        />
      ) : null}
      <div className="table-scroll">
        <table aria-label={`Сравнение поставщиков ${material.slug === 'sulfur' ? 'серы' : material.name.toLowerCase()}`}>
          <thead>
            <tr>
              <th>Поставщик</th>
              <th>Страна / роль</th>
              <th>Характеристики</th>
              <th>Цена</th>
              <th>Объем</th>
              <th>Логистика</th>
              <th>Документы / риск</th>
              <th>Источник</th>
            </tr>
          </thead>
          <tbody>
            {rankedSuppliers.map((supplier) => (
              <tr
                className={supplier.slug === activeSupplierSlug ? 'selected' : ''}
                key={supplier.slug}
                onClick={() => setSelectedSupplierSlug(supplier.slug)}
              >
                <td>
                  <button
                    aria-label={`Выбрать ${supplier.name}`}
                    className={supplier.slug === activeSupplierSlug ? 'row-select active' : 'row-select'}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedSupplierSlug(supplier.slug)
                    }}
                  />
                  <strong>{supplier.name}</strong>
                  <small>{supplier.reliability} · уверенность {supplier.confidence}</small>
                </td>
                <td>
                  <strong>{supplier.country}</strong>
                  <small>{supplier.kind}</small>
                </td>
                <td>
                  <strong>{supplier.grade}</strong>
                  <small>{supplier.spec}</small>
                </td>
                <td className="numeric">
                  <strong>{supplier.landed}</strong>
                  <small>до склада, FOB {supplier.fob}</small>
                </td>
                <td>
                  <strong>{supplier.capacity}</strong>
                  <small>MOQ {supplier.moq}</small>
                </td>
                <td>
                  <strong>{supplier.route}</strong>
                  <small>{supplier.leadTime}</small>
                </td>
                <td>
                  <div className="doc-list">
                    {supplier.docs.map((doc) => (
                      <span key={doc}>{doc}</span>
                    ))}
                  </div>
                  <Risk risk={supplier.risk} />
                </td>
                <td>
                  <button
                    className="source-button"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedSource({
                        description: supplier.source,
                        level: supplier.kind === 'Производитель' ? 'verified' : 'lead',
                        name: supplier.name,
                        update: 'нужно обновлять при RFQ',
                        url: supplier.sourceUrl ?? '#',
                      })
                    }}
                  >
                    Источник
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SupplierResearchState({
  material,
  navigateTo,
  setSelectedSource,
  supplier,
}: {
  material: Material
  navigateTo: (path: string) => void
  setSelectedSource: (source: SourceRecord) => void
  supplier: Supplier
}) {
  const producerSearchSource =
    sourceDirectory.find((source) => source.name === 'S&P Directory of Chemical Producers') ??
    sourceDirectory.find((source) => source.name === 'ChemicalBook') ??
    sourceDirectory[0]

  return (
    <div className="supplier-research-state">
      <div>
        <span className="screen-label">Производители еще не подтверждены</span>
        <h3>{material.name}: нужен поиск прямых производителей</h3>
        <p>
          В карточке уже есть требования СНХЗ, CAS/формула и пакет документов. Следующий шаг - найти именно заводы,
          отсеять трейдеров и запросить COA/MSDS/TDS, мощность, MOQ, цену и маршрут до Стерлитамака.
        </p>
      </div>
      <div className="research-checks">
        {[
          `Поиск по CAS: ${material.cas}`,
          `Проверить S&P/CAS/ChemicalBook/BuyersGuideChem`,
          `Найти сайт производителя и продуктовую страницу`,
          `Запросить ${supplier.docs.join(', ')}`,
          `Сравнить маршрут: Индия / Китай / РФ / СНГ`,
        ].map((item) => (
          <span key={item}>
            <CheckCircle2 aria-hidden="true" size={15} />
            {item}
          </span>
        ))}
      </div>
      <div className="research-actions">
        <button type="button" onClick={() => setSelectedSource(producerSearchSource)}>
          <Search aria-hidden="true" size={15} />
          Показать источники поиска
        </button>
        <button type="button" onClick={() => navigateTo('/plants/snhz')}>
          <Building2 aria-hidden="true" size={15} />
          Открыть потребность СНХЗ
        </button>
        <button type="button" onClick={() => navigateTo(`/deals/${material.slug}-import-rfq`)}>
          <BriefcaseBusiness aria-hidden="true" size={15} />
          Черновик RFQ
        </button>
      </div>
    </div>
  )
}

function sortSuppliers(suppliers: Supplier[], mode: SupplierMode) {
  return [...suppliers].sort((left, right) => {
    if (mode === 'price') {
      return priceRank(left) - priceRank(right) || confidenceRank(right) - confidenceRank(left)
    }
    if (mode === 'reliable') {
      return reliabilityRank(right) - reliabilityRank(left) || riskRank(left) - riskRank(right)
    }
    return confidenceRank(right) - confidenceRank(left) || riskRank(left) - riskRank(right)
  })
}

function supplierModeLabel(mode: SupplierMode) {
  return {
    best: 'баланс цены, риска и готовности',
    price: 'сначала дешевле',
    reliable: 'сначала надежнее',
  }[mode]
}

function isSupplierSearchPlaceholder(supplier: Supplier) {
  return supplier.slug.endsWith('-supplier-search') || supplier.name.startsWith('TenderStart: поиск')
}

function confidenceRank(supplier: Supplier) {
  return Number.parseFloat(supplier.confidence.replace(',', '.')) || 0
}

function reliabilityRank(supplier: Supplier) {
  if (supplier.kind === 'Производитель') return 30 + confidenceRank(supplier)
  if (supplier.kind === 'Трейдер') return 10 + confidenceRank(supplier)
  return confidenceRank(supplier)
}

function riskRank(supplier: Supplier) {
  if (supplier.risk === 'Низкий') return 1
  if (supplier.risk === 'Средний') return 2
  return 3
}

function priceRank(supplier: Supplier) {
  const landedPrice = firstNumber(supplier.landed)
  const fobPrice = firstNumber(supplier.fob)
  return landedPrice ?? fobPrice ?? 1_000_000
}

function firstNumber(value: string) {
  const match = value.replace(/\s+/g, '').match(/(\d+(?:[.,]\d+)?)/)
  return match ? Number.parseFloat(match[1].replace(',', '.')) : null
}

function Risk({ risk }: { risk: Supplier['risk'] }) {
  return <span className={`risk-badge ${risk.toLowerCase()}`}>{risk}</span>
}

function MarketLowerGrid({
  material,
  navigateTo,
  setSelectedSource,
}: {
  material: Material
  navigateTo: (path: string) => void
  setSelectedSource: (source: SourceRecord) => void
}) {
  return (
    <section className="market-lower-grid">
      <article className="buyers-panel">
        <div className="section-title">
          <div>
            <span className="screen-label">Спрос</span>
            <h2>Кому может быть нужна</h2>
          </div>
          <button type="button" onClick={() => navigateTo(buyerPathForMaterial(material))}>
            Открыть покупателя
            <ArrowRight aria-hidden="true" size={15} />
          </button>
        </div>
        <div className="buyer-list">
          {material.buyers.map((buyer) => (
            <article key={buyer.slug}>
              <strong>{buyer.name}</strong>
              <span>{buyer.region}</span>
              <small>{buyer.volume}</small>
              <small>{buyer.status} · {buyer.source}</small>
              {buyer.sourceUrl ? (
                <InlineSourceButton source={sourceFromBuyer(buyer, material)} setSelectedSource={setSelectedSource} />
              ) : null}
              <button className="source-button compact" type="button" onClick={() => navigateTo(buyerPathForBuyer(buyer))}>
                карточка покупателя
              </button>
            </article>
          ))}
        </div>
      </article>
      <article className="route-panel">
        <div className="section-title">
          <div>
            <span className="screen-label">Логистика</span>
            <h2>Маршруты до склада</h2>
          </div>
          <Ship aria-hidden="true" size={22} />
        </div>
        <div className="route-map">
          {material.logistics.map((route) => (
            <div className="route-line" key={route.label}>
              <span>{route.label}</span>
              <strong>{route.value}</strong>
            </div>
          ))}
        </div>
      </article>
      <article className="documents-panel">
        <div className="section-title">
          <div>
            <span className="screen-label">Документы</span>
            <h2>Что запросить сразу</h2>
          </div>
          <FileText aria-hidden="true" size={22} />
        </div>
        <div className="document-grid">
          {material.documents.map((document) => (
            <span key={document}>{document}</span>
          ))}
        </div>
      </article>
    </section>
  )
}

function AiDealPanel({
  material,
  onOpenDeal,
  selectedSupplier,
  setSelectedSource,
}: {
  material: Material
  onOpenDeal: () => void
  selectedSupplier?: Supplier
  setSelectedSource: (source: SourceRecord) => void
}) {
  return (
    <aside className="ai-deal-panel">
      <div className="ai-title">
        <Sparkles aria-hidden="true" size={20} />
        <div>
          <span>AI-аналитик сделки</span>
          <strong>{material.requirement.grade}</strong>
        </div>
      </div>
      <article className="ai-recommendation">
        <span>Рекомендуемый старт</span>
        <h2>{selectedSupplier?.name ?? 'Reliance Industries'}</h2>
        <p>
          Начать с RFQ на {material.requirement.volume}, запросить COA по партии, SDS/MSDS,
          упаковку и Incoterms до {material.requirement.destination}.
        </p>
      </article>
      <div className="ai-checklist">
        {[
          'Проверить, производитель это или трейдер',
          'Запросить цену на MOQ и тестовую партию',
          'Сравнить маршрут с Казахстаном',
          'Собрать КП для покупателя в РФ',
        ].map((item) => (
          <span key={item}>
            <CheckCircle2 aria-hidden="true" size={16} />
            {item}
          </span>
        ))}
      </div>
      <article className="deal-economics">
        <span>Оценка экономики</span>
        <strong>{selectedSupplier?.landed ?? '$174/т'}</strong>
        <small>цена до склада против бюджета {material.requirement.budget}</small>
      </article>
      <button className="primary-action" type="button" onClick={onOpenDeal}>
        <Mail aria-hidden="true" size={18} />
        Собрать сделку через TenderStart
      </button>
      <button
        className="ghost-action"
        type="button"
        onClick={() => setSelectedSource(material.sources[0] ?? sourceDirectory[0])}
      >
        Показать источники вывода
      </button>
    </aside>
  )
}

function DealRoom({
  material,
  navigateTo,
  setSelectedSource,
}: {
  material: Material
  navigateTo: (path: string) => void
  setSelectedSource: (source: SourceRecord) => void
}) {
  const primaryBuyer = material.buyers[0]
  const primaryBuyerPath = primaryBuyer ? buyerPathForBuyer(primaryBuyer) : buyerPathForMaterial(material)
  const dealHeading = material.slug === 'sulfur' ? 'Deal room: сера для Уфы' : `Deal room: ${material.name}`
  const rfqDraftSource: SourceRecord = {
    description: `Внутренний черновик RFQ по ${material.name}: потребность, ТЗ, документы, shortlist поставщиков и логистика собраны в этой комнате. Следующий реальный шаг - отправка запроса производителям и фиксация ответов в таблице сравнения.`,
    level: 'estimated',
    name: `RFQ внутри TenderStart: ${material.name}`,
    update: 'демо-режим; боевой модуль отправки подключается после CRM/почты',
    url: `tenderstart://rfq/${material.slug}`,
  }
  const statusSteps =
    material.slug === 'ferric-chloride'
      ? [
          'RFQ поставщикам',
          'Запросить COA/MSDS/TDS у 5 индийских производителей',
          'Проверить ТН ВЭД, пошлину и НДС',
          'Собрать ставку море + порт + доставка до завода',
          'КП покупателю и договор первой поставки',
        ]
      : ['RFQ поставщикам', 'COA/SDS/MSDS', 'Ставка логистики', 'КП покупателю', 'Контракт и первая поставка']

  return (
    <section className="page-stack">
      <div className="page-hero">
        <span className="screen-label">Сделка</span>
        <h1>{dealHeading}</h1>
        <p>
          Рабочая комната для RFQ: покупатель, поставщики, логистика, документы, таможня и расчет цены до склада.
          Сейчас это демо-слой, который дальше подключается к ежедневному парсингу закупок и RFQ.
        </p>
        <div className="page-action-row">
          <button className="primary-action inline" type="button" onClick={() => setSelectedSource(rfqDraftSource)}>
            <Mail aria-hidden="true" size={18} />
            Отправить RFQ (демо)
          </button>
          <button className="ghost-action" type="button" onClick={() => navigateTo(`/map/${material.slug}`)}>
            <Map aria-hidden="true" size={18} />
            Построить маршрут
          </button>
          <button className="ghost-action" type="button" onClick={() => navigateTo(primaryBuyerPath)}>
            <Building2 aria-hidden="true" size={18} />
            Карточка покупателя
          </button>
          <button className="ghost-action" type="button" onClick={() => navigateTo(`/materials/${material.slug}`)}>
            <Warehouse aria-hidden="true" size={18} />
            Сравнить поставщиков
          </button>
        </div>
      </div>
      <section className="rfq-snapshot-grid" aria-label="Снимок RFQ">
        {[
          {
            title: 'Потребность',
            value: primaryBuyer ? primaryBuyer.volume : material.requirement.volume,
            note: primaryBuyer ? `${primaryBuyer.name}, ${primaryBuyer.region}` : material.requirement.destination,
          },
          {
            title: 'Характеристики',
            value: material.requirement.grade,
            note: material.documents.slice(0, 3).join(' / '),
          },
          {
            title: 'Бюджет',
            value: material.requirement.budget,
            note: 'сравниваем с ценой после логистики',
          },
          {
            title: 'Маршрут',
            value: material.requirement.destination,
            note: material.logistics[0]?.value ?? 'ставка уточняется',
          },
        ].map((card) => (
          <article key={card.title}>
            <span>{card.title}</span>
            <strong>{card.value}</strong>
            <small>{card.note}</small>
          </article>
        ))}
      </section>
      <section className="rfq-workbench" aria-label="Рабочий стол RFQ">
        <div className="section-title">
          <div>
            <span className="screen-label">TenderStart deal room</span>
            <h2>Что агент должен собрать перед сделкой</h2>
          </div>
          <div className="section-action-row">
            <button type="button" onClick={() => setSelectedSource(material.sources[0] ?? sourceDirectory[0])}>
              <FileText aria-hidden="true" size={16} />
              Досье потребности
            </button>
            <button type="button" onClick={() => navigateTo('/producer/register')}>
              <UserRoundCheck aria-hidden="true" size={16} />
              Производитель может подтвердить себя
            </button>
          </div>
        </div>
        <div className="rfq-task-grid">
          {[
            ['Документы внутри TenderStart', 'ТЗ, COA, SDS/MSDS, TDS, проект договора, условия поставки.'],
            ['Отсев посредников', 'Проверяем сайт, регистрацию, экспортную историю и совпадение документов с юрлицом.'],
            ['Цена до завода', 'FOB/CIF + фрахт + порт + брокер + пошлина + НДС + внутренняя доставка.'],
            ['Следующий шаг', 'Отправить RFQ 3-5 производителям и сравнить ответы в таблице.'],
          ].map(([title, text]) => (
            <article key={title}>
              <CheckCircle2 aria-hidden="true" size={18} />
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <div className="deal-room-grid">
        <article>
          <h2>Покупатель</h2>
          <ul>
            <li>{primaryBuyer ? `${primaryBuyer.name}: ${primaryBuyer.volume}` : material.requirement.volume}</li>
            <li>{primaryBuyer ? primaryBuyer.region : material.requirement.destination}</li>
            <li>{primaryBuyer ? primaryBuyer.terms : material.requirement.budget}</li>
          </ul>
        </article>
        <article>
          <h2>Статус</h2>
          <ol>
            {statusSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>
        <article>
          <h2>Таможня и экономика</h2>
          <p>ТН ВЭД {material.hs}</p>
          <p>{material.un}</p>
          <p>Бюджет: {material.requirement.budget}</p>
          <p>Целевой объем: {material.requirement.volume}</p>
          <p>Маржа считается после подтверждения RFQ, фрахта, брокера, пошлины и НДС.</p>
        </article>
        <article>
          <h2>Shortlist поставщиков</h2>
          <ul>
            {material.suppliers.slice(0, 5).map((supplier) => (
              <li key={supplier.slug}>
                {supplier.name}: {supplier.grade}, {supplier.landed}
                <button
                  className="source-button compact"
                  type="button"
                  onClick={() =>
                    setSelectedSource({
                      description: supplier.source,
                      level: supplier.kind === 'Производитель' ? 'verified' : 'lead',
                      name: supplier.name,
                      update: 'нужно обновлять при RFQ',
                      url: supplier.sourceUrl ?? '#',
                    })
                  }
                >
                  досье
                </button>
              </li>
            ))}
          </ul>
        </article>
        <article>
          <h2>Маршрут</h2>
          <ul>
            {material.logistics.map((route) => (
              <li key={route.label}>
                {route.label}: {route.value}
              </li>
            ))}
          </ul>
        </article>
        <article>
          <h2>Документы</h2>
          <ul>
            {material.documents.map((documentName) => (
              <li key={documentName}>{documentName}</li>
            ))}
          </ul>
        </article>
      </div>
      <button className="primary-action inline" type="button" onClick={() => navigateTo(`/materials/${material.slug}`)}>
        Вернуться к поставщикам
      </button>
    </section>
  )
}

function ImportMapPage({
  material,
  navigateTo,
  setSelectedSource,
}: {
  material: Material
  navigateTo: (path: string) => void
  setSelectedSource: (source: SourceRecord) => void
}) {
  const confirmedSuppliers = material.suppliers.filter((supplier) => !isSupplierSearchPlaceholder(supplier))
  const routeSource =
    sourceDirectory.find((source) => source.name.includes('SeaRates')) ??
    material.sources.find((source) => source.level !== 'lead') ??
    sourceDirectory[0]

  return (
    <section className="page-stack">
      <div className="page-hero map-hero">
        <span className="screen-label">Карта сделки</span>
        <h1>Импортозамещение и маршруты: {material.name}</h1>
        <p>
          Один экран для демонстрации рынка: кто производит сырье, кому оно нужно, какой маршрут считать и какие
          документы запросить до RFQ.
        </p>
        <div className="map-actions">
          <button className="primary-action inline" type="button" onClick={() => navigateTo(dealPathForMaterial(material.slug))}>
            Собрать RFQ
          </button>
          <button className="ghost-action" type="button" onClick={() => navigateTo(`/materials/${material.slug}`)}>
            Сравнить поставщиков
          </button>
          <button className="ghost-action" type="button" onClick={() => setSelectedSource(routeSource)}>
            Источник логистики
          </button>
        </div>
      </div>

      <section className="map-board" aria-label={`Карта поставок ${material.name}`}>
        <article className="map-lane-card">
          <span className="screen-label">Поставщики</span>
          <h2>Где искать прямой завод</h2>
          <div className="map-point-list">
            {confirmedSuppliers.length ? (
              confirmedSuppliers.slice(0, 5).map((supplier) => (
                <button key={supplier.slug} type="button" onClick={() => navigateTo(`/suppliers/${supplier.slug}`)}>
                  <strong>{supplier.name}</strong>
                  <span>{supplier.country} · {supplier.capacity}</span>
                  <small>{supplier.grade} · {supplier.landed}</small>
                </button>
              ))
            ) : (
              <div className="map-empty">
                <strong>Производители не подтверждены</strong>
                <span>Нужно пройти CAS/справочники/сайт производителя и запросить COA/MSDS.</span>
              </div>
            )}
          </div>
        </article>

        <article className="map-lane-card map-center-card">
          <span className="screen-label">Вещество</span>
          <h2>{material.name}</h2>
          <div className="map-material-core">
            <strong>CAS {material.cas || 'нужно уточнить'}</strong>
            <span>{material.requirement.grade}</span>
            <span>{material.requirement.volume} · {material.requirement.destination}</span>
          </div>
          <div className="document-grid">
            {material.documents.slice(0, 8).map((documentName) => (
              <span key={documentName}>{documentName}</span>
            ))}
          </div>
        </article>

        <article className="map-lane-card">
          <span className="screen-label">Потребители</span>
          <h2>Кому нужно</h2>
          <div className="map-point-list">
            {material.buyers.slice(0, 5).map((buyer) => (
              <button key={buyer.slug} type="button" onClick={() => navigateTo(buyerPathForBuyer(buyer))}>
                <strong>{buyer.name}</strong>
                <span>{buyer.region} · {buyer.volume}</span>
                <small>{buyer.status}</small>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="map-route-grid">
        {material.logistics.map((route) => (
          <article key={route.label}>
            <span>{route.label}</span>
            <strong>{route.value}</strong>
          </article>
        ))}
      </section>
    </section>
  )
}

function SourcesPage() {
  return (
    <section className="page-stack">
      <div className="page-hero">
        <span className="screen-label">Доверие</span>
        <h1>Источники и доверие</h1>
        <p>Каждая цена, объем, контакт и AI-вывод должны иметь источник, дату обновления и уровень уверенности.</p>
      </div>
      <DataStandardPanel />
      <AsiaCoveragePanel snapshot={asiaCoverage} />
      <div className="sources-grid">
        {sourceDirectory.map((source) => (
          <article className="source-card" key={source.name}>
            <span className={`source-level ${source.level}`}>{sourceLevelLabel(source.level)}</span>
            <h2>{source.name}</h2>
            <p>{source.description}</p>
            <small>{source.update}</small>
            <a className="source-card-link" href={source.url} rel="noreferrer" target="_blank">
              Проверить источник
              <ExternalLink aria-hidden="true" size={14} />
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}

function DataStandardPanel() {
  const steps = [
    {
      title: 'Lead',
      value: 'найден завод',
      note: 'Есть реестр, сайт или карта. Это еще не подтвержденная закупка и не цена.',
    },
    {
      title: 'Estimated',
      value: 'есть расчет',
      note: 'Характеристики, цена или логистика оценены по открытым данным и требуют проверки.',
    },
    {
      title: 'Verified',
      value: 'есть документ',
      note: 'Подтверждено тендером, RFQ, COA/MSDS/TDS, контрактом, реестром или сайтом завода.',
    },
  ]

  return (
    <section className="data-standard-panel" aria-labelledby="data-standard-title">
      <div className="section-title">
        <div>
          <span className="screen-label">Стандарт</span>
          <h2 id="data-standard-title">Как данные попадают в карточку</h2>
        </div>
        <strong>plant-profile-v1</strong>
      </div>
      <div className="standard-step-grid">
        {steps.map((step) => (
          <article key={step.title}>
            <span>{step.title}</span>
            <strong>{step.value}</strong>
            <small>{step.note}</small>
          </article>
        ))}
      </div>
      <div className="standard-field-row" aria-label="Обязательные поля карточки завода">
        {[
          'что производит',
          'что закупает',
          'характеристики',
          'объем',
          'документы',
          'контакты',
          'логистика',
          'источник аудита',
        ].map((field) => (
          <span key={field}>{field}</span>
        ))}
      </div>
    </section>
  )
}

function TradeRulesPage() {
  const priorityCountries = ['IN', 'CN', 'RU', 'US', 'DE', 'TR', 'AE', 'KZ']
    .map((code) => tradeRuleProfiles.find((profile) => profile.code === code))
    .filter(Boolean)

  const byRegion = tradeRuleProfiles.reduce<Record<string, number>>((acc, profile) => {
    acc[profile.regionGroup] = (acc[profile.regionGroup] ?? 0) + 1
    return acc
  }, {})

  return (
    <section className="page-stack">
      <div className="page-hero">
        <span className="screen-label">Trade compliance</span>
        <h1>Пошлины, налоги и правила</h1>
        <p>
          Слой для расчета импорта: HS/ТН ВЭД, страна происхождения, пошлина, НДС/GST/VAT, документы, ограничения,
          опасные грузы и источники проверки по каждой стране.
        </p>
      </div>

      <section className="search-summary-grid">
        <article>
          <span>Стран и территорий</span>
          <strong>{tradeRuleProfiles.length}</strong>
          <small>первичный framework-слой по ISO-кодам</small>
        </article>
        <article>
          <span>Приоритетных маршрутов</span>
          <strong>{priorityTradeLanes.length}</strong>
          <small>Индия/Китай/Казахстан → РФ</small>
        </article>
        <article>
          <span>Официальных баз</span>
          <strong>{globalComplianceSources.length}</strong>
          <small>WCO, WTO, WITS, ITC, Comtrade</small>
        </article>
        <article>
          <span>Региональных групп</span>
          <strong>{Object.keys(byRegion).length}</strong>
          <small>ЕС, ЕАЭС, Азия, Америка, Африка</small>
        </article>
      </section>

      <section className="rules-layout">
        <article className="rules-panel">
          <div className="section-title">
            <div>
              <span className="screen-label">Маршруты</span>
              <h2>Что проверять перед сделкой</h2>
            </div>
          </div>
          <div className="rules-lane-list">
            {priorityTradeLanes.map((lane) => (
              <article className="rules-lane-card" key={lane.title}>
                <h3>{lane.title}</h3>
                {lane.title.includes('Сера') && lane.title.includes('Индия') && lane.title.includes('Россия') ? <strong>Индия → Россия</strong> : null}
                <p>{lane.taxFormula}</p>
                <ul>
                  {lane.steps.slice(0, 4).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
                <div className="rule-tags">
                  {lane.documents.slice(0, 8).map((documentName) => (
                    <span key={documentName}>{documentName}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="rules-panel">
          <div className="section-title">
            <div>
              <span className="screen-label">Страны</span>
              <h2>Приоритетные профили</h2>
            </div>
          </div>
          <div className="country-rule-list">
            {priorityCountries.map((profile) =>
              profile ? (
                <article key={profile.code}>
                  <span>{profile.code}</span>
                  <h3>{profile.name}</h3>
                  <p>{profile.dutyModel}</p>
                  <small>{profile.tariffSource.name}</small>
                </article>
              ) : null,
            )}
          </div>
        </article>
      </section>

      <section className="rules-layout">
        <article className="rules-panel">
          <div className="section-title">
            <div>
              <span className="screen-label">Источники</span>
              <h2>Где брать ставки</h2>
            </div>
          </div>
          <div className="source-list compact">
            {globalComplianceSources.map((source) => (
              <a href={source.url} key={source.name} rel="noreferrer" target="_blank">
                <strong>{source.name}</strong>
                <span>{source.note}</span>
              </a>
            ))}
          </div>
        </article>

        <article className="rules-panel">
          <div className="section-title">
            <div>
              <span className="screen-label">Карта покрытия</span>
              <h2>Все страны по группам</h2>
            </div>
          </div>
          <div className="region-rule-grid">
            {Object.entries(byRegion)
              .sort(([a], [b]) => a.localeCompare(b, 'ru'))
              .map(([region, count]) => (
                <div key={region}>
                  <strong>{count}</strong>
                  <span>{region}</span>
                </div>
              ))}
          </div>
        </article>
      </section>
    </section>
  )
}

function PlantDirectory({
  isPlantDirectoryLoading,
  navigateTo,
  plantCatalog,
}: {
  isPlantDirectoryLoading: boolean
  navigateTo: (path: string) => void
  plantCatalog: Plant[]
}) {
  const countries = Array.from(new Set(plantCatalog.map((plant) => plant.country ?? 'Россия'))).sort(sortCountries)
  const regions = Array.from(new Set(plantCatalog.map((plant) => plant.region))).sort((a, b) => sortRegions(a, b))
  const industries = Array.from(new Set(plantCatalog.map((plant) => plant.industry ?? 'промышленность')))
  const groupedPlants = buildPlantDirectoryGroups(plantCatalog)
  const visibleGroups = visiblePlantDirectoryGroups(groupedPlants)
  const displayedPlantCount = Math.max(plantCatalog.length, cisCoverage.total + asiaCoverage.total)

  return (
    <section className="page-stack">
      <div className="page-hero">
        <span className="screen-label">Реестр заводов</span>
        <h1>Реестр заводов РФ, СНГ, Европы и Азии</h1>
        <p>
          База разделена на проверенные карточки и черновые лиды: завод, страна, регион, отрасль,
          конкретная продукция, потребности, документы, логистика и источник внутри сервиса.
        </p>
      </div>

      <section className="search-summary-grid">
        <article>
          <span>Заводов</span>
          <strong>{displayedPlantCount}</strong>
          <small>первый слой базы, дальше расширяем</small>
        </article>
        <article>
          <span>Стран</span>
          <strong>{countries.length}</strong>
          <small>РФ + СНГ + Европа + Азия</small>
        </article>
        <article>
          <span>Регионов</span>
          <strong>{regions.length}</strong>
          <small>собираем последовательно</small>
        </article>
        <article>
          <span>Отраслей</span>
          <strong>{industries.length}</strong>
          <small>не только нефтехимия</small>
        </article>
      </section>

      <CisCoveragePanel snapshot={cisCoverage} />
      <AsiaCoveragePanel snapshot={asiaCoverage} />

      {isPlantDirectoryLoading ? (
        <section className="registry-loading-panel" aria-live="polite">
          <strong>Подгружаем расширенный реестр заводов</strong>
          <span>Проверенные карточки уже доступны; массовые регионы добавятся без перезагрузки страницы.</span>
        </section>
      ) : null}

      <section className="plant-directory">
        {visibleGroups.map((countryGroup) => (
          <div className="plant-country-group" id={plantCountryGroupId(countryGroup.country)} key={countryGroup.country}>
            <h2>{countryGroup.country}</h2>
            {countryGroup.regions.map((regionGroup) => {
              const visiblePlants = visibleDirectoryPlants(regionGroup.plants)
              const regionTitle = countryGroup.country === regionGroup.region ? 'Общий реестр' : regionGroup.region
              return (
              <article className="plant-region-block" key={`${countryGroup.country}-${regionGroup.region}`}>
                <div className="section-title">
                  <div>
                    <span className="screen-label">Регион</span>
                    <h3>{regionTitle}</h3>
                  </div>
                  <strong>{regionGroup.plants.length} заводов</strong>
                </div>
                <div className="plant-card-grid">
                  {visiblePlants.map((plant) => (
                    <button
                      className="plant-card"
                      key={plant.slug}
                      type="button"
                      onClick={() => navigateTo(`/plants/${plant.slug}`)}
                    >
                      <PlantLogo plant={plant} />
                      <div>
                        <strong>{plant.name}</strong>
                        <span>{plant.city ?? plant.region} · {plant.industry ?? 'промышленность'}</span>
                        <small>{plant.products.slice(0, 3).join(' · ')}</small>
                        <PlantQualityChips plant={plant} />
                      </div>
                    </button>
                  ))}
                  {regionGroup.plants.length > visiblePlants.length ? (
                    <div className="plant-card plant-card-muted">
                      <Building2 aria-hidden="true" size={22} />
                      <div>
                        <strong>+{regionGroup.plants.length - visiblePlants.length}</strong>
                        <span>ещё в базе региона</span>
                        <small>показаны приоритетные и вручную проверенные</small>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
              )
            })}
            {countryGroup.hiddenRegions > 0 ? (
              <div className="plant-region-more">
                +{countryGroup.hiddenRegions} регионов в базе. Открываем через поиск и карточки заводов, чтобы каталог не тормозил.
              </div>
            ) : null}
          </div>
        ))}
      </section>
    </section>
  )
}

function PlantQualityChips({ plant }: { plant: Plant }) {
  const quality = plantQualitySummary(plant)
  const productLabel = quality.hasProductEvidence
    ? quality.dataQuality === 'lead'
      ? 'Продукция заявлена'
      : 'Продукция подтверждена'
    : 'Продукция требует проверки'

  return (
    <div className="plant-quality-row" aria-label={`Качество данных ${plant.name}`}>
      <span className={`source-level ${quality.dataQuality}`}>{sourceLevelLabel(quality.dataQuality)}</span>
      <span>{entityLevelLabel(quality.entityLevel)}</span>
      <span className={quality.hasAddress ? 'ok' : 'todo'}>{quality.hasAddress ? 'Адрес есть' : 'Адрес проверить'}</span>
      <span className={quality.hasProductEvidence && quality.dataQuality !== 'lead' ? 'ok' : 'todo'}>
        {productLabel}
      </span>
      <span className={quality.needsOfficialVerification ? 'todo' : 'ok'}>
        {quality.needsOfficialVerification ? 'Нужна проверка' : 'Проверка пройдена'}
      </span>
      {quality.verification.length ? <span>Проверок: {quality.verification.length}</span> : null}
    </div>
  )
}

function plantQualitySummary(plant: Plant) {
  const dataQuality = plant.dataQuality ?? 'lead'
  const hasAddress = plant.hasAddress ?? Boolean(plant.address)
  const hasProductEvidence = plant.hasProductEvidence ?? Boolean(
    plant.productionItems?.some((item) => item.status !== 'lead') || (dataQuality !== 'lead' && plant.products.length),
  )
  const hasDocuments = Boolean(
    plant.documents?.length ||
    plant.procurementEvidence?.some((evidence) => evidence.documents.length) ||
    plant.productionItems?.some((item) => item.documents.length) ||
    plant.demandItems?.some((item) => item.documents.length),
  )

  return {
    dataQuality,
    entityLevel: plant.entityLevel ?? 'unknown',
    hasAddress,
    hasDocuments,
    hasProductEvidence,
    needsOfficialVerification: plant.needsOfficialVerification ?? dataQuality === 'lead',
    verification: plant.verification ?? [],
  }
}

function CisCoveragePanel({ snapshot }: { snapshot: CisCoverageSnapshot }) {
  const completeCountries = snapshot.countries.filter((country) => country.complete).length
  const tenderPlatformCount = snapshot.countries.reduce((sum, country) => sum + country.tenderPlatforms.length, 0)

  return (
    <section className="cis-coverage-panel" aria-labelledby="cis-coverage-title">
      <div className="section-title">
        <div>
          <span className="screen-label">СНГ</span>
          <h2 id="cis-coverage-title">СНГ: покрытие базы</h2>
        </div>
        <strong>{completeCountries}/{snapshot.countries.length} стран готово</strong>
      </div>

      <div className="cis-coverage-summary">
        <article>
          <span>Заводов СНГ</span>
          <strong>{snapshot.total}</strong>
          <small>производители и промышленные площадки</small>
        </article>
        <article>
          <span>Стран</span>
          <strong>{completeCountries}/{snapshot.countries.length}</strong>
          <small>минимум 50 заводов на страну</small>
        </article>
        <article>
          <span>Тендерных площадок</span>
          <strong>{tenderPlatformCount}</strong>
          <small>для ежедневного добора закупок</small>
        </article>
      </div>

      <div className="cis-country-grid">
        {snapshot.countries.map((country) => {
          const progress = Math.min(100, Math.round((country.collected / Math.max(1, country.target)) * 100))
          const sources = Object.entries(country.sourceBreakdown)
          return (
            <article className="cis-country-card" key={country.country}>
              <div className="cis-country-card-head">
                <div>
                  <h3>{country.country}</h3>
                  <span>{country.collected} / {country.target} заводов</span>
                </div>
                <strong className={country.complete ? 'complete' : 'incomplete'}>
                  {country.complete ? 'готово' : 'добрать'}
                </strong>
              </div>
              <div className="cis-progress" aria-label={`${country.country}: ${progress}%`}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="cis-source-row">
                {sources.map(([source, count]) => (
                  <span key={source}>{source}: {count}</span>
                ))}
              </div>
              <div className="cis-tender-row">
                {country.tenderPlatforms.slice(0, 3).map((platform) => (
                  <span key={platform.url}>{platform.name}</span>
                ))}
              </div>
              <button type="button" onClick={() => scrollToPlantCountry(country.country)}>
                Показать в каталоге
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function AsiaCoveragePanel({ snapshot }: { snapshot: AsiaCoverageSnapshot }) {
  const tenderPlatformCount = snapshot.countries.reduce(
    (sum, country) => sum + uniquePlatforms(country.regions.flatMap((region) => region.tenderPlatforms)).length,
    0,
  )

  return (
    <section className="asia-coverage-panel" aria-labelledby="asia-coverage-title">
      <div className="section-title">
        <div>
          <span className="screen-label">Индия и Китай</span>
          <h2 id="asia-coverage-title">Азия: покрытие базы</h2>
        </div>
        <strong>{snapshot.totalCompleteRegions}/{snapshot.totalRegions} регионов готово</strong>
      </div>

      <div className="cis-coverage-summary">
        <article>
          <span>Заводов Азии</span>
          <strong>{snapshot.total}</strong>
          <small>из цели {snapshot.totalTarget}</small>
        </article>
        <article>
          <span>Регионов</span>
          <strong>{snapshot.totalCompleteRegions}/{snapshot.totalRegions}</strong>
          <small>Индия 100/регион, Китай 150/регион</small>
        </article>
        <article>
          <span>Тендерных площадок</span>
          <strong>{tenderPlatformCount}</strong>
          <small>для enrichment закупок</small>
        </article>
      </div>

      <div className="asia-country-grid">
        {snapshot.countries.map((country) => {
          const progress = Math.min(100, Math.round((country.collected / Math.max(1, country.target)) * 100))
          const topBacklog = [...country.regions]
            .sort((a, b) => b.collected / Math.max(1, b.target) - a.collected / Math.max(1, a.target))
            .slice(0, 7)
          const platforms = uniquePlatforms(country.regions.flatMap((region) => region.tenderPlatforms))
          return (
            <article className="asia-country-card" key={country.country}>
              <div className="cis-country-card-head">
                <div>
                  <h3>{country.country}</h3>
                  <span>{country.collected} / {country.target} заводов</span>
                </div>
                <strong className="incomplete">добор</strong>
              </div>
              <div className="cis-progress" aria-label={`${country.country}: ${progress}%`}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="cis-source-row">
                {Object.entries(country.sourceBreakdown).map(([source, count]) => (
                  <span key={source}>{source}: {count}</span>
                ))}
              </div>
              <div className="asia-region-list">
                {topBacklog.map((region) => (
                  <span key={region.iso}>{region.region}: {region.collected}/{region.target}</span>
                ))}
              </div>
              <div className="cis-tender-row">
                {platforms.slice(0, 4).map((platform) => (
                  <span key={platform.url}>{platform.label ?? platform.name}</span>
                ))}
              </div>
              <button type="button" onClick={() => scrollToPlantCountry(country.country)}>
                Показать в каталоге
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function uniquePlatforms(platforms: Array<{ label?: string; name?: string; url: string }>) {
  const seen = new Set<string>()
  return platforms.filter((platform) => {
    const key = platform.url
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function plantCountryGroupId(country: string) {
  return `plant-country-${country.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-')}`
}

function scrollToPlantCountry(country: string) {
  const section = document.getElementById(plantCountryGroupId(country))
  if (typeof section?.scrollIntoView === 'function') {
    section.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
}

type PlantDirectoryGroup = {
  country: string
  regions: Array<{ plants: Plant[]; region: string }>
}

function visiblePlantDirectoryGroups(groups: PlantDirectoryGroup[]) {
  const cisPriorityCountries = [
    'Россия',
    'Казахстан',
    'Беларусь',
    'Узбекистан',
    'Кыргызстан',
    'Армения',
    'Азербайджан',
    'Таджикистан',
    'Молдова',
    'Туркменистан',
  ]
  const euPriorityCountries = [
    'Австрия',
    'Бельгия',
    'Болгария',
    'Венгрия',
    'Германия',
    'Греция',
    'Дания',
    'Ирландия',
    'Испания',
    'Италия',
    'Кипр',
    'Латвия',
    'Литва',
    'Люксембург',
    'Мальта',
    'Нидерланды',
    'Польша',
    'Португалия',
    'Румыния',
    'Словакия',
    'Словения',
    'Финляндия',
    'Франция',
    'Чехия',
    'Хорватия',
    'Швеция',
    'Эстония',
  ]
  const asiaPriorityCountries = ['India', 'China']
  const priorityCountries = [...cisPriorityCountries, ...euPriorityCountries, ...asiaPriorityCountries]
  return groups.filter((group) => priorityCountries.includes(group.country)).map((group) => {
    const limit = group.country === 'Россия' || asiaPriorityCountries.includes(group.country) ? 3 : group.regions.length > 8 ? 3 : group.regions.length
    return {
      ...group,
      hiddenRegions: Math.max(0, group.regions.length - limit),
      regions: group.regions.slice(0, limit),
    }
  })
}

function buildPlantDirectoryGroups(catalog: Plant[]) {
  const countryMap = new globalThis.Map<string, globalThis.Map<string, Plant[]>>()

  for (const plant of catalog) {
    const country = plant.country ?? 'Россия'
    const regionMap = countryMap.get(country) ?? new globalThis.Map<string, Plant[]>()
    const regionPlants = regionMap.get(plant.region) ?? []
    regionPlants.push(plant)
    regionMap.set(plant.region, regionPlants)
    countryMap.set(country, regionMap)
  }

  return [...countryMap.entries()]
    .sort(([a], [b]) => sortCountries(a, b))
    .map(([country, regionMap]) => ({
      country,
      regions: [...regionMap.entries()]
        .sort(([a, aPlants], [b, bPlants]) => sortPlantDirectoryRegions(a, aPlants, b, bPlants))
        .map(([region, regionPlants]) => ({
          plants: regionPlants.sort(sortPlantDirectoryItems),
          region,
        })),
    }))
}

function sortPlantDirectoryRegions(aRegion: string, aPlants: Plant[], bRegion: string, bPlants: Plant[]) {
  const aHasCurated = aPlants.some((plant) => !plant.slug.startsWith('mass-'))
  const bHasCurated = bPlants.some((plant) => !plant.slug.startsWith('mass-'))
  if (aHasCurated !== bHasCurated) return aHasCurated ? -1 : 1
  return sortRegions(aRegion, bRegion)
}

function sortPlantDirectoryItems(a: Plant, b: Plant) {
  const aPriority = a.slug.startsWith('mass-') ? 1 : 0
  const bPriority = b.slug.startsWith('mass-') ? 1 : 0
  return aPriority - bPriority || a.name.localeCompare(b.name, 'ru')
}

function visibleDirectoryPlants(regionPlants: Plant[]) {
  const manualPlants = regionPlants.filter((plant) => !plant.slug.startsWith('mass-'))
  const massPlants = regionPlants.filter((plant) => plant.slug.startsWith('mass-'))
  return [...manualPlants, ...massPlants.slice(0, Math.max(0, 12 - manualPlants.length))]
}

function sortRegions(a: string, b: string) {
  const aIndex = russiaRegionStages.indexOf(a)
  const bIndex = russiaRegionStages.indexOf(b)
  if (aIndex !== -1 || bIndex !== -1) {
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex)
  }
  return a.localeCompare(b, 'ru')
}

function sortCountries(a: string, b: string) {
  if (a === 'Россия') return -1
  if (b === 'Россия') return 1
  return a.localeCompare(b, 'ru')
}

function DetailedPlantProfile({
  detail,
  setSelectedSource,
}: {
  detail: PlantDetail
  setSelectedSource: (source: SourceRecord) => void
}) {
  const employees = detail.facts.find((fact) => fact.label === 'Количество сотрудников')
  const coreFacts = [
    ['Юрлицо', detail.company.legal_name],
    ['ИНН', detail.company.inn],
    ['ОГРН', detail.company.ogrn],
    ['КПП', detail.company.kpp],
    ['Адрес', detail.company.address],
    ['Количество сотрудников', employees?.value ?? null],
  ]

  return (
    <section className="plant-deep-card">
      <div className="section-title">
        <div>
          <span className="screen-label">База данных</span>
          <h2>Полная карточка завода</h2>
        </div>
        <span className={`source-level ${detail.company.data_level === 'verified_profile' ? 'verified' : 'lead'}`}>
          {detail.company.data_level}
        </span>
      </div>

      <div className="plant-deep-grid">
        <article>
          <h3>Реквизиты и масштаб</h3>
          <dl className="fact-grid">
            {coreFacts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ?? 'нужно подтвердить'}</dd>
              </div>
            ))}
          </dl>
          <div className="plant-source-row">
            <InlineSourceButton source={sourceFromDetailCompany(detail)} setSelectedSource={setSelectedSource} />
            {detail.company.website ? (
              <a href={detail.company.website} rel="noreferrer" target="_blank">
                <ExternalLink aria-hidden="true" size={14} />
                официальный сайт
              </a>
            ) : null}
          </div>
        </article>

        <article>
          <h3>Что производит</h3>
          <div className="deep-list">
            {detail.products.map((product) => (
              <div key={product.name}>
                <strong>{product.name}</strong>
                <span>{[product.brand, product.volume].filter(Boolean).join(' · ')}</span>
                <small>{product.spec}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <h3>Что требуется</h3>
          <div className="deep-list">
            {detail.needs.map((need, needIndex) => (
              <div key={`${need.name}-${needIndex}`}>
                <strong>{need.name}</strong>
                <span>{need.estimated_volume} · {need.frequency}</span>
                <small>{need.spec}</small>
                <div className="rule-tags">
                  {need.documents.slice(0, 4).map((documentName, documentIndex) => (
                    <span key={`${documentName}-${documentIndex}`}>{documentName}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <h3>Закупки и документы</h3>
          <div className="deep-list">
            {detail.procurementEvents.map((event, eventIndex) => (
              <div key={`${event.title}-${eventIndex}`}>
                <strong>{event.title}</strong>
                <span>{event.status}</span>
                {event.items.map((item, itemIndex) => (
                  <small key={`${item.name}-${itemIndex}`}>{item.name}: {item.spec}</small>
                ))}
                <InlineSourceButton source={sourceFromDetailProcurementEvent(event)} setSelectedSource={setSelectedSource} />
              </div>
            ))}
            {detail.documents.map((documentItem, documentIndex) => (
              <div key={`${documentItem.document_type}-${documentItem.title}-${documentIndex}`}>
                <strong>{documentItem.title}</strong>
                <span>{documentItem.document_type} · {documentItem.status}</span>
                <small>{documentItem.source_name}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <h3>Собственники и финансы</h3>
          <div className="deep-list compact">
            {detail.ownership.map((owner) => (
              <div key={`${owner.role}-${owner.owner_name}`}>
                <strong>{owner.owner_name}</strong>
                <span>{owner.role} · {owner.status}</span>
              </div>
            ))}
            {detail.financials.map((metric) => (
              <div key={metric.metric}>
                <strong>{formatMetricName(metric.metric)}</strong>
                <span>{metric.value ?? 'нет в текущей выгрузке'} · {metric.status}</span>
              </div>
            ))}
          </div>
        </article>

        <article>
          <h3>Санкции и риски</h3>
          <div className="deep-list compact">
            {detail.sanctionsChecks.map((check) => (
              <div key={check.list_name}>
                <strong>{check.list_name}</strong>
                <span>{check.status}</span>
                <small>{check.result_note}</small>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}

function formatMetricName(metric: string) {
  const labels: Record<string, string> = {
    assets: 'Активы',
    authorized_capital: 'Уставный капитал',
    employees: 'Сотрудники',
    net_profit: 'Чистая прибыль',
    revenue: 'Выручка',
  }
  return labels[metric] ?? metric
}

function PlantPassport({
  plant,
  setSelectedSource,
}: {
  plant: Plant
  setSelectedSource: (source: SourceRecord) => void
}) {
  const documentsCount = new Set([
    ...(plant.documents ?? []),
    ...(plant.productionItems ?? []).flatMap((item) => item.documents),
    ...(plant.demandItems ?? []).flatMap((item) => item.documents),
    ...(plant.procurementEvidence ?? []).flatMap((evidence) => evidence.documents),
  ]).size
  const facts = [
    ['Юрлицо', plant.legalName],
    ['Адрес', plant.address],
    ['Отрасль', plant.industry],
    ['Уровень сущности', entityLevelLabel(plant.entityLevel)],
    ['Производственные позиции', ruPlural(plant.productionItems?.length || plant.products.length, ['позиция', 'позиции', 'позиций'])],
    ['Закупает', ruPlural(plant.demandItems?.length || plant.needs.length, ['потребность', 'потребности', 'потребностей'])],
    ['Документы в карточке', documentsCount ? ruPlural(documentsCount, ['тип', 'типа', 'типов']) : 'нужно дозагрузить'],
  ]

  return (
    <section className="plant-passport">
      <div className="section-title">
        <div>
          <span className="screen-label">Паспорт завода</span>
          <h2>Что известно о заводе</h2>
        </div>
        <span className={`source-level ${plant.dataQuality ?? 'lead'}`}>{sourceLevelLabel(plant.dataQuality ?? 'lead')}</span>
      </div>
      <div className="plant-passport-layout">
        <article className="official-site-card">
          <span>Официальная ссылка</span>
          {plant.website ? (
            <a href={plant.website} rel="noreferrer" target="_blank">
              <ExternalLink aria-hidden="true" size={16} />
              <strong>Официальный сайт завода</strong>
              <small>{websiteHost(plant.website)}</small>
            </a>
          ) : (
            <p>Официальный сайт нужно подтвердить парсером или вручную.</p>
          )}
          <InlineSourceButton source={sourceFromPlant(plant)} setSelectedSource={setSelectedSource} />
        </article>
        <dl className="plant-passport-grid">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || 'нужно подтвердить'}</dd>
            </div>
          ))}
        </dl>
      </div>
      <PlantQualityStrip plant={plant} />
    </section>
  )
}

function PlantQualityStrip({ plant }: { plant: Plant }) {
  const quality = plantQualitySummary(plant)
  const productLabel = quality.hasProductEvidence
    ? quality.dataQuality === 'lead'
      ? 'Продукция заявлена'
      : 'Продукция подтверждена'
    : 'Продукция требует проверки'
  const documentLabel = quality.hasDocuments
    ? quality.dataQuality === 'lead'
      ? 'Документы к проверке'
      : 'Документы есть'
    : 'Документы нужны'

  return (
    <div className="plant-quality-strip" aria-label="Качество данных карточки">
      <span className={`source-level ${quality.dataQuality}`}>{sourceLevelLabel(quality.dataQuality)}</span>
      <span>{entityLevelLabel(quality.entityLevel)}</span>
      <span className={quality.hasAddress ? 'ok' : 'todo'}>{quality.hasAddress ? 'Адрес есть' : 'Адрес проверить'}</span>
      <span className={quality.hasProductEvidence && quality.dataQuality !== 'lead' ? 'ok' : 'todo'}>
        {productLabel}
      </span>
      <span className={quality.hasDocuments && quality.dataQuality !== 'lead' ? 'ok' : 'todo'}>{documentLabel}</span>
      <span className={quality.needsOfficialVerification ? 'todo' : 'ok'}>
        {quality.needsOfficialVerification ? 'Нужна проверка' : 'Проверка пройдена'}
      </span>
      {quality.verification.slice(0, 3).map((item) => (
        <small key={item}>{item}</small>
      ))}
    </div>
  )
}

function entityLevelLabel(level?: string) {
  return {
    company: 'компания',
    park: 'промпарк/зона',
    plant: 'завод/площадка',
    unknown: 'нужно уточнить',
  }[level ?? 'unknown'] ?? level
}

function PlantCommandBar({
  navigateTo,
  plant,
  primaryMaterialSlug,
  setSelectedSource,
}: {
  navigateTo: (path: string) => void
  plant: Plant
  primaryMaterialSlug: string
  setSelectedSource: (source: SourceRecord) => void
}) {
  const firstDemand = plant.demandItems?.find((item) => item.materialSlug) ?? plant.demandItems?.[0]
  const firstResponsible = firstDemand?.responsible ?? plant.demandItems?.find((item) => item.responsible)?.responsible
  const documents = [
    ...(firstDemand?.documents ?? []),
    ...(plant.documents ?? []),
    ...(plant.procurementEvidence?.[0]?.documents ?? []),
  ]
  const material = firstDemand?.materialSlug ? materials[firstDemand.materialSlug] : materials[primaryMaterialSlug]
  const openMaterialSlug = firstDemand?.materialSlug ?? primaryMaterialSlug

  return (
    <section className="plant-command">
      <div className="plant-command-head">
        <div>
          <span className="screen-label">Демо-сценарий</span>
          <h2>Завод за 60 секунд</h2>
          <p>Открой потребность, проверь характеристики, собери RFQ и сразу посмотри маршруты/документы без ручного поиска по сайтам.</p>
        </div>
        <div className="plant-command-actions">
          <button type="button" onClick={() => navigateTo(`/materials/${openMaterialSlug}`)}>
            <PackageCheck aria-hidden="true" size={16} />
            Открыть первую потребность
          </button>
          <button type="button" onClick={() => navigateTo(dealPathForMaterial(primaryMaterialSlug))}>
            <ClipboardCheck aria-hidden="true" size={16} />
            Собрать RFQ по {material?.name ?? 'сырью'}
          </button>
          <button type="button" onClick={() => navigateTo(`/map/${primaryMaterialSlug}`)}>
            <Map aria-hidden="true" size={16} />
            Маршруты
          </button>
          <button type="button" onClick={() => scrollToPlantBlock('plant-documents')}>
            <FileText aria-hidden="true" size={16} />
            Документы
          </button>
          <button type="button" onClick={() => setSelectedSource(sourceFromPlant(plant))}>
            <Search aria-hidden="true" size={16} />
            Проверка данных
          </button>
        </div>
      </div>
      <div className="plant-command-grid">
        <article>
          <span>1. Потребность</span>
          <strong>{firstDemand?.name ?? material?.name ?? 'нужно выбрать сырьё'}</strong>
          <small>{firstDemand ? `${firstDemand.volume} · ${firstDemand.spec}` : 'откройте каталог веществ или закупки завода'}</small>
        </article>
        <article>
          <span>2. Ответственный</span>
          <strong>{firstResponsible?.name ?? plant.procurementContacts?.[0] ?? 'контакт нужно дозагрузить'}</strong>
          <small>{firstResponsible ? [firstResponsible.role, firstResponsible.phone, firstResponsible.email].filter(Boolean).join(' · ') : 'связать контакт с конкретной позицией'}</small>
        </article>
        <article>
          <span>3. Что запросить</span>
          <strong>{documents.length ? `${formatCount(new Set(documents).size)} документов` : 'пакет документов'}</strong>
          <div className="document-grid muted">
            {[...new Set(documents)].slice(0, 5).map((documentName) => (
              <span key={documentName}>{documentName}</span>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}

function PlantVisualGallery({ plant }: { plant: Plant }) {
  const cards = buildPlantVisualCards(plant)

  if (!cards.length) return null

  return (
    <section className="plant-visual-gallery">
      <div className="section-title">
        <div>
          <span className="screen-label">Внешний вид</span>
          <h2>Как выглядит продукция и сырьё</h2>
        </div>
        <span className="source-level lead">референсы</span>
      </div>
      <div className="plant-visual-grid">
        {cards.map((card) => (
          <article className="plant-visual-card" key={`${card.kind}-${card.title}`}>
            <img alt={card.title} loading="lazy" src={card.imageUrl} />
            <div>
              <span>{card.kind}</span>
              <h3>{card.title}</h3>
              <p>{card.caption}</p>
              <small>{card.meta}</small>
              {card.documents.length ? (
                <div className="document-grid muted">
                  {card.documents.slice(0, 4).map((documentName) => (
                    <span key={`${card.title}-${documentName}`}>{documentName}</span>
                  ))}
                </div>
              ) : null}
              <small>Фото-референс: {card.source}. Документы партии проверяются отдельно.</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function LineItemSpecs({ item }: { item: PlantLineItem }) {
  const specs = lineItemCharacteristics(item)

  if (!specs.length) return null

  return (
    <div className="line-spec-block">
      <span>Характеристики</span>
      <dl className="line-spec-grid">
        {specs.map(([label, value]) => (
          <div key={`${item.name}-${label}-${value}`}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function PlantDemoBrief({
  navigateTo,
  plant,
  primaryMaterialSlug,
  setSelectedSource,
}: {
  navigateTo: (path: string) => void
  plant: Plant
  primaryMaterialSlug: string
  setSelectedSource: (source: SourceRecord) => void
}) {
  const demoDemands = (plant.demandItems ?? []).slice(0, 3)
  if (!demoDemands.length) return null

  const firstMaterial = materials[primaryMaterialSlug]

  return (
    <section className="plant-demo-brief" aria-label="Демо-сводка завода">
      <div className="section-title">
        <div>
          <span className="screen-label">Для презентации</span>
          <h2>Главные потребности и документы</h2>
        </div>
        <div className="section-action-row">
          <button type="button" onClick={() => navigateTo(`/materials/${primaryMaterialSlug}`)}>
            <FlaskConical aria-hidden="true" size={16} />
            {firstMaterial?.name ?? 'Открыть сырьё'}
          </button>
          <button type="button" onClick={() => navigateTo(dealPathForMaterial(primaryMaterialSlug))}>
            <ClipboardCheck aria-hidden="true" size={16} />
            RFQ
          </button>
        </div>
      </div>
      <div className="plant-demo-grid">
        {demoDemands.map((item) => (
          <article key={`${plant.slug}-brief-${item.name}`}>
            <span>{item.materialSlug ? 'сырьё с карточкой' : 'позиция закупки'}</span>
            <h3>{item.name}</h3>
            <p>{item.spec}</p>
            <div className="plant-demo-meta">
              <strong>{item.volume}</strong>
              {item.price ? <small>{item.price}</small> : null}
            </div>
            <ResponsibleLine item={item} />
            <div className="document-grid muted">
              {item.documents.slice(0, 4).map((documentName) => (
                <span key={`${item.name}-${documentName}`}>{documentName}</span>
              ))}
            </div>
            <div className="plant-demo-actions">
              {item.materialSlug ? (
                <button type="button" onClick={() => navigateTo(`/materials/${item.materialSlug}`)}>
                  Открыть вещество
                </button>
              ) : null}
              <button type="button" onClick={() => setSelectedSource(sourceFromLineItem(item, `${plant.name}: потребность`))}>
                Досье
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function PlantPage({
  navigateTo,
  plant,
  setSelectedSource,
}: {
  navigateTo: (path: string) => void
  plant: Plant
  setSelectedSource: (source: SourceRecord) => void
}) {
  const detail = plantDetails[plant.slug]
  const primaryMaterialSlug =
    plant.demandItems?.find((item) => item.materialSlug)?.materialSlug ??
    plant.needs.find((need) => need.materialSlug)?.materialSlug ??
    'sulfur'
  const [demandControls, setDemandControls] = useState({ plantSlug: plant.slug, query: '', showAll: false })
  const demandQuery = demandControls.plantSlug === plant.slug ? demandControls.query : ''
  const showAllDemands = demandControls.plantSlug === plant.slug ? demandControls.showAll : false
  const demandItems = useMemo(() => plant.demandItems ?? [], [plant.demandItems])
  const filteredDemandItems = useMemo(
    () => filterPlantLineItems(demandItems, demandQuery),
    [demandItems, demandQuery],
  )
  const demandPreviewLimit = plant.slug === 'snhz' ? 6 : 14
  const visibleDemandItems = showAllDemands ? filteredDemandItems : filteredDemandItems.slice(0, demandPreviewLimit)

  return (
    <section className="page-stack">
      <div className="page-hero">
        <div className="plant-hero-title">
          <PlantLogo plant={plant} size="large" />
          <div>
            <span className="screen-label">Завод</span>
            <h1>{plant.name}</h1>
            <p>
              {[plant.country, plant.region, plant.city].filter(Boolean).join(' / ')}. Карточка завода показывает, что он производит, что закупает,
              какие поставщики могут закрыть потребность и какие документы запросить.
            </p>
          </div>
        </div>
      </div>
      <PlantCommandBar
        navigateTo={navigateTo}
        plant={plant}
        primaryMaterialSlug={primaryMaterialSlug}
        setSelectedSource={setSelectedSource}
      />
      <PlantDemoBrief
        navigateTo={navigateTo}
        plant={plant}
        primaryMaterialSlug={primaryMaterialSlug}
        setSelectedSource={setSelectedSource}
      />
      <PlantPassport plant={plant} setSelectedSource={setSelectedSource} />
      <div className="deal-room-grid plant-deal-grid">
        <article className="plant-side-panel" id="plant-products">
          <h2>Производит</h2>
          <div className="document-grid">
            {plant.products.map((product) => (
              <span key={product}>{product}</span>
            ))}
          </div>
          {plant.productionItems?.length ? (
            <div className="plant-line-section">
              <h3>Конкретные позиции производства</h3>
              <div className="plant-line-list">
                {plant.productionItems.map((item) => {
                  const itemMaterial = item.materialSlug ? materials[item.materialSlug] : undefined

                  return (
                    <div className="plant-line-card" key={`${plant.slug}-product-${item.name}`}>
                      <div>
                        {itemMaterial && item.materialSlug ? (
                          <button
                            aria-label={`${item.name}: открыть вещество`}
                            className="line-item-link"
                            type="button"
                            onClick={() => navigateTo(`/materials/${item.materialSlug}`)}
                          >
                            <strong>{item.name}</strong>
                            <ArrowRight aria-hidden="true" size={14} />
                          </button>
                        ) : (
                          <strong>{item.name}</strong>
                        )}
                        <span>{item.volume}</span>
                      </div>
                      <p>{item.spec}</p>
                      <LineItemSpecs item={item} />
                      <ResponsibleLine item={item} />
                      {lineItemNote(item) ? <small>{lineItemNote(item)}</small> : null}
                      {chemicalBadges(item).length ? (
                        <div className="document-grid muted">
                          {chemicalBadges(item).map((badge) => (
                            <span key={`${item.name}-${badge}`}>{badge}</span>
                          ))}
                        </div>
                      ) : null}
                      <div className="document-grid muted">
                        {item.documents.map((document) => (
                          <span key={document}>{document}</span>
                        ))}
                      </div>
                      <div className="plant-source-row">
                        <small>{item.status} · данные сохранены в TenderStart</small>
                        <InlineSourceButton
                          source={sourceFromLineItem(item, `${plant.name}: производство`)}
                          setSelectedSource={setSelectedSource}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </article>
        <article className="plant-contact-panel" id="plant-contacts">
          <h2>Контакты</h2>
          <div className="plant-contact-list">
            {plant.address ? <p>{plant.address}</p> : <p>Адрес: нужно подтвердить</p>}
            {plant.phones?.map((phone) => <p key={phone}>Телефон: {phone}</p>)}
            {plant.emails?.map((email) => <p key={email}>Email: {email}</p>)}
            {plant.procurementContacts?.map((contact) => <p key={contact}>Закупки: {contact}</p>)}
            {plant.website ? <p>Официальный сайт: {websiteHost(plant.website)}</p> : null}
          </div>
          <div className="plant-source-row">
            {plant.socials?.map((social) => (
              <a href={social.url} key={social.url} rel="noreferrer" target="_blank">
                <ExternalLink aria-hidden="true" size={14} />
                {social.label}
              </a>
            ))}
          </div>
        </article>
        <article className="plant-main-panel" id="plant-demand">
          <div className="plant-panel-title">
            <div>
              <span className="screen-label">Главное для сделки</span>
              <h2>Что закупает завод</h2>
            </div>
            <span>{filteredDemandItems.length} из {demandItems.length || plant.needs.length}</span>
          </div>
          {demandItems.length ? (
            <div className="plant-line-section">
              <div className="plant-filter-bar">
                <Search aria-hidden="true" size={16} />
                <input
                  aria-label="Поиск потребностей завода"
                  placeholder="Найти сырьё, ГОСТ, CAS, ответственного"
                  type="search"
                  value={demandQuery}
                  onChange={(event) => {
                    setDemandControls({ plantSlug: plant.slug, query: event.target.value, showAll: false })
                  }}
                />
                {demandQuery ? (
                  <button type="button" onClick={() => setDemandControls({ plantSlug: plant.slug, query: '', showAll: false })}>
                    Сбросить
                  </button>
                ) : null}
              </div>
              <h3>Конкретные потребности</h3>
              <div className="plant-line-list">
                {visibleDemandItems.map((item) => {
                  const itemMaterial = item.materialSlug ? materials[item.materialSlug] : undefined

                  return (
                    <div className="plant-line-card" key={`${plant.slug}-demand-${item.name}`}>
                      <div>
                        {itemMaterial && item.materialSlug ? (
                          <button
                            aria-label={`${item.name}: открыть вещество`}
                            className="line-item-link"
                            type="button"
                            onClick={() => navigateTo(`/materials/${item.materialSlug}`)}
                          >
                            <strong>{item.name}</strong>
                            <span>Открыть вещество</span>
                            <ArrowRight aria-hidden="true" size={14} />
                          </button>
                        ) : (
                          <strong>{item.name}</strong>
                        )}
                        <span>{item.volume}</span>
                      </div>
                      <p>{item.spec}</p>
                      <LineItemSpecs item={item} />
                      {item.price ? <small>{item.price}</small> : null}
                      <ResponsibleLine item={item} />
                      {lineItemNote(item) ? <small>{lineItemNote(item)}</small> : null}
                      {chemicalBadges(item).length ? (
                        <div className="document-grid muted">
                          {chemicalBadges(item).map((badge) => (
                            <span key={`${item.name}-${badge}`}>{badge}</span>
                          ))}
                        </div>
                      ) : null}
                      <div className="document-grid muted">
                        {item.documents.map((document) => (
                          <span key={document}>{document}</span>
                        ))}
                      </div>
                      <div className="plant-source-row">
                        <small>{item.status} · данные сохранены в TenderStart</small>
                        <InlineSourceButton
                          source={sourceFromLineItem(item, `${plant.name}: потребность`)}
                          setSelectedSource={setSelectedSource}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              {filteredDemandItems.length > visibleDemandItems.length ? (
                <button
                  className="ghost-action plant-show-more"
                  type="button"
                  onClick={() => setDemandControls({ plantSlug: plant.slug, query: demandQuery, showAll: true })}
                >
                  Показать всю базу потребностей ({filteredDemandItems.length})
                </button>
              ) : null}
              {!filteredDemandItems.length ? (
                <div className="plant-empty-state">
                  <strong>По этому запросу позиций не найдено</strong>
                  <span>Попробуйте название вещества, ГОСТ/ТУ, CAS или фамилию ответственного.</span>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="plant-need-list">
            {plant.needs.map((need, needIndex) => {
              const needMaterial = need.materialSlug ? materials[need.materialSlug] : undefined
              const hasMaterialPage = Boolean(need.materialSlug)
              return (
                <button
                  aria-disabled={!hasMaterialPage}
                  className={hasMaterialPage ? undefined : 'is-disabled'}
                  disabled={!hasMaterialPage}
                  key={`${plant.slug}-${need.materialName ?? need.materialSlug ?? need.spec}-${needIndex}`}
                  type="button"
                  onClick={() => {
                    if (need.materialSlug) navigateTo(`/materials/${need.materialSlug}`)
                  }}
                >
                  <strong>{needMaterial?.name ?? need.materialName}</strong>
                  <span>{need.volume} · {need.spec}</span>
                  <small>{need.status} · {need.note}</small>
                </button>
              )
            })}
          </div>
        </article>
        <article className="plant-main-panel" id="plant-documents">
          <div className="plant-panel-title">
            <div>
              <span className="screen-label">Досье сделки</span>
              <h2>Закупки, документы и логистика</h2>
            </div>
          </div>
          {plant.procurementEvidence?.length ? (
            <div className="procurement-evidence-list">
              {plant.procurementEvidence.map((evidence, evidenceIndex) => (
                <div className="procurement-evidence" key={`${plant.slug}-${evidence.title ?? 'procurement'}-${evidenceIndex}`}>
                  <div>
                    <span className={`source-level ${evidence.status === 'подтверждено закупкой' ? 'verified' : evidence.status === 'поиск в ЕИС/ЭТП' ? 'estimated' : 'lead'}`}>
                      {evidence.status}
                    </span>
                    <strong>{evidence.title}</strong>
                    <small>{evidence.source}{evidence.date ? ` · ${evidence.date}` : ''}</small>
                  </div>
                  <p>{evidence.note}</p>
                  <div className="document-grid">
                    {evidence.inferredNeeds.map((need) => (
                      <span key={need}>{need}</span>
                    ))}
                  </div>
                  <div className="document-grid muted">
                    {evidence.documents.map((document, documentIndex) => (
                      <span key={`${document}-${documentIndex}`}>{document}</span>
                    ))}
                  </div>
                  <ProcurementDossier evidence={evidence} />
                  <InlineSourceButton
                    source={sourceFromProcurementEvidence(evidence)}
                    setSelectedSource={setSelectedSource}
                  />
                </div>
              ))}
            </div>
          ) : null}
          {plant.purchaseCategories?.length ? (
            <div className="document-grid">
              {plant.purchaseCategories.map((category, categoryIndex) => (
                <span key={`${category}-${categoryIndex}`}>{category}</span>
              ))}
            </div>
          ) : null}
          {plant.documents?.length ? (
            <div className="document-grid">
              {plant.documents.map((document, documentIndex) => (
                <span key={`${document}-${documentIndex}`}>{document}</span>
              ))}
            </div>
          ) : null}
          <div className="route-map">
            {[...plant.equipment, ...plant.logistics].map((item, itemIndex) => (
              <div className="route-line" key={`${item}-${itemIndex}`}>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
          <div className="plant-source-row">
            <small>{plant.source}</small>
            <InlineSourceButton source={sourceFromPlant(plant)} setSelectedSource={setSelectedSource} />
          </div>
        </article>
      </div>
      <PlantVisualGallery plant={plant} />
      {detail ? <DetailedPlantProfile detail={detail} setSelectedSource={setSelectedSource} /> : null}
      <button className="primary-action inline" type="button" onClick={() => navigateTo(dealPathForMaterial(primaryMaterialSlug))}>
        Собрать сделку по {materials[primaryMaterialSlug]?.name ?? 'первой потребности'}
      </button>
    </section>
  )
}

function websiteHost(website: string) {
  try {
    return new URL(website).hostname.replace(/^www\./u, '')
  } catch {
    return website
  }
}

function scrollToPlantBlock(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function ruPlural(count: number, forms: [string, string, string]) {
  const abs = Math.abs(count)
  const mod10 = abs % 10
  const mod100 = abs % 100
  const form = mod10 === 1 && mod100 !== 11 ? forms[0] : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? forms[1] : forms[2]
  return `${formatCount(count)} ${form}`
}

function sourceLevelLabel(level: SourceRecord['level'] | string) {
  const labels: Record<string, string> = {
    estimated: 'Оценка',
    lead: 'Нужно проверить',
    verified: 'Проверено',
  }
  return labels[level] ?? level
}

function sourceKindLabel(kind: string) {
  const labels: Record<string, string> = {
    company_registry: 'Реестр юрлиц',
    industry_catalog: 'Промышленный каталог',
    lead: 'Лид на проверку',
    manufacturer_site: 'Сайт производителя',
    plant_profile: 'Карточка завода',
    procurement: 'Закупка / тендер',
    procurement_event: 'Закупочное событие',
    'procurement-event': 'Закупочное событие',
    tender: 'Закупка / тендер',
    trade_platform: 'Торговая площадка',
  }
  return labels[kind] ?? `Тип источника: ${kind}`
}

function filterPlantLineItems(items: PlantLineItem[], query: string) {
  const normalized = query.trim().toLocaleLowerCase('ru-RU')
  if (!normalized) return items

  return items.filter((item) =>
    [
      item.name,
      item.spec,
      item.volume,
      item.price,
      item.status,
      item.source,
      item.note,
      item.cas,
      item.formula,
      item.responsible?.name,
      item.responsible?.role,
      item.responsible?.phone,
      item.responsible?.email,
      ...(item.standards ?? []),
      ...item.documents,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('ru-RU')
      .includes(normalized),
  )
}

function buildPlantVisualCards(plant: Plant): PlantVisualCard[] {
  const plantPhotoCards =
    plant.photos?.map((photo) => ({
      caption: photo.caption,
      documents: plant.documents ?? [],
      imageUrl: photo.url,
      kind: 'Фото завода',
      meta: plant.name,
      source: photo.source ?? 'карточка завода',
      title: photo.alt,
    })) ?? []
  const itemCards = [
    ...(plant.productionItems ?? []).flatMap((item) => visualCardsFromLineItem('Производит', item)),
    ...(plant.demandItems ?? []).flatMap((item) => visualCardsFromLineItem('Нужно заводу', item)),
  ]
  const productCards = plant.products.map((product) => visualCardFromText('Продукция', product, product, []))
  const unique = new globalThis.Map<string, PlantVisualCard>()

  for (const card of [...plantPhotoCards, ...itemCards, ...productCards]) {
    const key = `${card.kind}-${card.title}`
    if (!unique.has(key)) unique.set(key, card)
  }

  return [...unique.values()].slice(0, 6)
}

function visualCardsFromLineItem(kind: string, item: PlantLineItem): PlantVisualCard[] {
  if (item.photos?.length) {
    return item.photos.map((photo) => ({
      caption: photo.caption,
      documents: item.documents,
      imageUrl: photo.url,
      kind,
      meta: `${item.volume} · ${item.spec}`,
      source: photo.source ?? item.source,
      title: photo.alt,
    }))
  }

  return [visualCardFromText(kind, item.name, `${item.volume} · ${item.spec}`, item.documents)]
}

function visualCardFromText(kind: string, title: string, meta: string, documents: string[]): PlantVisualCard {
  const reference = visualReferenceForText(`${title} ${meta}`)

  return {
    caption: reference.caption,
    documents,
    imageUrl: reference.imageUrl,
    kind,
    meta,
    source: reference.source,
    title: reference.title === 'Жидкая/опасная химия в таре' ? title : `${title} · ${reference.title}`,
  }
}

function visualReferenceForText(text: string) {
  const normalized = text.toLocaleLowerCase('ru-RU')
  return (
    plantVisualReferences.find((reference) =>
      reference.keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase('ru-RU'))),
    ) ?? plantVisualReferences[plantVisualReferences.length - 1]
  )
}

function lineItemCharacteristics(item: PlantLineItem): Array<[string, string]> {
  const core: Array<[string, string] | null> = [
    item.cas ? ['CAS', item.cas] : null,
    item.formula ? ['Формула', item.formula] : null,
    item.standards?.length ? ['Стандарты', item.standards.join(', ')] : null,
    item.price ? ['Цена/бюджет', item.price] : null,
    item.volume ? ['Объём/период', item.volume] : null,
  ]
  const typed = item.characteristics?.map((characteristic) => [characteristic.label, characteristic.value] as [string, string]) ?? []
  const parsed = splitSpec(item.spec).map((part) => [labelSpecPart(part), part] as [string, string])
  const seen = new Set<string>()
  const seenValues = new Set<string>()

  return [...core.filter((entry): entry is [string, string] => Boolean(entry)), ...typed, ...parsed]
    .filter(([, value]) => Boolean(value))
    .filter(([label, value]) => {
      if (seenValues.has(value)) return false
      seenValues.add(value)
      const key = `${label}-${value}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 10)
}

function splitSpec(spec: string) {
  return spec
    .split(/\s*[;|]\s*|\s*,\s+(?=[А-ЯA-Zа-яa-z0-9])/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 3)
    .slice(0, 5)
}

function labelSpecPart(part: string) {
  const normalized = part.toLocaleLowerCase('ru-RU')
  if (/гост|ту\s|сто|iso|astm/u.test(normalized)) return 'Норматив'
  if (/%|чда|хч|purity|содержание|основн|массов/u.test(normalized)) return 'Чистота/состав'
  if (/мм|mesh|фракц|гранул|частиц/u.test(normalized)) return 'Фракция/размер'
  if (/упаков|тара|меш|боч|канистр|цистер/u.test(normalized)) return 'Упаковка'
  if (/марка|grade|сорт/u.test(normalized)) return 'Марка'
  if (/влага|вод/u.test(normalized)) return 'Влага'
  if (/цвет|белизн|оттен/u.test(normalized)) return 'Внешний вид'
  return 'Требование'
}

function InlineSourceButton({
  setSelectedSource,
  source,
}: {
  setSelectedSource: (source: SourceRecord) => void
  source: SourceRecord
}) {
  return (
    <button
      aria-label="откуда взяты данные"
      className="source-button inline-source-button"
      type="button"
      onClick={() => setSelectedSource(source)}
    >
      <FileText aria-hidden="true" size={14} />
      Досье
    </button>
  )
}

function ProcurementDossier({ evidence }: { evidence: PlantProcurementSignal }) {
  const hasDossier =
    evidence.documentDossier?.length ||
    evidence.lineItems?.length ||
    evidence.requirements?.length ||
    evidence.contractTerms?.length ||
    evidence.extractionTasks?.length

  if (!hasDossier) return null

  return (
    <div className="procurement-dossier">
      {evidence.lineItems?.length ? (
        <section>
          <h3>Позиции закупки</h3>
          <div className="procurement-line-items">
            {evidence.lineItems.map((item) => (
              <article key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.volume}</span>
                </div>
                <p>{item.spec}</p>
                {item.price ? <small>{item.price}</small> : null}
                <div className="document-grid muted">
                  {item.documents.map((documentName) => (
                    <span key={documentName}>{documentName}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {evidence.requirements?.length ? (
        <DossierList title="ТЗ и требования" items={evidence.requirements} />
      ) : null}
      <DossierList title="Пакет документов" items={evidence.documents} />
      {evidence.documentDossier?.length ? <DocumentDossier documents={evidence.documentDossier} /> : null}
      {evidence.contractTerms?.length ? (
        <DossierList title="Условия договора" items={evidence.contractTerms} />
      ) : null}
      {evidence.extractionTasks?.length ? (
        <DossierList title="Что дозагрузить" items={evidence.extractionTasks} />
      ) : null}
    </div>
  )
}

function DocumentDossier({
  documents,
}: {
  documents: NonNullable<PlantProcurementSignal['documentDossier']>
}) {
  return (
    <section>
      <h3>Документы в сервисе</h3>
      <div className="procurement-document-dossier">
        {documents.map((document) => (
          <article key={document.name}>
            <div>
              <strong>{document.name}</strong>
              <span>{document.status}</span>
            </div>
            <p>{document.summary}</p>
            <ul>
              {document.contents.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}

function DossierList({ items, title }: { items: string[]; title: string }) {
  return (
    <section>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

function sourceFromDetailCompany(detail: PlantDetail): SourceRecord {
  return {
    description: [
      `Компания: ${detail.company.display_name}`,
      detail.company.legal_name ? `Юрлицо: ${detail.company.legal_name}` : null,
      detail.company.inn ? `ИНН: ${detail.company.inn}` : null,
      detail.company.ogrn ? `ОГРН: ${detail.company.ogrn}` : null,
      detail.company.address ? `Адрес: ${detail.company.address}` : null,
      detail.company.website ? `Официальный сайт: ${detail.company.website}` : null,
    ]
      .filter(Boolean)
      .join('. '),
    level: detail.company.data_level === 'verified_profile' ? 'verified' : 'lead',
    name: 'Внутренняя карточка завода',
    update: detail.company.data_level,
    url: detail.company.source_url,
  }
}

function sourceFromDetailProcurementEvent(event: DetailProcurementEvent): SourceRecord {
  return {
    description: [
      event.title,
      event.customer ? `Заказчик: ${event.customer}` : null,
      event.price ? `Цена/НМЦК: ${event.price}` : null,
      event.law ? `Закон: ${event.law}` : null,
      event.items.length ? `Позиции: ${event.items.map((item) => `${item.name}: ${item.spec}`).join('; ')}` : null,
    ]
      .filter(Boolean)
      .join('. '),
    level: sourceLevelFromStatus(event.status),
    name: 'Закупочное событие в карточке',
    update: event.status,
    url: event.source_url,
  }
}

function sourceFromLineItem(item: PlantLineItem, context: string): SourceRecord {
  return {
    description: [
      context,
      `Позиция: ${item.name}`,
      `Объем: ${item.volume}`,
      item.price ? `Цена: ${item.price}` : null,
      item.responsible ? `Ответственный: ${formatResponsible(item.responsible)}` : null,
      item.cas ? `CAS: ${item.cas}` : null,
      item.formula ? `Формула: ${item.formula}` : null,
      item.standards?.length ? `Стандарты: ${item.standards.join(', ')}` : null,
      item.pubchemCid ? `PubChem CID: ${item.pubchemCid}` : null,
      `Характеристики: ${item.spec}`,
      item.note ? `Комментарий: ${item.note}` : null,
      item.documents.length ? `Документы: ${item.documents.join(', ')}` : null,
      item.chemicalSourceUrl ? `Химический справочник: ${item.chemicalSourceUrl}` : null,
    ]
      .filter(Boolean)
      .join('. '),
    level: sourceLevelFromStatus(item.status),
    name: item.source,
    update: item.status,
    url: item.sourceUrl ?? 'URL не указан; данные сохранены в карточке TenderStart',
  }
}

function ResponsibleLine({ item }: { item: PlantLineItem }) {
  if (!item.responsible) return null

  return (
    <div className="responsible-line">
      <span>Ответственный за позицию</span>
      <strong>{item.responsible.name}</strong>
      <small>
        {[item.responsible.role, item.responsible.phone, item.responsible.email].filter(Boolean).join(' · ')}
      </small>
    </div>
  )
}

function chemicalBadges(item: PlantLineItem) {
  return [
    item.cas ? `CAS ${item.cas}` : null,
    item.formula ?? null,
    ...(item.standards ?? []),
  ].filter((badge): badge is string => Boolean(badge))
}

function lineItemNote(item: PlantLineItem) {
  if (!item.note || !item.responsible) return item.note
  return item.note.replace(/^Ответственный: .*?\. В КП/u, 'В КП')
}

function formatResponsible(responsible: NonNullable<PlantLineItem['responsible']>) {
  return `${responsible.role}: ${responsible.name}${responsible.phone ? `, ${responsible.phone}` : ''}${responsible.email ? `, ${responsible.email}` : ''}`
}

function sourceFromBuyer(buyer: Buyer, material: Material): SourceRecord {
  return {
    description: [
      `Вещество: ${material.name}`,
      `Покупатель: ${buyer.name}`,
      `Регион: ${buyer.region}`,
      `Объем/заявка: ${buyer.volume}`,
      `Условия: ${buyer.terms}`,
      `Период: ${buyer.period}`,
      `Контакт/канал: ${buyer.contact}`,
    ].join('. '),
    level: sourceLevelFromStatus(buyer.status),
    name: buyer.source,
    update: buyer.status,
    url: buyer.sourceUrl ?? 'URL не указан; данные сохранены в карточке TenderStart',
  }
}

function sourceFromProcurementEvidence(evidence: PlantProcurementSignal): SourceRecord {
  return {
    description: [
      evidence.title,
      evidence.note,
      evidence.lineItems?.length
        ? `Позиции: ${evidence.lineItems.map((item) => `${item.name} (${item.volume}; ${item.spec})`).join('; ')}`
        : null,
      evidence.requirements?.length ? `ТЗ: ${evidence.requirements.join('; ')}` : null,
      evidence.inferredNeeds.length ? `Что нужно заводу: ${evidence.inferredNeeds.join(', ')}` : null,
      evidence.documents.length ? `Документы: ${evidence.documents.join(', ')}` : null,
      evidence.documentDossier?.length
        ? `Досье документов: ${evidence.documentDossier.map((document) => `${document.name} - ${document.summary}`).join('; ')}`
        : null,
      evidence.contractTerms?.length ? `Условия договора: ${evidence.contractTerms.join('; ')}` : null,
      evidence.extractionTasks?.length ? `Дозагрузить агенту: ${evidence.extractionTasks.join('; ')}` : null,
    ]
      .filter(Boolean)
      .join('. '),
    level: sourceLevelFromStatus(evidence.status),
    name: evidence.source,
    update: evidence.date ? `${evidence.status}, ${evidence.date}` : evidence.status,
    url: evidence.sourceUrl,
  }
}

function sourceFromEcosysRecord(record: EcosysChemicalRecord, ecosysChemicalCatalog: EcosysChemicalSnapshot): SourceRecord {
  return {
    description: [
      `Внутренняя карточка ECOSYS: ${record.name}`,
      `CID: ${record.cid}`,
      record.cas.length ? `CAS: ${record.cas.join(', ')}` : 'CAS в синонимах PubChem не найден',
      record.formula ? `Формула: ${record.formula}` : null,
      record.molecularWeight ? `Молекулярная масса: ${record.molecularWeight}` : null,
      record.storagePath ? `Локальное досье: ${record.storagePath}` : null,
      record.documents.length ? `Документы к сделке: ${record.documents.join(', ')}` : null,
      `ECOSYS root: ${ecosysChemicalCatalog.root}`,
    ]
      .filter(Boolean)
      .join('. '),
    level: record.cas.length ? 'estimated' : 'lead',
    name: `ECOSYS / PubChem CID ${record.cid}`,
    update: `snapshot ${ecosysChemicalCatalog.generatedAt.slice(0, 10)}`,
    url: record.sourceUrl,
  }
}

function sourceQualityFromPlant(plant: Plant): SourceQualityMetadata {
  const quality = plantQualitySummary(plant)

  return {
    entityLevel: quality.entityLevel,
    hasAddress: quality.hasAddress,
    hasProductEvidence: quality.hasProductEvidence,
    kind: quality.dataQuality === 'lead' ? 'lead' : quality.entityLevel,
    needsOfficialVerification: quality.needsOfficialVerification,
    summary: quality.needsOfficialVerification
      ? 'Official verification required: site, documents or tender must confirm this lead.'
      : 'Official verification is present or not required for this source level.',
    verification: quality.verification,
  }
}

function sourceFromPlant(plant: Plant): SourceRecord {
  return {
    description: [
      `Карточка завода: ${plant.name}`,
      plant.products.length ? `Продукция: ${plant.products.join(', ')}` : null,
      plant.purchaseCategories?.length ? `Закупочные категории: ${plant.purchaseCategories.join(', ')}` : null,
      plant.documents?.length ? `Документы: ${plant.documents.join(', ')}` : null,
      plant.entityLevel ? `Уровень сущности: ${entityLevelLabel(plant.entityLevel)}` : null,
      plant.verification?.length ? `Подтверждения: ${plant.verification.join('; ')}` : null,
      plant.needsOfficialVerification ? 'Нужна официальная проверка сайта, документов или тендера' : null,
    ]
      .filter(Boolean)
      .join('. '),
    level: plant.dataQuality ?? 'lead',
    name: plant.source,
    quality: sourceQualityFromPlant(plant),
    update: 'данные сохранены в карточке TenderStart',
    url: plant.sourceUrl ?? 'URL не указан',
  }
}

function sourceLevelFromStatus(status: string): SourceRecord['level'] {
  const normalized = status.toLowerCase()
  if (normalized.includes('подтверж')) return 'verified'
  if (normalized.includes('оцен') || normalized.includes('поиск')) return 'estimated'
  return 'lead'
}

function PlantLogo({ plant, size = 'normal' }: { plant: Plant; size?: 'large' | 'normal' }) {
  const logoUrl = getPlantLogoUrl(plant)

  return (
    <span
      aria-label={`Логотип ${plant.name}`}
      className={size === 'large' ? 'plant-logo large' : 'plant-logo'}
      role="img"
    >
      {logoUrl ? (
        <img
          alt=""
          src={logoUrl}
          onError={(event) => {
            event.currentTarget.remove()
          }}
        />
      ) : null}
      <span>{plant.logoLabel ?? getPlantInitials(plant.name)}</span>
    </span>
  )
}

function getPlantLogoUrl(plant: Plant) {
  if (plant.logoUrl) return plant.logoUrl
  if (!plant.website) return undefined

  try {
    const domain = new URL(plant.website).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
  } catch {
    return undefined
  }
}

function getPlantInitials(name: string) {
  const words = name
    .replace(/[«»"()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function SupplierPage({
  navigateTo,
  supplierHit,
}: {
  navigateTo: (path: string) => void
  supplierHit: SupplierHit
}) {
  const { material, ...supplier } = supplierHit

  return (
    <section className="page-stack">
      <div className="page-hero">
        <span className="screen-label">Поставщик</span>
        <h1>{supplier.name}</h1>
        <p>
          {material.name}. Главная задача страницы: отделить настоящего производителя от посредника
          и понять, можно ли строить сделку.
        </p>
      </div>
      <div className="deal-room-grid">
        <article>
          <h2>Профиль</h2>
          <p>{supplier.kind} · {supplier.country}</p>
          <p>{supplier.capacity}</p>
          <p>{supplier.reliability} · уверенность {supplier.confidence}</p>
        </article>
        <article>
          <h2>Продукт</h2>
          <p>{material.name}</p>
          <p>{supplier.grade}</p>
          <p>{supplier.spec}</p>
          <div className="document-grid">
            {supplier.docs.map((doc) => (
              <span key={doc}>{doc}</span>
            ))}
          </div>
        </article>
        <article>
          <h2>Экономика</h2>
          <strong>{supplier.landed}</strong>
          <p>FOB/EXW: {supplier.fob}</p>
          <p>До склада: {supplier.landed}</p>
          <p>MOQ: {supplier.moq}</p>
          <p>{supplier.route} · {supplier.leadTime}</p>
        </article>
      </div>
      <div className="page-action-row">
        <button className="primary-action inline" type="button" onClick={() => navigateTo(dealPathForMaterial(material.slug))}>
          Собрать RFQ
        </button>
        <button className="ghost-action" type="button" onClick={() => navigateTo(`/materials/${material.slug}`)}>
          Вернуться к веществу
        </button>
        <button className="ghost-action" type="button" onClick={() => navigateTo(`/map/${material.slug}`)}>
          Карта маршрута
        </button>
      </div>
    </section>
  )
}

function BuyerPage({
  buyerHit,
  navigateTo,
}: {
  buyerHit: BuyerHit
  navigateTo: (path: string) => void
}) {
  const { material, ...buyer } = buyerHit

  return (
    <section className="page-stack">
      <div className="page-hero">
        <span className="screen-label">Покупатели</span>
        <h1>{buyer.name}</h1>
        <p>
          {buyer.region}. Карточка покупателя показывает конкретную потребность,
          параметры закупки и подходящих поставщиков.
        </p>
      </div>
      <div className="deal-room-grid">
        <article>
          <h2>Потребность</h2>
          <p>{material.name}</p>
          <strong>{buyer.volume}</strong>
          <p>{buyer.volume} · {buyer.period}</p>
          <p>{buyer.terms}</p>
        </article>
        <article>
          <h2>Контакт / источник</h2>
          <p>{buyer.contact}</p>
          <p>{buyer.status}</p>
          <p>{buyer.source}</p>
        </article>
        <article>
          <h2>Подходящие поставщики</h2>
          <div className="buyer-supplier-list">
            {material.suppliers.slice(0, 3).map((supplier) => (
              <button
                key={supplier.slug}
                type="button"
                onClick={() => navigateTo(`/suppliers/${supplier.slug}`)}
              >
                <strong>{supplier.name}</strong>
                <span>{supplier.landed} · {supplier.capacity}</span>
              </button>
            ))}
          </div>
        </article>
      </div>
      <button className="primary-action inline" type="button" onClick={() => navigateTo(dealPathForMaterial(material.slug))}>
        Подготовить КП покупателю
      </button>
    </section>
  )
}

function SourceDrawer({ onClose, source }: { onClose: () => void; source: SourceRecord }) {
  const sourceUrlLabel = isHttpUrl(source.url) ? source.url.replace(/^https?:\/\//i, '') : source.url

  return (
    <aside className="source-drawer" role="dialog" aria-label="Источник данных">
      <button className="drawer-close" type="button" onClick={onClose}>
        Закрыть
      </button>
      <span className={`source-level ${source.level}`}>{sourceLevelLabel(source.level)}</span>
      <h2>{source.name}</h2>
      <p>{source.description}</p>
      <SourceQualityBlock quality={source.quality} />
      <dl>
        <dt>Обновление</dt>
        <dd>{source.update}</dd>
        <dt>Где проверялось</dt>
        <dd className="source-audit-url">{sourceUrlLabel}</dd>
        <dt>Статус в сервисе</dt>
        <dd>Данные перенесены в карточку TenderStart; внешний адрес нужен только для аудита.</dd>
      </dl>
    </aside>
  )
}

function SourceQualityBlock({ quality }: { quality?: SourceQualityMetadata }) {
  if (!quality) return null

  const hasAddress = quality.hasAddress ?? false
  const hasProductEvidence = quality.hasProductEvidence ?? false
  const needsOfficialVerification = quality.needsOfficialVerification ?? false
  const productEvidenceLabel = hasProductEvidence
    ? needsOfficialVerification
      ? 'Продукция заявлена'
      : 'Продукция подтверждена'
    : 'Продукция не подтверждена'

  return (
    <section className="source-quality-card" aria-label="Качество источника">
      <h3>Что подтверждает источник</h3>
      <div className="plant-quality-strip">
        <span>{sourceKindLabel(quality.kind)}</span>
        {quality.entityLevel ? <span>{entityLevelLabel(quality.entityLevel)}</span> : null}
        <span className={hasAddress ? 'ok' : 'todo'}>{hasAddress ? 'Адрес есть' : 'Адрес нужен'}</span>
        <span className={hasProductEvidence && !needsOfficialVerification ? 'ok' : 'todo'}>
          {productEvidenceLabel}
        </span>
        <span className={needsOfficialVerification ? 'todo' : 'ok'}>
          {needsOfficialVerification ? 'Нужна проверка' : 'Проверено'}
        </span>
      </div>
      {quality.summary ? <p>{quality.summary}</p> : null}
      {quality.verification?.length ? (
        <div className="source-quality-list">
          {quality.verification.slice(0, 4).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function readRoute(): RouteState {
  const [, rawSection, rawSlug] = window.location.pathname.split('/')
  const section = toSection(rawSection)

  if (!section) return { section: 'materials', slug: 'sulfur' }
  return { section, slug: rawSlug || 'sulfur' }
}

function toSection(value?: string): Section | undefined {
  if (
    value === 'buyers' ||
    value === 'chemicals' ||
    value === 'deals' ||
    value === 'demo' ||
    value === 'map' ||
    value === 'materials' ||
    value === 'plants' ||
    value === 'producer' ||
    value === 'producers' ||
    value === 'rules' ||
    value === 'search' ||
    value === 'sources' ||
    value === 'suppliers'
  ) {
    return value
  }
  return undefined
}

export default App
