import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  collectChemicalCatalog,
  extractMarketMaterials,
  extractSiburChemicals,
  extractSnhzChemicals,
} from './chemical-catalog-collector.mjs'

describe('chemical catalog collector', () => {
  it('extracts internal material cards with CAS and documents', () => {
    const candidates = extractMarketMaterials(`
      export const materials = {
        sulfur: {
          cas: '7704-34-9',
          documents: ['SDS/MSDS', 'COA'],
          hs: '2503',
          name: 'Сера',
          requirement: { purity: 'S >= 99.9%' },
        },
      }
      const plantRecords = {}
    `)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      cas: '7704-34-9',
      hs: '2503',
      name: 'Сера',
      query: 'sulfur',
      slug: 'sulfur',
    })
    expect(candidates[0].documents).toContain('COA')
  })

  it('extracts SNHZ and SIBUR chemical candidates', () => {
    const snhz = extractSnhzChemicals({
      records: [{
        cas: '102-71-6',
        documents: ['COA', 'MSDS'],
        name: 'Триэтаноламин',
        pubchemQuery: 'triethanolamine',
        slug: 'snhz-triethanolamine',
        source: 'SNHZ',
        sourceUrl: 'https://snhz.ru/',
        standards: ['ТУ 2423'],
        tenderSpec: '99.5%',
        volume: 'RFQ',
      }],
    })
    const sibur = extractSiburChemicals({
      items: [{
        documents: [{ title: 'tt_trietanolamin_rus_pdf.pdf' }],
        noticeNumber: '2133637/2',
        procurementUrl: 'https://srm.sibur.ru/procedure/2133637',
        source: 'SIBUR procurement parser',
        title: 'Триэтаноламин',
      }],
    })

    expect(snhz[0].query).toBe('triethanolamine')
    expect(snhz[0].standards).toContain('ТУ 2423')
    expect(sibur[0].query).toBe('triethanolamine')
    expect(sibur[0].procurementRefs[0].noticeNumber).toBe('2133637/2')
  })

  it('collects a local dossier and enriches it through PubChem API shape', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'chemical-catalog-'))
    const marketPath = join(dir, 'market.ts')
    const snhzPath = join(dir, 'snhz.json')
    const siburPath = join(dir, 'sibur.json')
    const outputPath = join(dir, 'chemicalCatalog.json')

    await writeFile(marketPath, `
      export const materials = {
        sulfur: {
          cas: '7704-34-9',
          documents: ['SDS/MSDS', 'COA'],
          hs: '2503',
          name: 'Сера',
        },
      }
      const plantRecords = {}
    `)
    await writeFile(snhzPath, JSON.stringify({ records: [] }), 'utf8')
    await writeFile(siburPath, JSON.stringify({ items: [] }), 'utf8')

    const feed = await collectChemicalCatalog({
      fetchImpl: async (url) => {
        if (String(url).includes('/property/')) {
          return {
            json: async () => ({
              PropertyTable: {
                Properties: [{
                  CID: 5362487,
                  CanonicalSMILES: 'S',
                  IUPACName: 'sulfur',
                  InChIKey: 'NINIDFKCEFEMDL-UHFFFAOYSA-N',
                  MolecularFormula: 'S',
                  MolecularWeight: '32.06',
                }],
              },
            }),
            ok: true,
          }
        }
        if (String(url).includes('/synonyms/')) {
          return {
            json: async () => ({ InformationList: { Information: [{ Synonym: ['Sulfur', '7704-34-9'] }] } }),
            ok: true,
          }
        }
        return {
          json: async () => ({
            Record: {
              Section: [{
                TOCHeading: 'GHS Classification',
                Information: [{ Value: { StringWithMarkup: [{ String: 'Warning H315' }] } }],
              }],
            },
          }),
          ok: true,
        }
      },
      marketPath,
      outputPath,
      siburPath,
      snhzPath,
    })

    expect(feed.records).toHaveLength(1)
    expect(feed.records[0].cas).toBe('7704-34-9')
    expect(feed.records[0].documents).toContain('COA/passport per batch')
    expect(feed.records[0].safety.ghs).toContain('Warning H315')
    expect(JSON.parse(await readFile(outputPath, 'utf8')).records[0].pubchem.cid).toBe(5362487)

    await rm(dir, { force: true, recursive: true })
  })
})
