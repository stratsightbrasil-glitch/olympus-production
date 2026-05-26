import React, { useState, useEffect } from 'react';

interface Props {
  onClose: () => void;
  reqHeaders: Record<string, string>;
}

export function BackupModal({ onClose, reqHeaders }: Props) {
  const [backups, setBackups] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState('');

  const loadBackups = async () => {
    try {
      const res = await fetch('/api/v1/backup/list', { headers: reqHeaders });
      if (res.ok) setBackups((await res.json()).backups || []);
    } catch (_) {}
  };

  useEffect(() => { loadBackups(); }, []);

  const generateBackup = async () => {
    setGenerating(true); setMsg('');
    try {
      const res = await fetch('/api/v1/backup/generate', { method: 'POST', headers: reqHeaders });
      const data = await res.json();
      if (res.ok) { setMsg(`✅ ${data.message}`); loadBackups(); }
      else setMsg(`❌ ${data.error || 'Erro ao gerar backup'}`);
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    setGenerating(false);
  };

  const downloadBackup = async (filename: string) => {
    try {
      const res = await fetch(`/api/v1/backup/download/${encodeURIComponent(filename)}`, { headers: reqHeaders });
      if (!res.ok) { alert('Erro ao baixar o backup.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { alert('Erro ao baixar: ' + e.message); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-bold text-stratsight-dark text-xl">💾 Backup do Banco de Dados</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 font-bold text-xl">✕</button>
        </div>
        <div className="mb-4 p-3 bg-stratsight-light rounded-xl border border-stratsight-medium/20 text-xs text-stratsight-dark leading-relaxed">
          Backups são gerados via <code className="bg-white px-1 rounded">pg_dump</code> e armazenados no volume <code className="bg-white px-1 rounded">/backups/</code> do container da API. Copie os arquivos para fora do container após gerar.
        </div>
        <button onClick={generateBackup} disabled={generating} className="mb-3 px-5 py-3 bg-stratsight-dark text-white font-bold rounded-xl hover:bg-stratsight-medium transition-colors disabled:opacity-50 text-sm">
          {generating ? '⏳ Gerando backup...' : '💾 Gerar Backup Agora'}
        </button>
        {msg && <div className={`mb-3 text-sm font-medium px-3 py-2 rounded-lg ${msg.startsWith('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{msg}</div>}
        <div className="overflow-y-auto flex-1 border rounded-xl">
          {backups.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">Nenhum backup encontrado.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-stratsight-dark text-white sticky top-0">
                <tr><th className="p-3">Arquivo</th><th className="p-3">Tamanho</th><th className="p-3">Data</th><th className="p-3"></th></tr>
              </thead>
              <tbody>
                {backups.map((b: any, i: number) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-mono text-xs text-gray-700">{b.name}</td>
                    <td className="p-3 text-gray-600">{b.size}</td>
                    <td className="p-3 text-gray-500">{new Date(b.createdAt).toLocaleString('pt-BR')}</td>
                    <td className="p-3"><button onClick={() => downloadBackup(b.name)} className="text-xs font-bold text-stratsight-medium hover:text-stratsight-dark transition-colors">⬇ Baixar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <button onClick={onClose} className="mt-4 py-2 text-stratsight-medium border-2 border-gray-200 font-bold rounded-xl hover:bg-gray-50 transition-colors text-sm">Fechar</button>
      </div>
    </div>
  );
}
