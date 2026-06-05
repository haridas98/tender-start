import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTenderStartDatabase, DEFAULT_DB_PATH } from './tenderstart-db.mjs'

export const DEFAULT_VECTOR_MODEL = 'local-hash-v1'
export const DEFAULT_VECTOR_DIMENSIONS = 256
export const DEFAULT_QDRANT_COLLECTION = 'tenderstart_chunks'

export function ensureVectorSchema(db) {
  db.exec(`
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
  `)
}

export function createLocalEmbedding(text, dimensions = DEFAULT_VECTOR_DIMENSIONS) {
  const vector = Array.from({ length: dimensions }, () => 0)
  const features = tokenizeForEmbedding(text)

  for (const feature of features) {
    const index = stableHash(feature) % dimensions
    const sign = stableHash(`sign:${feature}`) % 2 === 0 ? 1 : -1
    vector[index] += sign
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map((value) => Number((value / norm).toFixed(8)))
}

export function searchLocalVectorIndex(db, query, { limit = 5, dimensions = DEFAULT_VECTOR_DIMENSIONS } = {}) {
  ensureVectorSchema(db)
  const queryVector = createLocalEmbedding(query, dimensions)
  const rows = db.prepare(`
    SELECT rag_embeddings.*, companies.display_name, companies.slug
    FROM rag_embeddings
    JOIN companies ON companies.id = rag_embeddings.company_id
    WHERE rag_embeddings.model = ?
  `).all(DEFAULT_VECTOR_MODEL)

  return rows
    .map((row) => ({
      chunk_id: row.chunk_id,
      company: row.display_name,
      score: cosineSimilarity(queryVector, JSON.parse(row.vector_json)),
      slug: row.slug,
      source_url: row.source_url,
      text: row.text,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export async function indexSourceChunks(db, {
  batchSize = 64,
  dimensions = DEFAULT_VECTOR_DIMENSIONS,
  embeddingProvider = localEmbeddingProvider(dimensions),
  model = DEFAULT_VECTOR_MODEL,
} = {}) {
  ensureVectorSchema(db)
  const chunks = db.prepare(`
    SELECT source_chunks.id, source_chunks.company_id, source_chunks.text, source_chunks.source_url
    FROM source_chunks
    LEFT JOIN rag_embeddings ON rag_embeddings.chunk_id = source_chunks.id AND rag_embeddings.model = ?
    WHERE rag_embeddings.chunk_id IS NULL
    ORDER BY source_chunks.id
  `).all(model)
  let indexed = 0

  for (let index = 0; index < chunks.length; index += batchSize) {
    const batch = chunks.slice(index, index + batchSize)
    const vectors = await embeddingProvider.embed(batch.map((chunk) => chunk.text))
    const indexedAt = new Date().toISOString()

    db.exec('BEGIN')
    try {
      batch.forEach((chunk, batchIndex) => {
        const vector = vectors[batchIndex]
        db.prepare(`
          INSERT OR REPLACE INTO rag_embeddings
          (chunk_id, company_id, model, dimensions, vector_json, text, source_url, indexed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          chunk.id,
          chunk.company_id,
          model,
          vector.length,
          JSON.stringify(vector),
          chunk.text,
          chunk.source_url,
          indexedAt,
        )
        db.prepare('UPDATE source_chunks SET embedding_json = ? WHERE id = ?').run(JSON.stringify(vector), chunk.id)
        indexed += 1
      })
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  return { indexed, totalPending: chunks.length }
}

export function localEmbeddingProvider(dimensions = DEFAULT_VECTOR_DIMENSIONS) {
  return {
    dimensions,
    model: DEFAULT_VECTOR_MODEL,
    embed: async (texts) => texts.map((text) => createLocalEmbedding(text, dimensions)),
  }
}

export function openAiEmbeddingProvider({
  apiKey,
  dimensions,
  fetchImpl = fetch,
  model = 'text-embedding-3-small',
} = {}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for OpenAI embeddings')

  return {
    dimensions,
    model,
    embed: async (texts) => {
      const body = { input: texts, model }
      if (dimensions) body.dimensions = dimensions
      const response = await fetchImpl('https://api.openai.com/v1/embeddings', {
        body: JSON.stringify(body),
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error(`OpenAI embeddings failed: ${response.status} ${await response.text()}`)
      }
      const payload = await response.json()
      return payload.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding)
    },
  }
}

export async function syncQdrant(db, {
  apiKey,
  collection = DEFAULT_QDRANT_COLLECTION,
  fetchImpl = fetch,
  qdrantUrl,
} = {}) {
  ensureVectorSchema(db)
  if (!qdrantUrl) return { skipped: true, reason: 'QDRANT_URL is not set', synced: 0 }

  const rows = db.prepare('SELECT * FROM rag_embeddings ORDER BY chunk_id').all()
  if (rows.length === 0) return { skipped: false, synced: 0 }

  const headers = { 'content-type': 'application/json' }
  if (apiKey) headers['api-key'] = apiKey

  const dimensions = rows[0].dimensions
  await fetchJson(fetchImpl, `${trimSlash(qdrantUrl)}/collections/${collection}`, {
    body: JSON.stringify({ vectors: { distance: 'Cosine', size: dimensions } }),
    headers,
    method: 'PUT',
  })

  let synced = 0
  for (let index = 0; index < rows.length; index += 64) {
    const batch = rows.slice(index, index + 64)
    await fetchJson(fetchImpl, `${trimSlash(qdrantUrl)}/collections/${collection}/points?wait=true`, {
      body: JSON.stringify({
        points: batch.map((row) => ({
          id: row.chunk_id,
          payload: {
            company_id: row.company_id,
            source_url: row.source_url,
            text: row.text,
          },
          vector: JSON.parse(row.vector_json),
        })),
      }),
      headers,
      method: 'PUT',
    })
    synced += batch.length
  }

  return { collection, skipped: false, synced }
}

export function loadEnvFile(path = '.env') {
  const fullPath = resolve(path)
  if (!existsSync(fullPath)) return {}
  return Object.fromEntries(
    readFileSync(fullPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, '')]
      }),
  )
}

function tokenizeForEmbedding(text) {
  const tokens = String(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1)
  const features = [...tokens]
  for (const token of tokens) {
    for (let index = 0; index < token.length - 2; index += 1) {
      features.push(token.slice(index, index + 3))
    }
  }
  return features.length > 0 ? features : ['empty']
}

function stableHash(text) {
  let hash = 2166136261
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function cosineSimilarity(a, b) {
  let dot = 0
  let left = 0
  let right = 0
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    dot += a[index] * b[index]
    left += a[index] * a[index]
    right += b[index] * b[index]
  }
  return Number((dot / ((Math.sqrt(left) || 1) * (Math.sqrt(right) || 1))).toFixed(6))
}

async function fetchJson(fetchImpl, url, options) {
  const response = await fetchImpl(url, options)
  if (!response.ok) throw new Error(`Qdrant request failed: ${response.status} ${await response.text()}`)
  return response.json()
}

function trimSlash(value) {
  return String(value).replace(/\/+$/, '')
}

function isMain() {
  return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')
}

if (isMain()) {
  const command = process.argv[2] ?? 'index'
  const dbPath = process.argv.find((arg) => arg.startsWith('--db='))?.slice(5) ?? DEFAULT_DB_PATH
  const env = { ...loadEnvFile(), ...process.env }
  const db = createTenderStartDatabase(dbPath)

  if (command === 'index') {
    const provider = env.OPENAI_API_KEY && process.argv.includes('--openai')
      ? openAiEmbeddingProvider({ apiKey: env.OPENAI_API_KEY, dimensions: env.OPENAI_EMBEDDING_DIMENSIONS ? Number(env.OPENAI_EMBEDDING_DIMENSIONS) : undefined, model: env.OPENAI_EMBEDDING_MODEL })
      : localEmbeddingProvider()
    const result = await indexSourceChunks(db, { embeddingProvider: provider, model: provider.model })
    console.log(`RAG vectors indexed: ${result.indexed}/${result.totalPending}`)
  } else if (command === 'search') {
    const query = process.argv.slice(3).join(' ')
    console.log(JSON.stringify(searchLocalVectorIndex(db, query), null, 2))
  } else if (command === 'sync-qdrant') {
    const result = await syncQdrant(db, {
      apiKey: env.QDRANT_API_KEY,
      collection: env.QDRANT_COLLECTION ?? DEFAULT_QDRANT_COLLECTION,
      qdrantUrl: env.QDRANT_URL,
    })
    console.log(JSON.stringify(result, null, 2))
  }

  db.close()
}
