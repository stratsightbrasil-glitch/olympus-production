import React, { useState, useRef, useEffect } from 'react';

interface HitlDecisionCardProps {
  onConfirm: () => void;
  onRedirect: (instruction: string) => void;
}

export function HitlDecisionCard({ onConfirm, onRedirect }: HitlDecisionCardProps) {
  const [showRedirect, setShowRedirect] = useState(false);
  const [redirectText, setRedirectText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showRedirect) textareaRef.current?.focus();
  }, [showRedirect]);

  const handleRedirect = () => {
    if (!redirectText.trim()) return;
    onRedirect(redirectText.trim());
    setRedirectText('');
    setShowRedirect(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleRedirect();
    if (e.key === 'Escape') setShowRedirect(false);
  };

  const btnBase: React.CSSProperties = {
    padding: '7px 16px',
    borderRadius: 6,
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: "'DM Sans',system-ui,sans-serif",
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all .15s',
    border: 'none',
  };

  return (
    <div
      role="alertdialog"
      aria-label="Aguardando confirmação para avançar à próxima fase"
      style={{
        borderTop: '2px solid var(--status-waiting-border, rgba(184,145,58,.28))',
        background: 'var(--status-waiting-bg, rgba(184,145,58,.06))',
        padding: '10px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          display: 'inline-block', width: 7, height: 7,
          borderRadius: '50%', flexShrink: 0,
          background: 'var(--status-waiting)',
          animation: 'pulse-dot 1.5s ease-in-out infinite',
        }} />
        <span style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: 'var(--status-waiting)',
          letterSpacing: '0.04em',
        }}>
          AGUARDANDO CONFIRMAÇÃO — MODO SUPERVISIONADO
        </span>
      </div>

      {!showRedirect ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          <button
            onClick={onConfirm}
            style={{
              ...btnBase,
              background: '#1B3A2D',
              color: '#fff',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#22492E')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1B3A2D')}
            aria-label="Confirmar e avançar para a próxima fase"
          >
            ✓ Confirmar e Avançar
          </button>
          <button
            onClick={() => setShowRedirect(true)}
            style={{
              ...btnBase,
              background: 'none',
              border: '1px solid #D4E2DA',
              color: '#3D5A48',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F2F7F4'; e.currentTarget.style.color = '#1B3A2D'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#3D5A48'; }}
            aria-label="Redirecionar — dar instrução alternativa para esta fase"
          >
            ↩ Redirecionar
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            ref={textareaRef}
            value={redirectText}
            onChange={e => setRedirectText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Instrução para redirecionar esta fase… (Ctrl+Enter para enviar, Esc para cancelar)"
            rows={2}
            style={{
              width: '100%',
              resize: 'vertical',
              border: '1px solid #B0C9BC',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 13,
              fontFamily: "'DM Sans',system-ui,sans-serif",
              color: '#0D1612',
              background: '#fff',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            aria-label="Instrução de redirecionamento da fase"
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleRedirect}
              disabled={!redirectText.trim()}
              style={{
                ...btnBase,
                background: redirectText.trim() ? '#1B3A2D' : '#D4E2DA',
                color: redirectText.trim() ? '#fff' : '#6B8C7A',
                cursor: redirectText.trim() ? 'pointer' : 'default',
              }}
            >
              Enviar instrução
            </button>
            <button
              onClick={() => { setShowRedirect(false); setRedirectText(''); }}
              style={{
                ...btnBase,
                background: 'none',
                border: '1px solid #D4E2DA',
                color: '#6B8C7A',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#0D1612')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6B8C7A')}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
