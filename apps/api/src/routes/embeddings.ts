import { Hono } from 'hono';
import { db, embeddings, projects } from '@olympus/db';
import { eq, and, isNull } from 'drizzle-orm';
import { generateEmbedding, chunkText } from '@olympus/tools';

async function assertProjectOwner(c: any, projectId: string): Promise<boolean> {
  const jwt = c.get('jwtPayload') as any;
  if (jwt?.role === 'admin') return true;

  const proj = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  // Projeto ainda não existe no banco (upload de contexto antes de iniciar a análise).
  // Cria o registro agora para que os embeddings possam ser associados — chat.ts vai
  // encontrá-lo já existente quando o grafo iniciar e não duplicará.
  if (!proj) {
    await db.insert(projects).values({
      id:         projectId,
      name:       'Análise em preparação',
      methodology:'grumbach',
      createdBy:  jwt?.name || 'Sistema',
      updatedBy:  jwt?.name || 'Sistema',
    }).onConflictDoNothing();
    return true;
  }

  // Projeto existe mas está deletado ou pertence a outro usuário
  if (proj.deletedAt || proj.createdBy !== (jwt?.name || '')) return false;

  return true;
}

const router = new Hono();

// POST /api/v1/embeddings/index
// Body: { projectId, text, filename?, source?, chunkSize? }
router.post('/index', async (c) => {
  try {
    const body = await c.req.json();
    const { projectId, text, filename, source, chunkSize = 1200 } = body;

    if (!projectId || !text) {
      return c.json({ error: 'projectId e text são obrigatórios.' }, 400);
    }

    if (!(await assertProjectOwner(c, projectId))) return c.json({ error: 'Acesso negado' }, 403);

    const chunks = chunkText(String(text), Number(chunkSize));
    console.log(`[RAG] Indexando ${chunks.length} chunks para projeto ${projectId}`);

    const inserted: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await generateEmbedding(chunk);
      const [row] = await db.insert(embeddings).values({
        projectId,
        chunkText: chunk,
        metadata: { filename: filename ?? source ?? 'upload', chunk_index: i, total_chunks: chunks.length },
        embedding,
      }).returning({ id: embeddings.id });
      inserted.push(row.id);
    }

    return c.json({ ok: true, chunks: inserted.length, ids: inserted });
  } catch (e: any) {
    console.error('[RAG] Erro ao indexar:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

// DELETE /api/v1/embeddings/:projectId
// Remove todos os embeddings de um projeto (ex: antes de re-indexar)
router.delete('/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    if (!(await assertProjectOwner(c, projectId))) return c.json({ error: 'Acesso negado' }, 403);
    const deleted = await db.delete(embeddings)
      .where(eq(embeddings.projectId, projectId))
      .returning({ id: embeddings.id });
    return c.json({ ok: true, deleted: deleted.length });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/v1/embeddings/:projectId/count
router.get('/:projectId/count', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    if (!(await assertProjectOwner(c, projectId))) return c.json({ error: 'Acesso negado' }, 403);
    const rows = await db.select({ id: embeddings.id })
      .from(embeddings)
      .where(eq(embeddings.projectId, projectId));
    return c.json({ projectId, count: rows.length });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default router;
