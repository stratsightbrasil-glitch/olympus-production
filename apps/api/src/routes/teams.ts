import { Hono } from 'hono';
import { db } from '@olympus/db';
import { teams, teamMembers, users } from '@olympus/db';
import { eq, and } from 'drizzle-orm';

const teamsRoutes = new Hono();

// ── GET /api/v1/teams ─────────────────────────────────────────────────────────
teamsRoutes.get('/', async (c) => {
  const list = await db.select().from(teams).orderBy(teams.name);
  return c.json(list);
});

// ── POST /api/v1/teams ────────────────────────────────────────────────────────
teamsRoutes.post('/', async (c) => {
  const body = await c.req.json() as any;
  if (!body.name?.trim()) return c.json({ error: 'Nome obrigatório.' }, 400);
  const [team] = await db.insert(teams).values({
    name: body.name.trim(),
    description: body.description ?? null,
  }).returning();
  return c.json(team, 201);
});

// ── GET /api/v1/teams/:id ─────────────────────────────────────────────────────
teamsRoutes.get('/:id', async (c) => {
  const team = await db.query.teams.findFirst({ where: eq(teams.id, c.req.param('id')) });
  if (!team) return c.json({ error: 'Equipe não encontrada.' }, 404);

  const members = await db
    .select({ userId: teamMembers.userId, role: teamMembers.role,
              name: users.name, email: users.email })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, team.id));

  return c.json({ ...team, members });
});

// ── PATCH /api/v1/teams/:id ───────────────────────────────────────────────────
teamsRoutes.patch('/:id', async (c) => {
  const body = await c.req.json() as any;
  const updates: Partial<typeof teams.$inferInsert> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description ?? null;
  if (Object.keys(updates).length === 0) return c.json({ error: 'Nenhum campo para atualizar.' }, 400);

  const [updated] = await db.update(teams).set(updates)
    .where(eq(teams.id, c.req.param('id'))).returning();
  if (!updated) return c.json({ error: 'Equipe não encontrada.' }, 404);
  return c.json(updated);
});

// ── DELETE /api/v1/teams/:id ──────────────────────────────────────────────────
teamsRoutes.delete('/:id', async (c) => {
  const payload = c.get('jwtPayload') as any;
  if (!payload || payload.role !== 'admin') {
    return c.json({ error: 'Apenas administradores podem excluir equipes.' }, 403);
  }
  const [deleted] = await db.delete(teams).where(eq(teams.id, c.req.param('id'))).returning();
  if (!deleted) return c.json({ error: 'Equipe não encontrada.' }, 404);
  return c.json({ ok: true });
});

// ── PUT /api/v1/teams/:id/members ─────────────────────────────────────────────
// Substitui todos os membros da equipe (array de { userId, role })
teamsRoutes.put('/:id/members', async (c) => {
  const teamId = c.req.param('id');
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) return c.json({ error: 'Equipe não encontrada.' }, 404);

  const body = await c.req.json() as any;
  const incoming: { userId: string; role?: string }[] = body.members ?? [];

  // Validação básica
  if (!Array.isArray(incoming)) return c.json({ error: '"members" deve ser array.' }, 400);

  await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
  if (incoming.length > 0) {
    await db.insert(teamMembers).values(
      incoming.map(m => ({ teamId, userId: m.userId, role: m.role ?? 'analista' }))
    );
  }
  return c.json({ ok: true, count: incoming.length });
});

// ── DELETE /api/v1/teams/:id/members/:userId ──────────────────────────────────
teamsRoutes.delete('/:id/members/:userId', async (c) => {
  await db.delete(teamMembers)
    .where(and(
      eq(teamMembers.teamId, c.req.param('id')),
      eq(teamMembers.userId, c.req.param('userId')),
    ));
  return c.json({ ok: true });
});

export default teamsRoutes;
