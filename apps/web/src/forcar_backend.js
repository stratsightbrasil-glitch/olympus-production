const fs = require('fs');
const path = require('path');

const destFile = path.join('D:', 'Pessoais', 'DEV', 'Olympus_v4', 'apps', 'api', 'src', 'routes', 'sessions.ts');

const code = `import { Hono } from 'hono';
import { db, projects, messages } from '@olympus/db';
import { eq, desc, asc, isNull, and } from 'drizzle-orm';
import { reloadCronJobs } from '../cron';

const sessionsRoutes = new Hono();

sessionsRoutes.get('/', async (c) => {
  try {
    const list = await db.query.projects.findMany({
      where: isNull(projects.deletedAt),
      orderBy: [desc(projects.updatedAt)]
    });
    return c.json(list);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

sessionsRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const projeto = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), isNull(projects.deletedAt))
    });
    if (!projeto) return c.json({ error: 'Sessão não encontrada' }, 404);

    const msgs = await db.query.messages.findMany({
      where: eq(messages.projectId, id),
      orderBy: [asc(messages.createdAt)]
    });

    return c.json({ ...projeto, mensagens: msgs });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

sessionsRoutes.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const existing = await db.query.projects.findFirst({ where: eq(projects.id, id) });
    if (existing) {
      await db.update(projects).set({ name: body.name, status: body.status, kratosCron: body.kratosCron, updatedBy: 'Analista Responsável', updatedAt: new Date() }).where(eq(projects.id, id));
    } else {
      await db.insert(projects).values({ id: id, name: body.name || 'Novo Projeto', status: body.status || 'Em produção', kratosCron: body.kratosCron || '0 6 * * *', methodology: 'MSEF', createdBy: 'Analista Responsável', updatedBy: 'Analista Responsável' });
    }
    reloadCronJobs();
    return c.json({ ok: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

sessionsRoutes.delete('/:id', async (c) => {
  try {
    await db.update(projects).set({ deletedAt: new Date(), deletedBy: 'Analista Responsável' }).where(eq(projects.id, c.req.param('id')));
    reloadCronJobs(); return c.json({ ok: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});
export default sessionsRoutes;`;

fs.writeFileSync(destFile, code, 'utf-8');
console.log('✅ Arquivo sessions.ts corrigido e gravado com sucesso!');
