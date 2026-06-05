import snhzChemicalIndexRaw from './snhzChemicalIndex.generated.json'
import { snhzProducerLeads } from './snhzProducerLeads'
import type { Material, PlantLineItem } from './market'

type SnhzPubChemRecord = {
  cas: string | null
  cid: number
  inchiKey: string | null
  iupacName: string | null
  molecularFormula: string | null
  molecularWeight: string | null
  synonyms: string[]
}

export type SnhzChemicalRecord = {
  cas: string | null
  documents: string[]
  formula: string | null
  inchiKey: string | null
  iupacName: string | null
  molecularWeight: string | null
  name: string
  pubchem: SnhzPubChemRecord | null
  pubchemQuery: string | null
  pubchemSource: string | null
  responsible: PlantLineItem['responsible'] | null
  slug: string
  source: string
  sourceUrl: string
  standards: string[]
  status: 'pubchem_enriched' | 'pubchem_not_found' | 'needs_manual_mapping'
  tenderSpec: string
  volume: string
}

type SnhzChemicalFeed = {
  generatedAt: string
  records: SnhzChemicalRecord[]
  source: string
  sourceUrl: string
}

const snhzChemicalIndex = snhzChemicalIndexRaw as SnhzChemicalFeed

export const snhzChemicalRecords = snhzChemicalIndex.records
export const snhzChemicalByName = new Map(snhzChemicalRecords.map((record) => [normalizeKey(record.name), record]))

export function enrichSnhzLineItem(item: PlantLineItem): PlantLineItem {
  const record = snhzChemicalByName.get(normalizeKey(item.name))
  if (!record) return item

  return {
    ...item,
    cas: record.cas ?? undefined,
    chemicalSourceUrl: record.pubchemSource ?? record.sourceUrl,
    chemicalStatus: record.status,
    formula: record.formula ?? undefined,
    materialSlug: record.slug,
    photos: item.photos ?? snhzLineItemPhotos(item.name),
    pubchemCid: record.pubchem?.cid,
    responsible: record.responsible ?? undefined,
    standards: record.standards,
  }
}

function snhzLineItemPhotos(name: string): PlantLineItem['photos'] {
  const normalized = name.toLocaleLowerCase('ru-RU')
  const baseSource = 'Wikimedia Commons / визуальный референс формы поставки'

  if (normalized.includes('фенол') || normalized.includes('ионол') || normalized.includes('антиоксидант')) {
    return [
      {
        alt: `${name}: химическая продукция в таре`,
        caption: 'Справочный внешний вид тары; фактическая форма поставки подтверждается ТЗ, COA и SDS/MSDS.',
        source: baseSource,
        url: 'https://upload.wikimedia.org/wikipedia/commons/6/64/Galvanized_chemical_drums.jpg',
      },
    ]
  }

  if (normalized.includes('изопрен') || normalized.includes('изобутилен') || normalized.includes('бензин')) {
    return [
      {
        alt: `${name}: жидкая нефтехимия/топливный компонент`,
        caption: 'Справочный внешний вид промышленной тары; для сделки нужны класс опасности, паспорт и условия перевозки.',
        source: baseSource,
        url: 'https://upload.wikimedia.org/wikipedia/commons/f/fb/Fuel_depot%2C_military%2C_storage%2C_barrel_Fortepan_72469.jpg',
      },
    ]
  }

  if (normalized.includes('железо') || normalized.includes('оксид') || normalized.includes('калий') || normalized.includes('каолин')) {
    return [
      {
        alt: `${name}: порошок или минеральное сырьё`,
        caption: 'Справочный внешний вид сыпучего сырья; ключевые параметры берутся из ГОСТ/ТУ и паспорта качества партии.',
        source: baseSource,
        url: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/DAP_%28Diammonium_Phosphate%29_Granules_%281%29.jpg',
      },
    ]
  }

  return [
    {
      alt: `${name}: промышленная химия`,
      caption: 'Справочный внешний вид промышленной химии; точную форму, тару и опасность нужно подтверждать документами партии.',
      source: baseSource,
      url: 'https://upload.wikimedia.org/wikipedia/commons/6/64/Galvanized_chemical_drums.jpg',
    },
  ]
}

export const snhzGeneratedMaterials: Record<string, Material> = Object.fromEntries(
  groupBySlug(snhzChemicalRecords).map(([slug, records]) => [slug, buildMaterial(slug, records)]),
)

function buildMaterial(slug: string, records: SnhzChemicalRecord[]): Material {
  const primary = records[0]
  const standards = unique(records.flatMap((record) => record.standards))
  const documents = unique(records.flatMap((record) => record.documents))
  const specs = unique(records.map((record) => record.tenderSpec).filter(Boolean))
  const names = unique(records.map((record) => record.name))
  const cas = primary.cas ?? 'CAS нужно подтвердить'
  const formula = primary.formula ?? 'формула требует ручной проверки'
  const producerLeads = snhzProducerLeads[slug] ?? []

  return {
    buyers: [
      {
        contact: formatResponsible(primary.responsible) ?? 'СНХЗ: отдел закупок / ответственный из матрицы',
        name: 'Стерлитамакский нефтехимический завод',
        period: 'постоянная потребность по матрице сырья',
        region: 'Республика Башкортостан, Стерлитамак',
        slug: 'snhz',
        source: primary.responsible ? `СНХЗ: ${primary.responsible.name}` : 'СНХЗ: официальная матрица потребностей',
        sourceUrl: primary.sourceUrl,
        status: 'подтверждено матрицей СНХЗ',
        terms: specs.slice(0, 4).join('; ') || 'спецификация в карточке позиции',
        volume: unique(records.map((record) => record.volume)).join('; '),
      },
    ],
    cas,
    chips: [
      cas,
      formula,
      ...standards.slice(0, 4),
      records.length > 1 ? `${records.length} спецификации СНХЗ` : '1 спецификация СНХЗ',
    ],
    description: `Вещество из официальной матрицы закупаемого сырья СНХЗ. Внутри карточки сохранены требования завода, стандарты, документы для поставщика и химические идентификаторы, чтобы не уходить на внешний сайт при первичном анализе.`,
    documents: unique([...documents, 'COA по партии', 'SDS/MSDS', 'КП с условиями поставки', 'аккредитация поставщика СНХЗ']),
    hs: 'ТН ВЭД нужно классифицировать по паспорту безопасности',
    kpis: [
      { label: 'CAS', note: primary.pubchemSource ? 'PubChem PUG REST' : 'ручная проверка', value: cas },
      { label: 'Формула', note: primary.iupacName ?? 'нужна нормализация', value: formula },
      { label: 'Спецификации', note: standards.slice(0, 3).join('; ') || 'стандарт не выделен', value: `${records.length}` },
      { label: 'Производители', note: producerLeads.length ? 'подтвержденные/lead-кандидаты' : 'нужно дозаполнить', value: `${producerLeads.length}` },
    ],
    logistics: [
      { label: 'Получатель', value: 'Склад СНХЗ, Стерлитамак' },
      { label: 'Документы при перевозке', value: 'SDS/MSDS, COA, упаковочный лист, инвойс, DG declaration если опасный груз' },
      { label: 'Маршрут РФ/СНГ', value: 'авто/ЖД до Стерлитамака, режим зависит от класса опасности' },
      { label: 'Импорт', value: 'порт/граница -> таможня ЕАЭС -> авто/ЖД до Башкортостана' },
    ],
    name: primary.name,
    okpd: 'ОКПД2 нужно сопоставить после классификации',
    requirement: {
      budget: 'цена запрашивается через RFQ по партии',
      destination: 'СНХЗ, Стерлитамак',
      docs: unique([...documents, 'COA', 'SDS/MSDS']).slice(0, 8).join(', '),
      form: 'форма/тара по ТУ, СТО или ТЗ поставщика',
      grade: names.slice(0, 3).join(' / '),
      period: 'постоянная закупка, точный график по заявке',
      purity: specs.slice(0, 5).join('; ') || standards.join('; ') || 'характеристики нужно извлечь из ТЗ',
      volume: unique(records.map((record) => record.volume)).join('; '),
    },
    slug,
    sources: [
      {
        description: `Внутренняя карточка TenderStart собрана из матрицы СНХЗ: ${names.join('; ')}. Требования: ${specs.join('; ') || 'спецификацию нужно уточнить'}. Документы: ${documents.join(', ') || 'COA/SDS/MSDS'}.`,
        level: 'verified',
        name: 'СНХЗ: матрица потребностей сырья',
        update: snhzChemicalIndex.generatedAt,
        url: primary.sourceUrl,
      },
      ...producerLeads.map((supplier) => ({
        description: supplier.source,
        level: supplier.kind === 'Производитель' ? 'verified' as const : 'lead' as const,
        name: supplier.name,
        update: 'проверять перед RFQ',
        url: supplier.sourceUrl ?? '#',
      })),
      ...(primary.pubchemSource
        ? [
            {
              description: `Химическая нормализация: CAS ${cas}, формула ${formula}, CID ${primary.pubchem?.cid}.`,
              level: 'verified' as const,
              name: 'PubChem PUG REST',
              update: snhzChemicalIndex.generatedAt,
              url: primary.pubchemSource,
            },
          ]
        : []),
    ],
    suppliers: producerLeads.length ? producerLeads : [
      {
        capacity: 'подбирается после RFQ к производителям',
        confidence: primary.pubchem ? '55%' : '35%',
        country: 'Индия / Китай / РФ / СНГ',
        docs: ['COA', 'SDS/MSDS', 'TDS/спецификация', 'сертификат происхождения'],
        fob: 'нужно запросить',
        grade: primary.name,
        kind: 'Нужно проверить',
        landed: 'расчет после ставки логистики',
        leadTime: '2-6 недель после подтверждения производителя',
        moq: 'уточнить',
        name: 'TenderStart: поиск прямых производителей',
        reliability: 'lead',
        risk: 'Средний',
        route: 'производитель -> порт/граница -> таможня ЕАЭС -> СНХЗ',
        slug: `${slug}-supplier-search`,
        source: 'Внутренний RFQ-слой: нужно найти производителя, запросить COA/MSDS, мощность, цену и логистику.',
        spec: specs.slice(0, 3).join('; ') || primary.name,
      },
    ],
    un: 'класс опасности уточняется по SDS/MSDS',
  }
}

function formatResponsible(responsible: PlantLineItem['responsible'] | null | undefined) {
  if (!responsible) return null
  return `${responsible.role}: ${responsible.name}${responsible.phone ? `, ${responsible.phone}` : ''}${responsible.email ? `, ${responsible.email}` : ''}`
}

function groupBySlug(records: SnhzChemicalRecord[]) {
  const groups = new Map<string, SnhzChemicalRecord[]>()
  for (const record of records) {
    groups.set(record.slug, [...(groups.get(record.slug) ?? []), record])
  }
  return [...groups.entries()]
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}
