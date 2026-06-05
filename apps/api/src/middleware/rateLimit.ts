// Rate limiting por sliding window via PostgreSQL — garante limite global entre
// múltiplas instâncias Docker/Railway. Substitui o bucket in-memory do Sprint anterior.
// TEST_MODE=true bypassa todos os limites para suites de integração.
import { db, rateLimitLogs } from '@olympus/db';
import { eq, and, gt, count } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

const TEST_MODE = process.env.TEST_MODE === 'true';

const LIMITS: Record<string, { max: number; windowMs: number; message: string }> = {
  // Grumbach 9 fases em passos mode = ~10 POSTs por análise completa.
  // Limite 20/hora permite 2 análises completas por hora para analistas.
  analysis: { max: 20, windowMs: 60 * 60 * 1000,       message: 'Limite de análises atingido (20/hora). Aguarde antes de iniciar nova análise.' },
  export:   { max: 10, windowMs: 60 * 60 * 1000,       message: 'Limite de exportações atingido (10/hora). Aguarde antes de exportar novamente.' },
  // Login: 5 tentativas / 15 min por IP. Substitui o bucket in-process de auth.ts,
  // que não funciona com múltiplas instâncias. Usa 'ip:<addr>' como userId fictício.
  login:    { max: 5,  windowMs: 15 * 60 * 1000,       message: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
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
  // Admins são isentos: uma análise MSEF em passos exige ~8-10 chamadas (1 por fase)
  if (payload?.role === 'admin') return next();
  const userId = payload?.id || c.req.header('x-forwarded-for') || 'anon';
  const allowed = await checkRateLimit(userId, 'analysis');
  if (!allowed) return c.json({ error: LIMITS.analysis.message }, 429);
  return next();
}

/**
 * Rate limit de login baseado em IP — Postgres-backed, funciona com múltiplas instâncias.
 * Substitui o bucket in-process em auth.ts (Map) que era contornável com N replicas.
 * Retorna false quando o limite é atingido; não persiste entrada (só verifica).
 */
export async function checkLoginRateLimitPg(ip: string): Promise<{ allowed: boolean; message?: string }> {
  if (TEST_MODE) return { allowed: true };
  const limit = LIMITS['login']!;
  const windowStart = new Date(Date.now() - limit.windowMs);
  const userId = `ip:${ip}`; // prefixo evita colisão com UUIDs reais de usuários

  const [result] = await db
    .select({ total: count() })
    .from(rateLimitLogs)
    .where(and(eq(rateLimitLogs.userId, userId), eq(rateLimitLogs.action, 'login'), gt(rateLimitLogs.createdAt, windowStart)));

  if ((result?.total ?? 0) >= limit.max) {
    return { allowed: false, message: limit.message };
  }

  await db.insert(rateLimitLogs).values({ userId, action: 'login' });
  return { allowed: true };
}

export async function rateLimitExport(c: any, next: any) {
  if (TEST_MODE) return next();
  const payload = c.get('jwtPayload');
  const userId = payload?.id || c.req.header('x-forwarded-for') || 'anon';
  const allowed = await checkRateLimit(userId, 'export');
  if (!allowed) return c.json({ error: LIMITS.export.message }, 429);
  return next();
}
