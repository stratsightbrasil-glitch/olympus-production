interface InfoBarProps {
  cliente?: string;
  horizonte?: string;
  questaoEstrategica?: string;
  classificacao?: string;
  projetoNome?: string;
}

export function InfoBar({ cliente, horizonte, questaoEstrategica, classificacao, projetoNome }: InfoBarProps) {
  // Não renderiza se não há projeto carregado
  if (!projetoNome) return null;

  const classMap: Record<string, { bg: string; color: string }> = {
    confidencial: { bg: '#7A1E1E', color: '#FFCDD2' },
    secreto:      { bg: '#4A0E6A', color: '#E1BEE7' },
    restrito:     { bg: '#1A3A6A', color: '#BBDEFB' },
    ostensivo:    { bg: '#1B4A2D', color: '#C8E6C9' },
  };
  const cls = classificacao ? classMap[classificacao.toLowerCase()] : null;

  return (
    <div style={{
      height: 30,
      background: 'var(--ink-900)',
      borderBottom: '1px solid rgba(255,255,255,.06)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 0,
      flexShrink: 0,
      overflowX: 'auto',
    }}>
      {/* Campos */}
      {[
        { label: 'CLIENTE',   value: cliente },
        { label: 'HORIZONTE', value: horizonte },
        { label: 'QEC',       value: questaoEstrategica },
      ].map(({ label, value }, i) => value ? (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {i > 0 && <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,.1)', margin: '0 12px' }} />}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,.35)',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
            }}>
              {label}
            </span>
            <span style={{
              fontSize: 11, color: 'rgba(255,255,255,.65)',
              maxWidth: label === 'QEC' ? 320 : 160,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {value}
            </span>
          </div>
        </div>
      ) : null)}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Badge de classificação */}
      {cls && classificacao && (
        <div style={{
          padding: '2px 10px',
          borderRadius: 4,
          background: cls.bg,
          color: cls.color,
          fontSize: 8, fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          fontFamily: 'var(--font-mono)',
          border: `1px solid ${cls.color}40`,
        }}>
          {classificacao}
        </div>
      )}
    </div>
  );
}
