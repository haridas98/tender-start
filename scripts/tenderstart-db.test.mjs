import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  createTenderStartDatabase,
  exportPlantDetailsSnapshot,
  importChemicalCatalogToDb,
  importDemandFeedToDb,
  importPlantLeadFeedToDb,
  searchRagChunks,
  seedDomBytKhimProfile,
} from './tenderstart-db.mjs'

describe('TenderStart database layer', () => {
  it('stores a detailed plant profile with procurement and RAG evidence', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-db-'))
    const dbPath = join(dir, 'tenderstart.sqlite')
    const snapshotPath = join(dir, 'plantDetails.json')

    const db = createTenderStartDatabase(dbPath)
    seedDomBytKhimProfile(db)
    const snapshot = exportPlantDetailsSnapshot(db, snapshotPath)

    expect(snapshot['adygea-dombytkhim'].company.inn).toBe('0107017663')
    expect(snapshot['adygea-dombytkhim'].facts.some((fact) => fact.label === 'Количество сотрудников' && fact.value === '180')).toBe(true)
    expect(snapshot['adygea-dombytkhim'].products.map((product) => product.name)).toContain('Средства бытовой химии под СТМ')
    expect(snapshot['adygea-dombytkhim'].needs.map((need) => need.name)).toContain('Анионные/неионогенные ПАВ')
    expect(snapshot['adygea-dombytkhim'].procurementEvents[0].status).toBe('no_exact_notice_found_yet')
    expect(snapshot['adygea-dombytkhim'].sanctionsChecks.map((check) => check.status)).toContain('requires_screening')

    const hits = searchRagChunks(db, 'Крот Blitz рецептуры лаборатория')
    expect(hits[0].text).toContain('Крот')
    expect(JSON.parse(await readFile(snapshotPath, 'utf8'))['adygea-dombytkhim'].ownership.length).toBeGreaterThan(0)

    db.close()
    await rm(dir, { force: true, recursive: true })
  })

  it('imports parsed procurement demand into company and event tables', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-demand-'))
    const dbPath = join(dir, 'tenderstart.sqlite')
    const feedPath = join(dir, 'demand.json')

    await writeFile(
      feedPath,
      JSON.stringify({
        updatedAt: '2026-06-01T00:00:00.000Z',
        items: [
          {
            confidence: 'medium',
            id: 'eis-caustic-soda-123',
            monthlyVolumeTons: 80,
            organization: 'Казанский целлюлозный комбинат',
            procurementUrl: 'https://zakupki.gov.ru/epz/order/notice/ea44/view/common-info.html?regNumber=123',
            productId: 'caustic-soda',
            publishedAt: '2026-06-01',
            region: 'Татарстан',
            source: 'ЕИС daily parser',
            targetPriceRubPerTon: 62000,
          },
        ],
      }),
      'utf8',
    )

    const db = createTenderStartDatabase(dbPath)
    const result = importDemandFeedToDb(db, feedPath)
    const snapshot = exportPlantDetailsSnapshot(db, null)

    expect(result).toEqual({ imported: 1, total: 1 })
    const buyer = Object.values(snapshot).find((profile) => profile.company.display_name === 'Казанский целлюлозный комбинат')
    expect(buyer.procurementEvents[0]).toMatchObject({
      notice_number: 'eis-caustic-soda-123',
      price: '62000 руб/т',
      status: 'parsed_daily_signal',
    })
    expect(buyer.procurementEvents[0].items[0]).toMatchObject({
      name: 'caustic-soda',
      quantity: '80',
      unit: 'т',
    })

    db.close()
    await rm(dir, { force: true, recursive: true })
  })

  it('imports chemical catalog records into SQLite', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-chemicals-'))
    const dbPath = join(dir, 'tenderstart.sqlite')
    const feedPath = join(dir, 'chemicalCatalog.json')

    await writeFile(
      feedPath,
      JSON.stringify({
        generatedAt: '2026-06-03T00:00:00.000Z',
        records: [
          {
            cas: '7704-34-9',
            documents: ['SDS/MSDS', 'COA/passport per batch'],
            name: 'Сера',
            pubchem: {
              canonicalSmiles: 'S',
              cid: 5362487,
              inchiKey: 'NINIDFKCEFEMDL-UHFFFAOYSA-N',
              iupacName: 'sulfur',
              molecularFormula: 'S',
              molecularWeight: '32.06',
              pubchemUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/5362487',
            },
            safety: {
              sourceUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/5362487#section=GHS-Classification',
            },
            slug: 'sulfur',
            sourceLevel: 'pubchem_enriched',
            sourceRefs: [{ sourceName: 'TenderStart material card', sourceType: 'internal_material', sourceUrl: '/materials/sulfur' }],
          },
        ],
      }),
      'utf8',
    )

    const db = createTenderStartDatabase(dbPath)
    const result = importChemicalCatalogToDb(db, feedPath)
    const chemical = db.prepare('SELECT * FROM chemicals WHERE slug = ?').get('sulfur')
    const documents = db.prepare('SELECT document_type, title FROM chemical_documents WHERE chemical_id = ? ORDER BY title').all(chemical.id)
    const sources = db.prepare('SELECT source_name, source_type FROM chemical_sources WHERE chemical_id = ? ORDER BY source_name').all(chemical.id)

    expect(result).toEqual({ imported: 1, total: 1 })
    expect(chemical.cas).toBe('7704-34-9')
    expect(chemical.pubchem_cid).toBe(5362487)
    expect(documents.map((document) => document.document_type)).toContain('safety_data_sheet')
    expect(documents.map((document) => document.document_type)).toContain('certificate_of_analysis')
    expect(sources.map((source) => source.source_name)).toContain('PubChem PUG REST')

    db.close()
    await rm(dir, { force: true, recursive: true })
  })

  it('imports rich SIBUR procurement rows with documents, needs and RAG text', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-sibur-demand-'))
    const dbPath = join(dir, 'tenderstart.sqlite')
    const feedPath = join(dir, 'demand.json')

    await writeFile(
      feedPath,
      JSON.stringify({
        updatedAt: '2026-06-02T00:00:00.000Z',
        items: [
          {
            buyerContact: 'Фаттахова Расиля Ринатовна, +7 (843) 533-90-90 доб. 622404, fattakhovarr@rt.sibur.ru',
            buyerEmail: 'fattakhovarr@rt.sibur.ru',
            buyerName: 'Фаттахова Расиля Ринатовна',
            buyerPhone: '+7 (843) 533-90-90 доб. 622404',
            confidence: 'high',
            documents: [
              {
                status: 'available_for_download',
                title: 'tt_trietanolamin_rus_pdf.pdf',
                type: 'technical_specification',
                url: 'https://www.sibur.ru/upload/docs/tt_trietanolamin_rus_pdf.pdf',
              },
            ],
            id: 'sibur-2133637-2',
            items: [
              {
                documents: ['tt_trietanolamin_rus_pdf.pdf'],
                name: 'Триэтаноламин',
                quantity: null,
                spec: '99,5% чистоты; бочки 200 кг; нужны COA, TDS, MSDS',
                unit: null,
              },
            ],
            law: 'SIBUR SRM / commercial procurement',
            noticeNumber: '2133637/2',
            organization: 'ПАО "СИБУР Холдинг"',
            procurementUrl: 'https://srm.sibur.ru/procedure/2133637',
            publishedAt: '2026-06-02',
            region: 'Республика Татарстан',
            source: 'SIBUR procurement parser',
            sourceDocumentText: 'СИБУР закупка 2133637/2: Триэтаноламин. Требования: 99,5% чистоты, COA, TDS, MSDS.',
            status: 'Прием предложений',
            targetPriceRubPerTon: 0,
            title: 'Триэтаноламин',
          },
        ],
      }),
      'utf8',
    )

    const db = createTenderStartDatabase(dbPath)
    const result = importDemandFeedToDb(db, feedPath)
    const snapshot = exportPlantDetailsSnapshot(db, null)
    const buyer = Object.values(snapshot).find((profile) => profile.company.display_name === 'ПАО "СИБУР Холдинг"')

    expect(result).toEqual({ imported: 1, total: 1 })
    expect(buyer.company.emails).toContain('fattakhovarr@rt.sibur.ru')
    expect(buyer.procurementEvents[0].items[0]).toMatchObject({
      name: 'Триэтаноламин',
      spec: '99,5% чистоты; бочки 200 кг; нужны COA, TDS, MSDS',
    })
    expect(buyer.needs[0]).toMatchObject({
      name: 'Триэтаноламин',
      status: 'parsed_tender',
    })
    expect(buyer.documents.map((document) => document.title)).toContain('tt_trietanolamin_rus_pdf.pdf')
    expect(buyer.ragChunks[0].text).toContain('COA, TDS, MSDS')

    db.close()
    await rm(dir, { force: true, recursive: true })
  })

  it('imports Asia tender demand with country, documents and RAG text', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-asia-demand-'))
    const dbPath = join(dir, 'tenderstart.sqlite')
    const feedPath = join(dir, 'asia-demand.json')

    await writeFile(
      feedPath,
      JSON.stringify({
        updatedAt: '2026-06-04T00:00:00.000Z',
        items: [
          {
            confidence: 'medium',
            country: 'India',
            documents: [
              {
                status: 'parsed_notice',
                title: 'Tender notice page',
                type: 'procurement_notice',
                url: 'https://eprocure.gov.in/cppp/tendersfullview/demo',
              },
              {
                status: 'required_for_full_spec',
                title: 'Technical specification / buyer document',
                type: 'technical_specification',
                url: 'https://eprocure.gov.in/cppp/tendersfullview/demo',
              },
            ],
            id: 'cppp-2026-dodp-840189-3',
            items: [
              {
                documents: ['Tender notice page', 'Technical specification / buyer document'],
                name: 'rubber sheet',
                quantity: '1',
                spec: 'Conductive rubber sheet size 2MM thick, width 1 mtr and length 10 mtr',
                unit: 'm',
              },
            ],
            law: 'GeM bid / CPPP mirror',
            noticeNumber: '2026_DoDP_840189_3',
            organization: 'Department of Defence Production',
            procurementUrl: 'https://eprocure.gov.in/cppp/tendersfullview/demo',
            publishedAt: '2026-06-04T10:00:00+05:30',
            region: 'India',
            source: 'GeM-CPPP latest active tenders parser',
            sourceDocumentText: 'India procurement notice 2026_DoDP_840189_3: Conductive rubber sheet. Documents inside TenderStart: technical specification required.',
            status: 'parsed_public_tender_notice',
            title: 'Conductive rubber sheet size 2MM thick, width 1 mtr and length 10 mtr',
          },
        ],
      }),
      'utf8',
    )

    const db = createTenderStartDatabase(dbPath)
    const result = importDemandFeedToDb(db, feedPath)
    const company = db.prepare('SELECT id, country FROM companies WHERE display_name = ?').get('Department of Defence Production')
    const documents = db.prepare('SELECT title, document_type FROM documents WHERE company_id = ? ORDER BY title').all(company.id)
    const chunks = db.prepare('SELECT text FROM source_chunks WHERE company_id = ?').all(company.id)

    expect(result).toEqual({ imported: 1, total: 1 })
    expect(company.country).toBe('India')
    expect(documents.map((document) => document.document_type)).toContain('technical_specification')
    expect(chunks[0].text).toContain('Documents inside TenderStart')

    db.close()
    await rm(dir, { force: true, recursive: true })
  })

  it('imports plant leads into SQLite without forcing them into the frontend cache', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-plant-leads-'))
    const dbPath = join(dir, 'tenderstart.sqlite')
    const feedPath = join(dir, 'plants.json')

    await writeFile(
      feedPath,
      JSON.stringify({
        items: [
          {
            address: 'Industrial street 1',
            city: 'Ufa',
            demandItems: [
              {
                documents: ['SDS', 'COA', 'contract'],
                name: 'Surfactants',
                source: 'GISP + EIS search',
                sourceUrl: 'https://zakupki.gov.ru/',
                spec: 'active matter, pH, color',
                status: 'lead',
                volume: 'monthly',
              },
            ],
            documents: ['ИНН 1234567890', 'ОГРН 1234567890123', 'запись ГИСП'],
            equipment: ['mixing', 'filling'],
            industry: 'household chemicals',
            legalName: 'Test Chemical Plant LLC',
            name: 'Test Chemical Plant',
            productionItems: [
              {
                name: 'Household cleaner',
                source: 'GISP',
                sourceUrl: 'https://gisp.gov.ru/service-market/org/1/',
                spec: 'liquid cleaner',
                status: 'lead',
                volume: 'needs confirmation',
              },
            ],
            products: ['Household chemicals'],
            region: 'Bashkortostan',
            slug: 'mass-bashkortostan-test-chemical-plant',
            sourceName: 'ГИСП/Apicrafter 2021',
            sourceUrl: 'https://gisp.gov.ru/service-market/org/1/',
          },
        ],
      }),
      'utf8',
    )

    const db = createTenderStartDatabase(dbPath)
    const result = importPlantLeadFeedToDb(db, feedPath)
    const fullSnapshot = exportPlantDetailsSnapshot(db, null, { includeLeadProfiles: true })
    const frontendSnapshot = exportPlantDetailsSnapshot(db, null)

    expect(result).toEqual({ imported: 1, total: 1 })
    const profile = fullSnapshot['mass-bashkortostan-test-chemical-plant']
    expect(profile.company.inn).toBe('1234567890')
    expect(profile.company.data_level).toBe('source_registry_lead')
    expect(profile.products[0].name).toBe('Household cleaner')
    expect(profile.needs[0].name).toBe('Surfactants')
    expect(profile.ragChunks[0].text).toContain('Test Chemical Plant')
    expect(frontendSnapshot['mass-bashkortostan-test-chemical-plant']).toBeUndefined()

    db.close()
    await rm(dir, { force: true, recursive: true })
  })

  it('can replace stale plant leads for selected countries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-plant-replace-'))
    const dbPath = join(dir, 'tenderstart.sqlite')
    const firstFeedPath = join(dir, 'plants-first.json')
    const secondFeedPath = join(dir, 'plants-second.json')

    const plant = (name, slug) => ({
      country: 'India',
      demandItems: [{ name: 'raw materials', spec: 'spec', volume: 'monthly' }],
      documents: ['India MCA Company Master Data row'],
      equipment: ['line'],
      industry: 'manufacturing lead',
      name,
      productionItems: [{ name: 'product', spec: 'spec', volume: 'monthly' }],
      products: ['product'],
      region: 'Gujarat',
      slug,
      sourceName: 'India MCA Company Master Data',
      sourceUrl: 'https://data.gov.in/catalog/company-master-data',
    })

    await writeFile(firstFeedPath, JSON.stringify({ items: [plant('Alpha Plant', 'alpha'), plant('Beta Plant', 'beta')] }), 'utf8')
    await writeFile(secondFeedPath, JSON.stringify({ items: [plant('Alpha Plant', 'alpha')] }), 'utf8')

    const db = createTenderStartDatabase(dbPath)
    importPlantLeadFeedToDb(db, firstFeedPath)
    const result = importPlantLeadFeedToDb(db, secondFeedPath, { replaceCountries: ['India'] })
    const rows = db.prepare('SELECT display_name FROM companies WHERE country = ? ORDER BY display_name').all('India')

    expect(result).toEqual({ imported: 1, total: 1 })
    expect(rows.map((row) => row.display_name)).toEqual(['Alpha Plant'])

    db.close()
    await rm(dir, { force: true, recursive: true })
  })
})
