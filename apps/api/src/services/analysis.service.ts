/**
 * analysis.service.ts — Cache e carregamento de metodologias
 *
 * Sprint 21 (31 Mai 2026) — MIGRAÇÃO LANGGRAPH-FIRST:
 *   runAnalysis(), createConsultAgentTool(), buildMemoryWindow() e AnalysisCallbacks
 *   foram REMOVIDOS. O motor de análise é agora exclusivamente o LangGraph
 *   (apps/api/src/graph/). Ver historico_migracao.md para detalhes.
 *
 * Mantido aqui apenas o cache de metodologias, usado por:
 *   - routes/chat.ts (rota /stream/graph)
 *   - routes/settings.ts (invalidação de cache via API)
 */

import { db, methodologyPhases, agentMethodPrompts, methodologies, agents as agentsTable } from '@olympus/db';
import { eq } from 'drizzle-orm';

// ─── Cache e carregamento de metodologias ────────────────────────────────────

interface MethodologyCache { data: Awaited<ReturnType<typeof _loadMethodologyFromDb>>; expiresAt: number; }
const methodologyCache = new Map<string, MethodologyCache>();
const METHODOLOGY_CACHE_TTL_MS = 5 * 60 * 1000;

export async function loadMethodology(slug: string) {
  const now = Date.now();
  const cached = methodologyCache.get(slug);
  if (cached && now < cached.expiresAt) return cached.data;
  const data = await _loadMethodologyFromDb(slug);
  methodologyCache.set(slug, { data, expiresAt: now + METHODOLOGY_CACHE_TTL_MS });
  return data;
}

async function _loadMethodologyFromDb(slug: string) {
  const method = await db.query.methodologies.findFirst({
    where: (t, { or, eq: eqFn }) => or(
      eqFn(t.slug, slug.toLowerCase()),
      eqFn(t.name, slug)
    )
  });
  if (!method) {
    throw new Error(
      `Metodologia '${slug}' não encontrada no banco. Execute 'npm run seed' antes de iniciar uma análise.`
    );
  }

  const [phases, promptJoinRows] = await Promise.all([
    db.select()
      .from(methodologyPhases)
      .where(eq(methodologyPhases.methodologyId, method.id))
      .orderBy(methodologyPhases.phaseNum),
    db.select({
        agentName:         agentsTable.name,
        extraInstructions: agentMethodPrompts.extraInstructions,
      })
      .from(agentMethodPrompts)
      .innerJoin(agentsTable, eq(agentsTable.id, agentMethodPrompts.agentId))
      .where(eq(agentMethodPrompts.methodologyId, method.id)),
  ]);

  const promptMap: Record<string, string> = Object.fromEntries(
    promptJoinRows.map(r => [r.agentName, r.extraInstructions])
  );

  return { method, phases, agentMethodPrompts: promptMap };
}

export function invalidateMethodologyCache(): void {
  methodologyCache.clear();
}

export function getMethodologyCacheStatus(): { entries: number; oldestEntryAt: string | null; ttlSeconds: number } {
  const entries = methodologyCache.size;
  let oldest: number | null = null;
  for (const v of methodologyCache.values()) {
    const createdAt = v.expiresAt - METHODOLOGY_CACHE_TTL_MS;
    if (oldest === null || createdAt < oldest) oldest = createdAt;
  }
  return {
    entries,
    oldestEntryAt: oldest !== null ? new Date(oldest).toISOString() : null,
    ttlSeconds: METHODOLOGY_CACHE_TTL_MS / 1000,
  };
}
