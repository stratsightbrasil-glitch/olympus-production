// ─── Matriz 2×2 PYTHIA — tipos ────────────────────────────────────────────────

export interface Cenario {
  id: string;       // Q1 | Q2 | Q3 | Q4
  titulo: string;
  descricao: string;
  quadrante: 1 | 2 | 3 | 4;
  probabilidade?: number;  // ex: 15 → "~15%"
}

export interface Eixo {
  label: string;
  poloPos: string;   // extremo positivo / alta
  poloNeg: string;   // extremo negativo / baixa
}

export interface Matriz2x2Data {
  eixoX: Eixo;
  eixoY: Eixo;
  cenarios: Cenario[];
  titulo?: string;
}

/** Posição (0-1) dentro do quadrante */
export interface CardPosition {
  id: string;
  x: number;   // 0-1 relativo ao quadrante
  y: number;
}
