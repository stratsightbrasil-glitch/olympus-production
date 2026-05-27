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

const MEMORY_TOKEN_BUDGET = 80_000;

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
    description: ot.description,
    parameters:  schm,
    execute:     async (args: any) => ot.execute({ projectId, ...args }),
    // LangChain compatibility: @langchain/core ≥0.2 calls tool.inputSchema()
    // instead of instanceof ZodObject. Without this, Agent crashes on first call.
    inputSchema: () => schm,
  };

  return adapted as unknown as Tool<any>;
}

/**
 * Constrói a lista de ferramentas para um agente a partir de toolsConfig (JSON array de nomes).
 * Ferramentas ausentes são silenciosamente ignoradas (feature, não bug).
 *
 * Inclui as ferramentas do motor analítico (analytical-engines.ts) que ficam em
 * apps/api/src/tools/ porque dependem de @olympus/db (proibido em packages/tools/).
 */
export function buildToolsForAgent(agentRow: any, projectId: string): Tool<any>[] {
  const { registrarSinal, buscarSinais, atualizarSentinela } =
    createSignalTools(projectId);
  const { declararJulgamento, registrarHipoteseAlternativa, avaliarFonte } =
    createAnalyticStandardsTools(projectId);

  // Pre-adapt analytical engine tools once — they're closures, no DB I/O at build time
  const analyticalAdapted = Object.fromEntries(
    analyticalEngineTools.map(t => [t.name, adaptOlympusTool(t, projectId)])
  );

  const available: Record<string, Tool<any>> = {
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
  const onStep = config?.configurable?.onStep as ((msg: string) => void) | undefined;
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
  const tools = buildToolsForAgent(dbAgent, state.projectId);

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
