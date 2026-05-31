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
import { db, projects, messages } from '@olympus/db';
import { eq } from 'drizzle-orm';
import { Command } from '@langchain/langgraph';
import { getOlympusGraph, graphConfig } from '../graph';
import { getLLMConfig, getLLMTiers } from './settings';
import { loadMethodology } from '../services/analysis.service';

// Re-exports mantidos para compatibilidade com settings.ts
export { invalidateMethodologyCache, getMethodologyCacheStatus } from '../services/analysis.service';

const chatRoutes = new Hono();

const SSE_MAX_BODY_BYTES = 512 * 1024;

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
  const metodologiaName = (body.metodologia as string) || 'MSEF';
  const projectName     = body.projectName || 'Novo Projeto';
  const vizMode         = body.vizMode || 'etapa';
  const userInput       = body.messages?.[body.messages.length - 1]?.content || '';
  const userInputStr    = typeof userInput === 'string'
    ? userInput
    : (Array.isArray(userInput) ? userInput.find((x: any) => x.type === 'text')?.text || '' : '');

  return streamSSE(c, async (stream) => {
    let hbTimer: ReturnType<typeof setInterval> | null = setInterval(() => {
      stream.writeSSE({ data: JSON.stringify({ type: 'ping' }) }).catch(() => {});
    }, 20_000);
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

      const [llmConfig, llmTiers] = await Promise.all([getLLMConfig(), getLLMTiers()]);
      const { phases, agentMethodPrompts: agentPromptMap } = await loadMethodology(metodologiaName);

      const projectRow = await db.query.projects.findFirst({
        columns: { connectivityMode: true },
        where: eq(projects.id, projectId),
      });
      const connectivityMode = (projectRow?.connectivityMode ?? process.env.CONNECTIVITY_MODE ?? 'ONLINE') as 'ONLINE' | 'SOBERANO' | 'AIR_GAPPED';

      const graph  = await getOlympusGraph();
      const config = graphConfig(projectId, {
        onStep:  (msg)   => write({ type: 'step',  text: msg }),
        onToken: (delta) => write({ type: 'token', text: delta }),
        onAgent: (name)  => write({ type: 'agent', agent: name }),
      });

      const initialState = {
        projectId, methodology: metodologiaName, connectivityMode,
        llmConfig, llmTiers, phases, agentMethodPrompts: agentPromptMap,
        userInput: userInputStr, vizMode,
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
          // Distingue interrupt de HITL (aprovação de eventos PYTHIA) de
          // interrupt de fase (modo passos) — o frontend trata ambos via hitl_gate
          await write({ ...iv, type: 'hitl_gate' });
          return;
        }
        for (const [, stateUpdate] of Object.entries(event)) {
          if (!stateUpdate || typeof stateUpdate !== 'object') continue;
          const upd = stateUpdate as any;
          if (upd.lastOutput)      finalOutput  = upd.lastOutput;
          if (upd.agentName)       finalAgent   = upd.agentName;
          if (upd.messageType)     finalMsgType = upd.messageType;
          if (upd.currentNodeSlug) await write({ type: 'status', text: `Fase '${upd.currentNodeSlug}' concluída.` });
        }
      }

      stopHb();
      if (!wasInterrupted) {
        await write({ type: 'agent', agent: finalAgent });
        await write({ type: 'done', text: finalOutput, agentName: finalAgent, messageType: finalMsgType });
      }

    } catch (err: any) {
      stopHb();
      const msg = err?.message || 'Erro interno no motor LangGraph.';
      console.error('[Graph SSE] Erro:', msg);
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
