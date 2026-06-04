import { Hono } from 'hono';
import { PdfReader } from 'pdfreader';
import * as mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import { db, embeddings } from '@olympus/db';
import { generateEmbedding, chunkText } from '@olympus/tools';

async function autoIndex(projectId: string, text: string, filename: string): Promise<void> {
  // Roteamento automático: Voyage (se VOYAGE_API_KEY) → Ollama (se OLLAMA_BASE_URL/LLM_PROVIDER=ollama)
  // Não ignora silenciosamente — loga o motivo para o operador agir.
  const hasVoyage = !!process.env.VOYAGE_API_KEY;
  const hasOllama = !!(process.env.OLLAMA_BASE_URL || process.env.LLM_PROVIDER === 'ollama');
  if (!hasVoyage && !hasOllama) {
    console.warn('[RAG] Auto-indexing ignorado: nenhum provider de embedding configurado (VOYAGE_API_KEY ou OLLAMA_BASE_URL). Documentos não serão recuperáveis via buscar_documentos_internos.');
    return;
  }
  try {
    const chunks = chunkText(text);
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateEmbedding(chunks[i]);
      await db.insert(embeddings).values({
        projectId,
        chunkText: chunks[i],
        metadata: { filename, chunk_index: i, total_chunks: chunks.length },
        embedding,
      });
    }
    const provider = hasVoyage ? 'Voyage AI' : 'Ollama';
    console.log(`[RAG] Auto-indexado via ${provider}: ${filename} (${chunks.length} chunks) → projeto ${projectId}`);
  } catch (e: any) {
    console.warn(`[RAG] Auto-indexing falhou para ${filename}:`, e.message);
  }
}

const extractRoutes = new Hono();

function extractPdf(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const rows: Record<number, string[]> = {};
    new PdfReader().parseBuffer(buffer, (err, item) => {
      if (err) reject(new Error('Erro ao ler PDF: ' + ((err as any).message || err)));
      else if (!item) {
        const text = Object.keys(rows).sort((a, b) => Number(a) - Number(b)).map(y => rows[Number(y)].join(' ')).join('\n');
        resolve(text);
      } else if (item.text) {
        const y = item.y || 0;
        if (!rows[y]) rows[y] = [];
        rows[y].push(item.text);
      }
    });
  });
}

extractRoutes.post('/', async (c) => {
  console.log('[Extract] Recebendo upload de arquivo...');
  try {
    // O limite de 50 MB é garantido pelo nginx (client_max_body_size).
    // parseBody() lê o corpo inteiro em memória — arquivos muito grandes podem causar OOM.
    const body = await c.req.parseBody() as any;
    const files = body.files;
    const projectId: string | undefined = body.projectId;
    if (!files) return c.json({ error: 'Nenhum arquivo recebido.' }, 400);

    const fileArray = Array.isArray(files) ? files : [files];
    const results = [];

    for (const file of fileArray) {
      if (file instanceof File) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          let text = '';
          const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
          
          if (file.type === 'application/pdf' || ext === '.pdf') text = await extractPdf(buffer);
          else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx' || ext === '.doc') {
            text = (await mammoth.extractRawText({ buffer })).value;
          } else if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
            const wb = xlsx.read(buffer, { type: 'buffer' });
            let sheetText = '';
            for (const sheetName of wb.SheetNames) {
              const ws = wb.Sheets[sheetName];
              sheetText += `\n--- Planilha: ${sheetName} ---\n`;
              sheetText += xlsx.utils.sheet_to_csv(ws);
            }
            text = sheetText;
          } else if (file.type.startsWith('image/') || ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') {
            const base64 = buffer.toString('base64');
            const mimeType = file.type || 'image/jpeg';
            text = `[IMAGEM: ${file.name}]`;
            results.push({ name: file.name, text: text, size: buffer.length, isImage: true, dataUrl: `data:${mimeType};base64,${base64}` });
            continue;
          } else text = buffer.toString('utf-8'); // txt, md

          results.push({ name: file.name, text: text.trim(), size: text.length, isImage: false });
          console.log(`[Extract] Arquivo processado: ${file.name} (${text.length} chars)`);
          // Auto-index em background — .catch() obrigatório para evitar unhandled rejection
          if (projectId && text.trim()) {
            autoIndex(projectId, text.trim(), file.name).catch((e: any) =>
              console.error('[Extract] autoIndex falhou:', e.message)
            );
          }
        } catch (err: any) { results.push({ name: file.name, text: null, error: err.message }); }
      }
    }
    return c.json({ files: results });
  } catch (error: any) { return c.json({ error: error.message }, 500); }
});
export default extractRoutes;