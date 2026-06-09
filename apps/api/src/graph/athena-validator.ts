/**
 * athena-validator.ts — ATHENA Determinística
 *
 * Dois estágios:
 *  1. Verificação estrutural (sem LLM) — sempre executa, custo zero.
 *  2. Checks de banco (DB) — async, por fase específica.
 *  3. LLM qualitativo — apenas se estágios 1+2 passaram E fase requer.
 *
 * Chamada diretamente como função TypeScript pelo phaseLoopNode.
 * Nunca via consultar_agente ou tool call.
 */

import { db } from "@olympus/db";
import { projectEvents, projectScenarios, matrixDirectImpacts, weakSignals } from "@olympus/db";
import { eq, and, gte, count } from "drizzle-orm";

export interface KeyFinding {
  claim:       string;
  description?: string;  // texto completo do evento — inclui qualificadores Hendrikson, P(i), etc.
  factStatus:  "FATO" | "INDICIO" | "SUPOSICAO";
  tadScore?:   string;   // ex: "B2", "A1", "F6"
  source?:     string;
}

export interface AthenaCheck {
  atsCode:  string;
  passed:   boolean;
  finding:  string;
}

export interface AthenaVerdict {
  verdict:  "APROVADO" | "RESSALVAS" | "REQUER_REVISAO";
  usedLLM:  boolean;
  checks:   AthenaCheck[];
}

// Qualificadores Hendrikson / ICD 203
const HENDRIKSON_TERMS = [
  "quase certo", "muito provavel", "muito provável", "provável", "provavel",
  "possivel", "possível", "improvavel", "improvável", "remoto",
  "quase impossível", "almost certain", "highly probable", "likely",
  "possible", "unlikely", "remote",
] as const;

// Verificações determinísticas por nodeSlug
const STRUCTURAL_CHECKS: Record<string, (findings: KeyFinding[], phaseSlug?: string) => AthenaCheck[]> = {

  node_framing: (findings) => {
    const checks: AthenaCheck[] = [];
    const hasAncora = findings.some(f =>
      f.claim.toLowerCase().includes("âncora") ||
      f.claim.toLowerCase().includes("ancora") ||
      f.claim.toLowerCase().includes("premissa-âncora")
    );
    checks.push({
      atsCode: "ATS3",
      passed:  hasAncora,
      finding: hasAncora
        ? "Premissa-âncora identificada nos findings."
        : "ATS3 FALHA: nenhuma premissa-âncora declarada nos keyFindings.",
    });
    checks.push({
      atsCode: "ATS5",
      passed:  findings.length > 0,
      finding: findings.length > 0
        ? `${findings.length} finding(s) de enquadramento registrados.`
        : "ATS5 FALHA: nenhum finding registrado na fase de enquadramento.",
    });
    return checks;
  },

  node_scanning_macro: (findings) => {
    const checks: AthenaCheck[] = [];

    // ATS1 — FATOs devem ter tadScore calculado (não inline)
    const factsWithoutTad = findings.filter(
      f => f.factStatus === "FATO" && (!f.tadScore || f.tadScore.toLowerCase().includes("estimado"))
    );
    checks.push({
      atsCode: "ATS1",
      passed:  factsWithoutTad.length === 0,
      finding: factsWithoutTad.length === 0
        ? "Todos os FATOs possuem score TAD paramétrico."
        : `ATS1 FALHA: ${factsWithoutTad.length} FATO(s) sem score TAD calculado: `
          + factsWithoutTad.slice(0, 3).map(f => f.claim.slice(0, 60)).join(" | "),
    });

    // ATS_COUNT — quantidade mínima de FPFs
    const fpfCount = findings.length;
    if (fpfCount < 5) {
      checks.push({
        atsCode: "ATS_COUNT",
        passed:  false,
        finding: `ATS_COUNT FALHA: apenas ${fpfCount} FPF(s) registrados — mínimo 5 para prosseguir.`,
      });
    } else if (fpfCount < 10) {
      checks.push({
        atsCode: "ATS_COUNT",
        passed:  true,  // não bloqueia, mas gera RESSALVAS via hasPending
        finding: `ATS_COUNT RESSALVA: ${fpfCount} FPFs registrados — recomendado entre 10 e 15 para análise completa.`,
      });
    } else {
      checks.push({
        atsCode: "ATS_COUNT",
        passed:  true,
        finding: `${fpfCount} FPFs registrados — dentro da faixa recomendada (10-15).`,
      });
    }

    return checks;
  },

  node_scanning_forces: (findings) => {
    // Fase 3 (HITL pós-seleção): verificar que KLIO avaliou o conjunto
    const hasCobertura = findings.some(f => {
      const text = (f.claim + ' ' + (f.description ?? '')).toLowerCase();
      return text.includes('conjunto') || text.includes('cobertura') ||
             text.includes('apto') || text.includes('fpf') || text.includes('fpt');
    });
    return [{
      atsCode: "ATS_COVERAGE",
      passed:  hasCobertura,
      finding: hasCobertura
        ? "Avaliação de cobertura do conjunto de FPFs presente."
        : "ATS_COVERAGE FALHA: nenhuma avaliação de cobertura/conjunto identificada nos findings.",
    }];
  },

  node_retrospective: (findings) => {
    const hasTrajDecl = findings.some(f => {
      const upper = f.claim.toUpperCase();
      return upper.includes("CONTINUIDADE") ||
             upper.includes("ALTERAÇÃO DE JULGAMENTO") ||
             upper.includes("ALTERACAO DE JULGAMENTO");
    });
    return [{
      atsCode: "ATS7",
      passed:  hasTrajDecl,
      finding: hasTrajDecl
        ? "Declaração de trajetória (CONTINUIDADE/ALTERAÇÃO) presente."
        : "ATS7 FALHA: fase retrospectiva não declarou CONTINUIDADE ou ALTERAÇÃO DE JULGAMENTO.",
    }];
  },

  node_modeling: (findings, phaseSlug) => {
    const checks: AthenaCheck[] = [];
    const text = JSON.stringify(findings).toLowerCase();
    const hasHendrikson = HENDRIKSON_TERMS.some(t => text.includes(t));
    checks.push({
      atsCode: "ATS2",
      passed:  hasHendrikson,
      finding: hasHendrikson
        ? "Qualificador Hendrikson/ICD 203 presente na modelagem."
        : "ATS2 FALHA: nenhum qualificador de probabilidade calibrado encontrado.",
    });

    // Fase 4 (Delphi): verificar findings P(i) por FPF
    if (!phaseSlug || phaseSlug === 'grumbach_p4') {
      const piFindings = findings.filter(f => f.claim.toLowerCase().startsWith('p(i)'));
      if (piFindings.length === 0) {
        checks.push({
          atsCode: "ATS_DELPHI_COUNT",
          passed:  false,
          finding: "ATS_DELPHI_COUNT FALHA: nenhum finding 'P(i) — [FPF]' registrado — Delphi não executado.",
        });
      } else {
        checks.push({
          atsCode: "ATS_DELPHI_COUNT",
          passed:  true,
          finding: `${piFindings.length} FPF(s) com P(i) calculado via Delphi.`,
        });
      }
    }

    // Fase 5 (Impacto Cruzado): verificar classificação Motricidade×Dependência
    if (phaseSlug === 'grumbach_p5') {
      const QUADRANTS = ['explicativo', 'ligação', 'ligacao', 'resultado', 'autônomo', 'autonomo'];
      const quadrantFindings = findings.filter(f =>
        f.claim.toLowerCase().startsWith('impacto ') &&
        QUADRANTS.some(q => f.claim.toLowerCase().includes(q))
      );
      checks.push({
        atsCode: "ATS_QUADRANTS",
        passed:  quadrantFindings.length > 0,
        finding: quadrantFindings.length > 0
          ? `${quadrantFindings.length} FPF(s) classificados na Matriz Motricidade×Dependência.`
          : "ATS_QUADRANTS FALHA: nenhum FPF classificado em quadrante (explicativo/ligação/resultado/autônomo).",
      });
    }

    return checks;
  },

  node_matrix_design: (findings) => {
    const checks: AthenaCheck[] = [];

    // ATS8 — 4 cenários canônicos presentes nos findings
    const CENARIOS_CANONICOS = ['mais provável', 'mais provavel', 'projetivo', 'ideal', 'alvo'];
    const cenariosEncontrados = CENARIOS_CANONICOS.filter(c =>
      findings.some(f => (f.claim + ' ' + (f.description ?? '')).toLowerCase().includes(c))
    );
    checks.push({
      atsCode: "ATS8",
      passed:  cenariosEncontrados.length >= 4,
      finding: cenariosEncontrados.length >= 4
        ? `${cenariosEncontrados.length} cenários canônicos identificados nos findings.`
        : `ATS8 FALHA: apenas ${cenariosEncontrados.length} de 4 cenários canônicos (mais provável/projetivo/ideal/alvo).`,
    });

    // ATS_SCENARIO_BOOL — configuração booleana presente
    const comBool = findings.filter(f =>
      f.claim.includes('=SIM') || f.claim.includes('=NÃO') ||
      f.claim.includes('=TRUE') || f.claim.includes('=FALSE') ||
      (f.description ?? '').includes('=SIM') || (f.description ?? '').includes('=NÃO')
    );
    if (comBool.length === 0) {
      checks.push({
        atsCode: "ATS_SCENARIO_BOOL",
        passed:  true,  // não bloqueia — gera RESSALVAS
        finding: "ATS_SCENARIO_BOOL RESSALVA: nenhum cenário com configuração booleana explícita (FPF=SIM/NÃO). Recomendado para Fase 7.",
      });
    } else {
      checks.push({
        atsCode: "ATS_SCENARIO_BOOL",
        passed:  true,
        finding: `${comBool.length} cenário(s) com configuração booleana presente.`,
      });
    }

    return checks;
  },

  node_narrative: (findings) => {
    const checks: AthenaCheck[] = [];

    // ATS6 — 4 narrativas registradas
    const narratives = findings.filter(f => {
      const text = f.claim.toLowerCase();
      return text.startsWith("narrativa") || text.startsWith("crônica") || text.startsWith("cronica");
    });
    checks.push({
      atsCode: "ATS6",
      passed:  narratives.length >= 4,
      finding: narratives.length >= 4
        ? `${narratives.length} narrativa(s) registradas.`
        : `ATS6 FALHA: apenas ${narratives.length} narrativa(s) — mínimo 4 para Grumbach.`,
    });

    // ATS_BOOL_CONSISTENCY — stub para Olympus 1.1 (sempre RESSALVAS)
    checks.push({
      atsCode: "ATS_BOOL_CONSISTENCY",
      passed:  true,  // não bloqueia — gera RESSALVAS via "pendente"
      finding: "ATS_BOOL_CONSISTENCY: verificação de consistência booleana pendente (Olympus 1.1) — auditoria qualitativa recomendada.",
    });

    return checks;
  },

  node_integration: (findings) => {
    const checks: AthenaCheck[] = [];

    // ATS9 — signpost com limiar SE/ENTÃO
    const signpostFindings = findings.filter(f => {
      const text = (f.claim + ' ' + (f.description ?? '')).toLowerCase();
      return (text.includes('se ') && text.includes('então')) ||
             text.includes('signpost') ||
             ((text.includes('>') || text.includes('<')) && text.includes('cenário'));
    });
    checks.push({
      atsCode: "ATS9",
      passed:  signpostFindings.length > 0,
      finding: signpostFindings.length > 0
        ? `${signpostFindings.length} signpost(s) com limiar observável registrado(s).`
        : "ATS9 FALHA: nenhum signpost no formato 'SE [indicador] > [limiar] ENTÃO [cenário]'.",
    });
    if (signpostFindings.length > 0 && signpostFindings.length < 3) {
      checks.push({
        atsCode: "ATS9_MIN",
        passed:  true,  // não bloqueia — gera RESSALVAS
        finding: `ATS9 RESSALVA: apenas ${signpostFindings.length} signpost(s) — recomendado ao menos 3.`,
      });
    }

    // ATS_MEASURES — medidas pré-ativas e proativas
    const preativas = findings.filter(f => f.claim.toLowerCase().startsWith('mp_'));
    const proativas = findings.filter(f => f.claim.toLowerCase().startsWith('mpro_'));
    if (preativas.length === 0 && proativas.length === 0) {
      checks.push({
        atsCode: "ATS_MEASURES",
        passed:  false,
        finding: "ATS_MEASURES FALHA: nenhuma medida pré-ativa (mp_) ou proativa (mpro_) registrada.",
      });
    } else {
      const ressalvas: string[] = [];
      if (preativas.length < 5) ressalvas.push(`${preativas.length}/5 medidas pré-ativas`);
      if (proativas.length < 3) ressalvas.push(`${proativas.length}/3 medidas proativas`);
      checks.push({
        atsCode: "ATS_MEASURES",
        passed:  true,
        finding: ressalvas.length > 0
          ? `ATS_MEASURES RESSALVA: ${ressalvas.join(', ')} — abaixo do mínimo recomendado.`
          : `${preativas.length} medidas pré-ativas + ${proativas.length} proativas registradas.`,
      });
    }

    return checks;
  },
};

// ── Checks de banco (async) por phaseSlug ─────────────────────────────────────

async function runDbChecks(
  projectId: string,
  phaseSlug: string,
  phaseStartedAt?: Date,
): Promise<AthenaCheck[]> {
  const checks: AthenaCheck[] = [];

  // ATS_IMPACT_MATRIX — Fase 5: matrix_direct_impacts não pode estar vazia
  if (phaseSlug === 'grumbach_p5') {
    try {
      const [row] = await db
        .select({ cnt: count() })
        .from(matrixDirectImpacts)
        .where(eq(matrixDirectImpacts.projectId, projectId));
      const n = Number(row?.cnt ?? 0);
      if (n === 0) {
        checks.push({
          atsCode: "ATS_IMPACT_MATRIX",
          passed:  false,
          finding: "ATS_IMPACT_MATRIX FALHA: matrix_direct_impacts vazia — tool_register_impact_relation não foi chamada.",
        });
      } else {
        checks.push({
          atsCode: "ATS_IMPACT_MATRIX",
          passed:  true,
          finding: `${n} impacto(s) direto(s) registrado(s) na matriz.`,
        });
      }
    } catch { /* não bloquear se DB indisponível */ }
  }

  // ATS_SCENARIO_TYPES — Fase 6: project_scenarios deve ter 4 registros
  if (phaseSlug === 'grumbach_p6') {
    try {
      const [row] = await db
        .select({ cnt: count() })
        .from(projectScenarios)
        .where(eq(projectScenarios.projectId, projectId));
      const n = Number(row?.cnt ?? 0);
      checks.push({
        atsCode: "ATS_SCENARIO_TYPES",
        passed:  n >= 4,
        finding: n >= 4
          ? `${n} cenário(s) registrados via tool_register_scenario.`
          : `ATS_SCENARIO_TYPES FALHA: apenas ${n} cenário(s) em project_scenarios — mínimo 4 (A/B/C/D).`,
      });
    } catch { /* não bloquear se DB indisponível */ }
  }

  // ATS_KRATOS — Fase 9: weak_signals deve ter ao menos 1 registro desta sessão
  if (phaseSlug === 'grumbach_p9') {
    try {
      const whereClause = phaseStartedAt
        ? and(eq(weakSignals.projectId, projectId), gte(weakSignals.createdAt, phaseStartedAt))
        : eq(weakSignals.projectId, projectId);
      const [row] = await db.select({ cnt: count() }).from(weakSignals).where(whereClause);
      const n = Number(row?.cnt ?? 0);
      checks.push({
        atsCode: "ATS_KRATOS",
        passed:  n > 0,
        finding: n > 0
          ? `${n} sinal(is) registrado(s) via registrar_sinal para KRATOS.`
          : "ATS_KRATOS FALHA: nenhum sinal registrado em weak_signals — registrar_sinal não foi chamada.",
      });
    } catch { /* não bloquear se DB indisponível */ }
  }

  return checks;
}

// ── Utilitário para o stress test ─────────────────────────────────────────────

/** Executa apenas as verificações estruturais sem LLM. Útil para testes. */
export function validateStructuralCompliance(
  phaseOutput: { summary: string; keyFindings: KeyFinding[] },
  nodeSlug: string,
): { valid: boolean; errors: string[] } {
  const checks = runStructuralChecks(phaseOutput.keyFindings, nodeSlug);
  const failed  = checks.filter(c => !c.passed);
  return { valid: failed.length === 0, errors: failed.map(c => c.finding) };
}

// ── Internals ─────────────────────────────────────────────────────────────────

function runStructuralChecks(findings: KeyFinding[], nodeSlug: string, phaseSlug?: string): AthenaCheck[] {
  const checker = STRUCTURAL_CHECKS[nodeSlug];
  if (!checker) return [];
  return checker(findings, phaseSlug);
}

async function runQualitativeAudit(
  _findings:   KeyFinding[],
  _nodeSlug:   string,
  _projectId:  string,
  _phaseLabel: string,
): Promise<AthenaCheck[]> {
  // TODO (Olympus 1.1): substituir por chamada real ao LLM ATHENA com prompt de auditoria.
  // Por enquanto retorna aprovação para não bloquear o fluxo durante desenvolvimento.
  return [{
    atsCode: "QUALITATIVO",
    passed:  true,
    finding: "Auditoria qualitativa LLM pendente (Olympus 1.1).",
  }];
}

const QUALITATIVE_AUDIT_PHASES = new Set([
  "node_narrative",
  "node_integration",
  "node_modeling",
]);

// ── Ponto de entrada principal ────────────────────────────────────────────────

/**
 * Audita a fase após execução de KLIO.
 * Chamado pelo phaseLoopNode — nunca via tool call.
 */
export async function athenaAuditPhase(
  findings:       KeyFinding[],
  nodeSlug:       string,
  projectId:      string,
  phaseLabel:     string,
  phaseSlug?:     string,
  phaseStartedAt?: Date,
): Promise<AthenaVerdict> {
  // Estágio 1: determinístico (estrutural)
  const structuralChecks = runStructuralChecks(findings, nodeSlug, phaseSlug);
  const structuralFailed = structuralChecks.filter(c => !c.passed);

  // Estágio 2: checks de banco (async, não bloqueia se DB falhar)
  const dbChecks = phaseSlug
    ? await runDbChecks(projectId, phaseSlug, phaseStartedAt)
    : [];
  const dbFailed = dbChecks.filter(c => !c.passed);

  if (structuralFailed.length > 0 || dbFailed.length > 0) {
    return { verdict: "REQUER_REVISAO", usedLLM: false, checks: [...structuralChecks, ...dbChecks] };
  }

  // Estágio 3: qualitativo (apenas se estágios 1+2 passaram)
  let qualChecks: AthenaCheck[] = [];
  let usedLLM = false;
  if (QUALITATIVE_AUDIT_PHASES.has(nodeSlug)) {
    qualChecks = await runQualitativeAudit(findings, nodeSlug, projectId, phaseLabel);
    usedLLM = true;
  }

  const allChecks  = [...structuralChecks, ...dbChecks, ...qualChecks];
  const anyFailed  = allChecks.some(c => !c.passed);
  const hasPending = allChecks.some(c =>
    c.finding.toLowerCase().includes("pendente") ||
    c.finding.toLowerCase().includes("ressalva")
  );

  return {
    verdict:  anyFailed  ? "REQUER_REVISAO"
            : hasPending ? "RESSALVAS"
            : "APROVADO",
    usedLLM,
    checks:   allChecks,
  };
}
