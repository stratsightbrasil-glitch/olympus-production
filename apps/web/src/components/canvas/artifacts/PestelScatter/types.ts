// ─── PESTEL Scatter — tipos ───────────────────────────────────────────────────

export type DimensaoPestel = 'P' | 'E' | 'S' | 'T' | 'A' | 'L';

export interface DriverPestel {
  id: string;
  nome: string;
  dimensao: DimensaoPestel;
  impacto: number;    // 1–5
  incerteza: number;  // 1–5
  descricao?: string;
}

export interface PestelData {
  drivers: DriverPestel[];
  titulo?: string;
}
