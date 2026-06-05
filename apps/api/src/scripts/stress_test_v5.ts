/**
 * stress_test_v5.ts — Validação estrutural da arquitetura Olympus 1.0
 *
 * Execução: docker exec olympus_api npx tsx apps/api/src/scripts/stress_test_v5.ts
 *
 * CP-1: Tabela phase_outputs existe e é acessível
 * CP-2: Agente KLIO existe no banco com toolsConfig correto
 * CP-3: ATHENA determinística bloqueia FATO sem TAD
 * CP-4: ATHENA determinística aprova FATO com TAD correto
 * CP-5: Contexto acumulado < 8K tokens para 9 fases simuladas
 * CP-6: buildPhaseSummary produz texto de tamanho controlado (< 500 chars)
 * CP-7: GRUMBACH_PHASES tem 9 fases com slugs e prompts corretos
 * CP-8: Grafo LangGraph compila sem erros (phase_loop + synthesis)
 * CP-9: Metodologia 'grumbach' tem PHASE_CONFIGS implementado
 * CP-10: Metodologia 'esg' lança erro explícito (sem phase configs)
 */

import { db, phaseOutputs, agents } from "@olympus/db";
import { eq }                        from "drizzle-orm";
import { validateStructuralCompliance, athenaAuditPhase } from "../graph/athena-validator";
import { buildPhaseSummary, loadPhaseConfigs } from "../graph/phase-context";
import { GRUMBACH_PHASES }            from "../graph/phase-configs/grumbach";
import { getOlympusGraph }            from "../graph";

async function runStressTest() {
  console.log("═════════════════════════════════════════════════════════");
  console.log("🧪 STRESS TEST v5 — Olympus 1.0 / Arquitetura 4 Agentes");
  console.log(`📅 ${new Date().toISOString()}`);
  console.log("═════════════════════════════════════════════════════════\n");

  const results: { cp: string; passed: boolean; msg: string }[] = [];

  const check = (cp: string, passed: boolean, msg: string) => {
    results.push({ cp, passed, msg });
    console.log(`${passed ? "✅" : "❌"} ${cp}: ${msg}`);
  };

  // CP-1: phase_outputs existe
  try {
    await db.select().from(phaseOutputs).limit(1);
    check("CP-1", true, "Tabela phase_outputs existe e é acessível.");
  } catch (e: any) {
    check("CP-1", false, `Tabela phase_outputs inacessível: ${e.message}`);
  }

  // CP-2: KLIO existe no banco
  const klio = await db.query.agents.findFirst({ where: eq(agents.name, "KLIO") });
  check("CP-2",
    !!klio && Array.isArray(klio.toolsConfig) && (klio.toolsConfig as any[]).length > 0,
    klio
      ? `Agente KLIO encontrado (${(klio.toolsConfig as any[])?.length ?? 0} ferramentas).`
      : "KLIO não encontrado no banco."
  );

  // CP-3: ATHENA bloqueia FATO sem TAD
  const findingsNoTad = [
    { claim: "Tensão geopolítica crescente no Leste Europeu", factStatus: "FATO" as const, source: "Reuters" }
  ];
  const res3 = validateStructuralCompliance({ summary: "", keyFindings: findingsNoTad }, "node_scanning_macro");
  check("CP-3", !res3.valid,
    !res3.valid
      ? `ATHENA bloqueou corretamente: ${res3.errors[0]?.slice(0, 80)}`
      : "FALHA: ATHENA deveria ter bloqueado FATO sem TAD mas não bloqueou."
  );

  // CP-4: ATHENA aprova FATO com TAD correto
  const findingsWithTad = [
    { claim: "Tensão geopolítica crescente no Leste Europeu", factStatus: "FATO" as const, tadScore: "B2", source: "Reuters" }
  ];
  const res4 = validateStructuralCompliance({ summary: "", keyFindings: findingsWithTad }, "node_scanning_macro");
  check("CP-4", res4.valid,
    res4.valid
      ? "ATHENA aprovou FATO com TAD correto."
      : `FALHA: ${res4.errors[0]}`
  );

  // CP-5: Contexto acumulado < 8K tokens para 9 fases
  const mockSummary = "F1 [Delimitação]: 3F/2I/1S, 5 reg. | [FPF-1] Tensão OTAN | [FPF-2] Fragmentação UE | [FPF-3] Cyberwar | ATHENA:APROVADO";
  const estimatedTotal = (mockSummary.length * 9) / 4;
  check("CP-5", estimatedTotal < 8000,
    `Estimativa: ~${Math.round(estimatedTotal)} tokens para 9 fases (limite: 8000).`
  );

  // CP-6: buildPhaseSummary tamanho controlado
  const summary = buildPhaseSummary("Varredura FPF", 2, findingsWithTad, ["uuid-1"], "APROVADO");
  check("CP-6", summary.length < 500,
    `Summary gerado: ${summary.length} chars (limite: 500). Prévia: "${summary.slice(0, 80)}"`
  );

  // CP-7: GRUMBACH_PHASES tem 9 fases válidas
  const phasesOk = GRUMBACH_PHASES.length === 9
    && GRUMBACH_PHASES.every(p => p.phaseSlug && p.nodeSlug && p.systemPromptInject.trim().length > 50);
  check("CP-7", phasesOk,
    phasesOk
      ? `${GRUMBACH_PHASES.length} fases Grumbach configuradas (slugs: ${GRUMBACH_PHASES.map(p => p.phaseSlug).join(", ")}).`
      : `FALHA: ${GRUMBACH_PHASES.length} fases ou alguma com configuração inválida.`
  );

  // CP-8: Grafo LangGraph compila
  try {
    await getOlympusGraph();
    check("CP-8", true, "Grafo LangGraph (phase_loop + synthesis) compilado sem erros.");
  } catch (e: any) {
    check("CP-8", false, `Grafo falhou ao compilar: ${e.message}`);
  }

  // CP-9: 'grumbach' carregado do banco com 9 fases e campos Sprint 24
  try {
    const grumbachFromDB = await loadPhaseConfigs('grumbach');
    const allHavePrompt  = grumbachFromDB.every(p => p.systemPromptInject?.length > 50);
    const allHaveTools   = grumbachFromDB.every(p => p.allowedTools.length > 0);
    check("CP-9",
      grumbachFromDB.length === 9 && allHavePrompt && allHaveTools,
      grumbachFromDB.length === 9 && allHavePrompt && allHaveTools
        ? `Grumbach do banco: ${grumbachFromDB.length} fases, prompts OK, tools OK`
        : `FALHA: ${grumbachFromDB.length} fases, prompts=${allHavePrompt}, tools=${allHaveTools}`
    );
  } catch (e: any) {
    check("CP-9", false, `FALHA ao carregar grumbach do banco: ${e.message}`);
  }

  // CP-10: 'esg' lança erro descritivo (sem systemPromptInject configurado)
  let esgThrewError = false;
  let esgErrorMsg   = '';
  try {
    await loadPhaseConfigs('esg');
  } catch (e: any) { esgThrewError = true; esgErrorMsg = e.message; }
  check("CP-10", esgThrewError,
    esgThrewError
      ? `'esg' lança erro descritivo: "${esgErrorMsg.slice(0, 80)}"`
      : "FALHA: 'esg' deveria lançar erro (sem systemPromptInject configurado)."
  );

  // ── Resultado final ────────────────────────────────────────────────────────
  console.log("\n═════════════════════════════════════════════════════════");
  const passed  = results.filter(r => r.passed).length;
  const total   = results.length;
  console.log(`📊 RESULTADO: ${passed}/${total} checkpoints OK`);

  if (passed < total) {
    console.log("\n❌ FALHAS:");
    results.filter(r => !r.passed).forEach(r =>
      console.log(`   • ${r.cp}: ${r.msg}`)
    );
    console.log("\n⚠️  Corrigir falhas antes de executar análise Grumbach.");
    process.exit(1);
  } else {
    console.log("\n✅ Arquitetura Olympus 1.0 estruturalmente íntegra.");
    console.log("   Próximo passo: executar análise Grumbach e verificar 9 phase_outputs no banco.");
    process.exit(0);
  }
}

runStressTest().catch(err => {
  console.error("❌ Erro fatal no stress test:", err);
  process.exit(1);
});
