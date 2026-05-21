export type Agent = 'HERMES' | 'SCOPUS' | 'KLIO' | 'PYTHIA' | 'MNEMOSYNE' | 'THEMIS' | 'KRATOS';
export type Scale = 'full' | 'compact' | 'micro';

export interface AgentMarkProps {
  name: Agent;
  scale?: Scale;   // default 'compact'
  size?: number;   // override em px
  active?: boolean; // troca fundo para gold (#C9A84C)
  dimmed?: boolean; // opacidade reduzida — usado em etapas futuras
  className?: string;
  title?: string;
}

export interface GlyphColors {
  bg: string;
  primary: string;    // traço branco ou escuro
  accent: string;     // ouro (#C9A84C) ou escuro
  third: string;      // verde-bandeira (#5A9E6F) ou escuro
}

export const STANDARD_COLORS: GlyphColors = {
  bg: '#1B3A2D',
  primary: '#ffffff',
  accent: '#C9A84C',
  third: '#5A9E6F',
};

export const ACTIVE_COLORS: GlyphColors = {
  bg: '#C9A84C',
  primary: '#142218',
  accent: '#142218',
  third: '#142218',
};

export const DEFAULT_SIZES: Record<Scale, number> = {
  full: 96,
  compact: 28,
  micro: 14,
};
