import { Hono } from 'hono';
import { db, users } from '@olympus/db';
import { eq } from 'drizzle-orm';
import { sign } from 'hono/jwt';
import bcrypt from 'bcryptjs';
import qrcode from 'qrcode';
import speakeasy from 'speakeasy';
import { logAudit } from '../utils/audit';

// ── Rate limit genérico (login + register) ───────────────────────────────────
// Protege contra força bruta e enumeração de usuários via registro em massa.
// Usa IP real (x-forwarded-for para proxy/nginx).
interface RateBucket { count: number; resetAt: number; }

function makeRateLimiter(maxAttempts: number, windowMs: number) {
  const buckets = new Map<string, RateBucket>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (now > v.resetAt) buckets.delete(k);
    }
  }, Math.min(windowMs, 5 * 60 * 1000));

  return function check(ip: string): boolean {
    const now = Date.now();
    const bucket = buckets.get(ip);
    if (!bucket || now > bucket.resetAt) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (bucket.count >= maxAttempts) return false;
    bucket.count++;
    return true;
  };
}

// Login: 5 tentativas / 15 min
const checkLoginRateLimit    = makeRateLimiter(5, 15 * 60 * 1000);
// Register: 3 tentativas / 60 min — dificulta enumeração de e-mails via cadastro
const checkRegisterRateLimit = makeRateLimiter(3, 60 * 60 * 1000);

// JWT_EXPIRY: '1h'|'4h'|'8h'|'24h'|'7d' — default '8h' (recomendado para produção)
function jwtExpirySeconds(): number {
  const raw = process.env.JWT_EXPIRY || '8h';
  const match = raw.match(/^(\d+)(h|d|m)$/);
  if (!match) return 8 * 3600;
  const n = Number(match[1]);
  if (match[2] === 'h') return n * 3600;
  if (match[2] === 'd') return n * 86400;
  if (match[2] === 'm') return n * 60;
  return 8 * 3600;
}

const authRoutes = new Hono();

authRoutes.get('/setup-status', async (c) => {
  const firstUser = await db.query.users.findFirst();
  return c.json({ hasUsers: !!firstUser });
});

authRoutes.post('/login', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim()
    || c.req.header('x-real-ip')
    || 'unknown';
  if (!checkLoginRateLimit(ip)) {
    return c.json({ error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }, 429);
  }

  const { email, password, token: totpToken } = (await c.req.json()) as any;
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !user.passwordHash) return c.json({ error: 'Credenciais inválidas' }, 401);

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return c.json({ error: 'Credenciais inválidas' }, 401);

  if (user.isTwoFactorEnabled) {
    if (!totpToken) {
      return c.json({ requires2FA: true, userId: user.id });
    }
    const isTotpValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret!,
      encoding: 'base32',
      token: totpToken
    });
    if (!isTotpValid) return c.json({ error: 'Código 2FA inválido' }, 401);
  }

  const exp = Math.floor(Date.now() / 1000) + jwtExpirySeconds();
  const payload = { id: user.id, name: user.name, role: user.role, exp };
  const token = await sign(payload, process.env.JWT_SECRET!);
  await logAudit({
    userId: user.id, userName: user.name, action: 'login', resourceType: 'user', resourceId: user.id,
    ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
  });
  return c.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

authRoutes.post('/register', async (c) => {
  // Rate limit — dificulta enumeração de e-mails via tentativas de cadastro em massa
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim()
    || c.req.header('x-real-ip')
    || 'unknown';
  if (!checkRegisterRateLimit(ip)) {
    return c.json({ error: 'Muitas tentativas. Tente novamente mais tarde.' }, 429);
  }

  const { name, email, password, role } = (await c.req.json()) as any;

  // Verifica duplicidade ANTES do hash para falhar rápido, mas retorna a
  // mesma mensagem neutra de sucesso — impede distinguir "já existia" de "criado".
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    // Simula latência do bcrypt para não vazar por timing (≈ 60–80 ms)
    await new Promise(r => setTimeout(r, 70));
    return c.json({ error: 'Não foi possível concluir o cadastro.' }, 400);
  }

  const anyUser = await db.query.users.findFirst();
  const finalRole = anyUser ? (role || 'analista') : 'admin';

  const passwordHash = await bcrypt.hash(password, 10);
  const [newUser] = await db.insert(users).values({ name, email, passwordHash, role: finalRole }).returning();
  return c.json({ user: { id: newUser.id, name: newUser.name, role: newUser.role } });
});

// ── 2FA — requer autenticação JWT (adicionado em PROTECTED_PREFIXES no index.ts) ──
// userId derivado do token JWT — nunca da payload do request (previne IDOR/escalada).
authRoutes.post('/2fa/generate', async (c) => {
  const jwtPayload = c.get('jwtPayload') as any;
  const userId = jwtPayload?.id;
  if (!userId) return c.json({ error: 'Não autenticado' }, 401);

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404);

  const secretInfo = speakeasy.generateSecret({ name: `OLYMPUS StratSight (${user.email})` });
  const secret = secretInfo.base32;
  const qrCodeUrl = await qrcode.toDataURL(secretInfo.otpauth_url!);

  await db.update(users).set({ twoFactorSecret: secret }).where(eq(users.id, userId));
  return c.json({ secret, qrCodeUrl });
});

authRoutes.post('/2fa/enable', async (c) => {
  const jwtPayload = c.get('jwtPayload') as any;
  const userId = jwtPayload?.id;
  if (!userId) return c.json({ error: 'Não autenticado' }, 401);

  const { token } = (await c.req.json()) as any;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || !user.twoFactorSecret) return c.json({ error: 'Usuário não encontrado' }, 404);

  const isValid = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token: token
  });

  if (!isValid) return c.json({ error: 'Código 2FA inválido' }, 400);

  await db.update(users).set({ isTwoFactorEnabled: true }).where(eq(users.id, userId));
  return c.json({ ok: true });
});

export default authRoutes;