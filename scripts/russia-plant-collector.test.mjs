import { describe, expect, it } from 'vitest'
import {
  BANNED_PATTERN,
  buildEisSearchUrl,
  companySlugToPlantSlug,
  extractRussiaRegions,
  findFabricatorsRegionSlug,
  inferPlantProfile,
  isGispRowInRegion,
  parseFabricatorsCityLinks,
  parseFabricatorsProducerLinks,
  parseFabricatorsRegionLinks,
  parseGispJsonl,
  parseCompanyLinks,
  regionToUrlSlug,
} from './russia-plant-collector.mjs'

describe('russia plant collector', () => {
  it('extracts region stages from market source', () => {
    const source = "export const russiaRegionStages = ['Республика Адыгея', 'Алтайский край']"

    expect(extractRussiaRegions(source)).toEqual(['Республика Адыгея', 'Алтайский край'])
  })

  it('normalizes region and company slugs', () => {
    expect(regionToUrlSlug('Алтайский край')).toBe('altayskiy-kray')
    expect(regionToUrlSlug('Республика Башкортостан')).toBe('respublika-bashkortostan')
    expect(companySlugToPlantSlug('altayskiy-kray', 'ornika')).toBe('mass-altayskiy-kray-ornika')
  })

  it('parses company links and skips banned categories', () => {
    const html = `
      <a href="/company/ornika">Орника</a>
      <a href="/company/bashspirt">Башспирт</a>
      <a href="/company/uralryba-0">УралРыба</a>
    `
    const links = parseCompanyLinks(html, {
      baseUrl: 'https://foodsuppliers.ru',
      name: 'FoodSuppliers',
    })

    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({
      companySlug: 'ornika',
      name: 'Орника',
      sourceUrl: 'https://foodsuppliers.ru/company/ornika',
    })
  })

  it('parses Fabricators region, city and producer links', () => {
    const html = `
      <a href="/zavody/bashkortostan">Республика Башкортостан</a>
      <a href="/zavody/hanty-mansiyskiy-ao">Ханты-Мансийский АО - Югра</a>
      <a href="/zavody/ufa">Уфа (210)</a>
      <a href="/proizvoditel/bashspirt">Башспирт</a>
      <a href="/proizvoditel/ufimkabel#reviews">2 отзыва</a>
      <a href="/proizvoditel/ufimkabel">Уфимкабель</a>
    `
    const regionLinks = parseFabricatorsRegionLinks(html)

    expect(findFabricatorsRegionSlug('Республика Башкортостан', regionLinks)).toBe('bashkortostan')
    expect(findFabricatorsRegionSlug('Ханты-Мансийский автономный округ - Югра', regionLinks)).toBe('hanty-mansiyskiy-ao')
    expect(parseFabricatorsCityLinks(html)).toEqual([{ city: 'Уфа', citySlug: 'ufa', count: 210 }])
    expect(parseFabricatorsProducerLinks(html)).toEqual([
      {
        companySlug: 'ufimkabel',
        name: 'Уфимкабель',
        sourceName: 'Fabricators',
        sourceUrl: 'https://fabricators.ru/proizvoditel/ufimkabel',
      },
    ])
  })

  it('infers concrete product and demand items for plants', () => {
    const plant = inferPlantProfile({
      companySlug: 'ufimkabel',
      name: 'Уфимкабель',
      region: 'Республика Башкортостан',
      regionSlug: 'respublika-bashkortostan',
      sourceName: 'manufacturers.ru',
      sourceUrl: 'https://manufacturers.ru/company/ufimkabel',
    })

    expect(plant.products).toContain('кабельная продукция')
    expect(plant.productionItems[0].name).toContain('Кабельная')
    expect(plant.demandItems[0].name).toBe('Медная катанка')
    expect(plant.demandItems[0].sourceUrl).toContain('zakupki.gov.ru')
  })

  it('maps GISP rows to Russian regions from registry addresses', () => {
    const rows = parseGispJsonl(`
{"org_name":"АКЦИОНЕРНОЕ ОБЩЕСТВО \\"ЯКУТСКИЙ ЗАВОД\\"","org_addr":"РЕСПУБЛИКА САХА /ЯКУТИЯ/, ГОРОД ЯКУТСК","org_inn":"1400000000"}
{"org_name":"АКЦИОНЕРНОЕ ОБЩЕСТВО \\"ЮГРА-ПРОМ\\"","org_addr":"ХАНТЫ-МАНСИЙСКИЙ АВТОНОМНЫЙ ОКРУГ - ЮГРА, ГОРОД СУРГУТ","org_inn":"8600000000"}
`)

    expect(isGispRowInRegion(rows[0], 'Республика Саха (Якутия)')).toBe(true)
    expect(isGispRowInRegion(rows[1], 'Ханты-Мансийский автономный округ - Югра')).toBe(true)
    expect(isGispRowInRegion(rows[1], 'Республика Башкортостан')).toBe(false)
  })

  it('keeps the ISKCON exclusion pattern explicit', () => {
    expect(BANNED_PATTERN.test('мясокомбинат')).toBe(true)
    expect(BANNED_PATTERN.test('пивоваренный завод')).toBe(true)
    expect(BANNED_PATTERN.test('Башспирт')).toBe(true)
    expect(BANNED_PATTERN.test('молочный завод')).toBe(false)
    expect(buildEisSearchUrl('медная катанка')).toContain('searchString=')
  })
})
