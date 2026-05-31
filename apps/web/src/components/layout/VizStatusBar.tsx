import React from 'react';

// Sprint 21 — 'grafo' removido (motor único LangGraph para todos os modos)
const VIZ_LABELS: Record<string, string> = {
  passos:   'Passo a Passo',
  etapa:    'Etapa Completa',
  passagem: 'Processo Completo',
  thinking: 'Raciocínio Estendido',
};

interface VizStatusBarProps {
  vizMode: string;
  isWaiting: boolean;
  activeAgent: string;
  currentStep: number;
  totalSteps: number;
  methodologyName: string;
}

export function VizStatusBar({
  vizMode, isWaiting, activeAgent, currentStep, totalSteps, methodologyName,
}: VizStatusBarProps) {
  if (!methodologyName) return null;

  const modeLabel = VIZ_LABELS[vizMode] ?? vizMode;
  const isPassos = vizMode === 'passos';

  const badgeStyle: React.CSSProperties = isWaiting
    ? {
        background: 'var(--status-waiting-bg)',
        border: '1px solid var(--status-waiting-border)',
        color: 'var(--status-waiting)',
      }
    : {
        background: 'rgba(61,122,80,.08)',
        border: '1px solid rgba(61,122,80,.22)',
        color: 'var(--status-running)',
      };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Modo: ${modeLabel}${isWaiting ? ' — aguardando confirmação' : ''}`}
      style={{
        height: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 22px',
        background: '#EFF5F1',
        borderBottom: '1px solid #D4E2DA',
        fontSize: 11,
        flexShrink: 0,
      }}
    >
      {/* Badge de modo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '2px 9px',
        borderRadius: 4,
        fontWeight: 700,
        letterSpacing: '0.03em',
        ...badgeStyle,
      }}>
        {isWaiting && (
          <span style={{
            display: 'inline-block', width: 6, height: 6,
            borderRadius: '50%',
            background: 'var(--status-waiting)',
            animation: 'pulse-dot 1.5s ease-in-out infinite',
          }} />
        )}
        {isWaiting && isPassos ? 'Aguardando confirmação' : modeLabel}
      </div>

      <Sep />

      {/* Fase */}
      <span style={{ color: '#3D5A48' }}>
        Fase{' '}
        <strong style={{ color: '#0D1612' }}>
          {Math.max(1, currentStep)} de {totalSteps}
        </strong>
      </span>

      {/* Agente ativo */}
      {activeAgent && (
        <>
          <Sep />
          <span style={{ color: '#3D5A48' }}>
            Agente:{' '}
            <strong style={{ color: '#1B3A2D' }}>{activeAgent}</strong>
          </span>
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* Metodologia */}
      <span style={{
        fontFamily: "'DM Mono','Cascadia Code',monospace",
        fontSize: 9.5, letterSpacing: '1.2px',
        color: '#6B8C7A',
        background: 'rgba(255,255,255,.6)',
        padding: '2px 8px', borderRadius: 3,
      }}>
        {methodologyName.toUpperCase()}
      </span>
    </div>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 12, background: '#D4E2DA', flexShrink: 0 }} />;
}
