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
  const isUser = role === 'user';
  const agentVar = `var(--agent-${agentName.toLowerCase()})`;

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

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', maxWidth: '85%' }}>
        {/* Avatar */}
        <div style={{
          width: 32, height: 32,
          background: agentVar,
          borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700,
          color: '#fff', flexShrink: 0, marginTop: 2,
        }}>
          {agentName.slice(0, 2)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{
              fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.8px', textTransform: 'uppercase',
              color: agentVar,
            }}>
              {agentName}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-ter)' }}>{agentLabel}</span>
          </div>

          {/* Body */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderLeft: `3px solid ${agentHex}`,
            borderRadius: 'var(--r-lg)',
            padding: '14px 16px',
            fontSize: 13.5, lineHeight: 1.7,
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div
              className="msg-markdown"
              dangerouslySetInnerHTML={{ __html: fmt(content) }}
            />
            {isStreaming && (
              <span style={{
                display: 'inline-block', width: 2, height: 14,
                background: 'var(--gold-400)', marginLeft: 2,
                animation: 'blink .8s ease-in-out infinite',
                verticalAlign: 'middle',
              }} />
            )}
          </div>

          {/* Actions */}
          {!isStreaming && (
            <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
              {userRole !== 'cliente' ? (
                <button
                  onClick={onDelete}
                  className="text-[10px] uppercase font-bold tracking-wider text-gray-300 hover:text-red-500 transition-colors flex items-center gap-1"
                >
                  🗑 Excluir
                </button>
              ) : <div />}
              <div className="flex gap-3">
                <button
                  onClick={onCopy}
                  className="text-[10px] uppercase font-bold tracking-wider text-gray-400 hover:text-gray-700 transition-colors"
                >
                  📋 Copiar
                </button>
                <button
                  onClick={onExportMd}
                  className="text-[10px] uppercase font-bold tracking-wider hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--ink-400)' }}
                >
                  ⬇ Markdown
                </button>
                <button
                  onClick={onExportDocx}
                  className="text-[10px] uppercase font-bold tracking-wider hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--ink-400)' }}
                >
                  ⬇ DOCX
                </button>
                <button
                  onClick={onExportPdf}
                  className="text-[10px] uppercase font-bold tracking-wider text-red-600 hover:text-red-900 transition-colors"
                >
                  ⬇ PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
