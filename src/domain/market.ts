import type {
  AiBrief,
  BuyerNeed,
  DealEconomics,
  LogisticsRoute,
  OpportunityCard,
  Producer,
} from './types'

type EconomicsInput = {
  producer: Producer
  need: BuyerNeed
  route: LogisticsRoute
  taxRate?: number
}

type OpportunityInput = {
  productId: string
  producers: Producer[]
  needs: BuyerNeed[]
  routes: LogisticsRoute[]
  onlyProfitable?: boolean
  taxRate?: number
}

export function calculateDealEconomics({
  producer,
  need,
  route,
  taxRate = 0.2,
}: EconomicsInput): DealEconomics {
  const offer = producer.products.find((item) => item.productId === need.productId)

  if (!offer) {
    throw new Error(`Producer ${producer.id} does not offer ${need.productId}`)
  }

  const costBeforeTax = offer.priceRubPerTon + route.rubPerTon
  const taxRubPerTon = Math.round(costBeforeTax * taxRate)
  const deliveredCostRubPerTon = costBeforeTax + taxRubPerTon
  const marginRubPerTon = need.maxPriceRubPerTon - deliveredCostRubPerTon
  const totalPotentialProfitRub = marginRubPerTon * need.volumeTons
  const marginPercent = (marginRubPerTon / need.maxPriceRubPerTon) * 100

  return {
    deliveredCostRubPerTon,
    marginRubPerTon,
    marginPercent: Number(marginPercent.toFixed(1)),
    totalPotentialProfitRub,
    taxRubPerTon,
  }
}

export function buildOpportunityCards({
  productId,
  producers,
  needs,
  routes,
  onlyProfitable = false,
  taxRate = 0.2,
}: OpportunityInput): OpportunityCard[] {
  const cards: OpportunityCard[] = []

  for (const producer of producers) {
    const offer = producer.products.find((item) => item.productId === productId)

    if (!offer) continue

    for (const need of needs.filter((item) => item.productId === productId)) {
      const route = findRoute(routes, producer.region, need.deliveryRegion)
      const economics = calculateDealEconomics({
        producer,
        need,
        route,
        taxRate,
      })

      if (onlyProfitable && economics.marginRubPerTon <= 0) continue

      cards.push({
        id: `${producer.id}-${need.id}`,
        producer,
        offer,
        buyer: need,
        route,
        economics,
        score: scoreOpportunity(economics, need, route),
      })
    }
  }

  return cards.sort(
    (a, b) =>
      b.economics.totalPotentialProfitRub - a.economics.totalPotentialProfitRub,
  )
}

export function buildAiBrief(opportunity: OpportunityCard): AiBrief {
  const sameCountry = opportunity.producer.country === 'Россия'
  const sameRegion = opportunity.producer.region === opportunity.buyer.deliveryRegion
  const profitable = opportunity.economics.marginRubPerTon > 0

  return {
    headline:
      sameCountry && sameRegion
        ? 'Есть локальная замена с положительной маржой'
        : 'Есть поставка с потенциалом импортозамещения',
    summary: profitable
      ? `${opportunity.producer.name} может закрыть потребность ${opportunity.buyer.organization}: оценочная маржа ${formatRub(opportunity.economics.totalPotentialProfitRub)}.`
      : `Цена закупки ниже расчётной себестоимости поставки от ${opportunity.producer.name}.`,
    actions: [
      'Проверить спецификацию качества',
      'Запросить коммерческое предложение у производителя',
      'Сравнить условия доставки и отсрочки платежа',
    ],
    risks: [
      'Цена поставщика условная',
      opportunity.route.risk === 'high'
        ? 'Высокий логистический риск'
        : 'Нужно подтвердить доступность объёма',
    ],
    confidence: sameRegion && profitable ? 'средняя' : 'низкая',
  }
}

function findRoute(
  routes: LogisticsRoute[],
  fromRegion: string,
  toRegion: string,
): LogisticsRoute {
  return (
    routes.find(
      (route) =>
        route.fromRegion === fromRegion && route.toRegion === toRegion,
    ) ?? {
      fromRegion,
      toRegion,
      rubPerTon: fromRegion === toRegion ? 1_200 : 4_500,
      days: fromRegion === toRegion ? 1 : 5,
      risk: fromRegion === toRegion ? 'low' : 'medium',
    }
  )
}

function scoreOpportunity(
  economics: DealEconomics,
  need: BuyerNeed,
  route: LogisticsRoute,
): number {
  const marginScore = Math.max(0, Math.min(45, economics.marginPercent * 4))
  const volumeScore = Math.min(30, need.volumeTons / 14)
  const routeScore = route.risk === 'low' ? 20 : route.risk === 'medium' ? 10 : 0
  const profitBonus = economics.totalPotentialProfitRub > 1_000_000 ? 8 : 0

  return Math.round(marginScore + volumeScore + routeScore + profitBonus)
}

function formatRub(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'RUB',
  }).format(value)
}
