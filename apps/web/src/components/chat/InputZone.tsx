import React, { useRef } from 'react';

interface InputZoneProps {
  userRole: string | undefined;
  mode: string;
  hasMessages: boolean;
  input: string;
  loading: boolean;
  extracting: boolean;
  fileError: string;
  attachedFiles: { name: string }[];
  acceptedTypes: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onQuickSend: (cmd: string) => void;
  onRemoveFile: (i: number) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGerarRelatorio: () => void;
}

// Chips contextuais por modo
const CHIPS_PRODUCTION = [
  { label: '✓ Confirmar',       cmd: 'CONFIRMAR',      bg: 'rgba(46,125,82,.12)',  color: '#2E7D52',  border: 'rgba(46,125,82,.3)'  },
  { label: '🔍 Sinais',         cmd: 'SINAIS',         bg: 'rgba(90,45,130,.10)', color: '#7C43BD',  border: 'rgba(90,45,130,.25)' },
  { label: '🔎 Aprofundar',     cmd: 'APROFUNDAR',     bg: 'rgba(0,0,0,.05)',     color: '#555',     border: 'rgba(0,0,0,.12)'     },
  { label: '🔄 Reiniciar fase', cmd: 'REINICIAR FASE', bg: 'rgba(183,28,28,.08)', color: '#C62828',  border: 'rgba(183,28,28,.2)'  },
];

const CHIPS_MONITORING = [
  { label: '🔄 Nova Coleta',    cmd: 'NOVA SESSÃO', bg: 'rgba(0,77,64,.12)', color: '#004D40', border: 'rgba(0,77,64,.3)'   },
  { label: '◀ Produção',        cmd: 'PRODUÇÃO',    bg: 'rgba(0,0,0,.05)',   color: '#555',    border: 'rgba(0,0,0,.12)'   },
];

export function InputZone({
  userRole, mode, hasMessages, input, loading, extracting,
  fileError, attachedFiles, acceptedTypes,
  onInputChange, onSend, onQuickSend, onRemoveFile, onFileChange, onGerarRelatorio,
}: InputZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCliente = userRole === 'cliente';
  const busy = loading || extracting;

  const chips = mode === 'monitoring' ? CHIPS_MONITORING : CHIPS_PRODUCTION;

  return (
    <footer style={{
      padding: '10px 16px 14px',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      boxShadow: '0 -2px 8px rgba(0,0,0,.04)',
      zIndex: 10,
      flexShrink: 0,
    }}>

      {/* Modo leitura — cliente */}
      {isCliente && (
        <div style={{
          maxWidth: 720, margin: '0 auto',
          textAlign: 'center', fontSize: 11, color: 'var(--text-ter)',
          padding: '8px 16px', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', background: 'var(--ink-50)',
        }}>
          Modo leitura · Para solicitar análise, entre em contato com o analista responsável.
        </div>
      )}

      {/* Chips de ação contextual */}
      {!isCliente && hasMessages && (
        <div style={{ maxWidth: 720, margin: '0 auto 8px', display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          {chips.map(chip => (
            <button
              key={chip.cmd}
              onClick={() => onQuickSend(chip.cmd)}
              disabled={busy}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                background: chip.bg, color: chip.color,
                border: `1px solid ${chip.border}`,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? .5 : 1,
                transition: 'opacity var(--t-fast)',
                whiteSpace: 'nowrap',
              }}
            >
              {chip.label}
            </button>
          ))}
          {/* Separador */}
          <div style={{ flex: 1 }} />
          {/* Exportar — sempre visível como chip */}
          <button
            onClick={onGerarRelatorio}
            disabled={busy}
            style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 10, fontWeight: 700,
              background: 'rgba(184,145,58,.1)', color: 'var(--gold-500)',
              border: '1px solid rgba(184,145,58,.25)',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? .5 : 1,
              transition: 'opacity var(--t-fast)',
              whiteSpace: 'nowrap',
            }}
          >
            ↓ Exportar
          </button>
        </div>
      )}

      {/* Input area */}
      {!isCliente && (
        <>
          {/* Arquivos anexados */}
          {attachedFiles.length > 0 && (
            <div style={{ maxWidth: 720, margin: '0 auto 8px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {attachedFiles.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'var(--ink-50)', border: '1px solid var(--ink-300)',
                  borderRadius: 20, padding: '3px 10px', fontSize: 11, color: 'var(--ink-700)',
                }}>
                  <span>📎 {f.name}</span>
                  <button
                    onClick={() => onRemoveFile(i)}
                    style={{ color: 'var(--ink-500)', fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {/* Status de extração e erros */}
          {extracting && (
            <div style={{ maxWidth: 720, margin: '0 auto 6px', fontSize: 11, color: 'var(--ink-500)', fontWeight: 700 }}>
              ⏳ Extraindo dados com OCR/RAG...
            </div>
          )}
          {fileError && (
            <div style={{
              maxWidth: 720, margin: '0 auto 6px',
              fontSize: 11, color: '#B71C1C',
              background: '#FFEBEE', padding: '5px 10px',
              borderRadius: 'var(--r-md)', border: '1px solid #FFCDD2',
            }}>
              ⚠️ {fileError}
            </div>
          )}

          {/* Row: attach + textarea + send */}
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'flex-end' }}>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedTypes}
              multiple
              style={{ display: 'none' }}
              onChange={e => { onFileChange(e); if (fileInputRef.current) fileInputRef.current.value = ''; }}
            />

            {/* Attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              title="Anexar documento"
              style={{
                width: 44, height: 44, borderRadius: 'var(--r-lg)', flexShrink: 0,
                border: `1.5px solid ${attachedFiles.length > 0 ? 'var(--ink-400)' : 'var(--border)'}`,
                background: attachedFiles.length > 0 ? 'var(--ink-50)' : 'var(--surface)',
                color: attachedFiles.length > 0 ? 'var(--ink-600)' : 'var(--text-ter)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? .5 : 1, transition: 'border-color var(--t-fast)',
              }}
            >
              {extracting ? '⏳' : '📎'}
            </button>

            {/* Text input */}
            <input
              type="text"
              value={input}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !busy && onSend()}
              disabled={busy}
              placeholder={
                extracting              ? 'Analisando arquivos...' :
                attachedFiles.length > 0 ? 'Adicione uma instrução ou envie os documentos...' :
                mode === 'monitoring'   ? 'Responda ao KRATOS com atualizações...' :
                                          'Digite sua mensagem para o HERMES...'
              }
              style={{
                flex: 1, minWidth: 0,
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                padding: '11px 14px',
                fontSize: 13.5,
                background: 'var(--ink-50)',
                color: 'var(--text-pri)',
                outline: 'none',
                fontFamily: 'var(--font-ui)',
                transition: 'border-color var(--t-fast)',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--ink-400)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />

            {/* Send button — arrow icon */}
            <button
              onClick={onSend}
              disabled={busy || (!input.trim() && attachedFiles.length === 0)}
              style={{
                width: 44, height: 44, borderRadius: 'var(--r-lg)', flexShrink: 0,
                background: 'var(--ink-700)',
                color: '#fff', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: busy || (!input.trim() && attachedFiles.length === 0) ? 'not-allowed' : 'pointer',
                opacity: busy || (!input.trim() && attachedFiles.length === 0) ? .45 : 1,
                transition: 'background var(--t-fast), opacity var(--t-fast)',
              }}
              onMouseEnter={e => { if (!busy) e.currentTarget.style.background = 'var(--ink-500)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--ink-700)'; }}
              title="Enviar (Enter)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </>
      )}
    </footer>
  );
}
