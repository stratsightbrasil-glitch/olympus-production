/**
 * stress_test.ts — Validação estrutural das 11 metodologias (Sprint 22).
 * Execução: docker exec olympus_api npx tsx apps/api/src/scripts/stress_test.ts
 *
 * CP-1: Contagem de fases, slugs únicos, nodeSlug válidos, sequência sem lacunas
 * CP-2: Persistência JSONB sourceEvaluation (score TAD B2 com subcritérios)
 * CP-3: Trava F6 — score de ignorância absoluta persiste corretamente
 * CP-4: agentMethodPrompts existem para os agentes esperados por metodologia
 * CP-5: Ferramentas críticas estão no toolsConfig dos agentes corretos
 */

import { db, projectEvents, projects, methodologies, methodologyPhases, agentMethodPrompts, agents } from "@olympus/db";
import { and, eq, inArray } from "drizzle-orm";

const VALID_NODE_SLUGS = new Set([
  "node_framing", "node_scanning_macro", "node_scanning_forces",
  "node_retrospective", "node_modeling", "node_matrix_design",
  "node_narrative", "node_integration",
]);

// Dicionário canônico Sprint 22.
// expectedPhases: contagem real no phasesBySlug do seed.
// expectedPrompts: agentes que DEVEM ter agentMethodPrompt para esta metodologia.
// criticalTools: ferramentas que DEVEM estar no toolsConfig do agente indicado.
const CANONICAL_SUITE = [
  {
    slug: "msef", name: "MSEF v3", expectedPhases: 8,
    expectedPrompts: ["HERMES", "SCOPUS", "KLIO", "PYTHIA", "MNEMOSYNE", "THEMIS"],
    criticalTools: {
      KLIO:   ["tool_register_event", "tool_unified_search_engine", "tool_tad_score_calculator"],
      PYTHIA: ["tool_grumbach_expert_simulation"],
    },
  },
  {
    slug: "godet", name: "Godet", expectedPhases: 7,
    expectedPrompts: ["HERMES", "SCOPUS", "KLIO", "PYTHIA", "MNEMOSYNE", "THEMIS"],
    criticalTools: {
      KLIO:   ["tool_register_impact_relation"],
      PYTHIA: ["tool_mactor_analysis"],
    },
  },
  {
    slug: "grumbach", name: "Grumbach", expectedPhases: 9,
    expectedPrompts: ["HERMES", "SCOPUS", "PYTHIA", "MNEMOSYNE", "THEMIS"],
    criticalTools: {
      PYTHIA: ["tool_grumbach_expert_simulation"],
    },
  },
  {
    slug: "alta", name: "OTAN/AltA", expectedPhases: 6,
    expectedPrompts: ["HERMES", "SCOPUS", "KLIO", "PYTHIA", "MNEMOSYNE", "THEMIS"],
    criticalTools: {},
  },
  {
    slug: "siex", name: "SIEx", expectedPhases: 7,
    expectedPrompts: ["OLYMPUS", "KLIO"],
    criticalTools: {
      KLIO: ["tool_mpc_source_evaluator", "tool_tad_score_calculator"],
    },
  },
  {
    slug: "siplex", name: "SIPLEx", expectedPhases: 7,
    expectedPrompts: ["HERMES", "SCOPUS", "KLIO", "PYTHIA", "MNEMOSYNE", "THEMIS"],
    criticalTools: {
      KLIO:   ["tool_register_event"],
      PYTHIA: ["tool_register_scenario"],
    },
  },
  {
    slug: "macroplan", name: "IPEA/FGV", expectedPhases: 7,
    expectedPrompts: ["HERMES"],
    criticalTools: {},
  },
  {
    slug: "mpo", name: "MPO", expectedPhases: 8,
    expectedPrompts: ["HERMES"],
    criticalTools: { THEMIS: ["tool_mpo_backcasting"] },
  },
  {
    slug: "asplan", name: "ASPLAN", expectedPhases: 7,
    expectedPrompts: ["HERMES"],
    criticalTools: {},
  },
  {
    slug: "futures", name: "GBN", expectedPhases: 8,
    expectedPrompts: ["HERMES"],
    criticalTools: {},
  },
  {
    slug: "esg", name: "ESG", expectedPhases: 6,
    expectedPrompts: ["HERMES", "SCOPUS", "KLIO", "PYTHIA", "MNEMOSYNE", "ATHENA"],
    criticalTools: { PYTHIA: ["tool_esg_rii_calculator"] },
  },
] as const;

async function runStressTest() {
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("🧪 STRESS TEST ESTRUTURAL — OLYMPUS V4 (Sprint 22)");
  console.log(`📅 ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════════════════");

  const failures: string[] = [];
  let passed = 0;

  const testId = `stress_${Date.now()}`;
  await db.insert(projects).values({ id: testId, name: "STRESS_TEST_AUTO", methodology: "msef" });

  for (const target of CANONICAL_SUITE) {
    console.log(`\n▶ [${target.slug}] ${target.name}`);
    try {
      // CP-1: Integridade de fases
      process.stdout.write("  ├─ CP-1 Fases... ");
      const method = await db.query.methodologies.findFirst({
        where: eq(methodologies.slug, target.slug),
      });
      if (!method) throw new Error(`Metodologia '${target.slug}' não encontrada no banco.`);

      const dbPhases = await db.select().from(methodologyPhases)
        .where(eq(methodologyPhases.methodologyId, method.id))
        .orderBy(methodologyPhases.phaseNum);

      if (dbPhases.length !== target.expectedPhases)
        throw new Error(`Esperado ${target.expectedPhases} fases, encontrado ${dbPhases.length}.`);

      const slugs = dbPhases.map(p => p.slug);
      if (new Set(slugs).size !== slugs.length) {
        const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
        throw new Error(`Slugs duplicados: ${dupes.join(", ")}`);
      }
      for (const p of dbPhases) {
        if (p.nodeSlug && !VALID_NODE_SLUGS.has(p.nodeSlug))
          throw new Error(`Fase ${p.phaseNum}: nodeSlug inválido '${p.nodeSlug}'`);
        if (p.phaseNum !== dbPhases.indexOf(p) + 1)
          throw new Error(`Sequência quebrada em phaseNum ${p.phaseNum}`);
      }
      console.log(`✅ ${dbPhases.length} fases`);

      // CP-2: JSONB com subcritérios TAD
      process.stdout.write("  ├─ CP-2 JSONB TAD (B2 + subcritérios)... ");
      const [ev] = await db.insert(projectEvents).values({
        projectId: testId, name: `TAD_${target.slug}`,
        description: "Teste", type: "uncertainty", status: "approved",
        sourceEvaluation: {
          alphanumericScore: "B2",
          reliabilityCriteria: { autenticidade: 2, confiabilidade: 2, competencia: 2 },
          credibilityCriteria: { coerencia: 2, compatibilidade: 2, semelhanca: 2 },
        },
      }).returning();
      const chk = await db.query.projectEvents.findFirst({ where: eq(projectEvents.id, ev.id) });
      if ((chk?.sourceEvaluation as any)?.alphanumericScore !== "B2")
        throw new Error("JSONB corrompido — alphanumericScore B2 não preservado.");
      if (!(chk?.sourceEvaluation as any)?.reliabilityCriteria)
        throw new Error("JSONB corrompido — reliabilityCriteria ausente.");
      console.log("✅ íntegro");

      // CP-3: Trava F6
      process.stdout.write("  ├─ CP-3 F6... ");
      const [f6] = await db.insert(projectEvents).values({
        projectId: testId, name: `F6_${target.slug}`,
        description: "Teste F6", type: "uncertainty", status: "proposed",
        sourceEvaluation: {
          alphanumericScore: "F6",
          reliabilityCriteria: { autenticidade: 6, confiabilidade: 6, competencia: 6 },
          credibilityCriteria: { coerencia: 6, compatibilidade: 6, semelhanca: 6 },
        },
      }).returning();
      if ((f6.sourceEvaluation as any)?.alphanumericScore !== "F6")
        throw new Error("F6 não persistido.");
      console.log("✅");

      // CP-4: agentMethodPrompts
      process.stdout.write("  ├─ CP-4 Prompts... ");
      const agentRows = await db.query.agents.findMany({
        where: inArray(agents.name, [...target.expectedPrompts] as string[]),
      });
      const prompts = await db.query.agentMethodPrompts.findMany({
        where: and(
          inArray(agentMethodPrompts.agentId, agentRows.map(a => a.id)),
          eq(agentMethodPrompts.methodologyId, method.id),
        ),
      });
      const found = prompts.map(p => agentRows.find(a => a.id === p.agentId)?.name).filter(Boolean);
      const missing = (target.expectedPrompts as readonly string[]).filter(n => !found.includes(n));
      if (missing.length > 0) throw new Error(`Prompts ausentes: ${missing.join(", ")}`);
      console.log(`✅ ${prompts.length}`);

      // CP-5: Ferramentas críticas
      if (Object.keys(target.criticalTools).length > 0) {
        process.stdout.write("  ├─ CP-5 Ferramentas críticas... ");
        const issues: string[] = [];
        for (const [agentName, tools] of Object.entries(target.criticalTools)) {
          const row = await db.query.agents.findFirst({ where: eq(agents.name, agentName) });
          if (!row) { issues.push(`${agentName} não encontrado`); continue; }
          const cfg: string[] = Array.isArray(row.toolsConfig) ? row.toolsConfig as string[]
            : JSON.parse(typeof row.toolsConfig === "string" ? row.toolsConfig : "[]");
          for (const t of tools as string[]) {
            if (!cfg.includes(t)) issues.push(`${agentName} falta '${t}'`);
          }
        }
        if (issues.length > 0) throw new Error(issues.join("; "));
        console.log("✅");
      }

      await db.delete(projectEvents).where(eq(projectEvents.projectId, testId));
      console.log(`  └─ ✅ PASSOU`);
      passed++;
    } catch (err: any) {
      const msg = `[${target.slug}] ${err.message}`;
      console.error(`  └─ ❌ ${msg}`);
      failures.push(msg);
      await db.delete(projectEvents).where(eq(projectEvents.projectId, testId)).catch(() => {});
    }
  }

  await db.delete(projects).where(eq(projects.id, testId)).catch(() => {});

  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log(`📊 ${passed}/${CANONICAL_SUITE.length} metodologias OK`);
  if (failures.length > 0) {
    console.log("\n❌ FALHAS:");
    failures.forEach(f => console.log(`   • ${f}`));
    process.exit(1);
  } else {
    console.log("\n✅ Sprint 22 estruturalmente íntegra.");
    process.exit(0);
  }
}

runStressTest().catch(err => { console.error("Erro fatal:", err); process.exit(1); });
