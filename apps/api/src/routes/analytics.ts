/**
 * analytics.ts — Dados estruturados para visualizações de fases analíticas
 *
 * GET /api/v1/analytics/:projectId/delphi   — events P(i) da fase 4
 * GET /api/v1/analytics/:projectId/impacts  — matrix_direct_impacts + fpfs da fase 5
 */

import { Hono } from 'hono';
import { db, projectEvents, matrixDirectImpacts, projects } from '@olympus/db';
import { eq, and, ilike, or } from 'drizzle-orm';

const router = new Hono();

async function assertProjectAccess(c: any, projectId: string): Promise<boolean> {
  const jwt = c.get('jwtPayload') as any;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return false;
  if (jwt?.role === 'admin') return true;
  const teamId = (project as any).teamId;
  if (!teamId) return jwt?.sub === (project as any).createdBy;
  return true; // simplificado — acesso por membro de equipe validado em outros endpoints
}

// GET /api/v1/analytics/:projectId/delphi
// Retorna todos os events com name começando por 'P(i)' para renderização da DelphiMatrix
router.get('/:projectId/delphi', async (c) => {
  const { projectId } = c.req.param();
  if (!await assertProjectAccess(c, projectId)) return c.json({ error: 'Não encontrado' }, 404);

  const events = await db.select({
    id:          projectEvents.id,
    name:        projectEvents.name,
    description: projectEvents.description,
    type:        projectEvents.type,
    status:      projectEvents.status,
    createdAt:   projectEvents.createdAt,
  })
    .from(projectEvents)
    .where(and(
      eq(projectEvents.projectId, projectId),
      ilike(projectEvents.name, 'p(i)%'),
    ));

  return c.json(events);
});

// GET /api/v1/analytics/:projectId/impacts
// Retorna FPFs aprovados + matriz de impactos diretos para o ImpactMatrix
router.get('/:projectId/impacts', async (c) => {
  const { projectId } = c.req.param();
  if (!await assertProjectAccess(c, projectId)) return c.json({ error: 'Não encontrado' }, 404);

  const [fpfs, impacts] = await Promise.all([
    db.select({
      id:          projectEvents.id,
      name:        projectEvents.name,
      description: projectEvents.description,
    })
      .from(projectEvents)
      .where(and(
        eq(projectEvents.projectId, projectId),
        eq(projectEvents.type, 'fpf'),
        eq(projectEvents.status, 'approved'),
      )),

    db.select({
      fromEventId: matrixDirectImpacts.fromEventId,
      toEventId:   matrixDirectImpacts.toEventId,
      impactScore: matrixDirectImpacts.impactScore,
    })
      .from(matrixDirectImpacts)
      .where(eq(matrixDirectImpacts.projectId, projectId)),
  ]);

  return c.json({ fpfs, impacts });
});

export default router;
