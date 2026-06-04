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
  // Single reduce replaces 3 separate filter() passes + 1 map() pass (4→1 iteration).
  let factCount = 0, indiCount = 0, supCount = 0;
  const topClaims: string[] = [];
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    if (f.factStatus === "FATO")      factCount++;
    else if (f.factStatus === "INDICIO")   indiCount++;
    else if (f.factStatus === "SUPOSICAO") supCount++;
    if (i < 3) topClaims.push(f.claim.slice(0, 80));
  }
  const topClaimsStr = topClaims.join("; ");

  return [
    `F${phaseNum} [${phaseLabel}]:`,
    `${factCount}F/${indiCount}I/${supCount}S,`,
    `${toolCallIds.length} reg.`,
    topClaimsStr ? `| ${topClaimsStr}` : "",
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
