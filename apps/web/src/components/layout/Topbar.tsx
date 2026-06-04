const MSEF_STEPS = [
  { num: 1, agent: 'KLIO', label: 'Escopo' },
  { num: 2, agent: 'KLIO', label: 'Drivers + Sinais' },
  { num: 3, agent: 'KLIO', label: 'Incertezas · Eixos' },
  { num: 4, agent: 'KLIO', label: 'Narrativas' },
  { num: 5, agent: 'KLIO', label: 'Implicações' },
];

interface TopbarProps {
  mode: string;
  projetoNome: string;
  progressAgent: string;
  streamingText: string;
  currentMsefStep: number;
  user: { name: string; role: string } | null;
  onToggleSidebar: () => void;
  onNovaSessao: () => void;
  onGerarRelatorio: () => void;
  onCopyClientLink: () => void;
}

export function Topbar({
  mode, projetoNome, progressAgent, streamingText, currentMsefStep, user,
  onToggleSidebar, onNovaSessao, onGerarRelatorio, onCopyClientLink,
}: TopbarProps) {
  const activeAgent = progressAgent || (streamingText ? 'HERMES' : '');
  const stepInfo = currentMsefStep >= 1 && currentMsefStep <= 5 ? MSEF_STEPS[currentMsefStep - 1] : null;
  const isCliente = user?.role === 'cliente';

  const btnBase: React.CSSProperties = {
    background: 'none',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '8px',
    color: '#A3C9AE',
    fontSize: 12,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    padding: '5px 12px',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 5,
    transition: 'all .15s',
    whiteSpace: 'nowrap' as const,
  };

  return (
    <header style={{
      height: '52px',
      background: '#1B3A2D',
      borderBottom: '1px solid #2D5C3A',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px 0 0',
      flexShrink: 0,
      zIndex: 100,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>

      {/* ── Zona esquerda: toggle + marca ─────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 14px',
        borderRight: '1px solid rgba(255,255,255,.07)',
        height: '100%',
        flexShrink: 0,
      }}>
        {/* Sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          style={{
            background: 'transparent', border: 'none',
            padding: '5px', borderRadius: '6px', cursor: 'pointer',
            color: '#A3C9AE', display: 'flex', alignItems: 'center',
            transition: 'background .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          title="Alternar Barra Lateral"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>

        {/* Logo Ω */}
        <div style={{
          width: 28, height: 28,
          background: 'linear-gradient(135deg, #C9A84C 0%, #D9BF73 100%)',
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 14, fontWeight: 600,
          color: '#142218',
          flexShrink: 0,
        }}>
          Ω
        </div>

        {/* Nome */}
        <div>
          <span style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: 14, fontWeight: 600,
            color: '#fff', letterSpacing: '0.2px',
            display: 'block', lineHeight: 1.1,
          }}>
            OLYMPUS
          </span>
          <span style={{
            fontSize: 9, color: '#A3C9AE',
            letterSpacing: '1.5px', textTransform: 'uppercase',
            fontWeight: 500, display: 'block',
          }}>
            StratSight Brasil
          </span>
        </div>
      </div>

      {/* ── Zona central: projeto + etapa + agente ─────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14, minWidth: 0 }}>
        {projetoNome ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#E0EDE5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
              {projetoNome}
            </span>

            {stepInfo && (
              <>
                <span style={{ color: '#2D5C3A', flexShrink: 0 }}>·</span>
                <span style={{ fontSize: 11, color: '#5A9E6F', flexShrink: 0, fontFamily: "'DM Mono', monospace" }}>
                  MSEF · Etapa {currentMsefStep} de 5
                </span>
              </>
            )}

            {activeAgent && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,.06)',
                border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 20, padding: '4px 10px',
                fontSize: 11, color: '#A3C9AE', letterSpacing: '0.3px',
                flexShrink: 0,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#4CAF50', boxShadow: '0 0 6px #4CAF50',
                  animation: 'pulse-dot 2s ease-in-out infinite',
                  flexShrink: 0,
                }} />
                {activeAgent} analisando
              </div>
            )}

            {!activeAgent && mode === 'monitoring' && (
              <span style={{ fontSize: 11, color: '#5A9E6F', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                KRATOS · ACOMPANHAMENTO
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: 12, color: '#5A9E6F', fontStyle: 'italic' }}>
            Strategic Foresight
          </span>
        )}
      </div>

      {/* ── Zona direita: ações + avatar ─────────────────────────── */}
      {!isCliente && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={onGerarRelatorio}
            style={btnBase}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#A3C9AE'; }}
            title="Exportar Relatório Final (PDF)"
          >
            ↑ Exportar
          </button>

          {projetoNome && (
            <button
              onClick={onCopyClientLink}
              style={btnBase}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#A3C9AE'; }}
              title="Copiar link do cliente"
            >
              🔗 Link cliente
            </button>
          )}

          <button
            onClick={onNovaSessao}
            style={{
              background: '#C9A84C',
              border: '1px solid #C9A84C',
              borderRadius: '8px',
              color: '#142218',
              fontSize: 12, fontWeight: 600,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              padding: '5px 12px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              whiteSpace: 'nowrap' as const,
              transition: 'background .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#D9BF73')}
            onMouseLeave={e => (e.currentTarget.style.background = '#C9A84C')}
          >
            + Nova Análise
          </button>

          {/* Avatar */}
          <div style={{ width: 4 }} />
          <div
            title={`${user?.name} (${user?.role})`}
            style={{
              width: 30, height: 30,
              background: '#22492E',
              border: '1.5px solid #3D7A50',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              color: '#A3C9AE', cursor: 'default', flexShrink: 0,
            }}
          >
            {user?.name?.slice(0, 2).toUpperCase() || '?'}
          </div>
        </div>
      )}

      {/* Avatar somente (cliente) */}
      {isCliente && (
        <div style={{ paddingRight: 4 }}>
          <div
            title={`${user?.name} (${user?.role})`}
            style={{
              width: 30, height: 30,
              background: '#22492E', border: '1.5px solid #3D7A50',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#A3C9AE',
            }}
          >
            {user?.name?.slice(0, 2).toUpperCase() || '?'}
          </div>
        </div>
      )}

    </header>
  );
}
