import { Hono } from 'hono';
import { db, auditLogs } from '@olympus/db';
import { desc, eq, and, gte, lte, sql } from 'drizzle-orm';

const auditRoutes = new Hono();

// GET /api/v1/audit — lista eventos de auditoria (admin only)
// Query params: userId, action, resourceType, from (ISO date), to (ISO date), limit (default 100), offset (default 0)
auditRoutes.get('/', async (c) => {
  try {
    const { userId, action, resourceType, from, to, limit = '100', offset = '0' } = c.req.query();
    const conditions = [];
    if (userId)       conditions.push(eq(auditLogs.userId, userId));
    if (action)       conditions.push(eq(auditLogs.action, action));
    if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType));
    if (from)         conditions.push(gte(auditLogs.createdAt, new Date(from)));
    if (to)           conditions.push(lte(auditLogs.createdAt, new Date(to)));

    const [logs, [{ count }]] = await Promise.all([
      db.select().from(auditLogs)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(auditLogs.createdAt))
        .limit(Math.min(Number(limit), 500))
        .offset(Number(offset)),
      db.select({ count: sql<number>`count(*)` }).from(auditLogs)
        .where(conditions.length ? and(...conditions) : undefined),
    ]);

    return c.json({ logs, total: Number(count), limit: Number(limit), offset: Number(offset) });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/v1/audit/stats — resumo por ação (admin only)
auditRoutes.get('/stats', async (c) => {
  try {
    const stats = await db
      .select({ action: auditLogs.action, count: sql<number>`count(*)` })
      .from(auditLogs)
      .groupBy(auditLogs.action)
      .orderBy(desc(sql`count(*)`));
    return c.json(stats);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default auditRoutes;
