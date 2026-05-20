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
