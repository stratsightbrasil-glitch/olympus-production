/**
 * nodeRouter.ts — Mapeamento phaseSlug → agentName para o LangGraph
 *
 * PROBLEMA CRÍTICO (resolvido): O campo `nodeSlug` em `methodology_phases` (ex:
 * 'node_modeling', 'node_integration') identifica o NÓ LANGGRAPH, mas é
 * REUTILIZADO por múltiplas fases consecutivas. Exemplos:
 *   - GRUMBACH: fases 4 e 5 ambas usam 'node_modeling'
 *   - SIPLEX:   fases 6, 7 e 8 todas usam 'node_integration'
 * Usar nodeSlug como chave de Map sobrescrevia fases anteriores e findIndex()
 * encontrava sempre a PRIMEIRA ocorrência → loop infinito garantido.
 *
 * SOLUÇÃO: usar `phaseSlug` (campo `slug` do DB, ex: 'grumbach_p4') como chave
 * única de roteamento. Fallback sintético `${nodeSlug}_ph${phaseNum}` garante
 * unicidade mesmo se `slug` estiver ausente no banco.
 *
 * O estado `currentNodeSlug` no OlympusStateAnnotation agora armazena o phaseSlug
 * da última fase CONCLUÍDA (não o nodeSlug LangGraph).
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
  /** Identificador ÚNICO da fase no banco (ex: 'grumbach_p4') — chave de roteamento. */
  phaseSlug: string;
  /** Slug do nó LangGraph (ex: 'node_modeling') — para mapear ao grafo. Pode se repetir. */
  nodeSlug: string;
  agentName: string;
  phaseNum: number;
  label: string;
}

export type NodeRouter = {
  /** Retorna o agentName responsável por uma phaseSlug. Lança se não encontrado. */
  resolve: (phaseSlug: string) => string;
  /**
   * Retorna o nodeSlug LangGraph (ex: 'node_modeling') de uma phaseSlug.
   * Usado pelo routeFromState para mapear phaseSlug → nome do nó no grafo.
   */
  nodeSlugOf: (phaseSlug: string) => string;
  /** Lista todas as entradas ordenadas por phaseNum. */
  entries: () => PhaseRouteEntry[];
  /** Retorna o primeiro phaseSlug da metodologia, ou null se não houver fases roteáveis. */
  firstSlug: () => string | null;
  /**
   * Retorna o próximo phaseSlug após currentPhaseSlug, ou null se for o último.
   * Busca por phaseSlug (único) — não por nodeSlug (não único).
   */
  nextSlug: (currentPhaseSlug: string) => string | null;
};

type PhaseRow = {
  phaseNum: number;
  label: string;
  agentRole: string;           // nome do agente responsável (ex: 'SCOPUS')
  nodeSlug?: string | null;    // ex: 'node_framing' — null para fases sem nó LangGraph
  slug?: string | null;        // slug único do banco (ex: 'grumbach_p4')
  description?: string | null;
};

/**
 * Constrói o router a partir das fases carregadas pela loadMethodology().
 * Fases sem nodeSlug são ignoradas (fases de apoio que não têm nó próprio).
 *
 * Chave de roteamento: phaseSlug = p.slug ?? `${p.nodeSlug}_ph${p.phaseNum}`
 * Isso garante unicidade mesmo para metodologias sem slug preenchido no banco.
 */
export function getNodeRouter(phases: PhaseRow[]): NodeRouter {
  const routable = phases
    .filter(p => !!p.nodeSlug)
    .sort((a, b) => a.phaseNum - b.phaseNum)
    .map(p => ({
      // phaseSlug é único por fase — garante que fases com nodeSlug igual (ex:
      // GRUMBACH fases 4 e 5 ambas 'node_modeling') sejam roteadas corretamente.
      phaseSlug: p.slug ?? `${p.nodeSlug!}_ph${p.phaseNum}`,
      nodeSlug:  p.nodeSlug!,
      agentName: p.agentRole,
      phaseNum:  p.phaseNum,
      label:     p.label,
    } satisfies PhaseRouteEntry));

  // Map keyed by phaseSlug (único) — nunca por nodeSlug (pode se repetir entre fases)
  const byPhaseSlug = new Map<string, PhaseRouteEntry>(
    routable.map(e => [e.phaseSlug, e])
  );

  return {
    firstSlug(): string | null {
      return routable.length > 0 ? routable[0].phaseSlug : null;
    },

    resolve(phaseSlug: string): string {
      const entry = byPhaseSlug.get(phaseSlug);
      if (!entry) {
        const known = routable.map(e => e.phaseSlug).join(', ');
        throw new Error(
          `[NodeRouter] phaseSlug '${phaseSlug}' não registrado. ` +
          `Slugs disponíveis: ${known || '(nenhum)'}`
        );
      }
      return entry.agentName;
    },

    nodeSlugOf(phaseSlug: string): string {
      const entry = byPhaseSlug.get(phaseSlug);
      if (!entry) {
        const known = routable.map(e => e.phaseSlug).join(', ');
        throw new Error(
          `[NodeRouter] nodeSlugOf: phaseSlug '${phaseSlug}' não encontrado. ` +
          `Slugs disponíveis: ${known || '(nenhum)'}`
        );
      }
      return entry.nodeSlug;
    },

    entries(): PhaseRouteEntry[] {
      return [...routable];
    },

    nextSlug(currentPhaseSlug: string): string | null {
      // Busca por phaseSlug (único) — findIndex nunca encontra duplicatas
      const idx = routable.findIndex(e => e.phaseSlug === currentPhaseSlug);
      if (idx === -1 || idx === routable.length - 1) return null;
      return routable[idx + 1].phaseSlug;
    },
  };
}
