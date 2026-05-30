/**
 * embed.ts — Roteador de Embeddings (Voyage AI ↔ Ollama nomic-embed-text)
 *
 * Roteamento automático por disponibilidade:
 *   1. VOYAGE_API_KEY configurado  → Voyage AI voyage-3-lite (512 dims, cloud)
 *   2. LLM_PROVIDER=ollama        → Ollama nomic-embed-text (~768 dims, local)
 *   3. Nenhum disponível          → erro explícito (não silencioso)
 *
 * Dimensões: Voyage=512, Ollama nomic-embed-text=768.
 * ATENÇÃO: índices criados com um provider NÃO são compatíveis com o outro
 * (dimensões diferentes). Ao trocar provider, reindexar todos os embeddings.
 */

export const EMBEDDING_DIMS = 512; // padrão Voyage; Ollama usa 768

/** Voyage AI — voyage-3-lite (512 dims, cloud) */
async function generateEmbeddingVoyage(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY!;
  const input = text.slice(0, 32000);
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'voyage-3-lite', input }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Voyage AI HTTP ${res.status}: ${err.slice(0, 200)}`);
  }
  const data: any = await res.json();
  return data.data[0].embedding as number[];
}

/** Ollama — nomic-embed-text (~768 dims, local) */
async function generateEmbeddingOllamaLocal(text: string): Promise<number[]> {
  const base = (process.env.OLLAMA_BASE_URL ?? "http://ollama:11434/v1").replace("/v1", "");
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
 * Roteador principal de embeddings.
 * Prioridade: Voyage (cloud) → Ollama (local) → erro explícito.
 * Nunca falha silenciosamente — o chamador decide como tratar o erro.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (process.env.VOYAGE_API_KEY) {
    return generateEmbeddingVoyage(text);
  }
  if (process.env.LLM_PROVIDER === 'ollama' || process.env.OLLAMA_BASE_URL) {
    return generateEmbeddingOllamaLocal(text);
  }
  throw new Error(
    '[embed] Nenhum provider de embedding configurado. ' +
    'Defina VOYAGE_API_KEY (cloud) ou OLLAMA_BASE_URL + LLM_PROVIDER=ollama (local).'
  );
}

// Split text into ~512-token chunks with overlap
export function chunkText(text: string, chunkSize = 1200, overlap = 150): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize));
    start += chunkSize - overlap;
  }
  return chunks;
}

// ── Ollama Local Embedding (nomic-embed-text ~280MB) ─────────────────────────
// Hardening para hardware fraco: concorrência limitada, chunks com fronteira semântica.

const MAX_CONCURRENT = 2;   // máximo 2 em paralelo — protege CPU/VRAM
const CHUNK_MAX_CHARS = 4000; // ~1000 tokens (1 token ≈ 4 chars)
const CHUNK_MIN_CHARS = 200;  // fragmentos menores são descartados

export function chunkTextSafe(text: string): string[] {
  const chunks: string[] = [];
  let pos = 0;
  while (pos < text.length) {
    let end = Math.min(pos + CHUNK_MAX_CHARS, text.length);
    if (end < text.length) {
      // Preferir quebra em parágrafo, depois em sentença
      const paraBreak = text.lastIndexOf("\n\n", end);
      const sentBreak = text.lastIndexOf(". ", end);
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
  const ollamaBase = (process.env.OLLAMA_BASE_URL ?? "http://ollama:11434/v1").replace("/v1", "");
  return runWithLimit(chunks, async (chunk) => {
    const res = await fetch(`${ollamaBase}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "nomic-embed-text", prompt: chunk }),
    });
    if (!res.ok) throw new Error(`Ollama embed ${res.status}: ${await res.text()}`);
    const data = await res.json() as { embedding: number[] };
    return { chunk, embedding: data.embedding };
  });
}
