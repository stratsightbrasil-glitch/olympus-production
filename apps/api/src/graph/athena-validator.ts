/**
 * athena-validator.ts — ATHENA Determinística
 *
 * Dois estágios:
 *  1. Verificação estrutural (sem LLM) — sempre executa, custo zero.
 *  2. LLM qualitativo — apenas se estágio 1 passou E fase requer.
 *
 * Chamada diretamente como função TypeScript pelo phaseLoopNode.
 * Nunca via consultar_agente ou tool call.
 */

export interface KeyFinding {
  claim:      string;
  factStatus: "FATO" | "INDICIO" | "SUPOSICAO";
  tadScore?:  string;   // ex: "B2", "A1", "F6"
  source?:    string;
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
const STRUCTURAL_CHECKS: Record<string, (findings: KeyFinding[]) => AthenaCheck[]> = {

  node_framing: (findings) => {
    const checks: AthenaCheck[] = [];
    const hasLinchpin = findings.some(f =>
      f.claim.toLowerCase().includes("linchpin") ||
      f.claim.toLowerCase().includes("premissa-linchpin")
    );
    checks.push({
      atsCode: "ATS3",
      passed:  hasLinchpin,
      finding: hasLinchpin
        ? "Premissa-linchpin identificada nos findings."
        : "ATS3 FALHA: nenhuma premissa-linchpin declarada nos keyFindings.",
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
    const factsWithoutTad = findings.filter(
      f => f.factStatus === "FATO" && !f.tadScore
    );
    return [{
      atsCode: "ATS1",
      passed:  factsWithoutTad.length === 0,
      finding: factsWithoutTad.length === 0
        ? "Todos os FATOs possuem score TAD paramétrico."
        : `ATS1 FALHA: ${factsWithoutTad.length} FATO(s) sem score TAD: `
          + factsWithoutTad.slice(0, 3).map(f => f.claim.slice(0, 60)).join(" | "),
    }];
  },

  node_scanning_forces: (findings) => {
    return STRUCTURAL_CHECKS["node_scanning_macro"](findings);
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

  node_modeling: (findings) => {
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
    checks.push({
      atsCode: "ATS8",
      passed:  findings.length >= 2,
      finding: findings.length >= 2
        ? `${findings.length} hipóteses/incertezas distintas formuladas.`
        : "ATS8 FALHA: modelagem com menos de 2 elementos distintos.",
    });
    return checks;
  },

  node_matrix_design: (findings) => {
    const scenarios = findings.filter(f => {
      const lower = f.claim.toLowerCase();
      return lower.includes("cenário") || lower.includes("cenario") ||
             lower.includes("cena a") || lower.includes("cena b") ||
             lower.includes("cena c") || lower.includes("cena d");
    });
    return [{
      atsCode: "ATS8",
      passed:  scenarios.length >= 4,
      finding: scenarios.length >= 4
        ? `${scenarios.length} cenas/cenários mapeados.`
        : `ATS8 FALHA: apenas ${scenarios.length} cena(s) — mínimo 4 para Grumbach.`,
    }];
  },

  node_narrative: (findings) => {
    const narratives = findings.filter(f => {
      const lower = f.claim.toLowerCase();
      return lower.startsWith("narrativa") || lower.startsWith("crônica") ||
             lower.startsWith("cronica") || lower.includes("narrativa [cena");
    });
    return [{
      atsCode: "ATS6",
      passed:  narratives.length >= 4,
      finding: narratives.length >= 4
        ? `${narratives.length} narrativa(s) registradas — verificação booleana aplicável.`
        : `ATS6 FALHA: apenas ${narratives.length} narrativa(s) — mínimo 4 para Grumbach.`,
    }];
  },

  node_integration: (findings) => {
    const hasThreshold = findings.some(f =>
      f.claim.includes(">") || f.claim.includes("<") ||
      f.claim.toLowerCase().includes("limiar") ||
      f.claim.toLowerCase().includes("gatilho") ||
      f.claim.toLowerCase().includes("se ") ||
      f.claim.toLowerCase().includes("signpost")
    );
    return [{
      atsCode: "ATS9",
      passed:  hasThreshold,
      finding: hasThreshold
        ? "Sinalizador com limiar específico e observável presente."
        : "ATS9 FALHA: nenhum signpost com limiar quantificável encontrado.",
    }];
  },
};

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

function runStructuralChecks(findings: KeyFinding[], nodeSlug: string): AthenaCheck[] {
  const checker = STRUCTURAL_CHECKS[nodeSlug];
  if (!checker) return [];
  return checker(findings);
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
  findings:   KeyFinding[],
  nodeSlug:   string,
  projectId:  string,
  phaseLabel: string,
): Promise<AthenaVerdict> {
  // Estágio 1: determinístico
  const structuralChecks = runStructuralChecks(findings, nodeSlug);
  const structuralFailed = structuralChecks.filter(c => !c.passed);

  if (structuralFailed.length > 0) {
    return { verdict: "REQUER_REVISAO", usedLLM: false, checks: structuralChecks };
  }

  // Estágio 2: qualitativo (apenas se estágio 1 passou)
  let qualChecks: AthenaCheck[] = [];
  let usedLLM = false;
  if (QUALITATIVE_AUDIT_PHASES.has(nodeSlug)) {
    qualChecks = await runQualitativeAudit(findings, nodeSlug, projectId, phaseLabel);
    usedLLM = true;
  }

  const allChecks  = [...structuralChecks, ...qualChecks];
  const anyFailed  = allChecks.some(c => !c.passed);
  const hasPending = qualChecks.some(c => c.finding.toLowerCase().includes("pendente"));

  return {
    verdict:  anyFailed  ? "REQUER_REVISAO"
            : hasPending ? "RESSALVAS"
            : "APROVADO",
    usedLLM,
    checks:   allChecks,
  };
}
