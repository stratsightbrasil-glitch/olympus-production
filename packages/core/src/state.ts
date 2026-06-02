import { Annotation } from "@langchain/langgraph";

/** Linha de fase da metodologia — espelho de methodology_phases */
export interface PhaseRow {
  id?: string;
  phaseNum: number;
  label: string;
  agentRole: string;
  nodeSlug?: string | null;
  description?: string | null;
  slug?: string | null;
}

/**
 * Estado global do StateGraph LangGraph para o motor analítico Olympus.
 *
 * Semântica de `currentNodeSlug`:
 *   null  → análise não iniciada (primeira execução do grafo)
 *   slug  → último node_slug CONCLUÍDO com sucesso
 *
 * A função de roteamento lê `currentNodeSlug` para calcular o próximo nó.
 * Cada nó, ao concluir, atualiza `currentNodeSlug` com o slug que acabou de executar.
 */
export const OlympusStateAnnotation = Annotation.Root({
  // ── Contexto do projeto ─────────────────────────────────────────────────────
  projectId:   Annotation<string>({ reducer: (_c, u) => u, default: () => "" }),
  methodology: Annotation<string>({ reducer: (_c, u) => u, default: () => "" }),

  /** Último node_slug concluído. null = grafo não iniciado. (v4 compat) */
  currentNodeSlug: Annotation<string | null>({
    reducer: (_c, u) => u,
    default: () => null as string | null,
  }),

  /**
   * Cursor 0-based da fase atual no loop v5.
   * null = análise não iniciada.
   * Quando currentPhaseIndex >= phases.length → synthesis.
   */
  currentPhaseIndex: Annotation<number | null>({
    reducer: (_c, u) => u,
    default: () => null as number | null,
  }),

  // ── Controle de soberania de dados ──────────────────────────────────────────
  connectivityMode: Annotation<"ONLINE" | "SOBERANO" | "AIR_GAPPED">({
    reducer: (_c, u) => u,
    default: () => "ONLINE" as "ONLINE" | "SOBERANO" | "AIR_GAPPED",
  }),

  // ── Configuração LLM — carregada na primeira invocação ──────────────────────
  llmConfig: Annotation<{ provider: string; model: string } | undefined>({
    reducer: (c, u) => u ?? c,
    default: () => undefined as { provider: string; model: string } | undefined,
  }),
  llmTiers: Annotation<Record<string, string> | undefined>({
    reducer: (c, u) => u ?? c,
    default: () => undefined as Record<string, string> | undefined,
  }),

  // ── Fases e prompts da metodologia ──────────────────────────────────────────
  phases: Annotation<PhaseRow[]>({
    reducer: (c, u) => (u != null ? u : c),
    default: () => [] as PhaseRow[],
  }),
  agentMethodPrompts: Annotation<Record<string, string>>({
    reducer: (c, u) => (u != null ? u : c),
    default: () => ({} as Record<string, string>),
  }),

  // ── Turno atual ─────────────────────────────────────────────────────────────
  /** Mensagem do usuário para este turno */
  userInput:   Annotation<string>({ reducer: (_c, u) => u, default: () => "" }),
  /** Saída do último nó executado */
  lastOutput:  Annotation<string>({ reducer: (_c, u) => u, default: () => "" }),
  /** Nome do agente que gerou lastOutput */
  agentName:   Annotation<string>({ reducer: (_c, u) => u, default: () => "" }),
  /** Classificação da mensagem (parcial / relatorio_final / monitoramento) */
  messageType: Annotation<string>({ reducer: (_c, u) => u, default: () => "parcial" }),
  /** Modo de profundidade (etapa / passos / passagem / thinking) */
  vizMode:     Annotation<string>({ reducer: (c, u) => u ?? c, default: () => "etapa" }),
});

export type OlympusState = typeof OlympusStateAnnotation.State;
