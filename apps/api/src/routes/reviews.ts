import { Hono } from 'hono';
import { db, analyticReviews } from '@olympus/db';
import { eq } from 'drizzle-orm';

const reviewsRoutes = new Hono();

// GET /api/v1/reviews/:projectId — última revisão do projeto
reviewsRoutes.get('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const review = await db.query.analyticReviews.findFirst({
    where: eq(analyticReviews.projectId, projectId),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });
  return c.json({ review: review ?? null });
});

// POST /api/v1/reviews — cria ou atualiza revisão
reviewsRoutes.post('/', async (c) => {
  const jwtPayload = (c.get('jwtPayload') as any) || { name: 'Analista' };
  const body = await c.req.json();

  const { projectId, notasRevisor, status, declaracaoPropriedade, atsCompliance } = body;

  if (!projectId) return c.json({ error: 'projectId obrigatório' }, 400);

  const [inserted] = await db.insert(analyticReviews).values({
    projectId,
    reviewerId:   jwtPayload.sub || null,
    reviewerName: jwtPayload.name || 'Analista',
    reviewedAt:   new Date(),
    atsCompliance: atsCompliance ?? null,
    notasRevisor:  notasRevisor  ?? null,
    status:        status        ?? 'nao_revisado',
    declaracaoPropriedade: declaracaoPropriedade ?? null,
  }).returning();

  return c.json({ ok: true, review: inserted });
});

export default reviewsRoutes;
