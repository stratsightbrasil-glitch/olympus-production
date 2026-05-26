// ─── Definição de Etapas por Metodologia ─────────────────────────────────────
// Fonte canônica para o stepper do CommandBar.
// A UI consome estas definições estáticas como fallback;
// quando a API retornar agentsConfig.steps, esses dados têm prioridade.

import type { Agent } from '../components/ui/AgentMark/types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MethodologyStep {
  num: number;
  agent: Agent;
  label: string;
}

// ─── Fallback genérico (usado quando API não retorna steps) ──────────────────

export const DEFAULT_STEPS: MethodologyStep[] = [
  { num: 1, agent: 'SCOPUS',    label: 'Escopo'     },
  { num: 2, agent: 'KLIO',      label: 'Análise'    },
  { num: 3, agent: 'PYTHIA',    label: 'Cenários'   },
  { num: 4, agent: 'MNEMOSYNE', label: 'Narrativas' },
  { num: 5, agent: 'THEMIS',    label: 'Síntese'    },
];

// ─── Padrões de detecção de etapa por agente ──────────────────────────────────
// Usados no App.tsx para derivar currentStep a partir do histórico de mensagens.

export const STEP_DETECTION_PATTERNS: Record<string, RegExp[]> = {
  SCOPUS:    [/escopo\s+da\s+an[aá]lise/i, /ficha\s+de\s+escopo/i, /quest[aã]o\s+estrat[eé]gica/i, /SCOPUS/i],
  KLIO:      [/driver[s]?\s+da\s+mudan[çc]a/i, /força[s]?\s+motrizes/i, /V[1-5]\s*[—–-]/i, /PESTEL/i, /MICMAC/i, /diagn[oó]stico/i, /KLIO/i],
  PYTHIA:    [/eixo[s]?\s+(de\s+)?incerteza/i, /matriz\s*2[x×]2/i, /Delphi/i, /MACTOR/i, /SMIC/i, /[Cc]urso[s]?\s+de\s+[Aa][çc][aã]o/i, /PYTHIA/i],
  MNEMOSYNE: [/narrativa[s]?\s+de\s+cen[aá]rio/i, /morfol[oó]gica/i, /logline/i, /MNEMOSYNE/i],
  THEMIS:    [/implica[çc][oõ]es\s+estrat[eé]gicas/i, /alerta[s]?\s+precoce[s]?/i, /estimativa\s+de\s+intelig[eê]ncia/i, /s[ií]ntese/i, /THEMIS/i],
};

// ─── Função de resolução ──────────────────────────────────────────────────────

export function getMethodologySteps(
  methodologyName: string,
  dbMethodologies?: any[],
): MethodologyStep[] {
  if (dbMethodologies?.length) {
    const found = dbMethodologies.find(
      (m: any) => m.name === methodologyName || m.slug === methodologyName.toLowerCase(),
    );
    const dbSteps = found?.steps;
    if (Array.isArray(dbSteps) && dbSteps.length > 0) {
      return dbSteps as MethodologyStep[];
    }
  }
  return DEFAULT_STEPS;
}
