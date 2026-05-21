import React, { useRef, useEffect } from 'react';

const MSEF_STEPS = [
  { num: 1, agent: 'SCOPUS',    label: 'Escopo',             hex: '#1A4A7A' },
  { num: 2, agent: 'KLIO',      label: 'Drivers + Sinais',   hex: '#5A2D82' },
  { num: 3, agent: 'PYTHIA',    label: 'Incertezas · Eixos', hex: '#B71C1C' },
  { num: 4, agent: 'MNEMOSYNE', label: 'Narrativas',         hex: '#E65100' },
  { num: 5, agent: 'THEMIS',    label: 'Implicações',        hex: '#2D4A5A' },
];

interface Session {
  id: string;
  name: string;
  methodology: string;
  status: string;
  updatedAt: string;
}

interface FilterStatus {
  producao: boolean;
  ativos: boolean;
  inativos: boolean;
}

interface SidebarProps {
  open: boolean;
  user: { name: string; role: string } | null;
  projeto: { nome: string; metodologia: string; status: string };
  sessoes: Session[];
  showSessoes: boolean;
  sessionSearch: string;
  filterStatus: FilterStatus;
  analyticReview: any;
  sessionId: string;
  exportingPdf: boolean;
  currentMsefStep: number;
  mode: string;
  vizMode: string;
  onModeChange: (m: string) => void;
  onVizModeChange: (v: string) => void;
  onNovaSessao: () => void;
  onOpenPainel: () => void;
  onGerarRelatorioKratos: () => void;
  onShowUsers: () => void;
  onShowBackup: () => void;
  onCopyClientLink: () => void;
  onShowReviewModal: () => void;
  onGerarRelatorioPadrao: () => void;
  onGerarRelatorioEstendido: () => void;
  onShowSettings: () => void;
  onToggleSessoes: () => void;
  onSessionSearchChange: (v: string) => void;
  onFilterChange: (key: keyof FilterStatus, value: boolean) => void;
  onCarregarSessao: (id: string) => void;
  onDeletarSessao: (id: string, e: React.MouseEvent) => void;
  onLogout: () => void;
}

function SessionCard({ s, onClick, onDelete }: { s: Session; onClick: () => void; onDelete: (e: React.MouseEvent) => void }) {
  return (
    <div
      onClick={onClick}
      className="p-2 bg-black/20 hover:bg-black/40 border border-white/5 rounded-lg cursor-pointer transition-colors group relative mb-1"
    >
      <div className="text-xs font-bold text-white truncate pr-6">{s.name || '(sem título)'}</div>
      <div className="flex justify-between items-center mt-1">
        <span style={{ fontSize: 9, color: 'var(--ink-200)' }}>{s.methodology}</span>
        <span style={{ fontSize: 9, color: 'var(--text-ter)' }}>
          {new Date(s.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      </div>
      <button
        onClick={onDelete}
        className="absolute top-1 right-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
      >
        ✕
      </button>
    </div>
  );
}

export function Sidebar({
  open, user, projeto, sessoes, showSessoes, sessionSearch, filterStatus,
  analyticReview, sessionId, exportingPdf,
  currentMsefStep, mode, vizMode, onModeChange, onVizModeChange,
  onNovaSessao, onOpenPainel, onGerarRelatorioKratos, onShowUsers, onShowBackup,
  onCopyClientLink, onShowReviewModal, onGerarRelatorioPadrao, onGerarRelatorioEstendido,
  onShowSettings, onToggleSessoes, onSessionSearchChange, onFilterChange,
  onCarregarSessao, onDeletarSessao, onLogout,
}: SidebarProps) {
  const filter = (status: string) => sessoes.filter(s =>
    s.status === status && (!sessionSearch || (s.name || '').toLowerCase().includes(sessionSearch.toLowerCase()))
  );

  const sessaoListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showSessoes && sessaoListRef.current) {
      setTimeout(() => sessaoListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  }, [showSessoes]);

  const isMSEF = projeto.metodologia === 'MSEF';

  return (
    <div
      style={{
        width: open ? 'var(--sidebar-w)' : 0,
        background: 'var(--ink-800)',
        color: 'var(--text-inv)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width .3s ease',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 20,
      }}
    >
      <div style={{ width: 'var(--sidebar-w)', display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── Logo ─────────────────────────────────────────────────── */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 30, height: 30,
            borderRadius: 'var(--r-md)',
            background: 'var(--ink-500)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: '#fff', fontSize: 15,
            flexShrink: 0,
          }}>
            Ω
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', color: 'var(--ink-200)' }}>
              STRATSIGHT
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--gold-400)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Strategic Foresight
            </div>
          </div>
        </div>

        {/* ── Projeto Ativo ─────────────────────────────────────────── */}
        {projeto.nome && (
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,.08)',
            background: 'rgba(255,255,255,.04)',
            position: 'relative',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.2px', color: '#3D7A50', textTransform: 'uppercase', marginBottom: 3}}>
              Projeto Ativo
            </div>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 22 }}>
              {projeto.nome}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <span style={{
                background: 'var(--ink-500)', color: '#fff',
                padding: '1px 6px', borderRadius: 4,
                fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-mono)',
              }}>
                {projeto.metodologia}
              </span>
              <span style={{
                padding: '1px 6px', borderRadius: 4, fontSize: 8, fontWeight: 700,
                background: projeto.status === 'Ativo' ? 'rgba(0,100,0,.5)' : projeto.status === 'Inativo' ? 'rgba(100,0,0,.5)' : 'rgba(0,50,100,.5)',
                color: projeto.status === 'Ativo' ? '#a5d6a7' : projeto.status === 'Inativo' ? '#ef9a9a' : '#90caf9',
              }}>
                {(projeto.status || 'EM PRODUÇÃO').toUpperCase()}
              </span>
            </div>
            <button
              onClick={onShowSettings}
              style={{
                position: 'absolute', top: 10, right: 10,
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,.35)', cursor: 'pointer', fontSize: 13,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,.35)')}
              title="Configurações"
            >
              ⚙️
            </button>
          </div>
        )}

        {/* ── Área rolável ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: '10px 12px' }}>

          {/* PROGRESSO MSEF */}
          {isMSEF && projeto.nome && (
            <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.2px', color: '#3D7A50', textTransform: 'uppercase', marginBottom: 8}}>
                Progresso MSEF
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {MSEF_STEPS.map(step => {
                  const done   = currentMsefStep > step.num;
                  const active = currentMsefStep === step.num;
                  const future = currentMsefStep < step.num;
                  return (
                    <div key={step.num} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 8px 4px 6px',
                      borderRadius: 6,
                      background: active ? `${step.hex}22` : 'transparent',
                      borderLeft: active ? `2px solid ${step.hex}` : '2px solid transparent',
                      transition: 'background var(--t-fast)',
                    }}>
                      {/* Icon */}
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: done ? 9 : 8, fontWeight: 700,
                        background: done ? '#2E7D52' : active ? '#C9A84C' : 'rgba(255,255,255,.08)',
                        color: done ? '#fff' : active ? '#142218' : 'rgba(255,255,255,.3)',
                        border: future ? '1px solid rgba(255,255,255,.15)' : 'none',
                      }}>
                        {done ? '✓' : step.num}
                      </div>
                      {/* Labels */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 10, lineHeight: 1.2,
                          fontWeight: active ? 700 : 500,
                          color: done ? '#A3C9AE' : active ? '#fff' : 'rgba(255,255,255,.35)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {step.label}
                        </div>
                        {active && (
                          <div style={{ fontSize: 8, color: 'rgba(255,255,255,.5)', marginTop: 1 }}>
                            ● {step.agent} ativo
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MODO */}
          <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.2px', color: '#3D7A50', textTransform: 'uppercase', marginBottom: 6}}>Modo</div>
            <div style={{
              display: 'flex',
              background: 'rgba(0,0,0,.2)',
              border: '1px solid rgba(255,255,255,.07)',
              borderRadius: '12px',
              padding: 3, gap: 2,
            }}>
              <button
                onClick={() => onModeChange('production')}
                style={{
                  flex: 1, padding: '5px 6px', border: 'none',
                  borderRadius: '8px', fontSize: 11, fontWeight: 500,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  cursor: 'pointer', textAlign: 'center' as const,
                  transition: 'all .15s',
                  background: mode === 'production' ? '#22492E' : 'none',
                  color: mode === 'production' ? '#fff' : '#5A9E6F',
                  boxShadow: mode === 'production' ? '0 1px 3px rgba(13,22,18,.08)' : 'none',
                }}
              >
                Produção
              </button>
              <button
                onClick={() => onModeChange('monitoring')}
                style={{
                  flex: 1, padding: '5px 6px', border: 'none',
                  borderRadius: '8px', fontSize: 11, fontWeight: 500,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  cursor: 'pointer', textAlign: 'center' as const,
                  transition: 'all .15s',
                  background: mode === 'monitoring' ? '#22492E' : 'none',
                  color: mode === 'monitoring' ? '#fff' : '#5A9E6F',
                  boxShadow: mode === 'monitoring' ? '0 1px 3px rgba(13,22,18,.08)' : 'none',
                }}
              >
                KRATOS
              </button>
            </div>
          </div>

          {/* VISUALIZAÇÃO */}
          <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.2px', color: '#3D7A50', textTransform: 'uppercase', marginBottom: 6}}>Visualização</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {[
                { id: 'etapa',       label: 'Por Etapa' },
                { id: 'passoapasso', label: 'Passo a Passo' },
                { id: 'extended',    label: 'Extended' },
                { id: 'passagem',    label: 'Passagem' },
              ].map(v => (
                <button
                  key={v.id}
                  onClick={() => onVizModeChange(v.id)}
                  style={{
                    padding: '6px 4px',
                    background: vizMode === v.id ? 'rgba(200,168,75,.12)' : 'rgba(255,255,255,.04)',
                    border: vizMode === v.id ? '1px solid rgba(200,168,75,.3)' : '1px solid rgba(255,255,255,.06)',
                    borderRadius: '8px',
                    color: vizMode === v.id ? '#D9BF73' : '#5A9E6F',
                    fontSize: 10, fontWeight: 500,
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    cursor: 'pointer', textAlign: 'center' as const,
                    lineHeight: 1.3, transition: 'all .15s',
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* AÇÕES */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.2px', color: '#3D7A50', textTransform: 'uppercase', marginBottom: 6}}>Ações</div>

            {user?.role !== 'cliente' && (
              <button onClick={onNovaSessao} className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors mb-1" style={{ fontSize: 12, color: 'var(--ink-200)' }}>
                🔄 Nova Sessão
              </button>
            )}

            {user?.role !== 'cliente' && (
              <>
                <button onClick={onOpenPainel} className="w-full text-left px-3 py-2 rounded-lg transition-colors mb-1" style={{ fontSize: 12, background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)', color: 'var(--gold-400)' }}>
                  🖥️ Painel KRATOS
                </button>
                <button onClick={onGerarRelatorioKratos} className="w-full text-left px-3 py-2 rounded-lg transition-colors mb-1" style={{ fontSize: 12, background: 'rgba(0,77,64,.35)', border: '1px solid rgba(128,203,196,.15)', color: '#80CBC4' }}>
                  🤖 Gerar Relatório KRATOS
                </button>
              </>
            )}

            {user?.role === 'admin' && (
              <>
                <button onClick={onShowUsers} className="w-full text-left px-3 py-2 rounded-lg transition-colors mb-1 bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-200" style={{ fontSize: 12 }}>
                  👥 Gestão de Usuários
                </button>
                <button onClick={onShowBackup} className="w-full text-left px-3 py-2 rounded-lg transition-colors mb-1 bg-yellow-900/40 hover:bg-yellow-900/60 border border-yellow-500/30 text-yellow-200" style={{ fontSize: 12 }}>
                  💾 Backup do Banco
                </button>
              </>
            )}

            {user?.role !== 'cliente' && projeto.nome && (
              <button onClick={onCopyClientLink} className="w-full text-left px-3 py-2 rounded-lg transition-colors mb-1 bg-blue-900/40 hover:bg-blue-900/60 border border-blue-500/30 text-blue-200" style={{ fontSize: 12 }}>
                🔗 Link do Cliente
              </button>
            )}
          </div>

          {/* REVISÃO ANALÍTICA */}
          {user?.role !== 'cliente' && sessionId && (
            <div style={{ marginBottom: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.2px', color: '#5A9E6F', textTransform: 'uppercase', marginBottom: 6}}>Rigor Analítico</div>
              <button onClick={onShowReviewModal} className="w-full text-left px-3 py-2 rounded-lg transition-colors" style={{ fontSize: 12, background: 'rgba(0,77,64,.35)', border: '1px solid rgba(128,203,196,.15)', color: '#80CBC4' }}>
                {analyticReview
                  ? `🔍 ${analyticReview.status === 'aprovado' ? '✅ Aprovado' : analyticReview.status === 'aprovado_com_ressalvas' ? '⚠️ Com Ressalvas' : analyticReview.status === 'requer_revisao' ? '🔴 Requer Revisão' : '⏳ Pendente'}`
                  : '🔍 Revisar Qualidade (ICD 203)'}
              </button>
            </div>
          )}

          {/* EXPORTAR */}
          {user?.role !== 'cliente' && (
            <div style={{ marginBottom: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.2px', color: '#3D7A50', textTransform: 'uppercase', marginBottom: 6}}>Exportar Relatório</div>
              <button onClick={onGerarRelatorioPadrao} disabled={exportingPdf} className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors mb-1 disabled:opacity-50" style={{ fontSize: 11, color: 'var(--ink-200)' }}>
                🖨️ Padrão — HERMES (PDF)
              </button>
              <button onClick={onGerarRelatorioEstendido} disabled={exportingPdf} className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50" style={{ fontSize: 11, color: 'var(--ink-200)' }}>
                🖨️ Estendido — Todos os Agentes (PDF)
              </button>
            </div>
          )}

          {/* HISTÓRICO */}
          <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.07)' }} ref={sessaoListRef}>
            <button
              onClick={onToggleSessoes}
              className="w-full px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-left flex justify-between items-center"
              style={{ fontSize: 12, color: 'var(--ink-200)' }}
            >
              <span>{showSessoes ? '▲' : '▼'} Histórico de Análises</span>
              {sessoes.length > 0 && (
                <span style={{
                  background: 'var(--ink-600)', color: 'var(--ink-200)',
                  padding: '1px 6px', borderRadius: 4,
                  fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                }}>
                  {sessoes.length}
                </span>
              )}
            </button>

            {showSessoes && (
              <div className="mt-2 max-h-64 overflow-y-auto pr-1 space-y-1">
                <input
                  type="text"
                  value={sessionSearch}
                  onChange={e => onSessionSearchChange(e.target.value)}
                  placeholder="🔍 Pesquisar análise..."
                  className="w-full bg-white/10 text-white placeholder-gray-500 border border-white/10 rounded-lg px-3 py-1.5 mb-2 outline-none"
                  style={{ fontSize: 11 }}
                />
                <div className="flex gap-2 px-1 pb-2 mb-1 border-b border-white/10">
                  <label style={{ fontSize: 9 }} className="flex items-center gap-1 cursor-pointer text-[#90CAF9]">
                    <input type="checkbox" checked={filterStatus.producao} onChange={e => onFilterChange('producao', e.target.checked)} /> Produção
                  </label>
                  <label style={{ fontSize: 9 }} className="flex items-center gap-1 cursor-pointer text-[#66BB6A]">
                    <input type="checkbox" checked={filterStatus.ativos} onChange={e => onFilterChange('ativos', e.target.checked)} /> Ativos
                  </label>
                  <label style={{ fontSize: 9 }} className="flex items-center gap-1 cursor-pointer text-gray-400">
                    <input type="checkbox" checked={filterStatus.inativos} onChange={e => onFilterChange('inativos', e.target.checked)} /> Inativos
                  </label>
                </div>

                {sessoes.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-ter)', padding: '4px 8px' }}>Nenhuma análise salva.</div>
                ) : (
                  <>
                    {filterStatus.producao && (() => {
                      const producao = sessoes.filter(s =>
                        (s.status === 'Em produção' || !s.status) &&
                        (!sessionSearch || (s.name || '').toLowerCase().includes(sessionSearch.toLowerCase()))
                      );
                      return producao.length > 0 ? (
                        <div className="mb-2">
                          <div style={{ fontSize: 8, color: '#90CAF9', fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase' }}>Em Produção</div>
                          {producao.map(s => (
                            <SessionCard key={s.id} s={s} onClick={() => onCarregarSessao(s.id)} onDelete={e => onDeletarSessao(s.id, e)} />
                          ))}
                        </div>
                      ) : null;
                    })()}
                    {filterStatus.ativos && filter('Ativo').length > 0 && (
                      <div className="mb-2">
                        <div style={{ fontSize: 8, color: '#66BB6A', fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase' }}>Monitorados (Ativos)</div>
                        {filter('Ativo').map(s => (
                          <SessionCard key={s.id} s={s} onClick={() => onCarregarSessao(s.id)} onDelete={e => onDeletarSessao(s.id, e)} />
                        ))}
                      </div>
                    )}
                    {filterStatus.inativos && filter('Inativo').length > 0 && (
                      <div>
                        <div style={{ fontSize: 8, color: 'var(--text-ter)', fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase' }}>Arquivados (Inativos)</div>
                        {filter('Inativo').map(s => (
                          <SessionCard key={s.id} s={s} onClick={() => onCarregarSessao(s.id)} onDelete={e => onDeletarSessao(s.id, e)} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Perfil e Logout ─────────────────────────────────────────── */}
        <div style={{
          padding: '10px 14px',
          borderTop: '1px solid rgba(255,255,255,.08)',
          background: 'rgba(0,0,0,.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 'var(--r-md)',
              background: 'var(--ink-500)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: '#fff', fontWeight: 700,
            }}>
              {user?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#fff', fontWeight: 700, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </div>
              <div style={{ fontSize: 8, color: 'var(--gold-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {user?.role}
              </div>
            </div>
          </div>
          <button
            onClick={onLogout}
            style={{
              background: 'none', border: 'none',
              fontSize: 10, fontWeight: 700,
              color: '#ef9a9a', cursor: 'pointer',
              padding: '5px 8px', borderRadius: 'var(--r-md)',
              transition: 'background var(--t-fast)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,154,154,.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            SAIR
          </button>
        </div>

      </div>
    </div>
  );
}
