interface ThinkingBlockProps {
  thinking: string;
  open: boolean;
  onToggle: () => void;
}

export function ThinkingBlock({ thinking, open, onToggle }: ThinkingBlockProps) {
  return (
    <div style={{
      marginBottom: 4, marginLeft: 38,
      border: '1px solid #D7C8E8', borderRadius: '12px',
      overflow: 'hidden', maxWidth: '85%',
    }}>
      <button
        onClick={onToggle}
        style={{
          background: '#F3EEF9', border: 'none',
          width: '100%', padding: '7px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, fontWeight: 600, color: '#6A35A8',
          cursor: 'pointer',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          textAlign: 'left' as const,
          transition: 'background .12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#EDE5F7')}
        onMouseLeave={e => (e.currentTarget.style.background = '#F3EEF9')}
      >
        🧠 Raciocínio interno — {open ? '▲ ocultar' : '▼ expandir'}
      </button>
      {open && (
        <div style={{
          background: '#FAF7FD',
          padding: '10px 14px',
          fontSize: 12, color: '#5A3080',
          fontFamily: "'DM Mono', 'Cascadia Code', monospace",
          lineHeight: 1.6,
          borderTop: '1px solid #D7C8E8',
          maxHeight: 200, overflowY: 'auto' as const,
          whiteSpace: 'pre-wrap',
        }}>
          {thinking}
        </div>
      )}
    </div>
  );
}
