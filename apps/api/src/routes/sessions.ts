import { Hono } from 'hono';
import { db, projects, messages } from '@olympus/db';
import { eq, desc, asc, isNull, and } from 'drizzle-orm';
import { reloadCronJobs } from '../cron';

const sessionsRoutes = new Hono();

sessionsRoutes.get('/', async (c) => {
  try {
    const jwtPayload = c.get('jwtPayload') as any;
    const condition = jwtPayload?.role === 'admin' 
      ? isNull(projects.deletedAt) 
      : and(isNull(projects.deletedAt), eq(projects.createdBy, jwtPayload?.name || 'Sistema'));

    const list = await db.query.projects.findMany({
      where: condition,
      orderBy: [desc(projects.updatedAt)]
    });
    return c.json(list);
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

sessionsRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const jwtPayload = c.get('jwtPayload') as any;
    const condition = jwtPayload?.role === 'admin'
      ? and(eq(projects.id, id), isNull(projects.deletedAt))
      : and(eq(projects.id, id), isNull(projects.deletedAt), eq(projects.createdBy, jwtPayload?.name || 'Sistema'));

    const projeto = await db.query.projects.findFirst({
      where: condition
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
    const body = (await c.req.json()) as any;
    const jwtPayload = (c.get('jwtPayload') as any) || { name: 'Sistema' };
    
    const existing = await db.query.projects.findFirst({ where: eq(projects.id, id) });
    if (existing) {
      if (jwtPayload.role !== 'admin' && existing.createdBy !== jwtPayload.name) return c.json({ error: 'Acesso negado' }, 403);
      await db.update(projects).set({ name: body.name, status: body.status, kratosCron: body.kratosCron, alertEmails: body.alertEmails ?? existing.alertEmails, methodology: body.methodology, updatedBy: jwtPayload.name, updatedAt: new Date() }).where(eq(projects.id, id));
    } else {
      await db.insert(projects).values({ id: id, name: body.name || 'Novo Projeto', status: body.status || 'Em produção', kratosCron: body.kratosCron || '0 6 * * *', alertEmails: body.alertEmails || '', methodology: 'MSEF', createdBy: jwtPayload.name, updatedBy: jwtPayload.name });
    }
    reloadCronJobs();
    return c.json({ ok: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

sessionsRoutes.delete('/:id', async (c) => {
  try {
    const jwtPayload = (c.get('jwtPayload') as any) || { name: 'Sistema' };
    const existing = await db.query.projects.findFirst({ where: eq(projects.id, c.req.param('id')) });
    if (!existing) return c.json({ error: 'Sessão não encontrada' }, 404);
    if (jwtPayload.role !== 'admin' && existing.createdBy !== jwtPayload.name) return c.json({ error: 'Acesso negado' }, 403);

    await db.update(projects).set({ deletedAt: new Date(), deletedBy: jwtPayload.name }).where(eq(projects.id, c.req.param('id')));
    reloadCronJobs(); return c.json({ ok: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

sessionsRoutes.delete('/:id/messages/:msgId', async (c) => {
  try {
    const projectId = c.req.param('id');
    const msgId = c.req.param('msgId');
    const jwtPayload = (c.get('jwtPayload') as any) || { name: 'Sistema' };
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) return c.json({ error: 'Projeto não encontrado' }, 404);
    if (jwtPayload.role !== 'admin' && project.createdBy !== jwtPayload.name) return c.json({ error: 'Acesso negado' }, 403);
    await db.delete(messages).where(and(eq(messages.id, msgId), eq(messages.projectId, projectId)));
    return c.json({ ok: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

sessionsRoutes.post('/:id/webhook', async (c) => {
  try {
    const id = c.req.param('id');
    const jwtPayload = (c.get('jwtPayload') as any) || { name: 'Sistema' };
    const projeto = await db.query.projects.findFirst({ where: eq(projects.id, id) });
    if (!projeto) return c.json({ error: 'Projeto não encontrado' }, 404);

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) return c.json({ error: 'N8N_WEBHOOK_URL não configurada no .env' }, 400);

    const msgs = await db.query.messages.findMany({
      where: eq(messages.projectId, id),
      orderBy: [desc(messages.createdAt)]
    });
    const lastKratos = msgs.find(m => m.role === 'assistant' && m.content.toUpperCase().includes('KRATOS'));

    const payload = {
      projetoId: projeto.id,
      projetoNome: projeto.name,
      cliente: projeto.client,
      status: projeto.status,
      analista: projeto.analyst || jwtPayload.name,
      ultimaAnaliseKratos: lastKratos ? lastKratos.content : 'Nenhuma análise do KRATOS encontrada.',
      timestamp: new Date().toISOString()
    };

    const response = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`n8n retornou erro HTTP ${response.status}`);

    return c.json({ ok: true, message: 'Webhook disparado' });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

export default sessionsRoutes;