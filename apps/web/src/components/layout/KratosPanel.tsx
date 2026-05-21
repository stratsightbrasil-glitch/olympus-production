// ─── KRATOS Panel — Painel de Monitoramento Infográfico ──────────────────────
// Dark-theme dashboard: semáforo, gauges de cenário, tabela densa, gatilhos.

import { useState, useEffect, useCallback } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Indicator {
  id: string; name: string; status: string;
  lastValue?: number | null; source?: string | null; lastCheckedAt?: string | null;
  thresholdYellow?: number | null; thresholdRed?: number | null; parametersJson?: any;
}
interface Signal {
  id: string; titulo: string; tipo?: string; classificacao: string; statusRadar: string;
  interpretacaoAtual?: string | null; acaoRecomendada?: string | null;
  sentinela1Status?: string | null; sentinela1Descricao?: string | null;
  sentinela2Status?: string | null; sentinela2Descricao?: string | null;
  janelaAnos?: string | null; updatedAt?: string;
}
interface DashboardData {
  projeto: { id: string; nome: string; kratosCron: string; alertEmails: string };
  indicadores: Indicator[]; sinais: Signal[]; sinalStats: Record<string, number>;
  overallStatus: string; lastKratosAt: string | null; lastKratosExcerpt: string | null;
}
interface KratosPanelProps {
  sessionId: string; reqHeaders: Record<string, string>;
  onRunKratos: () => void; onSettings: () => void;
}

// ─── Paleta escura ────────────────────────────────────────────────────────────
const DARK   = '#0D1B11';
const PANEL  = '#152A18';
const PANEL2 = '#0A1410';
const BORDER = '#243D28';
const GOLD   = '#C9A84C';
const TEXT1  = '#E8F0E9';
const TEXT2  = '#7FA88A';
const TEXT3  = '#4A6A52';

const CLR: Record<string, string> = {
  verde: '#43A047', amarelo: '#F9A825', vermelho: '#E53935',
};
const RADAR_CLR: Record<string, string> = {
  materializado: '#E53935', amplificando: '#FF9800', monitorando: '#2196F3', arquivado: '#616161',
};
const RADAR_LABEL: Record<string, string> = {
  materializado: 'Materializado', amplificando: 'Amplificando',
  monitorando: 'Monitorando', arquivado: 'Arquivado',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Semáforo SVG ─────────────────────────────────────────────────────────────
function Semaforo({ status }: { status: string }) {
  const LIGHTS = [
    { id: 'vermelho', fill: '#E53935', glow: '#FF5252' },
    { id: 'amarelo',  fill: '#F9A825', glow: '#FFD740' },
    { id: 'verde',    fill: '#43A047', glow: '#69F0AE' },
  ];
  return (
    <div style={{
      background: '#060D07', borderRadius: 14, padding: '14px 10px',
      display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
      border: `2px solid ${BORDER}`, boxShadow: 'inset 0 0 14px rgba(0,0,0,.7)',
    }}>
      {LIGHTS.map(l => {
        const on = l.id === status;
        return (
          <div key={l.id} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: on ? l.fill : '#121F14',
            boxShadow: on ? `0 0 16px ${l.glow}, 0 0 32px ${l.glow}60` : 'none',
            border: `1.5px solid ${on ? l.fill : BORDER}`,
            transition: 'all .35s',
          }} />
        );
      })}
    </div>
  );
}

// ─── Gauge de semicírculo ─────────────────────────────────────────────────────
// Arc vai de 180° (esquerda) a 0° (direita) passando pelo topo — sweep=0 (anti-horário na tela).
function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  const cx = 50, cy = 52, r = 38;
  const toXY = (deg: number) => ({
    x: cx + r * Math.cos(deg * Math.PI / 180),
    y: cy - r * Math.sin(deg * Math.PI / 180), // y invertido para coordenadas SVG
  });
  const start = toXY(180); // esquerda
  const end   = toXY(0);   // direita
  const v = Math.max(0.5, Math.min(99.5, value));
  const fillDeg = 180 - 180 * v / 100;
  const fp = toXY(fillDeg);

  const arc = (x1: number, y1: number, x2: number, y2: number, large: number) =>
    `M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large},0 ${x2.toFixed(1)},${y2.toFixed(1)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 96 }}>
      <svg width={100} height={66} viewBox="0 0 100 66" style={{ overflow: 'visible' }}>
        {/* Track */}
        <path d={arc(start.x, start.y, end.x, end.y, 0)}
          fill="none" stroke={PANEL2} strokeWidth={7} strokeLinecap="round" />
        {/* Fill */}
        {value > 1 && (
          <path d={arc(start.x, start.y, fp.x, fp.y, 0)}
            fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color}80)` }} />
        )}
        {/* Valor */}
        <text x={50} y={50} textAnchor="middle" fontSize={15} fontWeight={700}
          fill={value > 1 ? color : TEXT3} fontFamily="DM Mono, monospace">{value}%</text>
      </svg>
      <span style={{
        fontSize: 9, color: TEXT2, fontFamily: "'DM Mono', monospace",
        letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'center',
      }}>{label}</span>
    </div>
  );
}

// ─── Parser de probabilidades de cenário do texto KRATOS ──────────────────────
function parseScenarios(text: string | null): { label: string; value: number; color: string }[] {
  if (!text) return [];
  const found: Record<number, number> = {};
  // Padrões: "Q1... 40%", "Cenário 1... 40%", "cenario1... 40%"
  const re = /\bQ(\d)\b[^\n%]{0,50}?(\d{1,3})\s*%|\b[Cc]en[aá]rio\s*(\d)\b[^\n%]{0,50}?(\d{1,3})\s*%/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const q = parseInt(m[1] || m[3]);
    const pct = parseInt(m[2] || m[4]);
    if (q >= 1 && q <= 4 && pct >= 0 && pct <= 100 && !found[q]) found[q] = pct;
  }
  const COLORS  = [CLR.verde, '#2196F3', CLR.amarelo, CLR.vermelho];
  const LABELS  = ['Q1 — Base', 'Q2 — Alt.', 'Q3 — Adv.', 'Q4 — Crise'];
  return [1, 2, 3, 4]
    .map((i, idx) => ({ label: LABELS[idx], value: found[i] ?? 0, color: COLORS[idx] }))
    .filter(g => g.value > 0);
}

// ─── Tabela densa de indicadores ──────────────────────────────────────────────
function TabelaIndicadores({ indicadores }: { indicadores: Indicator[] }) {
  if (indicadores.length === 0)
    return (
      <div style={{ padding: '16px', color: TEXT3, fontSize: 12, textAlign: 'center' }}>
        Nenhum indicador configurado. Acione o KRATOS para iniciar.
      </div>
    );
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
            {['INDICADOR', 'VALOR', 'STATUS', '⚠ LIMIAR', '🔴 CRÍTICO'].map(h => (
              <th key={h} style={{
                padding: '7px 10px', textAlign: 'left',
                fontSize: 8, letterSpacing: 1.5, color: TEXT3,
                fontFamily: "'DM Mono', monospace", fontWeight: 700, textTransform: 'uppercase',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {indicadores.map((ind, i) => {
            const st  = ind.status || 'verde';
            const stc = CLR[st] ?? CLR.verde;
            const yellow = ind.parametersJson?.yellowThreshold ?? ind.thresholdYellow;
            const red    = ind.parametersJson?.redThreshold    ?? ind.thresholdRed;
            const val    = ind.lastValue !== null && ind.lastValue !== undefined ? ind.lastValue : null;
            return (
              <tr key={ind.id} style={{
                borderBottom: `1px solid ${BORDER}`,
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.018)',
              }}>
                <td style={{ padding: '8px 10px', color: TEXT1, fontWeight: 600 }}>{ind.name}</td>
                <td style={{ padding: '8px 10px', fontFamily: "'DM Mono', monospace", fontWeight: 700, color: stc }}>
                  {val !== null ? String(val) : <span style={{ color: TEXT3 }}>—</span>}
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', background: stc,
                      boxShadow: `0 0 5px ${stc}`, flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: stc,
                      fontFamily: "'DM Mono', monospace", letterSpacing: 1,
                    }}>{st.toUpperCase()}</span>
                  </span>
                </td>
                <td style={{ padding: '8px 10px', fontFamily: "'DM Mono', monospace", fontSize: 10, color: CLR.amarelo }}>
                  {yellow !== null && yellow !== undefined ? yellow : <span style={{ color: TEXT3 }}>—</span>}
                </td>
                <td style={{ padding: '8px 10px', fontFamily: "'DM Mono', monospace", fontSize: 10, color: CLR.vermelho }}>
                  {red !== null && red !== undefined ? red : <span style={{ color: TEXT3 }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Gatilho de aceleração (sinal com cadeia sentinela) ───────────────────────
function GatilhoRow({ s }: { s: Signal }) {
  const [open, setOpen] = useState(false);
  const radar  = s.statusRadar || 'monitorando';
  const rc     = RADAR_CLR[radar] ?? '#2196F3';
  const s1fire = s.sentinela1Status === 'disparado';
  const s2fire = s.sentinela2Status === 'disparado';

  return (
    <div
      style={{ borderBottom: `1px solid ${BORDER}`, cursor: 'pointer' }}
      onClick={() => setOpen(o => !o)}
    >
      {/* Linha principal */}
      <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', background: rc,
          boxShadow: `0 0 6px ${rc}`, flexShrink: 0,
        }} />
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: TEXT1 }}>{s.titulo}</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
          {s1fire && (
            <span style={{
              fontSize: 8, padding: '1px 6px', borderRadius: 10, fontWeight: 700,
              background: `${CLR.vermelho}30`, color: CLR.vermelho,
              border: `1px solid ${CLR.vermelho}`,
            }}>S1 ⚡</span>
          )}
          {s2fire && (
            <span style={{
              fontSize: 8, padding: '1px 6px', borderRadius: 10, fontWeight: 700,
              background: `${CLR.vermelho}30`, color: CLR.vermelho,
              border: `1px solid ${CLR.vermelho}`,
            }}>S2 ⚡</span>
          )}
          <span style={{ fontSize: 8, color: rc, fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>
            {RADAR_LABEL[radar]?.toUpperCase()}
          </span>
          <span style={{ fontSize: 10, color: TEXT3 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Detalhe expandido */}
      {open && (
        <div style={{ padding: '0 14px 10px 29px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {s.interpretacaoAtual && (
            <p style={{ fontSize: 11, color: TEXT2, lineHeight: 1.65, margin: 0 }}>
              <span style={{
                color: GOLD, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                fontSize: 8, letterSpacing: 1, marginRight: 6,
              }}>INTERPR.</span>
              {s.interpretacaoAtual}
            </p>
          )}
          {/* Cadeia sentinela → ação */}
          {(s.sentinela1Descricao || s.sentinela2Descricao || s.acaoRecomendada) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 2 }}>
              {s.sentinela1Descricao && (
                <span style={{
                  fontSize: 9, padding: '2px 9px', borderRadius: 10,
                  background: s1fire ? `${CLR.vermelho}25` : PANEL2,
                  color: s1fire ? CLR.vermelho : TEXT2,
                  border: `1px solid ${s1fire ? CLR.vermelho : BORDER}`,
                }}>
                  S1: {s.sentinela1Descricao.slice(0, 55)}{s.sentinela1Descricao.length > 55 ? '…' : ''}
                </span>
              )}
              {s.sentinela2Descricao && (
                <>
                  <span style={{ color: TEXT3, fontSize: 11 }}>→</span>
                  <span style={{
                    fontSize: 9, padding: '2px 9px', borderRadius: 10,
                    background: s2fire ? `${CLR.vermelho}25` : PANEL2,
                    color: s2fire ? CLR.vermelho : TEXT2,
                    border: `1px solid ${s2fire ? CLR.vermelho : BORDER}`,
                  }}>
                    S2: {s.sentinela2Descricao.slice(0, 55)}{s.sentinela2Descricao.length > 55 ? '…' : ''}
                  </span>
                </>
              )}
              {s.acaoRecomendada && (
                <>
                  <span style={{ color: TEXT3, fontSize: 11 }}>→</span>
                  <span style={{
                    fontSize: 9, padding: '2px 9px', borderRadius: 10,
                    background: `${GOLD}20`, color: GOLD,
                    border: `1px solid ${GOLD}50`,
                  }}>
                    ⚡ {s.acaoRecomendada.slice(0, 65)}{s.acaoRecomendada.length > 65 ? '…' : ''}
                  </span>
                </>
              )}
            </div>
          )}
          {s.janelaAnos && (
            <span style={{ fontSize: 9, color: TEXT3 }}>Janela: {s.janelaAnos}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Painel Principal ─────────────────────────────────────────────────────────
export function KratosPanel({ sessionId, reqHeaders, onRunKratos, onSettings }: KratosPanelProps) {
  const [data,        setData]        = useState<DashboardData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [sendMsg,     setSendMsg]     = useState('');
  const [radarFilter, setRadarFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/kratos/${sessionId}/dashboard`, { headers: reqHeaders });
      if (res.ok) setData(await res.json());
    } catch { /* silencioso */ }
    setLoading(false);
  }, [sessionId, reqHeaders]);

  useEffect(() => { load(); }, [load]);

  const enviarRelatorio = async () => {
    setSending(true); setSendMsg('');
    try {
      const res = await fetch(`/api/v1/kratos/${sessionId}/report`, {
        method: 'POST', headers: reqHeaders, body: JSON.stringify({}),
      });
      const json = await res.json();
      setSendMsg(json.message || json.error || 'Concluído.');
    } catch (e: any) { setSendMsg('Erro: ' + e.message); }
    setSending(false);
  };

  // ── Loading / vazio ──────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: DARK, color: TEXT2, fontFamily: "'DM Sans', sans-serif", fontSize: 13,
    }}>⚡ Carregando painel KRATOS…</div>
  );

  if (!data) return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40, background: DARK,
    }}>
      <span style={{ fontSize: 40 }}>📭</span>
      <p style={{ color: TEXT2, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
        Nenhum dado KRATOS para este projeto.
      </p>
      <button onClick={onRunKratos} style={{
        background: GOLD, color: DARK, border: 'none', borderRadius: 8,
        padding: '10px 22px', fontWeight: 700, cursor: 'pointer', fontSize: 13,
      }}>⚡ Acionar KRATOS agora</button>
    </div>
  );

  const { indicadores, sinais, sinalStats, overallStatus, lastKratosAt, lastKratosExcerpt } = data;
  const stColor   = CLR[overallStatus] ?? CLR.verde;
  const scenarios = parseScenarios(lastKratosExcerpt);

  const RADAR_ORDER = ['materializado', 'amplificando', 'monitorando', 'arquivado'];
  const sinaisFiltrados = radarFilter
    ? sinais.filter(s => s.statusRadar === radarFilter)
    : [...sinais].sort((a, b) => RADAR_ORDER.indexOf(a.statusRadar) - RADAR_ORDER.indexOf(b.statusRadar));

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: DARK, overflow: 'hidden', fontFamily: "'DM Sans', sans-serif",
    }}>

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div style={{
        background: PANEL2, borderBottom: `1px solid ${BORDER}`,
        padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: 10,
          letterSpacing: 2, color: GOLD, fontWeight: 700,
        }}>⚡ KRATOS</span>
        <span style={{ color: BORDER, fontSize: 16 }}>|</span>
        <span style={{ fontSize: 12, color: TEXT2, fontWeight: 600 }}>{data.projeto.nome}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {lastKratosAt && (
            <span style={{ fontSize: 10, color: TEXT3, fontFamily: "'DM Mono', monospace" }}>
              {fmtDate(lastKratosAt)}
            </span>
          )}
          <button onClick={load} title="Atualizar" style={{
            background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6,
            color: TEXT2, fontSize: 11, padding: '4px 10px', cursor: 'pointer',
          }}>↻</button>
          <button onClick={onSettings} style={{
            background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6,
            color: TEXT2, fontSize: 11, padding: '4px 10px', cursor: 'pointer',
          }}>⚙</button>
          <button onClick={onRunKratos} style={{
            background: GOLD, border: 'none', borderRadius: 6, color: DARK,
            fontSize: 11, fontWeight: 700, padding: '4px 14px', cursor: 'pointer',
          }}>⚡ Analisar</button>
        </div>
      </div>

      {/* ── Corpo com scroll ───────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>

        {/* ── Linha 1: Semáforo + Status + Gauges de cenário ─────────────── */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>

          {/* Semáforo + status geral */}
          <div style={{
            background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12,
            padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0,
          }}>
            <Semaforo status={overallStatus} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{
                fontSize: 8, letterSpacing: 2, color: TEXT3,
                fontFamily: "'DM Mono', monospace", textTransform: 'uppercase',
              }}>Status Geral</span>
              <span style={{
                fontSize: 26, fontWeight: 800, color: stColor,
                fontFamily: "'DM Mono', monospace", lineHeight: 1,
                textShadow: `0 0 12px ${stColor}60`,
              }}>{overallStatus.toUpperCase()}</span>
              <span style={{ fontSize: 10, color: TEXT2, marginTop: 4 }}>
                {indicadores.length} indicadores · {sinais.filter(s => s.statusRadar !== 'arquivado').length} sinais ativos
              </span>
            </div>
          </div>

          {/* Gauges de probabilidade de cenários */}
          <div style={{
            background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12,
            padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <span style={{
              fontSize: 8, letterSpacing: 2, color: TEXT3,
              fontFamily: "'DM Mono', monospace", textTransform: 'uppercase',
            }}>Probabilidades de Cenário</span>
            {scenarios.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-around', flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
                {scenarios.map(s => (
                  <Gauge key={s.label} label={s.label} value={s.value} color={s.color} />
                ))}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 11, color: TEXT3, textAlign: 'center' }}>
                  Probabilidades de cenário aparecerão após análise KRATOS
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Tabela de Indicadores ──────────────────────────────────────── */}
        <div style={{
          background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12,
          overflow: 'hidden', flexShrink: 0,
        }}>
          <div style={{
            padding: '9px 14px', borderBottom: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{
              fontSize: 8, letterSpacing: 2, color: GOLD,
              fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', fontWeight: 700,
            }}>Indicadores</span>
            <span style={{ fontSize: 10, color: TEXT3 }}>{indicadores.length} monitorados</span>
          </div>
          <TabelaIndicadores indicadores={indicadores} />
        </div>

        {/* ── Gatilhos de Aceleração ─────────────────────────────────────── */}
        <div style={{
          background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12,
          overflow: 'hidden', flexShrink: 0,
        }}>
          {/* Cabeçalho + filtros */}
          <div style={{
            padding: '9px 14px', borderBottom: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: 8, letterSpacing: 2, color: GOLD,
              fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', fontWeight: 700,
            }}>Gatilhos de Aceleração</span>
            <span style={{ fontSize: 10, color: TEXT3 }}>{sinais.length} sinais</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setRadarFilter(null)} style={{
                fontSize: 9, padding: '2px 10px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${!radarFilter ? GOLD : BORDER}`,
                background: !radarFilter ? `${GOLD}20` : 'transparent',
                color: !radarFilter ? GOLD : TEXT3,
              }}>TODOS</button>
              {RADAR_ORDER.map(k => {
                const cnt = sinalStats[k] ?? 0;
                if (!cnt) return null;
                const c = RADAR_CLR[k];
                const active = radarFilter === k;
                return (
                  <button key={k} onClick={() => setRadarFilter(active ? null : k)} style={{
                    fontSize: 9, padding: '2px 10px', borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${active ? c : BORDER}`,
                    background: active ? `${c}30` : 'transparent',
                    color: active ? c : TEXT3,
                  }}>{RADAR_LABEL[k]?.toUpperCase()} ({cnt})</button>
                );
              })}
            </div>
          </div>
          {/* Lista */}
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {sinaisFiltrados.length === 0
              ? <div style={{ padding: '16px', color: TEXT3, fontSize: 12, textAlign: 'center' }}>
                  Nenhum sinal identificado. O KLIO registra sinais durante as análises.
                </div>
              : sinaisFiltrados.map(s => <GatilhoRow key={s.id} s={s} />)
            }
          </div>
        </div>

        {/* ── Última análise KRATOS ─────────────────────────────────────── */}
        {lastKratosExcerpt && (
          <div style={{
            background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12,
            padding: '14px 16px', flexShrink: 0,
          }}>
            <div style={{
              fontSize: 8, letterSpacing: 2, color: GOLD,
              fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', fontWeight: 700, marginBottom: 8,
            }}>Última Análise KRATOS</div>
            <p style={{ fontSize: 11, color: TEXT2, lineHeight: 1.8, margin: 0 }}>
              {lastKratosExcerpt}
              {lastKratosExcerpt.length >= 500 && <span style={{ color: TEXT3 }}> …</span>}
            </p>
          </div>
        )}

        {/* ── Relatório por E-mail ─────────────────────────────────────── */}
        <div style={{
          background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12,
          padding: '14px 16px', flexShrink: 0,
        }}>
          <div style={{
            fontSize: 8, letterSpacing: 2, color: GOLD,
            fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', fontWeight: 700, marginBottom: 10,
          }}>Relatório Snapshot</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={enviarRelatorio}
              disabled={sending}
              style={{
                background: sending ? TEXT3 : GOLD, color: sending ? '#fff' : DARK,
                border: 'none', borderRadius: 8, padding: '9px 20px',
                fontWeight: 700, fontSize: 12, cursor: sending ? 'not-allowed' : 'pointer',
                transition: 'background .15s',
              }}
            >
              {sending ? '⏳ Enviando…' : '📊 Enviar Snapshot por E-mail'}
            </button>
            <span style={{ fontSize: 11, color: TEXT3 }}>
              {data.projeto.alertEmails
                ? `→ ${data.projeto.alertEmails}`
                : 'Configure e-mails nas ⚙ Configurações'}
            </span>
          </div>
          {sendMsg && (
            <div style={{
              marginTop: 8, padding: '6px 10px', borderRadius: 6, fontSize: 11,
              background: sendMsg.includes('Erro') ? `${CLR.vermelho}20` : `${CLR.verde}20`,
              color: sendMsg.includes('Erro') ? CLR.vermelho : CLR.verde,
              border: `1px solid ${sendMsg.includes('Erro') ? CLR.vermelho : CLR.verde}60`,
            }}>{sendMsg}</div>
          )}
          {data.projeto.kratosCron && (
            <div style={{ marginTop: 8, fontSize: 9, color: TEXT3, fontFamily: "'DM Mono', monospace" }}>
              CRON: {data.projeto.kratosCron}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
