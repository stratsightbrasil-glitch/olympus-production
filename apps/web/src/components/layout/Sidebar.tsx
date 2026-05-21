import React, { useRef, useEffect } from 'react';
import { AGENTS } from '../../constants';

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

        {/* Logo */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 32, height: 32,
            borderRadius: 'var(--r-md)',
            background: 'var(--ink-400)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: '#fff', fontSize: 16,
          }}>
            Ω
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-ui)', fontWeight: 700,
              fontSize: 13, letterSpacing: '0.1em',
              color: 'var(--ink-200)',
            }}>
              STRATSIGHT
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: 'var(--gold-400)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              Strategic Foresight
            </div>
          </div>
        </div>

        {/* Projeto Ativo */}
        {projeto.nome && (
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,.08)',
            background: 'rgba(255,255,255,.04)',
            position: 'relative',
          }}>
            <div style={{ fontSize: 9, color: '#66BB6A', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>
              PROJETO ATIVO
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 24 }}>
              {projeto.nome}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{
                background: 'var(--ink-400)', color: '#fff',
                padding: '1px 7px', borderRadius: 4,
                fontSize: 9, fontWeight: 700,
                fontFamily: 'var(--font-mono)',
              }}>
                {projeto.metodologia}
              </span>
              <span style={{
                padding: '1px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                background: projeto.status === 'Ativo' ? 'rgba(0,100,0,.5)' : projeto.status === 'Inativo' ? 'rgba(100,0,0,.5)' : 'rgba(0,50,100,.5)',
                color: projeto.status === 'Ativo' ? '#a5d6a7' : projeto.status === 'Inativo' ? '#ef9a9a' : '#90caf9',
              }}>
                {(projeto.status || 'EM PRODUÇÃO').toUpperCase()}
              </span>
            </div>
            <button
              onClick={onShowSettings}
              style={{
                position: 'absolute', top: 12, right: 12,
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 14,
                transition: 'color var(--t-fast)',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,.4)')}
              title="Configurações do Projeto"
            >
              ⚙️
            </button>
          </div>
        )}

        {/* Ações — scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 9, color: '#66BB6A', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>AÇÕES</div>

          {user?.role !== 'cliente' && (
            <button onClick={onNovaSessao} className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors text-gray-200">
              🔄 Nova Sessão
            </button>
          )}

          {user?.role !== 'cliente' && (
            <>
              <button onClick={onOpenPainel} className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mt-2" style={{ background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.25)', color: 'var(--gold-400)' }}>
                🖥️ Painel KRATOS
              </button>
              <button onClick={onGerarRelatorioKratos} className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mt-1" style={{ background: 'rgba(0,77,64,.4)', border: '1px solid rgba(128,203,196,.2)', color: '#80CBC4' }}>
                🤖 Gerar Relatório Agora
              </button>
            </>
          )}

          {user?.role === 'admin' && (
            <>
              <button onClick={onShowUsers} className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mt-2 bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-200">
                👥 Gestão de Usuários
              </button>
              <button onClick={onShowBackup} className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mt-1 bg-yellow-900/40 hover:bg-yellow-900/60 border border-yellow-500/30 text-yellow-200">
                💾 Backup do Banco
              </button>
            </>
          )}

          {user?.role !== 'cliente' && projeto.nome && (
            <button onClick={onCopyClientLink} className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mt-1 bg-blue-900/40 hover:bg-blue-900/60 border border-blue-500/30 text-blue-200">
              🔗 Link do Cliente
            </button>
          )}

          {/* Revisão Analítica */}
          {user?.role !== 'cliente' && sessionId && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ fontSize: 9, color: '#80CBC4', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>RIGOR ANALÍTICO</div>
              <button onClick={onShowReviewModal} className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors" style={{ background: 'rgba(0,77,64,.4)', border: '1px solid rgba(128,203,196,.2)', color: '#80CBC4' }}>
                {analyticReview
                  ? `🔍 Revisão: ${analyticReview.status === 'aprovado' ? '✅ Aprovado' : analyticReview.status === 'aprovado_com_ressalvas' ? '⚠️ Com Ressalvas' : analyticReview.status === 'requer_revisao' ? '🔴 Requer Revisão' : '⏳ Pendente'}`
                  : '🔍 Revisar Qualidade (ICD 203)'}
              </button>
            </div>
          )}

          {/* Exportar */}
          {user?.role !== 'cliente' && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ fontSize: 9, color: '#66BB6A', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>EXPORTAR RELATÓRIO</div>
              <button onClick={onGerarRelatorioPadrao} disabled={exportingPdf} className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors text-gray-200 mb-1 disabled:opacity-50">
                🖨️ Padrão — Relatório HERMES (PDF)
              </button>
              <button onClick={onGerarRelatorioEstendido} disabled={exportingPdf} className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors text-gray-200 disabled:opacity-50">
                🖨️ Estendido — Todos os Agentes (PDF)
              </button>
            </div>
          )}

          {/* Histórico */}
          <div style={{ marginTop: 8 }} ref={sessaoListRef}>
            <button
              onClick={onToggleSessoes}
              className="w-full px-3 py-2 bg-white/5 hover:bg-white/10 text-sm rounded-lg transition-colors text-left text-gray-200 flex justify-between items-center"
            >
              <span>{showSessoes ? '▲' : '▼'} Histórico de Análises</span>
              {sessoes.length > 0 && (
                <span style={{
                  background: 'var(--ink-600)', color: 'var(--ink-200)',
                  padding: '1px 6px', borderRadius: 4,
                  fontSize: 9, fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
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
                  className="w-full text-[11px] bg-white/10 text-white placeholder-gray-500 border border-white/10 rounded-lg px-3 py-1.5 mb-2 outline-none focus:border-stratsight-medium/50"
                />
                <div className="flex gap-2 px-2 py-1 mb-1 border-b border-white/10 pb-2">
                  <label className="text-[9px] flex items-center gap-1 cursor-pointer text-[#90CAF9]">
                    <input type="checkbox" checked={filterStatus.producao} onChange={e => onFilterChange('producao', e.target.checked)} /> Produção
                  </label>
                  <label className="text-[9px] flex items-center gap-1 cursor-pointer text-[#66BB6A]">
                    <input type="checkbox" checked={filterStatus.ativos} onChange={e => onFilterChange('ativos', e.target.checked)} /> Ativos
                  </label>
                  <label className="text-[9px] flex items-center gap-1 cursor-pointer text-gray-400">
                    <input type="checkbox" checked={filterStatus.inativos} onChange={e => onFilterChange('inativos', e.target.checked)} /> Inativos
                  </label>
                </div>

                {sessoes.length === 0 ? (
                  <div className="text-xs text-gray-400 px-2 py-1">Nenhuma análise salva.</div>
                ) : (
                  <>
                    {filterStatus.producao && (() => {
                      const producao = sessoes.filter(s =>
                        (s.status === 'Em produção' || !s.status) &&
                        (!sessionSearch || (s.name || '').toLowerCase().includes(sessionSearch.toLowerCase()))
                      );
                      return producao.length > 0 ? (
                        <div className="mb-2">
                          <div style={{ fontSize: 9, color: '#90CAF9', fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase' }}>Em Produção</div>
                          {producao.map(s => (
                            <SessionCard key={s.id} s={s} onClick={() => onCarregarSessao(s.id)} onDelete={e => onDeletarSessao(s.id, e)} />
                          ))}
                        </div>
                      ) : null;
                    })()}
                    {filterStatus.ativos && filter('Ativo').length > 0 && (
                      <div className="mb-2">
                        <div style={{ fontSize: 9, color: '#66BB6A', fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase' }}>Monitorados (Ativos)</div>
                        {filter('Ativo').map(s => (
                          <SessionCard key={s.id} s={s} onClick={() => onCarregarSessao(s.id)} onDelete={e => onDeletarSessao(s.id, e)} />
                        ))}
                      </div>
                    )}
                    {filterStatus.inativos && filter('Inativo').length > 0 && (
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--text-ter)', fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase' }}>Arquivados (Inativos)</div>
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

        {/* Agentes MSEF */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 9, color: '#66BB6A', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 10 }}>AGENTES MSEF</div>
          {Object.entries(AGENTS).filter(([k]) => k !== 'ATHENA').map(([key, ag]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--agent-${key.toLowerCase()})`, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-200)', width: 76, fontFamily: 'var(--font-mono)' }}>{key}</span>
              <span style={{ fontSize: 10, color: 'var(--ink-300)' }}>{ag.label}</span>
            </div>
          ))}
        </div>

        {/* Perfil e Logout */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,.08)',
          background: 'rgba(0,0,0,.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30,
              borderRadius: 'var(--r-md)',
              background: 'var(--ink-500)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: '#fff', fontWeight: 700,
            }}>
              {user?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 700, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </div>
              <div style={{ fontSize: 9, color: 'var(--gold-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {user?.role}
              </div>
            </div>
          </div>
          <button
            onClick={onLogout}
            style={{
              background: 'none', border: 'none',
              fontSize: 11, fontWeight: 700,
              color: '#ef9a9a', cursor: 'pointer',
              padding: '6px 8px', borderRadius: 'var(--r-md)',
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
