import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { db, projects, messages } from '@olympus/db';
import { eq } from 'drizzle-orm';
import { Command } from '@langchain/langgraph';
import { getOlympusGraph, graphConfig } from '../graph';
import { getLLMConfig, getLLMTiers } from './settings';
import { runAnalysis, loadMethodology, AnalysisCallbacks } from '../services/analysis.service';

// Re-export for cron.ts and settings.ts compatibility
export { runAnalysis, invalidateMethodologyCache, getMethodologyCacheStatus } from '../services/analysis.service';
export type { AnalysisCallbacks } from '../services/analysis.service';

const chatRoutes = new Hono();

// ── Rota síncrona (compatibilidade retroativa) ────────────────────────────────
chatRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const jwtPayload = (c.get('jwtPayload') as any) || { name: 'Sistema' };
    if (jwtPayload?.role === 'cliente') return c.json({ error: 'Acesso negado.' }, 403);
    const result = await runAnalysis(body, jwtPayload, { onStatus: () => {}, onAgent: () => {} });
    return c.json({ role: 'assistant', content: [{ type: 'text', text: result.responseText }],
      text: result.responseText, agentName: result.agentName, thinking: result.thinkingContent });
  } catch (error: any) {
    const msg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
    return c.json({ error: { message: msg || 'Erro interno do servidor' } }, 500);
  }
});

// ── Rota SSE — progresso em tempo real ──────────────────────────────────────
const SSE_MAX_BODY_BYTES = 512 * 1024;

chatRoutes.post('/stream', async (c) => {
  const contentLength = Number(c.req.header('content-length') ?? 0);
  if (contentLength > SSE_MAX_BODY_BYTES) {
    return c.json({ error: `Payload excede o limite permitido (${SSE_MAX_BODY_BYTES / 1024} KB).` }, 413);
  }
  const body = await c.req.json();
  const jwtPayload = (c.get('jwtPayload') as any) || { name: 'Sistema' };
  if (jwtPayload?.role === 'cliente') return c.json({ error: 'Acesso negado.' }, 403);

  return streamSSE(c, async (stream) => {
    const MAX_RETRIES = 4;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = setInterval(() => {
      stream.writeSSE({ data: JSON.stringify({ type: 'ping' }) }).catch(() => {});
    }, 20_000);
    const stopHeartbeat = () => { if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; } };

    const isOverloadError        = (err: any) => err?.message?.toLowerCase().includes('overload') || err?.errors?.some((e: any) => e?.statusCode === 529) || err?.lastError?.statusCode === 529;
    const isToolsNotSupportedError = (err: any) => err?.message?.toLowerCase().includes('does not support tools') || err?.data?.error?.message?.toLowerCase().includes('does not support tools');

    let lastError: any = null;
    let messageSaved = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt === 1) {
          await stream.writeSSE({ data: JSON.stringify({ type: 'status', text: 'Iniciando análise...' }) });
        } else {
          const delaySec = attempt * 8;
          await stream.writeSSE({ data: JSON.stringify({ type: 'status', text: `Servidor sobrecarregado. Nova tentativa em ${delaySec}s (${attempt}/${MAX_RETRIES})...` }) });
          await new Promise(r => setTimeout(r, delaySec * 1000));
          await stream.writeSSE({ data: JSON.stringify({ type: 'status', text: `Tentativa ${attempt}/${MAX_RETRIES} em andamento...` }) });
        }

        const callbacks: AnalysisCallbacks = {
          onStatus: (text) => { stream.writeSSE({ data: JSON.stringify({ type: 'status', text }) }); },
          onAgent:  (name) => { stream.writeSSE({ data: JSON.stringify({ type: 'agent', agent: name }) }); },
          onToken:  (delta) => { stream.writeSSE({ data: JSON.stringify({ type: 'token', text: delta }) }); },
          onStep:   (msg)  => { stream.writeSSE({ data: JSON.stringify({ type: 'step', text: msg }) }); },
        };

        const result = await runAnalysis(body, jwtPayload, callbacks, { skipMessageSave: messageSaved });
        messageSaved = true;

        stopHeartbeat();
        await stream.writeSSE({ data: JSON.stringify({ type: 'agent', agent: result.agentName }) });
        await stream.writeSSE({ data: JSON.stringify({ type: 'done', text: result.responseText, agentName: result.agentName, thinking: result.thinkingContent, messageType: result.messageType }) });
        return;

      } catch (error: any) {
        lastError = error;
        messageSaved = true;

        if (isOverloadError(error) && attempt < MAX_RETRIES) {
          console.warn(`[SSE] Anthropic sobrecarregado (tentativa ${attempt}/${MAX_RETRIES}). Aguardando antes de retry...`);
          continue;
        }

        stopHeartbeat();
        if (isToolsNotSupportedError(error)) {
          const model = error?.data?.error?.message?.match(/library\/([^:]+:[^"]+)/)?.[1] ?? error?.message?.match(/library\/([^:]+:[^"]+)/)?.[1] ?? 'modelo selecionado';
          await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: `O modelo "${model}" não suporta chamadas de ferramentas (tools). Use modelos compatíveis como llama3.x, qwen2.x, mistral-nemo, phi4 ou deepseek-r1.` }) });
          return;
        }

        const msg = error?.message || 'Erro interno do servidor';
        console.error('[SSE] Erro:', msg);
        await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: msg }) });
        return;
      }
    }

    stopHeartbeat();
    const msg = lastError?.message || 'Servidor sobrecarregado. Tente novamente em alguns instantes.';
    console.error('[SSE] Esgotadas todas as tentativas:', msg);
    await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: msg }) });
  });
});

// ── Rota Graph SSE — LangGraph v2.0 ─────────────────────────────────────────
chatRoutes.post('/stream/graph', async (c) => {
  const contentLength = Number(c.req.header('content-length') ?? 0);
  if (contentLength > SSE_MAX_BODY_BYTES) {
    return c.json({ error: `Payload excede o limite permitido (${SSE_MAX_BODY_BYTES / 1024} KB).` }, 413);
  }
  const body            = await c.req.json();
  const jwtPayload      = (c.get('jwtPayload') as any) || { name: 'Sistema' };
  const projectId       = body.projectId || body.id || `sess_${Date.now()}`;
  const isResuming      = !!body.isResuming;
  const metodologiaName = (body.metodologia as string) || 'MSEF';
  const projectName     = body.projectName || 'Novo Projeto';
  const vizMode         = body.vizMode || 'etapa';
  const userInput       = body.messages?.[body.messages.length - 1]?.content || '';
  const userInputStr    = typeof userInput === 'string' ? userInput : (Array.isArray(userInput) ? userInput.find((c: any) => c.type === 'text')?.text || '' : '');

  return streamSSE(c, async (stream) => {
    let hbTimer: ReturnType<typeof setInterval> | null = setInterval(() => {
      stream.writeSSE({ data: JSON.stringify({ type: 'ping' }) }).catch(() => {});
    }, 20_000);
    const stopHb = () => { if (hbTimer) { clearInterval(hbTimer); hbTimer = null; } };
    const write  = (obj: object) => stream.writeSSE({ data: JSON.stringify(obj) }).catch(() => {});

    try {
      await write({ type: 'status', text: 'Iniciando motor LangGraph...' });

      const existingProject = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
      if (!existingProject) {
        await db.insert(projects).values({ id: projectId, name: projectName, methodology: metodologiaName, createdBy: jwtPayload.name, updatedBy: jwtPayload.name });
      }

      if (userInputStr && !isResuming) {
        await db.insert(messages).values({ projectId, role: 'user', content: userInputStr });
      }

      const [llmConfig, llmTiers] = await Promise.all([getLLMConfig(), getLLMTiers()]);
      const { method, phases, agentMethodPrompts: agentPromptMap } = await loadMethodology(metodologiaName);

      const projectRow = await db.query.projects.findFirst({ columns: { connectivityMode: true }, where: eq(projects.id, projectId) });
      const connectivityMode = (projectRow?.connectivityMode ?? process.env.CONNECTIVITY_MODE ?? 'ONLINE') as 'ONLINE' | 'SOBERANO' | 'AIR_GAPPED';

      const graph  = await getOlympusGraph();
      const config = graphConfig(projectId, {
        onStep:  (msg) => write({ type: 'step', text: msg }),
        onToken: (delta) => write({ type: 'token', text: delta }),
      });

      const initialState = { projectId, methodology: metodologiaName, connectivityMode, llmConfig, llmTiers, phases, agentMethodPrompts: agentPromptMap, userInput: userInputStr, vizMode };
      const graphInput = isResuming ? new Command({ resume: userInputStr || 'continuar' }) : initialState;

      await write({ type: 'status', text: 'Executando grafo de análise...' });

      let finalOutput = '', finalAgent = '', finalMsgType = 'parcial', wasInterrupted = false;
      const graphStream = await graph.stream(graphInput as any, { ...config, streamMode: 'updates' });

      for await (const event of graphStream) {
        if ('__interrupt__' in event) {
          const iv = Array.isArray((event as any)['__interrupt__']) ? (event as any)['__interrupt__'][0]?.value : (event as any)['__interrupt__'];
          wasInterrupted = true;
          stopHb();
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
      if (!wasInterrupted) await write({ type: 'done', text: finalOutput, agentName: finalAgent, messageType: finalMsgType });

    } catch (err: any) {
      stopHb();
      const msg = err?.message || 'Erro interno no motor LangGraph.';
      console.error('[Graph SSE] Erro:', msg);
      await write({ type: 'error', message: msg });
    }
  });
});

export default chatRoutes;
