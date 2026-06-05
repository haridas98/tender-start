import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  ensureEcosysStructure,
  harvestPubChemCidRange,
  mirrorLocalTenderDocuments,
  saveBlob,
} from './ecosys-datalake-harvester.mjs'

describe('ECOSYS data lake harvester', () => {
  it('creates the expected data lake folders', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ecosys-'))
    await ensureEcosysStructure(root)

    expect(await readFile(join(root, 'README.ecosys.json'), 'utf8')).toContain('TenderStart')
    await rm(root, { force: true, recursive: true })
  })

  it('harvests PubChem CID batches with CAS index and image', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ecosys-pubchem-'))
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Array.from({ length: 120 }, () => 1)])

    const result = await harvestPubChemCidRange({
      count: 1,
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
            json: async () => ({ InformationList: { Information: [{ CID: 5362487, Synonym: ['Sulfur', '7704-34-9'] }] } }),
            ok: true,
          }
        }
        return { arrayBuffer: async () => png, ok: true }
      },
      root,
      startCid: 5362487,
    })

    expect(result).toMatchObject({ casRecords: 1, records: 1 })
    expect(await readFile(join(root, 'chemicals/by-cas/77/7704-34-9.json'), 'utf8')).toContain('7704-34-9')
    expect(await readFile(join(root, 'manifests/cas-index.jsonl'), 'utf8')).toContain('7704-34-9')
    expect(await readFile(join(root, 'images/pubchem-2d/005/5362487.png'))).toHaveLength(png.length)
    await rm(root, { force: true, recursive: true })
  })

  it('deduplicates tender documents by sha256', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ecosys-docs-'))
    const docs = await mkdtemp(join(tmpdir(), 'ecosys-source-docs-'))
    await writeFile(join(docs, 'tz.pdf'), 'same file')
    await writeFile(join(docs, 'copy.pdf'), 'same file')

    const first = await saveBlob({ buffer: Buffer.from('same file'), originalName: 'tz.pdf', root, type: 'technical_specification' })
    const second = await saveBlob({ buffer: Buffer.from('same file'), originalName: 'copy.pdf', root, type: 'technical_specification' })
    const mirrored = await mirrorLocalTenderDocuments({ inputDir: docs, root })

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(mirrored.files).toBe(2)
    expect(mirrored.copied).toBe(0)
    expect(mirrored.duplicates).toBe(2)

    await rm(root, { force: true, recursive: true })
    await rm(docs, { force: true, recursive: true })
  })
})
