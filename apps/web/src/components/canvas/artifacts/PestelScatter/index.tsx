// ─── PESTEL Scatter — renderer de domínio KLIO ───────────────────────────────
// Matriz Impacto × Incerteza com pontos coloridos por dimensão PESTEL.
// Toggle markdown ↔ scatter. Fallback seguro.

import React, { useState } from 'react';
import type { PestelData, DriverPestel, DimensaoPestel } from './types';
import { fmt } from '../../../../lib/fmt';

// ─── Paleta por dimensão ──────────────────────────────────────────────────────

const DIM_COLOR: Record<DimensaoPestel, string> = {
  P: '#1565C0', // Político — azul
  E: '#2E7D32', // Econômico — verde
  S: '#E65100', // Social — laranja
  T: '#6A1B9A', // Tecnológico — roxo
  A: '#00695C', // Ambiental — teal
  L: '#B71C1C', // Legal/Regulatório — vermelho
};

const DIM_LABEL: Record<DimensaoPestel, string> = {
  P: 'Político',
  E: 'Econômico',
  S: 'Social',
  T: 'Tecnológico',
  A: 'Ambiental',
  L: 'Legal',
};

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipProps {
  driver: DriverPestel;
  x: number;
  y: number;
}

function Tooltip({ driver, x, y }: TooltipProps) {
  const W = 200;
  const H = driver.descricao ? 72 : 52;
  // Empurra o tooltip para não sair pela direita
  const tx = x + 12;
  const ty = y - H / 2;

  return (
    <g>
      <rect x={tx} y={ty} width={W} height={H} rx={6} fill="#1B3A2D" opacity={0.95} />
      <rect x={tx} y={ty} width={4} height={H} rx={2} fill={DIM_COLOR[driver.dimensao]} />
      <text x={tx + 12} y={ty + 16} fill="#C9A84C" fontSize={9} fontWeight={700} fontFamily="DM Mono,monospace" letterSpacing={1}>
        {driver.dimensao} · {DIM_LABEL[driver.dimensao]}
      </text>
      <text x={tx + 12} y={ty + 30} fill="#fff" fontSize={10} fontWeight={700} fontFamily="DM Sans,sans-serif">
        {driver.nome.length > 26 ? driver.nome.slice(0, 24) + '…' : driver.nome}
      </text>
      <text x={tx + 12} y={ty + 44} fill="#A3C9AE" fontSize={9} fontFamily="DM Sans,sans-serif">
        Impacto {driver.impacto}/5 · Incerteza {driver.incerteza}/5
      </text>
      {driver.descricao && (
        <text x={tx + 12} y={ty + 58} fill="#6B8C7A" fontSize={8.5} fontFamily="DM Sans,sans-serif">
          {driver.descricao.slice(0, 36)}{driver.descricao.length > 36 ? '…' : ''}
        </text>
      )}
    </g>
  );
}

// ─── Scatter plot SVG ─────────────────────────────────────────────────────────

interface ScatterProps {
  data: PestelData;
}

function ScatterPlot({ data }: ScatterProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  // Canvas dimensions
  const W = 560;
  const H = 380;
  const PAD = { top: 24, right: 32, bottom: 48, left: 48 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Scale: 1–5 → pixel
  const scaleX = (v: number) => PAD.left + ((v - 1) / 4) * plotW;
  const scaleY = (v: number) => PAD.top + plotH - ((v - 1) / 4) * plotH;

  const midX = scaleX(3);
  const midY = scaleY(3);

  const AXIS_STYLE = { fontFamily: 'DM Mono, monospace', fontSize: 9, fill: '#6B8C7A', letterSpacing: 1 };
  const QUAD_STYLE = { fontFamily: 'DM Mono, monospace', fontSize: 8.5, letterSpacing: 0.8, fontWeight: 700 };

  // Dimensões presentes (para legenda)
  const dims = [...new Set(data.drivers.map(d => d.dimensao))].sort();

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>

        {/* Quadrant backgrounds */}
        {/* Q3 — baixo impacto, alta incerteza */}
        <rect x={PAD.left} y={PAD.top} width={midX - PAD.left} height={midY - PAD.top} fill="#F3F4F6" />
        {/* Q1 — alto impacto, alta incerteza (candidatos a eixo) */}
        <rect x={midX} y={PAD.top} width={PAD.left + plotW - midX} height={midY - PAD.top} fill="#FFF8E1" />
        {/* Q4 — baixo impacto, baixa incerteza */}
        <rect x={PAD.left} y={midY} width={midX - PAD.left} height={PAD.top + plotH - midY} fill="#F9FAFB" />
        {/* Q2 — alto impacto, baixa incerteza */}
        <rect x={midX} y={midY} width={PAD.left + plotW - midX} height={PAD.top + plotH - midY} fill="#F0F9F2" />

        {/* Quadrant labels */}
        <text x={midX + 6} y={PAD.top + 12} {...QUAD_STYLE} fill="#B7791F" opacity={0.8}>
          ★ CANDIDATOS A EIXO PYTHIA
        </text>
        <text x={PAD.left + 4} y={PAD.top + 12} {...QUAD_STYLE} fill="#6B7280" opacity={0.7}>
          MONITORAR
        </text>
        <text x={midX + 6} y={PAD.top + plotH - 4} {...QUAD_STYLE} fill="#2E7D32" opacity={0.7}>
          TENDÊNCIAS ESTRUTURAIS
        </text>
        <text x={PAD.left + 4} y={PAD.top + plotH - 4} {...QUAD_STYLE} fill="#9CA3AF" opacity={0.6}>
          BAIXA PRIORIDADE
        </text>

        {/* Grid lines */}
        {[1, 2, 3, 4, 5].map(v => (
          <g key={v}>
            <line x1={scaleX(v)} y1={PAD.top} x2={scaleX(v)} y2={PAD.top + plotH} stroke="#E5E7EB" strokeWidth={0.8} strokeDasharray={v === 3 ? undefined : '4 3'} />
            <line x1={PAD.left} y1={scaleY(v)} x2={PAD.left + plotW} y2={scaleY(v)} stroke="#E5E7EB" strokeWidth={0.8} strokeDasharray={v === 3 ? undefined : '4 3'} />
          </g>
        ))}

        {/* Axis lines (mid = solid) */}
        <line x1={midX} y1={PAD.top} x2={midX} y2={PAD.top + plotH} stroke="#9CA3AF" strokeWidth={1.5} />
        <line x1={PAD.left} y1={midY} x2={PAD.left + plotW} y2={midY} stroke="#9CA3AF" strokeWidth={1.5} />

        {/* Axis tick labels */}
        {[1, 2, 3, 4, 5].map(v => (
          <g key={v}>
            <text x={scaleX(v)} y={PAD.top + plotH + 14} textAnchor="middle" {...AXIS_STYLE}>{v}</text>
            <text x={PAD.left - 8} y={scaleY(v) + 3} textAnchor="end" {...AXIS_STYLE}>{v}</text>
          </g>
        ))}

        {/* Axis titles */}
        <text x={PAD.left + plotW / 2} y={H - 4} textAnchor="middle"
          fontFamily="DM Mono,monospace" fontSize={10} fill="#1B3A2D" fontWeight={700} letterSpacing={1.2}>
          IMPACTO →
        </text>
        <text x={10} y={PAD.top + plotH / 2} textAnchor="middle"
          transform={`rotate(-90, 10, ${PAD.top + plotH / 2})`}
          fontFamily="DM Mono,monospace" fontSize={10} fill="#1B3A2D" fontWeight={700} letterSpacing={1.2}>
          INCERTEZA →
        </text>

        {/* Driver dots — render hovered last (on top) */}
        {[...data.drivers].sort((a, b) => (a.id === hovered ? 1 : b.id === hovered ? -1 : 0)).map(driver => {
          const cx = scaleX(driver.impacto);
          const cy = scaleY(driver.incerteza);
          const isHov = hovered === driver.id;
          const r = isHov ? 10 : 8;
          return (
            <g key={driver.id}
              onMouseEnter={() => setHovered(driver.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}>
              <circle cx={cx} cy={cy} r={r + 4} fill="transparent" />
              <circle cx={cx} cy={cy} r={r}
                fill={DIM_COLOR[driver.dimensao]}
                stroke={isHov ? '#fff' : DIM_COLOR[driver.dimensao]}
                strokeWidth={isHov ? 2.5 : 0}
                opacity={isHov ? 1 : 0.82}
              />
              <text x={cx} y={cy + 3.5} textAnchor="middle"
                fill="#fff" fontSize={7.5} fontWeight={800} fontFamily="DM Sans,sans-serif"
                style={{ pointerEvents: 'none' }}>
                {driver.dimensao}
              </text>
              {isHov && (
                <Tooltip driver={driver} x={cx} y={cy} />
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', padding: '8px 16px 4px', justifyContent: 'center' }}>
        {dims.map(d => (
          <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#3D5A48' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: DIM_COLOR[d] }} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, color: DIM_COLOR[d] }}>{d}</span>
            <span>{DIM_LABEL[d]}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#9CA3AF', marginLeft: 4 }}>
          · passe o cursor sobre os pontos
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface PestelScatterProps {
  data: PestelData;
  rawMarkdown: string;
}

export function PestelScatter({ data, rawMarkdown }: PestelScatterProps) {
  const [view, setView] = useState<'scatter' | 'markdown'>('scatter');

  const btnBase: React.CSSProperties = {
    background: 'none', border: '1px solid #D4E2DA', borderRadius: 4,
    fontSize: 11, fontFamily: "'DM Sans', sans-serif",
    padding: '3px 10px', cursor: 'pointer', color: '#6B8C7A', transition: 'all .12s',
  };
  const btnActive: React.CSSProperties = { ...btnBase, background: '#1B3A2D', color: '#fff', borderColor: '#1B3A2D' };

  return (
    <div style={{ border: '1.5px solid #D4E2DA', borderRadius: 12, overflow: 'hidden', marginTop: 8, background: '#F9FAFB' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#fff', borderBottom: '1px solid #D4E2DA' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '1.4px', color: '#1B3A2D', fontWeight: 700, textTransform: 'uppercase' }}>
            KLIO · PESTEL — Impacto × Incerteza
          </span>
          <span style={{ fontSize: 11, color: '#6B8C7A' }}>{data.drivers.length} drivers</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={view === 'scatter' ? btnActive : btnBase} onClick={() => setView('scatter')}>Scatter</button>
          <button style={view === 'markdown' ? btnActive : btnBase} onClick={() => setView('markdown')}>Texto</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: view === 'scatter' ? '12px 0 8px' : 20 }}>
        {view === 'scatter' ? (
          <ScatterPlot data={data} />
        ) : (
          <div className="msg-markdown" style={{ fontSize: 13.5, lineHeight: 1.7, color: '#0D1612' }}
            dangerouslySetInnerHTML={{ __html: fmt(rawMarkdown) }} />
        )}
      </div>
    </div>
  );
}
