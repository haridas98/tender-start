import { describe, expect, it } from 'vitest'
import {
  buildEisSearchUrl,
  matchProduct,
  mergeDemands,
  parseEisSearchHtml,
} from './russia-demand-collector.mjs'

describe('russia demand collector', () => {
  it('matches chemicals by Russian name and formula', () => {
    expect(matchProduct('Поставка гидроксида натрия NaOH')).toBe('caustic-soda')
    expect(matchProduct('Закупка нитрит натрия, фасовка 25 кг')).toBe(
      'sodium-nitrite',
    )
  })

  it('parses EIS-like search result blocks into demand records', () => {
    const html = `
      <div class="search-registry-entry-block">
        <a href="/epz/order/notice/ea44/view/common-info.html?regNumber=123456789">№ 123456789</a>
        Регион Татарстан
        Заказчик Казанский целлюлозный комбинат
        Объект закупки Поставка каустической соды NaOH, 80 т
        Начальная цена 4960000
      </div>
    `

    const records = parseEisSearchHtml(html)

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      id: 'eis-caustic-soda-123456789',
      organization: 'Казанский целлюлозный комбинат',
      productId: 'caustic-soda',
      monthlyVolumeTons: 80,
      targetPriceRubPerTon: 62000,
    })
  })

  it('keeps stable unique demand records when merging', () => {
    const merged = mergeDemands(
      [{ id: 'a', productId: 'caustic-soda', organization: 'old' }],
      [{ id: 'a', productId: 'caustic-soda', organization: 'new' }],
    )

    expect(merged).toHaveLength(1)
    expect(merged[0].organization).toBe('new')
  })

  it('builds an official EIS search URL', () => {
    expect(buildEisSearchUrl('нитрит натрия')).toContain('zakupki.gov.ru')
    expect(buildEisSearchUrl('нитрит натрия')).toContain('searchString=')
  })
})
