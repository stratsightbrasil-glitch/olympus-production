/**
 * phase-context.ts — Contexto compacto entre fases + carregamento de PhaseConfig do banco
 *
 * Budget máximo: ~6K tokens para contexto acumulado completo (9 fases Grumbach).
 * Summary construído deterministicamente — nunca gerado por LLM.
 */

import { db, phaseOutputs, methodologyPhases, methodologies } from "@olympus/db";
import { eq, asc }                                            from "drizzle-orm";
import type { PhaseConfig }                                    from "./phase-configs/grumbach";

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

// ── Cache de phase configs por metodologia (TTL 5 min) ──────────────────────
const _phaseConfigCache = new Map<string, { data: PhaseConfig[]; ts: number }>();
const PHASE_CONFIG_TTL_MS = 5 * 60 * 1000;

/**
 * Carrega PhaseConfig[] de uma metodologia a partir do banco.
 * Substitui PHASE_CONFIGS[slug] em código — permite configurar qualquer metodologia via seed.
 * Lança erro descritivo se a metodologia não existe ou não tem prompts configurados.
 */
export async function loadPhaseConfigs(methodologySlug: string): Promise<PhaseConfig[]> {
  const cached = _phaseConfigCache.get(methodologySlug);
  if (cached && Date.now() - cached.ts < PHASE_CONFIG_TTL_MS) return cached.data;

  const method = await db.query.methodologies.findFirst({
    where:   eq(methodologies.slug, methodologySlug),
    columns: { id: true },
  });
  if (!method) {
    throw new Error(
      `[loadPhaseConfigs] Metodologia '${methodologySlug}' não encontrada no banco. ` +
      `Execute o seed para registrá-la.`
    );
  }

  const phases = await db
    .select()
    .from(methodologyPhases)
    .where(eq(methodologyPhases.methodologyId, method.id))
    .orderBy(asc(methodologyPhases.phaseNum));

  if (phases.length === 0) {
    throw new Error(
      `[loadPhaseConfigs] Metodologia '${methodologySlug}' não tem fases no banco. ` +
      `Execute o seed para popular as fases.`
    );
  }

  const incomplete = phases.filter(p => !p.systemPromptInject);
  if (incomplete.length > 0) {
    throw new Error(
      `[loadPhaseConfigs] Fases sem systemPromptInject em '${methodologySlug}': ` +
      incomplete.map(p => `fase ${p.phaseNum} (${p.slug})`).join(', ') +
      `. Execute o seed para completar a configuração.`
    );
  }

  const configs: PhaseConfig[] = phases.map(p => ({
    phaseSlug:               p.slug ?? `${methodologySlug}_p${p.phaseNum}`,
    phaseNum:                p.phaseNum,
    nodeSlug:                p.nodeSlug ?? 'node_framing',
    label:                   p.label,
    systemPromptInject:      p.systemPromptInject!,
    allowedTools:            (p.allowedTools as string[]) ?? [],
    requiresHitlBefore:      p.requiresHitlBefore ?? false,
    requiresQualitativeAudit: p.requiresQualitativeAudit ?? false,
    atsCodes:                (p.atsCodes as string[]) ?? [],
  }));

  _phaseConfigCache.set(methodologySlug, { data: configs, ts: Date.now() });
  return configs;
}

/** Invalida cache de uma metodologia (útil após rodar seed sem restart) */
export function invalidatePhaseConfigCache(methodologySlug?: string) {
  if (methodologySlug) _phaseConfigCache.delete(methodologySlug);
  else _phaseConfigCache.clear();
}
