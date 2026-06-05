export type ProductVariantFit = {
  plantIds: string[]
  label: string
  reason: string
}

export type ProductVariantProfile = {
  id: string
  productId: string
  label: string
  form: string
  concentration: string
  purity: string
  specs: Array<{ label: string; value: string }>
  packaging: string
  priceNote: string
  logisticsNote: string
  documents: string[]
  suitable: ProductVariantFit[]
  notSuitable: ProductVariantFit[]
  sourceUrl: string
  sourceLabel: string
}

export const productVariantProfiles: ProductVariantProfile[] = [
  {
    id: 'naoh-liquid-50',
    productId: 'caustic-soda',
    label: 'NaOH 48-50%',
    form: 'жидкая каустическая сода',
    concentration: '48-50% NaOH',
    purity: 'промышленная мембранная/диафрагменная марка',
    specs: [
      { label: 'Форма', value: 'раствор' },
      { label: 'Тара', value: 'цистерна / IBC' },
      { label: 'Класс', value: 'опасный груз, corrosive' },
    ],
    packaging: 'авто/жд цистерна, IBC для малых партий',
    priceNote: '$250-330/т FOB seed, но экономика хуже на дальнем импорте из-за воды',
    logisticsNote: 'подходит для локального плеча и заводов с жидкой подачей',
    documents: ['COA', 'MSDS/SDS', 'паспорт партии', 'опасный груз'],
    suitable: [
      {
        plantIds: ['gazprom-neftekhim-salavat', 'taneco', 'nizhnekamskneftekhim'],
        label: 'подходит: жидкая подача',
        reason: 'можно подавать в нейтрализацию/очистку без стадии растворения flakes',
      },
    ],
    notSuitable: [
      {
        plantIds: ['salavatsteklo'],
        label: 'не подходит: стекольная шихта',
        reason: 'влага и форма поставки не соответствуют сырьевому циклу стекла',
      },
    ],
    sourceUrl: 'https://www.imarcgroup.com/caustic-soda-pricing-report',
    sourceLabel: 'IMARC caustic soda pricing',
  },
  {
    id: 'naoh-flakes-99',
    productId: 'caustic-soda',
    label: 'NaOH 98-99%',
    form: 'чешуя / flakes',
    concentration: '98-99% NaOH',
    purity: 'industrial flakes, низкая влажность',
    specs: [
      { label: 'Форма', value: 'сухая чешуя' },
      { label: 'Тара', value: '25 кг мешки / big-bag' },
      { label: 'Хранение', value: 'герметично, защита от влаги' },
    ],
    packaging: '25 кг мешки, паллеты, big-bag',
    priceNote: '$400-480/т FOB seed, лучше для дальнего контейнера',
    logisticsNote: 'удобно импортировать, но нужна стадия растворения перед жидкой подачей',
    documents: ['COA', 'MSDS/SDS', 'packing list', 'паспорт партии'],
    suitable: [
      {
        plantIds: ['gazprom-neftekhim-salavat', 'taneco'],
        label: 'подходит: складская партия',
        reason: 'можно держать запас и растворять под сменные потребности',
      },
    ],
    notSuitable: [
      {
        plantIds: ['gazprom-neftekhim-salavat', 'taneco', 'nizhnekamskneftekhim'],
        label: 'не подходит: узлы с прямой жидкой подачей',
        reason: 'если на заводе нет растворного узла, flakes создают лишнюю операцию и риск',
      },
    ],
    sourceUrl: 'https://www.imarcgroup.com/caustic-soda-flakes-pricing-report',
    sourceLabel: 'IMARC caustic soda flakes pricing',
  },
  {
    id: 'soda-ash-dense-glass',
    productId: 'soda-ash',
    label: 'Na2CO3 dense 99.2%',
    form: 'dense soda ash',
    concentration: 'Na2CO3 99.2% min',
    purity: 'низкие Fe/Cl, стекольная марка',
    specs: [
      { label: 'Bulk density', value: 'dense' },
      { label: 'Примеси', value: 'Fe/Cl контролировать COA' },
      { label: 'Влага', value: 'низкая' },
    ],
    packaging: 'bulk, big-bag, мешки',
    priceNote: '$240-290/т FOB seed',
    logisticsNote: 'тяжелый массовый груз, импорт имеет смысл только при цене ниже локальной БСК',
    documents: ['COA', 'MSDS/SDS', 'контракт', 'сертификат происхождения'],
    suitable: [
      {
        plantIds: ['salavatsteklo'],
        label: 'подходит: стекло',
        reason: 'dense-форма и низкие примеси лучше для стекольной шихты',
      },
    ],
    notSuitable: [
      {
        plantIds: ['gazprom-neftekhim-salavat'],
        label: 'не подходит: не профильное сырье',
        reason: 'не закрывает задачи осушки/нейтрализации нефтехимии',
      },
    ],
    sourceUrl: 'https://www.chemanalyst.com/Pricing-data/soda-ash-76',
    sourceLabel: 'ChemAnalyst soda ash pricing',
  },
  {
    id: 'soda-ash-light-detergent',
    productId: 'soda-ash',
    label: 'Na2CO3 light 99%',
    form: 'light soda ash',
    concentration: 'Na2CO3 99% min',
    purity: 'моющие средства / химсинтез',
    specs: [
      { label: 'Bulk density', value: 'light' },
      { label: 'Растворимость', value: 'быстрее dense' },
      { label: 'Пыль', value: 'контроль при фасовке' },
    ],
    packaging: 'мешки / big-bag',
    priceNote: '$230-280/т FOB seed',
    logisticsNote: 'для стекла часто хуже dense из-за плотности и дозирования',
    documents: ['COA', 'MSDS/SDS'],
    suitable: [
      {
        plantIds: ['bsk'],
        label: 'подходит: химсинтез/фасовка',
        reason: 'light-форма удобнее там, где нужна растворимость и фасовка',
      },
    ],
    notSuitable: [
      {
        plantIds: ['salavatsteklo'],
        label: 'не подходит: стекло без пересчета шихты',
        reason: 'для стекольной линии обычно нужен dense и стабильная насыпная плотность',
      },
    ],
    sourceUrl: 'https://www.chemanalyst.com/Pricing-data/soda-ash-76',
    sourceLabel: 'ChemAnalyst soda ash pricing',
  },
  {
    id: 'tio2-rutile-94',
    productId: 'titanium-dioxide',
    label: 'TiO2 93-94% rutile',
    form: 'рутильный белый пигмент',
    concentration: 'TiO2 93-94%',
    purity: 'Al/Si treated, coatings/plastics grade',
    specs: [
      { label: 'Whiteness', value: '95-97%' },
      { label: 'Oil absorption', value: '18-22 g/100g' },
      { label: 'Surface', value: 'Al/Si treatment' },
    ],
    packaging: '25 кг мешки / паллеты / big-bag',
    priceNote: '$2450-2850/т FOB seed',
    logisticsNote: 'контейнерная поставка, критичен входной контроль оттенка партии',
    documents: ['COA', 'MSDS/SDS', 'сертификат', 'образец'],
    suitable: [
      {
        plantIds: ['ufaorgsintez', 'kazanorgsintez'],
        label: 'подходит: белые компаунды',
        reason: 'рутильная форма дает укрывистость и стабильность в пластиках/ЛКМ',
      },
    ],
    notSuitable: [
      {
        plantIds: ['salavatsteklo'],
        label: 'не подходит: стекольная шихта',
        reason: 'это пигмент, а не базовое стекольное сырье',
      },
    ],
    sourceUrl: 'https://www.chemanalyst.com/Pricing-data/titanium-dioxide-66',
    sourceLabel: 'ChemAnalyst TiO2 pricing',
  },
  {
    id: 'tio2-anatase-98',
    productId: 'titanium-dioxide',
    label: 'TiO2 98% anatase',
    form: 'анатазный TiO2',
    concentration: 'TiO2 98% anatase',
    purity: 'filler/interior grade',
    specs: [
      { label: 'Tint strength', value: 'ниже rutile' },
      { label: 'Outdoor', value: 'ограниченно' },
      { label: 'Цена', value: 'ниже rutile' },
    ],
    packaging: '25 кг мешки',
    priceNote: '$2000-2300/т FOB seed',
    logisticsNote: 'дешевле, но нужно тестировать рецептуру до закупки партии',
    documents: ['COA', 'MSDS/SDS', 'образец'],
    suitable: [
      {
        plantIds: ['ufaorgsintez', 'kazanorgsintez'],
        label: 'подходит: дешевые наполненные рецептуры',
        reason: 'может частично снизить себестоимость, если не нужна высокая укрывистость',
      },
    ],
    notSuitable: [
      {
        plantIds: ['ufaorgsintez', 'kazanorgsintez'],
        label: 'не подходит: фасадные ЛКМ',
        reason: 'анатаз хуже для наружной стойкости, белизны и укрывистости',
      },
    ],
    sourceUrl: 'https://www.made-in-china.com/products-search/hot-china-products/Titanium_Dioxide_Anatase.html',
    sourceLabel: 'Made-in-China anatase TiO2 listings',
  },
  {
    id: 'silica-gel-industrial',
    productId: 'silica-gel',
    label: 'Silica gel 2-5 mm',
    form: 'неиндикаторные гранулы',
    concentration: 'SiO2 adsorbent, bead 2-5 mm',
    purity: 'industrial low-dust grade',
    specs: [
      { label: 'Размер', value: '2-5 mm' },
      { label: 'Индикатор', value: 'нет' },
      { label: 'Пыль', value: 'контроль COA' },
    ],
    packaging: '25 кг мешки / drums / big-bag',
    priceNote: '$720-1050/т FOB seed',
    logisticsNote: 'важны пыльность, прочность гранул и условия регенерации',
    documents: ['COA', 'MSDS/SDS', 'adsorption spec'],
    suitable: [
      {
        plantIds: ['gazprom-neftekhim-salavat', 'taneco', 'nizhnekamskneftekhim'],
        label: 'подходит: массовая осушка',
        reason: 'рабочий вариант для осушки упаковки, воздуха и части технологических потоков',
      },
    ],
    notSuitable: [
      {
        plantIds: ['gazprom-neftekhim-salavat', 'taneco'],
        label: 'не подходит: глубокая осушка до ppm',
        reason: 'для глубокой осушки часто нужны молекулярные сита 3A/4A',
      },
    ],
    sourceUrl: 'https://dir.indiamart.com/search.mp?ss=silica+gel+beads',
    sourceLabel: 'IndiaMART silica gel listings',
  },
  {
    id: 'silica-gel-indicating',
    productId: 'silica-gel',
    label: 'Silica gel indicating',
    form: 'индикаторные гранулы',
    concentration: 'SiO2 + индикатор влажности',
    purity: 'orange/blue indicating grade',
    specs: [
      { label: 'Индикатор', value: 'orange/blue' },
      { label: 'Назначение', value: 'визуальный контроль' },
      { label: 'Объем', value: 'обычно малые партии' },
    ],
    packaging: 'drums, cartons, мелкая фасовка',
    priceNote: '$950-1200/т FOB seed',
    logisticsNote: 'дороже промышленного non-indicating, брать только если нужен визуальный контроль',
    documents: ['COA', 'MSDS/SDS'],
    suitable: [
      {
        plantIds: ['gazprom-neftekhim-salavat'],
        label: 'подходит: контрольные точки',
        reason: 'полезно там, где оператору нужно видеть насыщение влагой',
      },
    ],
    notSuitable: [
      {
        plantIds: ['taneco', 'nizhnekamskneftekhim'],
        label: 'не подходит: массовая загрузка адсорберов',
        reason: 'переплата за индикатор, когда нужен bulk adsorbent',
      },
    ],
    sourceUrl: 'https://dir.indiamart.com/search.mp?ss=indicating+silica+gel',
    sourceLabel: 'IndiaMART indicating silica gel listings',
  },
]

export function getProductVariants(productId: string): ProductVariantProfile[] {
  return productVariantProfiles.filter((variant) => variant.productId === productId)
}
