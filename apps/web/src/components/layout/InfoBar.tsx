interface InfoBarProps {
  cliente?: string;
  horizonte?: string;
  questaoEstrategica?: string;
  classificacao?: string;
  projetoNome?: string;
}

const CLASSIF_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  confidencial: { bg: '#FFF3E0', color: '#E65100', border: '#FFB74D' },
  restrito:     { bg: '#FFEBEE', color: '#C62828', border: '#EF9A9A' },
  secreto:      { bg: '#F3E5F5', color: '#6A1B9A', border: '#CE93D8' },
  ostensivo:    { bg: '#E8F5E9', color: '#2E7D52', border: '#A5D6A7' },
  público:      { bg: '#E8F5E9', color: '#2E7D52', border: '#A5D6A7' },
};

export function InfoBar({ cliente, horizonte, questaoEstrategica, classificacao, projetoNome }: InfoBarProps) {
  if (!projetoNome) return null;

  const cls = classificacao ? CLASSIF_COLORS[classificacao.toLowerCase()] : null;

  const fields = [
    { label: 'CLIENTE',   value: cliente },
    { label: 'HORIZONTE', value: horizonte },
    { label: 'QEC',       value: questaoEstrategica },
  ].filter(f => f.value);

  if (fields.length === 0 && !cls) return null;

  return (
    <div style={{
      background: '#ffffff',
      borderBottom: '1px solid #D4E2DA',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      height: 34,
      flexShrink: 0,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      overflowX: 'auto',
    }}>
      {fields.map(({ label, value }, i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {i > 0 && (
            <div style={{ width: 1, height: 16, background: '#D4E2DA', margin: '0 14px' }} />
          )}
          <span style={{
            fontSize: 10, fontWeight: 600,
            letterSpacing: '0.8px', textTransform: 'uppercase',
            color: '#6B8C7A', marginRight: 6,
          }}>
            {label}
          </span>
          <span style={{
            fontSize: 12, color: '#3D5A48', fontWeight: 500,
            maxWidth: label === 'QEC' ? 340 : 180,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {value}
          </span>
        </div>
      ))}

      <div style={{ flex: 1 }} />

      {cls && classificacao && (
        <div style={{
          fontSize: 10, fontWeight: 700,
          letterSpacing: '1px', textTransform: 'uppercase',
          padding: '2px 7px', borderRadius: 3,
          background: cls.bg,
          color: cls.color,
          border: `1px solid ${cls.border}`,
          fontFamily: "'DM Mono', 'Cascadia Code', monospace",
          flexShrink: 0,
        }}>
          {classificacao}
        </div>
      )}
    </div>
  );
}
