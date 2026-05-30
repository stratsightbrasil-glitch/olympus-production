// Rate limiting por sliding window via PostgreSQL — garante limite global entre
// múltiplas instâncias Docker/Railway. Substitui o bucket in-memory do Sprint anterior.
// TEST_MODE=true bypassa todos os limites para suites de integração.
import { db, rateLimitLogs } from '@olympus/db';
import { eq, and, gt, count } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

const TEST_MODE = process.env.TEST_MODE === 'true';

const LIMITS: Record<string, { max: number; windowMs: number; message: string }> = {
  analysis: { max: 5,  windowMs: 60 * 60 * 1000, message: 'Limite de análises atingido (5/hora). Aguarde antes de iniciar nova análise.' },
  export:   { max: 10, windowMs: 60 * 60 * 1000, message: 'Limite de exportações atingido (10/hora). Aguarde antes de exportar novamente.' },
};

async function checkRateLimit(userId: string, action: string): Promise<boolean> {
  const limit = LIMITS[action];
  if (!limit) return true;

  const windowStart = new Date(Date.now() - limit.windowMs);

  const [result] = await db
    .select({ total: count() })
    .from(rateLimitLogs)
    .where(
      and(
        eq(rateLimitLogs.userId, userId),
        eq(rateLimitLogs.action, action),
        gt(rateLimitLogs.createdAt, windowStart)
      )
    );

  if ((result?.total ?? 0) >= limit.max) return false;

  await db.insert(rateLimitLogs).values({ userId, action });
  return true;
}

export async function rateLimitAnalysis(c: any, next: any) {
  if (TEST_MODE) return next();
  const payload = c.get('jwtPayload');
  const userId = payload?.id || c.req.header('x-forwarded-for') || 'anon';
  const allowed = await checkRateLimit(userId, 'analysis');
  if (!allowed) return c.json({ error: LIMITS.analysis.message }, 429);
  return next();
}

export async function rateLimitExport(c: any, next: any) {
  if (TEST_MODE) return next();
  const payload = c.get('jwtPayload');
  const userId = payload?.id || c.req.header('x-forwarded-for') || 'anon';
  const allowed = await checkRateLimit(userId, 'export');
  if (!allowed) return c.json({ error: LIMITS.export.message }, 429);
  return next();
}
