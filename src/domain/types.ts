export type RiskLevel = 'low' | 'medium' | 'high'

export type Product = {
  id: string
  name: string
  category: string
  aliases: string[]
  description: string
  okpd2?: string
  hsCode?: string
  cas?: string
  formula?: string
  tnved?: string
  hazardClass?: string
}

export type DataSourceRef = {
  label: string
  url: string
  kind: 'official' | 'price-index' | 'marketplace' | 'procurement' | 'seed-estimate'
  note?: string
}

export type ProductOffer = {
  productId: string
  capacityTonsYear: number
  quality: string
  priceRubPerTon: number
  minLotTons: number
}

export type Producer = {
  id: string
  name: string
  region: string
  country: string
  coordinates: [number, number]
  products: ProductOffer[]
  needs?: string[]
}

export type BuyerNeed = {
  id: string
  organization: string
  region: string
  productId: string
  volumeTons: number
  maxPriceRubPerTon: number
  deliveryRegion: string
  deadline: string
  source: string
  procurementUrl?: string
}

export type LogisticsRoute = {
  fromRegion: string
  toRegion: string
  rubPerTon: number
  days: number
  risk: RiskLevel
}

export type DealEconomics = {
  deliveredCostRubPerTon: number
  marginRubPerTon: number
  marginPercent: number
  totalPotentialProfitRub: number
  taxRubPerTon: number
}

export type OpportunityCard = {
  id: string
  producer: Producer
  offer: ProductOffer
  buyer: BuyerNeed
  route: LogisticsRoute
  economics: DealEconomics
  score: number
}

export type AiBrief = {
  headline: string
  summary: string
  actions: string[]
  risks: string[]
  confidence: 'низкая' | 'средняя' | 'высокая'
}

export type ImportIncoterm = 'EXW' | 'FOB' | 'CIF'

export type SupplierCountry = 'India' | 'China'

export type SupplierProduct = {
  productId: string
  priceUsdPerTon: number
  incoterm: ImportIncoterm
  moqTons: number
  monthlyCapacityTons: number
  quality: string
  documents: string[]
  grade?: 'premium' | 'standard' | 'economy'
  specs?: Array<{
    label: string
    value: string
  }>
  bestFor?: string
  tradeOff?: string
  packaging?: string
  sampleLeadDays?: number
  priceSource?: DataSourceRef
}

export type IndianSupplier = {
  id: string
  name: string
  country: SupplierCountry
  state: string
  city: string
  exportContact: string
  website?: string
  products: SupplierProduct[]
}

export type RussiaDemand = {
  id: string
  organization: string
  region: string
  productId: string
  monthlyVolumeTons: number
  targetPriceRubPerTon: number
  source: string
  buyerContact: string
  procurementUrl?: string
  publishedAt?: string
  confidence?: 'low' | 'medium' | 'high'
}

export type RussiaDemandFeed = {
  updatedAt: string
  source: string
  items: RussiaDemand[]
}

export type TradeLane = {
  id: string
  from: string
  to: string
  seaPort: string
  borderPoint: string
  costUsdPerTon: number
  days: number
  dutyRate: number
  vatRate: number
  risk: RiskLevel
  routeType?: 'primary' | 'bypass'
  note?: string
}

export type ImportEconomics = {
  landedCostRubPerTon: number
  marginRubPerTon: number
  marginPercent: number
  monthlyProfitRub: number
  dutyRubPerTon: number
  vatRubPerTon: number
  requiredDocuments: string[]
}

export type ImportOpportunity = {
  id: string
  supplier: IndianSupplier
  supplierProduct: SupplierProduct
  demand: RussiaDemand
  lane: TradeLane
  economics: ImportEconomics
  score: number
}

export type ImportRouteOption = {
  id: string
  label: string
  lane: TradeLane
  economics: ImportEconomics
  deltaRubPerTon: number
}

export type IndustrialDocument = {
  type: 'COA' | 'MSDS' | 'SDS' | 'contract' | 'certificate' | 'catalog'
  title: string
  status: 'public' | 'request-required' | 'template'
  url?: string
  note?: string
}

export type PlantProductProfile = {
  productId?: string
  name: string
  volumeNote: string
  qualityNote: string
  frequency: string
}

export type PlantNeedProfile = {
  productId?: string
  name: string
  volumeNote: string
  frequency: string
  qualityTarget: string
  source: string
  buyerPattern?: string
  alternatives?: PlantNeedAlternative[]
}

export type PlantNeedAlternative = {
  name: string
  whenUseful: string
  tradeOff: string
  directProducerNames: string[]
  documents: Array<IndustrialDocument['type']>
  riskNote: string
}

export type IndustrialPlant = {
  id: string
  name: string
  region: 'Башкортостан' | 'Татарстан'
  city: string
  industry: string
  website: string
  sourceUrl: string
  products: PlantProductProfile[]
  needs: PlantNeedProfile[]
  documents: IndustrialDocument[]
  procurementNotes: string
}

export type LogisticsCompany = {
  id: string
  name: string
  website: string
  modes: string[]
  industrialFit: string
  routes: string[]
  documents: string[]
  riskNote: string
}

export type DirectProducerCoverage = {
  productId: string
  producerName: string
  country: SupplierCountry | 'Russia'
  website: string
  manufacturerOnly: boolean
  coversPlantIds: string[]
  productLine: string
  priceNote: string
  documents: IndustrialDocument[]
  nextStep: string
}

export type GlobalPlantProduct = {
  productId?: string
  name: string
  estimatedMonthlyVolumeTons: number
  priceUsdPerTon: number
  priceSource: DataSourceRef
  quality: string
  documents: IndustrialDocument[]
}

export type GlobalChemicalPlant = {
  id: string
  name: string
  country: SupplierCountry
  state: string
  city: string
  coordinates: [number, number]
  mapPosition: { x: number; y: number }
  website: string
  sourceUrl: string
  products: GlobalPlantProduct[]
}

export type GlobalSupplyFlow = {
  id: string
  plantId: string
  productIds: string[]
  from: string
  to: string
  routeLabel: string
  days: number
  costUsdPerTon: number
  risk: RiskLevel
  destinationPosition: { x: number; y: number }
}
