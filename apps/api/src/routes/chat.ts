/**
 * chat.ts — Transporte HTTP/SSE para o motor de análise LangGraph.
 *
 * Sprint 21 (31 Mai 2026) — MOTOR ÚNICO LANGGRAPH:
 *   As rotas POST / e POST /stream (motor runAnalysis) foram REMOVIDAS.
 *   Toda a análise passa exclusivamente pelo LangGraph via POST /stream/graph.
 *   Os quatro modos (passos, etapa, passagem, thinking) são configurações do grafo.
 *   Ver historico_migracao.md §Sprint21 para detalhes da decisão arquitetural.
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { db, projects, messages, phaseOutputs, projectEvents, projectScenarios } from '@olympus/db';
import { eq, lt, asc, and } from 'drizzle-orm';
import { Command } from '@langchain/langgraph';
import { getOlympusGraph, graphConfig } from '../graph';
import { getPostgresSaver, clearCheckpointSql } from '../graph/postgresSaver';
import { getLLMConfig, getLLMTiers } from './settings';
import { loadMethodology } from '../services/analysis.service';
import { loadPhaseConfigs } from '../graph/phase-context';

// Re-exports mantidos para compatibilidade com settings.ts
export { invalidateMethodologyCache, getMethodologyCacheStatus } from '../services/analysis.service';

const chatRoutes = new Hono();

const SSE_MAX_BODY_BYTES = 512 * 1024;

// ── GET /status/:projectId — consulta checkpointer para interrupt pendente ───
// Deve preceder qualquer rota com parâmetro genérico para evitar interceptação.
chatRoutes.get('/status/:projectId', async (c) => {
  const jwtPayload = (c.get('jwtPayload') as any) || {};
  if (jwtPayload?.role === 'cliente') return c.json({ status: 'idle' });

  const { projectId } = c.req.param();
  try {
    const graph  = await getOlympusGraph();
    const config = { configurable: { thread_id: projectId } };
    const state  = await graph.getState(config);

    const pendingTasks = (state as any).tasks ?? [];
    const hasInterrupt = pendingTasks.some(
      (t: any) => Array.isArray(t.interrupts) && t.interrupts.length > 0
    );

    if (!hasInterrupt) return c.json({ status: 'idle' });

    const iv = pendingTasks
      .flatMap((t: any) => t.interrupts ?? [])
      .find(Boolean);
    const val = iv?.value ?? {};

    return c.json({
      status:        'interrupted',
      interruptType: val.interruptType ?? 'hitl_required',
      agent:         val.agent         ?? 'KLIO',
      message:       val.message       ?? 'Análise pausada. Retome quando pronto.',
      projectId,
    });
  } catch {
    return c.json({ status: 'idle' });
  }
});

// ── Rota SSE — motor LangGraph (único caminho de análise) ────────────────────
chatRoutes.post('/stream/graph', async (c) => {
  const contentLength = Number(c.req.header('content-length') ?? 0);
  if (contentLength > SSE_MAX_BODY_BYTES) {
    return c.json({ error: `Payload excede o limite permitido (${SSE_MAX_BODY_BYTES / 1024} KB).` }, 413);
  }
  const body            = await c.req.json();
  const jwtPayload      = (c.get('jwtPayload') as any) || { name: 'Sistema' };
  if (jwtPayload?.role === 'cliente') return c.json({ error: 'Acesso negado.' }, 403);

  const projectId       = body.projectId || body.id || `sess_${Date.now()}`;
  const isResuming      = !!body.isResuming;
  // 'grumbach' = único com PHASE_CONFIGS implementados em Olympus 1.0.
  // 'MSEF' foi removida do banco no seed — usar 'grumbach' como fallback seguro.
  const metodologiaName = (body.metodologia as string) || 'grumbach';
  const projectName     = body.projectName || 'Novo Projeto';
  const vizMode         = body.vizMode || 'etapa';
  const userInput       = body.messages?.[body.messages.length - 1]?.content || '';
  const userInputStr    = typeof userInput === 'string'
    ? userInput
    : (Array.isArray(userInput) ? userInput.find((x: any) => x.type === 'text')?.text || '' : '');

  return streamSSE(c, async (stream) => {
    let hbTimer: ReturnType<typeof setInterval> | null = setInterval(() => {
      stream.writeSSE({ data: JSON.stringify({ type: 'ping' }) }).catch(() => {});
    }, 15_000);
    const stopHb = () => { if (hbTimer) { clearInterval(hbTimer); hbTimer = null; } };
    const write  = (obj: object) => stream.writeSSE({ data: JSON.stringify(obj) }).catch(() => {});

    try {
      await write({ type: 'status', text: 'Iniciando motor LangGraph...' });

      // Garante que o projeto existe no banco
      const existingProject = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
      if (!existingProject) {
        await db.insert(projects).values({
          id: projectId, name: projectName, methodology: metodologiaName,
          createdBy: jwtPayload.name, updatedBy: jwtPayload.name,
          ...(body.teamId ? { teamId: body.teamId } : {}),
        });
      } else if (existingProject.name !== projectName || existingProject.methodology !== metodologiaName) {
        await db.update(projects).set({ name: projectName, methodology: metodologiaName, updatedBy: jwtPayload.name })
          .where(eq(projects.id, projectId));
      }

      // Salva mensagem do usuário (não salva em retomadas HITL)
      if (userInputStr && !isResuming) {
        await db.insert(messages).values({ projectId, role: 'user', content: userInputStr });
      }

      // Limpa checkpoint e phase_outputs ao iniciar NOVA análise.
      // SEMPRE usa clearCheckpointSql (SQL direto) — o método checkpointer.delete()
      // do @langchain/langgraph-checkpoint-postgres@1.0.1 não limpa checkpoint_writes,
      // deixando writes pendentes que causam replay indevido e crash (502 no SSE).
      if (!isResuming) {
        // Início de NOVA análise: limpa TUDO do projeto.
        // project_events crítico: buildAnchorCtx() os carrega e contamina o tema.
        await clearCheckpointSql(projectId);
        await db.delete(phaseOutputs).where(eq(phaseOutputs.projectId, projectId));
        await db.delete(projectEvents).where(eq(projectEvents.projectId, projectId));
        await db.delete(projectScenarios).where(eq(projectScenarios.projectId, projectId));
        console.log(`[chat] Análise anterior limpa para ${projectId}`);
      } else {
        // RESUME (HITL ou retomada): purga apenas eventos contaminados de runs anteriores.
        //
        // ATENÇÃO: NÃO usar firstOutput.createdAt como cutoff.
        // Motivo: events de phase 1 são criados DURANTE agent.run() (antes de phase_output
        // ser escrito), então lt(createdAt, firstOutput.createdAt) deletaria events
        // legítimos de phase 1, quebrando o Delphi e Impact Cross que dependem desses FPFs.
        //
        // Estratégia correta:
        //   - Se há phase_outputs: eventos 'approved' são intocáveis (o analista os aprovou).
        //     Deletar apenas eventos 'proposed' criados há mais de 1 hora (contaminação antiga).
        //   - Se não há phase_outputs: a análise nunca completou uma fase; limpar tudo.
        const hasPhaseOutputs = await db.query.phaseOutputs.findFirst({
          where:   eq(phaseOutputs.projectId, projectId),
          columns: { id: true },
        });
        if (hasPhaseOutputs) {
          // Deletar apenas proposed stale (> 1h): não tocar em approved (aprovados pelo analista)
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          await db.delete(projectEvents).where(
            and(
              eq(projectEvents.projectId, projectId),
              eq(projectEvents.status, 'proposed' as any),
              lt(projectEvents.createdAt, oneHourAgo)
            )
          );
          console.log(`[chat] Resume: proposed events > 1h removidos para ${projectId} (approved preservados)`);
        } else {
          // Sem phase_outputs: análise nunca completou uma fase — limpa tudo
          await db.delete(projectEvents).where(eq(projectEvents.projectId, projectId));
          console.log(`[chat] Resume sem phase_outputs: todos os events removidos para ${projectId}`);
        }
      }

      const [llmConfig, llmTiers] = await Promise.all([getLLMConfig(), getLLMTiers()]);
      const { method, phases, agentMethodPrompts: agentPromptMap } = await loadMethodology(metodologiaName);
      // Usa o slug canônico do banco (não o valor bruto do frontend).
      const methodologySlug = method.slug ?? metodologiaName;

      // Carrega total de fases para o roteador (Sprint 24 — fases no banco).
      // Lança erro descritivo se a metodologia não tem systemPromptInject configurado.
      const phaseConfigs  = await loadPhaseConfigs(methodologySlug);
      const totalPhases   = phaseConfigs.length;

      const projectRow = await db.query.projects.findFirst({
        columns: { connectivityMode: true },
        where: eq(projects.id, projectId),
      });
      const connectivityMode = (projectRow?.connectivityMode ?? process.env.CONNECTIVITY_MODE ?? 'ONLINE') as 'ONLINE' | 'SOBERANO' | 'AIR_GAPPED';

      const graph  = await getOlympusGraph();
      const config = graphConfig(projectId, {
        onStep:   (msg)  => write({ type: 'step',   text: msg }),
        onToken:  (delta)=> write({ type: 'token',  text: delta }),
        onAgent:  (name) => write({ type: 'agent',  agent: name }),
        onAthena: (data) => write({ type: 'athena', ...data }),
      });

      const initialState = {
        projectId,
        methodology:       methodologySlug,
        connectivityMode,
        llmConfig, llmTiers, phases, agentMethodPrompts: agentPromptMap,
        userInput: userInputStr, vizMode,
        totalPhases,          // total de fases para o roteador (Sprint 24)
        currentNodeSlug:   null as string | null,
        currentPhaseIndex: null as number | null,
      };
      const graphInput = isResuming
        ? new Command({ resume: userInputStr || 'continuar' })
        : initialState;

      await write({ type: 'status', text: 'Executando grafo de análise...' });

      let finalOutput = '', finalAgent = '', finalMsgType = 'parcial', wasInterrupted = false;
      const graphStream = await graph.stream(graphInput as any, { ...config, streamMode: 'updates' });

      for await (const event of graphStream) {
        if ('__interrupt__' in event) {
          const iv = Array.isArray((event as any)['__interrupt__'])
            ? (event as any)['__interrupt__'][0]?.value
            : (event as any)['__interrupt__'];
          wasInterrupted = true;
          stopHb();
          // Ambos os tipos de interrupt (hitl_required e phase_complete)
          // são enviados como hitl_gate — o frontend usa resumeGraph() para ambos
          await write({ ...iv, type: 'hitl_gate' });
          return;
        }
        for (const [, stateUpdate] of Object.entries(event)) {
          if (!stateUpdate || typeof stateUpdate !== 'object') continue;
          const upd = stateUpdate as any;
          if (upd.lastOutput)        finalOutput  = upd.lastOutput;
          if (upd.agentName)         finalAgent   = upd.agentName;
          if (upd.messageType)       finalMsgType = upd.messageType;
          if (upd.currentNodeSlug)   await write({ type: 'status', text: `Fase '${upd.currentNodeSlug}' concluída.` });
          if (upd.currentPhaseIndex) await write({ type: 'status', text: `Fase ${upd.currentPhaseIndex} concluída.` });
        }
      }

      stopHb();
      if (!wasInterrupted) {
        await write({ type: 'agent', agent: finalAgent });
        await write({ type: 'done', text: finalOutput, agentName: finalAgent, messageType: finalMsgType });
      }

    } catch (err: any) {
      stopHb();
      const raw = err?.message || 'Erro interno no motor LangGraph.';

      // ── Mensagens amigáveis para erros transitórios de API ────────────────
      // Erros 503 (alta demanda) e 429 (rate limit) são temporários e recuperáveis.
      // O status do checkpoint é preservado — o analista pode retomar após aguardar.
      const is503 = raw.includes('high demand') || raw.includes('UNAVAILABLE') ||
                    raw.includes('temporarily unavailable') || raw.includes('overloaded') ||
                    err?.lastError?.statusCode === 503 ||
                    (err?.errors ?? []).some((e: any) => e?.statusCode === 503);

      const is429 = raw.includes('rate limit') || raw.includes('quota') ||
                    raw.includes('RESOURCE_EXHAUSTED') ||
                    err?.lastError?.statusCode === 429 ||
                    (err?.errors ?? []).some((e: any) => e?.statusCode === 429);

      // SDK lança isso quando o stream não produz saída (normalmente após 503)
      const isNoOutput = raw === 'No output generated. Check the stream for errors.';

      let msg = raw;
      if (is503 || isNoOutput) {
        msg = '⏳ O modelo de IA está temporariamente sobrecarregado (Google 503). '
            + 'A análise foi preservada — aguarde 1-2 minutos e tente retomar.';
      } else if (is429) {
        msg = '⚠️ Limite de requisições da API atingido. '
            + 'Aguarde alguns minutos e tente novamente.';
      }

      console.error('[Graph SSE] Erro:', raw);
      await write({ type: 'error', message: msg });
    }
  });
});

// ── Alias retroativo: /stream redireciona para /stream/graph ─────────────────
// Mantido para compatibilidade com clientes legados até próximo deploy.
chatRoutes.post('/stream', async (c) => {
  c.req.raw.headers; // sem modificação
  return c.json({
    error: 'O endpoint /stream foi migrado para /stream/graph (Sprint 21 — Motor LangGraph-first). Atualize o cliente.',
    upgrade: '/api/v1/chat/stream/graph',
  }, 410);
});

export default chatRoutes;
