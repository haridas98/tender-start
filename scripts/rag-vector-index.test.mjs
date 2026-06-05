import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { createTenderStartDatabase, seedDomBytKhimProfile } from './tenderstart-db.mjs'
import {
  createLocalEmbedding,
  indexSourceChunks,
  searchLocalVectorIndex,
  syncQdrant,
} from './rag-vector-index.mjs'

describe('RAG vector index', () => {
  it('builds deterministic local embeddings and searches source chunks', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-vector-'))
    const db = createTenderStartDatabase(join(dir, 'tenderstart.sqlite'))
    seedDomBytKhimProfile(db)

    const first = createLocalEmbedding('ПАВ для бытовой химии')
    const second = createLocalEmbedding('ПАВ для бытовой химии')
    expect(first).toEqual(second)
    expect(first).toHaveLength(256)

    const result = await indexSourceChunks(db)
    expect(result.indexed).toBeGreaterThan(0)

    const hits = searchLocalVectorIndex(db, 'ПАВ отдушки бытовая химия')
    expect(hits[0].text).toContain('ПАВ')
    expect(hits[0].company).toBe('ДомБытХим')

    db.close()
    await rm(dir, { force: true, recursive: true })
  })

  it('syncs indexed chunks to a Qdrant-compatible API', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-qdrant-'))
    const db = createTenderStartDatabase(join(dir, 'tenderstart.sqlite'))
    const calls = []
    seedDomBytKhimProfile(db)
    await indexSourceChunks(db)

    const result = await syncQdrant(db, {
      fetchImpl: async (url, options) => {
        calls.push({ body: JSON.parse(options.body), method: options.method, url })
        return { json: async () => ({ ok: true }), ok: true }
      },
      qdrantUrl: 'http://qdrant.local',
    })

    expect(result.synced).toBeGreaterThan(0)
    expect(calls[0].url).toBe('http://qdrant.local/collections/tenderstart_chunks')
    expect(calls[1].body.points[0].payload.text).toBeTruthy()

    db.close()
    await rm(dir, { force: true, recursive: true })
  })
})
