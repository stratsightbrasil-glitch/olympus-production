import { Hono } from 'hono';
import { db, users } from '@olympus/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const usersRoutes = new Hono();

// Trava de Segurança: Apenas Administradores podem acessar estas rotas
usersRoutes.use('*', async (c, next) => {
  const payload = c.get('jwtPayload') as any;
  if (!payload || payload.role !== 'admin') {
    return c.json({ error: 'Acesso negado. Privilégios de Administrador requeridos.' }, 403);
  }
  await next();
});

usersRoutes.get('/', async (c) => {
  try {
    const allUsers = await db.query.users.findMany({
      columns: { id: true, name: true, email: true, role: true, createdAt: true, isTwoFactorEnabled: true }
    });
    return c.json(allUsers);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

const ALLOWED_ROLES = ['admin', 'analista', 'cliente'] as const;
type UserRole = typeof ALLOWED_ROLES[number];

usersRoutes.post('/', async (c) => {
  try {
    const { name, email, password, role } = (await c.req.json()) as any;
    if (!email || typeof email !== 'string' || !email.includes('@'))
      return c.json({ error: 'E-mail inválido.' }, 400);
    if (!password || typeof password !== 'string' || password.length < 8)
      return c.json({ error: 'Senha deve ter no mínimo 8 caracteres.' }, 400);
    if (!name || typeof name !== 'string' || name.trim().length < 2)
      return c.json({ error: 'Nome inválido.' }, 400);

    const safeRole: UserRole = ALLOWED_ROLES.includes(role) ? role : 'analista';
    const existing = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase().trim()) });
    if (existing) return c.json({ error: 'E-mail já cadastrado no sistema.' }, 400);

    const passwordHash = await bcrypt.hash(password, 10);
    const [newUser] = await db.insert(users).values({
      name: name.trim(), email: email.toLowerCase().trim(), passwordHash, role: safeRole,
    }).returning();
    return c.json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role });
  } catch (e: any) { return c.json({ error: 'Operação falhou.' }, 500); }
});

usersRoutes.patch('/:id', async (c) => {
  try {
    const { role } = (await c.req.json()) as any;
    if (!ALLOWED_ROLES.includes(role))
      return c.json({ error: `Role inválido. Permitidos: ${ALLOWED_ROLES.join(', ')}` }, 400);
    const id = c.req.param('id');
    // Validação básica de UUID — evita queries com strings arbitrárias
    if (!/^[0-9a-f-]{36}$/i.test(id)) return c.json({ error: 'ID inválido.' }, 400);
    await db.update(users).set({ role }).where(eq(users.id, id));
    return c.json({ ok: true });
  } catch (e: any) { return c.json({ error: 'Operação falhou.' }, 500); }
});

usersRoutes.delete('/:id', async (c) => {
  try {
    if ((c.get('jwtPayload') as any).id === c.req.param('id')) return c.json({ error: 'Operação ilegal: suicídio de conta bloqueado.' }, 400);
    await db.delete(users).where(eq(users.id, c.req.param('id')));
    return c.json({ ok: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

export default usersRoutes;
