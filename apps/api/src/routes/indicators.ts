import { Hono } from 'hono';
import { db, indicators } from '@olympus/db';
import { eq } from 'drizzle-orm';

const indicatorsRoutes = new Hono();

// Listar indicadores de um projeto (Usado pelo Painel e pelo KRATOS)
indicatorsRoutes.get('/project/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const list = await db.query.indicators.findMany({
      where: eq(indicators.projectId, projectId)
    });
    return c.json(list);
  } catch (e: any) { 
    return c.json({ error: e.message }, 500); 
  }
});

// Criar ou atualizar indicadores (Usado pelo KRATOS após análise)
indicatorsRoutes.post('/', async (c) => {
  try {
    const body = (await c.req.json()) as any;
    const items = Array.isArray(body) ? body : [body];
    
    for (const item of items) {
      if (item.id) {
        await db.update(indicators).set({
          name: item.name,
          source: item.fonte,
          status: item.status,
          lastValue: item.ultimoValor,
          parametersJson: {
            yellowThreshold: item.limiarAmarelo,
            redThreshold: item.limiarVermelho
          },
          lastCheckedAt: new Date()
        }).where(eq(indicators.id, item.id));
      } else {
        await db.insert(indicators).values({
          projectId: item.projectId,
          name: item.name,
          source: item.fonte,
          status: item.status || 'verde',
          lastValue: item.ultimoValor,
          parametersJson: {
            yellowThreshold: item.limiarAmarelo,
            redThreshold: item.limiarVermelho
          },
          lastCheckedAt: new Date()
        });
      }
    }
    
    return c.json({ ok: true });
  } catch (e: any) { 
    return c.json({ error: e.message }, 500); 
  }
});

export default indicatorsRoutes;