import { describe, expect, it } from 'vitest'
import {
  buildAiBrief,
  buildOpportunityCards,
  calculateDealEconomics,
} from './market'
import type { BuyerNeed, LogisticsRoute, Producer } from './types'

const producer: Producer = {
  id: 'bsk',
  name: 'Башкирская содовая компания',
  region: 'Башкортостан',
  country: 'Россия',
  coordinates: [53.63, 55.95],
  products: [
    {
      productId: 'soda-ash',
      capacityTonsYear: 1_500_000,
      quality: 'ГОСТ 5100-85, марка А',
      priceRubPerTon: 21_800,
      minLotTons: 60,
    },
  ],
}

const need: BuyerNeed = {
  id: 'glass-plant-need',
  organization: 'Салаватстекло',
  region: 'Башкортостан',
  productId: 'soda-ash',
  volumeTons: 420,
  maxPriceRubPerTon: 30_500,
  deliveryRegion: 'Башкортостан',
  deadline: '2026-06-20',
  source: 'ЕИС, демо-запись',
}

const route: LogisticsRoute = {
  fromRegion: 'Башкортостан',
  toRegion: 'Башкортостан',
  rubPerTon: 1_150,
  days: 1,
  risk: 'low',
}

describe('market domain', () => {
  it('calculates delivered cost, margin and profit for a deal', () => {
    const economics = calculateDealEconomics({
      producer,
      need,
      route,
      taxRate: 0.2,
    })

    expect(economics.deliveredCostRubPerTon).toBe(27_540)
    expect(economics.marginRubPerTon).toBe(2_960)
    expect(economics.totalPotentialProfitRub).toBe(1_243_200)
    expect(economics.marginPercent).toBeCloseTo(9.7, 1)
  })

  it('builds profitable opportunity cards sorted by profit', () => {
    const opportunities = buildOpportunityCards({
      productId: 'soda-ash',
      producers: [producer],
      needs: [
        need,
        {
          ...need,
          id: 'low-budget',
          organization: 'Низкая цена',
          maxPriceRubPerTon: 22_000,
        },
      ],
      routes: [route],
      onlyProfitable: true,
    })

    expect(opportunities).toHaveLength(1)
    expect(opportunities[0].buyer.organization).toBe('Салаватстекло')
    expect(opportunities[0].score).toBeGreaterThan(70)
  })

  it('creates a practical AI brief for local substitution', () => {
    const [opportunity] = buildOpportunityCards({
      productId: 'soda-ash',
      producers: [producer],
      needs: [need],
      routes: [route],
      onlyProfitable: true,
    })

    const brief = buildAiBrief(opportunity)

    expect(brief.headline).toContain('локальная замена')
    expect(brief.actions).toContain('Проверить спецификацию качества')
    expect(brief.risks).toContain('Цена поставщика условная')
  })
})
