interface TopbarProps {
  mode: string;
  projetoNome: string;
  progressAgent: string;
  streamingText: string;
  onToggleSidebar: () => void;
}

export function Topbar({ mode, projetoNome, progressAgent, streamingText, onToggleSidebar }: TopbarProps) {
  const activeAgent = progressAgent || (streamingText ? 'HERMES' : '');

  return (
    <header style={{
      height: 'var(--topbar-h)',
      background: 'var(--ink-800)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 12,
      boxShadow: 'var(--shadow-md)',
      zIndex: 10,
      flexShrink: 0,
    }}>
      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '6px',
          borderRadius: 'var(--r-md)',
          cursor: 'pointer',
          color: 'var(--text-inv)',
          display: 'flex',
          alignItems: 'center',
          transition: 'background var(--t-fast)',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.1)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        title="Alternar Barra Lateral"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>

      {/* Branding */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-ui)',
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: '0.12em',
          color: 'var(--ink-200)',
        }}>
          Ω OLYMPUS
          <span style={{ fontWeight: 400, color: 'var(--text-ter)', marginLeft: 6, fontSize: 12 }}>
            · StratSight Brasil
          </span>
        </div>
        {projetoNome && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--gold-400)',
            letterSpacing: '0.04em',
            marginTop: 1,
          }}>
            {projetoNome}
          </div>
        )}
      </div>

      {/* Mode badge */}
      <div style={{
        fontSize: 10, fontWeight: 700,
        padding: '3px 10px',
        borderRadius: 20,
        letterSpacing: '0.06em',
        background: mode === 'monitoring' ? 'rgba(0,77,64,.6)' : 'rgba(255,255,255,.1)',
        color: mode === 'monitoring' ? '#80CBC4' : 'rgba(255,255,255,.85)',
        border: mode === 'monitoring' ? '1px solid rgba(128,203,196,.2)' : '1px solid rgba(255,255,255,.08)',
      }}>
        {mode === 'monitoring' ? 'KRATOS · ACOMPANHAMENTO' : 'PRODUÇÃO DE CENÁRIOS'}
      </div>

      {/* SSE indicator */}
      {activeAgent && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,.06)',
          border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 20, padding: '4px 10px',
          fontSize: 11, color: 'var(--ink-200)',
          fontFamily: 'var(--font-ui)',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#4CAF50',
            boxShadow: '0 0 6px #4CAF50',
            animation: 'pulse-dot 2s ease-in-out infinite',
          }} />
          {activeAgent} analisando
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Tagline */}
      <div style={{
        fontFamily: 'var(--font-ui)',
        fontSize: 11,
        fontStyle: 'italic',
        color: 'var(--gold-400)',
      }}>
        Strategic Foresight
      </div>
    </header>
  );
}
