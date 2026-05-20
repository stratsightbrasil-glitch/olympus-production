import React, { useState, useRef, useEffect } from 'react';
import { AGENTS } from './constants';

function UsersModal({ onClose, reqHeaders }: { onClose: () => void, reqHeaders: any }) {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'analista' });
  const [methodologiesList, setMethodologiesList] = useState<any[]>([]);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/v1/users', { headers: reqHeaders });
      if (res.ok) setUsersList(await res.json());
      else console.error('Erro ao carregar usuários:', await res.text());
    } catch (e) { console.error(e); }
  };

  const loadMethodologies = async () => {
    try {
      const res = await fetch('/api/v1/engine/methodologies', { headers: reqHeaders });
      if (res.ok) setMethodologiesList(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadUsers(); loadMethodologies(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/users', { method: 'POST', headers: reqHeaders, body: JSON.stringify(form) });
      if (res.ok) { setForm({ name: '', email: '', password: '', role: 'analista' }); loadUsers(); }
      else alert((await res.json()).error || 'Erro ao criar usuário');
    } catch (err) { alert('Erro na requisição'); }
  };

  const handleUpdateRole = async (id: string, newRole: string) => {
    try {
      await fetch(`/api/v1/users/${id}`, { method: 'PATCH', headers: reqHeaders, body: JSON.stringify({ role: newRole }) });
      loadUsers();
    } catch (err) { alert('Erro ao atualizar'); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário do sistema?')) return;
    try {
      const res = await fetch(`/api/v1/users/${id}`, { method: 'DELETE', headers: reqHeaders });
      if (res.ok) loadUsers(); else alert((await res.json()).error || 'Erro ao excluir');
    } catch (err) { alert('Erro ao excluir'); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-8 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-bold text-stratsight-dark text-xl">Gestão de Usuários</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 font-bold text-xl">✕</button>
        </div>
        <form onSubmit={handleCreate} autoComplete="off" className="flex gap-2 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
          <input type="text" autoComplete="new-password" placeholder="Nome" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="flex-1 px-3 py-2 rounded-lg border outline-none focus:border-stratsight-medium" />
          <input type="email" autoComplete="new-password" placeholder="E-mail" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="flex-1 px-3 py-2 rounded-lg border outline-none focus:border-stratsight-medium" />
          <input type="password" autoComplete="new-password" placeholder="Senha" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="flex-1 px-3 py-2 rounded-lg border outline-none focus:border-stratsight-medium" />
          <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="px-3 py-2 rounded-lg border outline-none focus:border-stratsight-medium bg-white">
            <option value="admin">Admin</option><option value="analista">Analista</option><option value="cliente">Cliente</option>
          </select>
          <button type="submit" className="bg-stratsight-dark text-white px-4 py-2 rounded-lg font-bold hover:bg-stratsight-medium">Criar</button>
        </form>
        <div className="overflow-y-auto flex-1 border rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-stratsight-dark text-white sticky top-0"><tr><th className="p-3">Nome</th><th className="p-3">E-mail</th><th className="p-3">2FA</th><th className="p-3">Perfil</th><th className="p-3 text-right">Ações</th></tr></thead>
            <tbody>{usersList.map(u => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{u.name}</td><td className="p-3 text-gray-600">{u.email}</td><td className="p-3">{u.isTwoFactorEnabled ? '✅ Ativo' : '❌ Não'}</td>
                <td className="p-3"><select value={u.role} onChange={e => handleUpdateRole(u.id, e.target.value)} className="bg-transparent font-bold outline-none cursor-pointer border-b border-dashed border-gray-400"><option value="admin">Admin</option><option value="analista">Analista</option><option value="cliente">Cliente</option></select></td>
                <td className="p-3 text-right"><button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-700 font-bold px-2 py-1 bg-red-50 rounded">Excluir</button></td>
              </tr>))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function fmt(text: string) {
  if (!text) return '';
  const lines = text.split('\n');
  const out: string[] = [];
  let inCode = false, inTable = false, tableRows: string[] = [];

  const flushTable = () => {
    if (!tableRows.length) return;
    let html = '<div class="overflow-x-auto my-4"><table class="min-w-full border-collapse border border-gray-200 text-sm">';
    tableRows.forEach((row, i) => {
      const isHeader = i === 0;
      if (/^[\s|:-]+$/.test(row)) return;
      const cells = row.split('|').filter((_, ci, arr) => ci > 0 && ci < arr.length - 1);
      html += '<tr>';
      cells.forEach(c => {
        const tag = isHeader ? 'th' : 'td';
        const style = isHeader
          ? 'bg-stratsight-dark text-white px-4 py-2 text-left font-bold border border-[#2D5A3D]'
          : 'px-4 py-2 border border-gray-200 align-top';
        html += `<${tag} class="${style}">${inlineFmt(c.trim())}</${tag}>`;
      });
      html += '</tr>';
    });
    html += '</table></div>';
    out.push(html);
    tableRows = [];
    inTable = false;
  };

  const inlineFmt = (t: string) => t
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-black/5 px-1.5 py-0.5 rounded text-[0.88em]">$1</code>');

  lines.forEach(line => {
    if (line.startsWith('```')) { inCode = !inCode; if (!inCode) out.push('</pre>'); else out.push('<pre class="bg-[#1a1a1a] text-[#e8e8e8] p-4 rounded-lg overflow-x-auto text-xs my-2">'); return; }
    if (inCode) { out.push(line.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '\n'); return; }
    if (line.includes('|') && line.trim().startsWith('|')) {
      if (!inTable) inTable = true;
      tableRows.push(line);
      return;
    }
    if (inTable) flushTable();
    if (line.startsWith('#### ')) { out.push(`<h4 class="text-stratsight-dark mt-3 mb-1.5 text-sm font-bold">${inlineFmt(line.slice(5))}</h4>`); return; }
    if (line.startsWith('### '))  { out.push(`<h3 class="text-stratsight-dark mt-3.5 mb-1.5 text-[15px] font-bold">${inlineFmt(line.slice(4))}</h3>`); return; }
    if (line.startsWith('## '))   { out.push(`<h2 class="text-stratsight-dark mt-4 mb-2 text-base font-bold border-b border-stratsight-gold pb-1">${inlineFmt(line.slice(3))}</h2>`); return; }
    if (line.startsWith('# '))    { out.push(`<h1 class="text-stratsight-dark mt-4.5 mb-2.5 text-lg font-bold">${inlineFmt(line.slice(2))}</h1>`); return; }
    if (/^[-─═*]{3,}$/.test(line.trim())) { out.push('<hr class="border-t border-stratsight-gold my-3"/>'); return; }
    if (line.match(/^(\s*[-*•]\s+)/)) {
      const isIndented = (line.match(/^(\s*)/)?.[1]?.length || 0) > 0;
      const txt = line.replace(/^\s*[-*•]\s+/, '');
      out.push(`<div class="flex gap-2 my-1 ${isIndented ? 'ml-5' : ''}"><span class="text-stratsight-gold shrink-0">•</span><span>${inlineFmt(txt)}</span></div>`);
      return;
    }
    if (line.match(/^\s*\d+\.\s+/)) {
      const num = line.match(/^\s*(\d+)\./)?.[1] || '';
      const txt = line.replace(/^\s*\d+\.\s+/, '');
      out.push(`<div class="flex gap-2 my-1"><span class="text-stratsight-gold font-bold shrink-0 min-w-[20px]">${num}.</span><span>${inlineFmt(txt)}</span></div>`);
      return;
    }
    if (line.trim() === '') { out.push('<div class="h-2"></div>'); return; }
    out.push(`<p class="my-1 leading-relaxed">${inlineFmt(line)}</p>`);
  });
  if (inTable) flushTable();
  return out.join('');
}

function BackupModal({ onClose, reqHeaders }: { onClose: () => void, reqHeaders: any }) {
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

function App() {
  // ── Mensagens e estado da conversa ──────────────────────────────────────────
  const [messages, setMessages] = useState<{role: string, content: string, id?: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressAgent, setProgressAgent] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [stepLog, setStepLog] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Projeto / Sessão ─────────────────────────────────────────────────────────
  const [projeto, setProjeto] = useState({
    nome: '', metodologia: 'MSEF', status: 'Em produção', kratosCron: '0 6 * * *',
    horizonte: '', elaborador: '', cliente: '', questaoEstrategica: '', mudancaIdentificada: ''
  });
  const [vizMode, setVizMode] = useState('etapa');
  const [mode, setMode] = useState('production');
  const [sessionId, setSessionId] = useState(() => `sess_${Date.now()}`);
  const [sessoes, setSessoes] = useState<any[]>([]);
  const [showSessoes, setShowSessoes] = useState(false);

  // ── Modais ───────────────────────────────────────────────────────────────────
  const [showNovaSessaoModal, setShowNovaSessaoModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);

  // ── Formulário de Nova Sessão ────────────────────────────────────────────────
  const [scopeForm, setScopeForm] = useState({
    tema: '', horizonte: '', elaborador: '', cliente: '',
    questaoEstrategica: '', mudancaIdentificada: ''
  });
  const [scopeFiles, setScopeFiles] = useState<{name: string, text: string}[]>([]);
  const [scopeExtracting, setScopeExtracting] = useState(false);
  const scopeFileInputRef = useRef<HTMLInputElement>(null);

  // ── Extended Thinking ────────────────────────────────────────────────────────
  const [thinkingBlocks, setThinkingBlocks] = useState<Record<number, string>>({});
  const [thinkingOpen, setThinkingOpen] = useState<Record<number, boolean>>({});

  // ── Anexos (chat) ────────────────────────────────────────────────────────────
  const [attachedFiles, setAttachedFiles] = useState<{name: string, text: string, isImage?: boolean, dataUrl?: string}[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ACCEPTED_TYPES = '.txt,.md,.csv,.json,.rtf,.pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.webp';

  // ── Export ───────────────────────────────────────────────────────────────────
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // ── Sidebar filtro ───────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState({ producao: true, ativos: true, inativos: false });
  const [sessionSearch, setSessionSearch] = useState('');
  const [indicadores, setIndicadores] = useState<any[]>([]);
  const [weakSignals, setWeakSignals] = useState<any[]>([]);
  const [signalStats, setSignalStats] = useState<any>(null);
  const [analyticReview, setAnalyticReview] = useState<any>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [methodologies, setMethodologies] = useState<any[]>([]);

  // ── Auth ─────────────────────────────────────────────────────────────────────
  // NUNCA lemos localStorage no início — o login deve sempre ser feito
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [totpToken, setTotpToken] = useState('');
  const [setup2FA, setSetup2FA] = useState<{qrCodeUrl?: string, userId?: string} | null>(null);
  const [isFirstRun, setIsFirstRun] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const authHeader = { 'Authorization': `Bearer ${token}` };
  const reqHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  // ── Interceptador Global de Fetch para Auto-Logout no 401 ────────────────────
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        console.warn('Sessão expirada (401). Deslogando usuário...');
        localStorage.removeItem('olympus_token');
        localStorage.removeItem('olympus_user');
        setToken(null);
        setUser(null);
      }
      return response;
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!token) {
      fetch('/api/v1/auth/setup-status')
        .then(res => res.json())
        .then(data => {
          if (data.hasUsers === false) {
            setIsFirstRun(true);
            setAuthMode('register');
            setAuthForm(prev => ({ ...prev, name: 'Administrador' }));
          }
        })
        .catch(console.error);
    }
  }, [token]);

  const carregarSessoes = async () => {
    try {
      const r = await fetch('/api/v1/sessions?t=' + Date.now(), { headers: authHeader });
      if (r.ok) setSessoes(await r.json());
    } catch (_) {}
  };

  useEffect(() => { if (token) carregarSessoes(); }, [token]);

  useEffect(() => {
    if (token) {
      fetch('/api/v1/engine/methodologies', { headers: reqHeaders })
        .then(res => res.ok ? res.json() : [])
        .then(data => setMethodologies(Array.isArray(data) ? data : []))
        .catch(err => console.error('Erro ao buscar metodologias:', err));
    }
  }, [token]);

  const carregarIndicadores = async (projectId: string) => {
    try {
      const r = await fetch(`/api/v1/indicators/project/${projectId}`, { headers: authHeader });
      if (r.ok) setIndicadores(await r.json());
    } catch { setIndicadores([]); }
  };

  const carregarSinais = async (projectId: string) => {
    try {
      const r = await fetch(`/api/v1/signals/${projectId}`, { headers: authHeader });
      if (r.ok) {
        const data = await r.json();
        setWeakSignals(data.sinais || []);
        setSignalStats(data.stats || null);
      }
    } catch { setWeakSignals([]); setSignalStats(null); }
  };

  const carregarRevisao = async (projectId: string) => {
    try {
      const r = await fetch(`/api/v1/reviews/${projectId}`, { headers: authHeader });
      if (r.ok) { const d = await r.json(); setAnalyticReview(d.review); }
    } catch { /* silencioso */ }
  };

  const carregarSessao = async (id: string) => {
    try {
      const r = await fetch('/api/v1/sessions/' + id + '?t=' + Date.now(), { headers: authHeader });
      if (!r.ok) { alert('Erro ao carregar análise.'); return; }
      const s = await r.json();
      setProjeto({
        nome: s.name || '',
        metodologia: s.methodology || 'MSEF',
        status: s.status || 'Em produção',
        kratosCron: s.kratosCron || '0 6 * * *',
        horizonte: s.horizon || '',
        elaborador: s.analyst || '',
        cliente: s.client || '',
        questaoEstrategica: '',
        mudancaIdentificada: ''
      });
      setSessionId(s.id);
      const msgs = s.mensagens || [];
      setMessages(msgs.map((m: any) => ({ role: m.role, content: m.content, id: m.id })));
      setShowSessoes(false);
      carregarIndicadores(s.id);
      carregarSinais(s.id);
      carregarRevisao(s.id);
    } catch (e: any) { alert('Erro ao carregar análise: ' + e.message); }
  };

  const deletarSessao = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Deseja realmente excluir esta análise?')) return;
    try {
      const r = await fetch('/api/v1/sessions/' + id, { method: 'DELETE', headers: authHeader });
      if (r.ok) setSessoes(prev => prev.filter(s => s.id !== id));
    } catch (e: any) { console.warn('deletarSessao falhou:', e.message); }
  };

  const deletarMensagem = async (msgId: string | undefined, msgIdx: number) => {
    if (!window.confirm('Deseja remover esta mensagem da análise?')) return;

    // Captura contexto antes de remover
    const deletedMsg = messages[msgIdx];
    const wasAssistant = deletedMsg?.role === 'assistant';
    const prevUserMsg = wasAssistant
      ? [...messages].slice(0, msgIdx).reverse().find(m => m.role === 'user')
      : null;

    if (msgId) {
      try {
        await fetch(`/api/v1/sessions/${sessionId}/messages/${msgId}`, {
          method: 'DELETE',
          headers: authHeader
        });
      } catch (e: any) { console.warn('deletarMensagem falhou:', e.message); }
    }
    setMessages(prev => prev.filter((_, i) => i !== msgIdx));

    // Oferece reexecutar a fase somente se for resposta do assistente
    if (wasAssistant && prevUserMsg && window.confirm('Deseja reexecutar esta fase com a mesma entrada?')) {
      const content = typeof prevUserMsg.content === 'string' ? prevUserMsg.content : 'CONFIRMAR';
      await sendMessage(content);
    }
  };

  const dispararEmailTeste = async () => {
    const destino = window.prompt("Digite o e-mail de destino para receber o alerta do KRATOS:", "seu_email@dominio.com");
    if (!destino) return;
    try {
      const res = await fetch(`/api/v1/test-email`, { method: 'POST', headers: reqHeaders, body: JSON.stringify({ to: destino, projectName: projeto.nome }) });
      const data = await res.json();
      if (res.ok) alert(`E-mail de teste enviado com sucesso para ${destino}!`);
      else alert(data.error || 'Erro ao disparar e-mail de teste. Verifique o terminal do Docker.');
    } catch (e: any) { alert('Erro na requisição: ' + e.message); }
  };

  const salvarConfiguracoes = async () => {
    try {
      const r = await fetch('/api/v1/sessions/' + sessionId, {
        method: 'PATCH',
        headers: reqHeaders,
        body: JSON.stringify({ name: projeto.nome, status: projeto.status, kratosCron: projeto.kratosCron, methodology: projeto.metodologia })
      });
      if (r.ok) { setShowSettingsModal(false); carregarSessoes(); }
    } catch (e: any) { alert('Erro ao salvar configurações: ' + e.message); }
  };

  const getAgentInfo = (text: string) => {
    const foundKey = Object.keys(AGENTS).find(key => text.includes(`${key} ·`) || text.includes(`**${key}**`));
    return foundKey ? { name: foundKey, ...AGENTS[foundKey] } : { name: 'ATHENA', ...AGENTS.ATHENA };
  };

  // ── Nova Sessão: upload de arquivos de contexto ──────────────────────────────
  const handleScopeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setScopeExtracting(true);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      const res = await fetch('/api/v1/extract', { method: 'POST', headers: authHeader, body: fd });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const result = await res.json();
      const ok: {name: string, text: string}[] = [];
      result.files.forEach((f: any) => {
        if (f.text?.trim()) ok.push({ name: f.name, text: f.text });
      });
      if (ok.length) setScopeFiles(prev => [...prev, ...ok]);
    } catch (err: any) { alert('Erro ao processar arquivo: ' + err.message); }
    setScopeExtracting(false);
    if (scopeFileInputRef.current) scopeFileInputRef.current.value = '';
  };

  // ── SSE Chat — progresso e token streaming em tempo real ────────────────────
  const callChatStream = async (
    payload: object,
    onDone: (data: { text: string; agentName: string; thinking: string }) => void
  ): Promise<void> => {
    setStreamingText('');
    setStepLog([]);
    const res = await fetch('/api/v1/chat/stream', {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.body) {
      const errData = await res.json().catch(() => ({}));
      throw new Error((errData as any).error?.message || (errData as any).error || `Erro HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE delimita eventos por linha em branco dupla
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const dataLine = part.split('\n').find(l => l.startsWith('data: '));
        if (!dataLine) continue;
        try {
          const event = JSON.parse(dataLine.slice(6));
          if (event.type === 'agent') {
            setProgressAgent(event.agent);
            setStepLog([]);
          } else if (event.type === 'step') {
            setStepLog(prev => [...prev.slice(-6), event.text]);
          } else if (event.type === 'token') {
            setStreamingText(prev => prev + event.text);
          } else if (event.type === 'status') {
            // mantém o último agente visível durante status intermediários
          } else if (event.type === 'done') {
            setProgressAgent('');
            setStreamingText('');
            setStepLog([]);
            onDone({ text: event.text, agentName: event.agentName, thinking: event.thinking || '' });
          } else if (event.type === 'error') {
            throw new Error(event.message || 'Erro no servidor');
          }
        } catch (parseErr: any) {
          // se o erro veio do throw acima, propaga
          if (parseErr.message !== 'Unexpected token') throw parseErr;
        }
      }
    }
    setProgressAgent('');
    setStreamingText('');
  };

  // ── Iniciar Sessão (Nova Análise) ────────────────────────────────────────────
  const iniciarSessao = async () => {
    setShowNovaSessaoModal(false);
    setLoading(true);

    const campos: string[] = [];
    if (scopeForm.tema)               campos.push(`Tema / Objeto de Análise: ${scopeForm.tema}`);
    if (scopeForm.horizonte)          campos.push(`Horizonte Temporal: ${scopeForm.horizonte}`);
    if (scopeForm.elaborador)         campos.push(`Equipe / Quem Elabora: ${scopeForm.elaborador}`);
    if (scopeForm.cliente)            campos.push(`Usuário / Cliente: ${scopeForm.cliente}`);
    if (scopeForm.questaoEstrategica) campos.push(`Questão Estratégica Central: ${scopeForm.questaoEstrategica}`);
    if (scopeForm.mudancaIdentificada) campos.push(`Mudança Específica Já Identificada: ${scopeForm.mudancaIdentificada}`);

    let fileContext = '';
    if (scopeFiles.length > 0) {
      fileContext = '\n\n' + scopeFiles.map(f =>
        `--- DOCUMENTO DE CONTEXTO: ${f.name} ---\n${f.text}\n--- FIM DO DOCUMENTO ---`
      ).join('\n\n');
    }

    const nome = scopeForm.tema || 'Nova Análise';
    const newSessionId = `sess_${Date.now()}`;

    setProjeto(prev => ({ ...prev, nome, ...scopeForm }));
    setSessionId(newSessionId);
    setMessages([]);
    setThinkingBlocks({});
    setThinkingOpen({});

    const initMsg = campos.length > 0
      ? `Iniciar\n\nDados de escopo fornecidos pelo usuário:\n${campos.map(c => `- ${c}`).join('\n')}${fileContext}\n\nNão solicite essas informações novamente. Confirme o recebimento, apresente as etapas da metodologia e pergunte por onde iniciamos.`
      : `Iniciar`;

    const newMessages = [{ role: 'user', content: initMsg }];
    setMessages(newMessages);

    try {
      await callChatStream(
        { projectId: newSessionId, projectName: nome, metodologia: projeto.metodologia || 'MSEF', vizMode, messages: newMessages },
        ({ text, thinking: thinkingText }) => {
          setMessages(prev => {
            const next = [...prev, { role: 'assistant', content: text }];
            if (thinkingText) setThinkingBlocks(tb => ({ ...tb, [next.length - 1]: thinkingText }));
            return next;
          });
          carregarSessoes();
          carregarIndicadores(newSessionId);
          carregarSinais(newSessionId);
        }
      );
    } catch (error: any) {
      console.error("Erro ao iniciar:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Erro ao conectar com o servidor.' }]);
    } finally {
      setLoading(false);
      setStreamingText('');
      setScopeFiles([]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setExtracting(true);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      const res = await fetch('/api/v1/extract', { method: 'POST', headers: authHeader, body: fd });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const result = await res.json();
      const ok: any[] = [];
      result.files.forEach((f: any) => {
        if (f.error) setFileError(prev => `${prev} | ${f.name}: ${f.error}`);
        else if (!f.text?.trim()) setFileError(prev => `${prev} | ${f.name}: Vazio`);
        else ok.push({ name: f.name, text: f.text, isImage: f.isImage, dataUrl: f.dataUrl });
      });
      if (ok.length) setAttachedFiles(prev => [...prev, ...ok]);
    } catch (err: any) { setFileError(err.message); }
    setExtracting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openPainel = () => {
    if (!projeto.nome || projeto.nome === 'Nova Análise' || messages.length < 3) {
      setMode('monitoring');
      setSidebarOpen(true);
      setShowSessoes(true);
      carregarSessoes();
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '**HERMES** · \n\nPara visualizar o **Painel KRATOS**, é necessário carregar um projeto com cenários já definidos.\n\nAbri o **Histórico de Análises** na barra lateral. Por favor, **selecione um projeto existente** para carregar os dados no dashboard.' }
      ]);
      return;
    }

    const kratosMessages = messages.filter(m =>
      m.role === 'assistant' && m.content && m.content.toUpperCase().includes('KRATOS')
    );

    let cenarioAtual = 'Aguardando avaliação KRATOS';
    let statusGeral = 'verde';
    const indicadoresExtraidos: any[] = [];

    if (kratosMessages.length > 0) {
      const lastKratos = kratosMessages[kratosMessages.length - 1].content;
      const cenarioMatch = lastKratos.match(/cen[aá]rio\s*(atual[:\s]*)?\*?\*?(Q[1-4][^*\n]*)/i);
      if (cenarioMatch) cenarioAtual = cenarioMatch[2].trim();

      const lowerKratos = lastKratos.toLowerCase();
      if (lowerKratos.includes('alerta') || lowerKratos.includes('crítico') || lowerKratos.includes('vermelho')) statusGeral = 'vermelho';
      else if (lowerKratos.includes('atenção') || lowerKratos.includes('monitorar') || lowerKratos.includes('amarelo')) statusGeral = 'amarelo';

      const tableRows = lastKratos.match(/\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|([^|\n]*)\|/g) || [];
      for (const row of tableRows) {
        const cols = row.split('|').map(c => c.trim()).filter(Boolean);
        if (cols.length >= 3 && !/^[-:]+$/.test(cols[0])) {
          const statusCell = (cols[2] || '').toLowerCase();
          const indStatus = statusCell.includes('verde') || statusCell.includes('ok') || statusCell.includes('normal') ? 'verde'
            : statusCell.includes('amarelo') || statusCell.includes('atenção') || statusCell.includes('monitorar') ? 'amarelo'
            : statusCell.includes('vermelho') || statusCell.includes('alerta') || statusCell.includes('crítico') ? 'vermelho'
            : 'verde';
          indicadoresExtraidos.push({ nome: cols[0], valor: cols[1] || '—', status: indStatus, fonte: cols[3] || '—' });
        }
      }
    }

    const dados = {
      projeto, cenario: cenarioAtual, status: statusGeral,
      indicadores: indicadoresExtraidos, geradoEm: new Date().toLocaleString('pt-BR'),
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(dados))));
    window.open(`/api/v1/painel?d=${encoded}`, '_blank');
  };

  const removeFile = (i: number) => setAttachedFiles(prev => prev.filter((_, j) => j !== i));

  const sendMessage = async (textOverride?: any) => {
    const isDirectCommand = typeof textOverride === 'string';
    const textToProcess = isDirectCommand ? textOverride : input;

    if ((!textToProcess.trim() && attachedFiles.length === 0) || loading || extracting) return;

    let fullContent: any = textToProcess.trim();
    const upper = textToProcess.toUpperCase();

    if (upper === 'KRATOS' || upper === 'ACOMPANHAMENTO' || upper.includes('KRATOS') || upper.includes('ACOMPANHAMENTO')) {
      setMode('monitoring');
      if (!projeto.nome || messages.length < 3) {
        setSidebarOpen(true);
        setShowSessoes(true);
        carregarSessoes();
        setMessages(prev => [
          ...prev,
          { role: 'user', content: textToProcess.trim() || 'ACOMPANHAMENTO' },
          { role: 'assistant', content: '**HERMES** · \n\nPara ativar o módulo **KRATOS** (Monitoramento), é necessário ter um projeto com cenários já definidos.\n\nAbri o **Histórico de Análises** na barra lateral. Por favor, **selecione um projeto existente** para carregá-lo e iniciar o acompanhamento, ou conduza uma Nova Produção de Cenários primeiro.' }
        ]);
        if (!isDirectCommand) setInput('');
        setAttachedFiles([]);
        return;
      }
    }

    if (upper.includes('PRODUÇÃO') || upper.includes('PRODUCAO')) setMode('production');

    if (attachedFiles.length > 0) {
      const textFiles = attachedFiles.filter(f => !f.isImage);
      const imageFiles = attachedFiles.filter(f => f.isImage);

      if (textFiles.length > 0) {
        const fb = textFiles.map(f => `\n\n--- DOCUMENTO DE REFERÊNCIA/MODELO: ${f.name} ---\n${f.text}\n--- FIM DO DOCUMENTO ---`).join('\n');
        fullContent = fullContent ? `${fullContent}\n${fb}` : `Documentos em anexo:\n${fb}`;
      }

      if (imageFiles.length > 0) {
        const contentArray: any[] = [{ type: 'text', text: fullContent || 'Analise a imagem em anexo como referência ou modelo de formato.' }];
        imageFiles.forEach(img => { contentArray.push({ type: 'image', image: img.dataUrl }); });
        fullContent = contentArray;
      }
    }

    const newMessages = [...messages, { role: 'user', content: fullContent }];
    setMessages(prev => [...prev, { role: 'user', content: textToProcess || '(documentos em anexo)' }]);
    if (!isDirectCommand) setInput('');
    setAttachedFiles([]);
    setLoading(true);

    try {
      await callChatStream(
        { projectId: sessionId, projectName: projeto.nome, metodologia: projeto.metodologia, vizMode, messages: newMessages },
        ({ text, thinking: thinkingText }) => {
          setMessages(prev => {
            const next = [...prev, { role: 'assistant', content: text }];
            if (thinkingText) setThinkingBlocks(tb => ({ ...tb, [next.length - 1]: thinkingText }));
            return next;
          });
          // Recarrega indicadores/sinais quando KRATOS ou KLIO respondem
          if (text.toUpperCase().includes('KRATOS')) { carregarIndicadores(sessionId); carregarSinais(sessionId); }
          if (text.toUpperCase().includes('KLIO'))   carregarSinais(sessionId);
        }
      );
    } catch (error: any) {
      console.error("Erro ao enviar:", error);
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ Erro ao conectar com o servidor: ${error.message}` }]);
    } finally {
      setLoading(false);
      setStreamingText('');
    }
  };

  // ── Relatórios ───────────────────────────────────────────────────────────────
  const gerarRelatorio = async (tipo: 'padrao' | 'estendido') => {
    if (loading || extracting || messages.length === 0) return;

    if (tipo === 'padrao') {
      // Busca especificamente o produto "RELATÓRIO FINAL PADRÃO" do HERMES
      const patterns = ['RELATÓRIO FINAL PADRÃO', 'RELATÓRIO FINAL', 'RELATÓRIO DE CENÁRIOS', 'RELATÓRIO ESTRATÉGICO', 'RELATÓRIO PROSPECTIVO'];
      let targetMsg: {role: string, content: string, id?: string} | undefined;
      for (const pat of patterns) {
        targetMsg = [...messages].reverse().find(m =>
          m.role === 'assistant' && m.content.toUpperCase().includes(pat)
        );
        if (targetMsg) break;
      }
      // Fallback: última mensagem do HERMES
      if (!targetMsg) {
        targetMsg = [...messages].reverse().find(m =>
          m.role === 'assistant' && (m.content.includes('**HERMES**') || m.content.includes('HERMES ·'))
        );
      }
      if (!targetMsg) return alert('Nenhum relatório final do HERMES encontrado. Conclua a análise primeiro.');
      await exportSinglePdf(targetMsg.content);

    } else {
      // Relatório Estendido: todas as mensagens dos agentes (sem mensagens do usuário)
      const agentMsgs = messages.filter(m => m.role === 'assistant');
      if (agentMsgs.length === 0) return alert('Nenhuma análise disponível.');
      setExportingPdf(true);
      try {
        const res = await fetch('/api/v1/export/pdf', {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify({ projeto, messages: agentMsgs, tipo: 'estendido' }),
        });
        if (!res.ok) throw new Error('Erro ao gerar PDF estendido');
        const html = await res.text();
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } catch (e: any) { alert('Erro ao gerar relatório estendido: ' + e.message); }
      setExportingPdf(false);
    }
  };

  const gerarRelatorioKratos = async () => {
    if (loading || extracting) return;
    if (!projeto.nome || messages.length < 3) {
      alert('É necessário ter um projeto com cenários já definidos para acionar o KRATOS.');
      return;
    }

    setMode('monitoring');
    const prompt = `COMANDO DO SISTEMA: Acione o agente KRATOS para o projeto de nome oficial "${projeto.nome}". \nREGRAS ESTRITAS DE OPERAÇÃO MÁQUINA:\n1. Não converse, vá direto à análise baseada no histórico desta sessão.\n2. Se houver falha na busca, prossiga com os dados conhecidos.\n3. Gere EXCLUSIVAMENTE o Relatório de Acompanhamento padronizado.\n4. IMPORTANTE: O usuário pode ter alterado o nome, fatores, eventos e indicadores ao longo da análise. Baseie-se SEMPRE nas últimas decisões do histórico e use o título atualizado do projeto ("${projeto.nome}").\nInicie a geração agora.`;

    const newMessages = [...messages, { role: 'user', content: prompt }];
    setMessages(prev => [...prev, { role: 'user', content: `⚡ Comando Manual: Gerar Relatório de Monitoramento Atualizado` }]);
    setLoading(true);

    try {
      await callChatStream(
        { projectId: sessionId, projectName: projeto.nome, metodologia: projeto.metodologia, vizMode: 'etapa', messages: newMessages },
        ({ text, thinking: thinkingText }) => {
          setMessages(prev => {
            const next = [...prev, { role: 'assistant', content: text }];
            if (thinkingText) setThinkingBlocks(tb => ({ ...tb, [next.length - 1]: thinkingText }));
            return next;
          });
        }
      );
    } catch (error: any) {
      console.error("Erro ao gerar relatório KRATOS:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Erro ao conectar com o servidor: ${error.message}` }]);
    } finally {
      setLoading(false);
      setStreamingText('');
    }
  };

  const downloadMarkdown = (content: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `StratSight_Relatorio_${projeto.nome ? projeto.nome.replace(/\s+/g,'_') : 'Analise'}_${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportDocx = async () => {
    if (!messages || messages.length === 0) return alert('Nenhuma mensagem para exportar.');
    setExportingDocx(true);
    try {
      const res = await fetch('/api/v1/export/docx', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({ projeto, messages }),
      });
      if (!res.ok) throw new Error('Erro ao gerar DOCX');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `StratSight_${(projeto.nome || 'Cenarios').replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { alert('Erro ao gerar DOCX: ' + e.message); }
    setExportingDocx(false);
  };

  const exportPdf = async () => {
    if (!messages || messages.length === 0) return alert('Nenhuma mensagem para exportar.');
    setExportingPdf(true);
    try {
      const res = await fetch('/api/v1/export/pdf', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({ projeto, messages }),
      });
      if (!res.ok) throw new Error('Erro ao gerar PDF');
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e: any) { alert('Erro ao gerar PDF: ' + e.message); }
    setExportingPdf(false);
  };

  const exportSingleDocx = async (content: string) => {
    try {
      const res = await fetch('/api/v1/export/docx', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({ projeto, messages: [{ role: 'assistant', content }] }),
      });
      if (!res.ok) throw new Error('Erro ao gerar DOCX');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `StratSight_${(projeto.nome || 'Fase').replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { alert('Erro ao gerar DOCX: ' + e.message); }
  };

  const exportSinglePdf = async (content: string) => {
    try {
      const res = await fetch('/api/v1/export/pdf', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({ projeto, messages: [{ role: 'assistant', content }], tipo: 'padrão' }),
      });
      if (!res.ok) throw new Error('Erro ao gerar PDF');
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e: any) { alert('Erro ao gerar PDF: ' + e.message); }
  };

  // ── TELA DE LOGIN ─────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center bg-stratsight-dark font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-stratsight-gold to-stratsight-medium"></div>
          <div className="flex justify-center mb-6 mt-2">
            <div className="w-16 h-16 rounded-full bg-stratsight-medium flex items-center justify-center text-white text-3xl font-bold shadow-inner">⚡</div>
          </div>
          <h2 className="text-center text-2xl font-bold text-stratsight-dark tracking-widest mb-1">OLYMPUS v4.0</h2>
          <p className="text-center text-xs text-stratsight-medium mb-6 uppercase tracking-wider">{authMode === 'login' ? 'Acesso Restrito' : 'Cadastro de Usuário'}</p>

          {isFirstRun && authMode === 'register' && (
            <div className="mb-4 bg-purple-50 border border-purple-200 text-purple-800 text-xs p-3 rounded-xl text-center shadow-inner">
              <strong>Sistema não configurado.</strong><br/>
              O primeiro usuário a se cadastrar receberá automaticamente o perfil de <strong>Administrador</strong>.
            </div>
          )}

          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              if (setup2FA) {
                const res = await fetch('/api/v1/auth/2fa/enable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: setup2FA.userId, token: totpToken }) });
                if (!res.ok) { const txt = await res.text(); try { alert(JSON.parse(txt).error); } catch { alert('Erro 2FA: ' + txt.slice(0, 100)); } return; }
                alert('2FA configurado com sucesso! Faça login.');
                setSetup2FA(null); setAuthMode('login'); setTotpToken(''); setAuthForm({...authForm, password: ''});
                return;
              }

              if (authMode === 'login') {
                const res = await fetch('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({...authForm, token: requires2FA ? totpToken : undefined}) });
                if (!res.ok) { const txt = await res.text(); try { alert(JSON.parse(txt).error || 'Erro na autenticação'); } catch { alert('Falha no Servidor (500/502). O Backend pode estar offline.\n\nDetalhes: ' + txt.slice(0, 100)); } return; }
                const data = await res.json();
                if (data.requires2FA) { setRequires2FA(true); return; }
                // Armazena token para persistência de sessão do servidor (mas sempre requer login manual)
                localStorage.setItem('olympus_token', data.token);
                localStorage.setItem('olympus_user', JSON.stringify(data.user));
                setToken(data.token);
                setUser(data.user);
              } else {
                const res = await fetch('/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authForm) });
                if (!res.ok) { const txt = await res.text(); try { alert(JSON.parse(txt).error || 'Erro no cadastro'); } catch { alert('Falha no Servidor (500/502). O Backend pode estar offline.\n\nDetalhes: ' + txt.slice(0, 100)); } return; }
                const data = await res.json();
                setIsFirstRun(false);
                if (window.confirm('Cadastro realizado! Deseja configurar a Autenticação em Duas Etapas (2FA) agora para maior segurança?')) {
                  const res2fa = await fetch('/api/v1/auth/2fa/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: data.user.id }) });
                  if (!res2fa.ok) { alert('Erro ao gerar QR Code'); return; }
                  const data2fa = await res2fa.json();
                  setSetup2FA({ qrCodeUrl: data2fa.qrCodeUrl, userId: data.user.id });
                } else {
                  alert('Faça login para continuar.'); setAuthMode('login'); setAuthForm({...authForm, password: ''});
                }
              }
            } catch (err: any) { alert('Erro Crítico de Conexão: ' + err.message); }
          }} className="space-y-4">
            {setup2FA ? (
              <div className="flex flex-col items-center text-center">
                <p className="text-sm text-gray-600 mb-4">Escaneie o QR Code abaixo com seu app autenticador e insira o código gerado.</p>
                <img src={setup2FA.qrCodeUrl} alt="QR Code 2FA" className="w-48 h-48 mb-4 border p-2 rounded-xl" />
                <input type="text" placeholder="Código de 6 dígitos" required value={totpToken} onChange={e => setTotpToken(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-stratsight-medium transition-colors text-center tracking-widest text-lg font-mono" maxLength={6} />
                <button type="submit" className="w-full bg-stratsight-dark text-white font-bold py-3.5 rounded-xl hover:bg-stratsight-medium transition-colors shadow-lg shadow-green-900/20 mt-4">Confirmar 2FA</button>
                <button type="button" onClick={() => { setSetup2FA(null); setAuthMode('login'); setAuthForm({...authForm, password: ''}); }} className="mt-3 text-xs text-gray-500 hover:text-stratsight-medium font-bold transition-colors">Pular por enquanto</button>
              </div>
            ) : requires2FA ? (
              <div className="flex flex-col items-center text-center">
                <p className="text-sm text-gray-600 mb-4">Esta conta está protegida por 2FA. Insira o código do seu aplicativo.</p>
                <input type="text" placeholder="Código de 6 dígitos" required value={totpToken} onChange={e => setTotpToken(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-stratsight-medium transition-colors text-center tracking-widest text-lg font-mono" maxLength={6} />
                <button type="submit" className="w-full bg-stratsight-dark text-white font-bold py-3.5 rounded-xl hover:bg-stratsight-medium transition-colors shadow-lg shadow-green-900/20 mt-4">Verificar e Entrar</button>
                <button type="button" onClick={() => { setRequires2FA(false); setTotpToken(''); }} className="mt-3 text-xs text-gray-500 hover:text-stratsight-medium font-bold transition-colors">Voltar</button>
              </div>
            ) : (
              <>
                {authMode === 'register' && <input type="text" placeholder="Nome Completo" required value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-stratsight-medium transition-colors" />}
                <input type="email" placeholder="E-mail corporativo" required value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-stratsight-medium transition-colors" />
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} placeholder="Senha" required value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-stratsight-medium transition-colors pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-gray-400 hover:text-stratsight-medium focus:outline-none">
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
                <button type="submit" className="w-full bg-stratsight-dark text-white font-bold py-3.5 rounded-xl hover:bg-stratsight-medium transition-colors shadow-lg shadow-green-900/20">{authMode === 'login' ? 'Entrar no Sistema' : 'Cadastrar'}</button>
              </>
            )}
          </form>
          {!setup2FA && !requires2FA && !isFirstRun && (
            <div className="mt-6 text-center">
              <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-xs text-gray-500 hover:text-stratsight-medium font-bold transition-colors">{authMode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── APLICAÇÃO PRINCIPAL ───────────────────────────────────────────────────────
  return (
    <>
    <div className="flex h-screen font-sans bg-[#F0F4F0] overflow-hidden">

      {/* ── MODAL: NOVA SESSÃO ─────────────────────────────────────────────────── */}
      {showNovaSessaoModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-4 p-6 border-b border-gray-100">
              <div className="w-11 h-11 rounded-full bg-stratsight-dark flex items-center justify-center text-white text-xl font-bold shrink-0">⚡</div>
              <div className="flex-1">
                <h2 className="font-bold text-stratsight-dark text-lg tracking-wide">Nova Análise Prospectiva</h2>
                <p className="text-xs text-stratsight-medium mt-0.5">Preencha o escopo da análise ou carregue um documento de contexto.</p>
              </div>
              <button onClick={() => setShowNovaSessaoModal(false)} className="text-gray-400 hover:text-red-500 font-bold text-xl p-1">✕</button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {/* Orientação */}
              <div className="bg-stratsight-light border border-stratsight-medium/30 rounded-xl p-4 text-sm text-stratsight-dark leading-relaxed">
                <strong>Como preencher:</strong> Informe ao menos o <em>tema/objeto</em> e o sistema sugere as demais opções. Você pode carregar documentos de contexto (relatórios, estudos, bases de dados) para enriquecer a análise — ou deixar todos os campos em branco e deixar o HERMES conduzir a sessão.
              </div>

              {/* Campos do formulário */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stratsight-dark uppercase mb-1.5 tracking-wide">1. Tema / Objeto de Análise <span className="text-stratsight-medium">(principal)</span></label>
                  <input
                    value={scopeForm.tema}
                    onChange={e => setScopeForm(f => ({...f, tema: e.target.value}))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-stratsight-medium outline-none transition-colors text-sm"
                    placeholder="Ex: Cenários prospectivos para o setor de defesa até 2035"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stratsight-dark uppercase mb-1.5 tracking-wide">2. Horizonte Temporal</label>
                    <input
                      value={scopeForm.horizonte}
                      onChange={e => setScopeForm(f => ({...f, horizonte: e.target.value}))}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-stratsight-medium outline-none transition-colors text-sm"
                      placeholder="Ex: 10 anos (até 2035)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stratsight-dark uppercase mb-1.5 tracking-wide">3. Quem Elabora</label>
                    <input
                      value={scopeForm.elaborador}
                      onChange={e => setScopeForm(f => ({...f, elaborador: e.target.value}))}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-stratsight-medium outline-none transition-colors text-sm"
                      placeholder="Ex: Célula de Inteligência Estratégica"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stratsight-dark uppercase mb-1.5 tracking-wide">4. Usuário / Cliente</label>
                  <input
                    value={scopeForm.cliente}
                    onChange={e => setScopeForm(f => ({...f, cliente: e.target.value}))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-stratsight-medium outline-none transition-colors text-sm"
                    placeholder="Ex: Comando do Exército / Diretoria de Planejamento"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stratsight-dark uppercase mb-1.5 tracking-wide">5. Questão Estratégica Central</label>
                  <textarea
                    value={scopeForm.questaoEstrategica}
                    onChange={e => setScopeForm(f => ({...f, questaoEstrategica: e.target.value}))}
                    rows={2}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-stratsight-medium outline-none transition-colors text-sm resize-none"
                    placeholder="Ex: Como o Brasil deve se posicionar diante das transformações tecnológicas no campo de batalha até 2035?"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stratsight-dark uppercase mb-1.5 tracking-wide">6. Mudança Específica Já Identificada</label>
                  <textarea
                    value={scopeForm.mudancaIdentificada}
                    onChange={e => setScopeForm(f => ({...f, mudancaIdentificada: e.target.value}))}
                    rows={2}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-stratsight-medium outline-none transition-colors text-sm resize-none"
                    placeholder="Ex: Aceleração do uso de IA em sistemas autônomos de combate por potências rivais"
                  />
                </div>
              </div>

              {/* Upload de contexto */}
              <div className="border-2 border-dashed border-stratsight-medium/40 rounded-xl p-4 bg-stratsight-light/50">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">📂</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-stratsight-dark uppercase tracking-wide mb-1">Documentos de Contexto (opcional)</p>
                    <p className="text-xs text-gray-500 mb-3">Carregue relatórios, estudos, bases de dados ou qualquer documento relevante. O sistema os incorporará como contexto da análise.</p>
                    <input
                      ref={scopeFileInputRef}
                      type="file"
                      accept={ACCEPTED_TYPES}
                      multiple
                      className="hidden"
                      onChange={handleScopeFileChange}
                    />
                    <button
                      onClick={() => scopeFileInputRef.current?.click()}
                      disabled={scopeExtracting}
                      className="px-4 py-2 bg-white border border-stratsight-medium/40 text-stratsight-dark text-xs font-bold rounded-lg hover:bg-stratsight-light transition-colors shadow-sm disabled:opacity-50"
                    >
                      {scopeExtracting ? '⏳ Processando...' : '📎 Selecionar Arquivos'}
                    </button>
                    {scopeFiles.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {scopeFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5 bg-white border border-stratsight-medium/30 rounded-full px-3 py-1 text-xs text-stratsight-dark">
                            <span>📄 {f.name}</span>
                            <button onClick={() => setScopeFiles(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 font-bold ml-1">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Nível de análise */}
              {/* Metodologia */}
              <div>
                <label className="block text-xs font-bold text-stratsight-dark uppercase mb-1.5 tracking-wide">Metodologia de Análise</label>
                <select
                  value={projeto.metodologia}
                  onChange={e => setProjeto(p => ({ ...p, metodologia: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-stratsight-medium outline-none transition-colors text-sm bg-white"
                >
                  {methodologies.length > 0
                    ? methodologies.map((m: any) => (
                        <option key={m.id} value={m.name}>{m.name} — {m.description}</option>
                      ))
                    : <option value="MSEF">MSEF — Método Multidimensional de Exploração de Futuros</option>
                  }
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stratsight-dark uppercase mb-2 tracking-wide">Nível de Análise</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'thinking', label: '🧠 Raciocínio Estendido', desc: 'Exibe o raciocínio interno antes da resposta' },
                    { id: 'passos', label: '👣 Passo a Passo', desc: 'Avança com uma pergunta/tarefa por vez' },
                    { id: 'etapa', label: '📋 Etapa Completa', desc: 'Gera a etapa inteira de uma vez (Padrão)' },
                    { id: 'passagem', label: '⚡ Processo Completo', desc: 'Conduz o método de forma autônoma' }
                  ].map(vm => (
                    <button key={vm.id} onClick={() => setVizMode(vm.id)} className={`p-3 text-left border-2 rounded-xl transition-colors ${vizMode === vm.id ? 'border-stratsight-medium bg-stratsight-light text-stratsight-dark' : 'border-gray-200 bg-white text-gray-500 hover:border-stratsight-medium/50'}`}>
                      <div className="font-bold text-sm">{vm.label}</div>
                      <div className="text-[10px] mt-1 leading-tight text-gray-500">{vm.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowNovaSessaoModal(false)}
                className="flex-1 py-3 text-stratsight-medium border-2 border-gray-200 font-bold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={iniciarSessao}
                className="flex-[2] py-3 bg-stratsight-dark text-white font-bold rounded-xl hover:bg-stratsight-medium transition-colors shadow-lg shadow-green-900/20"
              >
                Iniciar Análise
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIGURAÇÕES DO PROJETO ───────────────────────────────────── */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h2 className="font-bold text-stratsight-dark text-xl mb-4">Configurações do Projeto</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stratsight-dark uppercase mb-2">Nome do Projeto</label>
                <input value={projeto.nome} onChange={e => setProjeto({...projeto, nome: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-stratsight-medium outline-none" placeholder="Ex: Cenários 2030" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stratsight-dark uppercase mb-2">Metodologia</label>
                <select value={projeto.metodologia} onChange={e => setProjeto({...projeto, metodologia: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-stratsight-medium outline-none bg-white">
                  {methodologies.length > 0
                    ? methodologies.map((m: any) => <option key={m.id} value={m.name}>{m.name} — {m.description}</option>)
                    : <option value="MSEF">MSEF</option>
                  }
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-stratsight-dark uppercase mb-2">Status do Projeto</label>
                <select value={projeto.status} onChange={e => setProjeto({...projeto, status: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-stratsight-medium outline-none">
                  <option value="Em produção">Em produção (Sem monitoramento)</option>
                  <option value="Ativo">Ativo (Monitoramento KRATOS ligado)</option>
                  <option value="Inativo">Inativo (Arquivado / Pausado)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-stratsight-dark uppercase mb-2">Frequência do Monitoramento</label>
                <select value={projeto.kratosCron} onChange={e => setProjeto({...projeto, kratosCron: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-stratsight-medium outline-none bg-white transition-colors" disabled={projeto.status !== 'Ativo'}>
                  <option value="0 6 * * *">Diário — Todo dia às 06:00</option>
                  <option value="0 18 * * *">Diário — Todo dia às 18:00</option>
                  <option value="0 8 * * 1">Semanal — Toda Segunda-feira às 08:00</option>
                  <option value="0 8 * * 5">Semanal — Toda Sexta-feira às 08:00</option>
                  <option value="0 8 1 * *">Mensal — Todo dia 1º às 08:00</option>
                  <option value="* * * * *">A cada minuto (⚠️ Apenas Testes)</option>
                </select>
                <p className="text-[10px] text-gray-500 mt-1">O agente acordará automaticamente nestes horários para varrer a internet.</p>
              </div>
            </div>
            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <h3 className="text-xs font-bold text-blue-900 uppercase mb-2">Teste de E-mail (KRATOS)</h3>
              <p className="text-[10px] text-blue-700 mb-3">Dispara um e-mail de simulação para verificar as credenciais SMTP no .env.</p>
              <button onClick={dispararEmailTeste} className="w-full py-2 bg-white text-blue-800 border border-blue-200 font-bold rounded-lg hover:bg-blue-100 transition-colors text-xs shadow-sm">⚡ Disparar E-mail de Teste</button>
            </div>
            <div className="mt-8 flex gap-3">
              <button onClick={() => setShowSettingsModal(false)} className="flex-1 py-3 text-stratsight-medium border-2 border-gray-200 font-bold rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={salvarConfiguracoes} className="flex-[2] py-3 bg-stratsight-dark text-white font-bold rounded-xl hover:bg-stratsight-medium transition-colors">Salvar Configurações</button>
            </div>
          </div>
        </div>
      )}

      {showUsersModal && <UsersModal onClose={() => setShowUsersModal(false)} reqHeaders={reqHeaders} />}
      {showBackupModal && <BackupModal onClose={() => setShowBackupModal(false)} reqHeaders={reqHeaders} />}

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────────── */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} shrink-0 bg-stratsight-dark text-[#E8F5E9] flex flex-col transition-all duration-300 overflow-hidden shadow-xl z-20`}>
        <div className="w-72 flex flex-col h-full">
          {/* Logo */}
          <div className="p-5 border-b border-white/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-stratsight-medium flex items-center justify-center font-bold text-white text-lg">⚡</div>
            <div>
              <div className="font-bold text-sm tracking-widest text-[#A5D6A7]">STRATSIGHT</div>
              <div className="text-[10px] text-stratsight-gold italic uppercase tracking-wider">Strategic Foresight</div>
            </div>
          </div>

          {/* Projeto Ativo */}
          {projeto.nome && (
            <div className="p-4 border-b border-white/10 bg-white/5 relative">
              <div className="text-[10px] text-[#66BB6A] font-bold mb-1 tracking-wider">PROJETO ATIVO</div>
              <div className="font-bold text-white text-sm truncate pr-6">{projeto.nome}</div>
              <div className="text-xs text-[#A5D6A7] mt-1 flex items-center gap-2">
                <span className="bg-stratsight-medium text-white px-2 py-0.5 rounded text-[10px] font-bold">{projeto.metodologia}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${projeto.status === 'Ativo' ? 'bg-green-900 text-green-200' : projeto.status === 'Inativo' ? 'bg-red-900 text-red-200' : 'bg-blue-900 text-blue-200'}`}>
                  {projeto.status ? projeto.status.toUpperCase() : 'EM PRODUÇÃO'}
                </span>
              </div>
              <button onClick={() => setShowSettingsModal(true)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors" title="Configurações do Projeto">⚙️</button>
            </div>
          )}

          {/* Ações — scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0 p-4 border-b border-white/10 flex flex-col gap-2">
            <div className="text-[10px] text-[#66BB6A] font-bold mb-2 tracking-wider">AÇÕES</div>

            {/* Nova Sessão — apenas analistas e admins */}
            {user?.role !== 'cliente' && (
              <button
                onClick={() => {
                  setScopeForm({ tema: '', horizonte: '', elaborador: '', cliente: '', questaoEstrategica: '', mudancaIdentificada: '' });
                  setScopeFiles([]);
                  setProjeto(p => ({ ...p, metodologia: 'MSEF' }));
                  setShowNovaSessaoModal(true);
                }}
                className="text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors text-gray-200"
              >
                🔄 Nova Sessão
              </button>
            )}

            {user?.role !== 'cliente' && (
              <>
                <button onClick={openPainel} className="w-full text-left px-3 py-2 rounded-lg bg-stratsight-gold/20 hover:bg-stratsight-gold/30 border border-stratsight-gold/30 text-stratsight-gold text-sm transition-colors mt-2">🖥️ Painel KRATOS</button>
                <button onClick={gerarRelatorioKratos} className="w-full text-left px-3 py-2 rounded-lg bg-[#004D40]/50 hover:bg-[#004D40] border border-[#80CBC4]/30 text-[#80CBC4] text-sm transition-colors mt-2">🤖 Gerar Relatório Agora</button>
              </>
            )}

            {user?.role === 'admin' && (
              <>
                <button onClick={() => setShowUsersModal(true)} className="w-full text-left px-3 py-2 rounded-lg bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-200 text-sm transition-colors mt-2">
                  👥 Gestão de Usuários
                </button>
                <button onClick={() => setShowBackupModal(true)} className="w-full text-left px-3 py-2 rounded-lg bg-yellow-900/40 hover:bg-yellow-900/60 border border-yellow-500/30 text-yellow-200 text-sm transition-colors mt-1">
                  💾 Backup do Banco
                </button>
              </>
            )}

            {user?.role !== 'cliente' && projeto.nome && (
              <button
                onClick={() => {
                  const url = `${window.location.origin}/api/v1/painel/project/${sessionId}?token=${token}`;
                  navigator.clipboard.writeText(url).then(() => {
                    alert('✅ Link do cliente copiado!\n\nCompartilhe este link com o cliente para acesso ao Painel de Monitoramento.');
                  }).catch(() => {
                    prompt('Copie o link abaixo:', url);
                  });
                }}
                className="w-full text-left px-3 py-2 rounded-lg bg-blue-900/40 hover:bg-blue-900/60 border border-blue-500/30 text-blue-200 text-sm transition-colors mt-1"
                title="Gera link permanente de acesso ao painel para o cliente"
              >
                🔗 Link do Cliente
              </button>
            )}

            {/* Revisão Analítica ICD 203 — apenas analistas e admins */}
            {user?.role !== 'cliente' && sessionId && (
              <div className="mt-2 pt-2 border-t border-white/10">
                <div className="text-[10px] text-[#80CBC4] font-bold mb-2 tracking-wider">RIGOR ANALÍTICO</div>
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-[#004D40]/50 hover:bg-[#004D40] border border-[#80CBC4]/30 text-[#80CBC4] text-sm transition-colors"
                >
                  {analyticReview
                    ? `🔍 Revisão: ${analyticReview.status === 'aprovado' ? '✅ Aprovado' : analyticReview.status === 'aprovado_com_ressalvas' ? '⚠️ Com Ressalvas' : analyticReview.status === 'requer_revisao' ? '🔴 Requer Revisão' : '⏳ Pendente'}`
                    : '🔍 Revisar Qualidade (ICD 203)'}
                </button>
              </div>
            )}

            {/* Exportar Relatório — apenas analistas e admins */}
            {user?.role !== 'cliente' && (
              <div className="mt-2 pt-2 border-t border-white/10">
                <div className="text-[10px] text-[#66BB6A] font-bold mb-2 tracking-wider">EXPORTAR RELATÓRIO</div>
                <button onClick={() => gerarRelatorio('padrao')} disabled={exportingPdf} className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors text-gray-200 mb-1 disabled:opacity-50">
                  🖨️ Padrão — Relatório HERMES (PDF)
                </button>
                <button onClick={() => gerarRelatorio('estendido')} disabled={exportingPdf} className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors text-gray-200 disabled:opacity-50">
                  🖨️ Estendido — Todos os Agentes (PDF)
                </button>
              </div>
            )}

            {/* Histórico de Sessões */}
            <div className="mt-2">
              <button onClick={() => { setShowSessoes(s => !s); if (!showSessoes) carregarSessoes(); }} className="w-full px-3 py-2 bg-white/5 hover:bg-white/10 text-sm rounded-lg transition-colors text-left text-gray-200 flex justify-between items-center">
                <span>{showSessoes ? '▲' : '▼'} Histórico de Análises</span>
                {sessoes.length > 0 && <span className="bg-stratsight-dark text-[#A5D6A7] px-1.5 py-0.5 rounded text-[10px] font-bold">{sessoes.length}</span>}
              </button>
              {showSessoes && (
                <div className="mt-2 max-h-64 overflow-y-auto pr-1 space-y-1">
                  <input
                    type="text"
                    value={sessionSearch}
                    onChange={e => setSessionSearch(e.target.value)}
                    placeholder="🔍 Pesquisar análise..."
                    className="w-full text-[11px] bg-white/10 text-white placeholder-gray-500 border border-white/10 rounded-lg px-3 py-1.5 mb-2 outline-none focus:border-stratsight-medium/50"
                  />
                  <div className="flex gap-2 px-2 py-1 mb-1 border-b border-white/10 pb-2">
                    <label className="text-[9px] flex items-center gap-1 cursor-pointer text-[#90CAF9]"><input type="checkbox" checked={filterStatus.producao} onChange={e => setFilterStatus(f => ({...f, producao: e.target.checked}))} /> Produção</label>
                    <label className="text-[9px] flex items-center gap-1 cursor-pointer text-[#66BB6A]"><input type="checkbox" checked={filterStatus.ativos} onChange={e => setFilterStatus(f => ({...f, ativos: e.target.checked}))} /> Ativos</label>
                    <label className="text-[9px] flex items-center gap-1 cursor-pointer text-gray-400"><input type="checkbox" checked={filterStatus.inativos} onChange={e => setFilterStatus(f => ({...f, inativos: e.target.checked}))} /> Inativos</label>
                  </div>
                  {sessoes.length === 0 ? (
                    <div className="text-xs text-gray-400 px-2 py-1">Nenhuma análise salva.</div>
                  ) : (
                    <>
                      {filterStatus.producao && sessoes.filter(s => (s.status === 'Em produção' || !s.status) && (!sessionSearch || (s.name || '').toLowerCase().includes(sessionSearch.toLowerCase()))).length > 0 && (
                        <div className="mb-2">
                          <div className="text-[9px] text-[#90CAF9] font-bold px-2 py-1 uppercase">Em Produção</div>
                          {sessoes.filter(s => (s.status === 'Em produção' || !s.status) && (!sessionSearch || (s.name || '').toLowerCase().includes(sessionSearch.toLowerCase()))).map(s => (
                            <div key={s.id} onClick={() => carregarSessao(s.id)} className="p-2 bg-black/20 hover:bg-black/40 border border-white/5 rounded-lg cursor-pointer transition-colors group relative mb-1">
                              <div className="text-xs font-bold text-white truncate pr-6">{s.name || '(sem título)'}</div>
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-[9px] text-[#A5D6A7]">{s.methodology}</span>
                                <span className="text-[9px] text-gray-500">{new Date(s.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                              </div>
                              <button onClick={(e) => deletarSessao(s.id, e)} className="absolute top-1 right-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {filterStatus.ativos && sessoes.filter(s => s.status === 'Ativo' && (!sessionSearch || (s.name || '').toLowerCase().includes(sessionSearch.toLowerCase()))).length > 0 && (
                        <div className="mb-2">
                          <div className="text-[9px] text-[#66BB6A] font-bold px-2 py-1 uppercase">Monitorados (Ativos)</div>
                          {sessoes.filter(s => s.status === 'Ativo' && (!sessionSearch || (s.name || '').toLowerCase().includes(sessionSearch.toLowerCase()))).map(s => (
                            <div key={s.id} onClick={() => carregarSessao(s.id)} className="p-2 bg-black/20 hover:bg-black/40 border border-white/5 rounded-lg cursor-pointer transition-colors group relative mb-1">
                              <div className="text-xs font-bold text-white truncate pr-6">{s.name || '(sem título)'}</div>
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-[9px] text-[#A5D6A7]">{s.methodology}</span>
                                <span className="text-[9px] text-gray-500">{new Date(s.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                              </div>
                              <button onClick={(e) => deletarSessao(s.id, e)} className="absolute top-1 right-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {filterStatus.inativos && sessoes.filter(s => s.status === 'Inativo' && (!sessionSearch || (s.name || '').toLowerCase().includes(sessionSearch.toLowerCase()))).length > 0 && (
                        <div>
                          <div className="text-[9px] text-gray-500 font-bold px-2 py-1 uppercase">Arquivados (Inativos)</div>
                          {sessoes.filter(s => s.status === 'Inativo' && (!sessionSearch || (s.name || '').toLowerCase().includes(sessionSearch.toLowerCase()))).map(s => (
                            <div key={s.id} onClick={() => carregarSessao(s.id)} className="p-2 bg-black/10 hover:bg-black/30 border border-white/5 rounded-lg cursor-pointer transition-colors group relative opacity-70 mb-1">
                              <div className="text-xs font-bold text-gray-300 truncate pr-6">{s.name || '(sem título)'}</div>
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-[9px] text-[#A5D6A7]">{s.methodology}</span>
                                <span className="text-[9px] text-gray-500">{new Date(s.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                              </div>
                              <button onClick={(e) => deletarSessao(s.id, e)} className="absolute top-1 right-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Agentes */}
          <div className="p-4 border-t border-white/10">
            <div className="text-[10px] text-[#66BB6A] font-bold mb-3 tracking-wider">AGENTES MSEF</div>
            {Object.entries(AGENTS).filter(([k]) => k !== 'ATHENA').map(([key, ag]) => (
              <div key={key} className="flex items-center gap-3 mb-2">
                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: ag.hex }} />
                <span className="text-xs font-bold text-[#81C784] w-20">{key}</span>
                <span className="text-[10px] text-[#4CAF50]">{ag.label}</span>
              </div>
            ))}
          </div>

          {/* Perfil e Logout */}
          <div className="p-4 border-t border-white/10 flex justify-between items-center bg-black/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-stratsight-medium flex items-center justify-center text-xs text-white font-bold shadow-inner">{user?.name?.slice(0,2).toUpperCase()}</div>
              <div>
                <div className="text-xs text-white font-bold truncate w-28">{user?.name}</div>
                <div className="text-[9px] text-stratsight-gold uppercase tracking-wider">{user?.role}</div>
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('olympus_token');
                localStorage.removeItem('olympus_user');
                setToken(null);
                setUser(null);
                setMessages([]);
                setSessoes([]);
              }}
              className="text-xs font-bold text-red-400 hover:text-red-300 p-2 rounded hover:bg-red-400/10 transition-colors"
            >
              SAIR
            </button>
          </div>
        </div>
      </div>

      {/* ── CONTEÚDO PRINCIPAL ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="bg-gradient-to-r from-stratsight-dark to-stratsight-medium p-4 text-white shadow-md flex items-center z-10">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-4 hover:bg-white/20 p-1.5 rounded transition-colors" title="Alternar Barra Lateral">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-widest">ATHENA v4.0</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide ${mode === 'monitoring' ? 'bg-[#004D40] text-[#80CBC4]' : 'bg-white/20 text-white/90'}`}>
                {mode === 'monitoring' ? 'KRATOS · ACOMPANHAMENTO' : 'PRODUÇÃO DE CENÁRIOS'}
              </span>
            </div>
            <p className="text-xs text-stratsight-gold italic mt-0.5">Strategic Foresight · StratSight Brasil</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

          {/* ── PAINEL DE BOAS-VINDAS (estado vazio) ────────────────────────────── */}
          {messages.length === 0 && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-stratsight-dark/10 border-2 border-stratsight-medium/20 flex items-center justify-center text-4xl mb-6 shadow-inner">⚡</div>
              <h2 className="text-xl font-bold text-stratsight-dark mb-3 tracking-wide">OLYMPUS v4.0</h2>
              <p className="text-stratsight-medium text-sm max-w-md leading-relaxed mb-8">
                {user?.role === 'cliente'
                  ? <>Bem-vindo ao painel de acompanhamento.<br/>Selecione um projeto no <strong>Histórico</strong> para visualizar os cenários e indicadores.</>
                  : <>Nossa equipe lhe dá as boas-vindas.<br/>Abra um dos projetos no <strong>Histórico</strong> ou inicie uma nova análise clicando em <strong>Nova Sessão</strong>.</>
                }
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowSessoes(true); setSidebarOpen(true); carregarSessoes(); }}
                  className="px-5 py-2.5 border-2 border-stratsight-medium text-stratsight-dark font-bold rounded-xl hover:bg-stratsight-light transition-colors text-sm"
                >
                  📂 Histórico de Análises
                </button>
                {user?.role !== 'cliente' && (
                  <button
                    onClick={() => {
                      setScopeForm({ tema: '', horizonte: '', elaborador: '', cliente: '', questaoEstrategica: '', mudancaIdentificada: '' });
                      setScopeFiles([]);
                      setProjeto(p => ({ ...p, metodologia: 'MSEF' }));
                      setShowNovaSessaoModal(true);
                    }}
                    className="px-5 py-2.5 bg-stratsight-dark text-white font-bold rounded-xl hover:bg-stratsight-medium transition-colors shadow-lg shadow-green-900/20 text-sm"
                  >
                    🔄 Nova Sessão
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── MENSAGENS ────────────────────────────────────────────────────────── */}
          {messages.map((msg, idx) => {
            if (msg.role === 'user' && msg.content.startsWith('Iniciar')) return null;
            const isUser = msg.role === 'user';
            const agent = isUser ? null : getAgentInfo(msg.content);

            return (
              <div key={idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-full`}>
                {/* Bloco de Raciocínio */}
                {!isUser && thinkingBlocks[idx] && (
                  <div className="ml-14 mb-2 max-w-[85%]">
                    <button onClick={() => setThinkingOpen(prev => ({ ...prev, [idx]: !prev[idx] }))} className="flex items-center gap-2 bg-purple-900/5 border border-purple-900/10 rounded-lg px-3 py-1.5 text-[11px] text-purple-800 font-bold hover:bg-purple-900/10 transition-colors">
                      🧠 Raciocínio interno — {thinkingOpen[idx] ? '▲ ocultar' : '▼ expandir'}
                    </button>
                    {thinkingOpen[idx] && (
                      <div className="mt-1 bg-[#F3E5F5] border border-[#CE93D8] rounded-b-xl rounded-tr-xl p-4 text-[12px] text-[#4A148C] whitespace-pre-wrap max-h-96 overflow-y-auto font-mono">
                        {thinkingBlocks[idx]}
                      </div>
                    )}
                  </div>
                )}
                <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
                  {isUser ? (
                    <div className="max-w-[75%] p-4 text-[15px] leading-relaxed bg-stratsight-dark text-white rounded-2xl rounded-tr-sm shadow-md">
                      <div dangerouslySetInnerHTML={{ __html: fmt(msg.content) }} />
                    </div>
                  ) : (
                    <div className="flex gap-3 max-w-[85%]">
                      <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md ${agent?.color}`}>{agent?.name.slice(0,2)}</div>
                      <div className="bg-white border-l-4 shadow-sm rounded-2xl rounded-tl-sm p-4 text-[15px] leading-relaxed" style={{ borderLeftColor: agent?.hex }}>
                        <div className="text-xs font-bold tracking-wider mb-2 uppercase" style={{ color: agent?.hex }}>{agent?.name} · {agent?.label}</div>
                        <div className="text-gray-800" dangerouslySetInnerHTML={{ __html: fmt(msg.content) }} />
                        {/* Botões inline */}
                        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                          {user?.role !== 'cliente' ? (
                            <button
                              onClick={() => deletarMensagem(msg.id, idx)}
                              className="text-[10px] uppercase font-bold tracking-wider text-gray-300 hover:text-red-500 transition-colors flex items-center gap-1"
                              title="Remover esta mensagem"
                            >
                              🗑 Excluir
                            </button>
                          ) : <div />}
                          <div className="flex gap-3">
                            <button
                              onClick={() => navigator.clipboard.writeText(msg.content).then(() => {}).catch(() => {})}
                              className="text-[10px] uppercase font-bold tracking-wider text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1"
                              title="Copiar texto"
                            >
                              📋 Copiar
                            </button>
                            <button onClick={() => downloadMarkdown(msg.content)} className="text-[10px] uppercase font-bold tracking-wider text-stratsight-medium hover:text-stratsight-dark transition-colors flex items-center gap-1">
                              ⬇ Markdown
                            </button>
                            <button onClick={() => exportSingleDocx(msg.content)} className="text-[10px] uppercase font-bold tracking-wider text-stratsight-medium hover:text-stratsight-dark transition-colors flex items-center gap-1">
                              ⬇ DOCX
                            </button>
                            <button onClick={() => exportSinglePdf(msg.content)} className="text-[10px] uppercase font-bold tracking-wider text-[#B71C1C] hover:text-red-900 transition-colors flex items-center gap-1">
                              ⬇ PDF
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* ── PAINEL DE INDICADORES KRATOS ─────────────────────────────────────── */}
          {indicadores.length > 0 && (() => {
            const verde    = indicadores.filter((i: any) => i.status === 'verde').length;
            const amarelo  = indicadores.filter((i: any) => i.status === 'amarelo').length;
            const vermelho = indicadores.filter((i: any) => i.status === 'vermelho').length;
            const total    = indicadores.length;
            const sorted   = [...indicadores].sort((a: any, b: any) => {
              const o: Record<string, number> = { vermelho: 0, amarelo: 1, verde: 2 };
              return (o[a.status] ?? 3) - (o[b.status] ?? 3);
            });
            return (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 mx-auto w-full max-w-2xl">
                {/* cabeçalho */}
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold text-[#004D40] uppercase tracking-wider flex items-center gap-2">
                    <span>📡</span> Monitoramento KRATOS
                    <span className="text-[10px] font-normal text-gray-400 normal-case tracking-normal">
                      {total} indicador{total !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  <button onClick={() => carregarIndicadores(sessionId)} className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">↻ Atualizar</button>
                </div>

                {/* barra de proporção */}
                <div className="mb-3">
                  <div className="flex h-2 rounded-full overflow-hidden gap-px mb-1.5">
                    {verde    > 0 && <div className="bg-green-400"  style={{ width: `${(verde/total)*100}%` }} />}
                    {amarelo  > 0 && <div className="bg-yellow-400" style={{ width: `${(amarelo/total)*100}%` }} />}
                    {vermelho > 0 && <div className="bg-red-400"    style={{ width: `${(vermelho/total)*100}%` }} />}
                  </div>
                  <div className="flex gap-3 text-[10px]">
                    {verde    > 0 && <span className="text-green-700  font-semibold">🟢 {verde} verde</span>}
                    {amarelo  > 0 && <span className="text-yellow-700 font-semibold">🟡 {amarelo} amarelo</span>}
                    {vermelho > 0 && <span className="text-red-700    font-semibold">🔴 {vermelho} vermelho</span>}
                  </div>
                </div>

                {/* cards ordenados por severidade */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {sorted.map((ind: any, i: number) => {
                    const sc =
                      ind.status === 'vermelho' ? 'bg-red-50 border-red-300 text-red-800' :
                      ind.status === 'amarelo'  ? 'bg-yellow-50 border-yellow-300 text-yellow-800' :
                                                 'bg-green-50 border-green-300 text-green-800';
                    const dot = ind.status === 'vermelho' ? '🔴' : ind.status === 'amarelo' ? '🟡' : '🟢';
                    const checkedAt = ind.lastCheckedAt
                      ? new Date(ind.lastCheckedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : null;
                    return (
                      <div key={i} className={`border rounded-xl px-3 py-2.5 ${sc} text-xs`}>
                        <div className="font-bold truncate flex items-center gap-1 mb-1">{dot} {ind.name}</div>
                        {ind.lastValue != null && (
                          <div className="font-mono text-[11px] font-semibold">
                            {typeof ind.lastValue === 'number'
                              ? ind.lastValue.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
                              : ind.lastValue}
                          </div>
                        )}
                        {(ind.thresholdYellow || ind.thresholdRed) && (
                          <div className="text-[10px] opacity-60 mt-0.5">
                            {ind.thresholdYellow && `⚠ ${ind.thresholdYellow}`}
                            {ind.thresholdYellow && ind.thresholdRed && ' · '}
                            {ind.thresholdRed && `🔴 ${ind.thresholdRed}`}
                          </div>
                        )}
                        {ind.source    && <div className="text-[10px] opacity-50 truncate mt-0.5">{ind.source}</div>}
                        {checkedAt     && <div className="text-[9px]  opacity-40 mt-0.5">{checkedAt}</div>}
                      </div>
                    );
                  })}
                </div>

                {/* alerta de vermelho */}
                {vermelho > 0 && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700 font-semibold flex items-center gap-1.5">
                    ⚠ {vermelho} indicador{vermelho !== 1 ? 'es' : ''} em alerta — revisar análise KRATOS
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── PAINEL WEAK SIGNALS ──────────────────────────────────────────────── */}
          {weakSignals.length > 0 && (() => {
            const clIcon: Record<string,string> = { confirmavel:'🟢', ambiguo:'🟡', ruido:'🔴' };
            const srColor: Record<string,string> = {
              monitorando:'bg-gray-50 border-gray-200', amplificando:'bg-orange-50 border-orange-300',
              materializado:'bg-red-50 border-red-300', arquivado:'bg-gray-50 border-gray-200 opacity-50'
            };
            const sorted = [...weakSignals].sort((a,b) => {
              const o: Record<string,number> = { amplificando:0, materializado:1, confirmavel:2, ambiguo:3, ruido:4 };
              return (o[a.statusRadar]??5) - (o[b.statusRadar]??5);
            });
            return (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 mx-auto w-full max-w-2xl mt-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold text-[#4527A0] uppercase tracking-wider flex items-center gap-2">
                    <span>📡</span> Radar de Weak Signals
                    {signalStats && (
                      <span className="text-[10px] font-normal text-gray-400 normal-case tracking-normal">
                        {signalStats.total} sinal{signalStats.total !== 1 ? 'is' : ''}
                      </span>
                    )}
                  </div>
                  <button onClick={() => carregarSinais(sessionId)} className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">↻ Atualizar</button>
                </div>
                {/* Estatísticas */}
                {signalStats && (
                  <div className="flex flex-wrap gap-2 mb-3 text-[10px]">
                    {signalStats.confirmavel  > 0 && <span className="bg-green-100 text-green-800 font-semibold px-2 py-0.5 rounded-full">🟢 {signalStats.confirmavel} confirmável</span>}
                    {signalStats.ambiguo      > 0 && <span className="bg-yellow-100 text-yellow-800 font-semibold px-2 py-0.5 rounded-full">🟡 {signalStats.ambiguo} ambíguo</span>}
                    {signalStats.amplificando > 0 && <span className="bg-orange-100 text-orange-800 font-semibold px-2 py-0.5 rounded-full">🟠 {signalStats.amplificando} amplificando</span>}
                    {signalStats.materializado> 0 && <span className="bg-red-100 text-red-800 font-semibold px-2 py-0.5 rounded-full">🔴 {signalStats.materializado} materializado</span>}
                    {signalStats.ruido        > 0 && <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{signalStats.ruido} ruído</span>}
                  </div>
                )}
                {/* Alerta de amplificação */}
                {signalStats?.amplificando > 0 && (
                  <div className="mb-3 p-2 bg-orange-50 border border-orange-300 rounded-lg text-[11px] text-orange-800 font-semibold flex items-center gap-1.5">
                    ⚠️ {signalStats.amplificando} sinal{signalStats.amplificando !== 1 ? 'is' : ''} amplificando — revisar cenário de referência
                  </div>
                )}
                {/* Cards */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {sorted.filter((s:any) => s.statusRadar !== 'arquivado').map((s: any, i: number) => (
                    <div key={i} className={`border rounded-xl px-3 py-2.5 ${srColor[s.statusRadar] || 'bg-gray-50 border-gray-200'} text-xs`}>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <div className="font-bold leading-snug flex items-center gap-1">
                          {clIcon[s.classificacao] || '⚪'} {s.titulo}
                        </div>
                        <span className="shrink-0 text-[9px] uppercase tracking-wide text-gray-400 font-semibold">{s.tipo?.replace('_',' ')}</span>
                      </div>
                      {s.potencialDisruptivo && (
                        <div className="text-[10px] text-gray-600 leading-snug mb-1 line-clamp-2">{s.potencialDisruptivo}</div>
                      )}
                      {/* Sentinelas */}
                      {(s.sentinela1Descricao || s.sentinela2Descricao) && (
                        <div className="flex gap-1.5 mt-1.5">
                          {s.sentinela1Descricao && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${s.sentinela1Status === 'disparado' ? 'bg-red-100 text-red-700' : s.sentinela1Status === 'ativo' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                              S1 {s.sentinela1Status === 'disparado' ? '🔥' : s.sentinela1Status === 'ativo' ? '⚡' : '·'}
                            </span>
                          )}
                          {s.sentinela2Descricao && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${s.sentinela2Status === 'disparado' ? 'bg-red-100 text-red-700' : s.sentinela2Status === 'ativo' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                              S2 {s.sentinela2Status === 'disparado' ? '🔥' : s.sentinela2Status === 'ativo' ? '⚡' : '·'}
                            </span>
                          )}
                        </div>
                      )}
                      {s.janelaAnos && <div className="text-[9px] text-gray-400 mt-1">⏱ {s.janelaAnos} anos · {s.clusterId || 'sem cluster'}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Streaming bubble — tokens chegando em tempo real */}
          {streamingText && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[85%]">
                <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md bg-stratsight-dark">HE</div>
                <div className="bg-white border-l-4 border-stratsight-medium shadow-sm rounded-2xl rounded-tl-sm p-4 text-[15px] leading-relaxed">
                  <div className="text-xs font-bold tracking-wider mb-2 uppercase text-stratsight-medium">HERMES · Orquestrador</div>
                  <div className="text-gray-800" dangerouslySetInnerHTML={{ __html: fmt(streamingText) }} />
                  <span className="inline-block w-0.5 h-4 bg-gray-400 animate-pulse align-middle ml-0.5" />
                </div>
              </div>
            </div>
          )}

          {/* Loading — progresso dinâmico com etapas do raciocínio */}
          {loading && !streamingText && (
            <div className="flex justify-start">
              <div className="bg-white border-l-4 border-stratsight-medium shadow-sm rounded-2xl rounded-tl-sm p-4 min-w-[260px] max-w-[520px]">
                {/* Linha principal: dots + agente */}
                <div className="flex items-center gap-3 text-gray-500 italic text-[15px]">
                  <div className="flex gap-1 shrink-0">
                    <div className="w-2 h-2 rounded-full bg-stratsight-medium animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-stratsight-medium animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 rounded-full bg-stratsight-medium animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                  {progressAgent
                    ? <><span className="font-bold not-italic text-stratsight-dark">{progressAgent}</span>{' '}raciocinando...</>
                    : 'HERMES raciocinando...'}
                </div>
                {/* Log de etapas — aparece conforme os steps chegam */}
                {stepLog.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                    {stepLog.slice(-5).map((step, i) => (
                      <div
                        key={i}
                        className="text-[11px] text-gray-400 font-mono truncate"
                        style={{ opacity: 0.5 + (i / stepLog.slice(-5).length) * 0.5 }}
                      >
                        {step}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </main>

        <footer className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
          {/* Clientes têm acesso somente leitura — sem input de chat */}
          {user?.role === 'cliente' && (
            <div className="max-w-4xl mx-auto text-center text-xs text-gray-400 py-2 border border-gray-100 rounded-xl bg-gray-50">
              Modo leitura · Para solicitar análise, entre em contato com o analista responsável.
            </div>
          )}
          {user?.role !== 'cliente' && messages.length > 0 && (
            <div className="max-w-4xl mx-auto flex flex-wrap gap-2 mb-3">
              {mode === 'production' && (
                <>
                  <button onClick={() => sendMessage('CONFIRMAR')} disabled={loading || extracting} className="px-4 py-1.5 bg-stratsight-light text-stratsight-dark border border-stratsight-medium/30 rounded-full text-[11px] font-bold hover:bg-stratsight-medium/20 transition-colors shadow-sm">▶ Avançar Fase (CONFIRMAR)</button>
                  <button onClick={() => sendMessage('KRATOS')} disabled={loading || extracting} className="px-4 py-1.5 bg-[#004D40]/10 text-[#004D40] border border-[#004D40]/30 rounded-full text-[11px] font-bold hover:bg-[#004D40]/20 transition-colors shadow-sm">📡 Modo Monitoramento (KRATOS)</button>
                </>
              )}
              {mode === 'monitoring' && (
                <>
                  <button onClick={() => sendMessage('NOVA SESSÃO')} disabled={loading || extracting} className="px-4 py-1.5 bg-[#004D40]/10 text-[#004D40] border border-[#004D40]/30 rounded-full text-[11px] font-bold hover:bg-[#004D40]/20 transition-colors shadow-sm">🔄 Nova Coleta (NOVA SESSÃO)</button>
                  <button onClick={() => sendMessage('PRODUÇÃO')} disabled={loading || extracting} className="px-4 py-1.5 bg-stratsight-light text-stratsight-dark border border-stratsight-medium/30 rounded-full text-[11px] font-bold hover:bg-stratsight-medium/20 transition-colors shadow-sm">◀ Voltar à Produção</button>
                </>
              )}
              <button onClick={() => gerarRelatorio('padrao')} disabled={loading || extracting} className="px-4 py-1.5 bg-gray-100 text-gray-700 border border-gray-300 rounded-full text-[11px] font-bold hover:bg-gray-200 transition-colors shadow-sm">📑 Gerar Relatório</button>
            </div>
          )}
          {user?.role !== 'cliente' && (
            <>
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {attachedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-stratsight-light border border-stratsight-medium/30 rounded-full px-3 py-1 text-xs text-stratsight-dark">
                      <span>📎 {f.name}</span>
                      <button onClick={() => removeFile(i)} className="text-stratsight-dark/60 hover:text-stratsight-dark font-bold ml-1">×</button>
                    </div>
                  ))}
                </div>
              )}
              {extracting && <div className="text-xs text-stratsight-medium mb-2 font-bold animate-pulse">⏳ Extraindo dados com OCR/RAG...</div>}
              {fileError && <div className="text-xs text-red-600 mb-2 bg-red-50 p-2 rounded border border-red-100">⚠️ {fileError}</div>}
              <div className="max-w-4xl mx-auto flex gap-3">
                <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} multiple className="hidden" onChange={handleFileChange} />
                <button onClick={() => fileInputRef.current?.click()} disabled={loading || extracting} title="Anexar documento" className={`w-12 h-[50px] rounded-xl border-2 flex items-center justify-center text-lg shrink-0 transition-colors ${attachedFiles.length > 0 ? 'bg-stratsight-light border-stratsight-medium text-stratsight-medium' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-stratsight-medium/50'} ${loading || extracting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                  {extracting ? '⏳' : '📎'}
                </button>
                <input
                  type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:border-stratsight-medium focus:ring-1 focus:ring-stratsight-medium bg-gray-50"
                  placeholder={extracting ? 'Analisando arquivos...' : attachedFiles.length > 0 ? 'Adicione uma instrução ou envie os documentos...' : mode === 'monitoring' ? 'Responda ao KRATOS com atualizações de indicadores...' : 'Digite sua mensagem para o HERMES...'}
                  disabled={loading || extracting}
                />
                <button onClick={sendMessage} disabled={loading || extracting || (!input.trim() && attachedFiles.length === 0)} className="bg-stratsight-dark text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-stratsight-medium transition-colors">Enviar</button>
              </div>
            </>
          )}
        </footer>
      </div>
    </div>

    {/* ── Modal de Revisão Analítica ICD 203 ─────────────────────────────── */}
    {showReviewModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="bg-stratsight-dark text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div>
              <div className="font-bold text-lg">Revisão de Qualidade Analítica</div>
              <div className="text-xs text-gray-300 mt-0.5">Padrão ICD 203 · ODNI 2022 · McMahon 2024</div>
            </div>
            <button onClick={() => setShowReviewModal(false)} className="text-gray-300 hover:text-white text-xl">✕</button>
          </div>

          {analyticReview ? (
            <div className="p-6 space-y-4">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${
                analyticReview.status === 'aprovado' ? 'bg-green-100 text-green-800' :
                analyticReview.status === 'aprovado_com_ressalvas' ? 'bg-yellow-100 text-yellow-800' :
                analyticReview.status === 'requer_revisao' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-600'
              }`}>
                {analyticReview.status === 'aprovado' && '✅ Aprovado'}
                {analyticReview.status === 'aprovado_com_ressalvas' && '⚠️ Aprovado com Ressalvas'}
                {analyticReview.status === 'requer_revisao' && '🔴 Requer Revisão'}
                {analyticReview.status === 'nao_revisado' && '⏳ Não Revisado'}
              </div>

              {analyticReview.atsCompliance && (
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pontuação por Padrão ATS</div>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(analyticReview.atsCompliance).map(([k, v]: any) => (
                      <div key={k} className="text-center bg-gray-50 rounded-lg p-2">
                        <div className="text-lg font-bold text-stratsight-dark">{v}</div>
                        <div className="text-[10px] text-gray-500">{k}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analyticReview.notasRevisor && (
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notas do Revisor</div>
                  <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{analyticReview.notasRevisor}</div>
                </div>
              )}

              {analyticReview.declaracaoPropriedade && (
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Declaração de Propriedade</div>
                  <div className="text-xs text-gray-600 italic bg-blue-50 rounded-lg p-3">{analyticReview.declaracaoPropriedade}</div>
                </div>
              )}

              <div className="text-[10px] text-gray-400">
                Revisado por: {analyticReview.reviewerName || '—'} · {analyticReview.reviewedAt ? new Date(analyticReview.reviewedAt).toLocaleString('pt-BR') : '—'}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setAnalyticReview(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors">Nova Revisão</button>
                <button onClick={() => setShowReviewModal(false)} className="flex-1 bg-stratsight-dark text-white py-2 rounded-xl font-bold hover:bg-stratsight-medium transition-colors">Fechar</button>
              </div>
            </div>
          ) : (
            <ReviewForm
              sessionId={sessionId}
              token={token!}
              userName={user?.name || 'Analista'}
              onSaved={(rev) => { setAnalyticReview(rev); }}
              onClose={() => setShowReviewModal(false)}
            />
          )}
        </div>
      </div>
    )}
    </>
  );
}

// ── Componente ReviewForm ─────────────────────────────────────────────────────
function ReviewForm({ sessionId, token, userName, onSaved, onClose }: {
  sessionId: string;
  token: string;
  userName: string;
  onSaved: (rev: any) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<string>('nao_revisado');
  const [notas, setNotas] = useState('');
  const [declaracao, setDeclaracao] = useState(`Esta análise foi produzida por ${userName} com assistência de IA como ferramenta auxiliar. A responsabilidade analítica é do analista.`);
  const [ats1, setAts1] = useState('');
  const [ats2, setAts2] = useState('');
  const [ats3, setAts3] = useState('');
  const [ats4, setAts4] = useState('');
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    setSaving(true);
    try {
      const atsCompliance: any = {};
      if (ats1) atsCompliance['ATS1-Fontes'] = Number(ats1);
      if (ats2) atsCompliance['ATS2-Probabilidade'] = Number(ats2);
      if (ats3) atsCompliance['ATS3-Julgamento'] = Number(ats3);
      if (ats4) atsCompliance['ATS4-Alternativas'] = Number(ats4);

      const r = await fetch('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          projectId: sessionId,
          status,
          notasRevisor: notas || null,
          declaracaoPropriedade: declaracao || null,
          atsCompliance: Object.keys(atsCompliance).length > 0 ? atsCompliance : null,
        })
      });
      const d = await r.json();
      if (d.ok) onSaved(d.review);
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status da Revisão</label>
        <select value={status} onChange={e => setStatus(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-stratsight-medium">
          <option value="nao_revisado">⏳ Não Revisado</option>
          <option value="aprovado">✅ Aprovado</option>
          <option value="aprovado_com_ressalvas">⚠️ Aprovado com Ressalvas</option>
          <option value="requer_revisao">🔴 Requer Revisão</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pontuação ATS (0–25 cada)</label>
        <div className="grid grid-cols-4 gap-2 mt-1">
          {[['ATS1', 'Fontes', ats1, setAts1], ['ATS2', 'Probabilidade', ats2, setAts2], ['ATS3', 'Julgamento', ats3, setAts3], ['ATS4', 'Alternativas', ats4, setAts4]].map(([id, label, val, setter]: any) => (
            <div key={id} className="text-center">
              <input type="number" min="0" max="25" value={val} onChange={e => setter(e.target.value)} placeholder="—" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:border-stratsight-medium" />
              <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notas do Revisor</label>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={4} placeholder="Não conformidades identificadas, recomendações ao analista..." className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-stratsight-medium resize-none" />
      </div>

      <div>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Declaração de Propriedade</label>
        <textarea value={declaracao} onChange={e => setDeclaracao(e.target.value)} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-stratsight-medium resize-none" />
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors">Cancelar</button>
        <button onClick={salvar} disabled={saving} className="flex-1 bg-stratsight-dark text-white py-2 rounded-xl font-bold hover:bg-stratsight-medium transition-colors disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar Revisão'}
        </button>
      </div>
    </div>
  );
}

export default App;
