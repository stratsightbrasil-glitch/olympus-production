import { useState } from 'react';
import { ThinkingBlock } from './ThinkingBlock';
import { fmt } from '../../lib/fmt';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  idx: number;
  agentName: string;
  agentLabel: string;
  agentHex: string;
  thinkingContent?: string;
  thinkingOpen?: boolean;
  onToggleThinking?: () => void;
  isStreaming?: boolean;
  userRole?: string;
  onDelete?: () => void;
  onCopy?: () => void;
  onExportMd?: () => void;
  onExportDocx?: () => void;
  onExportPdf?: () => void;
}

export function MessageBubble({
  role,
  content,
  agentName,
  agentLabel,
  agentHex,
  thinkingContent,
  thinkingOpen,
  onToggleThinking,
  isStreaming,
  userRole,
  onDelete,
  onCopy,
  onExportMd,
  onExportDocx,
  onExportPdf,
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const isUser = role === 'user';
  const agentVar = `var(--agent-${agentName.toLowerCase()})`;
  const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (isUser) {
    return (
      <div className="flex justify-end w-full" style={{ animation: 'fade-in .15s ease' }}>
        <div style={{
          maxWidth: '72%',
          background: 'var(--ink-700)',
          border: '1px solid var(--ink-600)',
          borderRadius: 'var(--r-lg)',
          padding: '10px 14px',
          fontSize: 13.5,
          color: 'var(--text-inv)',
          lineHeight: 1.6,
        }}>
          <div dangerouslySetInnerHTML={{ __html: fmt(content) }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start w-full" style={{ animation: 'fade-in .2s ease' }}>
      {/* Thinking block */}
      {thinkingContent && onToggleThinking && (
        <ThinkingBlock
          thinking={thinkingContent}
          open={!!thinkingOpen}
          onToggle={onToggleThinking}
        />
      )}

      <div
        style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', maxWidth: '85%' }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Avatar */}
        <div style={{
          width: 28, height: 28,
          background: agentHex,
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
          color: '#fff', flexShrink: 0, marginTop: 2,
        }}>
          {agentName.slice(0, 2)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.8px', textTransform: 'uppercase',
              color: agentHex,
            }}>
              {agentName}
            </span>
            <span style={{ fontSize: 11, color: '#6B8C7A' }}>{agentLabel}</span>
            {!isStreaming && (
              <span style={{ fontSize: 10, color: '#6B8C7A', marginLeft: 'auto', fontFamily: "'DM Mono', monospace" }}>
                {now}
              </span>
            )}
          </div>

          {/* Body */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #D4E2DA',
            borderLeft: `3px solid ${agentHex}`,
            borderRadius: '12px',
            padding: '14px 16px',
            fontSize: 13.5, lineHeight: 1.7,
            color: '#0D1612',
            boxShadow: '0 1px 3px rgba(13,22,18,.08)',
            position: 'relative' as const,
          }}>
            <div
              className="msg-markdown"
              dangerouslySetInnerHTML={{ __html: fmt(content) }}
            />
            {isStreaming && (
              <span style={{
                display: 'inline-block', width: 2, height: 14,
                background: '#C9A84C', marginLeft: 2,
                animation: 'blink .8s ease-in-out infinite',
                verticalAlign: 'middle',
              }} />
            )}
          </div>

          {/* Actions — visíveis no hover */}
          {!isStreaming && (
            <div style={{
              display: 'flex', gap: 4, marginTop: 6,
              opacity: showActions ? 1 : 0,
              transition: 'opacity .15s',
              justifyContent: 'space-between', alignItems: 'center',
            }}>
              {userRole !== 'cliente' ? (
                <button
                  onClick={onDelete}
                  style={{ background: 'none', border: '1px solid #D4E2DA', borderRadius: '4px', color: '#6B8C7A', fontSize: 11, fontFamily: "'DM Sans', sans-serif", padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                  onMouseEnter={e => e.currentTarget.style.color = '#C62828'}
                  onMouseLeave={e => e.currentTarget.style.color = '#6B8C7A'}
                >
                  🗑 Excluir
                </button>
              ) : <div />}
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { label: '📋 Copiar', fn: onCopy },
                  { label: '⬇ MD', fn: onExportMd },
                  { label: '⬇ DOCX', fn: onExportDocx },
                  { label: '⬇ PDF', fn: onExportPdf },
                ].map(({ label, fn }) => (
                  <button
                    key={label}
                    onClick={fn}
                    style={{ background: 'none', border: '1px solid #D4E2DA', borderRadius: '4px', color: '#6B8C7A', fontSize: 11, fontFamily: "'DM Sans', sans-serif", padding: '2px 8px', cursor: 'pointer', transition: 'all .12s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F2F7F4'; e.currentTarget.style.color = '#1B3A2D'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6B8C7A'; }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
