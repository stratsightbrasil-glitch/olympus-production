/**
 * nodeRouter.ts — Mapeamento nodeSlug → agentName para o LangGraph
 *
 * O campo `nodeSlug` em `methodology_phases` (ex: 'node_framing', 'node_modeling')
 * identifica qual nó LangGraph executará cada fase. Esta função constrói o mapa
 * que será usado como `conditional_edges` no StateGraph da Fase 2.
 *
 * Nós mapeados (ver .claude/rules/langgraph.md):
 *   node_framing         → SCOPUS  — KAC, escopo, filtro Hendrikson
 *   node_scanning_macro  → KLIO    — PESTEL, megatendências, FPFs
 *   node_scanning_forces → KLIO    — atores, capacidades, eixos de inflexão
 *   node_retrospective   → KLIO    — trajetória histórica, Cones de Janus, RAG
 *   node_modeling        → PYTHIA  — MICMAC M^k, probabilidades, ACH
 *   node_matrix_design   → PYTHIA  — Matriz 2×2, morfologia, cenário alvo
 *   node_narrative       → MNEMOSYNE — narrativas com travas probabilísticas
 *   node_integration     → THEMIS  — hedges/bets, backcasting, alertas
 */

export interface PhaseRouteEntry {
  nodeSlug: string;
  agentName: string;
  phaseNum: number;
  label: string;
}

export type NodeRouter = {
  /** Retorna o agentName responsável por um nodeSlug. Lança se não encontrado. */
  resolve: (nodeSlug: string) => string;
  /** Lista todas as entradas ordenadas por phaseNum. */
  entries: () => PhaseRouteEntry[];
  /** Retorna o próximo nodeSlug após o atual, ou null se for o último. */
  nextSlug: (currentSlug: string) => string | null;
};

type PhaseRow = {
  phaseNum: number;
  label: string;
  agentRole: string;           // nome do agente responsável (ex: 'SCOPUS')
  nodeSlug?: string | null;    // ex: 'node_framing' — null para fases sem nó LangGraph
  description?: string | null;
};

/**
 * Constrói o router a partir das fases carregadas pela loadMethodology().
 * Fases sem nodeSlug são ignoradas (fases de apoio que não têm nó próprio).
 */
export function getNodeRouter(phases: PhaseRow[]): NodeRouter {
  const routable = phases
    .filter(p => !!p.nodeSlug)
    .sort((a, b) => a.phaseNum - b.phaseNum)
    .map(p => ({
      nodeSlug: p.nodeSlug!,
      agentName: p.agentRole,
      phaseNum: p.phaseNum,
      label: p.label,
    }));

  const bySlug = new Map<string, PhaseRouteEntry>(routable.map(e => [e.nodeSlug, e]));

  return {
    resolve(nodeSlug: string): string {
      const entry = bySlug.get(nodeSlug);
      if (!entry) {
        const known = routable.map(e => e.nodeSlug).join(', ');
        throw new Error(
          `[NodeRouter] nodeSlug '${nodeSlug}' não registrado. Slugs disponíveis: ${known || '(nenhum)'}`
        );
      }
      return entry.agentName;
    },

    entries(): PhaseRouteEntry[] {
      return [...routable];
    },

    nextSlug(currentSlug: string): string | null {
      const idx = routable.findIndex(e => e.nodeSlug === currentSlug);
      if (idx === -1 || idx === routable.length - 1) return null;
      return routable[idx + 1].nodeSlug;
    },
  };
}
