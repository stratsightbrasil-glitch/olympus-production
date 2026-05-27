/**
 * router.ts — Lógica de roteamento condicional do grafo LangGraph.
 *
 * A função routeFromState() é usada como conditional edge a partir de START
 * e de cada nó especialista. Ela lê state.currentNodeSlug (último phaseSlug
 * concluído) e retorna o nome do próximo nó LangGraph a executar.
 *
 * Fluxo de roteamento:
 *   currentNodeSlug=null          → firstSlug() da metodologia → nó correspondente
 *   currentNodeSlug=<phaseSlug>   → nextSlug(<phaseSlug>)      → nó correspondente
 *   nextSlug=null                 → "synthesis_node"            → relatório final
 *
 * IMPORTANTE: state.currentNodeSlug armazena o PHASESLUG (identificador único de
 * fase, ex: 'grumbach_p4'), NÃO o nodeSlug LangGraph (ex: 'node_modeling').
 * O nodeSlug é recuperado via router.nodeSlugOf(phaseSlug) e então mapeado para
 * o nome do nó no grafo via NODE_SLUG_TO_GRAPH_NODE.
 *
 * Isso evita o loop infinito causado por nodeSlug duplicados (ex: GRUMBACH fases
 * 4 e 5 ambas com 'node_modeling') que afetava 6 das 7 metodologias.
 */

import { getNodeRouter } from "@olympus/core";
import type { OlympusState } from "@olympus/core";

// ── Mapa node_slug (LangGraph) → nome do nó no grafo ─────────────────────────

export const NODE_SLUG_TO_GRAPH_NODE: Record<string, string> = {
  node_framing:          "scopus_node",
  node_scanning_macro:   "klio_node",
  node_scanning_forces:  "klio_node",
  node_retrospective:    "klio_node",
  node_modeling:         "pythia_node",
  node_matrix_design:    "pythia_node",
  node_narrative:        "mnemosyne_node",
  node_integration:      "integration_node",
};

// ── Função de roteamento ──────────────────────────────────────────────────────

/**
 * Determina o próximo nó do grafo com base no estado atual.
 *
 * Usado como conditional edge em:
 *   - START (ponto de entrada inicial e de retomada HITL)
 *   - Todos os nós especialistas (saída → próximo nó)
 *
 * Two-step lookup:
 *   phaseSlug (unique DB slug) → nodeSlug (LangGraph slug) → graph node name
 */
export function routeFromState(state: OlympusState): string {
  if (!state.phases || state.phases.length === 0) {
    return "synthesis_node";
  }

  const router = getNodeRouter(state.phases);

  // Step 1: determine next phaseSlug (unique per-phase identifier)
  const nextPhaseSlug: string | null =
    state.currentNodeSlug
      ? router.nextSlug(state.currentNodeSlug)
      : router.firstSlug();

  if (!nextPhaseSlug) {
    // All phases completed → final synthesis
    return "synthesis_node";
  }

  // Step 2: resolve the LangGraph nodeSlug from the phaseSlug, then map to graph node
  const nextNodeSlug = router.nodeSlugOf(nextPhaseSlug);
  return NODE_SLUG_TO_GRAPH_NODE[nextNodeSlug] ?? "synthesis_node";
}
