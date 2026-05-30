/**
 * analysis.service.ts — Núcleo de análise multi-agente do OLYMPUS
 *
 * Contém toda a lógica de negócio extraída de chat.ts (T-10 Sprint 20):
 *   • Janela de memória deslizante (buildMemoryWindow)
 *   • Cache e carregamento de metodologias (loadMethodology)
 *   • Fábrica da ferramenta consultar_agente (createConsultAgentTool)
 *   • Execução completa de uma análise (runAnalysis)
 *
 * chat.ts é responsável apenas pelo transporte HTTP/SSE.
 */

import { Orchestrator, Agent, AgentContext, Tool } from '@olympus/core';
import { db, projects, messages, agents as agentsTable, methodologyPhases, agentMethodPrompts, projectEvents } from '@olympus/db';
import { tavilySearchTool, dadosPublicosTool } from '@olympus/tools';
import { ragTool } from '../tools/rag';
import { createSignalTools } from '../tools/signals';
import { createAnalyticStandardsTools } from '../tools/analytic-standards';
import { createAnalyticalEngineTools } from '../tools/analytical-engines';
import { getTechniqueInstructions } from '../tools/technique-engine';
import { generateReportTemplateInstructions } from './report-compiler';
import { getLLMConfig, getLLMTiers } from '../routes/settings';
import { eq, inArray, and, asc } from 'drizzle-orm';

// ─── Janela de memória ────────────────────────────────────────────────────────

const MEMORY_TOKEN_BUDGET    = 32_000;
const MEMORY_WINDOW_MESSAGES = 20; // aumentado de 10 → 20 para cobrir análises de 8+ fases em passos

function estimateTokens(content: any): number {
  if (!content) return 0;
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  return Math.ceil(text.length / 4);
}

export function buildMemoryWindow(msgs: any[]): any[] {
  const candidates = msgs.slice(0, -1);
  if (candidates.length === 0) return [];
  const first = candidates[0];
  const rest = candidates.slice(1).reverse();
  const window: any[] = [];
  let tokens = Math.min(estimateTokens(first?.content), 4_000);
  for (const msg of rest) {
    const t = estimateTokens(msg.content);
    if (tokens + t > MEMORY_TOKEN_BUDGET) break;
    window.unshift(msg);
    tokens += t;
  }
  if (first && !window.includes(first)) window.unshift(first);
  if (window.length > MEMORY_WINDOW_MESSAGES + 1) {
    return [window[0], ...window.slice(-(MEMORY_WINDOW_MESSAGES))];
  }
  return window;
}

// ─── Cache e carregamento de metodologias ────────────────────────────────────

interface MethodologyCache { data: Awaited<ReturnType<typeof _loadMethodologyFromDb>>; expiresAt: number; }
const methodologyCache = new Map<string, MethodologyCache>();
const METHODOLOGY_CACHE_TTL_MS = 5 * 60 * 1000;

export async function loadMethodology(slug: string) {
  const now = Date.now();
  const cached = methodologyCache.get(slug);
  if (cached && now < cached.expiresAt) return cached.data;
  const data = await _loadMethodologyFromDb(slug);
  methodologyCache.set(slug, { data, expiresAt: now + METHODOLOGY_CACHE_TTL_MS });
  return data;
}

async function _loadMethodologyFromDb(slug: string) {
  const method = await db.query.methodologies.findFirst({
    where: (t, { or, eq: eqFn }) => or(
      eqFn(t.slug, slug.toLowerCase()),
      eqFn(t.name, slug)
    )
  });
  if (!method) {
    throw new Error(
      `Metodologia '${slug}' não encontrada no banco. Execute 'npm run seed' antes de iniciar uma análise.`
    );
  }

  const [phases, promptJoinRows] = await Promise.all([
    db.select()
      .from(methodologyPhases)
      .where(eq(methodologyPhases.methodologyId, method.id))
      .orderBy(methodologyPhases.phaseNum),
    db.select({
        agentName:         agentsTable.name,
        extraInstructions: agentMethodPrompts.extraInstructions,
      })
      .from(agentMethodPrompts)
      .innerJoin(agentsTable, eq(agentsTable.id, agentMethodPrompts.agentId))
      .where(eq(agentMethodPrompts.methodologyId, method.id)),
  ]);

  const promptMap: Record<string, string> = Object.fromEntries(
    promptJoinRows.map(r => [r.agentName, r.extraInstructions])
  );

  return { method, phases, agentMethodPrompts: promptMap };
}

export function invalidateMethodologyCache(): void {
  methodologyCache.clear();
}

export function getMethodologyCacheStatus(): { entries: number; oldestEntryAt: string | null; ttlSeconds: number } {
  const entries = methodologyCache.size;
  let oldest: number | null = null;
  for (const v of methodologyCache.values()) {
    const createdAt = v.expiresAt - METHODOLOGY_CACHE_TTL_MS;
    if (oldest === null || createdAt < oldest) oldest = createdAt;
  }
  return {
    entries,
    oldestEntryAt: oldest !== null ? new Date(oldest).toISOString() : null,
    ttlSeconds: METHODOLOGY_CACHE_TTL_MS / 1000,
  };
}

// ─── Fábrica da ferramenta consultar_agente ───────────────────────────────────

type ApprovedEventRow = {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  sourceEvaluation: any;
};

export function createConsultAgentTool(
  agentNames: string[],
  phaseCounts: Record<string, number>,
  approvedEvents: ApprovedEventRow[] = [],
): Tool<any> {
  const consultAgentSchema = {
    type: 'object',
    properties: {
      agent_name: {
        type: 'string',
        enum: agentNames,
        description: 'Nome do agente especialista a ser consultado.'
      },
      query: {
        type: 'string',
        description: 'A pergunta ou tarefa que o agente deve resolver. MÁXIMO 300 CARACTERES para especialistas analíticos. Para ATHENA em produção: inclua o conteúdo essencial do especialista (fontes, julgamentos, premissas, cenários) — sem limite de tamanho.',
      }
    },
    required: ['agent_name', 'query']
  };

  const callCounts: Record<string, number> = {};

  return {
    name: 'consultar_agente',
    description: 'Delega uma pesquisa ou tarefa para um agente especialista da equipe. Use isso SEMPRE que precisar repassar uma etapa.',
    schema: consultAgentSchema as any,
    execute: async (args, context) => {
      if (!context.dispatch) throw new Error("Orquestrador indisponível.");

      if (!agentNames.includes(args.agent_name)) {
        console.warn(`[Orquestração] ⚠️ HERMES tentou acionar agente inválido: ${args.agent_name}`);
        return `[ERRO DE SISTEMA]: O agente '${args.agent_name}' não está registrado na metodologia atual. Os agentes disponíveis são: ${agentNames.join(', ')}. Escolha o especialista correto e chame a ferramenta novamente.`;
      }

      if (process.env.TEST_MODE === 'true' && args.agent_name !== 'ATHENA') {
        callCounts[args.agent_name] = (callCounts[args.agent_name] ?? 0) + 1;
        const maxAllowed = phaseCounts[args.agent_name] ?? 1;
        if (callCounts[args.agent_name] > maxAllowed) {
          console.warn(`[Orquestração] 🚫 TEST_MODE — ${args.agent_name} chamado ${callCounts[args.agent_name]}× (limite: ${maxAllowed}). Avance para a próxima fase.`);
          return `[TESTE — LIMITE DE FASE]: ${args.agent_name} já foi chamado ${maxAllowed} vez(es) nesta análise (1 por fase). Avance agora para o próximo agente da sequência.`;
        }
      }

      let dispatchQuery = args.query;
      if (args.agent_name === 'ATHENA' && process.env.TEST_MODE === 'true' && args.query.length > 400) {
        dispatchQuery = args.query.slice(0, 400) + `\n[TRECHO TRUNCADO — MODO TESTE: ATHENA auto-aprova sem ler o conteúdo completo]`;
        console.log(`[Orquestração] ✂️ TEST_MODE — query ATHENA truncada de ${args.query.length} para 400 chars.`);
      }
      if (args.agent_name === 'ATHENA' && process.env.TEST_MODE !== 'true' && approvedEvents.length > 0) {
        const mpcLines = approvedEvents.map(e => {
          const ev = e.sourceEvaluation as any;
          const mpc = (ev?.reliability && ev?.credibility)
            ? ` [MPC:${ev.reliability}${ev.credibility}]`
            : '';
          return `  · ${e.name} (${e.type ?? 'evento'})${mpc}: ${e.description ?? '(sem descrição)'}`;
        });
        dispatchQuery =
          args.query +
          `\n\n╔══ METADADOS ESTRUTURADOS DO PROJETO (banco de dados) ══╗\n` +
          `Registros aprovados pelo analista humano (${mpcLines.length} itens):\n` +
          mpcLines.join('\n') +
          `\n╚════════════════════════════════════════════════════════╝`;
        console.log(`[Orquestração] 🔬 ATHENA receberá ${mpcLines.length} registros MPC do banco para auditoria de ATS 1.`);
      }

      console.log(`[Orquestração] Acionando especialista ${args.agent_name} para: "${args.query.slice(0, 120)}..."`);
      const start = Date.now();
      try {
        const result = await context.dispatch(args.agent_name, dispatchQuery);
        console.log(`[Orquestração] ✅ ${args.agent_name} concluiu em ${Date.now() - start}ms retornando ${result.length} caracteres.`);
        return `[ANÁLISE DE ${args.agent_name}]:\n${result}\n\n[INSTRUÇÃO CRÍTICA AO ORQUESTRADOR]: Transcreva os dados, análises e estatísticas acima para o usuário com extrema riqueza de detalhes. NÃO resuma excessivamente e NÃO omita fontes.`;
      } catch (err: any) {
        console.error(`[Orquestração] ❌ Erro fatal no agente ${args.agent_name}:`, err.message);
        return `Erro interno ao consultar o agente ${args.agent_name}. Informe o usuário. Detalhes: ${err.message}`;
      }
    }
  };
}

// ─── Núcleo de análise ────────────────────────────────────────────────────────

export interface AnalysisCallbacks {
  onStatus: (text: string) => void;
  onAgent:  (name: string) => void;
  onToken?: (delta: string) => void;
  onStep?:  (msg: string) => void;
}

export async function runAnalysis(body: any, jwtPayload: any, cb: AnalysisCallbacks, opts: { skipMessageSave?: boolean } = {}) {
  const projectId       = body.projectId || body.id || `sess_${Date.now()}`;
  const rawInputMsg     = body.messages?.[body.messages.length - 1]?.content || '';
  const vizMode         = body.vizMode || 'etapa';
  const metodologiaName = (body.metodologia as string) || 'MSEF';
  const projectName     = body.projectName || 'Novo Projeto';
  const teamId          = body.teamId || null;
  const [llmConfig, llmTiers] = await Promise.all([getLLMConfig(), getLLMTiers()]);

  const inputMsgStr = typeof rawInputMsg === 'string'
    ? rawInputMsg
    : (Array.isArray(rawInputMsg) ? rawInputMsg.find((c: any) => c.type === 'text')?.text || '' : '');
  const isMultimodal = Array.isArray(rawInputMsg);

  let thinkingContent = '';

  const existingProject = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!existingProject) {
    await db.insert(projects).values({
      id: projectId, name: projectName, methodology: metodologiaName,
      teamId: teamId || undefined,
      createdBy: jwtPayload.name, updatedBy: jwtPayload.name
    });
  } else if (existingProject.name !== projectName || existingProject.methodology !== metodologiaName) {
    const upd: any = { name: projectName, methodology: metodologiaName, updatedBy: jwtPayload.name };
    if (teamId) upd.teamId = teamId;
    await db.update(projects).set(upd).where(eq(projects.id, projectId));
  }

  if (inputMsgStr && !opts.skipMessageSave) {
    await db.insert(messages).values({ projectId, role: 'user', content: inputMsgStr });
  }

  cb.onStatus('Carregando contexto...');
  const [dbMessages, approvedEvents, methodologyData] = await Promise.all([
    db.query.messages.findMany({
      where: eq(messages.projectId, projectId),
      orderBy: [asc(messages.createdAt)],
      limit: 200,
    }),
    db
      .select({
        id: projectEvents.id,
        name: projectEvents.name,
        description: projectEvents.description,
        type: projectEvents.type,
        sourceEvaluation: projectEvents.sourceEvaluation,
      })
      .from(projectEvents)
      .where(and(eq(projectEvents.projectId, projectId), eq(projectEvents.status, "approved"))),
    loadMethodology(metodologiaName),
  ]);
  const dbMessagesForMemory = dbMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const connectivityMode = (
    existingProject?.connectivityMode ?? process.env.CONNECTIVITY_MODE ?? "ONLINE"
  ) as "ONLINE" | "SOBERANO" | "AIR_GAPPED";

  let anchorContext = "";
  if (approvedEvents.length > 0) {
    const byType = (t: string) => approvedEvents.filter(e => e.type === t);
    const fmt = (e: typeof approvedEvents[0]) => {
      const ev = e.sourceEvaluation as any;
      const mpc = ev ? ` [MPC:${ev.reliability}${ev.credibility}]` : "";
      return `· ${e.name}: ${e.description}${mpc}`;
    };
    const trends     = byType("trend");
    const uncerts    = byType("uncertainty");
    const inflections = byType("inflection_factor");
    const fpfs       = byType("fpf");
    anchorContext = [
      "=== ÂNCORA DE CONTEXTO — DADOS APROVADOS PELO ANALISTA (IMUTÁVEIS) ===",
      trends.length     ? `\nTENDÊNCIAS ESTRUTURANTES (${trends.length}):\n${trends.map(fmt).join("\n")}` : "",
      uncerts.length    ? `\nINCERTEZAS CRÍTICAS / EVENTOS BOOLEANOS (${uncerts.length}):\n${uncerts.map(fmt).join("\n")}` : "",
      inflections.length ? `\nFATORES DE INFLEXÃO GEOPOLÍTICA (${inflections.length}):\n${inflections.map(fmt).join("\n")}` : "",
      fpfs.length       ? `\nFATOS PORTADORES DE FUTURO — GRUMBACH (${fpfs.length}):\n${fpfs.map(fmt).join("\n")}` : "",
      `\nMODO DE CONECTIVIDADE: ${connectivityMode}`,
      connectivityMode === "AIR_GAPPED" ? "⚠️ AIR_GAPPED: ferramentas de busca externa PROIBIDAS." : "",
      connectivityMode === "SOBERANO"   ? "⚠️ SOBERANO: usar RAG interno. Não expor intenção analítica." : "",
      "\n=======================================================================",
    ].filter(Boolean).join("");
  }

  const { method, phases, agentMethodPrompts: agentPromptMap } = methodologyData;
  if (!method.agentsConfig) {
    throw new Error(`Metodologia '${metodologiaName}' sem agentes configurados. Verifique o seed.`);
  }

  const rawCfg = method.agentsConfig;
  let requiredAgentNames: string[];
  if (Array.isArray(rawCfg)) {
    requiredAgentNames = rawCfg as string[];
  } else if (rawCfg && typeof rawCfg === 'object' && Array.isArray((rawCfg as any).agents)) {
    requiredAgentNames = (rawCfg as any).agents as string[];
  } else {
    throw new Error(`agentsConfig inválido para metodologia '${metodologiaName}'.`);
  }
  const dbAgents = await db.query.agents.findMany({ where: inArray(agentsTable.name, requiredAgentNames) });
  if (dbAgents.length === 0) {
    throw new Error(`Nenhum agente encontrado no banco para a metodologia '${metodologiaName}'.`);
  }

  const sistema = new Orchestrator('OLYMPUS');
  let orchestratorName = 'HERMES';

  const expertNames = dbAgents.filter(a => a.type === 'expert').map(a => a.name);
  const phaseCounts: Record<string, number> = {};
  for (const p of phases) {
    const role = (p as any).agentRole as string;
    phaseCounts[role] = (phaseCounts[role] ?? 0) + 1;
  }
  const dynamicConsultTool = expertNames.length > 0
    ? createConsultAgentTool(expertNames, phaseCounts, approvedEvents)
    : null;

  const { registrarSinal, buscarSinais, atualizarSentinela } = createSignalTools(projectId);
  const { declararJulgamento, registrarHipoteseAlternativa, avaliarFonte } = createAnalyticStandardsTools(projectId);
  const analyticalEngineTools = createAnalyticalEngineTools(projectId);

  const availableTools: Record<string, Tool<any>> = {
    'web_search':                       tavilySearchTool,
    'buscar_dados_publicos':            dadosPublicosTool,
    'buscar_documentos_internos':       ragTool,
    'registrar_sinal':                  registrarSinal,
    'buscar_sinais':                    buscarSinais,
    'atualizar_sentinela':              atualizarSentinela,
    'declarar_julgamento':              declararJulgamento,
    'registrar_hipotese_alternativa':   registrarHipoteseAlternativa,
    'avaliar_fonte':                    avaliarFonte,
    'tool_register_event':              analyticalEngineTools['tool_register_event'] as any,
    'tool_register_impact_relation':    analyticalEngineTools['tool_register_impact_relation'] as any,
    'tool_grumbach_expert_simulation':  analyticalEngineTools['tool_grumbach_expert_simulation'] as any,
    'tool_register_scenario':           analyticalEngineTools['tool_register_scenario'] as any,
  };
  if (dynamicConsultTool) availableTools['consultar_agente'] = dynamicConsultTool;

  for (const ag of dbAgents) {
    if (ag.type === 'orchestrator') orchestratorName = ag.name;
    const toolsForAgent: Tool<any>[] = [];
    if (ag.toolsConfig) {
      let parsedTools: string[] = [];
      try {
        const parsed = typeof ag.toolsConfig === 'string' ? JSON.parse(ag.toolsConfig) : ag.toolsConfig;
        if (Array.isArray(parsed)) parsedTools = parsed;
      } catch { parsedTools = []; }
      for (const tName of parsedTools) {
        if (availableTools[tName]) toolsForAgent.push(availableTools[tName]);
      }
    }

    let agentPrompt = ag.systemPrompt;

    if (process.env.TEST_MODE === 'true' && ag.name === 'ATHENA') {
      agentPrompt =
        `[MODO TESTE — APROVAÇÃO AUTOMÁTICA]\n` +
        `Retorne APENAS: "APROVADO — avance para a próxima fase."\n` +
        `Não faça auditoria, não emita ressalvas, não chame ferramentas.\n`;
    }

    if (process.env.TEST_MODE === 'true' && ag.type === 'orchestrator') {
      agentPrompt = agentPrompt + `\n\n` +
        `[⚠️ MODO TESTE ATIVO — ESTAS INSTRUÇÕES REVOGAM TODOS OS PROTOCOLOS ANTERIORES]\n` +
        `Você está em modo de teste automatizado. As regras abaixo têm PRIORIDADE ABSOLUTA:\n` +
        `1. PROTOCOLO DE QUALIDADE — REGRA CORRETA DE ATHENA: Chame ATHENA UMA ÚNICA VEZ ao CONCLUIR cada fase completa. ` +
        `NÃO chame ATHENA após cada chamada individual de especialista dentro da mesma fase. ` +
        `Se uma fase exige o mesmo especialista múltiplas vezes, chame ATHENA apenas DEPOIS da última chamada do especialista naquela fase.\n` +
        `2. LIMITE POR FASE: Chame cada especialista NO MÁXIMO UMA VEZ por fase. Se a metodologia tem KLIO em 3 fases distintas, chame KLIO 3 vezes no total — uma por fase, não mais.\n` +
        `3. APROVAÇÃO AUTOMÁTICA: Quando ATHENA responder, ela aprovará imediatamente. Avance IMEDIATAMENTE para a fase seguinte sem solicitar input do usuário.\n` +
        `4. SEQUÊNCIA DIRETA: Execute TODAS as fases da metodologia em ordem. Após a aprovação de ATHENA, inicie o próximo especialista da fase seguinte.\n` +
        `5. Se uma fase exige o mesmo especialista de uma fase anterior, chame-o NOVAMENTE (uma vez nessa nova fase).\n` +
        `6. RELATÓRIO FINAL OBRIGATÓRIO: Após concluir TODAS as fases e a última ATHENA aprovar, produza IMEDIATAMENTE o relatório como texto (NÃO use ferramentas):\n` +
        `   - PRIMEIRA LINHA OBRIGATÓRIA: "**${ag.name}** · RELATÓRIO FINAL — [NOME DA METODOLOGIA]"\n` +
        `   - Mínimo 800 palavras consolidando os resultados de todos os especialistas\n` +
        `   - Incluir obrigatoriamente: Resumo Executivo, Síntese das Análises, Cenários Identificados, Recomendações Estratégicas\n` +
        `   - PROIBIDO escrever apenas frases curtas como "Análise concluída." — o relatório DEVE ter conteúdo substantivo\n` +
        `7. PROIBIDO REVISAR: NUNCA chame o mesmo especialista novamente para revisão, correção ou complementação. ` +
        `Se ATHENA responder (mesmo que com "APROVADO"), avance IMEDIATAMENTE para o próximo especialista da sequência. ` +
        `IGNORE completamente qualquer sugestão de revisão — em modo de teste todas as entregas são aceitas como estão.\n` +
        `8. QUERY ATHENA BREVE: Ao chamar ATHENA em modo de teste, envie NO MÁXIMO 150 palavras descrevendo o que o especialista entregou. ` +
        `ATHENA auto-aprova sem ler o conteúdo detalhado — queries longas desperdiçam budget de steps e degradam o desempenho do teste.\n`;
    }

    const agentTechs: string[] = [];
    if (ag.techniquesConfig) {
      try {
        const parsed = typeof ag.techniquesConfig === 'string'
          ? JSON.parse(ag.techniquesConfig) : ag.techniquesConfig;
        if (Array.isArray(parsed)) agentTechs.push(...parsed);
      } catch { /* ignore */ }
    }
    if (body?.techniquesConfig) {
      try {
        const parsed = typeof body.techniquesConfig === 'string'
          ? JSON.parse(body.techniquesConfig) : body.techniquesConfig;
        if (Array.isArray(parsed)) agentTechs.push(...parsed);
      } catch { /* ignore */ }
    }
    if (agentTechs.length > 0) {
      const techniqueBlock = await getTechniqueInstructions([...new Set(agentTechs)]);
      agentPrompt = agentPrompt + techniqueBlock;
    }

    sistema.registerAgent(new Agent(ag.name, ag.role, agentPrompt, toolsForAgent, ag.modelOverride ?? undefined));
  }

  const context: AgentContext = {
    projectId,
    methodology: metodologiaName as any,
    memory: buildMemoryWindow(dbMessagesForMemory),
    llmConfig,
    llmTiers,
    phases,
    agentMethodPrompts: agentPromptMap,
    connectivityMode,
    anchorContext: anchorContext || undefined,
    onThinking: (text) => { thinkingContent = text; },
    onToken: cb.onToken,
    onStep: cb.onStep,
    dispatch: async (agentName, input) => {
      cb.onAgent(agentName);
      const expertInput = typeof input === 'string'
        ? input + '\n\n[⚠️ INSTRUÇÃO CRÍTICA]: Você é um especialista. Você DEVE OBRIGATORIAMENTE invocar sua ferramenta "web_search" agora mesmo para buscar dados reais. Formule uma query CURTA E CONCISA (máximo 100 caracteres). Não tente responder sem pesquisar na internet!'
        : input;
      return await sistema.dispatch(agentName, expertInput, { ...context, memory: [], onToken: undefined }, 'etapa');
    }
  };

  let finalInputMsg: any = rawInputMsg;
  let modeInstruction = '';

  const isTestMode = process.env.TEST_MODE === 'true';

  // Bug B fix: em vizMode=passos, injetar contexto de fase no "CONFIRMAR"
  // Após muitas fases, buildMemoryWindow pode descartar mensagens antigas e HERMES
  // perde o rastreio de onde está. Injetar a fase atual evita o reinício do SCOPUS.
  if (
    vizMode === 'passos' &&
    !isTestMode &&
    typeof inputMsgStr === 'string' &&
    inputMsgStr.trim().toUpperCase() === 'CONFIRMAR'
  ) {
    const assistantMsgCount = dbMessages.filter(m => m.role === 'assistant').length;
    const totalPhases = phases.length;
    const currentPhase = Math.min(assistantMsgCount + 1, totalPhases);
    const isLastPhase = currentPhase >= totalPhases;
    const phaseCtx = isLastPhase
      ? `\n\n[CONTEXTO DO SISTEMA — Fase ${totalPhases}/${totalPhases} concluída. Execute o RELATÓRIO FINAL da metodologia agora.]`
      : `\n\n[CONTEXTO DO SISTEMA — Fase ${currentPhase}/${totalPhases} aprovada. Prosseguir para Fase ${currentPhase + 1}: "${phases[currentPhase]?.label ?? 'próxima fase'}". NÃO reiniciar do início.]`;
    finalInputMsg = inputMsgStr + phaseCtx;
  }
  const toolPlanningBlock = isTestMode ? '' : `\n\n[PROTOCOLO DE PLANEJAMENTO DE FASE]
Antes de acionar cada especialista via consultar_agente, elabore o PLANO DE FASE:
1. Ferramentas/SAT MANDATÓRIAS pela metodologia ativa para esta fase
2. Ferramentas/SAT RECOMENDADAS dado o tema específico em análise (não só as mais comuns)
3. Proposta de abordagem resumida (1-2 linhas)
${vizMode === 'passos'
  ? 'Apresente o plano ao usuário. Termine com: "✅ Confirme para prosseguir | 🔄 Oriente com ajustes". Só execute após resposta explícita.'
  : 'Registre o plano como "[PLANO] Fase X — Ferramentas: [lista]" e prossiga IMEDIATAMENTE sem aguardar o usuário.'}`;

  if (vizMode === 'passos') {
    modeInstruction = '\n\n[INSTRUÇÃO DE MODO — PASSO A PASSO SUPERVISIONADO]\nAvance UMA fase por vez. Aguarde confirmação ou orientação do usuário antes de prosseguir para a próxima fase após receber o plano aprovado.';
  } else if (vizMode === 'passagem') {
    modeInstruction = '\n\n[INSTRUÇÃO DE MODO: Processo completo autônomo. Conduza todo o método continuamente sem interrupção.]';
  } else if (vizMode === 'thinking') {
    modeInstruction = '\n\n[INSTRUÇÃO DE MODO: Raciocínio estendido — profundidade máxima antes da resposta final.]';
  }

  modeInstruction += toolPlanningBlock;
  modeInstruction += '\n\n[⚠️ REGRA CRÍTICA DE FERRAMENTAS]: Se a solicitação exigir que você inicie uma etapa do método, delegue para um especialista (ex: SCOPUS) ou pesquise na web, VOCÊ É OBRIGADO a invocar a ferramenta correspondente AGORA MESMO. É absolutamente PROIBIDO responder apenas com um texto dizendo "Vou delegar", "Iniciando a etapa" ou "Aguarde". Você DEVE emitir a chamada da ferramenta neste exato turno!';

  if (isMultimodal) {
    const textPart = (finalInputMsg as any[]).find((c: any) => c.type === 'text');
    if (textPart) textPart.text += modeInstruction;
  } else {
    finalInputMsg = (finalInputMsg as string) + modeInstruction;
  }

  if (isTestMode) {
    const testAppend =
      `\n\n[INSTRUÇÃO OBRIGATÓRIA DE TESTE — RELATÓRIO FINAL]\n` +
      `Após concluir TODAS as fases da metodologia e a última ATHENA aprovar, escreva imediatamente o RELATÓRIO FINAL (texto direto, sem ferramentas):\n` +
      `- PRIMEIRA LINHA: "**HERMES** · RELATÓRIO FINAL — [nome da metodologia]"\n` +
      `- Mínimo 600 palavras com: Resumo Executivo | Análise | Cenários | Recomendações\n` +
      `- PROIBIDO encerrar com "Análise concluída." — o relatório DEVE ter conteúdo substantivo.`;
    if (isMultimodal) {
      const textPart = (finalInputMsg as any[]).find((c: any) => c.type === 'text');
      if (textPart) textPart.text += testAppend;
    } else {
      finalInputMsg = (finalInputMsg as string) + testAppend;
    }
  }

  if (!isTestMode) {
    const reportLayout = (body as any).reportLayout ?? 'standard';
    const reportInstructions = generateReportTemplateInstructions(metodologiaName, reportLayout);
    if (reportInstructions) {
      const structureBlock =
        `\n\n[ESTRUTURA OBRIGATÓRIA DO RELATÓRIO FINAL — ${metodologiaName.toUpperCase()}]\n` +
        reportInstructions;
      if (isMultimodal) {
        const textPart = (finalInputMsg as any[]).find((c: any) => c.type === 'text');
        if (textPart) textPart.text += structureBlock;
      } else {
        finalInputMsg = (finalInputMsg as string) + structureBlock;
      }
      console.log(`[ReportCompiler] Estrutura ${reportLayout} injetada para metodologia: ${metodologiaName}`);
    }
  }

  cb.onStatus('Orquestrando análise...');
  console.log(`[Orquestração] Aguardando síntese final do Orquestrador (${orchestratorName})...`);
  let responseText = await sistema.dispatch(orchestratorName, finalInputMsg, context, vizMode);
  console.log(`[Orquestração] 🎉 Resposta final gerada com ${responseText.length} caracteres.`);

  if (!responseText.includes(`**${orchestratorName}**`) && !responseText.includes(`${orchestratorName} ·`)) {
    responseText = `**${orchestratorName}** · \n\n${responseText}`;
  }

  const REPORT_PATTERNS = [
    'RELATÓRIO FINAL PADRÃO', 'RELATÓRIO FINAL', 'RELATÓRIO DE CENÁRIOS',
    'RELATÓRIO ESTRATÉGICO', 'RELATÓRIO PROSPECTIVO',
    'RAPPORT PROSPECTIF GODET', 'RAPPORT PROSPECTIF',
    'RELATÓRIO GRUMBACH', 'RELATÓRIO SIEX',
    'PRODUTO ALTA FINAL', 'PRODUTO ALTA',
  ];
  const isOrchestratorFinal =
    REPORT_PATTERNS.some(p => responseText.includes(p)) ||
    (responseText.length > 1500 && responseText.includes(`**${orchestratorName}**`));
  const messageType =
    orchestratorName === 'KRATOS' ? 'monitoramento'
    : orchestratorName === 'ATHENA' ? 'revisao'
    : isOrchestratorFinal          ? 'relatorio_final'
    : 'parcial';

  await db.insert(messages).values({
    projectId,
    role: 'assistant',
    content: responseText,
    agentName: orchestratorName,
    messageType,
  });

  return { responseText, agentName: orchestratorName, thinkingContent, projectId, messageType };
}
