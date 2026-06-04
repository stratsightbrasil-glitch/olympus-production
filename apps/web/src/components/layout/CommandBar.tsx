import React, { useState, useRef, useEffect } from 'react';
import { AgentMark } from '../ui/AgentMark';
import type { Agent } from '../ui/AgentMark/types';
import type { MethodologyStep } from '../../data/methodologySteps';
import { DEFAULT_STEPS } from '../../data/methodologySteps';

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
  onGerarPlaybook?: () => void;
  onCopyClientLink: () => void;
  onToggleKratos?: () => void;
  // Linha 2 — subbar (dados do projeto)
  cliente?: string;
  horizonte?: string;
  questaoEstrategica?: string;
  classificacao?: string;
  teamName?: string;
  // Linha 3 — stepper dinâmico
  methodologyName?: string;
  methodologySteps?: MethodologyStep[];
  // Seletor LLM
  llmConfig?: { provider: string; model: string };
  anthropicModels?: { id: string; label: string }[];
  googleModels?: { id: string; label: string }[];
  deepseekModels?: { id: string; label: string }[];
  ollamaModels?: { id: string; size?: number }[];
  ollamaAvailable?: boolean;
  onLlmChange?: (config: { provider: string; model: string }) => void;
  /** Mapeamento tier→modelId (admin only). Ausente = sem controle de tiers na UI. */
  llmTiers?: Record<string, string>;
  onTierChange?: (tiers: Record<string, string>) => void;
  /** Status do cache de metodologias (admin only). */
  cacheStatus?: { entries: number; oldestEntryAt: string | null; ttlSeconds: number } | null;
  onInvalidateCache?: () => void;
  /** Modo de layout do relatório final. */
  reportLayout?: 'standard' | 'extended';
  onReportLayoutChange?: (layout: 'standard' | 'extended') => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────



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
  const agent: Agent = isKratos ? 'KRATOS' : 'ATHENA';
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
          v2.0 · MOTOR
        </div>
      </div>
    </div>
  );
}

// ─── Seletor de LLM ──────────────────────────────────────────────────────────

const ANTHROPIC_DEFAULT = [
  { id: 'claude-opus-4-7',          label: 'Claude Opus 4'     },
  { id: 'claude-sonnet-4-6',        label: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001',label: 'Claude Haiku 4.5'  },
];

const GOOGLE_DEFAULT = [
  { id: 'gemini-2.5-flash',       label: 'Gemini 2.5 Flash (premium)' },
  { id: 'gemini-2.5-flash-lite',  label: 'Gemini 2.5 Flash Lite'      },
  { id: 'gemini-2.5-pro',         label: 'Gemini 2.5 Pro'             },
];

const DEEPSEEK_DEFAULT = [
  { id: 'deepseek-chat',     label: 'DeepSeek V3'              },
  { id: 'deepseek-reasoner', label: 'DeepSeek R1 (raciocínio)' },
];

function modelShortLabel(provider: string, model: string): string {
  if (provider === 'ollama') return `⚡ ${model}`;
  if (provider === 'google') {
    if (model.includes('2.5-pro'))         return '🔮 Gemini 2.5 Pro';
    if (model.includes('2.5-flash-lite'))  return '🔮 Gemini 2.5 Lite';
    if (model.includes('2.5'))             return '🔮 Gemini 2.5 Flash';
    if (model.includes('pro'))             return '🔮 Gemini Pro';
    return `🔮 Gemini ${model.split('gemini-').pop() ?? model}`;
  }
  if (provider === 'deepseek') {
    if (model.includes('reasoner')) return '🌊 DeepSeek R1';
    return '🌊 DeepSeek V3';
  }
  if (model.includes('opus'))   return '☁ Opus 4';
  if (model.includes('sonnet')) return '☁ Sonnet';
  if (model.includes('haiku'))  return '☁ Haiku';
  return `☁ ${model.split('-').slice(-2).join(' ')}`;
}

function LlmSelector({
  llmConfig, anthropicModels, googleModels, deepseekModels,
  ollamaModels, ollamaAvailable, onLlmChange, llmTiers, onTierChange,
}: {
  llmConfig: { provider: string; model: string };
  anthropicModels: { id: string; label: string }[];
  googleModels: { id: string; label: string }[];
  deepseekModels: { id: string; label: string }[];
  ollamaModels: { id: string; size?: number }[];
  ollamaAvailable: boolean;
  onLlmChange?: (c: { provider: string; model: string }) => void;
  llmTiers?: Record<string, string>;
  onTierChange?: (tiers: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const aModels   = anthropicModels.length > 0 ? anthropicModels : ANTHROPIC_DEFAULT;
  const gModels   = googleModels.length > 0   ? googleModels   : GOOGLE_DEFAULT;
  const dsModels  = deepseekModels.length > 0 ? deepseekModels : DEEPSEEK_DEFAULT;
  // Modelos usados nos dropdowns de tier — usam os do provider ativo
  const tierModels: { id: string; label: string }[] = (() => {
    if (llmConfig.provider === 'google')   return gModels;
    if (llmConfig.provider === 'deepseek') return dsModels;
    if (llmConfig.provider === 'ollama')   return ollamaModels.map(m => ({ id: m.id, label: m.id }));
    return aModels;
  })();
  const isAdmin = !!onLlmChange;
  const label = modelShortLabel(llmConfig.provider, llmConfig.model);

  const chipStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '4px 9px',
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.14)',
    borderRadius: 5,
    fontSize: 11, color: '#A3C9AE',
    fontFamily: "'DM Mono','Cascadia Code',monospace",
    cursor: isAdmin ? 'pointer' : 'default',
    whiteSpace: 'nowrap' as const,
    position: 'relative' as const,
    userSelect: 'none' as const,
  };

  const select = (provider: string, model: string) => {
    onLlmChange?.({ provider, model });
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <div
        style={chipStyle}
        onClick={() => isAdmin && setOpen(o => !o)}
        title={isAdmin ? 'Alterar provedor LLM' : `Provedor: ${llmConfig.provider} / ${llmConfig.model}`}
      >
        {label}
        {isAdmin && <span style={{ fontSize: 8, opacity: .7, marginLeft: 2 }}>▾</span>}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: '#1B2E23', border: '1px solid rgba(255,255,255,.14)',
          borderRadius: 8, padding: '6px 0', minWidth: 220, zIndex: 999,
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }}>
          {/* ☁ Anthropic */}
          <div style={{ padding: '4px 12px 4px', fontSize: 9, color: '#6A9A7A', fontFamily: "'DM Mono',monospace", letterSpacing: 1.2, textTransform: 'uppercase' }}>
            ☁ Anthropic
          </div>
          {aModels.map(m => {
            const active = llmConfig.provider === 'anthropic' && llmConfig.model === m.id;
            return (
              <div
                key={m.id}
                onClick={() => select('anthropic', m.id)}
                style={{
                  padding: '3px 16px', fontSize: 12, cursor: 'pointer',
                  color: active ? '#C9A84C' : '#A3C9AE',
                  fontWeight: active ? 700 : 400,
                  fontFamily: "'DM Sans',system-ui,sans-serif",
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'transparent', transition: 'background .1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ opacity: active ? 1 : 0, fontSize: 10 }}>●</span>
                {m.label}
              </div>
            );
          })}

          {/* Divisor */}
          <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '6px 0' }} />

          {/* 🔮 Google */}
          <div style={{ padding: '4px 12px 4px', fontSize: 9, color: '#6A9A7A', fontFamily: "'DM Mono',monospace", letterSpacing: 1.2, textTransform: 'uppercase' }}>
            🔮 Google
          </div>
          {gModels.map(m => {
            const active = llmConfig.provider === 'google' && llmConfig.model === m.id;
            return (
              <div
                key={m.id}
                onClick={() => select('google', m.id)}
                style={{
                  padding: '3px 16px', fontSize: 12, cursor: 'pointer',
                  color: active ? '#C9A84C' : '#A3C9AE',
                  fontWeight: active ? 700 : 400,
                  fontFamily: "'DM Sans',system-ui,sans-serif",
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'transparent', transition: 'background .1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ opacity: active ? 1 : 0, fontSize: 10 }}>●</span>
                {m.label}
              </div>
            );
          })}

          {/* Divisor */}
          <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '6px 0' }} />

          {/* 🌊 DeepSeek */}
          <div style={{ padding: '4px 12px 4px', fontSize: 9, color: '#6A9A7A', fontFamily: "'DM Mono',monospace", letterSpacing: 1.2, textTransform: 'uppercase' }}>
            🌊 DeepSeek
          </div>
          {dsModels.map(m => {
            const active = llmConfig.provider === 'deepseek' && llmConfig.model === m.id;
            return (
              <div
                key={m.id}
                onClick={() => select('deepseek', m.id)}
                style={{
                  padding: '3px 16px', fontSize: 12, cursor: 'pointer',
                  color: active ? '#C9A84C' : '#A3C9AE',
                  fontWeight: active ? 700 : 400,
                  fontFamily: "'DM Sans',system-ui,sans-serif",
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'transparent', transition: 'background .1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ opacity: active ? 1 : 0, fontSize: 10 }}>●</span>
                {m.label}
              </div>
            );
          })}

          {/* Divisor */}
          <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '6px 0' }} />

          {/* ⚡ Ollama local */}
          <div style={{ padding: '4px 12px 4px', fontSize: 9, color: ollamaAvailable ? '#6A9A7A' : '#4A5A4A', fontFamily: "'DM Mono',monospace", letterSpacing: 1.2, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            ⚡ Ollama local
            {!ollamaAvailable && <span style={{ fontSize: 8, color: '#6A5A4A' }}>offline</span>}
          </div>
          {ollamaAvailable && ollamaModels.length === 0 && (
            <div style={{ padding: '6px 16px', fontSize: 11, color: '#6A9A7A', fontStyle: 'italic' }}>
              Nenhum modelo baixado
            </div>
          )}
          {!ollamaAvailable && (
            <div style={{ padding: '6px 16px', fontSize: 11, color: '#6A5A4A', fontStyle: 'italic' }}>
              Iniciando… aguarde o container carregar
            </div>
          )}
          {ollamaAvailable && ollamaModels.map(m => {
            const active = llmConfig.provider === 'ollama' && llmConfig.model === m.id;
            const sizeGB = m.size ? `${(m.size / 1e9).toFixed(1)} GB` : '';
            return (
              <div
                key={m.id}
                onClick={() => select('ollama', m.id)}
                style={{
                  padding: '3px 16px', fontSize: 12, cursor: 'pointer',
                  color: active ? '#C9A84C' : '#A3C9AE',
                  fontWeight: active ? 700 : 400,
                  fontFamily: "'DM Mono','Cascadia Code',monospace",
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'transparent', transition: 'background .1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ opacity: active ? 1 : 0, fontSize: 10 }}>●</span>
                  {m.id}
                </span>
                {sizeGB && <span style={{ fontSize: 10, color: '#4A7A5A' }}>{sizeGB}</span>}
              </div>
            );
          })}

          {/* ⚙ Tiers de Agentes — visível para admin em qualquer provider */}
          {onTierChange && llmTiers && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '6px 0' }} />
              <div style={{ padding: '4px 12px 6px', fontSize: 9, color: '#6A9A7A', fontFamily: "'DM Mono',monospace", letterSpacing: 1.2, textTransform: 'uppercase' }}>
                ⚙ Tiers de Agentes
              </div>
              {(['economy', 'premium'] as const).map(tier => {
                const TIER_LABELS: Record<string, string> = {
                  economy: 'Economy  (SCOPUS, KRATOS)',
                  premium: 'Premium  (KLIO, ATHENA, síntese…)',
                };
                const currentModelId = llmTiers[tier] ?? '';
                return (
                  <div key={tier} style={{ padding: '4px 12px 6px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 10, color: '#6A9A7A', fontFamily: "'DM Mono',monospace" }}>
                      {TIER_LABELS[tier]}
                    </span>
                    <select
                      value={currentModelId}
                      onChange={e => onTierChange({ ...llmTiers, [tier]: e.target.value })}
                      onClick={e => e.stopPropagation()}
                      style={{
                        background: '#13221A', border: '1px solid rgba(255,255,255,.18)',
                        borderRadius: 4, color: '#C9A84C', fontSize: 11,
                        fontFamily: "'DM Mono',monospace", padding: '3px 6px', cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      <option value="" disabled>— escolha um modelo —</option>
                      {tierModels.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CommandBar ───────────────────────────────────────────────────────────────

export function CommandBar({
  mode, projetoNome, progressAgent, streamingText, currentStep, user,
  mainView, onToggleSidebar, onNovaSessao, onGerarRelatorio, onGerarPlaybook, onCopyClientLink, onToggleKratos,
  cliente, horizonte, questaoEstrategica, classificacao, teamName,
  methodologyName = 'grumbach', methodologySteps,
  llmConfig, anthropicModels, googleModels, deepseekModels,
  ollamaModels, ollamaAvailable, onLlmChange, llmTiers, onTierChange,
  cacheStatus, onInvalidateCache,
  reportLayout = 'standard', onReportLayoutChange,
}: CommandBarProps) {
  const steps: MethodologyStep[] = methodologySteps ?? DEFAULT_STEPS;
  const isCliente = user?.role === 'cliente';
  const activeAgent = progressAgent || (streamingText ? 'HERMES' : '');
  const activeStep = activeAgent ? (steps.find(s => s.agent === activeAgent) ?? steps.find(s => s.num === currentStep)) : undefined;
  const agentChipText = activeStep ? `${activeAgent} · ${activeStep.label}` : activeAgent;

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

  const hasSubbar = !!(projetoNome && (cliente || horizonte || questaoEstrategica || classificacao || teamName));
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
          <div style={{ fontFamily: "'DM Mono','Cascadia Code',monospace", fontSize: 8, color: '#D9BF73', letterSpacing: '1.4px', marginTop: 1 }}>v2.0 · STRATSIGHT BR</div>
        </div>

        {/* Divisor */}
        <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,.16)', flexShrink: 0 }} />

        {/* Engine chip */}
        <EngineChip mode={mode} />

        {/* Agente ativo */}
        {activeAgent && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 20, padding: '4px 12px',
            fontSize: 10.5, color: '#A3C9AE',
            whiteSpace: 'nowrap' as const,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF50', boxShadow: '0 0 6px #4CAF50', animation: 'pulse-dot 2s ease-in-out infinite', flexShrink: 0 }} />
            {agentChipText} analisando
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Seletor LLM — visível para todos, editável apenas para admin */}
        {llmConfig && (
          <LlmSelector
            llmConfig={llmConfig}
            anthropicModels={anthropicModels || []}
            googleModels={googleModels || []}
            deepseekModels={deepseekModels || []}
            ollamaModels={ollamaModels || []}
            ollamaAvailable={!!ollamaAvailable}
            onLlmChange={onLlmChange}
            llmTiers={llmTiers}
            onTierChange={onTierChange}
          />
        )}

        {/* Badge de cache de metodologias — apenas admin */}
        {cacheStatus != null && (() => {
          const ageMs = cacheStatus.oldestEntryAt ? Date.now() - new Date(cacheStatus.oldestEntryAt).getTime() : 0;
          const ageMin = Math.floor(ageMs / 60_000);
          const isWarm = ageMin < 1;
          const badgeColor = isWarm ? '#4CAF50' : ageMin < 5 ? '#FFC107' : '#FF7043';
          const label = cacheStatus.entries === 0
            ? 'Cache vazio'
            : isWarm ? 'Prompt atual' : `Cache ${ageMin}m atrás`;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <div
                role="status"
                aria-label={`Cache de metodologias: ${label}. Entradas: ${cacheStatus.entries}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(255,255,255,.05)', border: `1px solid ${badgeColor}44`,
                  borderRadius: 5, padding: '4px 9px',
                  fontSize: 10, color: badgeColor, whiteSpace: 'nowrap' as const,
                }}
                title={`Entradas em cache: ${cacheStatus.entries}`}
              >
                <div aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: badgeColor, flexShrink: 0 }} />
                {label}
              </div>
              {onInvalidateCache && (
                <button
                  onClick={onInvalidateCache}
                  title="Limpar cache de metodologias — próxima análise recarrega do banco"
                  style={{
                    background: 'none', border: '1px solid rgba(255,255,255,.14)',
                    borderRadius: 5, color: '#A3C9AE', fontSize: 10,
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                    padding: '4px 8px', cursor: 'pointer',
                    transition: 'all .15s', whiteSpace: 'nowrap' as const,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#A3C9AE'; }}
                >
                  ↺ Invalidar
                </button>
              )}
            </div>
          );
        })()}

        {/* Toggle Standard / Estendido — visível para analistas e admins */}
        {!isCliente && onReportLayoutChange && (
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}
            title="Estendido inclui Raciocínio Analítico e Lastro Cognitivo completos">
            {(['standard', 'extended'] as const).map(opt => (
              <button key={opt} onClick={() => onReportLayoutChange(opt)} style={{
                background: reportLayout === opt ? 'rgba(201,168,76,.22)' : 'none',
                border: 'none', color: reportLayout === opt ? '#D9BF73' : '#7a9e87',
                fontSize: 10.5, fontWeight: reportLayout === opt ? 700 : 400,
                fontFamily: "'DM Sans',system-ui,sans-serif",
                padding: '5px 10px', cursor: 'pointer', transition: 'all .15s',
                whiteSpace: 'nowrap' as const,
              }}>
                {opt === 'standard' ? 'Padrão' : 'Estendido'}
              </button>
            ))}
          </div>
        )}

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

            {onGerarPlaybook && projetoNome && (
              <button
                onClick={onGerarPlaybook}
                style={btnBase}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#A3C9AE'; }}
                title="Gerar Playbook DOCX"
              >
                📘 Playbook
              </button>
            )}

            {projetoNome && (
              <button
                onClick={onCopyClientLink}
                style={btnBase}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#A3C9AE'; }}
                title="Link do cliente"
              >
                🔗 Link
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
          {teamName && (
            <MetaPair label="Equipe" value={teamName} />
          )}
          {teamName && (cliente || horizonte) && <Divider />}
          {cliente && (
            <MetaPair label="Cliente" value={cliente} />
          )}
          {cliente && horizonte && <Divider />}
          {horizonte && (
            <MetaPair label="Horizonte" value={horizonte} />
          )}
          {horizonte && questaoEstrategica && <Divider />}
          <div style={{ flex: 1, minWidth: 0 }}>
            {questaoEstrategica && (
              <MetaPair label="QEC" value={questaoEstrategica} truncate />
            )}
          </div>
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
      }}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 16, background: '#D4E2DA', flexShrink: 0 }} />;
}
