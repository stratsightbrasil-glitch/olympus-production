/**
 * nodes.ts — Funções de nó do StateGraph LangGraph.
 *
 * Mapeamento node_slug → nó do grafo:
 *   node_framing          → scopusNode     (SCOPUS)
 *   node_scanning_macro   → klioNode       (KLIO)
 *   node_scanning_forces  → klioNode       (KLIO)
 *   node_retrospective    → klioNode       (KLIO)
 *   node_modeling         → pythiaNode     (PYTHIA) ← HITL gate
 *   node_matrix_design    → pythiaNode     (PYTHIA) ← HITL gate
 *   node_narrative        → mnemosyeNode   (MNEMOSYNE)
 *   node_integration      → integrationNode(THEMIS/KRATOS)
 *   (fim das fases)       → synthesisNode  (Orquestrador: HERMES/OLYMPUS)
 *
 * Regra HITL (langgraph.md): Pythia só opera sobre eventos com status='approved'.
 * Se não há eventos aprovados, o nó chama interrupt() e o grafo pausa.
 */

import { interrupt } from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";
import { getNodeRouter, Agent } from "@olympus/core";
import type { OlympusState } from "@olympus/core";
import {
  runAgentForPhase,
  resolveNextSlug,
  loadApprovedEvents,
  loadMemoryWindow,
  buildAnchorCtx,
  buildToolsForAgent,
} from "./helpers";
import { db, agents as agentsTable, messages } from "@olympus/db";
import { eq, inArray } from "drizzle-orm";

// ── Nó genérico especialista ──────────────────────────────────────────────────

/**
 * Executa o nó para o próximo slug roteado.
 * Usado por scopusNode, klioNode, mnemosyeNode e integrationNode.
 */
async function runNextPhaseNode(
  state: OlympusState,
  config: RunnableConfig,
): Promise<Partial<OlympusState>> {
  const nextSlug = resolveNextSlug(state);
  if (!nextSlug) {
    throw new Error("[Graph] runNextPhaseNode: nenhum slug disponível no estado atual.");
  }
  const router    = getNodeRouter(state.phases);
  const agentName = router.resolve(nextSlug);
  return runAgentForPhase(state, nextSlug, agentName, config);
}

// ── Nós especialistas ─────────────────────────────────────────────────────────

/** SCOPUS — Enquadramento estratégico (node_framing) */
export async function scopusNode(
  state: OlympusState,
  config: RunnableConfig,
): Promise<Partial<OlympusState>> {
  return runNextPhaseNode(state, config);
}

/** KLIO — Análise ambiental / scanning / retrospectiva (node_scanning_* / node_retrospective) */
export async function klioNode(
  state: OlympusState,
  config: RunnableConfig,
): Promise<Partial<OlympusState>> {
  return runNextPhaseNode(state, config);
}

/**
 * PYTHIA — Modelagem prospectiva (node_modeling / node_matrix_design)
 *
 * HITL gate: verifica eventos aprovados antes de executar.
 * Se não há eventos aprovados → interrupt() → grafo pausa.
 * O analista aprova eventos via EventsPanel e retoma o grafo.
 * Na retomada, a verificação passa e PYTHIA executa normalmente.
 */
export async function pythiaNode(
  state: OlympusState,
  config: RunnableConfig,
): Promise<Partial<OlympusState>> {
  const onStep = config?.configurable?.onStep as ((msg: string) => void) | undefined;

  // ── HITL gate ──────────────────────────────────────────────────────────────
  const approvedEvents = await loadApprovedEvents(state.projectId);
  if (approvedEvents.length === 0) {
    onStep?.("[PYTHIA] ⏸️  Aguardando aprovação de eventos pelo analista...");
    interrupt({
      type:      "hitl_required",
      agent:     "PYTHIA",
      message:   "PYTHIA requer eventos aprovados para iniciar a modelagem prospectiva. "
                 + "Revise os eventos propostos no painel HITL e aprove os que forem "
                 + "pertinentes antes de continuar.",
      projectId: state.projectId,
    });
  }

  onStep?.(`[PYTHIA] ✅ ${approvedEvents.length} evento(s) aprovado(s) — iniciando modelagem.`);
  return runNextPhaseNode(state, config);
}

/** MNEMOSYNE — Narrativas de cenários (node_narrative) */
export async function mnemosyeNode(
  state: OlympusState,
  config: RunnableConfig,
): Promise<Partial<OlympusState>> {
  return runNextPhaseNode(state, config);
}

/** THEMIS/KRATOS — Integração, hedges/bets, alertas (node_integration) */
export async function integrationNode(
  state: OlympusState,
  config: RunnableConfig,
): Promise<Partial<OlympusState>> {
  return runNextPhaseNode(state, config);
}

// ── Nó de síntese — Orquestrador ─────────────────────────────────────────────

/**
 * synthesisNode — Executa o orquestrador (HERMES ou OLYMPUS) para gerar o
 * Relatório Final. Todos os especialistas já rodaram e persistiram suas análises
 * no banco — o orquestrador lê o histórico e sintetiza.
 *
 * Instrução de modo injeta [MODO SÍNTESE FINAL] para evitar re-delegação.
 * Se onToken está disponível via configurable, o nó faz token streaming via SSE.
 */
export async function synthesisNode(
  state: OlympusState,
  config: RunnableConfig,
): Promise<Partial<OlympusState>> {
  const onStep  = config?.configurable?.onStep  as ((msg: string) => void) | undefined;
  const onToken = config?.configurable?.onToken as ((delta: string) => void) | undefined;

  // Descobre o orquestrador da metodologia (type='orchestrator' no banco)
  const agentNames: string[] = [
    ...state.phases.map((p: any) => p.agentRole as string).filter(Boolean),
    "HERMES", "OLYMPUS", "HERMES_SIPLEX", // fallbacks
  ];
  const uniqueNames = [...new Set(agentNames)];

  const dbAgents = await db.query.agents.findMany({
    where: inArray(agentsTable.name, uniqueNames),
  });
  const orchestratorRow = dbAgents.find(a => a.type === "orchestrator")
                        ?? dbAgents.find(a => a.name === "HERMES");

  if (!orchestratorRow) {
    throw new Error("[Graph] synthesisNode: nenhum agente orquestrador encontrado.");
  }

  const orchestratorName = orchestratorRow.name;
  onStep?.(`[${orchestratorName}] 📝 Sintetizando relatório final...`);

  // Injeta instrução de síntese final — evita que HERMES tente re-delegar via consultar_agente
  const synthesisInstruction =
    "\n\n[MODO SÍNTESE FINAL]: Todos os especialistas (SCOPUS, KLIO, PYTHIA, MNEMOSYNE, THEMIS) "
    + "já concluíram suas análises. O histórico completo está disponível acima. "
    + "Sua tarefa AGORA é EXCLUSIVAMENTE sintetizar as análises em um RELATÓRIO FINAL completo. "
    + "NÃO invoque agentes ou ferramentas adicionais. Gere o documento diretamente.";

  const syntheticState: OlympusState = {
    ...state,
    userInput: (state.userInput || "Gere o relatório final consolidado.") + synthesisInstruction,
  };

  // Monta ferramentas — orquestrador sem consultar_agente (síntese não precisa delegar)
  const tools = buildToolsForAgent(
    { ...orchestratorRow, toolsConfig: "[]" }, // remove todas as ferramentas para síntese pura
    state.projectId,
  );

  const [memory, anchorContext] = await Promise.all([
    loadMemoryWindow(state.projectId),
    buildAnchorCtx(state.projectId, state.connectivityMode),
  ]);

  const agentCtx = {
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
    onToken,   // streaming de tokens para SSE quando disponível
  };

  const agent = new Agent(
    orchestratorRow.name,
    orchestratorRow.role,
    orchestratorRow.systemPrompt,
    tools,
    orchestratorRow.modelOverride ?? undefined,
  );

  const output = await agent.run(syntheticState.userInput, agentCtx, state.vizMode);

  // Assinatura do orquestrador (compatibilidade com frontend)
  const finalOutput =
    output.includes(`**${orchestratorName}**`) || output.includes(`${orchestratorName} ·`)
      ? output
      : `**${orchestratorName}** · \n\n${output}`;

  // Classifica tipo da mensagem
  const REPORT_PATTERNS = [
    "RELATÓRIO FINAL PADRÃO", "RELATÓRIO FINAL", "RELATÓRIO DE CENÁRIOS",
    "RELATÓRIO ESTRATÉGICO",  "RELATÓRIO PROSPECTIVO",
    "RAPPORT PROSPECTIF GODET", "RAPPORT PROSPECTIF",
    "RELATÓRIO GRUMBACH",    "RELATÓRIO SIEX",
    "PRODUTO ALTA FINAL",    "PRODUTO ALTA",
  ];
  const isReport = REPORT_PATTERNS.some(p => finalOutput.includes(p))
                || (finalOutput.length > 1500 && finalOutput.includes(`**${orchestratorName}**`));
  const messageType = isReport ? "relatorio_final" : "parcial";

  await db.insert(messages).values({
    projectId:   state.projectId,
    role:        "assistant",
    content:     finalOutput,
    agentName:   orchestratorName,
    messageType,
  });

  onStep?.(`[${orchestratorName}] 🎉 Relatório final gerado (${finalOutput.length} chars).`);

  return {
    lastOutput:  finalOutput,
    agentName:   orchestratorName,
    messageType,
    // currentNodeSlug permanece inalterado — síntese não avança o cursor de fase
  };
}
