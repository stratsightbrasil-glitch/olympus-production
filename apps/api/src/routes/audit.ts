import { Hono } from 'hono';
import { db, auditLogs } from '@olympus/db';
import { desc, asc, eq, and, gte, lte, sql } from 'drizzle-orm';
import { verifyAuditHash } from '../utils/audit';

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

// GET /api/v1/audit/verify — verifica integridade da hash-chain SHA-256 (admin only)
// Percorre todos os registros em ordem de criação e recomputa o hash de cada um.
// Retorna { valid: true } se a cadeia está íntegra; firstInvalidId se adulterada.
auditRoutes.get('/verify', async (c) => {
  try {
    const jwt = c.get('jwtPayload') as any;
    if (!jwt || jwt.role !== 'admin') {
      return c.json({ error: 'Apenas administradores podem verificar a integridade.' }, 403);
    }

    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(asc(auditLogs.createdAt));

    let firstInvalidId: string | null = null;
    let invalidCount = 0;

    for (const log of logs) {
      const meta = log.metadata as Record<string, any> | null;
      // Registros antigos (sem _createdAt) são marcados como não verificáveis — não invalidam
      if (!meta?._createdAt) continue;

      const ok = verifyAuditHash({
        userId: log.userId,
        action: log.action,
        metadata: meta,
      });

      if (!ok) {
        invalidCount++;
        if (!firstInvalidId) firstInvalidId = log.id;
      }
    }

    return c.json({
      valid: firstInvalidId === null,
      totalRecords: logs.length,
      verifiedRecords: logs.filter(l => (l.metadata as any)?._createdAt).length,
      invalidCount,
      firstInvalidId,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default auditRoutes;
