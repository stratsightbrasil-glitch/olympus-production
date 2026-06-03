/**
 * builder.ts v5 (Olympus 1.0)
 *
 * Topologia simplificada:
 *   START → phase_loop (loop até esgotar fases) → synthesis → END
 *
 * Dois nós. Sem ALL_SPECIALIST_NODES. Sem routeFromState complexo.
 * PHASE_CONFIGS drive o roteamento (não node_slug do banco).
 */

import { StateGraph, START, END }       from "@langchain/langgraph";
import { OlympusStateAnnotation }        from "@olympus/core";
import { phaseLoopNode, synthesisNode, PHASE_CONFIGS } from "./nodes";
import { getPostgresSaver }              from "./postgresSaver";

// ── Singleton do grafo compilado ───────────────────────────────────────────────
let _compiledPromise: Promise<ReturnType<typeof buildGraph>> | null = null;

function buildGraph(checkpointer: Awaited<ReturnType<typeof getPostgresSaver>>) {
  return new StateGraph(OlympusStateAnnotation)
    .addNode("phase_loop", phaseLoopNode)
    .addNode("synthesis",  synthesisNode)
    // START → loop ou synthesis (se já todas as fases concluídas)
    .addConditionalEdges(START, routeFromStart, ["phase_loop", "synthesis"])
    // Após cada fase: voltar ao loop ou ir para synthesis
    .addConditionalEdges("phase_loop", routeAfterPhase, ["phase_loop", "synthesis"])
    .addEdge("synthesis", END)
    .compile({ checkpointer });
}

function routeFromStart(state: any): "phase_loop" | "synthesis" {
  const idx    = state.currentPhaseIndex ?? 0;
  const config = PHASE_CONFIGS[state.methodology ?? "grumbach"] ?? [];
  if (config.length === 0) {
    console.error(
      `[routeFromStart] PHASE_CONFIGS não encontrado para metodologia '${state.methodology}'. ` +
      `Disponíveis: [${Object.keys(PHASE_CONFIGS).join(", ")}]. ` +
      `Roteando para synthesis — vai falhar com mensagem clara.`
    );
  }
  if (idx >= config.length) return "synthesis";
  return "phase_loop";
}

function routeAfterPhase(state: any): "phase_loop" | "synthesis" {
  const idx    = state.currentPhaseIndex ?? 0;
  const config = PHASE_CONFIGS[state.methodology ?? "grumbach"] ?? [];
  if (idx >= config.length) return "synthesis";
  return "phase_loop";
}

/**
 * Grafo compilado (singleton async).
 * Lazy-initialized na primeira chamada — aguarda PostgresSaver.setup().
 */
export async function getOlympusGraph() {
  if (!_compiledPromise) {
    _compiledPromise = getPostgresSaver().then(cp => buildGraph(cp));
  }
  return _compiledPromise;
}

/**
 * Config LangGraph para um projeto específico.
 * thread_id = projectId garante isolamento de checkpoint por projeto.
 */
export function graphConfig(
  projectId: string,
  callbacks?: {
    onStep?:  (msg: string) => void;
    onToken?: (delta: string) => void;
    onAgent?: (name: string) => void;
  },
) {
  return {
    configurable: {
      thread_id: projectId,
      onStep:    callbacks?.onStep,
      onToken:   callbacks?.onToken,
      onAgent:   callbacks?.onAgent,
    },
  };
}
