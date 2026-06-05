import { describe, expect, it } from 'vitest'
import {
  buildRouteRuleSummary,
  globalComplianceSources,
  getTradeRuleProfile,
  tradeRuleProfiles,
} from './tradeRules'

describe('global trade rules registry', () => {
  it('covers the world with source-backed customs profiles', () => {
    expect(tradeRuleProfiles.length).toBeGreaterThanOrEqual(240)
    expect(getTradeRuleProfile('RU')?.name).toBe('Россия')
    expect(getTradeRuleProfile('IN')?.name).toBe('Индия')
    expect(getTradeRuleProfile('CN')?.name).toBe('Китай')
    expect(getTradeRuleProfile('US')?.name).toBe('США')
    expect(globalComplianceSources.map((source) => source.name)).toContain('WTO Tariff Download Facility')
  })

  it('builds a practical checklist for an India to Russia chemical route', () => {
    const summary = buildRouteRuleSummary({
      destinationCode: 'RU',
      hazardous: true,
      hsCode: '250300',
      originCode: 'IN',
      productName: 'Сера гранулированная',
    })

    expect(summary.title).toContain('Индия')
    expect(summary.title).toContain('Россия')
    expect(summary.steps.join(' ')).toContain('250300')
    expect(summary.taxFormula).toContain('CIF')
    expect(summary.documents).toContain('SDS/MSDS')
    expect(summary.sourceLinks.map((source) => source.name)).toContain('EAEU Common Customs Tariff')
    expect(summary.sourceLinks.map((source) => source.name)).toContain('ICEGATE')
  })
})
