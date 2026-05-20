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

export function InputZone({
  userRole, mode, hasMessages, input, loading, extracting,
  fileError, attachedFiles, acceptedTypes,
  onInputChange, onSend, onQuickSend, onRemoveFile, onFileChange, onGerarRelatorio,
}: InputZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCliente = userRole === 'cliente';
  const busy = loading || extracting;

  return (
    <footer style={{
      padding: '12px 16px',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      boxShadow: '0 -4px 6px -1px rgba(0,0,0,.05)',
      zIndex: 10,
      flexShrink: 0,
    }}>
      {isCliente && (
        <div style={{
          maxWidth: 768, margin: '0 auto',
          textAlign: 'center', fontSize: 11,
          color: 'var(--text-ter)',
          padding: '8px 16px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          background: 'var(--ink-50)',
        }}>
          Modo leitura · Para solicitar análise, entre em contato com o analista responsável.
        </div>
      )}

      {!isCliente && hasMessages && (
        <div style={{ maxWidth: 768, margin: '0 auto 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {mode === 'production' && (
            <>
              <button
                onClick={() => onQuickSend('CONFIRMAR')} disabled={busy}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: 'var(--ink-50)', color: 'var(--ink-700)',
                  border: '1px solid var(--ink-300)',
                  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .5 : 1,
                  transition: 'background var(--t-fast)',
                }}
              >▶ Avançar Fase (CONFIRMAR)</button>
              <button
                onClick={() => onQuickSend('KRATOS')} disabled={busy}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: 'rgba(0,77,64,.08)', color: '#004D40',
                  border: '1px solid rgba(0,77,64,.3)',
                  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .5 : 1,
                  transition: 'background var(--t-fast)',
                }}
              >📡 Modo Monitoramento (KRATOS)</button>
            </>
          )}
          {mode === 'monitoring' && (
            <>
              <button
                onClick={() => onQuickSend('NOVA SESSÃO')} disabled={busy}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: 'rgba(0,77,64,.08)', color: '#004D40',
                  border: '1px solid rgba(0,77,64,.3)',
                  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .5 : 1,
                }}
              >🔄 Nova Coleta (NOVA SESSÃO)</button>
              <button
                onClick={() => onQuickSend('PRODUÇÃO')} disabled={busy}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: 'var(--ink-50)', color: 'var(--ink-700)',
                  border: '1px solid var(--ink-300)',
                  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .5 : 1,
                }}
              >◀ Voltar à Produção</button>
            </>
          )}
          <button
            onClick={onGerarRelatorio} disabled={busy}
            style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: 'var(--ink-50)', color: 'var(--ink-600)',
              border: '1px solid var(--ink-300)',
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .5 : 1,
            }}
          >📑 Gerar Relatório</button>
        </div>
      )}

      {!isCliente && (
        <>
          {attachedFiles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {attachedFiles.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--ink-50)', border: '1px solid var(--ink-300)',
                  borderRadius: 20, padding: '3px 10px', fontSize: 11,
                  color: 'var(--ink-700)',
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

          {extracting && (
            <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 8, fontWeight: 700 }}>
              ⏳ Extraindo dados com OCR/RAG...
            </div>
          )}

          {fileError && (
            <div style={{
              fontSize: 11, color: '#B71C1C', marginBottom: 8,
              background: '#FFEBEE', padding: '6px 10px',
              borderRadius: 'var(--r-md)', border: '1px solid #FFCDD2',
            }}>
              ⚠️ {fileError}
            </div>
          )}

          <div style={{ maxWidth: 768, margin: '0 auto', display: 'flex', gap: 10 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedTypes}
              multiple
              style={{ display: 'none' }}
              onChange={e => {
                onFileChange(e);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              title="Anexar documento"
              style={{
                width: 48, height: 50, borderRadius: 'var(--r-lg)',
                border: `2px solid ${attachedFiles.length > 0 ? 'var(--ink-400)' : 'var(--border)'}`,
                background: attachedFiles.length > 0 ? 'var(--ink-50)' : 'var(--surface)',
                color: attachedFiles.length > 0 ? 'var(--ink-600)' : 'var(--text-ter)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? .5 : 1,
                transition: 'border-color var(--t-fast)',
              }}
            >
              {extracting ? '⏳' : '📎'}
            </button>

            <input
              type="text"
              value={input}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !busy && onSend()}
              disabled={busy}
              placeholder={
                extracting ? 'Analisando arquivos...' :
                attachedFiles.length > 0 ? 'Adicione uma instrução ou envie os documentos...' :
                mode === 'monitoring' ? 'Responda ao KRATOS com atualizações de indicadores...' :
                'Digite sua mensagem para o HERMES...'
              }
              style={{
                flex: 1,
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                padding: '12px 16px',
                fontSize: 13.5,
                background: 'var(--ink-50)',
                color: 'var(--text-pri)',
                outline: 'none',
                fontFamily: 'var(--font-ui)',
              }}
            />

            <button
              onClick={onSend}
              disabled={busy || (!input.trim() && attachedFiles.length === 0)}
              style={{
                background: 'var(--ink-800)',
                color: '#fff',
                padding: '0 20px',
                borderRadius: 'var(--r-lg)',
                fontWeight: 700,
                fontSize: 13,
                border: 'none',
                cursor: busy || (!input.trim() && attachedFiles.length === 0) ? 'not-allowed' : 'pointer',
                opacity: busy || (!input.trim() && attachedFiles.length === 0) ? .5 : 1,
                transition: 'background var(--t-fast)',
                fontFamily: 'var(--font-ui)',
                letterSpacing: '0.04em',
              }}
              onMouseEnter={e => { if (!busy) e.currentTarget.style.background = 'var(--ink-600)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--ink-800)'; }}
            >
              Enviar
            </button>
          </div>
        </>
      )}
    </footer>
  );
}
