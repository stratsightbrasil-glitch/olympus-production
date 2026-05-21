import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AGENTS } from './constants';
import { MessageBubble } from './components/chat/MessageBubble';
import { AgentWorking } from './components/chat/AgentWorking';
import { Topbar } from './components/layout/Topbar';
import { Sidebar } from './components/layout/Sidebar';
import { InfoBar } from './components/layout/InfoBar';
import { InputZone } from './components/chat/InputZone';
import { RightPanel } from './components/layout/RightPanel';

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

// fmt moved to src/lib/fmt.ts — imported above

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

  // ── MSEF step derivado das mensagens ──────────────────────────────────────────
  const MSEF_AGENT_ORDER = ['SCOPUS', 'KLIO', 'PYTHIA', 'MNEMOSYNE', 'THEMIS'];
  const currentMsefStep = useMemo(() => {
    for (let i = MSEF_AGENT_ORDER.length - 1; i >= 0; i--) {
      const agent = MSEF_AGENT_ORDER[i];
      if (messages.some(m => m.role === 'assistant' && (m.content.includes(`${agent} ·`) || m.content.includes(`**${agent}**`)))) {
        return i + 1;
      }
    }
    return messages.length > 0 ? 1 : 0;
  }, [messages]);

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
      <Sidebar
        open={sidebarOpen}
        user={user}
        projeto={projeto}
        sessoes={sessoes}
        showSessoes={showSessoes}
        sessionSearch={sessionSearch}
        filterStatus={filterStatus}
        analyticReview={analyticReview}
        sessionId={sessionId}
        exportingPdf={exportingPdf}
        currentMsefStep={currentMsefStep}
        mode={mode}
        vizMode={vizMode}
        onModeChange={m => setMode(m)}
        onVizModeChange={v => setVizMode(v)}
        onNovaSessao={() => {
          setScopeForm({ tema: '', horizonte: '', elaborador: '', cliente: '', questaoEstrategica: '', mudancaIdentificada: '' });
          setScopeFiles([]);
          setProjeto(p => ({ ...p, metodologia: 'MSEF' }));
          setShowNovaSessaoModal(true);
        }}
        onOpenPainel={openPainel}
        onGerarRelatorioKratos={gerarRelatorioKratos}
        onShowUsers={() => setShowUsersModal(true)}
        onShowBackup={() => setShowBackupModal(true)}
        onCopyClientLink={() => {
          const url = `${window.location.origin}/api/v1/painel/project/${sessionId}?token=${token}`;
          navigator.clipboard.writeText(url).then(() => {
            alert('✅ Link do cliente copiado!\n\nCompartilhe este link com o cliente para acesso ao Painel de Monitoramento.');
          }).catch(() => { prompt('Copie o link abaixo:', url); });
        }}
        onShowReviewModal={() => setShowReviewModal(true)}
        onGerarRelatorioPadrao={() => gerarRelatorio('padrao')}
        onGerarRelatorioEstendido={() => gerarRelatorio('estendido')}
        onShowSettings={() => setShowSettingsModal(true)}
        onToggleSessoes={() => { setShowSessoes(s => !s); if (!showSessoes) carregarSessoes(); }}
        onSessionSearchChange={v => setSessionSearch(v)}
        onFilterChange={(key, value) => setFilterStatus(f => ({ ...f, [key]: value }))}
        onCarregarSessao={carregarSessao}
        onDeletarSessao={deletarSessao}
        onLogout={() => {
          localStorage.removeItem('olympus_token');
          localStorage.removeItem('olympus_user');
          setToken(null);
          setUser(null);
          setMessages([]);
          setSessoes([]);
        }}
      />

      {/* ── CONTEÚDO PRINCIPAL ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Topbar
          mode={mode}
          projetoNome={projeto.nome}
          progressAgent={progressAgent}
          streamingText={streamingText}
          currentMsefStep={currentMsefStep}
          user={user}
          onToggleSidebar={() => setSidebarOpen(s => !s)}
          onNovaSessao={() => {
            setScopeForm({ tema: '', horizonte: '', elaborador: '', cliente: '', questaoEstrategica: '', mudancaIdentificada: '' });
            setScopeFiles([]);
            setProjeto(p => ({ ...p, metodologia: 'MSEF' }));
            setShowNovaSessaoModal(true);
          }}
          onGerarRelatorio={() => gerarRelatorio('padrao')}
          onCopyClientLink={() => {
            const url = `${window.location.origin}/api/v1/painel/project/${sessionId}?token=${token}`;
            navigator.clipboard.writeText(url).then(() => {
              alert('✅ Link do cliente copiado!\n\nCompartilhe este link com o cliente para acesso ao Painel de Monitoramento.');
            }).catch(() => { prompt('Copie o link abaixo:', url); });
          }}
        />
        <InfoBar
          projetoNome={projeto.nome}
          cliente={projeto.cliente}
          horizonte={projeto.horizonte}
          questaoEstrategica={projeto.questaoEstrategica}
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
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
            const agent = msg.role === 'assistant' ? getAgentInfo(msg.content) : null;
            return (
              <MessageBubble
                key={idx}
                role={msg.role as 'user' | 'assistant'}
                content={msg.content}
                idx={idx}
                agentName={agent?.name || 'ATHENA'}
                agentLabel={agent?.label || 'Sistema'}
                agentHex={agent?.hex || '#1B3A2D'}
                thinkingContent={thinkingBlocks[idx]}
                thinkingOpen={!!thinkingOpen[idx]}
                onToggleThinking={() => setThinkingOpen(prev => ({ ...prev, [idx]: !prev[idx] }))}
                userRole={user?.role}
                onDelete={() => deletarMensagem(msg.id, idx)}
                onCopy={() => navigator.clipboard.writeText(msg.content).catch(() => {})}
                onExportMd={() => downloadMarkdown(msg.content)}
                onExportDocx={() => exportSingleDocx(msg.content)}
                onExportPdf={() => exportSinglePdf(msg.content)}
              />
            );
          })}


          {/* Streaming bubble — tokens chegando em tempo real */}
          {streamingText && (
            <MessageBubble
              role="assistant"
              content={streamingText}
              idx={-1}
              agentName="HERMES"
              agentLabel="Orquestrador"
              agentHex="#1B3A2D"
              isStreaming
            />
          )}

          {/* Loading — progresso dinâmico com etapas do raciocínio */}
          {loading && !streamingText && (
            <AgentWorking progressAgent={progressAgent} stepLog={stepLog} />
          )}
          <div ref={bottomRef} />
        </main>

        <RightPanel
          projeto={projeto}
          indicadores={indicadores}
          weakSignals={weakSignals}
          signalStats={signalStats}
          onRefreshIndicators={() => carregarIndicadores(sessionId)}
          onRefreshSignals={() => carregarSinais(sessionId)}
        />
        </div>

        <InputZone
          userRole={user?.role}
          mode={mode}
          hasMessages={messages.length > 0}
          input={input}
          loading={loading}
          extracting={extracting}
          fileError={fileError}
          attachedFiles={attachedFiles}
          acceptedTypes={ACCEPTED_TYPES}
          onInputChange={v => setInput(v)}
          onSend={sendMessage}
          onQuickSend={cmd => sendMessage(cmd)}
          onRemoveFile={removeFile}
          onFileChange={handleFileChange}
          onGerarRelatorio={() => gerarRelatorio('padrao')}
        />
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
