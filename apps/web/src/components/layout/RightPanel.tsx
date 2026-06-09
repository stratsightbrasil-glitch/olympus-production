import { useState, useEffect } from 'react';
import { useAnalytics } from '../../hooks/useAnalytics';
import { DelphiMatrix } from '../analytics/DelphiMatrix';
import { ImpactMatrix } from '../analytics/ImpactMatrix';

interface Indicator {
  name: string;
  status: string;
  lastValue?: number | string;
  thresholdYellow?: string;
  thresholdRed?: string;
  source?: string;
  lastCheckedAt?: string;
}

interface WeakSignal {
  titulo: string;
  tipo?: string;
  classificacao: string;
  statusRadar: string;
  potencialDisruptivo?: string;
  sentinela1Descricao?: string;
  sentinela1Status?: string;
  sentinela2Descricao?: string;
  sentinela2Status?: string;
  janelaAnos?: string;
  clusterId?: string;
}

interface SignalStats {
  total: number;
  confirmavel: number;
  ambiguo: number;
  amplificando: number;
  materializado: number;
  ruido: number;
}

interface Projeto {
  nome: string;
  metodologia: string;
  status: string;
  horizonte?: string;
  elaborador?: string;
  cliente?: string;
  questaoEstrategica?: string;
  mudancaIdentificada?: string;
}

interface RightPanelProps {
  projeto: Projeto;
  indicadores: Indicator[];
  weakSignals: WeakSignal[];
  signalStats: SignalStats | null;
  onRefreshIndicators: () => void;
  onRefreshSignals: () => void;
  projectId?: string;
  token?: string | null;
  currentPhaseNum?: number;
}

const STATUS_DOT: Record<string, string> = { vermelho: '🔴', amarelo: '🟡', verde: '🟢' };
const STATUS_STYLE: Record<string, string> = {
  vermelho: 'bg-red-50 border-red-300 text-red-800',
  amarelo:  'bg-yellow-50 border-yellow-300 text-yellow-800',
  verde:    'bg-green-50 border-green-300 text-green-800',
};
const RADAR_STYLE: Record<string, string> = {
  monitorando:   'bg-gray-50 border-gray-200',
  amplificando:  'bg-orange-50 border-orange-300',
  materializado: 'bg-red-50 border-red-300',
  arquivado:     'bg-gray-50 border-gray-200 opacity-50',
};
const CL_ICON: Record<string, string> = { confirmavel: '🟢', ambiguo: '🟡', ruido: '🔴' };

type Tab = 'projeto' | 'sinais' | 'indicadores' | 'analise';

export function RightPanel({ projeto, indicadores, weakSignals, signalStats, onRefreshIndicators, onRefreshSignals, projectId, token, currentPhaseNum }: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('projeto');
  const analytics = useAnalytics(token ?? null);

  // Buscar dados analíticos quando fase 4+ for concluída
  useEffect(() => {
    if (!projectId || !token) return;
    if ((currentPhaseNum ?? 0) >= 4) analytics.fetchDelphi(projectId);
    if ((currentPhaseNum ?? 0) >= 5) analytics.fetchImpacts(projectId);
  }, [projectId, currentPhaseNum]);

  const hasContent = indicadores.length > 0 || weakSignals.length > 0 || projeto.nome;
  if (!hasContent) return null;

  // Indicadores stats
  const verde    = indicadores.filter(i => i.status === 'verde').length;
  const amarelo  = indicadores.filter(i => i.status === 'amarelo').length;
  const vermelho = indicadores.filter(i => i.status === 'vermelho').length;
  const total    = indicadores.length;

  const sortedInd = [...indicadores].sort((a, b) => {
    const o: Record<string, number> = { vermelho: 0, amarelo: 1, verde: 2 };
    return (o[a.status] ?? 3) - (o[b.status] ?? 3);
  });

  const sortedSig = [...weakSignals].sort((a, b) => {
    const o: Record<string, number> = { amplificando: 0, materializado: 1, confirmavel: 2, ambiguo: 3, ruido: 4 };
    return (o[a.statusRadar] ?? 5) - (o[b.statusRadar] ?? 5);
  });

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    flex: 1, padding: '10px 4px',
    fontSize: 11, fontWeight: 600,
    letterSpacing: '0.5px', textTransform: 'uppercase',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    background: 'none', border: 'none', cursor: 'pointer',
    borderBottom: activeTab === tab ? '2px solid #1B3A2D' : '2px solid transparent',
    color: activeTab === tab ? '#1B3A2D' : '#6B8C7A',
    transition: 'all .15s',
  });

  return (
    <div style={{
      width: 'var(--panel-w)',
      flexShrink: 0,
      background: 'var(--surface)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button style={tabStyle('projeto')} onClick={() => setActiveTab('projeto')}>Projeto</button>
        <button style={tabStyle('sinais')} onClick={() => setActiveTab('sinais')}>
          Sinais{weakSignals.length > 0 ? ` (${weakSignals.filter(s => s.statusRadar !== 'arquivado').length})` : ''}
        </button>
        <button style={tabStyle('indicadores')} onClick={() => setActiveTab('indicadores')}>
          Ind.{indicadores.length > 0 ? ` (${indicadores.length})` : ''}
        </button>
        {(currentPhaseNum ?? 0) >= 4 && (
          <button style={tabStyle('analise')} onClick={() => setActiveTab('analise')}>Análise</button>
        )}
      </div>

      {/* ── Tab content ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── PROJETO tab ─────────────────────────────────────── */}
        {activeTab === 'projeto' && (
          <div style={{ padding: 14 }}>
            {!projeto.nome ? (
              <div style={{ fontSize: 11, color: 'var(--text-ter)', textAlign: 'center', paddingTop: 24 }}>
                Nenhum projeto carregado
              </div>
            ) : (
              <>
                {/* Título */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 8, color: 'var(--text-ter)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Projeto</div>
                  <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 14, fontWeight: 600, color: '#1B3A2D', lineHeight: 1.3 }}>{projeto.nome}</div>
                </div>

                {/* Cards de info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Metodologia', value: projeto.metodologia },
                    { label: 'Status', value: projeto.status },
                    { label: 'Cliente', value: projeto.cliente },
                    { label: 'Horizonte', value: projeto.horizonte },
                    { label: 'Elaborador', value: projeto.elaborador },
                    { label: 'Questão Estratégica', value: projeto.questaoEstrategica },
                    { label: 'Mudança Identificada', value: projeto.mudancaIdentificada },
                  ].filter(f => f.value).map(({ label, value }) => (
                    <div key={label} style={{
                      padding: '8px 10px',
                      background: '#F2F7F4',
                      borderRadius: '8px',
                      border: '1px solid #D4E2DA',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6B8C7A', marginBottom: 3 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 11, color: '#3D5A48', fontWeight: 500, lineHeight: 1.4 }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Status de indicadores — resumo rápido */}
                {indicadores.length > 0 && (
                  <div style={{ marginTop: 12, padding: '8px 10px', background: 'var(--ink-50)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-ter)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                      📡 KRATOS — {total} Indicadores
                    </div>
                    <div style={{ display: 'flex', height: 3, borderRadius: 3, overflow: 'hidden', gap: 1, marginBottom: 5 }}>
                      {verde    > 0 && <div style={{ background: '#4CAF50', width: `${(verde/total)*100}%` }} />}
                      {amarelo  > 0 && <div style={{ background: '#FFC107', width: `${(amarelo/total)*100}%` }} />}
                      {vermelho > 0 && <div style={{ background: '#F44336', width: `${(vermelho/total)*100}%` }} />}
                    </div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 9 }}>
                      {verde    > 0 && <span style={{ color: '#2E7D32', fontWeight: 600 }}>🟢 {verde}</span>}
                      {amarelo  > 0 && <span style={{ color: '#F57F17', fontWeight: 600 }}>🟡 {amarelo}</span>}
                      {vermelho > 0 && <span style={{ color: '#C62828', fontWeight: 600 }}>🔴 {vermelho}</span>}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── SINAIS tab ──────────────────────────────────────── */}
        {activeTab === 'sinais' && (
          <div style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#4527A0', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                📡 Weak Signals{signalStats ? ` · ${signalStats.total}` : ''}
              </div>
              <button
                onClick={onRefreshSignals}
                style={{ fontSize: 12, color: 'var(--text-ter)', background: 'none', border: 'none', cursor: 'pointer' }}
              >↻</button>
            </div>

            {weakSignals.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-ter)', textAlign: 'center', paddingTop: 24 }}>
                Nenhum sinal registrado
              </div>
            ) : (
              <>
                {signalStats && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                    {signalStats.confirmavel   > 0 && <span className="bg-green-100 text-green-800 font-semibold px-2 py-0.5 rounded-full text-[9px]">🟢 {signalStats.confirmavel}</span>}
                    {signalStats.ambiguo       > 0 && <span className="bg-yellow-100 text-yellow-800 font-semibold px-2 py-0.5 rounded-full text-[9px]">🟡 {signalStats.ambiguo}</span>}
                    {signalStats.amplificando  > 0 && <span className="bg-orange-100 text-orange-800 font-semibold px-2 py-0.5 rounded-full text-[9px]">🟠 {signalStats.amplificando}</span>}
                    {signalStats.materializado > 0 && <span className="bg-red-100 text-red-800 font-semibold px-2 py-0.5 rounded-full text-[9px]">🔴 {signalStats.materializado}</span>}
                    {signalStats.ruido         > 0 && <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-[9px]">{signalStats.ruido} ruído</span>}
                  </div>
                )}

                {(signalStats?.amplificando ?? 0) > 0 && (
                  <div style={{
                    marginBottom: 10, padding: '6px 10px',
                    background: '#FFF3E0', border: '1px solid #FFCC80',
                    borderRadius: 'var(--r-md)', fontSize: 10, color: '#E65100', fontWeight: 600,
                  }}>
                    ⚠️ {signalStats?.amplificando} sinal{signalStats?.amplificando !== 1 ? 'is' : ''} amplificando
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sortedSig.filter(s => s.statusRadar !== 'arquivado').map((s, i) => (
                    <div key={i} className={`border rounded-xl px-3 py-2 text-xs ${RADAR_STYLE[s.statusRadar] || 'bg-gray-50 border-gray-200'}`}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, lineHeight: 1.3 }}>
                          {CL_ICON[s.classificacao] || '⚪'} {s.titulo}
                        </div>
                        {s.tipo && (
                          <span style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9E9E9E', fontWeight: 600, flexShrink: 0 }}>
                            {s.tipo.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      {s.potencialDisruptivo && (
                        <div style={{ fontSize: 10, color: '#616161', lineHeight: 1.4, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                          {s.potencialDisruptivo}
                        </div>
                      )}
                      {(s.sentinela1Descricao || s.sentinela2Descricao) && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                          {s.sentinela1Descricao && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${s.sentinela1Status === 'disparado' ? 'bg-red-100 text-red-700' : s.sentinela1Status === 'ativo' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                              S1 {s.sentinela1Status === 'disparado' ? '🔥' : s.sentinela1Status === 'ativo' ? '⚡' : '·'}
                            </span>
                          )}
                          {s.sentinela2Descricao && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${s.sentinela2Status === 'disparado' ? 'bg-red-100 text-red-700' : s.sentinela2Status === 'ativo' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                              S2 {s.sentinela2Status === 'disparado' ? '🔥' : s.sentinela2Status === 'ativo' ? '⚡' : '·'}
                            </span>
                          )}
                        </div>
                      )}
                      {s.janelaAnos && (
                        <div style={{ fontSize: 9, color: '#9E9E9E', marginTop: 4 }}>⏱ {s.janelaAnos} anos · {s.clusterId || 'sem cluster'}</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── INDICADORES tab ─────────────────────────────────── */}
        {activeTab === 'indicadores' && (
          <div style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#004D40', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                📡 KRATOS · {total} indicador{total !== 1 ? 'es' : ''}
              </div>
              <button
                onClick={onRefreshIndicators}
                style={{ fontSize: 12, color: 'var(--text-ter)', background: 'none', border: 'none', cursor: 'pointer' }}
              >↻</button>
            </div>

            {indicadores.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-ter)', textAlign: 'center', paddingTop: 24 }}>
                Nenhum indicador registrado
              </div>
            ) : (
              <>
                {/* Proporção */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', height: 4, borderRadius: 4, overflow: 'hidden', gap: 1, marginBottom: 5 }}>
                    {verde    > 0 && <div style={{ background: '#4CAF50', width: `${(verde/total)*100}%` }} />}
                    {amarelo  > 0 && <div style={{ background: '#FFC107', width: `${(amarelo/total)*100}%` }} />}
                    {vermelho > 0 && <div style={{ background: '#F44336', width: `${(vermelho/total)*100}%` }} />}
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 9 }}>
                    {verde    > 0 && <span style={{ color: '#2E7D32', fontWeight: 600 }}>🟢 {verde}</span>}
                    {amarelo  > 0 && <span style={{ color: '#F57F17', fontWeight: 600 }}>🟡 {amarelo}</span>}
                    {vermelho > 0 && <span style={{ color: '#C62828', fontWeight: 600 }}>🔴 {vermelho}</span>}
                  </div>
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sortedInd.map((ind, i) => {
                    const checkedAt = ind.lastCheckedAt
                      ? new Date(ind.lastCheckedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : null;
                    return (
                      <div key={i} className={`border rounded-xl px-3 py-2 text-xs ${STATUS_STYLE[ind.status] || 'bg-gray-50 border-gray-200'}`}>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          {STATUS_DOT[ind.status] || '⚪'} {ind.name}
                        </div>
                        {ind.lastValue != null && (
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>
                            {typeof ind.lastValue === 'number'
                              ? ind.lastValue.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
                              : ind.lastValue}
                          </div>
                        )}
                        {(ind.thresholdYellow || ind.thresholdRed) && (
                          <div style={{ fontSize: 9, opacity: .6, marginTop: 2 }}>
                            {ind.thresholdYellow && `⚠ ${ind.thresholdYellow}`}
                            {ind.thresholdYellow && ind.thresholdRed && ' · '}
                            {ind.thresholdRed && `🔴 ${ind.thresholdRed}`}
                          </div>
                        )}
                        {ind.source   && <div style={{ fontSize: 9, opacity: .5, marginTop: 2 }}>{ind.source}</div>}
                        {checkedAt    && <div style={{ fontSize: 8, opacity: .4, marginTop: 2 }}>{checkedAt}</div>}
                      </div>
                    );
                  })}
                </div>

                {vermelho > 0 && (
                  <div style={{
                    marginTop: 10, padding: '6px 10px',
                    background: '#FFEBEE', border: '1px solid #FFCDD2',
                    borderRadius: 'var(--r-md)', fontSize: 10,
                    color: '#C62828', fontWeight: 600,
                  }}>
                    ⚠ {vermelho} indicador{vermelho !== 1 ? 'es' : ''} em alerta
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {/* ── ANÁLISE tab ─────────────────────────────────────── */}
        {activeTab === 'analise' && (
          <div style={{ padding: 14 }}>

            {/* Delphi P(i) */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#1B3A2D', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  📊 Delphi P(i) — Fase 4
                </div>
                {projectId && (
                  <button
                    onClick={() => analytics.fetchDelphi(projectId)}
                    style={{ fontSize: 12, color: 'var(--text-ter)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >↻</button>
                )}
              </div>
              <DelphiMatrix results={analytics.delphiResults} />
            </div>

            {/* Impactos Cruzados */}
            {(currentPhaseNum ?? 0) >= 5 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#1B3A2D', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    🔗 Impactos Cruzados — Fase 5
                  </div>
                  {projectId && (
                    <button
                      onClick={() => analytics.fetchImpacts(projectId)}
                      style={{ fontSize: 12, color: 'var(--text-ter)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >↻</button>
                  )}
                </div>
                <ImpactMatrix
                  fpfs={analytics.impactData?.fpfs ?? []}
                  impacts={analytics.impactData?.impacts ?? []}
                />
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
