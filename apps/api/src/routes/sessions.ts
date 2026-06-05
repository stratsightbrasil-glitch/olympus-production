import { Hono } from 'hono';
import { db, projects, messages, phaseOutputs, projectEvents, projectScenarios } from '@olympus/db';
import { clearCheckpointSql } from '../graph/postgresSaver';
import { eq, desc, asc, isNull, and, ilike, sql } from 'drizzle-orm';
import { reloadCronJobs, updateCronJob, removeCronJob } from '../cron';
import { getLLMConfig, getLLMTiers }   from './settings';
import { generateText }                from 'ai';
import { getModel }                    from '@olympus/core';

const sessionsRoutes = new Hono();

sessionsRoutes.get('/', async (c) => {
  try {
    const jwtPayload = c.get('jwtPayload') as any;
    const condition = jwtPayload?.role === 'admin'
      ? isNull(projects.deletedAt)
      : and(isNull(projects.deletedAt), eq(projects.createdBy, jwtPayload?.name || 'Sistema'));

    // Selecionar apenas as colunas necessárias para a listagem — evitar serializar
    // agentsConfig/techniquesConfig (JSONB grande) em cada item da sidebar.
    const list = await db.select({
      id:         projects.id,
      name:       projects.name,
      client:     projects.client,
      status:     projects.status,
      methodology:projects.methodology,
      updatedAt:  projects.updatedAt,
      createdAt:  projects.createdAt,
      createdBy:  projects.createdBy,
      kratosCron: projects.kratosCron,
      teamId:     projects.teamId,
      classification: projects.classification,
    }).from(projects)
      .where(condition)
      .orderBy(desc(projects.updatedAt))
      .limit(200); // hard cap — sem paginação ainda, mas previne O(N) runaway

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

    // Limitar mensagens — projetos maduros podem ter centenas; carregar tudo é desnecessário
    const msgs = await db.query.messages.findMany({
      where:   eq(messages.projectId, id),
      orderBy: [asc(messages.createdAt)],
      limit:   150,
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
      await db.insert(projects).values({ id: id, name: body.name || 'Novo Projeto', status: body.status || 'Em produção', kratosCron: body.kratosCron || '0 6 * * *', alertEmails: body.alertEmails || '', methodology: body.methodology || 'grumbach', createdBy: jwtPayload.name, updatedBy: jwtPayload.name });
    }
    // Atualização cirúrgica do cron do projeto específico — evita O(N) reloadCronJobs()
    // que parava e reiniciava TODOS os crons a cada PATCH de qualquer projeto.
    const isActive = (body.status ?? existing?.status) === 'Ativo';
    if (isActive && body.kratosCron) {
      updateCronJob(id, body.name ?? existing?.name ?? 'Projeto', body.methodology ?? existing?.methodology ?? '', body.kratosCron);
    } else if (!isActive) {
      removeCronJob(id);
    }
    return c.json({ ok: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

sessionsRoutes.delete('/:id', async (c) => {
  try {
    const jwtPayload = (c.get('jwtPayload') as any) || { name: 'Sistema' };
    const id = c.req.param('id');
    const existing = await db.query.projects.findFirst({ where: eq(projects.id, id) });
    if (!existing) return c.json({ error: 'Sessão não encontrada' }, 404);
    if (jwtPayload.role !== 'admin' && existing.createdBy !== jwtPayload.name) return c.json({ error: 'Acesso negado' }, 403);

    // Hard delete: apaga o projeto e TODOS os dados associados.
    // Backup é o mecanismo de recuperação — sem soft delete, sem dados órfãos.
    //
    // 1. Checkpoints do LangGraph (sem FK → não são cascadeados automaticamente)
    await clearCheckpointSql(id);
    // 2. Hard DELETE no projeto → CASCADE apaga automaticamente:
    //    messages, embeddings, project_events, project_scenarios, phase_outputs,
    //    indicators, weak_signals, analytic_reviews, matrix_direct_impacts, etc.
    await db.delete(projects).where(eq(projects.id, id));
    // 3. Para o CRON do projeto imediatamente (sem esperar o próximo ciclo)
    await reloadCronJobs();
    return c.json({ ok: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// GET /sessions/:id/messages — histórico de mensagens da sessão (server-authoritative)
// Usado pela UI para renderizar o chat e pelo runAnalysis para carregar memória.
// SEGURANÇA: aplica o mesmo filtro de ownership que GET /:id — previne IDOR.
sessionsRoutes.get('/:id/messages', async (c) => {
  try {
    const projectId = c.req.param('id');
    const jwtPayload = c.get('jwtPayload') as any;

    // Verifica ownership antes de expor mensagens
    const ownerCondition = jwtPayload?.role === 'admin'
      ? and(eq(projects.id, projectId), isNull(projects.deletedAt))
      : and(eq(projects.id, projectId), isNull(projects.deletedAt), eq(projects.createdBy, jwtPayload?.name || ''));

    const project = await db.query.projects.findFirst({ where: ownerCondition });
    if (!project) return c.json({ error: 'Sessão não encontrada' }, 404);

    const msgs = await db.query.messages.findMany({
      where: eq(messages.projectId, projectId),
      orderBy: [asc(messages.createdAt)],
    });
    return c.json(msgs);
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

    // Buscar diretamente a última mensagem do KRATOS — evitar carregar TODO o histórico
    // para fazer find() em JavaScript (potencialmente centenas de msgs desnecessárias).
    const kratosRows = await db.select({ content: messages.content })
      .from(messages)
      .where(and(
        eq(messages.projectId, id),
        eq(messages.role, 'assistant'),
        ilike(messages.content, '%KRATOS%'),
      ))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    const lastKratos = kratosRows[0] ? { content: kratosRows[0].content } : null;

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

// ── POST /parse-scope — extrai campos de escopo de um arquivo de texto ────────
// Recebe o texto extraído de um PDF/DOCX/TXT e retorna os 6 campos do formulário
// de nova sessão como JSON. Usa Gemini flash-lite para extração — chamada rápida
// e de baixo custo (~200 tokens de entrada + ~150 de saída).
sessionsRoutes.post('/parse-scope', async (c) => {
  const jwtPayload = c.get('jwtPayload') as any;
  if (!jwtPayload) return c.json({ error: 'Não autenticado.' }, 401);

  const body = await c.req.json() as any;
  const text: string = body.text || '';
  if (!text.trim()) return c.json({ error: 'Campo "text" obrigatório.' }, 400);
  if (text.length > 30_000) return c.json({ error: 'Texto muito longo (máx 30k chars).' }, 400);

  try {
    const [llmConfig, llmTiers] = await Promise.all([getLLMConfig(), getLLMTiers()]);
    const economyModel = getModel({
      provider: llmConfig.provider,
      model: llmTiers?.['economy'] ?? llmConfig.model,
    });

    const prompt = `Analise o documento abaixo e extraia os campos de escopo analítico.
Retorne APENAS um objeto JSON válido com exatamente estas chaves (strings, sem markdown):

{
  "tema": "tema/objeto da análise",
  "horizonte": "horizonte temporal",
  "elaborador": "quem elabora / organização responsável",
  "cliente": "usuário ou cliente da análise",
  "questaoEstrategica": "questão estratégica central",
  "mudancaIdentificada": "mudança específica já identificada"
}

Mapeamento de campos (case-insensitive):
- "Tema", "Tema / objeto", "Objeto" → tema
- "Horizonte", "Horizonte temporal" → horizonte
- "Quem elabora", "Elaborador", "Organização" → elaborador
- "Usuário", "Cliente", "Público-alvo", "Destinatário" → cliente
- "Questão estratégica", "Questão central", "Pergunta focal" → questaoEstrategica
- "Mudança", "Mudança identificada", "Mudança específica" → mudancaIdentificada

Se um campo não for encontrado, deixe a string vazia.
Responda APENAS com o JSON, sem comentários, sem markdown.

DOCUMENTO:
${text.slice(0, 8000)}`;

    const { text: llmOutput } = await generateText({
      model:          economyModel,
      prompt,
      maxOutputTokens: 400,
    });

    // Extrair JSON da resposta (pode ter markdown ```json ou texto em volta)
    const jsonMatch = llmOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return c.json({ error: 'LLM não retornou JSON válido.' }, 500);

    const parsed = JSON.parse(jsonMatch[0]);
    return c.json({
      tema:                parsed.tema               || '',
      horizonte:           parsed.horizonte          || '',
      elaborador:          parsed.elaborador         || '',
      cliente:             parsed.cliente            || '',
      questaoEstrategica:  parsed.questaoEstrategica || '',
      mudancaIdentificada: parsed.mudancaIdentificada || '',
    });
  } catch (e: any) {
    return c.json({ error: `Erro ao extrair escopo: ${e.message}` }, 500);
  }
});

export default sessionsRoutes;