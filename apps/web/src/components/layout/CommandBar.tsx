import React from 'react';
import { AgentMark } from '../ui/AgentMark';
import type { Agent } from '../ui/AgentMark/types';
import type { MethodologyStep } from '../../data/methodologySteps';
import { METHODOLOGY_DEFS, DEFAULT_STEPS } from '../../data/methodologySteps';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CommandBarProps {
  // Linha 1 — topbar
  mode: string;
  projetoNome: string;
  progressAgent: string;
  streamingText: string;
  currentStep: number;
  user: { name: string; role: string } | null;
  mainView?: 'chat' | 'kratos';
  onToggleSidebar: () => void;
  onNovaSessao: () => void;
  onGerarRelatorio: () => void;
  onCopyClientLink: () => void;
  onToggleKratos?: () => void;
  // Linha 2 — subbar (dados do projeto)
  cliente?: string;
  horizonte?: string;
  questaoEstrategica?: string;
  classificacao?: string;
  // Linha 3 — stepper dinâmico
  methodologyName?: string;
  methodologySteps?: MethodologyStep[];
}

// ─── Constantes ───────────────────────────────────────────────────────────────

// Mantido apenas para retrocompatibilidade com usos externos se houver.
// O CommandBar usa methodologySteps prop ou fallback via METHODOLOGY_DEFS.
const _MSEF_STEPS_LEGACY = METHODOLOGY_DEFS['MSEF'] ?? DEFAULT_STEPS;

const CLASSIF_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  confidencial: { bg: '#FFF3E0', color: '#E65100', border: '#FFB74D' },
  restrito:     { bg: '#FFEBEE', color: '#C62828', border: '#EF9A9A' },
  secreto:      { bg: '#F3E5F5', color: '#6A1B9A', border: '#CE93D8' },
  ostensivo:    { bg: '#E8F5E9', color: '#2E7D52', border: '#A5D6A7' },
  público:      { bg: '#E8F5E9', color: '#2E7D52', border: '#A5D6A7' },
};

// ─── Chip do motor ────────────────────────────────────────────────────────────

function EngineChip({ mode }: { mode: string }) {
  const isKratos = mode === 'monitoring';
  const label = isKratos ? 'KRATOS' : 'ATHENA';
  const agent: Agent = isKratos ? 'KRATOS' : 'HERMES';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '4px 10px',
      background: 'rgba(201,168,76,.14)',
      border: '1px solid rgba(201,168,76,.38)',
      borderRadius: 5,
    }}>
      <AgentMark name={agent} scale="micro" size={16} />
      <div>
        <div style={{
          fontFamily: "'DM Sans',system-ui,sans-serif",
          fontWeight: 700, fontSize: 10.5, letterSpacing: '1.2px',
          color: '#D9BF73', lineHeight: 1,
        }}>
          {label}
        </div>
        <div style={{
          fontFamily: "'DM Mono','Cascadia Code',monospace",
          fontSize: 8, color: '#D9BF73', letterSpacing: '1px',
          opacity: .75, marginTop: 1,
        }}>
          v1.0 · MOTOR
        </div>
      </div>
    </div>
  );
}

// ─── CommandBar ───────────────────────────────────────────────────────────────

export function CommandBar({
  mode, projetoNome, progressAgent, streamingText, currentStep, user,
  mainView, onToggleSidebar, onNovaSessao, onGerarRelatorio, onCopyClientLink, onToggleKratos,
  cliente, horizonte, questaoEstrategica, classificacao,
  methodologyName = 'MSEF', methodologySteps,
}: CommandBarProps) {
  const steps: MethodologyStep[] = methodologySteps ?? METHODOLOGY_DEFS[methodologyName] ?? DEFAULT_STEPS;
  const isCliente = user?.role === 'cliente';
  const activeAgent = progressAgent || (streamingText ? 'HERMES' : '');

  const btnBase: React.CSSProperties = {
    background: 'none',
    border: '1px solid rgba(255,255,255,.14)',
    borderRadius: 5, color: '#A3C9AE',
    fontSize: 11.5, fontFamily: "'DM Sans',system-ui,sans-serif",
    padding: '5px 11px', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 5,
    transition: 'all .15s', whiteSpace: 'nowrap' as const,
    fontWeight: 500,
  };

  const classifKey = (classificacao || '').toLowerCase();
  const classifStyle = CLASSIF_COLORS[classifKey] ?? CLASSIF_COLORS.confidencial;

  const hasSubbar = !!(projetoNome && (cliente || horizonte || questaoEstrategica || classificacao));
  const hasStepper = !!(projetoNome && mode !== 'monitoring');

  return (
    <div style={{ flexShrink: 0, zIndex: 100 }}>

      {/* ── LINHA 1 · Topbar escura ─────────────────────────────────────── */}
      <div style={{
        height: 50,
        background: '#1B3A2D',
        borderBottom: '1px solid rgba(255,255,255,.08)',
        display: 'flex', alignItems: 'center',
        padding: '0 14px 0 0',
        gap: 14,
      }}>
        {/* Toggle sidebar */}
        <button
          onClick={onToggleSidebar}
          style={{ background: 'transparent', border: 'none', padding: 8, borderRadius: 5, cursor: 'pointer', color: '#A3C9AE', display: 'flex', alignItems: 'center', transition: 'background .15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          title="Alternar barra lateral"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>

        {/* Logo Ω */}
        <div style={{
          width: 28, height: 28,
          background: 'linear-gradient(135deg,#C9A84C 0%,#D9BF73 100%)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Fraunces',Georgia,serif",
          fontSize: 14, fontWeight: 700, color: '#142218', flexShrink: 0,
        }}>
          Ω
        </div>

        {/* Wordmark */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '1px', lineHeight: 1 }}>OLYMPUS</div>
          <div style={{ fontFamily: "'DM Mono','Cascadia Code',monospace", fontSize: 8, color: '#D9BF73', letterSpacing: '1.4px', marginTop: 1 }}>v1.0 · STRATSIGHT BR</div>
        </div>

        {/* Divisor */}
        <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,.16)', flexShrink: 0 }} />

        {/* Engine chip */}
        <EngineChip mode={mode} />

        {/* Título do projeto */}
        {projetoNome && (
          <div style={{
            fontFamily: "'DM Mono','Cascadia Code',monospace",
            fontSize: 10.5, letterSpacing: '1.6px', color: '#A3C9AE',
            textTransform: 'uppercase', fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 240, flex: 1, minWidth: 0,
          }}>
            {projetoNome}
          </div>
        )}

        {/* Agente ativo */}
        {activeAgent && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 20, padding: '4px 10px',
            fontSize: 10.5, color: '#A3C9AE', flexShrink: 0,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF50', boxShadow: '0 0 6px #4CAF50', animation: 'pulse-dot 2s ease-in-out infinite', flexShrink: 0 }} />
            {activeAgent} analisando
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Botões de ação */}
        {!isCliente && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              onClick={onGerarRelatorio}
              style={btnBase}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#A3C9AE'; }}
              title="Exportar Relatório"
            >
              ↓ Exportar
            </button>

            {projetoNome && (
              <button
                onClick={onCopyClientLink}
                style={btnBase}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#A3C9AE'; }}
                title="Link do cliente"
              >
                ⎘ Link
              </button>
            )}

            {/* Toggle KRATOS panel */}
            {projetoNome && onToggleKratos && (
              <button
                onClick={onToggleKratos}
                style={{
                  ...btnBase,
                  background: mainView === 'kratos' ? 'rgba(201,168,76,.25)' : 'none',
                  border: mainView === 'kratos' ? '1px solid #C9A84C' : '1px solid rgba(255,255,255,.14)',
                  color: mainView === 'kratos' ? '#C9A84C' : '#A3C9AE',
                  fontWeight: mainView === 'kratos' ? 700 : 500,
                }}
                onMouseEnter={e => { if (mainView !== 'kratos') { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = '#fff'; } }}
                onMouseLeave={e => { if (mainView !== 'kratos') { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#A3C9AE'; } }}
                title="Painel KRATOS"
              >
                ⚡ KRATOS
              </button>
            )}

            <button
              onClick={onNovaSessao}
              style={{
                background: '#C9A84C', border: '1px solid #C9A84C',
                borderRadius: 5, color: '#142218',
                fontSize: 11.5, fontWeight: 700,
                fontFamily: "'DM Sans',system-ui,sans-serif",
                padding: '5px 12px', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                transition: 'background .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#D9BF73')}
              onMouseLeave={e => (e.currentTarget.style.background = '#C9A84C')}
            >
              + Nova análise
            </button>

            {/* Avatar */}
            <div style={{ width: 4 }} />
            <div title={`${user?.name} (${user?.role})`} style={{
              width: 30, height: 30, background: '#22492E',
              border: '1.5px solid #3D7A50', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#A3C9AE', flexShrink: 0,
            }}>
              {user?.name?.slice(0, 2).toUpperCase() || '?'}
            </div>
          </div>
        )}

        {/* Avatar somente para cliente */}
        {isCliente && (
          <div style={{ paddingRight: 4 }}>
            <div title={`${user?.name} (${user?.role})`} style={{
              width: 30, height: 30, background: '#22492E',
              border: '1.5px solid #3D7A50', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#A3C9AE',
            }}>
              {user?.name?.slice(0, 2).toUpperCase() || '?'}
            </div>
          </div>
        )}
      </div>

      {/* ── LINHA 2 · Subbar branca — metadados do projeto ─────────────── */}
      {hasSubbar && (
        <div style={{
          height: 34, background: '#fff',
          borderBottom: '1px solid #D4E2DA',
          display: 'flex', alignItems: 'center',
          padding: '0 22px', gap: 18, overflow: 'hidden',
        }}>
          {cliente && (
            <MetaPair label="Cliente" value={cliente} />
          )}
          {cliente && horizonte && <Divider />}
          {horizonte && (
            <MetaPair label="Horizonte" value={horizonte} />
          )}
          {horizonte && questaoEstrategica && <Divider />}
          {questaoEstrategica && (
            <MetaPair label="QEC" value={questaoEstrategica} truncate />
          )}
          <div style={{ flex: 1 }} />
          {classificacao && (
            <div style={{
              fontFamily: "'DM Mono','Cascadia Code',monospace",
              fontSize: 9.5, letterSpacing: '1.6px', fontWeight: 700,
              color: classifStyle.color, background: classifStyle.bg,
              border: `1px solid ${classifStyle.border}`,
              padding: '3px 9px', borderRadius: 3, textTransform: 'uppercase',
              flexShrink: 0,
            }}>
              ⬢ {classificacao}
            </div>
          )}
        </div>
      )}

      {/* ── LINHA 3 · Stepper dinâmico por metodologia ──────────────────── */}
      {hasStepper && (
        <div style={{
          height: 46, background: '#F2F7F4',
          borderBottom: '1px solid #D4E2DA',
          display: 'flex', alignItems: 'center',
          padding: '0 22px', gap: 10, overflow: 'hidden',
        }}>
          <span style={{
            fontFamily: "'DM Mono','Cascadia Code',monospace",
            fontSize: 9, letterSpacing: '1.4px', color: '#1B3A2D',
            textTransform: 'uppercase', fontWeight: 700, marginRight: 8, flexShrink: 0,
          }}>
            {methodologyName} · {Math.max(1, currentStep)}/{steps.length}
          </span>

          {steps.map((step, idx) => {
            const done   = currentStep > step.num;
            const active = currentStep === step.num;
            const future = currentStep < step.num;
            return (
              <React.Fragment key={step.num}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AgentMark name={step.agent} scale="micro" size={14} active={active} dimmed={future} />
                  <div>
                    <span style={{
                      fontSize: active ? 11.5 : 11,
                      color: done ? '#6B8C7A' : active ? '#0D1612' : '#6B8C7A',
                      fontWeight: active ? 700 : 400,
                    }}>
                      {active ? `${step.agent} · ${step.label}` : step.label}
                    </span>
                    {active && (
                      <span style={{
                        display: 'block',
                        fontFamily: "'DM Mono','Cascadia Code',monospace",
                        fontSize: 9, color: '#6B8C7A', letterSpacing: '.5px', marginTop: 1,
                      }}>
                        analisando
                      </span>
                    )}
                  </div>
                </div>
                {idx < steps.length - 1 && (
                  <div style={{
                    flex: 1, height: 1.5,
                    background: done ? '#5A9E6F' : '#D4E2DA',
                    maxWidth: 28, flexShrink: 0,
                  }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

    </div>
  );
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function MetaPair({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
      <span style={{
        fontFamily: "'DM Mono','Cascadia Code',monospace",
        fontSize: 9, letterSpacing: '1.4px', color: '#6B8C7A',
        textTransform: 'uppercase', fontWeight: 600, flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 12, color: '#0D1612', fontWeight: 500,
        overflow: truncate ? 'hidden' : undefined,
        textOverflow: truncate ? 'ellipsis' : undefined,
        whiteSpace: truncate ? 'nowrap' : undefined,
        maxWidth: truncate ? 260 : undefined,
      }}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 16, background: '#D4E2DA', flexShrink: 0 }} />;
}
