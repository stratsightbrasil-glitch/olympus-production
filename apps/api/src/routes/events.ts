/**
 * events.ts — HITL API para project_events
 *
 * Fluxo de aprovação:
 *   Agente cria evento (status='proposed') via tool_register_event
 *   → analista revisa aqui (GET /events?projectId=X)
 *   → aprova ou rejeita (PATCH /events/:id/status)
 *   → anchorContext em chat.ts lê apenas eventos 'approved'
 *   → LangGraph Fase 2: interruptBefore: ['node_modeling'] aguardará esse gate
 */

import { Hono } from 'hono';
import { db, projectEvents } from '@olympus/db';
import { eq, and, inArray } from 'drizzle-orm';

const eventsRoutes = new Hono();

// ── GET /events?projectId=X[&status=proposed] ─────────────────────────────────
eventsRoutes.get('/', async (c) => {
  try {
    const projectId = c.req.query('projectId');
    const status    = c.req.query('status');   // 'proposed' | 'approved' | 'rejected'

    if (!projectId) return c.json({ error: 'projectId obrigatório' }, 400);

    const VALID_STATUSES = ['proposed', 'approved', 'rejected'] as const;
    const statusFilter = VALID_STATUSES.includes(status as any)
      ? eq(projectEvents.status, status as string)
      : undefined;

    const rows = await db
      .select()
      .from(projectEvents)
      .where(
        statusFilter
          ? and(eq(projectEvents.projectId, projectId), statusFilter)
          : eq(projectEvents.projectId, projectId)
      )
      .orderBy(projectEvents.createdAt);

    return c.json(rows);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ── POST /events — criação manual pelo analista (complementa tool_register_event) ─
eventsRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json() as any;
    const { projectId, name, description, type, sourceEvaluation } = body;

    if (!projectId || !name || !description || !type) {
      return c.json({ error: 'projectId, name, description e type são obrigatórios' }, 400);
    }

    const VALID_TYPES = ['trend', 'uncertainty', 'inflection_factor', 'fpf'];
    if (!VALID_TYPES.includes(type)) {
      return c.json({ error: `type inválido. Valores aceitos: ${VALID_TYPES.join(', ')}` }, 400);
    }

    const [evt] = await db.insert(projectEvents).values({
      projectId,
      name,
      description,
      type,
      status: 'proposed',
      sourceEvaluation: sourceEvaluation ?? { reliability: 'C', credibility: '3' },
    }).returning();

    return c.json(evt, 201);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ── PATCH /events/:id/status — aprovação / rejeição pelo analista ──────────────
eventsRoutes.patch('/:id/status', async (c) => {
  try {
    const id     = c.req.param('id');
    const body   = await c.req.json() as any;
    const status = body.status as string;

    const VALID = ['approved', 'rejected', 'proposed'];
    if (!VALID.includes(status)) {
      return c.json({ error: `status inválido. Valores aceitos: ${VALID.join(', ')}` }, 400);
    }

    const existing = await db.query.projectEvents.findFirst({ where: eq(projectEvents.id, id) });
    if (!existing) return c.json({ error: 'Evento não encontrado' }, 404);

    const [updated] = await db
      .update(projectEvents)
      .set({ status, updatedAt: new Date() })
      .where(eq(projectEvents.id, id))
      .returning();

    return c.json(updated);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ── PATCH /events/batch/status — aprovação em lote ────────────────────────────
eventsRoutes.patch('/batch/status', async (c) => {
  try {
    const body   = await c.req.json() as any;
    const ids    = body.ids as string[];
    const status = body.status as string;

    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: 'ids deve ser um array não vazio' }, 400);
    }
    const VALID = ['approved', 'rejected', 'proposed'];
    if (!VALID.includes(status)) {
      return c.json({ error: `status inválido. Valores aceitos: ${VALID.join(', ')}` }, 400);
    }

    const updated = await db
      .update(projectEvents)
      .set({ status, updatedAt: new Date() })
      .where(inArray(projectEvents.id, ids))
      .returning({ id: projectEvents.id, status: projectEvents.status });

    return c.json({ updated: updated.length, rows: updated });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ── PATCH /events/:id — atualização geral (sourceEvaluation, name, description) ─
eventsRoutes.patch('/:id', async (c) => {
  try {
    const id   = c.req.param('id');
    const body = await c.req.json() as any;

    const existing = await db.query.projectEvents.findFirst({ where: eq(projectEvents.id, id) });
    if (!existing) return c.json({ error: 'Evento não encontrado' }, 404);

    const allowed = ['name', 'description', 'type', 'sourceEvaluation'] as const;
    const patch: Record<string, any> = { updatedAt: new Date() };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }

    const [updated] = await db
      .update(projectEvents)
      .set(patch)
      .where(eq(projectEvents.id, id))
      .returning();

    return c.json(updated);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ── DELETE /events/:id ─────────────────────────────────────────────────────────
eventsRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await db.query.projectEvents.findFirst({ where: eq(projectEvents.id, id) });
    if (!existing) return c.json({ error: 'Evento não encontrado' }, 404);

    await db.delete(projectEvents).where(eq(projectEvents.id, id));
    return c.json({ ok: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

export default eventsRoutes;
