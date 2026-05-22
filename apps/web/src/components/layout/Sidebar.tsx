import React, { useRef, useEffect, useState } from 'react';
import { AgentMark } from '../ui/AgentMark';
import type { Agent } from '../ui/AgentMark/types';

// ─── Dados MSEF ──────────────────────────────────────────────────────────────

const MSEF_STEPS: { num: number; agent: Agent; label: string }[] = [
  { num: 1, agent: 'SCOPUS',    label: 'Escopo'      },
  { num: 2, agent: 'KLIO',      label: 'Drivers'     },
  { num: 3, agent: 'PYTHIA',    label: 'Eixos'       },
  { num: 4, agent: 'MNEMOSYNE', label: 'Narrativas'  },
  { num: 5, agent: 'THEMIS',    label: 'Implicações' },
];

// ─── Tipos ────────────────────────────────────────────────────────────────────

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
  analyticReview: Record<string, string> | null;
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

// ─── Ação contextual do CTA gold ─────────────────────────────────────────────

function getCtaAction(
  projeto: SidebarProps['projeto'],
  currentMsefStep: number,
  callbacks: Pick<SidebarProps, 'onNovaSessao' | 'onGerarRelatorioPadrao'>,
): { label: string; hint: string; onClick: (() => void) | undefined } {
  if (!projeto.nome) {
    return { label: 'Iniciar nova análise', hint: 'Configure o escopo do projeto.', onClick: callbacks.onNovaSessao };
  }
  if (currentMsefStep === 0) {
    return { label: 'Iniciar análise', hint: 'Pronto para o primeiro agente.', onClick: callbacks.onNovaSessao };
  }
  if (currentMsefStep < 5) {
    const next = MSEF_STEPS[currentMsefStep]; // próxima etapa (0-indexed)
    return {
      label: `Avançar para ${next?.label ?? `Etapa ${currentMsefStep + 1}`}`,
      hint: `Aguardando conclusão da etapa ${currentMsefStep}.`,
      onClick: undefined, // avança automaticamente quando o agente terminar
    };
  }
  return { label: 'Gerar relatório', hint: 'Análise concluída — exporte o PDF.', onClick: callbacks.onGerarRelatorioPadrao };
}

// ─── SessionCard interno ──────────────────────────────────────────────────────

function SessionCard({ s, onClick, onDelete }: {
  s: Session;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '7px 10px',
        background: 'rgba(0,0,0,.25)',
        border: '1px solid rgba(255,255,255,.06)',
        borderRadius: 5,
        cursor: 'pointer',
        position: 'relative',
        marginBottom: 4,
        transition: 'background .12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,.4)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,.25)')}
    >
      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 20 }}>
        {s.name || '(sem título)'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 9, color: '#A3C9AE', fontFamily: "'DM Mono',monospace" }}>{s.methodology}</span>
        <span style={{ fontSize: 9, color: '#6B8C7A', fontFamily: "'DM Mono',monospace" }}>
          {new Date(s.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      </div>
      <button
        onClick={onDelete}
        style={{
          position: 'absolute', top: 6, right: 6,
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,.3)', cursor: 'pointer',
          fontSize: 11, padding: '1px 3px', borderRadius: 3,
          lineHeight: 1, opacity: 0, transition: 'opacity .12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ef9a9a'; e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,.3)'; e.currentTarget.style.opacity = '0'; }}
        title="Remover"
      >
        ×
      </button>
    </div>
  );
}

// ─── Sidebar principal ────────────────────────────────────────────────────────

export function Sidebar({
  open, user, projeto, sessoes, showSessoes, sessionSearch, filterStatus,
  analyticReview, sessionId, exportingPdf,
  currentMsefStep,
  onNovaSessao, onShowUsers, onShowBackup,
  onCopyClientLink, onShowReviewModal, onGerarRelatorioPadrao, onGerarRelatorioEstendido,
  onShowSettings, onToggleSessoes, onSessionSearchChange, onFilterChange,
  onCarregarSessao, onDeletarSessao, onLogout,
  // props mantidas por compatibilidade (não usados na nova UI):
  // mode, vizMode, onModeChange, onVizModeChange, onOpenPainel, onGerarRelatorioKratos
}: SidebarProps) {
  const sessaoListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showSessoes && sessaoListRef.current) {
      setTimeout(() => sessaoListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  }, [showSessoes]);

  const isMSEF = projeto.metodologia === 'MSEF';
  const isAdmin = user?.role === 'admin';
  const isCliente = user?.role === 'cliente';

  const cta = getCtaAction(projeto, currentMsefStep, { onNovaSessao, onGerarRelatorioPadrao });

  // Badge de status do projeto
  const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
    'Em produção': { label: 'EM PRODUÇÃO',    bg: '#FFF3E0', color: '#E65100' },
    'Ativo':       { label: 'ATIVO · KRATOS', bg: '#E8F5E9', color: '#2E7D32' },
    'Inativo':     { label: 'INATIVO',        bg: 'rgba(255,255,255,.08)', color: '#6B8C7A' },
  };
  const statusStyle = STATUS_MAP[projeto.status] ?? STATUS_MAP['Em produção'];

  // Filtro de sessões
  const filterSessoes = (status: string) => sessoes.filter(s =>
    s.status === status &&
    (!sessionSearch || (s.name || '').toLowerCase().includes(sessionSearch.toLowerCase()))
  );

  // ── Estilos reutilizáveis ─────────────────────────────────────────────────
  const tierLabel: React.CSSProperties = {
    fontFamily: "'DM Mono','Cascadia Code',monospace",
    fontSize: 9, letterSpacing: '1.5px', color: '#A3C9AE',
    fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' as const,
  };

  const outlineBtn: React.CSSProperties = {
    width: '100%', textAlign: 'left' as const,
    padding: '8px 10px',
    border: '1px solid rgba(255,255,255,.10)',
    borderRadius: 5,
    fontSize: 12, color: '#A3C9AE',
    background: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
    transition: 'border-color .12s, background .12s',
    fontFamily: "'DM Sans',system-ui,sans-serif",
  };

  return (
    <div style={{
      width: open ? 'var(--sidebar-w)' : 0,
      background: '#142218',
      color: '#A3C9AE',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      transition: 'width .3s ease',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-lg)',
      zIndex: 20,
    }}>
      <div style={{ width: 'var(--sidebar-w)', display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── BRAND ROW ───────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px 14px',
          borderBottom: '1px solid rgba(255,255,255,.06)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg,#C9A84C 0%,#D9BF73 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Fraunces',Georgia,serif",
            fontSize: 15, fontWeight: 700, color: '#142218', flexShrink: 0,
          }}>
            Ω
          </div>
          <div>
            <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 700, fontSize: 15, letterSpacing: '1px', color: '#fff', lineHeight: 1 }}>OLYMPUS</div>
            <div style={{ fontFamily: "'DM Mono','Cascadia Code',monospace", fontSize: 9, letterSpacing: '1.4px', color: '#D9BF73', marginTop: 1, fontWeight: 600 }}>v1.0 · STRATSIGHT BR</div>
          </div>
        </div>

        {/* ── PROJETO ATIVO ───────────────────────────────────────────────── */}
        {projeto.nome && (
          <div style={{
            background: '#1B3A2D',
            borderRadius: 8, margin: '10px 12px 0',
            padding: '12px 12px',
            position: 'relative',
          }}>
            <div style={{ fontFamily: "'DM Mono','Cascadia Code',monospace", fontSize: 9, letterSpacing: '1.5px', color: '#D9BF73', fontWeight: 700 }}>
              PROJETO ATIVO
            </div>
            <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 600, fontSize: 14, color: '#fff', marginTop: 4, lineHeight: 1.2 }}>
              {projeto.nome}
            </div>
            <div style={{ marginTop: 8, fontFamily: "'DM Mono','Cascadia Code',monospace", fontSize: 9.5, color: '#A3C9AE', letterSpacing: '.5px' }}>
              {isMSEF ? `MSEF · ETAPA ${Math.max(1, currentMsefStep)} · ` : ''}
              <span style={{ background: statusStyle.bg, color: statusStyle.color, padding: '1px 5px', borderRadius: 2, fontWeight: 700, letterSpacing: '1px', fontSize: 9 }}>
                {statusStyle.label}
              </span>
            </div>
            <button
              onClick={onShowSettings}
              style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,.25)', cursor: 'pointer', fontSize: 12, padding: 2, borderRadius: 3 }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,.8)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,.25)')}
              title="Configurações"
            >
              ⚙
            </button>
          </div>
        )}

        {/* ── ÁREA ROLÁVEL ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '12px 12px' }}>

          {/* TIER 1 · CONTINUAR */}
          {!isCliente && (
            <div style={{ marginBottom: 14 }}>
              <div style={tierLabel}>Continuar</div>
              <button
                onClick={cta.onClick}
                disabled={!cta.onClick}
                style={{
                  width: '100%',
                  background: cta.onClick ? '#C9A84C' : 'rgba(201,168,76,.35)',
                  color: '#142218',
                  border: 'none', borderRadius: 6,
                  padding: '10px 14px',
                  fontWeight: 700, fontSize: 12.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: cta.onClick ? 'pointer' : 'default',
                  fontFamily: "'DM Sans',system-ui,sans-serif",
                  opacity: cta.onClick ? 1 : .7,
                  transition: 'background .15s',
                }}
                onMouseEnter={e => { if (cta.onClick) e.currentTarget.style.background = '#D9BF73'; }}
                onMouseLeave={e => { if (cta.onClick) e.currentTarget.style.background = '#C9A84C'; }}
              >
                <span>{cta.label}</span>
                <span style={{ fontFamily: "'DM Mono','Cascadia Code',monospace", fontSize: 13 }}>→</span>
              </button>
              <div style={{
                fontFamily: "'DM Mono','Cascadia Code',monospace",
                fontSize: 9.5, color: '#A3C9AE',
                marginTop: 5, letterSpacing: '.4px', lineHeight: 1.5,
              }}>
                {cta.hint}
              </div>
            </div>
          )}

          {/* TIER 2 · SESSÃO */}
          {!isCliente && (
            <div style={{ marginBottom: 14 }}>
              <div style={tierLabel}>Sessão</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  style={outlineBtn}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.22)'; e.currentTarget.style.background = 'rgba(255,255,255,.03)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.10)'; e.currentTarget.style.background = 'none'; }}
                  onClick={onNovaSessao}
                >
                  Nova análise
                </button>
                <button
                  style={{ ...outlineBtn, justifyContent: 'space-between' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.22)'; e.currentTarget.style.background = 'rgba(255,255,255,.03)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.10)'; e.currentTarget.style.background = 'none'; }}
                  onClick={onToggleSessoes}
                >
                  <span>Histórico de análises</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {sessoes.length > 0 && (
                      <span style={{ background: '#22492E', color: '#A3C9AE', padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
                        {sessoes.length}
                      </span>
                    )}
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6B8C7A' }}>{showSessoes ? '▲' : '▼'}</span>
                  </span>
                </button>
              </div>

              {/* Lista de sessões */}
              {showSessoes && (
                <div ref={sessaoListRef} style={{ marginTop: 6 }}>
                  <input
                    type="text"
                    value={sessionSearch}
                    onChange={e => onSessionSearchChange(e.target.value)}
                    placeholder="Pesquisar análise..."
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(255,255,255,.08)', color: '#fff',
                      border: '1px solid rgba(255,255,255,.1)',
                      borderRadius: 5, padding: '6px 10px',
                      fontSize: 11, outline: 'none',
                      fontFamily: "'DM Sans',system-ui,sans-serif",
                      marginBottom: 6,
                    }}
                  />
                  <div style={{ display: 'flex', gap: 10, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,.07)', marginBottom: 6 }}>
                    {([['producao', 'Produção', '#90CAF9'], ['ativos', 'Ativos', '#66BB6A'], ['inativos', 'Inativos', '#9E9E9E']] as const).map(([k, l, c]) => (
                      <label key={k} style={{ fontSize: 9, color: c, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <input
                          type="checkbox"
                          checked={filterStatus[k]}
                          onChange={e => onFilterChange(k, e.target.checked)}
                          style={{ accentColor: c }}
                        />
                        {l}
                      </label>
                    ))}
                  </div>
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {sessoes.length === 0 ? (
                      <div style={{ fontSize: 11, color: '#6B8C7A', padding: '4px 0' }}>Nenhuma análise salva.</div>
                    ) : (
                      <>
                        {filterStatus.producao && (() => {
                          const prod = sessoes.filter(s => (s.status === 'Em produção' || !s.status) && (!sessionSearch || (s.name || '').toLowerCase().includes(sessionSearch.toLowerCase())));
                          return prod.length > 0 ? (
                            <div style={{ marginBottom: 6 }}>
                              <div style={{ fontSize: 8, color: '#90CAF9', fontWeight: 700, padding: '2px 0', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: "'DM Mono',monospace", marginBottom: 3 }}>Em Produção</div>
                              {prod.map(s => <SessionCard key={s.id} s={s} onClick={() => onCarregarSessao(s.id)} onDelete={e => onDeletarSessao(s.id, e)} />)}
                            </div>
                          ) : null;
                        })()}
                        {filterStatus.ativos && filterSessoes('Ativo').length > 0 && (
                          <div style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 8, color: '#66BB6A', fontWeight: 700, padding: '2px 0', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: "'DM Mono',monospace", marginBottom: 3 }}>Monitorados (Ativos)</div>
                            {filterSessoes('Ativo').map(s => <SessionCard key={s.id} s={s} onClick={() => onCarregarSessao(s.id)} onDelete={e => onDeletarSessao(s.id, e)} />)}
                          </div>
                        )}
                        {filterStatus.inativos && filterSessoes('Inativo').length > 0 && (
                          <div>
                            <div style={{ fontSize: 8, color: '#9E9E9E', fontWeight: 700, padding: '2px 0', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: "'DM Mono',monospace", marginBottom: 3 }}>Arquivados (Inativos)</div>
                            {filterSessoes('Inativo').map(s => <SessionCard key={s.id} s={s} onClick={() => onCarregarSessao(s.id)} onDelete={e => onDeletarSessao(s.id, e)} />)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TIER 3 · ENTREGÁVEIS */}
          {!isCliente && projeto.nome && (
            <div style={{ marginBottom: 14 }}>
              <div style={tierLabel}>Entregáveis</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { label: 'Relatório padrão',    trailing: '↓ PDF', fn: onGerarRelatorioPadrao, disabled: exportingPdf },
                  { label: 'Relatório estendido', trailing: '↓ PDF', fn: onGerarRelatorioEstendido, disabled: exportingPdf },
                  { label: 'Link do cliente',     trailing: '⎘',     fn: onCopyClientLink, disabled: false },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={item.fn}
                    disabled={item.disabled}
                    style={{ ...outlineBtn, justifyContent: 'space-between', opacity: item.disabled ? .5 : 1 }}
                    onMouseEnter={e => { if (!item.disabled) { e.currentTarget.style.borderColor = 'rgba(255,255,255,.22)'; e.currentTarget.style.background = 'rgba(255,255,255,.03)'; }}}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.10)'; e.currentTarget.style.background = 'none'; }}
                  >
                    <span>{item.label}</span>
                    <span style={{ fontFamily: "'DM Mono','Cascadia Code',monospace", fontSize: 10, color: '#A3C9AE' }}>{item.trailing}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* REVISÃO ANALÍTICA */}
          {!isCliente && sessionId && (
            <div style={{ marginBottom: 14 }}>
              <div style={tierLabel}>Rigor analítico</div>
              <button
                onClick={onShowReviewModal}
                style={{ ...outlineBtn, justifyContent: 'space-between' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.22)'; e.currentTarget.style.background = 'rgba(255,255,255,.03)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.10)'; e.currentTarget.style.background = 'none'; }}
              >
                <span style={{ fontSize: 11.5 }}>
                  {analyticReview
                    ? `Revisão · ${analyticReview['status'] === 'aprovado' ? 'Aprovado' : analyticReview['status'] === 'aprovado_com_ressalvas' ? 'Com Ressalvas' : analyticReview['status'] === 'requer_revisao' ? 'Requer Revisao' : 'Pendente'}`
                    : 'Revisar qualidade (ICD 203)'}
                </span>
                <span style={{ fontFamily: "'DM Mono','Cascadia Code',monospace", fontSize: 10, color: '#D9BF73' }}>↗</span>
              </button>
            </div>
          )}

        </div>

        {/* ── ADMIN FOOTER ────────────────────────────────────────────────── */}
        {!isCliente && (
          <div style={{
            padding: '10px 14px',
            borderTop: '1px solid rgba(255,255,255,.06)',
            marginTop: 'auto',
          }}>
            {isAdmin && (
              <>
                <div style={tierLabel}>Administração</div>
                <div style={{ marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <button
                    onClick={onShowUsers}
                    style={{ background: 'none', border: 'none', textAlign: 'left' as const, padding: '5px 0', fontSize: 11.5, color: '#A3C9AE', cursor: 'pointer', fontFamily: "'DM Sans',system-ui,sans-serif", transition: 'color .12s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#A3C9AE')}
                  >
                    Usuários · Backup · Engine
                  </button>
                  <button
                    onClick={onShowReviewModal}
                    style={{ background: 'none', border: 'none', textAlign: 'left' as const, padding: '5px 0', fontSize: 11.5, color: '#A3C9AE', cursor: 'pointer', fontFamily: "'DM Sans',system-ui,sans-serif", transition: 'color .12s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#A3C9AE')}
                  >
                    Revisao analítica · ICD 203
                  </button>
                </div>
              </>
            )}

            {/* Perfil do usuário */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              paddingTop: 8,
              borderTop: '1px solid rgba(255,255,255,.06)',
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: '#22492E', border: '1px solid #3D7A50',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'DM Mono','Cascadia Code',monospace",
                fontSize: 9, fontWeight: 700, letterSpacing: '.5px', color: '#A3C9AE',
              }}>
                {user?.name?.slice(0, 2).toUpperCase() || '??'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name}
                </div>
                <div style={{ fontFamily: "'DM Mono','Cascadia Code',monospace", fontSize: 9, color: '#A3C9AE', letterSpacing: '.5px' }}>
                  {user?.role?.toUpperCase()}
                </div>
              </div>
              <button
                onClick={onLogout}
                style={{ background: 'none', border: 'none', fontSize: 10, fontWeight: 700, color: '#ef9a9a', cursor: 'pointer', padding: '4px 6px', borderRadius: 4, transition: 'background .12s', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,154,154,.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                SAIR
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
