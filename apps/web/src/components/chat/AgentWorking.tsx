interface AgentWorkingProps {
  progressAgent: string;
  stepLog: string[];
}

export function AgentWorking({ progressAgent, stepLog }: AgentWorkingProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', animation: 'fade-in .2s ease' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px',
        background: '#ffffff',
        border: '1px solid #D4E2DA',
        borderRadius: '12px',
        fontSize: 12, color: '#3D5A48',
        maxWidth: 340,
        boxShadow: '0 1px 3px rgba(13,22,18,.08)',
        marginLeft: 38,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        {/* Três dots pulsantes */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 5, height: 5,
              background: '#3D7A50', borderRadius: '50%',
              animation: `bounce-dot .8s ease-in-out ${i * 0.12}s infinite`,
            }} />
          ))}
        </div>
        <span>
          {progressAgent ? (
            <>
              <strong style={{ fontWeight: 700, color: '#1B3A2D' }}>{progressAgent}</strong>
              {' '}raciocinando...
            </>
          ) : 'HERMES raciocinando...'}
        </span>
      </div>

      {stepLog.length > 0 && (
        <div style={{ marginLeft: 38, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {stepLog.slice(-5).map((step, i, arr) => (
            <div key={i} style={{
              fontSize: 10,
              fontFamily: "'DM Mono', 'Cascadia Code', monospace",
              color: '#6B8C7A',
              opacity: 0.4 + (i / arr.length) * 0.6,
            }}>
              {step}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
