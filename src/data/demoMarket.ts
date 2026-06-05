import type { BuyerNeed, LogisticsRoute, Producer, Product } from '../domain/types'

export const products: Product[] = [
  {
    id: 'soda-ash',
    name: 'Кальцинированная сода',
    category: 'Неорганическая химия',
    aliases: ['карбонат натрия', 'Na2CO3', 'soda ash'],
    okpd2: '20.13.43',
    description:
      'Сырьё для стекла, моющих средств, металлургии и химического синтеза.',
  },
  {
    id: 'caustic-soda',
    name: 'Сода каустическая',
    category: 'Щёлочи',
    aliases: ['Каустическая сода', 'гидроксид натрия', 'NaOH', 'натр едкий'],
    okpd2: '20.13.24',
    description:
      'Нужна для нефтехимии, целлюлозы, водоподготовки и производства ПАВ.',
  },
  {
    id: 'sodium-bicarbonate',
    name: 'Пищевая сода',
    category: 'Пищевая химия',
    aliases: ['бикарбонат натрия', 'NaHCO3'],
    okpd2: '20.13.43',
    description:
      'Используется в пищевой отрасли, фарме, водоочистке и пожаротушении.',
  },
]

export const producers: Producer[] = [
  {
    id: 'bsk',
    name: 'Башкирская содовая компания',
    region: 'Башкортостан',
    country: 'Россия',
    coordinates: [53.63, 55.95],
    needs: ['известняк', 'газ', 'железнодорожная логистика', 'мешки биг-бэг'],
    products: [
      {
        productId: 'soda-ash',
        capacityTonsYear: 1_500_000,
        quality: 'ГОСТ 5100-85, марка А',
        priceRubPerTon: 21_800,
        minLotTons: 60,
      },
      {
        productId: 'sodium-bicarbonate',
        capacityTonsYear: 180_000,
        quality: 'пищевая марка, мешки 25 кг',
        priceRubPerTon: 42_000,
        minLotTons: 20,
      },
    ],
  },
  {
    id: 'sterlitamak-petrochem',
    name: 'Стерлитамакский нефтехимический завод',
    region: 'Башкортостан',
    country: 'Россия',
    coordinates: [53.63, 55.94],
    needs: ['соль техническая', 'электроэнергия', 'тара химическая'],
    products: [
      {
        productId: 'caustic-soda',
        capacityTonsYear: 90_000,
        quality: 'мембранная, раствор 46%',
        priceRubPerTon: 36_500,
        minLotTons: 24,
      },
    ],
  },
  {
    id: 'crimean-soda',
    name: 'Крымский содовый завод',
    region: 'Крым',
    country: 'Россия',
    coordinates: [45.31, 33.04],
    needs: ['уголь', 'соль', 'вагоны-хопперы'],
    products: [
      {
        productId: 'soda-ash',
        capacityTonsYear: 700_000,
        quality: 'ГОСТ 5100-85, марка Б',
        priceRubPerTon: 23_400,
        minLotTons: 68,
      },
    ],
  },
  {
    id: 'sisecam',
    name: 'Sisecam Soda Lukavac',
    region: 'Босния и Герцеговина',
    country: 'Босния и Герцеговина',
    coordinates: [44.54, 18.53],
    needs: ['морская логистика', 'контейнеры', 'таможенный брокер'],
    products: [
      {
        productId: 'soda-ash',
        capacityTonsYear: 500_000,
        quality: 'dense soda ash, export grade',
        priceRubPerTon: 28_600,
        minLotTons: 100,
      },
    ],
  },
]

export const buyerNeeds: BuyerNeed[] = [
  {
    id: 'salavat-glass',
    organization: 'Салаватстекло',
    region: 'Башкортостан',
    productId: 'soda-ash',
    volumeTons: 420,
    maxPriceRubPerTon: 30_500,
    deliveryRegion: 'Башкортостан',
    deadline: '2026-06-20',
    source: 'ЕИС, демо-запись',
  },
  {
    id: 'ufa-detergents',
    organization: 'Уфимский завод бытовой химии',
    region: 'Башкортостан',
    productId: 'soda-ash',
    volumeTons: 160,
    maxPriceRubPerTon: 29_200,
    deliveryRegion: 'Башкортостан',
    deadline: '2026-06-05',
    source: 'Коммерческие закупки, демо-запись',
  },
  {
    id: 'perm-glass',
    organization: 'Пермский стекольный кластер',
    region: 'Пермский край',
    productId: 'soda-ash',
    volumeTons: 600,
    maxPriceRubPerTon: 32_000,
    deliveryRegion: 'Пермский край',
    deadline: '2026-07-01',
    source: 'ЕИС, демо-запись',
  },
  {
    id: 'ufa-water',
    organization: 'Уфаводоканал',
    region: 'Башкортостан',
    productId: 'caustic-soda',
    volumeTons: 80,
    maxPriceRubPerTon: 48_000,
    deliveryRegion: 'Башкортостан',
    deadline: '2026-06-12',
    source: '223-ФЗ, демо-запись',
  },
  {
    id: 'kazan-pulp',
    organization: 'Казанский целлюлозный комбинат',
    region: 'Татарстан',
    productId: 'caustic-soda',
    volumeTons: 140,
    maxPriceRubPerTon: 49_500,
    deliveryRegion: 'Татарстан',
    deadline: '2026-06-28',
    source: 'ЕИС, демо-запись',
  },
  {
    id: 'pharma-ufa',
    organization: 'Фармстандарт-УфаВИТА',
    region: 'Башкортостан',
    productId: 'sodium-bicarbonate',
    volumeTons: 32,
    maxPriceRubPerTon: 56_000,
    deliveryRegion: 'Башкортостан',
    deadline: '2026-06-18',
    source: 'Коммерческие закупки, демо-запись',
  },
]

export const logisticsRoutes: LogisticsRoute[] = [
  {
    fromRegion: 'Башкортостан',
    toRegion: 'Башкортостан',
    rubPerTon: 1_150,
    days: 1,
    risk: 'low',
  },
  {
    fromRegion: 'Башкортостан',
    toRegion: 'Пермский край',
    rubPerTon: 3_900,
    days: 3,
    risk: 'medium',
  },
  {
    fromRegion: 'Башкортостан',
    toRegion: 'Татарстан',
    rubPerTon: 2_700,
    days: 2,
    risk: 'low',
  },
  {
    fromRegion: 'Крым',
    toRegion: 'Башкортостан',
    rubPerTon: 7_200,
    days: 7,
    risk: 'high',
  },
  {
    fromRegion: 'Босния и Герцеговина',
    toRegion: 'Башкортостан',
    rubPerTon: 18_400,
    days: 18,
    risk: 'high',
  },
]

export const sourcePipeline = [
  {
    name: 'ЕИС / zakupki.gov.ru',
    status: 'следующий этап',
    purpose: 'выгрузки закупок по ОКПД2, регионам и ключевым словам',
  },
  {
    name: 'ЕГРЮЛ / ФНС',
    status: 'следующий этап',
    purpose: 'карточки юрлиц, ОКВЭД, регион, статус компании',
  },
  {
    name: 'ГИСП / Минпромторг',
    status: 'следующий этап',
    purpose: 'реестры промышленной продукции и российских производителей',
  },
]
