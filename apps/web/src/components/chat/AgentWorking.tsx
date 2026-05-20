interface AgentWorkingProps {
  progressAgent: string;
  stepLog: string[];
}

export function AgentWorking({ progressAgent, stepLog }: AgentWorkingProps) {
  return (
    <div className="flex justify-start" style={{ animation: 'fade-in .2s ease' }}>
      <div style={{
        background: 'var(--surface)',
        borderLeft: '4px solid var(--ink-400)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: '16px',
        minWidth: 260,
        maxWidth: 520,
      }}>
        <div className="flex items-center gap-3 italic text-[15px]" style={{ color: 'var(--text-ter)' }}>
          <div className="flex gap-1 shrink-0">
            {[0, 0.2, 0.4].map((delay, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full animate-bounce"
                style={{ background: 'var(--ink-400)', animationDelay: `${delay}s` }}
              />
            ))}
          </div>
          {progressAgent ? (
            <>
              <span className="font-bold not-italic" style={{ color: 'var(--ink-700)' }}>
                {progressAgent}
              </span>
              {' '}raciocinando...
            </>
          ) : (
            'HERMES raciocinando...'
          )}
        </div>

        {stepLog.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
            {stepLog.slice(-5).map((step, i, arr) => (
              <div
                key={i}
                className="text-[11px] truncate"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-ter)',
                  opacity: 0.5 + (i / arr.length) * 0.5,
                }}
              >
                {step}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
