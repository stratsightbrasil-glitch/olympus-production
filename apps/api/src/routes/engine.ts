import { Hono } from 'hono';
import { db, tools, techniques, agents, methodologies } from '@olympus/db';

const engineRoutes = new Hono();

// Bloqueio de Segurança: Apenas Administradores podem instalar novos motores
engineRoutes.use('*', async (c, next) => {
  if (c.req.method !== 'GET') {
    const payload = c.get('jwtPayload') as any;
    if (!payload || payload.role !== 'admin') {
      return c.json({ error: 'Acesso negado. Apenas Administradores podem instalar metodologias.' }, 403);
    }
  }
  await next();
});

// Endpoint de Upload/Instalação do Motor (engine.json)
engineRoutes.post('/install', async (c) => {
  try {
    const payload = await c.req.json();

    // 1. Instala/Atualiza Ferramentas
    if (payload.tools && Array.isArray(payload.tools)) {
      for (const t of payload.tools) {
        await db.insert(tools).values({
          name: t.name,
          description: t.description,
          schemaJson: t.schemaJson
        }).onConflictDoUpdate({
          target: tools.name,
          set: { description: t.description, schemaJson: t.schemaJson }
        });
      }
    }

    // 2. Instala/Atualiza Técnicas (SATs)
    if (payload.techniques && Array.isArray(payload.techniques)) {
      for (const t of payload.techniques) {
        await db.insert(techniques).values({
          name: t.name,
          description: t.description,
          instructions: t.instructions,
          toolsConfig: t.toolsConfig || []
        }).onConflictDoUpdate({
          target: techniques.name,
          set: { description: t.description, instructions: t.instructions, toolsConfig: t.toolsConfig || [] }
        });
      }
    }

    // 3. Instala/Atualiza Agentes
    if (payload.agents && Array.isArray(payload.agents)) {
      for (const a of payload.agents) {
        await db.insert(agents).values({
          name: a.name,
          role: a.role,
          type: a.type || 'expert',
          systemPrompt: a.systemPrompt,
          toolsConfig: a.toolsConfig || [],
          techniquesConfig: a.techniquesConfig || []
        }).onConflictDoUpdate({
          target: agents.name,
          set: { role: a.role, type: a.type || 'expert', systemPrompt: a.systemPrompt, toolsConfig: a.toolsConfig || [], techniquesConfig: a.techniquesConfig || [] }
        });
      }
    }

    // 4. Instala/Atualiza Metodologias
    if (payload.methodologies && Array.isArray(payload.methodologies)) {
      for (const m of payload.methodologies) {
        await db.insert(methodologies).values({
          name: m.name,
          description: m.description,
          category: m.category || 'Cenários Prospectivos',
          isDefault: m.isDefault || false,
          agentsConfig: m.agentsConfig || []
        }).onConflictDoUpdate({
          target: methodologies.name,
          set: { description: m.description, category: m.category || 'Cenários Prospectivos', isDefault: m.isDefault || false, agentsConfig: m.agentsConfig || [] }
        });
      }
    }

    return c.json({ ok: true, message: `Pacote '${payload.packageName || 'Desconhecido'}' instalado com sucesso!` });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Endpoint para listar as metodologias disponíveis
engineRoutes.get('/methodologies', async (c) => {
  try {
    const list = await db.query.methodologies.findMany();
    return c.json(list);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default engineRoutes;