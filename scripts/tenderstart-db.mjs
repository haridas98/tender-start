import { mkdir } from 'node:fs/promises'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

export const DEFAULT_DB_PATH = 'data/tenderstart.sqlite'
export const DEFAULT_SNAPSHOT_PATH = 'src/data/plantDetails.generated.json'

const now = () => new Date().toISOString()

export function createTenderStartDatabase(dbPath = DEFAULT_DB_PATH) {
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      legal_name TEXT,
      inn TEXT,
      ogrn TEXT,
      kpp TEXT,
      country TEXT,
      region TEXT,
      city TEXT,
      address TEXT,
      website TEXT,
      emails_json TEXT NOT NULL DEFAULT '[]',
      phones_json TEXT NOT NULL DEFAULT '[]',
      data_level TEXT NOT NULL DEFAULT 'lead',
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plant_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      fact_type TEXT NOT NULL,
      label TEXT NOT NULL,
      value TEXT,
      status TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      observed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plant_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      brand TEXT,
      spec TEXT NOT NULL,
      volume TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      confidence TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plant_needs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      spec TEXT NOT NULL,
      estimated_volume TEXT NOT NULL,
      frequency TEXT NOT NULL,
      status TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      documents_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS procurement_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      notice_number TEXT,
      law TEXT,
      title TEXT NOT NULL,
      customer TEXT,
      status TEXT NOT NULL,
      published_at TEXT,
      price TEXT,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      parsed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS procurement_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES procurement_events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      okpd2 TEXT,
      spec TEXT NOT NULL,
      quantity TEXT,
      unit TEXT,
      price TEXT,
      documents_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ownership_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      owner_name TEXT NOT NULL,
      role TEXT NOT NULL,
      share TEXT,
      status TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      checked_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS financial_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      metric TEXT NOT NULL,
      period TEXT NOT NULL,
      value TEXT,
      status TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      checked_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sanctions_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      list_name TEXT NOT NULL,
      status TEXT NOT NULL,
      result_note TEXT NOT NULL,
      source_url TEXT NOT NULL,
      checked_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      procurement_event_id INTEGER REFERENCES procurement_events(id) ON DELETE SET NULL,
      document_type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      url TEXT,
      source_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS source_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      title TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      text TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS source_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_document_id INTEGER NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      embedding_json TEXT,
      tokens INTEGER NOT NULL,
      source_url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rag_embeddings (
      chunk_id INTEGER PRIMARY KEY REFERENCES source_chunks(id) ON DELETE CASCADE,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      model TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      vector_json TEXT NOT NULL,
      text TEXT NOT NULL,
      source_url TEXT NOT NULL,
      indexed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chemicals (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      cas TEXT,
      pubchem_cid INTEGER,
      formula TEXT,
      iupac_name TEXT,
      molecular_weight TEXT,
      inchi_key TEXT,
      canonical_smiles TEXT,
      source_level TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chemical_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chemical_id TEXT NOT NULL REFERENCES chemicals(id) ON DELETE CASCADE,
      source_name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_url TEXT,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS chemical_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chemical_id TEXT NOT NULL REFERENCES chemicals(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      source_url TEXT
    );
  `)
  return db
}

export function seedDomBytKhimProfile(db) {
  const companyId = 'company_dombytkhim'
  const manufacturerUrl = 'https://manufacturers.ru/company/dombytkhim'
  const siteUrl = 'https://dbxim.ru/'
  const eisSearchUrl = `https://zakupki.gov.ru/epz/order/extendedsearch/results.html?searchString=${encodeURIComponent('0107017663')}&morphology=on&recordsPerPage=_10&sortBy=UPDATE_DATE&sortDirection=false`
  const date = now()

  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM companies WHERE id = ?').run(companyId)
    db.prepare(`
      INSERT INTO companies (
        id, slug, display_name, legal_name, inn, ogrn, kpp, country, region, city, address, website,
        emails_json, phones_json, data_level, source_name, source_url, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId,
      'adygea-dombytkhim',
      'ДомБытХим',
      'ООО "ДомБытХим"',
      '0107017663',
      '1090107001082',
      '010701001',
      'Россия',
      'Республика Адыгея',
      'п. Яблоновский',
      'п. Яблоновский, ул. Ленина, 39а',
      siteUrl,
      JSON.stringify(['info@dbxim.ru', 'marketing@dbxim.ru']),
      JSON.stringify(['+7 989 125 51 55', '8 800 500 58 83']),
      'verified_profile',
      'manufacturers.ru + dbxim.ru',
      manufacturerUrl,
      date,
    )

    const facts = [
      ['registry', 'Дата регистрации', '25.08.2009', 'verified'],
      ['registry', 'Дата основания', '1999', 'source_claim'],
      ['scale', 'Количество сотрудников', '180', 'source_claim'],
      ['scale', 'Капитализация', 'для ООО не применимо; нужна оценка через выручку/EBITDA/активы', 'needs_financial_source'],
      ['production', 'Состав предприятия', 'цеха производства и розлива; завод пластиковых изделий; лаборатория рецептур; инструментальный цех пресс-форм', 'source_claim'],
      ['market', 'География поставок', 'Россия и страны ближнего зарубежья', 'source_claim'],
      ['compliance', 'Сертификация продукции', 'производимая продукция сертифицируется органами СЭС', 'source_claim'],
    ]
    for (const fact of facts) insertFact(db, companyId, fact, manufacturerUrl, date)

    const products = [
      ['Средства бытовой химии под СТМ', 'СТМ', 'контрактное производство бытовой химии; рецептура, розлив, фасовка, упаковка', 'по заказам дистрибьюторов и сетей', 'source_claim'],
      ['Чистящие средства "Крот"', 'Крот', 'товары бытовой химии; точные рецептуры и концентрации нужно запрашивать через SDS/COA', 'серийное производство', 'source_claim'],
      ['Средства Blitz', 'Blitz', 'товары бытовой химии; требуется паспорт безопасности и декларация соответствия на SKU', 'серийное производство', 'source_claim'],
      ['Средства Nega', 'Nega', 'товары бытовой химии; SKU нужно выгружать с сайта/каталога', 'серийное производство', 'source_claim'],
      ['Средства "Чистолюб"', 'Чистолюб', 'товары бытовой химии; точные составы только по SDS/этикетке', 'серийное производство', 'source_claim'],
      ['Средства Santex', 'Santex', 'товары бытовой химии; нужны декларации, SDS, спецификации упаковки', 'серийное производство', 'source_claim'],
      ['Пластиковые флаконы и укупорка', 'внутреннее производство', 'флаконы/крышки/укупорка для собственной продукции и СТМ', 'по производственной программе', 'source_claim'],
      ['Пресс-формы', 'инструментальный цех', 'производство пресс-форм для пластиковой упаковки', 'под собственные линии', 'source_claim'],
    ]
    for (const product of products) insertProduct(db, companyId, product, manufacturerUrl)

    const needs = [
      ['Анионные/неионогенные ПАВ', 'LAS/SLES/АЭО и аналоги; концентрация, активное вещество, цветность, запах, pH, совместимость с рецептурой', 'по производственной программе', 'регулярно', 'profile_inferred', ['SDS/MSDS', 'COA', 'спецификация', 'паспорт безопасности', 'договор поставки']],
      ['Щелочи и функциональные добавки', 'NaOH/карбонаты/комплексоны/стабилизаторы; концентрация, чистота, тара, класс опасности', 'по партиям рецептур', 'регулярно', 'profile_inferred', ['SDS/MSDS', 'COA', 'декларация/сертификат', 'UN/DG при опасном грузе']],
      ['Отдушки и красители', 'совместимость с бытовой химией, стойкость запаха/цвета, аллергенная декларация при необходимости', 'малотоннажные партии', 'по SKU', 'profile_inferred', ['SDS/MSDS', 'IFRA/спецификация при наличии', 'COA']],
      ['Консерванты и биоцидные добавки', 'дозировка, совместимость, разрешительная документация, паспорт безопасности', 'малотоннажные партии', 'по рецептуре', 'profile_inferred', ['SDS/MSDS', 'COA', 'регистрационные документы']],
      ['ПЭТ/ПНД флаконы, крышки, канистры', 'объем, горловина, цвет, масса изделия, прочность, совместимость с химией', 'по плану розлива', 'регулярно', 'profile_inferred', ['чертеж/спецификация', 'сертификат материала', 'договор поставки']],
      ['Этикетка, картон, групповая упаковка', 'материал, клей, стойкость к влаге/химии, тираж, штрихкод/маркировка', 'по SKU', 'регулярно', 'profile_inferred', ['макет', 'спецификация печати', 'договор']],
    ]
    for (const need of needs) insertNeed(db, companyId, need, manufacturerUrl)

    const eventId = insertProcurementEvent(db, companyId, {
      customer: 'ООО "ДомБытХим"',
      law: '44-ФЗ/223-ФЗ search',
      parsedAt: date,
      price: null,
      publishedAt: null,
      sourceName: 'ЕИС закупки',
      sourceUrl: eisSearchUrl,
      status: 'no_exact_notice_found_yet',
      title: 'ЕИС: поиск закупок и договоров по ИНН 0107017663',
    })
    insertProcurementItem(db, eventId, ['ПАВ / химсырье / тара', null, 'Точных извещений по ИНН в стартовом прогоне не найдено; нужно подключить ежедневный парсер ЕИС/223-ФЗ и коммерческие ЭТП', null, null, null, ['извещение', 'ТЗ', 'проект договора', 'спецификация']])

    const docs = [
      ['company_profile', 'Карточка manufacturers.ru: реквизиты, контакты, описание', 'public', manufacturerUrl, 'manufacturers.ru'],
      ['website', 'Официальный сайт ДомБытХим', 'public', siteUrl, 'dbxim.ru'],
      ['SDS', 'SDS/MSDS по конкретному SKU', 'request_required', null, 'поставщик/производитель'],
      ['COA', 'Паспорт качества партии сырья', 'request_required', null, 'поставщик сырья'],
      ['contract', 'Шаблон договора поставки сырья/тары', 'template_needed', null, 'TenderStart'],
      ['procurement_search', 'ЕИС поиск по ИНН 0107017663', 'public_search', eisSearchUrl, 'zakupki.gov.ru'],
    ]
    for (const doc of docs) insertDocument(db, companyId, null, doc)

    const owners = [
      ['Собственники/учредители', 'beneficial_owner', 'нужно выгрузить из ЕГРЮЛ/СПАРК/Контур/ФНС', 'needs_registry_source', 'ФНС/ЕГРЮЛ', 'https://egrul.nalog.ru/'],
      ['Руководитель', 'director', 'нужно выгрузить из ЕГРЮЛ/ФНС', 'needs_registry_source', 'ФНС/ЕГРЮЛ', 'https://egrul.nalog.ru/'],
    ]
    for (const owner of owners) insertOwnership(db, companyId, owner, date)

    const financials = [
      ['authorized_capital', 'текущий', null, 'needs_registry_source', 'ФНС/ЕГРЮЛ или бухгалтерская отчетность', 'https://bo.nalog.ru/'],
      ['revenue', 'последний год', null, 'needs_accounting_source', 'ГИР БО / ФНС', 'https://bo.nalog.ru/'],
      ['net_profit', 'последний год', null, 'needs_accounting_source', 'ГИР БО / ФНС', 'https://bo.nalog.ru/'],
      ['assets', 'последний год', null, 'needs_accounting_source', 'ГИР БО / ФНС', 'https://bo.nalog.ru/'],
      ['employees', 'карточка manufacturers.ru', '180', 'source_claim', 'manufacturers.ru', manufacturerUrl],
    ]
    for (const metric of financials) insertFinancial(db, companyId, metric, date)

    const sanctions = [
      ['OFAC SDN', 'requires_screening', 'Автоматическая проверка по списку OFAC не выполнена в seed; нужна интеграция sanctions API/CSV.', 'https://sanctionssearch.ofac.treas.gov/'],
      ['EU Financial Sanctions', 'requires_screening', 'Нужна проверка по EU consolidated list.', 'https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions'],
      ['UK OFSI', 'requires_screening', 'Нужна проверка по UK sanctions list.', 'https://sanctionssearch.ofsi.hmtreasury.gov.uk/'],
      ['РФ/локальные ограничения', 'requires_screening', 'Нужна проверка по российским и отраслевым ограничениям.', 'https://customs.gov.ru/'],
    ]
    for (const check of sanctions) insertSanctionsCheck(db, companyId, check, date)

    insertSourceDocument(db, companyId, {
      sourceName: 'manufacturers.ru',
      sourceUrl: manufacturerUrl,
      title: 'ДомБытХим: карточка производителя',
      text: 'ДомБытХим - производитель бытовой химии в Республике Адыгея, п. Яблоновский. ИНН 0107017663, ОГРН 1090107001082, КПП 010701001. Дата регистрации 25.08.2009. Количество сотрудников 180. Дата основания 1999. В составе предприятия: цеха производства и розлива, завод пластиковых изделий, лаборатория рецептур, инструментальный цех пресс-форм. Торговые марки: Крот, Blitz, Nega, Чистолюб, Santex. Поставки собственной продукции идут по России и странам ближнего зарубежья. Контакты: +7 989 125 51 55, info@dbxim.ru, marketing@dbxim.ru. Адрес: п. Яблоновский, ул. Ленина, 39а.',
    })
    insertSourceDocument(db, companyId, {
      sourceName: 'TenderStart inference',
      sourceUrl: manufacturerUrl,
      title: 'Потребности ДомБытХим по производственному профилю',
      text: 'Для производства бытовой химии и СТМ вероятны регулярные закупки ПАВ, щелочей, функциональных добавок, отдушек, красителей, консервантов, флаконов, канистр, крышек, этикетки, картона. Каждая позиция должна подтверждаться тендером, RFQ, договором или коммерческим предложением; нужны SDS/MSDS, COA, спецификация, паспорт безопасности, условия перевозки и хранения.',
    })

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function exportPlantDetailsSnapshot(db, outputPath = DEFAULT_SNAPSHOT_PATH, { includeLeadProfiles = false } = {}) {
  const companies = includeLeadProfiles
    ? db.prepare('SELECT * FROM companies ORDER BY display_name').all()
    : db.prepare(`
      SELECT * FROM companies
      WHERE data_level IN ('verified_profile', 'parsed_procurement')
        OR EXISTS (SELECT 1 FROM procurement_events WHERE procurement_events.company_id = companies.id)
      ORDER BY display_name
    `).all()
  const snapshot = {}
  for (const company of companies) {
    snapshot[company.slug] = {
      company: normalizeCompany(company),
      documents: rows(db, 'SELECT * FROM documents WHERE company_id = ? ORDER BY id', company.id),
      facts: rows(db, 'SELECT * FROM plant_facts WHERE company_id = ? ORDER BY id', company.id),
      financials: rows(db, 'SELECT * FROM financial_metrics WHERE company_id = ? ORDER BY id', company.id),
      needs: rows(db, 'SELECT * FROM plant_needs WHERE company_id = ? ORDER BY id', company.id).map(parseDocumentsJson),
      ownership: rows(db, 'SELECT * FROM ownership_records WHERE company_id = ? ORDER BY id', company.id),
      procurementEvents: rows(db, 'SELECT * FROM procurement_events WHERE company_id = ? ORDER BY id', company.id).map((event) => ({
        ...event,
        items: rows(db, 'SELECT * FROM procurement_items WHERE event_id = ? ORDER BY id', event.id).map(parseDocumentsJson),
      })),
      products: rows(db, 'SELECT * FROM plant_products WHERE company_id = ? ORDER BY id', company.id),
      ragChunks: rows(db, 'SELECT text, source_url FROM source_chunks WHERE company_id = ? ORDER BY id', company.id),
      sanctionsChecks: rows(db, 'SELECT * FROM sanctions_checks WHERE company_id = ? ORDER BY id', company.id),
    }
  }
  if (outputPath) {
    mkdirSync(dirname(resolve(outputPath)), { recursive: true })
    writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  }
  return snapshot
}

export function searchRagChunks(db, query, limit = 5) {
  const terms = String(query)
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2)
  const chunks = db.prepare('SELECT text, source_url FROM source_chunks').all()
  return chunks
    .map((chunk) => ({
      ...chunk,
      score: terms.reduce((score, term) => score + (chunk.text.toLowerCase().includes(term) ? 1 : 0), 0),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function importDemandFeedToDb(db, feedPath = 'src/data/russianDemandFeed.json') {
  const feed = JSON.parse(readFileSync(resolve(feedPath), 'utf8'))
  const importedAt = feed.updatedAt ?? now()
  let imported = 0

  db.exec('BEGIN')
  try {
    for (const item of feed.items ?? []) {
      if (!item?.id || !item?.organization) continue
      const country = item.country ?? 'Р РѕСЃСЃРёСЏ'
      const companyId = `buyer_${stableId(`${country}:${item.organization}:${item.region}`).slice(0, 16)}`
      const slug = `buyer-${slugify(item.organization)}-${companyId.slice(-6)}`
      const sourceUrl = item.procurementUrl ?? 'https://zakupki.gov.ru/'
      const sourceName = item.source ?? feed.source ?? 'procurement parser'
      const noticeNumber = item.noticeNumber ?? item.id
      const companyEmails = item.buyerEmail ? [item.buyerEmail] : []
      const companyPhones = item.buyerPhone ? [item.buyerPhone] : []
      const dataLevel = ['high', 'medium'].includes(item.confidence) ? 'parsed_procurement' : 'lead'

      db.prepare(`
        INSERT OR IGNORE INTO companies (
          id, slug, display_name, legal_name, inn, ogrn, kpp, country, region, city, address, website,
          emails_json, phones_json, data_level, source_name, source_url, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        companyId,
        slug,
        item.organization,
        null,
        null,
        null,
        null,
        'Россия',
        item.region ?? 'РФ',
        null,
        null,
        null,
        JSON.stringify(companyEmails),
        JSON.stringify(companyPhones),
        dataLevel,
        sourceName,
        sourceUrl,
        importedAt,
      )
      db.prepare('UPDATE companies SET slug = ?, display_name = ?, region = ?, emails_json = ?, phones_json = ?, data_level = ?, source_name = ?, source_url = ?, updated_at = ? WHERE id = ?')
        .run(slug, item.organization, item.region ?? 'РФ', JSON.stringify(companyEmails), JSON.stringify(companyPhones), dataLevel, sourceName, sourceUrl, importedAt, companyId)

      if (item.country) db.prepare('UPDATE companies SET country = ? WHERE id = ?').run(item.country, companyId)

      const documents = normalizeProcurementDocuments(item, sourceUrl)
      const procurementItems = normalizeProcurementItems(item, documents)
      const existingEvent = db.prepare('SELECT id FROM procurement_events WHERE notice_number = ?').get(noticeNumber)
      if (existingEvent) {
        for (const document of documents) {
          upsertProcurementDocument(db, companyId, existingEvent.id, document, sourceName, sourceUrl)
        }
        continue
      }

      const eventId = insertProcurementEvent(db, companyId, {
        customer: item.organization,
        law: item.law ?? 'ЕИС search',
        noticeNumber,
        parsedAt: importedAt,
        price: item.targetPriceRubPerTon ? `${item.targetPriceRubPerTon} руб/т` : null,
        publishedAt: item.publishedAt ?? null,
        sourceName,
        sourceUrl,
        status: item.status ?? (item.confidence === 'medium' ? 'parsed_daily_signal' : 'needs_document_download'),
        title: item.title ?? `Закупка: ${item.productId}`,
      })
      for (const procurementItem of procurementItems) {
        insertProcurementItem(db, eventId, [
          procurementItem.name,
          procurementItem.okpd2 ?? null,
          procurementItem.spec,
          procurementItem.quantity ?? null,
          procurementItem.unit ?? null,
          procurementItem.price ?? null,
          procurementItem.documents,
        ])
        insertNeedFromProcurement(db, companyId, procurementItem, sourceName, sourceUrl)
      }
      for (const document of documents) {
        upsertProcurementDocument(db, companyId, eventId, document, sourceName, sourceUrl)
      }
      insertSourceDocument(db, companyId, {
        sourceName,
        sourceUrl,
        title: item.title ?? `Procurement ${noticeNumber}`,
        text: item.sourceDocumentText ?? buildProcurementSourceText(item, procurementItems, documents),
      })
      imported += 1
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return { imported, total: feed.items?.length ?? 0 }
}

export function importPlantLeadFeedToDb(
  db,
  feedPath = 'src/data/russiaMassPlantLeads.json',
  { limit = Infinity, replaceCountries = [] } = {},
) {
  const feed = JSON.parse(readFileSync(resolve(feedPath), 'utf8'))
  const importedAt = feed.updatedAt ?? now()
  const items = (feed.items ?? []).slice(0, limit)
  const incomingSlugs = new Set(items.map((item) => item?.slug).filter(Boolean))
  let imported = 0

  db.exec('BEGIN')
  try {
    for (const country of replaceCountries) {
      const staleCompanies = db.prepare(`
        SELECT id, slug FROM companies
        WHERE country = ?
          AND data_level IN ('plant_lead', 'source_registry_lead')
      `).all(country)
      for (const company of staleCompanies) {
        if (incomingSlugs.has(company.slug)) continue
        db.prepare('DELETE FROM companies WHERE id = ?').run(company.id)
      }
    }

    for (const item of items) {
      if (!item?.name || !item?.slug) continue
      const companyId = `plant_${stableId(item.slug).slice(0, 16)}`
      const sourceName = item.sourceName ?? feed.source ?? 'plant lead feed'
      const sourceUrl = item.sourceUrl ?? 'https://gisp.gov.ru/'
      const documents = item.documents ?? []
      const inn = extractDocumentNumber(documents, 'ИНН')
      const ogrn = extractDocumentNumber(documents, 'ОГРН')
      const dataLevel = /gisp|гисп|Р“РРЎРџ/i.test(sourceName) ? 'source_registry_lead' : 'plant_lead'

      db.prepare(`
        INSERT OR IGNORE INTO companies (
          id, slug, display_name, legal_name, inn, ogrn, kpp, country, region, city, address, website,
          emails_json, phones_json, data_level, source_name, source_url, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        companyId,
        item.slug,
        item.name,
        item.legalName ?? null,
        inn,
        ogrn,
        null,
        item.country ?? 'Россия',
        item.region ?? null,
        item.city ?? null,
        item.address ?? null,
        item.website ?? null,
        JSON.stringify(item.emails ?? []),
        JSON.stringify(item.phones ?? []),
        dataLevel,
        sourceName,
        sourceUrl,
        importedAt,
      )
      db.prepare(`
        UPDATE companies
        SET slug = ?, display_name = ?, legal_name = ?, inn = ?, ogrn = ?, country = ?, region = ?, city = ?,
            address = ?, website = ?, emails_json = ?, phones_json = ?, data_level = ?, source_name = ?, source_url = ?, updated_at = ?
        WHERE id = ?
      `).run(
        item.slug,
        item.name,
        item.legalName ?? null,
        inn,
        ogrn,
        item.country ?? 'Россия',
        item.region ?? null,
        item.city ?? null,
        item.address ?? null,
        item.website ?? null,
        JSON.stringify(item.emails ?? []),
        JSON.stringify(item.phones ?? []),
        dataLevel,
        sourceName,
        sourceUrl,
        importedAt,
        companyId,
      )

      db.prepare('DELETE FROM plant_facts WHERE company_id = ?').run(companyId)
      db.prepare('DELETE FROM plant_products WHERE company_id = ?').run(companyId)
      db.prepare('DELETE FROM plant_needs WHERE company_id = ?').run(companyId)
      db.prepare('DELETE FROM documents WHERE company_id = ? AND procurement_event_id IS NULL').run(companyId)
      db.prepare('DELETE FROM source_documents WHERE company_id = ?').run(companyId)

      insertLeadFact(db, companyId, ['industry', 'Industry', item.industry ?? 'needs classification', 'lead'], sourceName, sourceUrl, importedAt)
      insertLeadFact(db, companyId, ['equipment', 'Equipment', (item.equipment ?? []).join('; '), 'lead'], sourceName, sourceUrl, importedAt)

      for (const product of normalizeLeadProducts(item)) {
        db.prepare(`
          INSERT INTO plant_products (company_id, name, brand, spec, volume, source_name, source_url, confidence)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(companyId, product.name, null, product.spec, product.volume, product.sourceName, product.sourceUrl, product.confidence)
      }

      for (const need of normalizeLeadNeeds(item)) {
        db.prepare(`
          INSERT INTO plant_needs (company_id, name, spec, estimated_volume, frequency, status, source_name, source_url, documents_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(companyId, need.name, need.spec, need.volume, need.frequency, need.status, need.sourceName, need.sourceUrl, JSON.stringify(need.documents))
      }

      for (const documentTitle of documents) {
        insertDocument(db, companyId, null, ['plant_lead_document', documentTitle, 'lead', null, sourceName])
      }

      insertSourceDocument(db, companyId, {
        sourceName,
        sourceUrl,
        title: `Plant lead: ${item.name}`,
        text: buildPlantLeadSourceText(item, documents),
      })
      imported += 1
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return { imported, total: feed.items?.length ?? 0 }
}

export function importChemicalCatalogToDb(db, feedPath = 'src/data/chemicalCatalog.generated.json') {
  const feed = JSON.parse(readFileSync(resolve(feedPath), 'utf8'))
  const importedAt = feed.generatedAt ?? now()
  let imported = 0

  db.exec('BEGIN')
  try {
    for (const record of feed.records ?? []) {
      if (!record?.slug || !record?.name) continue
      const chemicalId = `chemical_${stableId(record.cas ?? record.slug).slice(0, 16)}`
      db.prepare(`
        INSERT INTO chemicals (
          id, slug, display_name, cas, pubchem_cid, formula, iupac_name, molecular_weight,
          inchi_key, canonical_smiles, source_level, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          slug = excluded.slug,
          display_name = excluded.display_name,
          cas = excluded.cas,
          pubchem_cid = excluded.pubchem_cid,
          formula = excluded.formula,
          iupac_name = excluded.iupac_name,
          molecular_weight = excluded.molecular_weight,
          inchi_key = excluded.inchi_key,
          canonical_smiles = excluded.canonical_smiles,
          source_level = excluded.source_level,
          updated_at = excluded.updated_at
      `).run(
        chemicalId,
        record.slug,
        record.name,
        record.cas ?? null,
        record.pubchem?.cid ?? null,
        record.pubchem?.molecularFormula ?? null,
        record.pubchem?.iupacName ?? null,
        record.pubchem?.molecularWeight ?? null,
        record.pubchem?.inchiKey ?? null,
        record.pubchem?.canonicalSmiles ?? null,
        record.sourceLevel ?? 'lead',
        importedAt,
      )

      db.prepare('DELETE FROM chemical_sources WHERE chemical_id = ?').run(chemicalId)
      db.prepare('DELETE FROM chemical_documents WHERE chemical_id = ?').run(chemicalId)

      for (const source of record.sourceRefs ?? []) {
        db.prepare('INSERT INTO chemical_sources (chemical_id, source_name, source_type, source_url, note) VALUES (?, ?, ?, ?, ?)')
          .run(chemicalId, source.sourceName ?? 'source', source.sourceType ?? 'source', source.sourceUrl ?? null, source.note ?? null)
      }
      if (record.pubchem?.pubchemUrl) {
        db.prepare('INSERT INTO chemical_sources (chemical_id, source_name, source_type, source_url, note) VALUES (?, ?, ?, ?, ?)')
          .run(chemicalId, 'PubChem PUG REST', 'chemical_identifier', record.pubchem.pubchemUrl, `CID ${record.pubchem.cid}`)
      }
      if (record.safety?.sourceUrl) {
        db.prepare('INSERT INTO chemical_sources (chemical_id, source_name, source_type, source_url, note) VALUES (?, ?, ?, ?, ?)')
          .run(chemicalId, 'PubChem PUG View', 'safety', record.safety.sourceUrl, 'GHS classification')
      }
      for (const procurement of record.procurementRefs ?? []) {
        db.prepare('INSERT INTO chemical_sources (chemical_id, source_name, source_type, source_url, note) VALUES (?, ?, ?, ?, ?)')
          .run(chemicalId, procurement.sourceName ?? 'procurement', 'procurement', procurement.sourceUrl ?? null, procurement.noticeNumber ?? procurement.status ?? null)
      }

      for (const documentTitle of record.documents ?? []) {
        db.prepare('INSERT INTO chemical_documents (chemical_id, document_type, title, status, source_url) VALUES (?, ?, ?, ?, ?)')
          .run(chemicalId, inferChemicalDocumentType(documentTitle), documentTitle, 'required_or_parsed', null)
      }
      imported += 1
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return { imported, total: feed.records?.length ?? 0 }
}

function insertFact(db, companyId, [factType, label, value, status], sourceUrl, observedAt) {
  db.prepare('INSERT INTO plant_facts (company_id, fact_type, label, value, status, source_name, source_url, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(companyId, factType, label, value, status, 'manufacturers.ru', sourceUrl, observedAt)
}

function insertLeadFact(db, companyId, [factType, label, value, status], sourceName, sourceUrl, observedAt) {
  db.prepare('INSERT INTO plant_facts (company_id, fact_type, label, value, status, source_name, source_url, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(companyId, factType, label, value, status, sourceName, sourceUrl, observedAt)
}

function insertProduct(db, companyId, [name, brand, spec, volume, confidence], sourceUrl) {
  db.prepare('INSERT INTO plant_products (company_id, name, brand, spec, volume, source_name, source_url, confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(companyId, name, brand, spec, volume, 'manufacturers.ru + dbxim.ru', sourceUrl, confidence)
}

function insertNeed(db, companyId, [name, spec, estimatedVolume, frequency, status, documents], sourceUrl) {
  db.prepare('INSERT INTO plant_needs (company_id, name, spec, estimated_volume, frequency, status, source_name, source_url, documents_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(companyId, name, spec, estimatedVolume, frequency, status, 'TenderStart inference from production profile', sourceUrl, JSON.stringify(documents))
}

function insertProcurementEvent(db, companyId, event) {
  const result = db.prepare(`
    INSERT INTO procurement_events (company_id, notice_number, law, title, customer, status, published_at, price, source_name, source_url, parsed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(companyId, event.noticeNumber ?? null, event.law, event.title, event.customer, event.status, event.publishedAt, event.price, event.sourceName, event.sourceUrl, event.parsedAt)
  return Number(result.lastInsertRowid)
}

function insertProcurementItem(db, eventId, [name, okpd2, spec, quantity, unit, price, documents]) {
  db.prepare('INSERT INTO procurement_items (event_id, name, okpd2, spec, quantity, unit, price, documents_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(eventId, name, okpd2, spec, quantity, unit, price, JSON.stringify(documents))
}

function insertDocument(db, companyId, procurementEventId, [documentType, title, status, url, sourceName]) {
  db.prepare('INSERT INTO documents (company_id, procurement_event_id, document_type, title, status, url, source_name) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(companyId, procurementEventId, documentType, title, status, url, sourceName)
}

function upsertProcurementDocument(db, companyId, eventId, document, sourceName, sourceUrl) {
  const url = document.localPath ?? document.url ?? sourceUrl
  const existing = db.prepare('SELECT id FROM documents WHERE procurement_event_id = ? AND title = ?').get(eventId, document.title)
  if (existing) {
    db.prepare('UPDATE documents SET document_type = ?, status = ?, url = ?, source_name = ? WHERE id = ?')
      .run(document.type, document.status, url, sourceName, existing.id)
    return
  }
  insertDocument(db, companyId, eventId, [document.type, document.title, document.status, url, sourceName])
}

function insertNeedFromProcurement(db, companyId, item, sourceName, sourceUrl) {
  db.prepare('INSERT INTO plant_needs (company_id, name, spec, estimated_volume, frequency, status, source_name, source_url, documents_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(
      companyId,
      item.name,
      item.spec,
      [item.quantity, item.unit].filter(Boolean).join(' ') || 'уточняется по документам',
      'по закупочной процедуре',
      'parsed_tender',
      sourceName,
      sourceUrl,
      JSON.stringify(item.documents ?? []),
    )
}

function normalizeProcurementDocuments(item, sourceUrl) {
  const incoming = Array.isArray(item.documents) ? item.documents : []
  const documents = incoming.map((document) => {
    if (typeof document === 'string') {
      return {
        localPath: null,
        status: 'listed',
        title: document,
        type: inferProcurementDocumentType(document),
        url: sourceUrl,
      }
    }
    return {
      localPath: document.localPath ?? null,
      status: document.status ?? (document.localPath ? 'downloaded' : 'available_for_download'),
      title: document.title ?? 'procurement document',
      type: document.type ?? inferProcurementDocumentType(document.title),
      url: document.url ?? sourceUrl,
    }
  })

  if (documents.length === 0) {
    documents.push({
      localPath: null,
      status: 'parsed_url',
      title: `Извещение: ${item.noticeNumber ?? item.id}`,
      type: 'procurement_notice',
      url: sourceUrl,
    })
  }

  return dedupeBy(documents, (document) => `${document.type}:${document.title}:${document.url}`)
}

function normalizeProcurementItems(item, documents) {
  const documentTitles = documents.map((document) => document.title)
  if (Array.isArray(item.items) && item.items.length > 0) {
    return item.items.map((row) => ({
      documents: normalizeDocumentTitles(row.documents, documentTitles),
      name: row.name ?? item.productId ?? item.title ?? item.id,
      okpd2: row.okpd2 ?? null,
      price: row.price ?? (item.targetPriceRubPerTon ? `${item.targetPriceRubPerTon} руб/т` : null),
      quantity: row.quantity ?? (item.monthlyVolumeTons ? String(item.monthlyVolumeTons) : null),
      spec: row.spec ?? item.sourceDocumentText ?? 'позиция распознана из закупочной процедуры',
      unit: row.unit ?? (item.monthlyVolumeTons ? 'т' : null),
    }))
  }

  return [{
    documents: documentTitles.length > 0 ? documentTitles : ['извещение', 'ТЗ/спецификация', 'проект договора', 'протоколы'],
    name: item.productId ?? item.title ?? item.id,
    okpd2: null,
    price: item.targetPriceRubPerTon ? `${item.targetPriceRubPerTon} руб/т` : null,
    quantity: item.monthlyVolumeTons ? String(item.monthlyVolumeTons) : null,
    spec: item.sourceDocumentText ?? 'позиция распознана из выдачи; точные характеристики берутся из документов закупки',
    unit: item.monthlyVolumeTons ? 'т' : null,
  }]
}

function buildProcurementSourceText(item, procurementItems, documents) {
  return [
    `Закупка ${item.noticeNumber ?? item.id}: ${item.title ?? item.productId ?? item.id}.`,
    `Заказчик: ${item.organization}.`,
    item.region ? `Регион: ${item.region}.` : '',
    item.publishedAt ? `Дата публикации: ${item.publishedAt}.` : '',
    item.status ? `Статус: ${item.status}.` : '',
    item.buyerContact ? `Контакт закупщика: ${item.buyerContact}.` : '',
    procurementItems.length ? `Позиции: ${procurementItems.map((row) => `${row.name} (${row.spec})`).join('; ')}.` : '',
    documents.length ? `Документы: ${documents.map((document) => document.title).join(', ')}.` : '',
    item.procurementUrl ? `URL процедуры: ${item.procurementUrl}.` : '',
  ].filter(Boolean).join(' ')
}

function normalizeDocumentTitles(value, fallback) {
  if (!Array.isArray(value) || value.length === 0) return fallback
  return value.map((document) => typeof document === 'string' ? document : document.title).filter(Boolean)
}

function inferProcurementDocumentType(title) {
  if (/тз|техничес/i.test(String(title))) return 'technical_specification'
  if (/договор|nda|dpr/i.test(String(title))) return 'contract_template'
  if (/форма|ткп|xlsx|xlsm/i.test(String(title))) return 'supplier_form'
  if (/manual|руковод/i.test(String(title))) return 'supplier_manual'
  return 'procurement_document'
}

function inferChemicalDocumentType(title) {
  if (/sds|msds|паспорт безопасности/i.test(String(title))) return 'safety_data_sheet'
  if (/coa|паспорт качества|quality/i.test(String(title))) return 'certificate_of_analysis'
  if (/tds|spec|специфик/i.test(String(title))) return 'technical_data_sheet'
  if (/origin|происхожд/i.test(String(title))) return 'certificate_of_origin'
  if (/contract|договор|incoterms/i.test(String(title))) return 'contract'
  if (/invoice|packing/i.test(String(title))) return 'trade_document'
  return 'chemical_document'
}

function dedupeBy(items, keyFn) {
  const seen = new Set()
  return items.filter((item) => {
    const key = keyFn(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function insertOwnership(db, companyId, [ownerName, role, share, status, sourceName, sourceUrl], checkedAt) {
  db.prepare('INSERT INTO ownership_records (company_id, owner_name, role, share, status, source_name, source_url, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(companyId, ownerName, role, share, status, sourceName, sourceUrl, checkedAt)
}

function insertFinancial(db, companyId, [metric, period, value, status, sourceName, sourceUrl], checkedAt) {
  db.prepare('INSERT INTO financial_metrics (company_id, metric, period, value, status, source_name, source_url, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(companyId, metric, period, value, status, sourceName, sourceUrl, checkedAt)
}

function insertSanctionsCheck(db, companyId, [listName, status, resultNote, sourceUrl], checkedAt) {
  db.prepare('INSERT INTO sanctions_checks (company_id, list_name, status, result_note, source_url, checked_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(companyId, listName, status, resultNote, sourceUrl, checkedAt)
}

function insertSourceDocument(db, companyId, { sourceName, sourceUrl, title, text }) {
  const result = db.prepare('INSERT INTO source_documents (company_id, source_name, source_url, title, fetched_at, text) VALUES (?, ?, ?, ?, ?, ?)')
    .run(companyId, sourceName, sourceUrl, title, now(), text)
  const documentId = Number(result.lastInsertRowid)
  const chunks = chunkText(text)
  chunks.forEach((chunk, index) => {
    db.prepare('INSERT INTO source_chunks (source_document_id, company_id, chunk_index, text, embedding_json, tokens, source_url) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(documentId, companyId, index, chunk, null, chunk.split(/\s+/).length, sourceUrl)
  })
}

function chunkText(text, maxWords = 90) {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks = []
  for (let index = 0; index < words.length; index += maxWords) {
    chunks.push(words.slice(index, index + maxWords).join(' '))
  }
  return chunks
}

function rows(db, sql, ...params) {
  return db.prepare(sql).all(...params)
}

function normalizeCompany(company) {
  return {
    ...company,
    emails: JSON.parse(company.emails_json),
    phones: JSON.parse(company.phones_json),
    emails_json: undefined,
    phones_json: undefined,
  }
}

function parseDocumentsJson(row) {
  return { ...row, documents: JSON.parse(row.documents_json), documents_json: undefined }
}

function normalizeLeadProducts(item) {
  const productionItems = Array.isArray(item.productionItems) ? item.productionItems : []
  if (productionItems.length > 0) {
    return productionItems.map((product) => ({
      confidence: product.status ?? 'lead',
      name: product.name,
      sourceName: product.source ?? item.sourceName ?? 'plant lead feed',
      sourceUrl: product.sourceUrl ?? item.sourceUrl ?? 'https://gisp.gov.ru/',
      spec: product.spec ?? 'needs specification',
      volume: product.volume ?? 'needs volume',
    }))
  }

  return (item.products ?? []).map((name) => ({
    confidence: 'lead',
    name,
    sourceName: item.sourceName ?? 'plant lead feed',
    sourceUrl: item.sourceUrl ?? 'https://gisp.gov.ru/',
    spec: 'needs specification',
    volume: 'needs volume',
  }))
}

function normalizeLeadNeeds(item) {
  const demandItems = Array.isArray(item.demandItems) ? item.demandItems : []
  if (demandItems.length > 0) {
    return demandItems.map((need) => ({
      documents: need.documents ?? ['specification', 'contract'],
      frequency: need.frequency ?? 'needs schedule',
      name: need.name,
      sourceName: need.source ?? item.sourceName ?? 'plant lead feed',
      sourceUrl: need.sourceUrl ?? item.sourceUrl ?? 'https://gisp.gov.ru/',
      spec: need.spec ?? 'needs specification',
      status: need.status ?? 'lead',
      volume: need.volume ?? 'needs volume',
    }))
  }

  return (item.purchaseCategories ?? []).map((name) => ({
    documents: ['specification', 'quality passport', 'contract'],
    frequency: 'needs schedule',
    name,
    sourceName: item.sourceName ?? 'plant lead feed',
    sourceUrl: item.sourceUrl ?? 'https://gisp.gov.ru/',
    spec: 'needs specification and tender confirmation',
    status: 'lead',
    volume: 'needs volume',
  }))
}

function buildPlantLeadSourceText(item, documents) {
  return [
    `${item.name} is a plant lead.`,
    item.legalName ? `Legal name: ${item.legalName}.` : '',
    item.region ? `Region: ${item.region}.` : '',
    item.city ? `City: ${item.city}.` : '',
    item.address ? `Address: ${item.address}.` : '',
    item.industry ? `Industry: ${item.industry}.` : '',
    item.products?.length ? `Products: ${item.products.join(', ')}.` : '',
    item.purchaseCategories?.length ? `Likely purchase categories: ${item.purchaseCategories.join(', ')}.` : '',
    documents.length ? `Documents/signals: ${documents.join(', ')}.` : '',
    item.sourceUrl ? `Source: ${item.sourceUrl}.` : '',
  ].filter(Boolean).join(' ')
}

function extractDocumentNumber(documents, label) {
  const regexp = new RegExp(`${label}\\s*(\\d{5,})`, 'i')
  for (const documentTitle of documents ?? []) {
    const match = regexp.exec(String(documentTitle))
    if (match) return match[1]
  }
  return null
}

function stableId(text) {
  let hash = 0
  for (const char of String(text)) {
    hash = (hash << 5) - hash + char.charCodeAt(0)
    hash |= 0
  }
  return String(Math.abs(hash))
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'company'
}

function isMain() {
  return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')
}

if (isMain()) {
  const command = process.argv[2] ?? 'seed'
  const dbPath = process.argv.find((arg) => arg.startsWith('--db='))?.slice(5) ?? DEFAULT_DB_PATH
  const snapshotPath = process.argv.find((arg) => arg.startsWith('--snapshot='))?.slice(11) ?? DEFAULT_SNAPSHOT_PATH
  await mkdir(dirname(resolve(dbPath)), { recursive: true })
  const db = createTenderStartDatabase(dbPath)

  if (command === 'init' || command === 'seed') {
    seedDomBytKhimProfile(db)
    const snapshot = exportPlantDetailsSnapshot(db, snapshotPath)
    console.log(`TenderStart DB ready: ${Object.keys(snapshot).length} detailed plant profiles`)
  } else if (command === 'export') {
    const snapshot = exportPlantDetailsSnapshot(db, snapshotPath)
    console.log(`TenderStart snapshot exported: ${Object.keys(snapshot).length} profiles`)
  } else if (command === 'import-demand') {
    const feedPath = process.argv.find((arg) => arg.startsWith('--feed='))?.slice(7) ?? 'src/data/russianDemandFeed.json'
    const result = importDemandFeedToDb(db, feedPath)
    const snapshot = exportPlantDetailsSnapshot(db, snapshotPath)
    console.log(`TenderStart demand imported: ${result.imported}/${result.total} new events, ${Object.keys(snapshot).length} profiles`)
  } else if (command === 'import-plants') {
    const feedPath = process.argv.find((arg) => arg.startsWith('--feed='))?.slice(7) ?? 'src/data/russiaMassPlantLeads.json'
    const limit = process.argv.find((arg) => arg.startsWith('--limit='))?.slice(8)
    const replaceCountries = process.argv.find((arg) => arg.startsWith('--replace-countries='))?.slice(20)
    const result = importPlantLeadFeedToDb(db, feedPath, {
      limit: limit ? Number(limit) : Infinity,
      replaceCountries: replaceCountries ? replaceCountries.split(',').map((item) => item.trim()).filter(Boolean) : [],
    })
    const snapshot = exportPlantDetailsSnapshot(db, snapshotPath)
    console.log(`TenderStart plant leads imported: ${result.imported}/${result.total} records, ${Object.keys(snapshot).length} frontend profiles`)
  } else if (command === 'import-chemicals') {
    const feedPath = process.argv.find((arg) => arg.startsWith('--feed='))?.slice(7) ?? 'src/data/chemicalCatalog.generated.json'
    const result = importChemicalCatalogToDb(db, feedPath)
    console.log(`TenderStart chemical catalog imported: ${result.imported}/${result.total} records`)
  } else if (command === 'rag') {
    const query = process.argv.slice(3).join(' ')
    console.log(JSON.stringify(searchRagChunks(db, query), null, 2))
  }

  db.close()
}
