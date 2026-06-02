/**
 * helpers.ts — Lógica compartilhada entre os nós do grafo LangGraph.
 *
 * Responsabilidades:
 *  - loadMemoryWindow()    — janela de tokens do histórico (server-authoritative)
 *  - buildAnchorCtx()      — âncora de contexto com eventos aprovados (anti-bloat)
 *  - loadApprovedEvents()  — lista de eventos com status='approved' do projeto
 *  - buildToolsForAgent()  — monta a lista de ferramentas com base em toolsConfig do DB
 *  - runAgentForPhase()    — executa um agente para um node_slug específico
 *
 * Não exportar nada que dependa de @langchain/langgraph — este arquivo é puro Olympus.
 */

import { jsonSchema } from "ai";
import type { RunnableConfig } from "@langchain/core/runnables";
import {
  db,
  messages,
  agents as agentsTable,
  projectEvents,
} from "@olympus/db";
import { Agent, AgentContext, Tool, getNodeRouter } from "@olympus/core";
import type { OlympusState } from "@olympus/core";
import { tavilySearchTool, dadosPublicosTool } from "@olympus/tools";
import { ragTool } from "../tools/rag";
import { createSignalTools } from "../tools/signals";
import { createAnalyticStandardsTools } from "../tools/analytic-standards";
import { getTechniqueInstructions } from "../tools/technique-engine";
import {
  analyticalEngineTools,
  type OlympusTool,
} from "../tools/analytical-engines";
import { eq, and, asc } from "drizzle-orm";

// ── Janela de memória ─────────────────────────────────────────────────────────
// Buffer de janela deslizante: mantém apenas as N mensagens mais recentes +
// a primeira mensagem (âncora de contexto do projeto).
// Evita o "Efeito Bola de Neve" onde o custo cresce exponencialmente com o histórico.
const MEMORY_TOKEN_BUDGET   = 48_000; // comporta 8 saídas de ~5K chars + contexto
const MEMORY_WINDOW_MESSAGES = 16;    // âncora + 16 recentes = cobre MSEF (8 fases) com folga

function estimateTokens(content: unknown): number {
  if (!content) return 0;
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return Math.ceil(text.length / 4);
}

/**
 * Carrega a janela de memória do banco de dados (source of truth).
 * Exclui a última mensagem (turno atual) e limita por budget de tokens.
 */
export async function loadMemoryWindow(projectId: string): Promise<any[]> {
  const dbMessages = await db.query.messages.findMany({
    where: eq(messages.projectId, projectId),
    orderBy: [asc(messages.createdAt)],
    limit: 200, // cap defensivo — buildMemoryWindow já aplica budget de tokens
  });

  const msgs = dbMessages.map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Smart exclusion: only strip the last message if it is a USER message
  // (the current turn's input, which arrives separately via state.userInput).
  // If the last message is an ASSISTANT message it is a prior specialist's output
  // and MUST remain in context — stripping it blindly caused each specialist to
  // receive the analysis without seeing the previous agent's work.
  const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
  const candidates = (lastMsg?.role === "user") ? msgs.slice(0, -1) : msgs;
  if (candidates.length === 0) return [];

  const first = candidates[0];
  const rest  = candidates.slice(1).reverse();
  const window: any[] = [];
  let tokens = Math.min(estimateTokens(first?.content), 4_000);

  for (const msg of rest) {
    const t = estimateTokens(msg.content);
    if (tokens + t > MEMORY_TOKEN_BUDGET) break;
    window.unshift(msg);
    tokens += t;
  }

  if (first && !window.includes(first)) window.unshift(first);

  // Cap duro: âncora (first) + no máximo MEMORY_WINDOW_MESSAGES recentes.
  // Garante que nós tardios do grafo não recebam décadas de histórico.
  if (window.length > MEMORY_WINDOW_MESSAGES + 1) {
    return [window[0], ...window.slice(-(MEMORY_WINDOW_MESSAGES))];
  }
  return window;
}

// ── Âncora de contexto HITL ───────────────────────────────────────────────────

/**
 * Constrói a âncora de contexto com eventos aprovados.
 * Retorna string vazia se não há eventos aprovados.
 */
export async function buildAnchorCtx(
  projectId: string,
  connectivityMode: string,
): Promise<string> {
  const approvedEvents = await db
    .select({
      id:               projectEvents.id,
      name:             projectEvents.name,
      description:      projectEvents.description,
      type:             projectEvents.type,
      sourceEvaluation: projectEvents.sourceEvaluation,
    })
    .from(projectEvents)
    .where(
      and(
        eq(projectEvents.projectId, projectId),
        eq(projectEvents.status, "approved"),
      ),
    );

  if (approvedEvents.length === 0) return "";

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

  return [
    "=== ÂNCORA DE CONTEXTO — DADOS APROVADOS PELO ANALISTA (IMUTÁVEIS) ===",
    trends.length      ? `\nTENDÊNCIAS ESTRUTURANTES (${trends.length}):\n${trends.map(fmt).join("\n")}`             : "",
    uncerts.length     ? `\nINCERTEZAS CRÍTICAS (${uncerts.length}):\n${uncerts.map(fmt).join("\n")}`                 : "",
    inflections.length ? `\nFATORES DE INFLEXÃO (${inflections.length}):\n${inflections.map(fmt).join("\n")}`         : "",
    fpfs.length        ? `\nFATOS PORTADORES DE FUTURO — GRUMBACH (${fpfs.length}):\n${fpfs.map(fmt).join("\n")}`    : "",
    `\nMODO DE CONECTIVIDADE: ${connectivityMode}`,
    connectivityMode === "AIR_GAPPED" ? "⚠️ AIR_GAPPED: ferramentas de busca externa PROIBIDAS."  : "",
    connectivityMode === "SOBERANO"   ? "⚠️ SOBERANO: usar RAG interno. Não expor intenção analítica." : "",
    "\n=======================================================================",
  ].filter(Boolean).join("");
}

// ── Eventos aprovados ─────────────────────────────────────────────────────────

/** Retorna todos os eventos com status='approved' do projeto. */
export async function loadApprovedEvents(projectId: string) {
  return db
    .select()
    .from(projectEvents)
    .where(
      and(
        eq(projectEvents.projectId, projectId),
        eq(projectEvents.status, "approved"),
      ),
    );
}

// ── Ferramentas ───────────────────────────────────────────────────────────────

/**
 * Adapts an OlympusTool (apps/api/src/tools/ interface) to the Vercel AI SDK
 * Tool<any> shape expected by Agent.run().
 *
 * Key rules (from .claude/rules/langgraph.md):
 *  - NO_ZOD_IN_AGENT: never use Zod — use jsonSchema() from "ai"
 *  - INPUT_SCHEMA_FIX: inject (t as any).inputSchema = () => jsonSchema(...) so
 *    @langchain/core can introspect the schema without instanceof ZodObject checks
 *  - projectId is stripped from the exposed schema and injected automatically,
 *    so the LLM never has to provide it (reduces hallucination risk).
 */
function adaptOlympusTool(ot: OlympusTool, projectId: string): Tool<any> {
  // Strip projectId from the schema — inject it automatically at call time
  const rawProps = { ...ot.parameters.properties };
  delete rawProps.projectId;
  const rawRequired = ot.parameters.required.filter(r => r !== "projectId");
  const rawSchema = {
    type: "object" as const,
    properties: rawProps,
    required: rawRequired,
  };

  // We construct the tool object manually (not via tool() from "ai") because the
  // Vercel AI SDK v6 overload resolver breaks when parameters is jsonSchema(...)
  // with an explicit execute() — it matches the wrong overload and infers the
  // execute type as 'undefined'. Direct construction sidesteps this while
  // preserving the exact runtime shape Agent.run() expects.
  const schm = jsonSchema(rawSchema);
  const adapted: Record<string, unknown> = {
    // name é OBRIGATÓRIO: Agent.ts usa t.name como chave em aiTools[t.name].
    // Sem ele, todas as ferramentas analíticas colapsam em aiTools[undefined]
    // e apenas a última sobrevive — as demais ficam inacessíveis ao LLM.
    name:        ot.name,
    description: ot.description,
    // schema (raw JSON) é OBRIGATÓRIO: Agent.ts usa `t.schema || TOOL_JSON_SCHEMAS[t.name] || FALLBACK`
    // para construir o wrappedSchema passado ao tool(). Sem ele, o LLM vê parâmetros
    // vazios ({}) para todos os analytical-engine tools.
    schema:      rawSchema,
    parameters:  schm,
    execute:     async (args: any) => ot.execute({ projectId, ...args }),
    // LangChain compatibility: @langchain/core ≥0.2 calls tool.inputSchema()
    // instead of instanceof ZodObject. Without this, Agent crashes on first call.
    inputSchema: () => schm,
  };

  return adapted as unknown as Tool<any>;
}

/**
 * Cria a ferramenta consultar_agente com closure sobre projectId e llmConfig.
 * O sub-agente (ex: ATHENA) é instanciado via Agent.run() direto — não via LangGraph.
 * Sem ferramentas próprias: sub-agentes respondem com análise textual pura.
 * llmConfig herdado do agente pai — garante consistência de modelo na cadeia.
 */
function createConsultarAgenteTool(
  projectId: string,
  llmConfig: { provider: string; model: string } | undefined,
  llmTiers:  Record<string, string>,
): Tool<any> {
  return {
    name: 'consultar_agente',
    description:
      'Delega uma tarefa para um agente especialista da equipe OLYMPUS. '
      + 'Use agent_name="ATHENA" para auditoria de qualidade analítica (ATS). '
      + 'Outros valores: SCOPUS, KLIO, PYTHIA, MNEMOSYNE, THEMIS.',
    schema: {
      type: 'object' as const,
      properties: {
        agent_name: {
          type: 'string',
          description: 'Nome do agente especialista a consultar.',
        },
        query: {
          type: 'string',
          description: 'Tarefa ou pergunta para o agente. Inclua o conteúdo a auditar.',
        },
      },
      required: ['agent_name', 'query'],
    },
    execute: async (args: { agent_name: string; query: string }) => {
      const dbAgent = await db.query.agents.findFirst({
        where: eq(agentsTable.name, args.agent_name),
      });
      if (!dbAgent) return `[ERRO] Agente '${args.agent_name}' não encontrado.`;

      const subAgent = new Agent(
        dbAgent.name,
        dbAgent.role,
        dbAgent.systemPrompt,
        [],  // sub-agentes sem ferramentas — evita chamadas recursivas
        dbAgent.modelOverride ?? undefined,
      );

      const memory = await loadMemoryWindow(projectId);

      const subCtx: AgentContext = {
        projectId,
        methodology:        '',
        memory,
        llmConfig:          llmConfig ?? { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
        llmTiers,
        phases:             [],
        agentMethodPrompts: {},
        connectivityMode:   'ONLINE',
      };

      try {
        return await subAgent.run(args.query, subCtx, 'etapa');
      } catch (err: any) {
        return `[ERRO ao consultar ${args.agent_name}]: ${err?.message ?? 'desconhecido'}`;
      }
    },
  };
}

/**
 * Constrói a lista de ferramentas para um agente a partir de toolsConfig (JSON array de nomes).
 * Ferramentas ausentes são silenciosamente ignoradas (feature, não bug).
 *
 * Inclui as ferramentas do motor analítico (analytical-engines.ts) que ficam em
 * apps/api/src/tools/ porque dependem de @olympus/db (proibido em packages/tools/).
 */
export function buildToolsForAgent(
  agentRow:   any,
  projectId:  string,
  llmConfig?: { provider: string; model: string },
  llmTiers?:  Record<string, string>,
): Tool<any>[] {
  const { registrarSinal, buscarSinais, atualizarSentinela } =
    createSignalTools(projectId);
  const { declararJulgamento, registrarHipoteseAlternativa, avaliarFonte } =
    createAnalyticStandardsTools(projectId);

  // Pre-adapt analytical engine tools once — they're closures, no DB I/O at build time
  const analyticalAdapted = Object.fromEntries(
    analyticalEngineTools.map(t => [t.name, adaptOlympusTool(t, projectId)])
  );

  const available: Record<string, Tool<any>> = {
    // ── Delegação intra-equipe ────────────────────────────────────────────────
    consultar_agente: createConsultarAgenteTool(projectId, llmConfig, llmTiers ?? {}),
    // ── Ferramentas externas / RAG ─────────────────────────────────────────────
    web_search:                     tavilySearchTool,
    buscar_dados_publicos:          dadosPublicosTool,
    buscar_documentos_internos:     ragTool,
    // ── Sinais e sentinelas ────────────────────────────────────────────────────
    registrar_sinal:                registrarSinal,
    buscar_sinais:                  buscarSinais,
    atualizar_sentinela:            atualizarSentinela,
    // ── Padrões analíticos (ACH, julgamentos) ─────────────────────────────────
    declarar_julgamento:            declararJulgamento,
    registrar_hipotese_alternativa: registrarHipoteseAlternativa,
    avaliar_fonte:                  avaliarFonte,
    // ── Motor analítico (MICMAC, MACTOR, Grumbach, MPO) ──────────────────────
    ...analyticalAdapted,
  };

  const toolNames: string[] = [];
  if (agentRow.toolsConfig) {
    try {
      const parsed =
        typeof agentRow.toolsConfig === "string"
          ? JSON.parse(agentRow.toolsConfig)
          : agentRow.toolsConfig;
      if (Array.isArray(parsed)) toolNames.push(...parsed);
    } catch { /* ignore */ }
  }

  return toolNames.flatMap(name =>
    available[name] ? [available[name]] : [],
  );
}

// ── Execução de agente para uma fase ─────────────────────────────────────────

/**
 * Executa um agente especialista para a fase especificada.
 * Salva a saída no banco de dados e retorna o update parcial de estado.
 *
 * @param state      Estado atual do grafo
 * @param phaseSlug  Slug ÚNICO da fase (ex: 'grumbach_p4', 'godet_p2') — armazenado
 *                   em state.currentNodeSlug para roteamento na próxima iteração.
 *                   NÃO é o nodeSlug LangGraph (ex: 'node_modeling'), que pode
 *                   se repetir entre fases consecutivas da mesma metodologia.
 * @param agentName  Nome do agente (ex: 'SCOPUS')
 * @param config     RunnableConfig do LangGraph — callbacks passados via configurable
 */
export async function runAgentForPhase(
  state: OlympusState,
  phaseSlug: string,
  agentName: string,
  config: RunnableConfig,
): Promise<Partial<OlympusState>> {
  const onStep  = config?.configurable?.onStep  as ((msg: string) => void) | undefined;
  const onAgent = config?.configurable?.onAgent as ((name: string) => void) | undefined;
  onAgent?.(agentName);  // notifica o cliente qual agente está ativo
  // onToken is NOT extracted here — specialist agents never stream tokens.
  // Token streaming is exclusively for synthesisNode (see nodes.ts).

  // 1. Carrega agente do banco
  const dbAgent = await db.query.agents.findFirst({
    where: eq(agentsTable.name, agentName),
  });
  if (!dbAgent) {
    throw new Error(`[Graph] Agente '${agentName}' não encontrado no banco para a fase '${phaseSlug}'.`);
  }

  // 2. TechniqueEngine — injeta instruções SAT no prompt
  let agentPrompt = dbAgent.systemPrompt;

  // KLIO FIRST-STEP enforcement — injetar instrução explícita antes do system prompt.
  // Garante que a PRIMEIRA ação seja registrar evento (TAD), não buscar na web.
  if (agentName === 'KLIO' && process.env.TEST_MODE !== 'true') {
    agentPrompt =
      "[REGRA OPERACIONAL OBRIGATÓRIA — PRIMEIRO PASSO SEMPRE]:\n"
      + "Sua PRIMEIRA ação DEVE ser chamar tool_register_event para registrar\n"
      + "o evento, tendência ou fator de inflexão que você identificará.\n"
      + "SOMENTE após registrar via tool_register_event, use web_search ou\n"
      + "buscar_dados_publicos para complementar com dados externos.\n"
      + "NUNCA inicie com web_search. Violações desta regra invalidam a análise TAD.\n\n"
      + agentPrompt;
  }

  // TEST_MODE: ATHENA auto-aprova HITL — evita loops de validação sem analista humano
  if (process.env.TEST_MODE === 'true' && agentName === 'ATHENA') {
    agentPrompt = `[MODO TESTE ATIVO] Você está em modo de teste automatizado. ` +
      `Aprovação HITL é automática: sempre conclua que está APROVADO prosseguir para a próxima fase. ` +
      `Não solicite dados adicionais. Retorne aprovação imediata e sucinta.\n\n` + agentPrompt;
  }

  const agentTechs: string[] = [];
  if (dbAgent.techniquesConfig) {
    try {
      const parsed =
        typeof dbAgent.techniquesConfig === "string"
          ? JSON.parse(dbAgent.techniquesConfig)
          : dbAgent.techniquesConfig;
      if (Array.isArray(parsed)) agentTechs.push(...parsed);
    } catch { /* ignore */ }
  }
  if (agentTechs.length > 0) {
    const techniqueBlock = await getTechniqueInstructions([...new Set(agentTechs)]);
    agentPrompt = agentPrompt + techniqueBlock;
  }

  // 3. Monta ferramentas
  const tools = buildToolsForAgent(dbAgent, state.projectId, state.llmConfig, state.llmTiers);

  // 4. Carrega memória e âncora em paralelo
  const [memory, anchorContext] = await Promise.all([
    loadMemoryWindow(state.projectId),
    buildAnchorCtx(state.projectId, state.connectivityMode),
  ]);

  // 5. Constrói AgentContext
  // NOTE: onToken is intentionally NOT included here. Token streaming via SSE is
  // exclusive to synthesisNode (which builds its own agentCtx with onToken).
  // Passing onToken to specialist agents floods the client with hundreds of
  // partial-token events per phase, breaking SSE backpressure and making it
  // impossible to distinguish phase boundaries from streaming content.
  const agentContext: AgentContext = {
    projectId:          state.projectId,
    methodology:        state.methodology,
    memory,
    llmConfig:          state.llmConfig,
    llmTiers:           state.llmTiers,
    phases:             state.phases,
    agentMethodPrompts: state.agentMethodPrompts,
    connectivityMode:   state.connectivityMode,
    anchorContext:      anchorContext || undefined,
    onStep,
    // onToken deliberately absent — specialist agents run silently (generateText)
  };

  // 6. Instancia e executa agente
  const agent = new Agent(
    dbAgent.name,
    dbAgent.role,
    agentPrompt,
    tools,
    dbAgent.modelOverride ?? undefined,
  );

  onStep?.(`[${agentName}] 🔍 Iniciando análise — fase: ${phaseSlug}`);
  const output = await agent.run(state.userInput, agentContext, state.vizMode);
  onStep?.(`[${agentName}] ✅ Fase ${phaseSlug} concluída (${output.length} chars).`);

  // 7. Persiste no banco
  await db.insert(messages).values({
    projectId: state.projectId,
    role:      "assistant",
    content:   output,
    agentName,
    messageType: "parcial",
  });

  return {
    lastOutput:      output,
    agentName,
    currentNodeSlug: phaseSlug,  // stores phaseSlug (unique) — not nodeSlug (can repeat)
    messageType:     "parcial",
  };
}

// ── Execução direta de agente único (KRATOS, monitoramento, casos especiais) ──

/**
 * Executa um único agente especialista diretamente, sem o grafo completo.
 * Usado pelo KRATOS (monitoramento autônomo via pg-boss) — não é uma análise
 * multi-fase e não precisa do roteamento LangGraph.
 *
 * Persiste entrada e saída no banco. Retorna o texto gerado.
 */
export async function runDirectAgent(opts: {
  agentName:   string;
  input:       string;
  projectId:   string;
  projectName: string;
  metodologia: string;
  llmConfig:   { provider: string; model: string };
  llmTiers:    Record<string, string>;
  onStatus?:   (text: string) => void;
  onAgent?:    (name: string) => void;
}): Promise<string> {
  const { agentName, input, projectId, llmConfig, llmTiers, onStatus, onAgent } = opts;

  onStatus?.(`Carregando agente ${agentName}...`);

  const dbAgent = await db.query.agents.findFirst({
    where: eq(agentsTable.name, agentName),
  });
  if (!dbAgent) throw new Error(`Agente '${agentName}' não encontrado.`);

  onAgent?.(agentName);

  // Salva mensagem do usuário
  await db.insert(messages).values({ projectId, role: 'user', content: input });

  const tools = buildToolsForAgent(dbAgent, projectId, llmConfig, llmTiers);
  const [memory, anchorCtx] = await Promise.all([
    loadMemoryWindow(projectId),
    buildAnchorCtx(projectId, 'ONLINE'),
  ]);

  const agentCtx: AgentContext = {
    projectId,
    methodology: opts.metodologia,
    memory,
    llmConfig,
    llmTiers,
    phases:             [],
    agentMethodPrompts: {},
    connectivityMode:   'ONLINE',
    anchorContext:      anchorCtx || undefined,
    onStep: (msg) => onStatus?.(msg),
  };

  const agent = new Agent(dbAgent.name, dbAgent.role, dbAgent.systemPrompt, tools, dbAgent.modelOverride ?? undefined);
  const output = await agent.run(input, agentCtx, 'etapa');

  await db.insert(messages).values({ projectId, role: 'assistant', content: output, agentName, messageType: 'monitoramento' });

  onStatus?.(`${agentName} concluído.`);
  return output;
}

// ── buildToolsForPhase (Olympus 1.0 / phaseLoopNode) ─────────────────────────

/**
 * Constrói ferramentas para uma fase a partir de uma lista de nomes.
 * Substitui buildToolsForAgent no fluxo v5 — recebe allowedTools da PhaseConfig.
 */
export function buildToolsForPhase(
  allowedToolNames: string[],
  projectId:        string,
  llmConfig?:       { provider: string; model: string },
  llmTiers?:        Record<string, string>,
): ReturnType<typeof buildToolsForAgent> {
  // Reutiliza o dict 'available' construindo um agentRow fictício
  // com toolsConfig = allowedToolNames
  const fakeAgentRow = { toolsConfig: allowedToolNames };
  return buildToolsForAgent(fakeAgentRow, projectId, llmConfig, llmTiers);
}

// ── Helpers de roteamento (usados por nodes.ts e router.ts) ──────────────────

/**
 * Dado o estado atual, retorna o próximo nodeSlug a executar.
 * null → análise concluída (todas as fases roteáveis executadas).
 */
export function resolveNextSlug(state: OlympusState): string | null {
  const router = getNodeRouter(state.phases);
  if (!state.currentNodeSlug) return router.firstSlug();
  return router.nextSlug(state.currentNodeSlug);
}
