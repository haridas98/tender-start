export type TradeSource = {
  name: string
  url: string
  note: string
}

export type TradeRuleProfile = {
  code: string
  name: string
  regionGroup: string
  customsSource: TradeSource
  tariffSource: TradeSource
  taxSource: TradeSource
  dutyModel: string
  importTaxModel: string
  chemicalRules: string[]
  documents: string[]
  dataLevel: 'framework' | 'priority'
}

export type RouteRuleSummary = {
  title: string
  taxFormula: string
  steps: string[]
  documents: string[]
  blockers: string[]
  sourceLinks: TradeSource[]
}

const WORLD_COUNTRY_CODES = [
  'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ',
  'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV', 'BR',
  'IO', 'BN', 'BG', 'BF', 'BI', 'KH', 'CM', 'CA', 'CV', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC',
  'CO', 'KM', 'CG', 'CD', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO',
  'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF',
  'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY',
  'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM',
  'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY',
  'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX',
  'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI',
  'NE', 'NG', 'NU', 'NF', 'MK', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH',
  'PN', 'PL', 'PT', 'PR', 'QA', 'RE', 'RO', 'RU', 'RW', 'BL', 'SH', 'KN', 'LC', 'MF', 'PM', 'VC',
  'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS',
  'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK',
  'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU',
  'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW',
]

const ruRegionNames = new Intl.DisplayNames(['ru'], { type: 'region' })

export const globalComplianceSources: TradeSource[] = [
  {
    name: 'WCO Harmonized System',
    note: 'Базовая классификация товара: 6 знаков HS, дальше национальная детализация.',
    url: 'https://www.wcotradetools.org/en/harmonized-system',
  },
  {
    name: 'WTO Tariff Download Facility',
    note: 'Официальный слой ВТО для ставок и тарифных профилей по странам.',
    url: 'https://www.wto.org/english/tratop_e/tariffs_e/tariff_data_e.htm',
  },
  {
    name: 'WITS / UNCTAD TRAINS',
    note: 'Тарифы, NTM и торговая статистика по странам и HS-кодам.',
    url: 'https://wits.worldbank.org/',
  },
  {
    name: 'ITC Market Access Map',
    note: 'Практический источник по пошлинам, мерам доступа и правилам происхождения.',
    url: 'https://www.macmap.org/',
  },
  {
    name: 'UN Comtrade',
    note: 'Проверка потоков импорта/экспорта по HS-кодам и странам.',
    url: 'https://comtradeplus.un.org/',
  },
]

const nationalSources = {
  australia: source('Australian Border Force Tariff', 'https://www.abf.gov.au/importing-exporting-and-manufacturing/tariff-classification/current-tariff', 'Австралийский таможенный тариф.'),
  brazil: source('Receita Federal / Siscomex', 'https://www.gov.br/receitafederal/', 'Таможня и федеральные налоги Бразилии.'),
  canada: source('CBSA Customs Tariff', 'https://www.cbsa-asfc.gc.ca/trade-commerce/tariff-tarif/menu-eng.html', 'Канадский таможенный тариф.'),
  china: source('GACC China Customs', 'https://english.customs.gov.cn/', 'Китайская таможня, тарифы, контроль экспорта/импорта.'),
  eaeu: source('EAEU Common Customs Tariff', 'https://eec.eaeunion.org/', 'ТН ВЭД ЕАЭС, ЕТТ ЕАЭС, нетарифное регулирование и техрегламенты.'),
  euTaric: source('EU TARIC', 'https://taxation-customs.ec.europa.eu/customs/common-customs-tariff-cct/tariff-classification-goods/eu-customs-tariff-taric_en', 'Единый таможенный тариф ЕС и TARIC-меры.'),
  icegate: source('ICEGATE', 'https://www.icegate.gov.in/', 'Indian Customs National Trade Portal: filing, compliance, tariff and duty tools.'),
  indiaCbic: source('CBIC', 'https://www.cbic.gov.in/', 'Индийские таможенные уведомления, GST/IGST и тарифные документы.'),
  japan: source('Japan Customs Tariff', 'https://www.customs.go.jp/english/tariff/', 'Тарифная база таможни Японии.'),
  kazakhstan: source('Kazakhstan State Revenue Committee', 'https://kgd.gov.kz/', 'Таможня и налоги Казахстана.'),
  korea: source('Korea Customs Service', 'https://www.customs.go.kr/english/', 'Таможенная служба Республики Корея.'),
  mexico: source('SNICE Mexico', 'https://www.snice.gob.mx/', 'Торговые правила и тарифная информация Мексики.'),
  russia: source('Federal Customs Service Russia', 'https://customs.gov.ru/', 'ФТС России: таможенные процедуры, классификация, декларации.'),
  southAfrica: source('SARS Tariff', 'https://www.sars.gov.za/customs-and-excise/tariff/', 'Тарифы и таможенные правила ЮАР.'),
  turkey: source('Turkiye Ministry of Trade', 'https://www.trade.gov.tr/', 'Торговля, таможенные правила и импортный контроль Турции.'),
  uae: source('UAE Federal Customs Authority', 'https://www.fca.gov.ae/', 'Федеральный таможенный источник ОАЭ.'),
  uk: source('UK Trade Tariff', 'https://www.trade-tariff.service.gov.uk/', 'Коды товаров, пошлины и VAT Великобритании.'),
  usa: source('USITC HTS', 'https://hts.usitc.gov/', 'Harmonized Tariff Schedule США.'),
  uzbekistan: source('Uzbekistan Customs Committee', 'https://customs.uz/', 'Таможенные процедуры и платежи Узбекистана.'),
  vietnam: source('Vietnam Customs', 'https://www.customs.gov.vn/', 'Таможенные правила и тарифы Вьетнама.'),
}

const eaeuCodes = new Set(['AM', 'BY', 'KZ', 'KG', 'RU'])
const euCodes = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
])

const priorityOverrides: Record<string, Partial<TradeRuleProfile>> = {
  AU: withNational(nationalSources.australia),
  BR: withNational(nationalSources.brazil),
  CA: withNational(nationalSources.canada),
  CN: {
    ...withNational(nationalSources.china),
    chemicalRules: ['Проверить экспортный контроль/лицензии по HS и назначению.', 'SDS/COA, GHS-маркировка, упаковка опасных грузов по UN при необходимости.'],
    dataLevel: 'priority',
  },
  GB: withNational(nationalSources.uk),
  IN: {
    ...withNational(nationalSources.icegate, nationalSources.indiaCbic),
    chemicalRules: ['Экспорт из Индии обычно требует invoice, packing list, shipping bill, certificate of origin; GST/IGST по экспорту проверяется по режиму поставки.', 'Для химии: SDS/MSDS, COA, CAS, HS, UN/DG-классификация при опасном грузе.'],
    dataLevel: 'priority',
  },
  JP: withNational(nationalSources.japan),
  KR: withNational(nationalSources.korea),
  KZ: withNational(nationalSources.kazakhstan),
  MX: withNational(nationalSources.mexico),
  RU: {
    ...withNational(nationalSources.eaeu, nationalSources.russia),
    chemicalRules: ['ТН ВЭД ЕАЭС, ЕТТ ЕАЭС, нетарифные меры, санкционные/контрольные списки, техрегламенты ЕАЭС.', 'Для химии: SDS/MSDS, COA, паспорт безопасности, CAS, проверка разрешительных документов и опасного груза.'],
    dataLevel: 'priority',
  },
  TR: withNational(nationalSources.turkey),
  AE: withNational(nationalSources.uae),
  US: withNational(nationalSources.usa),
  UZ: withNational(nationalSources.uzbekistan),
  VN: withNational(nationalSources.vietnam),
  ZA: withNational(nationalSources.southAfrica),
}

export const tradeRuleProfiles: TradeRuleProfile[] = WORLD_COUNTRY_CODES.map(buildCountryProfile).sort((a, b) =>
  a.name.localeCompare(b.name, 'ru'),
)

export const priorityTradeLanes = [
  buildRouteRuleSummary({ destinationCode: 'RU', hazardous: true, hsCode: '250300', originCode: 'IN', productName: 'Сера гранулированная' }),
  buildRouteRuleSummary({ destinationCode: 'RU', hazardous: false, hsCode: '320611', originCode: 'CN', productName: 'Диоксид титана' }),
  buildRouteRuleSummary({ destinationCode: 'RU', hazardous: false, hsCode: '281122', originCode: 'IN', productName: 'Силикагель / диоксид кремния' }),
  buildRouteRuleSummary({ destinationCode: 'RU', hazardous: true, hsCode: '280700', originCode: 'KZ', productName: 'Серная кислота' }),
]

export function getTradeRuleProfile(codeOrName: string) {
  const value = codeOrName.trim().toLowerCase()
  return tradeRuleProfiles.find((profile) => profile.code.toLowerCase() === value || profile.name.toLowerCase() === value)
}

export function buildRouteRuleSummary({
  destinationCode,
  hazardous = false,
  hsCode,
  originCode,
  productName,
}: {
  destinationCode: string
  hazardous?: boolean
  hsCode: string
  originCode: string
  productName: string
}): RouteRuleSummary {
  const origin = getTradeRuleProfile(originCode) ?? buildCountryProfile(originCode)
  const destination = getTradeRuleProfile(destinationCode) ?? buildCountryProfile(destinationCode)
  const sourceLinks = uniqueSources([
    globalComplianceSources[0],
    globalComplianceSources[1],
    globalComplianceSources[2],
    origin.customsSource,
    origin.taxSource,
    destination.tariffSource,
    destination.customsSource,
    destination.taxSource,
  ])

  return {
    blockers: [
      'Точная ставка зависит от национального тарифного кода, страны происхождения, льгот, антидемпинга и нетарифных мер.',
      'Для химии отдельно проверяются SDS/MSDS, CAS, опасный груз, прекурсоры, санкционные и экспорт-контрольные ограничения.',
      'Без HS-кода, Incoterms, порта/границы и конечного пользователя расчет нельзя считать коммерческим оффером.',
    ],
    documents: [
      'контракт',
      'commercial invoice',
      'packing list',
      'transport document',
      'certificate of origin',
      'COA',
      'SDS/MSDS',
      'import declaration',
      ...(hazardous ? ['UN/DG declaration'] : []),
    ],
    sourceLinks,
    steps: [
      `Зафиксировать HS ${hsCode} для "${productName}" на 6 знаках и развернуть до национального кода страны импорта.`,
      `Проверить ставку пошлины и льготы: ${destination.tariffSource.name}.`,
      `Проверить импортный VAT/GST/НДС, сборы и базу начисления: ${destination.taxSource.name}.`,
      `Проверить правила экспорта из страны "${origin.name}": ${origin.customsSource.name}.`,
      'Сверить NTM: лицензии, разрешения, антидемпинг, санкции, REACH/CLP/ЕАЭС/локальные химические правила.',
      'Собрать landed cost: товар + фрахт + страхование + пошлина + налог + терминал + брокер + внутренняя доставка.',
    ],
    taxFormula: 'База: CIF/таможенная стоимость. Landed cost = CIF + пошлина + акциз/сборы при наличии + VAT/GST/НДС на базу, установленную страной импорта.',
    title: `${origin.name} → ${destination.name}: ${productName}`,
  }
}

function buildCountryProfile(code: string): TradeRuleProfile {
  const nationalOverride = priorityOverrides[code] ?? {}
  const isEu = euCodes.has(code)
  const isEaeu = eaeuCodes.has(code)
  const name = countryName(code)
  const defaultCustoms = isEu ? nationalSources.euTaric : isEaeu ? nationalSources.eaeu : globalComplianceSources[2]
  const defaultTax = isEu ? nationalSources.euTaric : isEaeu ? nationalSources.eaeu : globalComplianceSources[2]

  return {
    chemicalRules: [
      'HS/TN classification first, then national tariff line.',
      'For chemicals collect CAS, SDS/MSDS, COA, GHS/CLP labels and dangerous goods class where applicable.',
      'Check import licenses, sanctions/export controls, anti-dumping and product registration before RFQ.',
    ],
    code,
    customsSource: defaultCustoms,
    dataLevel: 'framework',
    documents: ['contract', 'commercial invoice', 'packing list', 'transport document', 'certificate of origin', 'COA', 'SDS/MSDS', 'customs declaration'],
    dutyModel: isEu
      ? 'TARIC: HS/CN/TARIC code + origin + preference + trade remedies.'
      : isEaeu
        ? 'ТН ВЭД ЕАЭС + ЕТТ ЕАЭС + страна происхождения + нетарифные меры.'
        : 'HS code + national tariff line + origin + preference + trade remedies.',
    importTaxModel: isEaeu
      ? 'НДС/акцизы/сборы считаются по национальным правилам страны ЕАЭС; для РФ базово проверять НДС и льготы по ТН ВЭД.'
      : 'VAT/GST/sales tax depends on national tax law; usually checked after duty and customs value.',
    name,
    regionGroup: regionGroup(code),
    tariffSource: defaultCustoms,
    taxSource: defaultTax,
    ...nationalOverride,
  }
}

function withNational(customsSource: TradeSource, taxSource = customsSource): Partial<TradeRuleProfile> {
  return {
    customsSource,
    dataLevel: 'priority',
    tariffSource: customsSource,
    taxSource,
  }
}

function source(name: string, url: string, note: string): TradeSource {
  return { name, note, url }
}

function countryName(code: string) {
  if (code === 'US') return 'США'
  if (code === 'GB') return 'Великобритания'
  if (code === 'AE') return 'ОАЭ'
  return ruRegionNames.of(code) ?? code
}

function regionGroup(code: string) {
  if (euCodes.has(code)) return 'Европейский союз'
  if (eaeuCodes.has(code)) return 'ЕАЭС'
  if (['US', 'CA', 'MX', 'BM', 'GL', 'PM'].includes(code)) return 'Северная Америка'
  if (['CN', 'HK', 'MO', 'TW', 'JP', 'KR', 'KP', 'MN'].includes(code)) return 'Восточная Азия'
  if (['IN', 'PK', 'BD', 'LK', 'NP', 'BT', 'MV'].includes(code)) return 'Южная Азия'
  if (['AE', 'SA', 'QA', 'KW', 'OM', 'BH', 'TR', 'IR', 'IQ', 'IL', 'JO', 'LB', 'SY', 'YE', 'EG'].includes(code)) return 'Ближний Восток'
  if (['AU', 'NZ', 'FJ', 'PG', 'WS', 'TO', 'VU', 'SB', 'NC', 'PF'].includes(code)) return 'Океания'
  if (['BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'PY', 'BO', 'EC', 'VE', 'GY', 'SR'].includes(code)) return 'Латинская Америка'
  if (['ZA', 'NG', 'KE', 'MA', 'DZ', 'TN', 'GH', 'ET', 'TZ', 'AO', 'MZ'].includes(code)) return 'Африка'
  return 'Прочие страны/территории'
}

function uniqueSources(sources: TradeSource[]) {
  const seen = new Set<string>()
  return sources.filter((sourceItem) => {
    if (seen.has(sourceItem.name)) return false
    seen.add(sourceItem.name)
    return true
  })
}
