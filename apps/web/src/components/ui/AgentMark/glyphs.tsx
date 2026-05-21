import { GlyphColors } from './types';

// ─── HERMES — 5 raios convergindo em flecha ───────────────────────────────────
export function HermesFull({ c }: { c: GlyphColors }) {
  return (
    <>
      <g stroke={c.accent} strokeWidth="2.4" strokeLinecap="round">
        <line x1="22" y1="24" x2="56" y2="48"/>
        <line x1="20" y1="38" x2="56" y2="48"/>
        <line x1="20" y1="48" x2="56" y2="48"/>
        <line x1="20" y1="58" x2="56" y2="48"/>
        <line x1="22" y1="72" x2="56" y2="48"/>
      </g>
      <polygon points="56,40 70,48 56,56" fill={c.third}/>
      <line x1="56" y1="48" x2="70" y2="48" stroke={c.third} strokeWidth="2.4"/>
    </>
  );
}

export function HermesCompact({ c }: { c: GlyphColors }) {
  return (
    <>
      <g stroke={c.accent} strokeWidth="1.4" strokeLinecap="round">
        <line x1="7" y1="9" x2="16" y2="14"/>
        <line x1="6" y1="14" x2="16" y2="14"/>
        <line x1="7" y1="19" x2="16" y2="14"/>
      </g>
      <polygon points="16,11 21,14 16,17" fill={c.third}/>
    </>
  );
}

export function HermesMicro({ c }: { c: GlyphColors }) {
  return (
    <>
      <line x1="3.5" y1="7" x2="8" y2="7" stroke={c.accent} strokeWidth="1" strokeLinecap="round"/>
      <polygon points="8,5.4 10.6,7 8,8.6" fill={c.third}/>
    </>
  );
}

// ─── SCOPUS — lista emoldurada ────────────────────────────────────────────────
export function ScopusFull({ c }: { c: GlyphColors }) {
  return (
    <>
      <circle cx="48" cy="48" r="32" fill="none" stroke={c.primary} strokeWidth="2.4"/>
      <circle cx="32" cy="36" r="2.8" fill={c.accent}/>
      <line x1="40" y1="36" x2="64" y2="36" stroke={c.accent} strokeWidth="2.4" strokeLinecap="round"/>
      <circle cx="32" cy="48" r="2.8" fill={c.primary}/>
      <line x1="40" y1="48" x2="60" y2="48" stroke={c.primary} strokeWidth="2.4" strokeLinecap="round"/>
      <circle cx="32" cy="60" r="2.8" fill={c.accent}/>
      <line x1="40" y1="60" x2="56" y2="60" stroke={c.accent} strokeWidth="2.4" strokeLinecap="round"/>
    </>
  );
}

export function ScopusCompact({ c }: { c: GlyphColors }) {
  return (
    <>
      <circle cx="14" cy="14" r="9.5" fill="none" stroke={c.primary} strokeWidth="1.4"/>
      <circle cx="10" cy="11" r="1.2" fill={c.accent}/>
      <line x1="12" y1="11" x2="18" y2="11" stroke={c.accent} strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="10" cy="17" r="1.2" fill={c.primary}/>
      <line x1="12" y1="17" x2="17" y2="17" stroke={c.primary} strokeWidth="1.2" strokeLinecap="round"/>
    </>
  );
}

export function ScopusMicro({ c }: { c: GlyphColors }) {
  return (
    <>
      <circle cx="7" cy="7" r="4.6" fill="none" stroke={c.primary} strokeWidth=".9"/>
      <circle cx="5.4" cy="7" r=".9" fill={c.accent}/>
      <line x1="6.6" y1="7" x2="9.2" y2="7" stroke={c.accent} strokeWidth="1" strokeLinecap="round"/>
    </>
  );
}

// ─── KLIO — hélice torcida ────────────────────────────────────────────────────
export function KlioFull({ c }: { c: GlyphColors }) {
  return (
    <>
      <path d="M 36 18 Q 60 33 36 48 Q 60 63 36 78" stroke={c.accent} strokeWidth="2.8" fill="none" strokeLinecap="round"/>
      <path d="M 60 18 Q 36 33 60 48 Q 36 63 60 78" stroke={c.third} strokeWidth="2.8" fill="none" strokeLinecap="round"/>
    </>
  );
}

export function KlioCompact({ c }: { c: GlyphColors }) {
  return (
    <>
      <path d="M 9 6 Q 19 11 9 16 Q 19 20 9 24" stroke={c.accent} strokeWidth="1.6" fill="none" strokeLinecap="round"/>
      <path d="M 19 6 Q 9 11 19 16 Q 9 20 19 24" stroke={c.primary} strokeWidth="1.6" fill="none" strokeLinecap="round"/>
    </>
  );
}

export function KlioMicro({ c }: { c: GlyphColors }) {
  return (
    <>
      <path d="M 4.6 3.6 Q 9.4 7 4.6 10.4" stroke={c.accent} strokeWidth="1.1" fill="none" strokeLinecap="round"/>
      <path d="M 9.4 3.6 Q 4.6 7 9.4 10.4" stroke={c.primary} strokeWidth="1.1" fill="none" strokeLinecap="round"/>
    </>
  );
}

// ─── PYTHIA — mira / cruzeta ──────────────────────────────────────────────────
export function PythiaFull({ c }: { c: GlyphColors }) {
  return (
    <>
      <line x1="48" y1="18" x2="48" y2="78" stroke={c.primary} strokeWidth="2.4" strokeLinecap="round"/>
      <line x1="18" y1="48" x2="78" y2="48" stroke={c.primary} strokeWidth="2.4" strokeLinecap="round"/>
      <circle cx="48" cy="48" r="12" fill="none" stroke={c.accent} strokeWidth="2.6"/>
      <circle cx="48" cy="48" r="2.2" fill={c.accent}/>
    </>
  );
}

export function PythiaCompact({ c }: { c: GlyphColors }) {
  return (
    <>
      <line x1="14" y1="6" x2="14" y2="22" stroke={c.primary} strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="6" y1="14" x2="22" y2="14" stroke={c.primary} strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="14" cy="14" r="3.6" fill="none" stroke={c.accent} strokeWidth="1.4"/>
    </>
  );
}

export function PythiaMicro({ c }: { c: GlyphColors }) {
  return (
    <>
      <line x1="7" y1="3.2" x2="7" y2="10.8" stroke={c.primary} strokeWidth="1" strokeLinecap="round"/>
      <line x1="3.2" y1="7" x2="10.8" y2="7" stroke={c.primary} strokeWidth="1" strokeLinecap="round"/>
      <circle cx="7" cy="7" r="1.6" fill={c.accent}/>
    </>
  );
}

// ─── MNEMOSYNE — camadas empilhadas ──────────────────────────────────────────
export function MnemosymeFull({ c }: { c: GlyphColors }) {
  return (
    <>
      <polygon points="48,26 72,36 48,46 24,36" fill={c.third}/>
      <polygon points="48,42 72,52 48,62 24,52" fill={c.accent}/>
      <polygon points="48,58 72,68 48,78 24,68" fill={c.primary}/>
    </>
  );
}

export function MnemosymeCompact({ c }: { c: GlyphColors }) {
  return (
    <>
      <polygon points="14,7 22,11 14,15 6,11" fill={c.third}/>
      <polygon points="14,12 22,16 14,20 6,16" fill={c.accent}/>
      <polygon points="14,17 22,21 14,25 6,21" fill={c.primary}/>
    </>
  );
}

export function MnemosymeMicro({ c }: { c: GlyphColors }) {
  return (
    <>
      <polygon points="7,4.4 11,6 7,7.6 3,6" fill={c.accent}/>
      <polygon points="7,7.8 11,9.4 7,11 3,9.4" fill={c.primary}/>
    </>
  );
}

// ─── THEMIS — balança ─────────────────────────────────────────────────────────
export function ThemisFull({ c }: { c: GlyphColors }) {
  return (
    <>
      <line x1="48" y1="22" x2="48" y2="76" stroke={c.primary} strokeWidth="2.6" strokeLinecap="round"/>
      <circle cx="48" cy="22" r="3" fill={c.accent}/>
      <line x1="36" y1="76" x2="60" y2="76" stroke={c.primary} strokeWidth="2.6" strokeLinecap="round"/>
      <line x1="22" y1="34" x2="74" y2="34" stroke={c.primary} strokeWidth="2.6" strokeLinecap="round"/>
      <line x1="26" y1="34" x2="26" y2="48" stroke={c.accent} strokeWidth="1.4"/>
      <line x1="70" y1="34" x2="70" y2="44" stroke={c.accent} strokeWidth="1.4"/>
      <path d="M 16 48 Q 26 56 36 48" stroke={c.accent} strokeWidth="2.4" fill="none"/>
      <path d="M 60 44 Q 70 52 80 44" stroke={c.accent} strokeWidth="2.4" fill="none"/>
    </>
  );
}

export function ThemisCompact({ c }: { c: GlyphColors }) {
  return (
    <>
      <line x1="14" y1="7" x2="14" y2="22" stroke={c.primary} strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="6" y1="11" x2="22" y2="11" stroke={c.primary} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M 4 15 Q 8 18 12 15" stroke={c.accent} strokeWidth="1.4" fill="none"/>
      <path d="M 16 14 Q 20 17 24 14" stroke={c.accent} strokeWidth="1.4" fill="none"/>
    </>
  );
}

export function ThemisMicro({ c }: { c: GlyphColors }) {
  return (
    <>
      <line x1="3.2" y1="5.8" x2="10.8" y2="5.8" stroke={c.primary} strokeWidth="1" strokeLinecap="round"/>
      <line x1="7" y1="4" x2="7" y2="10.4" stroke={c.primary} strokeWidth="1" strokeLinecap="round"/>
      <path d="M 2.8 8.4 Q 4.8 10 6.8 8.4" stroke={c.accent} strokeWidth="1" fill="none"/>
    </>
  );
}

// ─── KRATOS — olho + ciclo ────────────────────────────────────────────────────
export function KratosFull({ c }: { c: GlyphColors }) {
  return (
    <>
      <path d="M 20 48 A 28 28 0 0 1 76 48" fill="none" stroke={c.accent} strokeWidth="2.4" strokeLinecap="round"/>
      <polygon points="74,40 80,48 70,48" fill={c.accent}/>
      <path d="M 76 48 A 28 28 0 0 1 20 48" fill="none" stroke={c.accent} strokeWidth="2.4" strokeLinecap="round"/>
      <polygon points="22,56 16,48 26,48" fill={c.accent}/>
      <path d="M 30 48 Q 48 32 66 48 Q 48 64 30 48 Z" fill={c.primary} stroke={c.primary} strokeWidth="1"/>
      <circle cx="48" cy="48" r="7" fill={c.third}/>
      <circle cx="50" cy="46" r="2" fill={c.primary}/>
    </>
  );
}

export function KratosCompact({ c }: { c: GlyphColors }) {
  return (
    <>
      <path d="M 6 14 A 8 8 0 0 1 22 14" fill="none" stroke={c.accent} strokeWidth="1.2"/>
      <path d="M 22 14 A 8 8 0 0 1 6 14" fill="none" stroke={c.accent} strokeWidth="1.2"/>
      <ellipse cx="14" cy="14" rx="6" ry="3.4" fill={c.primary}/>
      <circle cx="14" cy="14" r="2.2" fill={c.third}/>
    </>
  );
}

export function KratosMicro({ c }: { c: GlyphColors }) {
  return (
    <>
      <ellipse cx="7" cy="7" rx="3.6" ry="2.1" fill={c.primary}/>
      <circle cx="7" cy="7" r="1.3" fill={c.third}/>
    </>
  );
}
