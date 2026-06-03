/**
 * embed.ts — Embeddings via Ollama nomic-embed-text (768 dims)
 *
 * Provider único: Ollama local.
 * Voyage AI foi removido — não há roteamento condicional.
 *
 * Dimensão fixa: 768 (nomic-embed-text padrão).
 */

export const EMBEDDING_DIMS = 768;

/** Ollama — nomic-embed-text (768 dims, local) */
async function generateEmbeddingOllama(text: string): Promise<number[]> {
  const base = (process.env.OLLAMA_BASE_URL ?? 'http://ollama:11434/v1').replace('/v1', '');
  const res = await fetch(`${base}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text.slice(0, 16000) }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Ollama embed HTTP ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  return data.embedding as number[];
}

/**
 * Gera embedding via Ollama.
 * Lança erro explícito se OLLAMA_BASE_URL não estiver configurado.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!process.env.OLLAMA_BASE_URL && process.env.LLM_PROVIDER !== 'ollama') {
    throw new Error(
      '[embed] Ollama não configurado. Defina OLLAMA_BASE_URL ou LLM_PROVIDER=ollama.'
    );
  }
  return generateEmbeddingOllama(text);
}

// ── Chunking ──────────────────────────────────────────────────────────────────

/** Divide texto em chunks com overlap (para indexação RAG). */
export function chunkText(text: string, chunkSize = 1200, overlap = 150): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize));
    start += chunkSize - overlap;
  }
  return chunks;
}

// ── Ollama batch com controle de concorrência ─────────────────────────────────
// Hardening para hardware fraco: concorrência limitada, chunks com fronteira semântica.

const MAX_CONCURRENT = 2;     // protege CPU/VRAM em hardware modesto
const CHUNK_MAX_CHARS = 4000; // ~1000 tokens (1 token ≈ 4 chars)
const CHUNK_MIN_CHARS = 200;  // fragmentos menores são descartados

export function chunkTextSafe(text: string): string[] {
  const chunks: string[] = [];
  let pos = 0;
  while (pos < text.length) {
    let end = Math.min(pos + CHUNK_MAX_CHARS, text.length);
    if (end < text.length) {
      const paraBreak = text.lastIndexOf('\n\n', end);
      const sentBreak = text.lastIndexOf('. ', end);
      if (paraBreak > pos + CHUNK_MIN_CHARS) end = paraBreak + 2;
      else if (sentBreak > pos + CHUNK_MIN_CHARS) end = sentBreak + 2;
    }
    const chunk = text.slice(pos, end).trim();
    if (chunk.length > 100) chunks.push(chunk);
    pos = end;
  }
  return chunks;
}

async function runWithLimit<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit = MAX_CONCURRENT,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    results.push(...await Promise.all(batch.map(fn)));
    if (i + limit < items.length) await new Promise(r => setTimeout(r, 150));
  }
  return results;
}

export async function generateEmbeddingsOllama(
  chunks: string[],
): Promise<Array<{ chunk: string; embedding: number[] }>> {
  const ollamaBase = (process.env.OLLAMA_BASE_URL ?? 'http://ollama:11434/v1').replace('/v1', '');
  return runWithLimit(chunks, async (chunk) => {
    const res = await fetch(`${ollamaBase}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', prompt: chunk }),
    });
    if (!res.ok) throw new Error(`Ollama embed ${res.status}: ${await res.text()}`);
    const data = await res.json() as { embedding: number[] };
    return { chunk, embedding: data.embedding };
  });
}
