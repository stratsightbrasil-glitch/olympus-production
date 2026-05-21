// ─── KRATOS Panel — Painel de Monitoramento Contínuo ─────────────────────────
// Dashboard dedicado: indicadores, radar de sinais, últimas análises, ações.

import { useState, useEffect, useCallback } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Indicator {
  id: string;
  name: string;
  status: string;
  lastValue?: number | null;
  source?: string | null;
  lastCheckedAt?: string | null;
  thresholdYellow?: number | null;
  thresholdRed?: number | null;
  parametersJson?: any;
}

interface Signal {
  id: string;
  titulo: string;
  tipo?: string;
  classificacao: string;
  statusRadar: string;
  interpretacaoAtual?: string | null;
  acaoRecomendada?: string | null;
  sentinela1Status?: string | null;
  sentinela1Descricao?: string | null;
  sentinela2Status?: string | null;
  sentinela2Descricao?: string | null;
  janelaAnos?: string | null;
  updatedAt?: string;
}

interface DashboardData {
  projeto: { id: string; nome: string; kratosCron: string; alertEmails: string };
  indicadores: Indicator[];
  sinais: Signal[];
  sinalStats: Record<string, number>;
  overallStatus: string;
  lastKratosAt: string | null;
  lastKratosExcerpt: string | null;
}

interface KratosPanelProps {
  sessionId: string;
  reqHeaders: Record<string, string>;
  onRunKratos: () => void;   // dispara análise KRATOS no chat
  onSettings: () => void;    // abre modal de configurações
}

// ─── Paleta ───────────────────────────────────────────────────────────────────

const S_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  verde:    { bg: '#E8F5E9', text: '#1B5E20', border: '#4CAF50' },
  amarelo:  { bg: '#FFF9C4', text: '#7D5A00', border: '#F9A825' },
  vermelho: { bg: '#FFEBEE', text: '#7B1A1A', border: '#E53935' },
};
const S_DOT: Record<string, string>    = { verde: '🟢', amarelo: '🟡', vermelho: '🔴' };
const RADAR_DOT: Record<string, string> = { materializado: '🔴', amplificando: '🟠', monitorando: '🔵', arquivado: '⚫' };
const RADAR_LABEL: Record<string, string> = {
  materializado: 'Materializado', amplificando: 'Amplificando',
  monitorando: 'Monitorando', arquivado: 'Arquivado',
};
const RADAR_BG: Record<string, string> = {
  materializado: '#FFEBEE', amplificando: '#FFF3E0',
  monitorando: '#E3F2FD', arquivado: '#F5F5F5',
};
const RADAR_BORDER: Record<string, string> = {
  materializado: '#EF9A9A', amplificando: '#FFCC80',
  monitorando: '#90CAF9', arquivado: '#E0E0E0',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Indicador Card ───────────────────────────────────────────────────────────

function IndicadorCard({ ind }: { ind: Indicator }) {
  const st = ind.status || 'verde';
  const col = S_COLOR[st] ?? S_COLOR.verde;
  const val = ind.lastValue !== null && ind.lastValue !== undefined ? ind.lastValue : null;

  // Threshold bar: [min=0 ... yellow ... red ... max]
  // Se não temos thresholds, apenas mostra o valor
  const yellow = ind.parametersJson?.yellowThreshold ?? ind.thresholdYellow;
  const red    = ind.parametersJson?.redThreshold    ?? ind.thresholdRed;
  const hasThreshold = yellow !== null && yellow !== undefined && red !== null && red !== undefined && val !== null;

  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${col.border}`,
      borderRadius: 10, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 6,
      boxShadow: '0 1px 4px rgba(0,0,0,.06)',
      minWidth: 0,
    }}>
      {/* Status badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700,
          color: '#1B3A2D', lineHeight: 1.3, flex: 1,
        }}>{ind.name}</span>
        <span style={{
          background: col.bg, color: col.text, border: `1px solid ${col.border}`,
          borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>{S_DOT[st]} {st.toUpperCase()}</span>
      </div>

      {/* Valor */}
      <div style={{
        fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 700,
        color: col.text, lineHeight: 1,
      }}>
        {val !== null ? String(val) : <span style={{ fontSize: 14, color: '#9CA3AF' }}>sem dado</span>}
      </div>

      {/* Threshold bar */}
      {hasThreshold && val !== null && (
        <div style={{ marginTop: 2 }}>
          <div style={{
            height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden', position: 'relative',
          }}>
            {/* Bar fill up to current value (0–red scale) */}
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${Math.min(100, (val / (red * 1.2)) * 100)}%`,
              background: st === 'vermelho' ? '#E53935' : st === 'amarelo' ? '#F9A825' : '#4CAF50',
              borderRadius: 3, transition: 'width .4s',
            }} />
            {/* Yellow threshold marker */}
            <div style={{
              position: 'absolute', top: 0, height: '100%', width: 2,
              left: `${Math.min(98, (yellow / (red * 1.2)) * 100)}%`,
              background: '#F9A825', opacity: 0.9,
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 9, color: '#9CA3AF', fontFamily: "'DM Mono', monospace" }}>
            <span>0</span>
            <span style={{ color: '#F9A825' }}>⚠ {yellow}</span>
            <span style={{ color: '#E53935' }}>🔴 {red}</span>
          </div>
        </div>
      )}

      {/* Fonte + última verificação */}
      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
        {ind.source && <span>{ind.source} · </span>}
        {fmtDate(ind.lastCheckedAt ?? null)}
      </div>
    </div>
  );
}

// ─── Sinal Row ────────────────────────────────────────────────────────────────

function SinalRow({ s }: { s: Signal }) {
  const [expanded, setExpanded] = useState(false);
  const radar = s.statusRadar || 'monitorando';
  return (
    <div style={{
      background: RADAR_BG[radar] ?? '#F9FAFB',
      border: `1px solid ${RADAR_BORDER[radar] ?? '#E5E7EB'}`,
      borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
      transition: 'box-shadow .15s',
    }} onClick={() => setExpanded(e => !e)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>{RADAR_DOT[radar]}</span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#1B3A2D' }}>{s.titulo}</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {s.sentinela1Status === 'disparado' && <span style={{ fontSize: 9, background: '#FFEBEE', color: '#7B1A1A', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>S1 🔴</span>}
          {s.sentinela2Status === 'disparado' && <span style={{ fontSize: 9, background: '#FFEBEE', color: '#7B1A1A', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>S2 🔴</span>}
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${RADAR_BORDER[radar]}` }}>
          {s.interpretacaoAtual && (
            <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.6, margin: '0 0 6px' }}>
              <strong>Interpretação:</strong> {s.interpretacaoAtual}
            </p>
          )}
          {s.acaoRecomendada && (
            <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.6, margin: '0 0 6px' }}>
              <strong>Ação:</strong> {s.acaoRecomendada}
            </p>
          )}
          {s.sentinela1Descricao && (
            <p style={{ fontSize: 10, color: '#6B7280', margin: '4px 0' }}>
              S1: {s.sentinela1Descricao}
            </p>
          )}
          {s.sentinela2Descricao && (
            <p style={{ fontSize: 10, color: '#6B7280', margin: '4px 0' }}>
              S2: {s.sentinela2Descricao}
            </p>
          )}
          {s.janelaAnos && (
            <p style={{ fontSize: 10, color: '#9CA3AF', margin: '4px 0' }}>Janela: {s.janelaAnos}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Radar donut SVG simples ──────────────────────────────────────────────────

function RadarDonut({ stats }: { stats: Record<string, number> }) {
  const total = stats.total || 1;
  const slices = [
    { key: 'materializado', color: '#E53935' },
    { key: 'amplificando',  color: '#FF9800' },
    { key: 'monitorando',   color: '#2196F3' },
    { key: 'arquivado',     color: '#BDBDBD' },
  ].filter(s => (stats[s.key] ?? 0) > 0);

  // Build SVG pie slices
  const R = 38, CX = 44, CY = 44;
  let cum = 0;
  const paths = slices.map(({ key, color }) => {
    const pct = (stats[key] ?? 0) / total;
    const startAngle = cum * 2 * Math.PI - Math.PI / 2;
    cum += pct;
    const endAngle = cum * 2 * Math.PI - Math.PI / 2;
    const large = pct > 0.5 ? 1 : 0;
    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    const x2 = CX + R * Math.cos(endAngle);
    const y2 = CY + R * Math.sin(endAngle);
    const d = `M${CX},${CY} L${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
    return <path key={key} d={d} fill={color} />;
  });

  return (
    <svg width={88} height={88} viewBox="0 0 88 88">
      {paths}
      {/* Donut hole */}
      <circle cx={CX} cy={CY} r={22} fill="white" />
      <text x={CX} y={CY + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#1B3A2D" fontFamily="DM Sans,sans-serif">
        {total}
      </text>
    </svg>
  );
}

// ─── Painel Principal ─────────────────────────────────────────────────────────

export function KratosPanel({ sessionId, reqHeaders, onRunKratos, onSettings }: KratosPanelProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
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
    setSending(true);
    setSendMsg('');
    try {
      const res = await fetch(`/api/v1/kratos/${sessionId}/report`, {
        method: 'POST', headers: reqHeaders,
        body: JSON.stringify({}),
      });
      const json = await res.json();
      setSendMsg(json.message || json.error || 'Concluído.');
    } catch (e: any) {
      setSendMsg('Erro: ' + e.message);
    }
    setSending(false);
  };

  // ── Loading / Empty states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B8C7A', fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
        ⚡ Carregando painel KRATOS…
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 }}>
        <span style={{ fontSize: 36 }}>📭</span>
        <p style={{ color: '#6B8C7A', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Nenhum dado KRATOS para este projeto.</p>
        <button onClick={onRunKratos} style={{ background: '#1B3A2D', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
          ⚡ Acionar KRATOS agora
        </button>
      </div>
    );
  }

  const { indicadores, sinais, sinalStats, overallStatus, lastKratosAt, lastKratosExcerpt } = data;
  const col = S_COLOR[overallStatus] ?? S_COLOR.verde;

  // Sinais filtrados
  const RADAR_ORDER = ['materializado', 'amplificando', 'monitorando', 'arquivado'];
  const sinaisFiltrados = radarFilter
    ? sinais.filter(s => s.statusRadar === radarFilter)
    : [...sinais].sort((a, b) => RADAR_ORDER.indexOf(a.statusRadar) - RADAR_ORDER.indexOf(b.statusRadar));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: '#F0F4F0', overflow: 'hidden', fontFamily: "'DM Sans', sans-serif",
    }}>

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div style={{
        background: '#1B3A2D', color: '#fff',
        padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid rgba(255,255,255,.1)',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '1.5px', color: '#C9A84C', fontWeight: 700, textTransform: 'uppercase' }}>
          ⚡ KRATOS · Monitoramento Contínuo
        </span>
        <span style={{ fontSize: 11, color: '#6B8C7A' }}>|</span>
        <span style={{ fontSize: 12, color: '#A3C9AE', fontWeight: 600 }}>{data.projeto.nome}</span>

        {/* Status geral */}
        <span style={{
          marginLeft: 'auto', background: col.bg, color: col.text,
          border: `1px solid ${col.border}`, borderRadius: 20,
          padding: '3px 12px', fontSize: 11, fontWeight: 700,
        }}>
          {S_DOT[overallStatus]} {overallStatus.toUpperCase()}
        </span>

        {/* Ações */}
        <button onClick={load} title="Atualizar" style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 6, color: '#A3C9AE', fontSize: 12, padding: '4px 10px', cursor: 'pointer' }}>↻</button>
        <button onClick={onSettings} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 6, color: '#A3C9AE', fontSize: 12, padding: '4px 10px', cursor: 'pointer' }}>⚙ Config</button>
        <button onClick={onRunKratos} style={{ background: '#C9A84C', border: 'none', borderRadius: 6, color: '#1B3A2D', fontSize: 12, fontWeight: 700, padding: '4px 12px', cursor: 'pointer' }}>⚡ Analisar</button>
      </div>

      {/* ── Corpo (scroll) ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Seção: Indicadores ──────────────────────────────────────────── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '1.5px', fontWeight: 700, color: '#1B3A2D', textTransform: 'uppercase' }}>Indicadores</span>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>{indicadores.length} monitorados</span>
            <button onClick={() => load()} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #D4E2DA', borderRadius: 4, color: '#6B8C7A', fontSize: 10, padding: '2px 8px', cursor: 'pointer' }}>↻ Atualizar</button>
          </div>

          {indicadores.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #D4E2DA', borderRadius: 10, padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
              Nenhum indicador configurado. Acione o KRATOS para iniciar o monitoramento.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {indicadores.map(ind => <IndicadorCard key={ind.id} ind={ind} />)}
            </div>
          )}
        </section>

        {/* ── Seção: Radar de Sinais ──────────────────────────────────────── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '1.5px', fontWeight: 700, color: '#1B3A2D', textTransform: 'uppercase' }}>Radar de Sinais</span>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>{sinais.length} sinais</span>
          </div>

          {sinais.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #D4E2DA', borderRadius: 10, padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
              Nenhum sinal identificado. O KLIO registra sinais durante as análises.
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #D4E2DA', borderRadius: 10, overflow: 'hidden' }}>
              {/* Filtros + donut */}
              <div style={{ display: 'flex', gap: 12, padding: '14px 16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', alignItems: 'center', flexWrap: 'wrap' }}>
                <RadarDonut stats={sinalStats} />
                <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    onClick={() => setRadarFilter(null)}
                    style={{
                      background: !radarFilter ? '#1B3A2D' : '#fff',
                      color: !radarFilter ? '#fff' : '#6B7280',
                      border: `1px solid ${!radarFilter ? '#1B3A2D' : '#E5E7EB'}`,
                      borderRadius: 20, padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontWeight: !radarFilter ? 700 : 400,
                    }}>Todos ({sinais.length})</button>
                  {RADAR_ORDER.map(key => {
                    const cnt = sinalStats[key] ?? 0;
                    if (!cnt) return null;
                    const active = radarFilter === key;
                    return (
                      <button key={key} onClick={() => setRadarFilter(active ? null : key)} style={{
                        background: active ? RADAR_BORDER[key] : '#fff',
                        color: active ? '#fff' : '#374151',
                        border: `1px solid ${RADAR_BORDER[key]}`,
                        borderRadius: 20, padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontWeight: active ? 700 : 400,
                      }}>{RADAR_DOT[key]} {RADAR_LABEL[key]} ({cnt})</button>
                    );
                  })}
                </div>
              </div>
              {/* Lista de sinais */}
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                {sinaisFiltrados.map(s => <SinalRow key={s.id} s={s} />)}
              </div>
            </div>
          )}
        </section>

        {/* ── Seção: Última análise ────────────────────────────────────────── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '1.5px', fontWeight: 700, color: '#1B3A2D', textTransform: 'uppercase' }}>Última Análise KRATOS</span>
            {lastKratosAt && <span style={{ fontSize: 10, color: '#9CA3AF' }}>{fmtDate(lastKratosAt)}</span>}
          </div>
          <div style={{ background: '#fff', border: '1px solid #D4E2DA', borderRadius: 10, padding: '16px' }}>
            {lastKratosExcerpt ? (
              <p style={{ fontSize: 12, lineHeight: 1.7, color: '#374151', margin: 0 }}>
                {lastKratosExcerpt}
                {lastKratosExcerpt.length >= 500 && <span style={{ color: '#9CA3AF' }}> …</span>}
              </p>
            ) : (
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Nenhuma análise KRATOS registrada nesta sessão.</p>
            )}
          </div>
        </section>

        {/* ── Seção: Ações ────────────────────────────────────────────────── */}
        <section style={{ background: '#fff', border: '1px solid #D4E2DA', borderRadius: 10, padding: '16px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '1.5px', fontWeight: 700, color: '#1B3A2D', textTransform: 'uppercase', marginBottom: 12 }}>Relatório por E-mail</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={enviarRelatorio}
              disabled={sending}
              style={{
                background: sending ? '#9CA3AF' : '#1B3A2D', color: '#fff',
                border: 'none', borderRadius: 8, padding: '10px 20px',
                fontWeight: 700, fontSize: 13, cursor: sending ? 'not-allowed' : 'pointer',
                transition: 'background .15s',
              }}
            >
              {sending ? '⏳ Enviando…' : '📊 Enviar Snapshot por E-mail'}
            </button>
            {data.projeto.alertEmails && (
              <span style={{ fontSize: 11, color: '#6B8C7A' }}>→ {data.projeto.alertEmails}</span>
            )}
            {!data.projeto.alertEmails && (
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>Configure os e-mails nas ⚙ Configurações</span>
            )}
          </div>
          {sendMsg && (
            <div style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 6, fontSize: 12,
              background: sendMsg.includes('Erro') ? '#FFEBEE' : '#E8F5E9',
              color: sendMsg.includes('Erro') ? '#7B1A1A' : '#1B5E20',
            }}>{sendMsg}</div>
          )}

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #E5E7EB', fontSize: 11, color: '#9CA3AF' }}>
            Destinatários configurados · {data.projeto.kratosCron ? `Cron: ${data.projeto.kratosCron}` : 'Agendamento não configurado'}
          </div>
        </section>
      </div>
    </div>
  );
}
