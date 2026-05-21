// ─── Matriz 2×2 PYTHIA — domain renderer ─────────────────────────────────────
// Drag + QuadrantView SVG + toggle markdown / quadrant

import React, { useState, useCallback, useRef } from 'react';
import type { Matriz2x2Data, Cenario, CardPosition } from './types';
import { fmt } from '../../../../lib/fmt';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
): number {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, curY);
      line = word;
      curY += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, curY);
  return curY + lineH;
}

// ─── Quadrant positions ───────────────────────────────────────────────────────
// Layout (cartesian, Y-up):
//   Q2 (−X,+Y) | Q1 (+X,+Y)
//   Q3 (−X,−Y) | Q4 (+X,−Y)

const QUADRANT_COLORS: Record<number, string> = {
  1: '#E8F5E9',
  2: '#E3F2FD',
  3: '#FFF8E1',
  4: '#FCE4EC',
};

const QUADRANT_BORDER: Record<number, string> = {
  1: '#A5D6A7',
  2: '#90CAF9',
  3: '#FFE082',
  4: '#F48FB1',
};

const QUADRANT_LABEL_COLOR: Record<number, string> = {
  1: '#2E7D32',
  2: '#1565C0',
  3: '#F57F17',
  4: '#880E4F',
};

// ─── SVG Export ──────────────────────────────────────────────────────────────

function exportPng(data: Matriz2x2Data, positions: CardPosition[]): void {
  const W = 800;
  const H = 800;
  const MID = W / 2;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#F9FAFB';
  ctx.fillRect(0, 0, W, H);

  const qW = (W - 40) / 2;
  const qH = (H - 40) / 2;

  // Draw quadrant backgrounds
  const qLayout: { q: number; ox: number; oy: number }[] = [
    { q: 1, ox: MID + 20, oy: 20 },
    { q: 2, ox: 20,       oy: 20 },
    { q: 3, ox: 20,       oy: MID + 20 },
    { q: 4, ox: MID + 20, oy: MID + 20 },
  ];
  for (const { q, ox, oy } of qLayout) {
    ctx.fillStyle = QUADRANT_COLORS[q];
    ctx.strokeStyle = QUADRANT_BORDER[q];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(ox, oy, qW - 10, qH - 10, 8);
    ctx.fill();
    ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = '#6B8C7A';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(20, MID + 20); ctx.lineTo(W - 20, MID + 20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(MID + 20, 20); ctx.lineTo(MID + 20, H - 20); ctx.stroke();

  // Axis labels
  ctx.font = 'bold 12px "DM Sans", sans-serif';
  ctx.fillStyle = '#1B3A2D';
  ctx.textAlign = 'center';
  ctx.fillText(`← ${data.eixoX.poloNeg}`, 80, MID + 15);
  ctx.fillText(`${data.eixoX.poloPos} →`, W - 80, MID + 15);
  ctx.save();
  ctx.translate(MID + 15, 80);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${data.eixoY.poloPos} ↑`, 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(MID + 15, H - 80);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`↓ ${data.eixoY.poloNeg}`, 0, 0);
  ctx.restore();

  // Cenario cards
  for (const { q, ox, oy } of qLayout) {
    const cenario = data.cenarios.find(c => c.quadrante === q);
    if (!cenario) continue;
    const pos = positions.find(p => p.id === cenario.id);
    const px = ox + (pos?.x ?? 0.2) * (qW - 10);
    const py = oy + (pos?.y ?? 0.2) * (qH - 10);

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = QUADRANT_BORDER[q];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(px, py, 140, 90, 6);
    ctx.fill();
    ctx.stroke();

    ctx.font = `bold 11px "DM Sans", sans-serif`;
    ctx.fillStyle = QUADRANT_LABEL_COLOR[q];
    ctx.textAlign = 'left';
    ctx.fillText(cenario.id, px + 8, py + 18);

    ctx.font = `bold 10px "DM Sans", sans-serif`;
    ctx.fillStyle = '#0D1612';
    wrapText(ctx, cenario.titulo, px + 8, py + 32, 124, 13);

    ctx.font = `9px "DM Sans", sans-serif`;
    ctx.fillStyle = '#6B8C7A';
    const lines = cenario.descricao.slice(0, 120).split('\n').slice(0, 3);
    let ly = py + 52;
    for (const l of lines) {
      wrapText(ctx, l, px + 8, ly, 124, 11);
      ly += 11;
    }
  }

  // Title
  if (data.titulo) {
    ctx.font = 'bold 14px "DM Sans", sans-serif';
    ctx.fillStyle = '#1B3A2D';
    ctx.textAlign = 'center';
    ctx.fillText(data.titulo, MID + 20, 14);
  }

  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Matriz2x2_${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

// ─── Draggable card ──────────────────────────────────────────────────────────

interface DraggableCardProps {
  cenario: Cenario;
  position: CardPosition;
  containerWidth: number;
  containerHeight: number;
  onPositionChange: (id: string, x: number, y: number) => void;
}

function DraggableCard({
  cenario, position, containerWidth, containerHeight, onPositionChange,
}: DraggableCardProps) {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const CARD_W = 140;
  const CARD_H = 90;

  const absX = position.x * (containerWidth - CARD_W);
  const absY = position.y * (containerHeight - CARD_H);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: absX, origY: absY };

    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = me.clientX - dragRef.current.startX;
      const dy = me.clientY - dragRef.current.startY;
      const nx = Math.max(0, Math.min(containerWidth - CARD_W, dragRef.current.origX + dx));
      const ny = Math.max(0, Math.min(containerHeight - CARD_H, dragRef.current.origY + dy));
      onPositionChange(cenario.id, nx / (containerWidth - CARD_W), ny / (containerHeight - CARD_H));
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: absX,
        top: absY,
        width: CARD_W,
        height: CARD_H,
        background: '#fff',
        border: `1.5px solid ${QUADRANT_BORDER[cenario.quadrante]}`,
        borderRadius: 8,
        padding: '8px 10px',
        cursor: 'grab',
        userSelect: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,.12)',
        zIndex: 10,
        overflow: 'hidden',
      }}
    >
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '1px',
        color: QUADRANT_LABEL_COLOR[cenario.quadrante],
        fontFamily: "'DM Mono', monospace",
        marginBottom: 2,
      }}>
        {cenario.id}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#0D1612', lineHeight: 1.3, marginBottom: 4 }}>
        {cenario.titulo}
      </div>
      {cenario.probabilidade !== undefined && (
        <div style={{
          position: 'absolute', bottom: 6, right: 8,
          fontFamily: "'DM Mono', monospace", fontSize: 9,
          color: QUADRANT_LABEL_COLOR[cenario.quadrante], fontWeight: 700,
          letterSpacing: '0.5px',
        }}>
          ~{cenario.probabilidade}%
        </div>
      )}
      <div style={{ fontSize: 9.5, color: '#6B8C7A', lineHeight: 1.4, overflow: 'hidden', maxHeight: 36 }}>
        {cenario.descricao.slice(0, 100)}{cenario.descricao.length > 100 ? '…' : ''}
      </div>
    </div>
  );
}

// ─── Quadrant view ────────────────────────────────────────────────────────────

interface QuadrantViewProps {
  data: Matriz2x2Data;
  positions: CardPosition[];
  onPositionChange: (id: string, x: number, y: number) => void;
}

function QuadrantView({ data, positions, onPositionChange }: QuadrantViewProps) {
  const HALF = 240;
  const AXIS_LABEL: React.CSSProperties = {
    fontFamily: "'DM Mono', monospace",
    fontSize: 9.5, fontWeight: 700,
    color: '#1B3A2D', letterSpacing: '0.8px',
    textTransform: 'uppercase',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {/* Y+ label */}
      <div style={AXIS_LABEL}>{data.eixoY.poloPos} ↑</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Y axis label */}
        <div style={{ ...AXIS_LABEL, writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}>
          {data.eixoY.label}
        </div>

        {/* 2×2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: `${HALF}px ${HALF}px`, gridTemplateRows: `${HALF}px ${HALF}px`, border: '2px solid #D4E2DA', borderRadius: 12, overflow: 'hidden' }}>
          {[
            { q: 2, gridColumn: 1, gridRow: 1 },
            { q: 1, gridColumn: 2, gridRow: 1 },
            { q: 3, gridColumn: 1, gridRow: 2 },
            { q: 4, gridColumn: 2, gridRow: 2 },
          ].map(({ q, gridColumn, gridRow }) => {
            const cenario = data.cenarios.find(c => c.quadrante === q);
            const pos = positions.find(p => p.id === cenario?.id) ?? { id: `Q${q}`, x: 0.1, y: 0.1 };
            return (
              <div key={q} style={{
                gridColumn, gridRow,
                background: QUADRANT_COLORS[q],
                borderRight: gridColumn === 1 ? '1px solid #D4E2DA' : undefined,
                borderBottom: gridRow === 1   ? '1px solid #D4E2DA' : undefined,
                position: 'relative',
                width: HALF, height: HALF,
              }}>
                {/* Quadrant label */}
                <div style={{
                  position: 'absolute', top: 6, left: 8,
                  fontFamily: "'DM Mono', monospace", fontSize: 10,
                  fontWeight: 700, color: QUADRANT_LABEL_COLOR[q],
                  letterSpacing: '1px', opacity: 0.6,
                }}>Q{q}</div>

                {cenario && (
                  <DraggableCard
                    cenario={cenario}
                    position={pos}
                    containerWidth={HALF}
                    containerHeight={HALF}
                    onPositionChange={onPositionChange}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Y axis label right side — empty spacer */}
        <div style={{ width: 16 }} />
      </div>

      {/* Y- label */}
      <div style={AXIS_LABEL}>↓ {data.eixoY.poloNeg}</div>

      {/* X axis */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: HALF * 2 + 12, paddingLeft: 4, paddingRight: 4 }}>
        <div style={AXIS_LABEL}>← {data.eixoX.poloNeg}</div>
        <div style={{ ...AXIS_LABEL, textAlign: 'center' }}>{data.eixoX.label}</div>
        <div style={AXIS_LABEL}>{data.eixoX.poloPos} →</div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Matriz2x2Props {
  data: Matriz2x2Data;
  rawMarkdown: string;
}

export function Matriz2x2({ data, rawMarkdown }: Matriz2x2Props) {
  const [view, setView] = useState<'quadrant' | 'markdown'>('quadrant');
  const [positions, setPositions] = useState<CardPosition[]>(() =>
    data.cenarios.map((c, i) => ({
      id: c.id,
      x: [0.55, 0.08, 0.08, 0.55][i] ?? 0.1,
      y: [0.08, 0.08, 0.55, 0.55][i] ?? 0.1,
    }))
  );

  const handlePositionChange = useCallback((id: string, x: number, y: number) => {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, x, y } : p));
  }, []);

  const btnBase: React.CSSProperties = {
    background: 'none',
    border: '1px solid #D4E2DA',
    borderRadius: 4,
    fontSize: 11,
    fontFamily: "'DM Sans', sans-serif",
    padding: '3px 10px',
    cursor: 'pointer',
    color: '#6B8C7A',
    transition: 'all .12s',
  };

  const btnActive: React.CSSProperties = {
    ...btnBase,
    background: '#1B3A2D',
    color: '#fff',
    borderColor: '#1B3A2D',
  };

  return (
    <div style={{
      border: '1.5px solid #D4E2DA',
      borderRadius: 12,
      overflow: 'hidden',
      marginTop: 8,
      background: '#F9FAFB',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px',
        background: '#fff',
        borderBottom: '1px solid #D4E2DA',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10, letterSpacing: '1.4px',
            color: '#1B3A2D', fontWeight: 700,
            textTransform: 'uppercase',
          }}>
            PYTHIA · Matriz 2×2
          </span>
          {data.titulo && (
            <span style={{ fontSize: 11, color: '#6B8C7A' }}>{data.titulo}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            style={view === 'quadrant' ? btnActive : btnBase}
            onClick={() => setView('quadrant')}
            onMouseEnter={e => { if (view !== 'quadrant') e.currentTarget.style.background = '#F2F7F4'; }}
            onMouseLeave={e => { if (view !== 'quadrant') e.currentTarget.style.background = 'none'; }}
          >
            Quadrantes
          </button>
          <button
            style={view === 'markdown' ? btnActive : btnBase}
            onClick={() => setView('markdown')}
            onMouseEnter={e => { if (view !== 'markdown') e.currentTarget.style.background = '#F2F7F4'; }}
            onMouseLeave={e => { if (view !== 'markdown') e.currentTarget.style.background = 'none'; }}
          >
            Texto
          </button>
          <button
            style={btnBase}
            onClick={() => exportPng(data, positions)}
            onMouseEnter={e => { e.currentTarget.style.background = '#F2F7F4'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            title="Exportar como PNG"
          >
            ↓ PNG
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 20 }}>
        {view === 'quadrant' ? (
          <QuadrantView
            data={data}
            positions={positions}
            onPositionChange={handlePositionChange}
          />
        ) : (
          <div
            className="msg-markdown"
            style={{ fontSize: 13.5, lineHeight: 1.7, color: '#0D1612' }}
            dangerouslySetInnerHTML={{ __html: fmt(rawMarkdown) }}
          />
        )}
      </div>
    </div>
  );
}
