import { Hono } from 'hono';
import { db, users } from '@olympus/db';
import { eq } from 'drizzle-orm';
import { sign } from 'hono/jwt';
import bcrypt from 'bcryptjs';
import qrcode from 'qrcode';
import speakeasy from 'speakeasy';

const authRoutes = new Hono();

authRoutes.get('/setup-status', async (c) => {
  const firstUser = await db.query.users.findFirst();
  return c.json({ hasUsers: !!firstUser });
});

authRoutes.post('/login', async (c) => {
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

  const payload = { id: user.id, name: user.name, role: user.role, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 };
  const token = await sign(payload, process.env.JWT_SECRET || 'olympus_super_secret_key_2026');
  return c.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

authRoutes.post('/register', async (c) => {
  const { name, email, password, role } = (await c.req.json()) as any;
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return c.json({ error: 'Email já cadastrado' }, 400);
  
  const anyUser = await db.query.users.findFirst();
  const finalRole = anyUser ? (role || 'analista') : 'admin';

  const passwordHash = await bcrypt.hash(password, 10);
  const [newUser] = await db.insert(users).values({ name, email, passwordHash, role: finalRole }).returning();
  return c.json({ user: { id: newUser.id, name: newUser.name, role: newUser.role } });
});

authRoutes.post('/2fa/generate', async (c) => {
  const { userId } = (await c.req.json()) as any;
  
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404);

  const secretInfo = speakeasy.generateSecret({ name: `OLYMPUS StratSight (${user.email})` });
  const secret = secretInfo.base32;
  const qrCodeUrl = await qrcode.toDataURL(secretInfo.otpauth_url!);
  
  await db.update(users).set({ twoFactorSecret: secret }).where(eq(users.id, userId));
  return c.json({ secret, qrCodeUrl });
});

authRoutes.post('/2fa/enable', async (c) => {
  const { userId, token } = (await c.req.json()) as any;
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