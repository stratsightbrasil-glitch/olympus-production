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

usersRoutes.post('/', async (c) => {
  try {
    const { name, email, password, role } = (await c.req.json()) as any;
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) return c.json({ error: 'E-mail já cadastrado no sistema.' }, 400);
    
    const passwordHash = await bcrypt.hash(password, 10);
    const [newUser] = await db.insert(users).values({ name, email, passwordHash, role: role || 'analista' }).returning();
    return c.json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

usersRoutes.patch('/:id', async (c) => {
  try {
    await db.update(users).set({ role: ((await c.req.json()) as any).role }).where(eq(users.id, c.req.param('id')));
    return c.json({ ok: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

usersRoutes.delete('/:id', async (c) => {
  try {
    if ((c.get('jwtPayload') as any).id === c.req.param('id')) return c.json({ error: 'Operação ilegal: suicídio de conta bloqueado.' }, 400);
    await db.delete(users).where(eq(users.id, c.req.param('id')));
    return c.json({ ok: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

export default usersRoutes;
