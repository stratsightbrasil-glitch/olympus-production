// Voyage AI embedding utility (voyage-3-lite, 512 dims)
// Registro gratuito: dash.voyageai.com — definir VOYAGE_API_KEY no .env

export const EMBEDDING_DIMS = 512;

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'VOYAGE_API_KEY não configurado. Obtenha gratuitamente em dash.voyageai.com e adicione ao .env'
    );
  }

  const input = text.slice(0, 32000); // voyage-3-lite token limit safety
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
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
