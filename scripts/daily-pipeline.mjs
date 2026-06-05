import { dirname, resolve } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { collectRussianDemand, DEFAULT_OUTPUT as DEFAULT_DEMAND_OUTPUT, mergeDemands } from './russia-demand-collector.mjs'
import { collectSiburProcurements } from './sibur-procurement-collector.mjs'
import { enrichSnhzChemicals } from './enrich-snhz-chemicals.mjs'
import { collectChemicalCatalog, DEFAULT_OUTPUT as DEFAULT_CHEMICAL_CATALOG_OUTPUT } from './chemical-catalog-collector.mjs'
import { collectRussiaPlantLeads, DEFAULT_OUTPUT as DEFAULT_PLANT_OUTPUT } from './russia-plant-collector.mjs'
import {
  collectAsiaPlantLeads,
  DEFAULT_COVERAGE_OUTPUT as DEFAULT_ASIA_COVERAGE_OUTPUT,
  DEFAULT_OUTPUT as DEFAULT_ASIA_PLANT_OUTPUT,
} from './india-china-plant-collector.mjs'
import {
  collectAsiaTenderDemand,
  DEFAULT_ASIA_TENDER_DOCUMENT_DIR,
  DEFAULT_ASIA_TENDER_OUTPUT,
} from './asia-tender-enrichment-collector.mjs'
import {
  createTenderStartDatabase,
  DEFAULT_DB_PATH,
  DEFAULT_SNAPSHOT_PATH,
  exportPlantDetailsSnapshot,
  importChemicalCatalogToDb,
  importDemandFeedToDb,
  importPlantLeadFeedToDb,
  seedDomBytKhimProfile,
} from './tenderstart-db.mjs'
import {
  indexSourceChunks,
  loadEnvFile,
  localEmbeddingProvider,
  openAiEmbeddingProvider,
  syncQdrant,
} from './rag-vector-index.mjs'

export async function runDailyPipeline({
  asiaCountries = ['india', 'china'],
  asiaCoverageOutputPath = DEFAULT_ASIA_COVERAGE_OUTPUT,
  asiaPlantOutputPath = DEFAULT_ASIA_PLANT_OUTPUT,
  asiaRegionCodes = null,
  asiaSources = ['mca', 'wikidata', 'osm'],
  asiaTenderDocumentDir = DEFAULT_ASIA_TENDER_DOCUMENT_DIR,
  asiaTenderOutputPath = DEFAULT_ASIA_TENDER_OUTPUT,
  chemicalCatalogOutputPath = DEFAULT_CHEMICAL_CATALOG_OUTPUT,
  dbPath = DEFAULT_DB_PATH,
  demandOutputPath = DEFAULT_DEMAND_OUTPUT,
  downloadProcurementDocuments = false,
  fetchImpl = fetch,
  includeAsiaPlants = false,
  includeAsiaTenders = false,
  includeChemicalCatalog = false,
  includePlants = false,
  includeSiburProcurements = true,
  includeSnhzChemicals = true,
  plantOutputPath = DEFAULT_PLANT_OUTPUT,
  refreshSnhzChemicals = false,
  snapshotPath = DEFAULT_SNAPSHOT_PATH,
  useOpenAi = false,
  useQdrant = true,
} = {}) {
  await mkdir(dirname(resolve(dbPath)), { recursive: true })
  const env = { ...loadEnvFile(), ...process.env }
  const db = createTenderStartDatabase(dbPath)

  try {
    const companyCount = db.prepare('SELECT COUNT(*) AS count FROM companies').get().count
    if (companyCount === 0) seedDomBytKhimProfile(db)

    let demandFeed = await collectRussianDemand({ fetchImpl, outputPath: demandOutputPath })
    const siburFeed = includeSiburProcurements
      ? await collectSiburProcurements({
        downloadDocuments: downloadProcurementDocuments,
        fetchImpl,
        maxPages: 1,
      })
      : { items: [] }
    if (siburFeed.items.length > 0) {
      demandFeed = {
        ...demandFeed,
        items: mergeDemands(demandFeed.items, siburFeed.items),
        source: `${demandFeed.source} + SIBUR procurement parser`,
        updatedAt: new Date().toISOString(),
      }
      await mkdir(dirname(resolve(demandOutputPath)), { recursive: true })
      await writeFile(demandOutputPath, `${JSON.stringify(demandFeed, null, 2)}\n`, 'utf8')
    }
    const snhzChemicalFeed = includeSnhzChemicals
      ? await enrichSnhzChemicals({ fetchImpl, refresh: refreshSnhzChemicals })
      : { records: [] }
    const chemicalCatalogFeed = includeChemicalCatalog
      ? await collectChemicalCatalog({ fetchImpl, outputPath: chemicalCatalogOutputPath })
      : null
    const plantFeed = includePlants
      ? await collectRussiaPlantLeads({
        concurrency: 4,
        fetchImpl,
        maxPages: 6,
        outputPath: plantOutputPath,
        targetPerRegion: 50,
      })
      : null
    const asiaPlantFeed = includeAsiaPlants
      ? await collectAsiaPlantLeads({
        coverageOutputPath: asiaCoverageOutputPath,
        countries: asiaCountries,
        fetchImpl,
        outputPath: asiaPlantOutputPath,
        regionCodes: asiaRegionCodes,
        sources: asiaSources,
      })
      : null
    const asiaTenderFeed = includeAsiaTenders
      ? await collectAsiaTenderDemand({
        documentDir: asiaTenderDocumentDir,
        fetchImpl,
        mirrorDocuments: downloadProcurementDocuments,
        outputPath: asiaTenderOutputPath,
      })
      : null
    const demandImport = importDemandFeedToDb(db, demandOutputPath)
    const asiaTenderImport = asiaTenderFeed ? importDemandFeedToDb(db, asiaTenderOutputPath) : { imported: 0, total: 0 }
    const chemicalImport = chemicalCatalogFeed ? importChemicalCatalogToDb(db, chemicalCatalogOutputPath) : { imported: 0, total: 0 }
    const plantImport = plantFeed ? importPlantLeadFeedToDb(db, plantOutputPath) : { imported: 0, total: 0 }
    const asiaPlantImport = asiaPlantFeed
      ? importPlantLeadFeedToDb(db, asiaPlantOutputPath, {
        replaceCountries: asiaCountries.map((country) => countryNameFromSlug(country)).filter(Boolean),
      })
      : { imported: 0, total: 0 }
    const provider = useOpenAi && env.OPENAI_API_KEY
      ? openAiEmbeddingProvider({
        apiKey: env.OPENAI_API_KEY,
        dimensions: env.OPENAI_EMBEDDING_DIMENSIONS ? Number(env.OPENAI_EMBEDDING_DIMENSIONS) : undefined,
        model: env.OPENAI_EMBEDDING_MODEL,
      })
      : localEmbeddingProvider()
    const vectorIndex = await indexSourceChunks(db, { embeddingProvider: provider, model: provider.model })
    const qdrant = useQdrant
      ? await syncQdrant(db, {
        apiKey: env.QDRANT_API_KEY,
        collection: env.QDRANT_COLLECTION,
        qdrantUrl: env.QDRANT_URL,
      })
      : { skipped: true, reason: 'disabled', synced: 0 }
    const snapshot = exportPlantDetailsSnapshot(db, snapshotPath)

    return {
      demandItems: demandFeed.items.length,
      chemicalCatalogItems: chemicalCatalogFeed?.records.length ?? null,
      siburProcurementItems: siburFeed.items.length,
      snhzChemicalItems: snhzChemicalFeed.records.length,
      snhzPubChemEnriched: snhzChemicalFeed.records.filter((record) => record.pubchem?.cid).length,
      asiaPlantLeads: asiaPlantFeed?.items.length ?? null,
      asiaTenderItems: asiaTenderFeed?.items.length ?? null,
      importedDemandEvents: demandImport.imported,
      importedAsiaTenderEvents: asiaTenderImport.imported,
      importedAsiaPlantLeads: asiaPlantImport.imported,
      importedChemicals: chemicalImport.imported,
      importedPlantLeads: plantImport.imported,
      plantLeads: plantFeed?.items.length ?? null,
      profiles: Object.keys(snapshot).length,
      qdrant,
      vectorIndexed: vectorIndex.indexed,
    }
  } finally {
    db.close()
  }
}

function isMain() {
  return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')
}

function countryNameFromSlug(country) {
  return {
    china: 'China',
    india: 'India',
  }[String(country).toLowerCase()]
}

if (isMain()) {
  const result = await runDailyPipeline({
    includeAsiaPlants: process.argv.includes('--asia-plants'),
    includeAsiaTenders: process.argv.includes('--asia-tenders'),
    includeChemicalCatalog: process.argv.includes('--chemicals'),
    includePlants: process.argv.includes('--plants'),
    includeSiburProcurements: !process.argv.includes('--no-sibur'),
    includeSnhzChemicals: !process.argv.includes('--no-snhz-chemicals'),
    refreshSnhzChemicals: process.argv.includes('--refresh-snhz-chemicals'),
    downloadProcurementDocuments: process.argv.includes('--download-docs'),
    useOpenAi: process.argv.includes('--openai'),
    useQdrant: !process.argv.includes('--no-qdrant'),
  })
  console.log(JSON.stringify(result, null, 2))
}
