/**
 * builder.ts v6 (Olympus 1.0 — Sprint 24)
 *
 * Topologia simplificada:
 *   START → phase_loop (loop até esgotar fases) → synthesis → END
 *
 * Dois nós. Roteamento via state.totalPhases (populado pelo chat.ts no initialState
 * e atualizado pelo phaseLoopNode após cada fase). Não depende mais de PHASE_CONFIGS
 * em código — as fases vivem no banco e são carregadas via loadPhaseConfigs().
 */

import { StateGraph, START, END }       from "@langchain/langgraph";
import { OlympusStateAnnotation }        from "@olympus/core";
import { phaseLoopNode, synthesisNode }  from "./nodes";
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

// totalPhases vem do initialState (chat.ts) e é mantido pelo phaseLoopNode.
// Fallback 9 garante que análises em andamento (checkpoints antigos sem totalPhases)
// não quebrem — Grumbach tem exatamente 9 fases.
function routeFromStart(state: any): "phase_loop" | "synthesis" {
  const idx         = state.currentPhaseIndex ?? 0;
  const totalPhases = state.totalPhases ?? 9;
  if (idx >= totalPhases) return "synthesis";
  return "phase_loop";
}

function routeAfterPhase(state: any): "phase_loop" | "synthesis" {
  const idx         = state.currentPhaseIndex ?? 0;
  const totalPhases = state.totalPhases ?? 9;
  if (idx >= totalPhases) return "synthesis";
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
    onStep?:        (msg: string) => void;
    onToken?:       (delta: string) => void;
    onAgent?:       (name: string) => void;
    onAthena?:      (data: { verdict: string; phaseNum: number; label: string; usedLlm: boolean }) => void;
    onPhaseOutput?: (data: { text: string; phaseNum: number; label: string }) => void;
  },
) {
  return {
    configurable: {
      thread_id:      projectId,
      onStep:         callbacks?.onStep,
      onToken:        callbacks?.onToken,
      onAgent:        callbacks?.onAgent,
      onAthena:       callbacks?.onAthena,
      onPhaseOutput:  callbacks?.onPhaseOutput,
    },
  };
}
