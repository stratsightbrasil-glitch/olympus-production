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

// ─── Definições estáticas ──────────────────────────────────────────────────────

export const METHODOLOGY_DEFS: Record<string, MethodologyStep[]> = {

  // ── MSEF — Método Multidimensional de Exploração de Futuros ──────────────────
  MSEF: [
    { num: 1, agent: 'SCOPUS',    label: 'Escopo'      },
    { num: 2, agent: 'KLIO',      label: 'Drivers'     },
    { num: 3, agent: 'PYTHIA',    label: 'Cenários'    },
    { num: 4, agent: 'MNEMOSYNE', label: 'Narrativas'  },
    { num: 5, agent: 'THEMIS',    label: 'Implicações' },
  ],

  // ── MACROPLAN ─────────────────────────────────────────────────────────────────
  MACROPLAN: [
    { num: 1, agent: 'SCOPUS',    label: 'Tema e Escopo'  },
    { num: 2, agent: 'KLIO',      label: 'Diagnóstico'    },
    { num: 3, agent: 'PYTHIA',    label: 'Cen. Referência' },
    { num: 4, agent: 'MNEMOSYNE', label: 'Cen. Alternativos' },
    { num: 5, agent: 'THEMIS',    label: 'Estratégias'    },
  ],

  // ── Grumbach — Método Prospectivo Militar Brasileiro ─────────────────────────
  Grumbach: [
    { num: 1, agent: 'SCOPUS',    label: 'Sistema'     },
    { num: 2, agent: 'KLIO',      label: 'Eventos'     },
    { num: 3, agent: 'PYTHIA',    label: 'Delphi'      },
    { num: 4, agent: 'MNEMOSYNE', label: 'Morfológica' },
    { num: 5, agent: 'THEMIS',    label: 'Cenários'    },
  ],

  // ── Godet — La Prospective ────────────────────────────────────────────────────
  Godet: [
    { num: 1, agent: 'SCOPUS',    label: 'Delimitação'  },
    { num: 2, agent: 'KLIO',      label: 'MICMAC'       },
    { num: 3, agent: 'PYTHIA',    label: 'MACTOR/SMIC'  },
    { num: 4, agent: 'MNEMOSYNE', label: 'Cenários'     },
    { num: 5, agent: 'THEMIS',    label: 'Síntese'      },
  ],

  // ── SIEX/EB — Sistema de Inteligência do Exército Brasileiro ─────────────────
  'SIEX/EB': [
    { num: 1, agent: 'SCOPUS',    label: 'Missão e Área' },
    { num: 2, agent: 'KLIO',      label: 'Ambiente'      },
    { num: 3, agent: 'PYTHIA',    label: 'Cursos CA'     },
    { num: 4, agent: 'MNEMOSYNE', label: 'Análise'       },
    { num: 5, agent: 'THEMIS',    label: 'Estimativa'    },
  ],

  // ── NATO AltA — Alternative Analysis ─────────────────────────────────────────
  ALTA: [
    { num: 1, agent: 'SCOPUS', label: 'Enquadramento' },
    { num: 2, agent: 'KLIO',   label: 'Diagnóstico'   },
    { num: 3, agent: 'PYTHIA', label: 'Futuros Alt.'  },
    { num: 4, agent: 'THEMIS', label: 'Validação'     },
  ],
};

// ─── Fallback genérico ────────────────────────────────────────────────────────

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

/**
 * Retorna as etapas da metodologia, priorizando dados vindos da API
 * (agentsConfig.steps) e caindo para definições estáticas como fallback.
 */
export function getMethodologySteps(
  methodologyName: string,
  dbMethodologies?: any[],
): MethodologyStep[] {
  // 1. DB tem steps no agentsConfig rico?
  if (dbMethodologies?.length) {
    const found = dbMethodologies.find(m => m.name === methodologyName);
    const dbSteps = found?.agentsConfig?.steps;
    if (Array.isArray(dbSteps) && dbSteps.length > 0) {
      return dbSteps as MethodologyStep[];
    }
  }
  // 2. Fallback estático
  return METHODOLOGY_DEFS[methodologyName] ?? DEFAULT_STEPS;
}
