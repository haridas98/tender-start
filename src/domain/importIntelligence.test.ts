import { describe, expect, it } from 'vitest'
import {
  buildImportBrief,
  buildImportOpportunities,
  buildImportRouteOptions,
  calculateImportEconomics,
} from './importIntelligence'
import type { IndianSupplier, RussiaDemand, TradeLane } from './types'

const supplier: IndianSupplier = {
  id: 'gujarat-alkalies',
  name: 'Gujarat Alkalies and Chemicals',
  country: 'India',
  state: 'Gujarat',
  city: 'Vadodara',
  exportContact: 'export@gacl-demo.example',
  products: [
    {
      productId: 'caustic-soda',
      priceUsdPerTon: 430,
      incoterm: 'FOB',
      moqTons: 24,
      monthlyCapacityTons: 2500,
      quality: 'Caustic soda flakes 99%',
      documents: ['SDS', 'COA', 'ISO 9001'],
    },
  ],
}

const demand: RussiaDemand = {
  id: 'ufa-water',
  organization: 'Уфаводоканал',
  region: 'Башкортостан',
  productId: 'caustic-soda',
  monthlyVolumeTons: 80,
  targetPriceRubPerTon: 62_000,
  source: 'ЕИС, демо',
  buyerContact: 'procurement@ufa-demo.example',
}

const lane: TradeLane = {
  id: 'mundra-nsk-ufa',
  from: 'Mundra, India',
  to: 'Уфа, РФ',
  seaPort: 'Mundra',
  borderPoint: 'Новороссийск',
  costUsdPerTon: 95,
  days: 32,
  dutyRate: 0.05,
  vatRate: 0.2,
  risk: 'medium',
}

describe('import intelligence', () => {
  it('calculates landed import price and margin', () => {
    const economics = calculateImportEconomics({
      supplier,
      demand,
      lane,
      usdRub: 92,
    })

    expect(economics.landedCostRubPerTon).toBe(60_375)
    expect(economics.marginRubPerTon).toBe(1_625)
    expect(economics.monthlyProfitRub).toBe(130_000)
    expect(economics.requiredDocuments).toEqual(['SDS', 'COA', 'ISO 9001'])
  })

  it('builds import opportunities sorted by monthly profit', () => {
    const opportunities = buildImportOpportunities({
      productId: 'caustic-soda',
      suppliers: [supplier],
      demands: [demand],
      lanes: [lane],
      usdRub: 92,
      onlyProfitable: true,
    })

    expect(opportunities).toHaveLength(1)
    expect(opportunities[0].supplier.name).toContain('Gujarat')
    expect(opportunities[0].score).toBeGreaterThan(50)
  })

  it('creates an action brief for India to Russia import', () => {
    const [opportunity] = buildImportOpportunities({
      productId: 'caustic-soda',
      suppliers: [supplier],
      demands: [demand],
      lanes: [lane],
      usdRub: 92,
      onlyProfitable: true,
    })

    const brief = buildImportBrief(opportunity)

    expect(brief.headline).toContain('Индия → РФ')
    expect(brief.actions).toContain('Запросить SDS, COA и актуальный FOB')
    expect(brief.risks).toContain('Проверить код ТН ВЭД и ставку пошлины')
  })

  it('compares primary and bypass logistics routes for one supplier', () => {
    const bypassLane: TradeLane = {
      ...lane,
      id: 'mundra-suez-ufa',
      borderPoint: 'Суэц / Новороссийск',
      costUsdPerTon: 165,
      days: 44,
      routeType: 'bypass',
      note: 'Обходной путь при задержках прямого плеча',
    }

    const routeOptions = buildImportRouteOptions({
      supplier,
      demand,
      lanes: [
        { ...lane, routeType: 'primary', note: 'Базовый маршрут' },
        bypassLane,
      ],
      usdRub: 92,
    })

    expect(routeOptions).toHaveLength(2)
    expect(routeOptions[0].label).toBe('Базовый маршрут')
    expect(routeOptions[1].label).toBe('Обходной маршрут')
    expect(routeOptions[1].deltaRubPerTon).toBeGreaterThan(0)
  })
})
