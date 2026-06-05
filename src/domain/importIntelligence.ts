import type {
  AiBrief,
  ImportEconomics,
  ImportOpportunity,
  ImportRouteOption,
  IndianSupplier,
  RussiaDemand,
  TradeLane,
} from './types'

type ImportEconomicsInput = {
  supplier: IndianSupplier
  demand: RussiaDemand
  lane: TradeLane
  usdRub: number
}

type ImportOpportunityInput = {
  productId: string
  suppliers: IndianSupplier[]
  demands: RussiaDemand[]
  lanes: TradeLane[]
  usdRub: number
  onlyProfitable?: boolean
}

type ImportRouteOptionsInput = {
  supplier: IndianSupplier
  demand: RussiaDemand
  lanes: TradeLane[]
  usdRub: number
}

export function calculateImportEconomics({
  supplier,
  demand,
  lane,
  usdRub,
}: ImportEconomicsInput): ImportEconomics {
  const supplierProduct = supplier.products.find(
    (product) => product.productId === demand.productId,
  )

  if (!supplierProduct) {
    throw new Error(`Supplier ${supplier.id} does not offer ${demand.productId}`)
  }

  const customsBaseUsdPerTon =
    supplierProduct.priceUsdPerTon + lane.costUsdPerTon
  const dutyRubPerTon = Math.round(
    customsBaseUsdPerTon * lane.dutyRate * usdRub,
  )
  const vatRubPerTon = Math.round(customsBaseUsdPerTon * lane.vatRate * usdRub)
  const landedCostRubPerTon = Math.round(
    customsBaseUsdPerTon * (1 + lane.dutyRate + lane.vatRate) * usdRub,
  )
  const marginRubPerTon = demand.targetPriceRubPerTon - landedCostRubPerTon
  const monthlyProfitRub = marginRubPerTon * demand.monthlyVolumeTons
  const marginPercent = Number(
    ((marginRubPerTon / demand.targetPriceRubPerTon) * 100).toFixed(1),
  )

  return {
    landedCostRubPerTon,
    marginRubPerTon,
    marginPercent,
    monthlyProfitRub,
    dutyRubPerTon,
    vatRubPerTon,
    requiredDocuments: supplierProduct.documents,
  }
}

export function buildImportOpportunities({
  productId,
  suppliers,
  demands,
  lanes,
  usdRub,
  onlyProfitable = false,
}: ImportOpportunityInput): ImportOpportunity[] {
  const opportunities: ImportOpportunity[] = []

  for (const supplier of suppliers) {
    const supplierProduct = supplier.products.find(
      (product) => product.productId === productId,
    )

    if (!supplierProduct) continue

    for (const demand of demands.filter((item) => item.productId === productId)) {
      const lane = findLane(lanes, demand.region, supplier.country)
      const economics = calculateImportEconomics({
        supplier,
        demand,
        lane,
        usdRub,
      })

      if (onlyProfitable && economics.marginRubPerTon <= 0) continue

      opportunities.push({
        id: `${supplier.id}-${demand.id}-${lane.id}`,
        supplier,
        supplierProduct,
        demand,
        lane,
        economics,
        score: scoreImportOpportunity(economics, demand, lane),
      })
    }
  }

  return opportunities.sort(
    (a, b) => b.economics.monthlyProfitRub - a.economics.monthlyProfitRub,
  )
}

export function buildImportRouteOptions({
  supplier,
  demand,
  lanes,
  usdRub,
}: ImportRouteOptionsInput): ImportRouteOption[] {
  const matchingLanes = lanes.filter(
    (lane) =>
      lane.from.includes(supplier.country) &&
      isLaneForDemandRegion(lane, demand.region),
  )
  const fallbackLane = findLane(lanes, demand.region, supplier.country)
  const routeLanes = matchingLanes.length > 0 ? matchingLanes : [fallbackLane]
  const pricedRoutes = routeLanes
    .map((lane) => ({
      lane,
      economics: calculateImportEconomics({ supplier, demand, lane, usdRub }),
    }))
    .sort((a, b) => {
      if (a.lane.routeType === b.lane.routeType) {
        return a.economics.landedCostRubPerTon - b.economics.landedCostRubPerTon
      }
      return a.lane.routeType === 'primary' ? -1 : 1
    })
  const baseline = pricedRoutes[0]?.economics.landedCostRubPerTon ?? 0

  return pricedRoutes.map(({ lane, economics }) => ({
    id: lane.id,
    label: lane.routeType === 'bypass' ? 'Обходной маршрут' : 'Базовый маршрут',
    lane,
    economics,
    deltaRubPerTon: economics.landedCostRubPerTon - baseline,
  }))
}

export function buildImportBrief(opportunity: ImportOpportunity): AiBrief {
  const profitable = opportunity.economics.marginRubPerTon > 0
  const sourceCountry =
    opportunity.supplier.country === 'China' ? 'Китай' : 'Индия'

  return {
    headline: profitable
      ? `${sourceCountry} → РФ: есть импортная связка с маржой`
      : `${sourceCountry} → РФ: экономика пока не сходится`,
    summary: profitable
      ? `${opportunity.supplier.name} может закрыть спрос ${opportunity.demand.organization}: оценочная месячная маржа ${formatRub(opportunity.economics.monthlyProfitRub)}.`
      : `Целевая цена ${opportunity.demand.organization} ниже landed cost по маршруту ${opportunity.lane.from} → ${opportunity.lane.to}.`,
    actions: [
      'Запросить SDS, COA и актуальный FOB',
      'Проверить экспортный опыт поставщика в РФ/ЕАЭС',
      'Получить контакты закупщика и подтвердить месячный объём',
    ],
    risks: [
      'Проверить код ТН ВЭД и ставку пошлины',
      opportunity.lane.risk === 'high'
        ? 'Высокий логистический риск'
        : 'Нужна проверка маршрута и сроков оплаты',
    ],
    confidence:
      profitable && opportunity.lane.risk === 'medium' ? 'средняя' : 'низкая',
  }
}

function findLane(
  lanes: TradeLane[],
  region: string,
  country: IndianSupplier['country'],
): TradeLane {
  return (
    lanes.find(
      (lane) =>
        lane.routeType !== 'bypass' &&
        lane.to.includes(region) &&
        lane.from.includes(country),
    ) ??
    lanes.find((lane) => lane.to.includes(region) && lane.from.includes(country)) ??
    lanes.find((lane) => lane.to.includes(region)) ??
    lanes.find((lane) => lane.from.includes(country)) ??
    lanes[0] ?? {
      id: `default-${country.toLowerCase()}-russia`,
      from: country,
      to: region,
      seaPort: 'Mundra',
      borderPoint: 'Новороссийск',
      costUsdPerTon: 120,
      days: 35,
      dutyRate: 0.05,
      vatRate: 0.2,
      risk: 'medium',
    }
  )
}

function isLaneForDemandRegion(lane: TradeLane, region: string): boolean {
  const laneDestination = lane.to.toLowerCase()
  const demandRegion = region.toLowerCase()

  return (
    laneDestination.includes(demandRegion) ||
    (demandRegion.includes('башкортостан') &&
      (laneDestination.includes('башкортостан') || laneDestination.includes('уфа')))
  )
}

function scoreImportOpportunity(
  economics: ImportEconomics,
  demand: RussiaDemand,
  lane: TradeLane,
): number {
  const marginScore = Math.max(0, Math.min(45, economics.marginPercent * 8))
  const volumeScore = Math.min(25, demand.monthlyVolumeTons / 4)
  const routeScore = lane.risk === 'low' ? 20 : lane.risk === 'medium' ? 12 : 4
  const documentScore = economics.requiredDocuments.length >= 3 ? 10 : 4

  return Math.round(marginScore + volumeScore + routeScore + documentScore)
}

function formatRub(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'RUB',
  }).format(value)
}
