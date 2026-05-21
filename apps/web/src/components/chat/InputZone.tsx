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

// Chips contextuais por modo — estilos alinhados ao design system
const CHIPS_PRODUCTION = [
  { label: '✓ Confirmar',       cmd: 'CONFIRMAR',      bg: '#F5EDD8', color: '#B8913A', border: '#D9BF73', fontWeight: 600 },
  { label: '🔍 Sinais',         cmd: 'SINAIS',         bg: '#F2F7F4', color: '#3D5A48', border: '#D4E2DA', fontWeight: 500 },
  { label: '🔎 Aprofundar',     cmd: 'APROFUNDAR',     bg: '#F2F7F4', color: '#3D5A48', border: '#D4E2DA', fontWeight: 500 },
  { label: '🔄 Reiniciar fase', cmd: 'REINICIAR FASE', bg: '#FFF5F5', color: '#C62828', border: '#FFCDD2', fontWeight: 500 },
];

const CHIPS_MONITORING = [
  { label: '🔄 Nova Coleta',    cmd: 'NOVA SESSÃO', bg: '#F2F7F4', color: '#2E7D52', border: '#D4E2DA', fontWeight: 500 },
  { label: '◀ Produção',        cmd: 'PRODUÇÃO',    bg: '#F2F7F4', color: '#3D5A48', border: '#D4E2DA', fontWeight: 500 },
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
                padding: '3px 10px', borderRadius: 20,
                fontSize: 11, fontWeight: chip.fontWeight || 500,
                background: chip.bg, color: chip.color,
                border: `1px solid ${chip.border}`,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? .5 : 1,
                transition: 'all .12s',
                whiteSpace: 'nowrap' as const,
                fontFamily: "'DM Sans', system-ui, sans-serif",
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
              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
              background: '#F2F7F4', color: '#3D5A48',
              border: '1px solid #D4E2DA',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? .5 : 1,
              transition: 'all .12s',
              whiteSpace: 'nowrap' as const,
              fontFamily: "'DM Sans', system-ui, sans-serif",
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
                border: '1.5px solid #B0C9BC',
                borderRadius: '16px',
                padding: '10px 14px',
                fontSize: 13.5,
                background: '#F2F7F4',
                color: '#0D1612',
                outline: 'none',
                fontFamily: "'DM Sans', system-ui, sans-serif",
                transition: 'border-color .15s, box-shadow .15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#3D7A50'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(61,122,80,.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#B0C9BC'; e.currentTarget.style.boxShadow = 'none'; }}
            />

            {/* Send button — arrow icon */}
            <button
              onClick={onSend}
              disabled={busy || (!input.trim() && attachedFiles.length === 0)}
              style={{
                width: 36, height: 36, borderRadius: '12px', flexShrink: 0,
                background: busy || (!input.trim() && attachedFiles.length === 0) ? '#D4E2DA' : '#1B3A2D',
                color: '#fff', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: busy || (!input.trim() && attachedFiles.length === 0) ? 'not-allowed' : 'pointer',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { if (!busy && (input.trim() || attachedFiles.length > 0)) e.currentTarget.style.background = '#22492E'; }}
              onMouseLeave={e => { if (!busy && (input.trim() || attachedFiles.length > 0)) e.currentTarget.style.background = '#1B3A2D'; }}
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
