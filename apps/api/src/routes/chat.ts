import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { Orchestrator, Agent, AgentContext, Tool } from '@olympus/core';
import { db, projects, messages, agents as agentsTable, methodologyPhases, agentMethodPrompts, projectEvents } from '@olympus/db';
import { tavilySearchTool, dadosPublicosTool } from '@olympus/tools';
import { ragTool } from '../tools/rag';
import { createSignalTools } from '../tools/signals';
import { createAnalyticStandardsTools } from '../tools/analytic-standards';
import { createAnalyticalEngineTools } from '../tools/analytical-engines';
import { getTechniqueInstructions } from '../tools/technique-engine';
import { getLLMConfig, getLLMTiers } from './settings';
import { eq, inArray, and, asc } from 'drizzle-orm';
import { Command } from '@langchain/langgraph';
import { getOlympusGraph, graphConfig } from '../graph';

const chatRoutes = new Hono();

// ── T6: Janela de memória — Buffer deslizante anti-Bola-de-Neve ──────────────
// Mantém a primeira mensagem (âncora do projeto) + as N mais recentes.
// Limita o custo que cresce exponencialmente com o histórico de análises.
const MEMORY_TOKEN_BUDGET    = 32_000; // reduzido de 80K
const MEMORY_WINDOW_MESSAGES = 10;     // máx. mensagens no janela (além da âncora)

/** Estima tokens de uma mensagem — suporta content string e array (multimodal). */
function estimateTokens(content: any): number {
  if (!content) return 0;
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  return Math.ceil(text.length / 4);
}

function buildMemoryWindow(msgs: any[]): any[] {
  const candidates = msgs.slice(0, -1); // exclui a mensagem corrente
  if (candidates.length === 0) return [];
  const first = candidates[0];
  const rest = candidates.slice(1).reverse();
  const window: any[] = [];
  // Pin da primeira mensagem — cap em 4 000 tokens para evitar bloat de imagens
  let tokens = Math.min(estimateTokens(first?.content), 4_000);
  for (const msg of rest) {
    const t = estimateTokens(msg.content);
    if (tokens + t > MEMORY_TOKEN_BUDGET) break;
    window.unshift(msg);
    tokens += t;
  }
  if (first && !window.includes(first)) window.unshift(first);
  // Cap duro: âncora + no máximo MEMORY_WINDOW_MESSAGES recentes.
  if (window.length > MEMORY_WINDOW_MESSAGES + 1) {
    return [window[0], ...window.slice(-(MEMORY_WINDOW_MESSAGES))];
  }
  return window;
}

// ============================================================================
// MOTOR NORMALIZADO — loadMethodology() — única fonte de verdade
// Todas as metodologias devem existir no banco (seed.ts).
// Lança erro se não encontrada — sem auto-seed em runtime.
// ============================================================================

// Cache de metodologia com TTL de 5 min — dados imutáveis em runtime.
// Evita 3 queries ao banco em cada requisição de análise.
interface MethodologyCache { data: Awaited<ReturnType<typeof _loadMethodologyFromDb>>; expiresAt: number; }
const methodologyCache = new Map<string, MethodologyCache>();
const METHODOLOGY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

async function loadMethodology(slug: string) {
  const now = Date.now();
  const cached = methodologyCache.get(slug);
  if (cached && now < cached.expiresAt) return cached.data;
  const data = await _loadMethodologyFromDb(slug);
  methodologyCache.set(slug, { data, expiresAt: now + METHODOLOGY_CACHE_TTL_MS });
  return data;
}

async function _loadMethodologyFromDb(slug: string) {
  // Normaliza: permite buscar por nome ou slug
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

  // phases e promptRows não dependem um do outro — busca em paralelo
  const [phases, promptRows] = await Promise.all([
    db.select()
      .from(methodologyPhases)
      .where(eq(methodologyPhases.methodologyId, method.id))
      .orderBy(methodologyPhases.phaseNum),
    db.select({
        agentId:           agentMethodPrompts.agentId,
        extraInstructions: agentMethodPrompts.extraInstructions,
      })
      .from(agentMethodPrompts)
      .where(eq(agentMethodPrompts.methodologyId, method.id)),
  ]);

  // Resolver agentId → agentName
  const promptMap: Record<string, string> = {};
  if (promptRows.length > 0) {
    const agentIds = promptRows.map(p => p.agentId);
    const agentNames = await db
      .select({ id: agentsTable.id, name: agentsTable.name })
      .from(agentsTable)
      .where(inArray(agentsTable.id, agentIds));
    const nameMap = Object.fromEntries(agentNames.map(a => [a.id, a.name]));
    for (const p of promptRows) {
      const name = nameMap[p.agentId];
      if (name) promptMap[name] = p.extraInstructions;
    }
  }

  return { method, phases, agentMethodPrompts: promptMap };
}

// ============================================================================
// FÁBRICA DINÂMICA DE FERRAMENTAS
// ============================================================================

function createConsultAgentTool(agentNames: string[]): Tool<any> {
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
        description: 'A pergunta ou tarefa que o agente deve resolver. MÁXIMO 300 CARACTERES. Seja objetivo e conciso para evitar limites de texto.'
      }
    },
    required: ['agent_name', 'query']
  };

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

      console.log(`[Orquestração] Acionando especialista ${args.agent_name} para: "${args.query}"`);
      const start = Date.now();
      try {
        const result = await context.dispatch(args.agent_name, args.query);
        console.log(`[Orquestração] ✅ ${args.agent_name} concluiu em ${Date.now() - start}ms retornando ${result.length} caracteres.`);
        return `[ANÁLISE DE ${args.agent_name}]:\n${result}\n\n[INSTRUÇÃO CRÍTICA AO ORQUESTRADOR]: Transcreva os dados, análises e estatísticas acima para o usuário com extrema riqueza de detalhes. NÃO resuma excessivamente e NÃO omita fontes.`;
      } catch (err: any) {
        console.error(`[Orquestração] ❌ Erro fatal no agente ${args.agent_name}:`, err.message);
        return `Erro interno ao consultar o agente ${args.agent_name}. Informe o usuário. Detalhes: ${err.message}`;
      }
    }
  };
}

// ============================================================================
// NÚCLEO DA ANÁLISE — compartilhado entre rota síncrona, SSE e cron KRATOS
// Exportado para permitir chamada direta pelo cron (evita self-minting de JWT).
// ============================================================================

export interface AnalysisCallbacks {
  onStatus: (text: string) => void;
  onAgent:  (name: string) => void;
  onToken?: (delta: string) => void;
  /** Emite mensagem de progresso de step (tool calls, síntese) */
  onStep?:  (msg: string) => void;
}

export async function runAnalysis(body: any, jwtPayload: any, cb: AnalysisCallbacks, opts: { skipMessageSave?: boolean } = {}) {
  const projectId     = body.projectId || body.id || `sess_${Date.now()}`;
  const rawInputMsg   = body.messages?.[body.messages.length - 1]?.content || '';
  const vizMode       = body.vizMode || 'etapa';
  const metodologiaName = (body.metodologia as string) || 'MSEF';
  const projectName   = body.projectName || 'Novo Projeto';
  const teamId        = body.teamId || null;
  const [llmConfig, llmTiers] = await Promise.all([
    getLLMConfig(),   // modelo global ativo (padrão: Haiku em dev, Sonnet/Opus em prod via env)
    getLLMTiers(),    // mapa { economy: '<id>', premium: '<id>' } — padrão Haiku para ambos
  ]);

  const inputMsgStr = typeof rawInputMsg === 'string'
    ? rawInputMsg
    : (Array.isArray(rawInputMsg) ? rawInputMsg.find((c: any) => c.type === 'text')?.text || '' : '');
  const isMultimodal = Array.isArray(rawInputMsg);

  let thinkingContent = '';

  // 1. Garante que o projeto existe no banco
  // Paraleliza: lookup do projeto + início do carregamento de metodologia (não depende um do outro)
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

  // 2. Salva a mensagem do usuário (ignorado em retentativas para evitar duplicatas)
  if (inputMsgStr && !opts.skipMessageSave) {
    await db.insert(messages).values({ projectId, role: 'user', content: inputMsgStr });
  }

  // 2b–2d. Carrega histórico, eventos aprovados e metodologia em paralelo.
  //   • dbMessages: inclui a mensagem recém-salva como último item (após insert acima)
  //   • approvedEvents: âncora de contexto HITL — independente do histórico
  //   • loadMethodology: não depende de nenhuma das queries anteriores
  // Elimina também a query redundante de projectRow (connectivityMode já está em existingProject).
  cb.onStatus('Carregando contexto...');
  const [dbMessages, approvedEvents, methodologyData] = await Promise.all([
    db.query.messages.findMany({
      where: eq(messages.projectId, projectId),
      orderBy: [asc(messages.createdAt)],
      limit: 200, // cap defensivo — buildMemoryWindow já aplica budget de tokens
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

  // ── Modo de conectividade — vem de existingProject (sem query extra) ──────────
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
    const trends = byType("trend");
    const uncerts = byType("uncertainty");
    const inflections = byType("inflection_factor");
    const fpfs = byType("fpf");
    anchorContext = [
      "=== ÂNCORA DE CONTEXTO — DADOS APROVADOS PELO ANALISTA (IMUTÁVEIS) ===",
      trends.length ? `\nTENDÊNCIAS ESTRUTURANTES (${trends.length}):\n${trends.map(fmt).join("\n")}` : "",
      uncerts.length ? `\nINCERTEZAS CRÍTICAS / EVENTOS BOOLEANOS (${uncerts.length}):\n${uncerts.map(fmt).join("\n")}` : "",
      inflections.length ? `\nFATORES DE INFLEXÃO GEOPOLÍTICA (${inflections.length}):\n${inflections.map(fmt).join("\n")}` : "",
      fpfs.length ? `\nFATOS PORTADORES DE FUTURO — GRUMBACH (${fpfs.length}):\n${fpfs.map(fmt).join("\n")}` : "",
      `\nMODO DE CONECTIVIDADE: ${connectivityMode}`,
      connectivityMode === "AIR_GAPPED" ? "⚠️ AIR_GAPPED: ferramentas de busca externa PROIBIDAS." : "",
      connectivityMode === "SOBERANO" ? "⚠️ SOBERANO: usar RAG interno. Não expor intenção analítica." : "",
      "\n=======================================================================",
    ].filter(Boolean).join("");
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // 3. Metodologia já carregada pelo Promise.all acima — apenas desestrutura
  const { method, phases, agentMethodPrompts: agentPromptMap } = methodologyData;
  if (!method.agentsConfig) {
    throw new Error(`Metodologia '${metodologiaName}' sem agentes configurados. Verifique o seed.`);
  }

  // Suporta dois formatos de agentsConfig:
  // • Legado: ["HERMES", "SCOPUS", ...] (array de strings)
  // • Novo:   { agents: ["HERMES", ...], steps: [...] }
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
  const dynamicConsultTool = expertNames.length > 0 ? createConsultAgentTool(expertNames) : null;

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
    // ── Analytical engine tools (DB-bound, projectId injetado via closure) ──
    'tool_register_event':              analyticalEngineTools['tool_register_event'] as any,
    'tool_register_impact_relation':    analyticalEngineTools['tool_register_impact_relation'] as any,
    'tool_grumbach_expert_simulation':  analyticalEngineTools['tool_grumbach_expert_simulation'] as any,
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

    // TechniqueEngine: injeta instruções SAT no system prompt do agente
    let agentPrompt = ag.systemPrompt;

    // TEST_MODE: ATHENA auto-aprova todas as transições HITL — evita loops de validação
    // que causam timeouts de 6+ min nos testes (sem analista humano presente).
    if (process.env.TEST_MODE === 'true' && ag.name === 'ATHENA') {
      agentPrompt = `[MODO TESTE ATIVO] Você está em modo de teste automatizado. ` +
        `Aprovação HITL é automática: sempre conclua que está APROVADO prosseguir para a próxima fase. ` +
        `Não solicite dados adicionais. Retorne aprovação imediata e sucinta.\n\n` + agentPrompt;
    }

    // TEST_MODE: orquestradores (HERMES, OLYMPUS) seguem a sequência da metodologia.
    // Regra correta de ATHENA: chamada UMA VEZ ao final de cada fase completa (gate de
    // aprovação HITL), NÃO após cada chamada individual de especialista dentro de uma fase.
    // ATHENA auto-aprova em TEST_MODE (ver bloco acima para ag.name === 'ATHENA').
    // IMPORTANTE: injetado no FIM do prompt para sobrescrever regras anteriores.
    if (process.env.TEST_MODE === 'true' && ag.type === 'orchestrator') {
      agentPrompt = agentPrompt + `\n\n` +
        `[⚠️ MODO TESTE ATIVO — ESTAS INSTRUÇÕES REVOGAM TODOS OS PROTOCOLOS ANTERIORES]\n` +
        `Você está em modo de teste automatizado. As regras abaixo têm PRIORIDADE ABSOLUTA:\n` +
        `1. PROTOCOLO DE QUALIDADE — REGRA CORRETA DE ATHENA: Chame ATHENA UMA ÚNICA VEZ ao CONCLUIR cada fase completa. ` +
        `NÃO chame ATHENA após cada chamada individual de especialista dentro da mesma fase. ` +
        `Se uma fase exige o mesmo especialista múltiplas vezes, chame ATHENA apenas DEPOIS da última chamada do especialista naquela fase.\n` +
        `2. APROVAÇÃO AUTOMÁTICA: Quando ATHENA responder, ela aprovará imediatamente. Avance IMEDIATAMENTE para a fase seguinte sem solicitar input do usuário.\n` +
        `3. SEQUÊNCIA DIRETA: Execute TODAS as fases da metodologia em ordem. Após a aprovação de ATHENA, inicie o próximo especialista da fase seguinte.\n` +
        `4. Se uma fase exige o mesmo especialista de uma fase anterior, chame-o NOVAMENTE.\n` +
        `5. Após concluir TODAS as fases, produza o RELATÓRIO FINAL DIRETAMENTE (sem acionar ferramentas):\n` +
        `   - Começar com "**${ag.name}** · RELATÓRIO FINAL — [NOME DA METODOLOGIA]"\n` +
        `   - Ter MÍNIMO 1500 palavras com Resumo Executivo, Análise e Cenários, Recomendações Estratégicas\n`;
    }

    const agentTechs: string[] = [];
    if (ag.techniquesConfig) {
      try {
        const parsed = typeof ag.techniquesConfig === 'string'
          ? JSON.parse(ag.techniquesConfig) : ag.techniquesConfig;
        if (Array.isArray(parsed)) agentTechs.push(...parsed);
      } catch { /* ignore */ }
    }
    // também técnicas do projeto
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

  // Contexto com callbacks de progresso injetados
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
      // Expert agents run without token streaming — only the orchestrator streams
      return await sistema.dispatch(agentName, expertInput, { ...context, memory: [], onToken: undefined }, 'etapa');
    }
  };

  // Instrução de modo
  let finalInputMsg: any = rawInputMsg;
  let modeInstruction = '';
  if (vizMode === 'passos')   modeInstruction = '\n\n[INSTRUÇÃO DE MODO: Você está operando no modo PASSO A PASSO. Avance apenas UM passo ou faça UMA pergunta por vez dentro desta etapa. Aguarde a resposta do usuário antes de continuar.]';
  else if (vizMode === 'passagem') modeInstruction = '\n\n[INSTRUÇÃO DE MODO: Você está operando no modo PROCESSO COMPLETO. Conduza todo o método de forma autônoma. Pesquise o que for necessário, sugira opções, faça deduções e avance continuamente para entregar uma análise completa e integrada.]';
  else if (vizMode === 'thinking') modeInstruction = '\n\n[INSTRUÇÃO DE MODO: Você está no modo RACIOCÍNIO ESTENDIDO. Pense com extrema profundidade, utilize o bloco thinking para debater hipóteses, contrastar dados e garantir o maior rigor metodológico possível antes de dar sua resposta final.]';

  modeInstruction += '\n\n[⚠️ REGRA CRÍTICA DE FERRAMENTAS]: Se a solicitação exigir que você inicie uma etapa do método, delegue para um especialista (ex: SCOPUS) ou pesquise na web, VOCÊ É OBRIGADO a invocar a ferramenta correspondente AGORA MESMO. É absolutamente PROIBIDO responder apenas com um texto dizendo "Vou delegar", "Iniciando a etapa" ou "Aguarde". Você DEVE emitir a chamada da ferramenta neste exato turno!';

  if (isMultimodal) {
    const textPart = (finalInputMsg as any[]).find((c: any) => c.type === 'text');
    if (textPart) textPart.text += modeInstruction;
  } else {
    finalInputMsg = (finalInputMsg as string) + modeInstruction;
  }

  cb.onStatus('Orquestrando análise...');
  console.log(`[Orquestração] Aguardando síntese final do Orquestrador (${orchestratorName})...`);
  let responseText = await sistema.dispatch(orchestratorName, finalInputMsg, context, vizMode);
  console.log(`[Orquestração] 🎉 Resposta final gerada com ${responseText.length} caracteres.`);

  // Força assinatura do orquestrador
  if (!responseText.includes(`**${orchestratorName}**`) && !responseText.includes(`${orchestratorName} ·`)) {
    responseText = `**${orchestratorName}** · \n\n${responseText}`;
  }

  // 4. Classifica e salva resposta
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
    orchestratorName === 'KRATOS'          ? 'monitoramento'
    : orchestratorName === 'ATHENA' ? 'revisao'
    : isOrchestratorFinal                   ? 'relatorio_final'
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

// ============================================================================
// ROTA SÍNCRONA (compatibilidade retroativa)
// ============================================================================

chatRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const jwtPayload = (c.get('jwtPayload') as any) || { name: 'Sistema' };
    if (jwtPayload?.role === 'cliente') {
      return c.json({ error: 'Acesso negado. Clientes não têm permissão para análises.' }, 403);
    }

    const result = await runAnalysis(body, jwtPayload, {
      onStatus: () => {},
      onAgent:  () => {},
    });

    return c.json({
      role: 'assistant',
      content: [{ type: 'text', text: result.responseText }],
      text: result.responseText,
      agentName: result.agentName,
      thinking: result.thinkingContent
    });
  } catch (error: any) {
    console.error('Erro na rota de chat:', error);
    const msg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
    return c.json({ error: { message: msg || 'Erro interno do servidor' } }, 500);
  }
});

// ============================================================================
// ROTA SSE — progresso em tempo real
// Formato dos eventos: data: {"type":"status"|"agent"|"done"|"error", ...}
// ============================================================================

// Cap de tamanho de request para SSE — evita DoS com body gigante (base64, imagens, etc.)
const SSE_MAX_BODY_BYTES = 512 * 1024; // 512 KB

chatRoutes.post('/stream', async (c) => {
  const contentLength = Number(c.req.header('content-length') ?? 0);
  if (contentLength > SSE_MAX_BODY_BYTES) {
    return c.json({ error: `Payload excede o limite permitido (${SSE_MAX_BODY_BYTES / 1024} KB).` }, 413);
  }
  const body = await c.req.json();
  const jwtPayload = (c.get('jwtPayload') as any) || { name: 'Sistema' };
  if (jwtPayload?.role === 'cliente') {
    return c.json({ error: 'Acesso negado. Clientes não têm permissão para análises.' }, 403);
  }

  return streamSSE(c, async (stream) => {
    const MAX_RETRIES = 4;

    // Heartbeat a cada 20s — impede timeout do nginx (proxy_read_timeout) em modelos lentos (Ollama/CPU)
    let heartbeatTimer: ReturnType<typeof setInterval> | null = setInterval(() => {
      stream.writeSSE({ data: JSON.stringify({ type: 'ping' }) }).catch(() => {});
    }, 20_000);
    const stopHeartbeat = () => { if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; } };

    const isOverloadError = (err: any) =>
      err?.message?.toLowerCase().includes('overload') ||
      err?.errors?.some((e: any) => e?.statusCode === 529) ||
      err?.lastError?.statusCode === 529;

    const isToolsNotSupportedError = (err: any) =>
      err?.message?.toLowerCase().includes('does not support tools') ||
      err?.data?.error?.message?.toLowerCase().includes('does not support tools');

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
        messageSaved = true; // após 1ª tentativa bem-sucedida ou salva

        stopHeartbeat();
        // Emite o agente orquestrador (HERMES) antes do done — testes validam a sequência via type:'agent'
        await stream.writeSSE({ data: JSON.stringify({ type: 'agent', agent: result.agentName }) });
        await stream.writeSSE({ data: JSON.stringify({
          type: 'done',
          text: result.responseText,
          agentName: result.agentName,
          thinking: result.thinkingContent,
          messageType: result.messageType,
        }) });
        return; // sucesso — encerra o loop

      } catch (error: any) {
        lastError = error;
        messageSaved = true; // mensagem já foi salva na 1ª tentativa (mesmo que falhou no LLM)

        if (isOverloadError(error) && attempt < MAX_RETRIES) {
          console.warn(`[SSE] Anthropic sobrecarregado (tentativa ${attempt}/${MAX_RETRIES}). Aguardando antes de retry...`);
          continue;
        }

        stopHeartbeat();
        if (isToolsNotSupportedError(error)) {
          const model = error?.data?.error?.message?.match(/library\/([^:]+:[^"]+)/)?.[1]
            ?? error?.message?.match(/library\/([^:]+:[^"]+)/)?.[1]
            ?? 'modelo selecionado';
          console.warn(`[SSE] Modelo Ollama sem suporte a tools: ${model}`);
          await stream.writeSSE({ data: JSON.stringify({
            type: 'error',
            message: `O modelo "${model}" não suporta chamadas de ferramentas (tools), que são necessárias para a orquestração multi-agente do Olympus. Use modelos compatíveis como llama3.x, qwen2.x, mistral-nemo, phi4 ou deepseek-r1.`,
          }) });
          return;
        }

        // Erro não recuperável ou esgotou retries
        const msg = error?.message || 'Erro interno do servidor';
        console.error('[SSE] Erro:', msg);
        await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: msg }) });
        return;
      }
    }

    // Esgotou todas as tentativas
    stopHeartbeat();
    const msg = lastError?.message || 'Servidor sobrecarregado. Tente novamente em alguns instantes.';
    console.error('[SSE] Esgotadas todas as tentativas:', msg);
    await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: msg }) });
  });
});

// ============================================================================
// ROTA GRAPH SSE — LangGraph v2.0
//
// Substitui progressivamente a rota /stream para novas análises.
// Mantém /stream para compatibilidade retroativa.
//
// Fluxo:
//   1ª chamada:  envia estado inicial → grafo executa fases → pausa em PYTHIA se sem eventos
//   Retomada:    envia { isResuming: true } → grafo retoma do checkpoint via Command({resume})
//
// Eventos SSE:
//   { type: 'status',    text: string }       — mensagens de progresso
//   { type: 'step',      text: string }       — tool calls e passagens de nó
//   { type: 'token',     text: string }       — tokens do orquestrador (síntese)
//   { type: 'hitl_gate', ...interrupt_value } — grafo pausado antes de PYTHIA
//   { type: 'done', text, agentName, messageType } — análise concluída
//   { type: 'error',     message: string }    — erro irrecuperável
//
// thread_id = projectId — checkpointer MemorySaver mantém estado entre chamadas.
// ============================================================================

chatRoutes.post('/stream/graph', async (c) => {
  const contentLength = Number(c.req.header('content-length') ?? 0);
  if (contentLength > SSE_MAX_BODY_BYTES) {
    return c.json({ error: `Payload excede o limite permitido (${SSE_MAX_BODY_BYTES / 1024} KB).` }, 413);
  }
  const body        = await c.req.json();
  const jwtPayload  = (c.get('jwtPayload') as any) || { name: 'Sistema' };
  const projectId   = body.projectId || body.id || `sess_${Date.now()}`;
  const isResuming  = !!body.isResuming;
  const metodologiaName = (body.metodologia as string) || 'MSEF';
  const projectName = body.projectName || 'Novo Projeto';
  const vizMode     = body.vizMode || 'etapa';
  const userInput   = body.messages?.[body.messages.length - 1]?.content || '';
  const userInputStr = typeof userInput === 'string'
    ? userInput
    : (Array.isArray(userInput) ? userInput.find((c: any) => c.type === 'text')?.text || '' : '');

  return streamSSE(c, async (stream) => {
    // Heartbeat anti-timeout (nginx / Railway)
    let hbTimer: ReturnType<typeof setInterval> | null = setInterval(() => {
      stream.writeSSE({ data: JSON.stringify({ type: 'ping' }) }).catch(() => {});
    }, 20_000);
    const stopHb = () => { if (hbTimer) { clearInterval(hbTimer); hbTimer = null; } };

    const write = (obj: object) =>
      stream.writeSSE({ data: JSON.stringify(obj) }).catch(() => {});

    try {
      await write({ type: 'status', text: 'Iniciando motor LangGraph...' });

      // 1. Garante projeto no banco
      const existingProject = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
      if (!existingProject) {
        await db.insert(projects).values({
          id: projectId, name: projectName, methodology: metodologiaName,
          createdBy: jwtPayload.name, updatedBy: jwtPayload.name,
        });
      }

      // 2. Salva mensagem do usuário (apenas na primeira chamada — não na retomada)
      if (userInputStr && !isResuming) {
        await db.insert(messages).values({ projectId, role: 'user', content: userInputStr });
      }

      // 3. Carrega config LLM + fases da metodologia (necessário para o estado inicial)
      const [llmConfig, llmTiers] = await Promise.all([getLLMConfig(), getLLMTiers()]);

      // Carrega fases se for a primeira invocação (ou retomada sem estado)
      const { method, phases, agentMethodPrompts: agentPromptMap } = await loadMethodology(metodologiaName);

      // Carrega connectivityMode do projeto
      const projectRow = await db.query.projects.findFirst({
        columns: { connectivityMode: true },
        where: eq(projects.id, projectId),
      });
      const connectivityMode = (
        projectRow?.connectivityMode ?? process.env.CONNECTIVITY_MODE ?? 'ONLINE'
      ) as 'ONLINE' | 'SOBERANO' | 'AIR_GAPPED';

      // 4. Constrói input e config do grafo
      const graph  = getOlympusGraph();
      const config = graphConfig(projectId, {
        onStep:  (msg) => write({ type: 'step', text: msg }),
        onToken: (delta) => write({ type: 'token', text: delta }),
      });

      // Estado inicial (usado apenas na primeira invocação; retomada usa Command)
      const initialState = {
        projectId,
        methodology:       metodologiaName,
        connectivityMode,
        llmConfig,
        llmTiers,
        phases,
        agentMethodPrompts: agentPromptMap,
        userInput:         userInputStr,
        vizMode,
      };

      // Retomada após HITL: passa Command({resume}) com o input do usuário
      // Primeira execução: passa o estado inicial completo
      const graphInput = isResuming
        ? new Command({ resume: userInputStr || 'continuar' })
        : initialState;

      await write({ type: 'status', text: 'Executando grafo de análise...' });

      // 5. Stream do grafo — itera sobre updates de cada nó
      let finalOutput  = '';
      let finalAgent   = '';
      let finalMsgType = 'parcial';
      let wasInterrupted = false;

      const graphStream = await graph.stream(graphInput as any, {
        ...config,
        streamMode: 'updates',
      });

      for await (const event of graphStream) {
        // Detecta interrupção HITL
        if ('__interrupt__' in event) {
          const interruptValues = (event as any)['__interrupt__'];
          const iv = Array.isArray(interruptValues) ? interruptValues[0]?.value : interruptValues;
          wasInterrupted = true;
          stopHb();
          // IMPORTANT: spread AFTER type so that a 'type' key inside iv cannot
          // overwrite 'hitl_gate'. The interrupt value comes from pythiaNode's
          // interrupt({ type: 'hitl_required', ... }) — if spread first it would
          // replace our 'hitl_gate' sentinel with 'hitl_required'.
          await write({ ...iv, type: 'hitl_gate' });
          return; // fecha o SSE — frontend mostra EventsPanel
        }

        // Processa updates dos nós
        for (const [nodeName, stateUpdate] of Object.entries(event)) {
          if (!stateUpdate || typeof stateUpdate !== 'object') continue;
          const upd = stateUpdate as any;
          if (upd.lastOutput)  finalOutput  = upd.lastOutput;
          if (upd.agentName)   finalAgent   = upd.agentName;
          if (upd.messageType) finalMsgType = upd.messageType;
          if (upd.currentNodeSlug) {
            await write({ type: 'status', text: `Fase '${upd.currentNodeSlug}' concluída.` });
          }
        }
      }

      stopHb();

      if (!wasInterrupted) {
        await write({
          type:        'done',
          text:        finalOutput,
          agentName:   finalAgent,
          messageType: finalMsgType,
        });
      }

    } catch (err: any) {
      stopHb();
      const msg = err?.message || 'Erro interno no motor LangGraph.';
      console.error('[Graph SSE] Erro:', msg);
      await write({ type: 'error', message: msg });
    }
  });
});

export default chatRoutes;
