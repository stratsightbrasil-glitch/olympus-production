import React, { useState, useEffect, useCallback } from 'react';

interface AuditLog {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  createdAt: string;
  metadata: Record<string, any> | null;
}

interface Props {
  onClose: () => void;
  reqHeaders: Record<string, string>;
}

const PAGE_SIZE = 50;

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9000, padding: 20,
};
const panelStyle: React.CSSProperties = {
  background: '#1a2e24', border: '1px solid #2E7D52',
  borderRadius: 10, width: '100%', maxWidth: 920,
  maxHeight: '88vh', display: 'flex', flexDirection: 'column',
  boxShadow: '0 24px 64px rgba(0,0,0,.6)',
};
const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.08)',
};
const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)',
  borderRadius: 5, color: '#e0e0e0', fontSize: 12, padding: '5px 10px',
  fontFamily: "'DM Sans',system-ui,sans-serif",
};
const btnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.16)',
  borderRadius: 5, color: '#A3C9AE', fontSize: 12, padding: '5px 12px',
  cursor: 'pointer', fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 500,
};

export function AuditModal({ onClose, reqHeaders }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean; totalRecords: number; verifiedRecords: number; invalidCount: number; firstInvalidId: string | null;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const buildQuery = useCallback((off: number) => {
    const p = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
    if (filterUser)   p.set('userId',   filterUser);
    if (filterAction) p.set('action',   filterAction);
    if (filterFrom)   p.set('from',     filterFrom);
    if (filterTo)     p.set('to',       filterTo);
    return `/api/v1/audit?${p}`;
  }, [filterUser, filterAction, filterFrom, filterTo]);

  const load = useCallback(async (off = 0) => {
    setLoading(true);
    try {
      const r = await fetch(buildQuery(off), { headers: reqHeaders });
      if (r.ok) {
        const d = await r.json();
        setLogs(d.logs ?? []);
        setTotal(d.total ?? 0);
        setOffset(off);
      }
    } finally { setLoading(false); }
  }, [buildQuery, reqHeaders]);

  useEffect(() => { load(0); }, []);

  const verify = async () => {
    setVerifying(true); setVerifyResult(null);
    try {
      const r = await fetch('/api/v1/audit/verify', { headers: reqHeaders });
      if (r.ok) setVerifyResult(await r.json());
    } finally { setVerifying(false); }
  };

  const exportCsv = () => {
    const header = 'id,userId,userName,action,resourceType,resourceId,ipAddress,createdAt';
    const rows = logs.map(l =>
      [l.id, l.userId ?? '', l.userName ?? '', l.action, l.resourceType ?? '', l.resourceId ?? '', l.ipAddress ?? '', l.createdAt]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panelStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
            <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 700, fontSize: 15, color: '#D9BF73', letterSpacing: '0.5px' }}>
              Logs de Auditoria
            </div>
            <div style={{ fontSize: 11, color: '#6b9e7b', marginTop: 2 }}>
              {total} registros · Hash-chain SHA-256
            </div>
          </div>
          <button onClick={onClose} style={{ ...btnStyle, padding: '4px 10px', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap' as const }}>
          <input style={{ ...inputStyle, width: 140 }} placeholder="userId ou nome" value={filterUser}
            onChange={e => setFilterUser(e.target.value)} />
          <input style={{ ...inputStyle, width: 130 }} placeholder="action (ex: login)" value={filterAction}
            onChange={e => setFilterAction(e.target.value)} />
          <input style={{ ...inputStyle, width: 130 }} type="date" value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)} title="De" />
          <input style={{ ...inputStyle, width: 130 }} type="date" value={filterTo}
            onChange={e => setFilterTo(e.target.value)} title="Até" />
          <button style={{ ...btnStyle, background: '#2E7D52', color: '#fff', border: 'none' }} onClick={() => load(0)}>
            Filtrar
          </button>
          <button style={btnStyle} onClick={exportCsv} title="Exportar página atual como CSV">
            ↓ Exportar CSV
          </button>
          <div style={{ flex: 1 }} />
          <button
            style={{ ...btnStyle, background: verifyResult ? (verifyResult.valid ? 'rgba(76,175,80,.2)' : 'rgba(244,67,54,.2)') : 'rgba(255,255,255,.07)',
              borderColor: verifyResult ? (verifyResult.valid ? '#4CAF50' : '#F44336') : 'rgba(255,255,255,.16)',
              color: verifyResult ? (verifyResult.valid ? '#81C784' : '#EF9A9A') : '#A3C9AE' }}
            onClick={verify} disabled={verifying}
          >
            {verifying ? '⏳ Verificando…' : '🔐 Verificar integridade'}
          </button>
        </div>

        {/* Resultado da verificação */}
        {verifyResult && (
          <div style={{
            padding: '8px 20px',
            background: verifyResult.valid ? 'rgba(76,175,80,.08)' : 'rgba(244,67,54,.1)',
            borderBottom: '1px solid rgba(255,255,255,.06)',
            fontSize: 12, color: verifyResult.valid ? '#81C784' : '#EF9A9A',
            display: 'flex', gap: 16, alignItems: 'center',
          }}>
            <span>{verifyResult.valid ? '✅ Chain íntegra' : '❌ Chain adulterada'}</span>
            <span>{verifyResult.verifiedRecords}/{verifyResult.totalRecords} registros verificados</span>
            {!verifyResult.valid && <span>Primeiro inválido: <code style={{ fontSize: 10 }}>{verifyResult.firstInvalidId}</code></span>}
          </div>
        )}

        {/* Tabela */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b9e7b', fontSize: 13 }}>Carregando…</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b9e7b', fontSize: 13 }}>Nenhum registro encontrado.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,.04)', position: 'sticky', top: 0 }}>
                  {['Data/Hora', 'Usuário', 'Ação', 'Recurso', 'IP', 'Hash'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6b9e7b', fontWeight: 600, whiteSpace: 'nowrap' as const, borderBottom: '1px solid rgba(255,255,255,.08)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => {
                  const meta = log.metadata as Record<string, any> | null;
                  const hash = meta?._hash as string | undefined;
                  return (
                    <tr key={log.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)' }}>
                      <td style={{ padding: '6px 12px', color: '#b0c8b8', whiteSpace: 'nowrap' as const }}>
                        {new Date(log.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false })}
                      </td>
                      <td style={{ padding: '6px 12px', color: '#e0e0e0' }}>{log.userName ?? log.userId?.slice(0, 8) ?? '—'}</td>
                      <td style={{ padding: '6px 12px' }}>
                        <span style={{
                          background: 'rgba(201,168,76,.12)', color: '#D9BF73',
                          borderRadius: 3, padding: '2px 6px', fontSize: 10.5, fontWeight: 600,
                        }}>{log.action}</span>
                      </td>
                      <td style={{ padding: '6px 12px', color: '#b0c8b8' }}>
                        {log.resourceType ? `${log.resourceType}${log.resourceId ? ` · ${log.resourceId.slice(0, 8)}` : ''}` : '—'}
                      </td>
                      <td style={{ padding: '6px 12px', color: '#7a9e87', fontFamily: 'monospace', fontSize: 10.5 }}>{log.ipAddress ?? '—'}</td>
                      <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontSize: 10, color: hash ? '#6b9e7b' : '#555' }}>
                        {hash ? hash.slice(0, 8) + '…' : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,.06)', fontSize: 12, color: '#6b9e7b' }}>
            <button style={btnStyle} onClick={() => load(offset - PAGE_SIZE)} disabled={offset === 0}>← Anterior</button>
            <span>Página {currentPage} de {totalPages}</span>
            <button style={btnStyle} onClick={() => load(offset + PAGE_SIZE)} disabled={currentPage >= totalPages}>Próxima →</button>
            <span style={{ marginLeft: 'auto' }}>{total} registros totais</span>
          </div>
        )}
      </div>
    </div>
  );
}
