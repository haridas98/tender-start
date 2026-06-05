import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { runDailyPipeline } from './daily-pipeline.mjs'
import { createTenderStartDatabase } from './tenderstart-db.mjs'

describe('daily pipeline', () => {
  it('collects demand, imports it into SQLite and builds RAG vectors', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-pipeline-'))
    const dbPath = join(dir, 'tenderstart.sqlite')
    const demandOutputPath = join(dir, 'demand.json')
    const snapshotPath = join(dir, 'snapshot.json')

    const result = await runDailyPipeline({
      dbPath,
      demandOutputPath,
      fetchImpl: async () => ({
        ok: true,
        text: async () => `
          <div class="search-registry-entry-block">
            <a href="/epz/order/notice/ea44/view/common-info.html?regNumber=777">№ 777</a>
            Регион Татарстан
            Заказчик Казанский завод химии
            Объект закупки Поставка каустической соды NaOH, 50 т
            Начальная цена 3100000
          </div>
        `,
      }),
      includeSnhzChemicals: false,
      snapshotPath,
      useQdrant: false,
    })

    expect(result.importedDemandEvents).toBe(1)
    expect(result.vectorIndexed).toBeGreaterThan(0)

    const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'))
    const buyer = Object.values(snapshot).find((profile) => profile.company.display_name === 'Казанский завод химии')
    expect(buyer.procurementEvents[0].items[0]).toMatchObject({
      name: 'caustic-soda',
      quantity: '50',
      unit: 'т',
    })

    await rm(dir, { force: true, recursive: true })
  })

  it('imports Asia plant leads into SQLite when enabled', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-pipeline-asia-'))
    const dbPath = join(dir, 'tenderstart.sqlite')
    const asiaCoverageOutputPath = join(dir, 'asia-coverage.json')
    const demandOutputPath = join(dir, 'demand.json')
    const asiaPlantOutputPath = join(dir, 'asia.json')
    const snapshotPath = join(dir, 'snapshot.json')

    const previousApiKey = process.env.DATA_GOV_IN_API_KEY
    process.env.DATA_GOV_IN_API_KEY = 'test-key'

    let result
    try {
      result = await runDailyPipeline({
        asiaCountries: ['india'],
        asiaCoverageOutputPath,
        asiaPlantOutputPath,
        asiaRegionCodes: ['IN-GJ'],
        asiaSources: ['mca'],
        dbPath,
        demandOutputPath,
        fetchImpl: async (url) => {
          if (String(url).includes('api.data.gov.in')) {
            return {
              json: async () => ({
                records: [{
                  company_name: 'Gujarat Fluorochemicals Limited',
                  company_status: 'Active',
                  corporate_identity_number: 'L24110GJ1987PLC009362',
                  principal_business_activity: 'Manufacturing',
                  registered_state: 'Gujarat',
                }],
              }),
              ok: true,
            }
          }
          return { ok: true, text: async () => '' }
        },
        includeAsiaPlants: true,
        includeSnhzChemicals: false,
        snapshotPath,
        useQdrant: false,
      })
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.DATA_GOV_IN_API_KEY
      } else {
        process.env.DATA_GOV_IN_API_KEY = previousApiKey
      }
    }

    expect(result.importedAsiaPlantLeads).toBe(1)
    expect(result.asiaPlantLeads).toBe(1)

    const db = createTenderStartDatabase(dbPath)
    const plant = db.prepare('SELECT id, country FROM companies WHERE display_name = ?').get('Gujarat Fluorochemicals Limited')
    const sourceChunk = db.prepare('SELECT source_url FROM source_chunks WHERE company_id = ?').get(plant.id)
    db.close()

    expect(plant.country).toBe('India')
    expect(sourceChunk.source_url).toContain('data.gov.in')

    await rm(dir, { force: true, recursive: true })
  })

  it('imports Asia tender enrichment into SQLite when enabled', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-pipeline-asia-tenders-'))
    const dbPath = join(dir, 'tenderstart.sqlite')
    const demandOutputPath = join(dir, 'demand.json')
    const asiaTenderDocumentDir = join(dir, 'asia-documents')
    const asiaTenderOutputPath = join(dir, 'asia-tenders.json')
    const snapshotPath = join(dir, 'snapshot.json')

    const result = await runDailyPipeline({
      asiaTenderOutputPath,
      asiaTenderDocumentDir,
      dbPath,
      demandOutputPath,
      downloadProcurementDocuments: true,
      fetchImpl: async (url) => ({
        ok: true,
        text: async () => String(url).includes('ccgp')
          ? '<title>频繁访问!中国政府采购网</title>'
          : `
            <table><tbody><tr>
              <td>1.</td>
              <td>04-Jun-2026 10:00 AM</td>
              <td>15-Jun-2026 10:15 AM</td>
              <td>15-Jun-2026 10:20 AM</td>
              <td><a href="https://eprocure.gov.in/cppp/tendersfullview/demo">Conductive rubber sheet size 2MM thick, width 1 mtr and length 10 mtr</a>/GEM/2026/B/7608048/2026_DoDP_840189_3</td>
              <td>Department of Defence Production</td>
              <td>--</td>
            </tr></tbody></table>
          `,
      }),
      includeAsiaTenders: true,
      includeSiburProcurements: false,
      includeSnhzChemicals: false,
      snapshotPath,
      useQdrant: false,
    })

    expect(result.asiaTenderItems).toBe(1)
    expect(result.importedAsiaTenderEvents).toBe(1)

    const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'))
    const buyer = Object.values(snapshot).find((profile) => profile.company.display_name === 'Department of Defence Production')
    expect(buyer.company.country).toBe('India')
    expect(buyer.procurementEvents[0].items[0].name).toBe('rubber sheet')
    const asiaTenderFeed = JSON.parse(await readFile(asiaTenderOutputPath, 'utf8'))
    const noticeDocument = asiaTenderFeed.items[0].documents.find((document) => document.type === 'procurement_notice')
    expect(noticeDocument.status).toBe('mirrored_text_snapshot')
    expect(await readFile(noticeDocument.localPath, 'utf8')).toContain('Department of Defence Production')

    await rm(dir, { force: true, recursive: true })
  })
})
