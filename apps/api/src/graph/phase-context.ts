/**
 * phase-context.ts — Contexto compacto entre fases (substitui loadMemoryWindow)
 *
 * Budget máximo: ~6K tokens para contexto acumulado completo (9 fases Grumbach).
 * Summary construído deterministicamente — nunca gerado por LLM.
 */

import { db, phaseOutputs } from "@olympus/db";
import { eq, asc }           from "drizzle-orm";

export interface PhaseContext {
  contextText:     string;
  estimatedTokens: number;
  phaseCount:      number;
}

/**
 * Constrói o summary determinístico de uma fase.
 * NÃO usa LLM — extrai campos estruturados do phase_output.
 */
export function buildPhaseSummary(
  phaseLabel:  string,
  phaseNum:    number,
  findings:    Array<{ claim: string; factStatus: string; tadScore?: string }>,
  toolCallIds: string[],
  verdict:     string | null | undefined,
): string {
  const factCount = findings.filter(f => f.factStatus === "FATO").length;
  const indiCount = findings.filter(f => f.factStatus === "INDICIO").length;
  const supCount  = findings.filter(f => f.factStatus === "SUPOSICAO").length;
  const topClaims = findings.slice(0, 3).map(f => f.claim.slice(0, 80)).join("; ");

  return [
    `F${phaseNum} [${phaseLabel}]:`,
    `${factCount}F/${indiCount}I/${supCount}S,`,
    `${toolCallIds.length} reg.`,
    topClaims ? `| ${topClaims}` : "",
    verdict   ? `| ATHENA:${verdict}` : "",
  ].filter(Boolean).join(" ");
}

/**
 * Carrega contexto compacto de todas as fases anteriores do projeto.
 * Retorna texto para injetar no system prompt de KLIO.
 */
export async function loadPhaseContext(projectId: string): Promise<PhaseContext> {
  const outputs = await db.query.phaseOutputs.findMany({
    where:   eq(phaseOutputs.projectId, projectId),
    columns: { phaseNum: true, phaseSlug: true, summary: true, athenaVerdict: true },
    orderBy: [asc(phaseOutputs.phaseNum)],
  });

  if (outputs.length === 0) {
    return { contextText: "", estimatedTokens: 0, phaseCount: 0 };
  }

  const lines = outputs.map(o =>
    `[F${o.phaseNum}/${o.phaseSlug}] ${o.summary}`
    + (o.athenaVerdict ? ` (ATHENA:${o.athenaVerdict})` : "")
  );

  const contextText = "=== FASES ANTERIORES (contexto compacto) ===\n"
    + lines.join("\n")
    + "\n=== FIM DO CONTEXTO ===";

  const estimatedTokens = Math.ceil(contextText.length / 4);

  return { contextText, estimatedTokens, phaseCount: outputs.length };
}
