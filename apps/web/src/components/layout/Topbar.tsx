const MSEF_STEPS = [
  { num: 1, agent: 'SCOPUS',    label: 'Escopo' },
  { num: 2, agent: 'KLIO',      label: 'Drivers + Sinais' },
  { num: 3, agent: 'PYTHIA',    label: 'Incertezas · Eixos' },
  { num: 4, agent: 'MNEMOSYNE', label: 'Narrativas' },
  { num: 5, agent: 'THEMIS',    label: 'Implicações' },
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
  const isMSEF = true; // could gate on metodologia prop later
  const stepInfo = currentMsefStep >= 1 && currentMsefStep <= 5 ? MSEF_STEPS[currentMsefStep - 1] : null;
  const isCliente = user?.role === 'cliente';

  return (
    <header style={{
      height: 'var(--topbar-h)',
      background: 'var(--ink-800)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 8,
      boxShadow: 'var(--shadow-md)',
      zIndex: 10,
      flexShrink: 0,
    }}>

      {/* ── Zona esquerda: toggle + logo ──────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          onClick={onToggleSidebar}
          style={{
            background: 'transparent', border: 'none',
            padding: '5px', borderRadius: 'var(--r-md)', cursor: 'pointer',
            color: 'var(--text-inv)', display: 'flex', alignItems: 'center',
            transition: 'background var(--t-fast)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.1)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          title="Alternar Barra Lateral"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>

        <div style={{
          fontFamily: 'var(--font-ui)', fontWeight: 700,
          fontSize: 13, letterSpacing: '0.12em',
          color: 'var(--ink-200)',
        }}>
          Ω
          <span style={{ fontWeight: 400, color: 'var(--text-ter)', marginLeft: 5, fontSize: 11, letterSpacing: '0.06em' }}>
            OLYMPUS
          </span>
        </div>

        {/* Divisor */}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.12)' }} />
      </div>

      {/* ── Zona central: projeto + etapa + agente ─────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minWidth: 0 }}>
        {projetoNome ? (
          <>
            {/* Nome do projeto */}
            <div style={{
              fontFamily: 'var(--font-ui)', fontWeight: 700,
              fontSize: 13, color: '#fff',
              maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {projetoNome}
            </div>

            {/* MSEF badge */}
            {isMSEF && stepInfo && (
              <>
                <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,.15)', flexShrink: 0 }} />
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(255,255,255,.08)',
                  border: '1px solid rgba(255,255,255,.1)',
                  borderRadius: 20, padding: '2px 10px',
                  fontSize: 10, color: 'var(--ink-200)',
                  fontFamily: 'var(--font-mono)', flexShrink: 0,
                }}>
                  MSEF · Etapa {currentMsefStep} de 5
                </div>
              </>
            )}

            {/* Agente ativo */}
            {activeAgent && (
              <>
                <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,.15)', flexShrink: 0 }} />
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 11, color: 'var(--ink-200)',
                  fontFamily: 'var(--font-ui)', flexShrink: 0,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#4CAF50', boxShadow: '0 0 6px #4CAF50',
                    animation: 'pulse-dot 2s ease-in-out infinite',
                  }} />
                  {activeAgent} analisando
                </div>
              </>
            )}

            {/* Modo badge (quando não há agente ativo) */}
            {!activeAgent && mode === 'monitoring' && (
              <>
                <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,.15)', flexShrink: 0 }} />
                <div style={{
                  fontSize: 10, fontWeight: 700,
                  padding: '2px 10px', borderRadius: 20,
                  background: 'rgba(0,77,64,.6)', color: '#80CBC4',
                  border: '1px solid rgba(128,203,196,.2)',
                  fontFamily: 'var(--font-mono)', flexShrink: 0,
                }}>
                  KRATOS · ACOMPANHAMENTO
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: 12,
            color: 'var(--text-ter)', fontStyle: 'italic',
          }}>
            Strategic Foresight · StratSight Brasil
          </div>
        )}
      </div>

      {/* ── Zona direita: ações + avatar ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

        {!isCliente && (
          <>
            {/* Exportar */}
            <button
              onClick={onGerarRelatorio}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 20,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,.15)',
                color: 'rgba(255,255,255,.7)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                transition: 'all var(--t-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.7)'; }}
              title="Exportar Relatório HERMES"
            >
              ↑ Exportar
            </button>

            {/* Link cliente */}
            {projetoNome && (
              <button
                onClick={onCopyClientLink}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 20,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,.15)',
                  color: 'rgba(255,255,255,.7)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  transition: 'all var(--t-fast)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.7)'; }}
                title="Copiar link do cliente"
              >
                🔗 Link cliente
              </button>
            )}

            {/* Nova Análise — destaque dourado */}
            <button
              onClick={onNovaSessao}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 14px', borderRadius: 20,
                background: 'var(--gold-500)',
                border: '1px solid var(--gold-400)',
                color: '#0D1612',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                transition: 'all var(--t-fast)',
                letterSpacing: '0.02em',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--gold-400)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--gold-500)')}
            >
              + Nova Análise
            </button>
          </>
        )}

        {/* Avatar */}
        <div
          title={`${user?.name} (${user?.role})`}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--ink-500)',
            border: '2px solid rgba(255,255,255,.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#fff', fontWeight: 700,
            cursor: 'default', flexShrink: 0,
          }}
        >
          {user?.name?.slice(0, 2).toUpperCase() || '?'}
        </div>
      </div>

    </header>
  );
}
