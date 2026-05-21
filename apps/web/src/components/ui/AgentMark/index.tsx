import React from 'react';
import {
  Agent, Scale, AgentMarkProps, GlyphColors,
  STANDARD_COLORS, ACTIVE_COLORS, DEFAULT_SIZES,
} from './types';
import {
  HermesFull, HermesCompact, HermesMicro,
  ScopusFull, ScopusCompact, ScopusMicro,
  KlioFull, KlioCompact, KlioMicro,
  PythiaFull, PythiaCompact, PythiaMicro,
  MnemosymeFull, MnemosymeCompact, MnemosymeMicro,
  ThemisFull, ThemisCompact, ThemisMicro,
  KratosFull, KratosCompact, KratosMicro,
} from './glyphs';

type GlyphFn = (props: { c: GlyphColors }) => React.ReactElement;

const GLYPHS: Record<Agent, Record<Scale, GlyphFn>> = {
  HERMES:    { full: HermesFull,    compact: HermesCompact,    micro: HermesMicro    },
  SCOPUS:    { full: ScopusFull,    compact: ScopusCompact,    micro: ScopusMicro    },
  KLIO:      { full: KlioFull,      compact: KlioCompact,      micro: KlioMicro      },
  PYTHIA:    { full: PythiaFull,    compact: PythiaCompact,    micro: PythiaMicro    },
  MNEMOSYNE: { full: MnemosymeFull, compact: MnemosymeCompact, micro: MnemosymeMicro },
  THEMIS:    { full: ThemisFull,    compact: ThemisCompact,    micro: ThemisMicro    },
  KRATOS:    { full: KratosFull,    compact: KratosCompact,    micro: KratosMicro    },
};

const VB: Record<Scale, string> = {
  full: '0 0 96 96',
  compact: '0 0 28 28',
  micro: '0 0 14 14',
};

/** Fallback quando o agente não está no enum */
function FallbackMark({ name, size }: { name: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" role="img" aria-label={name}>
      <circle cx="14" cy="14" r="14" fill="#B0C9BC"/>
      <text x="14" y="18" textAnchor="middle"
        fontFamily="DM Sans,system-ui,sans-serif"
        fontSize="9" fontWeight="700" fill="#1B3A2D">
        {name.slice(0, 2).toUpperCase()}
      </text>
    </svg>
  );
}

/** Componente principal — substitui o quadrado "{agentName.slice(0,2)}" */
export function AgentMark({
  name, scale = 'compact', size, active = false, dimmed = false,
  className, title,
}: AgentMarkProps) {
  const isValidAgent = name in GLYPHS;
  const px = size ?? DEFAULT_SIZES[scale];

  if (!isValidAgent) {
    return <FallbackMark name={name} size={px} />;
  }

  const GlyphComponent = GLYPHS[name][scale];
  const colors: GlyphColors = active ? ACTIVE_COLORS : STANDARD_COLORS;
  const wrapperStyle: React.CSSProperties = dimmed
    ? { opacity: 0.4, display: 'inline-block' }
    : { display: 'inline-block' };

  return (
    <span style={wrapperStyle} className={className}>
      <svg
        viewBox={VB[scale]}
        width={px}
        height={px}
        role="img"
        aria-label={title ?? name}
        style={{ display: 'block' }}
      >
        <title>{title ?? name}</title>
        <circle
          cx={scale === 'full' ? 48 : scale === 'compact' ? 14 : 7}
          cy={scale === 'full' ? 48 : scale === 'compact' ? 14 : 7}
          r={scale === 'full' ? 48 : scale === 'compact' ? 14 : 7}
          fill={colors.bg}
        />
        <GlyphComponent c={colors} />
      </svg>
    </span>
  );
}

// ─── ATHENA LOCKUP ────────────────────────────────────────────────────────────

interface AthenaLockupProps {
  variant?: 'flat' | '3d';
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}

const LOCKUP_SIZES = { sm: 32, md: 60, lg: 96 };

/** Ícone ATHENA flat — versão digital. Para materiais físicos usar a versão 3D (PNG). */
function AthenaFlatIcon({ px }: { px: number }) {
  const s = px / 32; // escala relativa ao tamanho sm=32
  return (
    <svg viewBox="0 0 32 32" width={px} height={px} role="img" aria-label="ATHENA">
      <title>ATHENA</title>
      {/* Brasil em amarelo (sombra) */}
      <g transform={`translate(${3.5 * s} ${6 * s}) scale(${0.15 * s})`}>
        <path d="M 30 18 C 28 14, 32 8, 38 8 L 42 6 C 46 4, 52 4, 56 8 L 60 10 C 64 8, 70 10, 74 14 C 80 18, 86 22, 90 30 C 94 38, 96 44, 94 50 C 92 56, 86 58, 82 62 C 78 68, 76 74, 72 80 C 68 86, 62 90, 56 92 L 50 95 C 46 96, 42 95, 38 92 C 34 88, 30 84, 28 78 C 24 70, 20 62, 18 54 C 14 46, 12 38, 14 30 C 16 24, 20 20, 24 18 Z" fill="#FFD93D"/>
      </g>
      {/* Brasil em verde */}
      <g transform={`translate(${2 * s} ${4 * s}) scale(${0.15 * s})`}>
        <path d="M 30 18 C 28 14, 32 8, 38 8 L 42 6 C 46 4, 52 4, 56 8 L 60 10 C 64 8, 70 10, 74 14 C 80 18, 86 22, 90 30 C 94 38, 96 44, 94 50 C 92 56, 86 58, 82 62 C 78 68, 76 74, 72 80 C 68 86, 62 90, 56 92 L 50 95 C 46 96, 42 95, 38 92 C 34 88, 30 84, 28 78 C 24 70, 20 62, 18 54 C 14 46, 12 38, 14 30 C 16 24, 20 20, 24 18 Z" fill="#2D5C3A"/>
      </g>
      {/* Flecha ascendente */}
      <path d={`M ${6*s} ${26*s} L ${14*s} ${20*s} L ${19*s} ${22*s} L ${25*s} ${14*s}`}
        stroke="#1B3A2D" strokeWidth={`${2.4*s}`} fill="none"
        strokeLinecap="round" strokeLinejoin="round"/>
      <polygon points={`${25*s},${14*s} ${23*s},${18*s} ${27*s},${17*s} ${25*s},${14*s}`} fill="#1B3A2D"/>
      {/* Esfera global */}
      <circle cx={`${25*s}`} cy={`${12*s}`} r={`${4*s}`} fill="#1A4A7A"/>
      {/* Faixa branca */}
      <path d={`M ${22*s} ${12.5*s} Q ${25*s} ${11*s} ${28*s} ${12.5*s}`}
        stroke="#fff" strokeWidth={`${0.8*s}`} fill="none"/>
    </svg>
  );
}

export function AthenaLockup({
  variant = 'flat', size = 'md', showWordmark = true,
}: AthenaLockupProps) {
  const px = LOCKUP_SIZES[size];

  if (variant === '3d') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img
          src="/assets/brand/ATHENA.png"
          alt="ATHENA v2.0"
          style={{ width: px, height: 'auto' }}
        />
        {showWordmark && (
          <div>
            <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 700, fontSize: px * 0.25, color: '#1B3A2D', letterSpacing: '1px', lineHeight: 1 }}>
              ATHENA
            </div>
            <div style={{ fontFamily: "'DM Mono','Cascadia Code',monospace", fontSize: px * 0.10, color: '#6B8C7A', letterSpacing: '1.4px', marginTop: 2 }}>
              v2.0 · MOTOR ATIVO
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size === 'sm' ? 6 : 10 }}>
      <AthenaFlatIcon px={px} />
      {showWordmark && (
        <div>
          <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 700, fontSize: Math.max(10, px * 0.44), color: '#fff', letterSpacing: '1px', lineHeight: 1 }}>
            ATHENA
          </div>
          {size !== 'sm' && (
            <div style={{ fontFamily: "'DM Mono','Cascadia Code',monospace", fontSize: Math.max(7, px * 0.15), color: '#D9BF73', letterSpacing: '1.2px', marginTop: 2 }}>
              v2.0 · MOTOR
            </div>
          )}
        </div>
      )}
    </div>
  );
}
