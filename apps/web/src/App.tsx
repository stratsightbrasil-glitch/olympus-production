import React, { useRef, useEffect, useMemo, useState } from 'react';
import { AGENTS } from './constants';
import { MessageBubble } from './components/chat/MessageBubble';
import { AgentWorking } from './components/chat/AgentWorking';
import { CommandBar } from './components/layout/CommandBar';
import { Sidebar } from './components/layout/Sidebar';
import { InputZone } from './components/chat/InputZone';
import { RightPanel } from './components/layout/RightPanel';
import { KratosPanel } from './components/layout/KratosPanel';
import { EventsPanel } from './components/layout/EventsPanel';
import { VizStatusBar } from './components/layout/VizStatusBar';
import { HitlDecisionCard } from './components/chat/HitlDecisionCard';
import { LoginPage } from './components/auth/LoginPage';
import { NewSessionModal } from './components/modals/NewSessionModal';
import { ProjectSettingsModal } from './components/modals/ProjectSettingsModal';
import { UsersModal } from './components/modals/UsersModal';
import { BackupModal } from './components/modals/BackupModal';
import { AuditModal } from './components/modals/AuditModal';
import { ReviewModal } from './components/modals/ReviewModal';
import { getMethodologySteps, STEP_DETECTION_PATTERNS } from './data/methodologySteps';
import { useAuth } from './hooks/useAuth';
import { useSessionManager } from './hooks/useSessionManager';
import { useProjectState } from './hooks/useProjectState';
import { useProjectData } from './hooks/useProjectData';
import { useLlmConfig } from './hooks/useLlmConfig';
import { useAttachments, ACCEPTED_TYPES } from './hooks/useAttachments';
import { useChat } from './hooks/useChat';
import { useExport } from './hooks/useExport';
import { useEvents } from './hooks/useEvents';
import type { ActiveModal } from './types';

// Slugs das metodologias Bloco A disponíveis no banco (Olympus 1.0).
// msef · macroplan · futures · asplan foram removidas no seed do Olympus 1.0.
const ATHENA_SLUGS = new Set([
  'grumbach',      // ← CASO DE VALIDAÇÃO — phase configs implementados
  'ceeex', 'esg', 'godet', 'gbn', 'alta', 'ipea_buarque', 'mpo', 'siex',
]);

function App() {
  const auth = useAuth();
  const { token, user, logout } = auth;

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [mainView, setMainView] = useState<'chat' | 'kratos'>('chat');
  const [mode, setMode] = useState('production');
  const [cacheStatus, setCacheStatus] = useState<{
    entries: number; oldestEntryAt: string | null; ttlSeconds: number;
    phaseConfigs: { entries: number; slugs: string[]; oldestEntryAt: string | null; ttlSeconds: number };
  } | null>(null);
  const [vizMode, setVizMode] = useState('etapa');
  const [reportLayout, setReportLayout] = useState<'standard' | 'extended'>('standard');
  const handleReportLayoutChange = (layout: 'standard' | 'extended') => {
    setReportLayout(layout);
    if (projectState?.sessionId) localStorage.setItem(`reportLayout:${projectState.sessionId}`, layout);
  };
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const [methodologies, setMethodologies] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);

  const reqHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  // ── Domain hooks ──────────────────────────────────────────────────────────
  const sessions = useSessionManager(token);
  const projectData = useProjectData(token);
  const llm = useLlmConfig(token);
  const attachments = useAttachments(token);

  const projectState = useProjectState({
    token,
    onSessionLoaded: (id, msgs) => { chat.setMessages(msgs); sessions.setShowSessoes(false); },
    onSessionsRefresh: sessions.carregarSessoes,
    onIndicatorsRefresh: projectData.carregarIndicadores,
    onSignalsRefresh: projectData.carregarSinais,
    onReviewRefresh: projectData.carregarRevisao,
  });

  const chat = useChat({
    token,
    sessionId: projectState.sessionId,
    projeto: projectState.projeto,
    vizMode,
    reportLayout,
    onIndicatorsRefresh: projectData.carregarIndicadores,
    onSignalsRefresh: projectData.carregarSinais,
    onSessionsRefresh: sessions.carregarSessoes,
  });

  const exports = useExport(token, projectState.projeto, chat.messages);
  const events = useEvents(token);

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat.messages, chat.loading]);

  // Recarrega eventos propostos quando a sessão muda ou quando o chat finaliza
  useEffect(() => {
    if (projectState.sessionId) events.carregarEventos(projectState.sessionId);
  }, [projectState.sessionId, chat.loading]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/engine/methodologies', { headers: reqHeaders })
      .then(r => r.ok ? r.json() : [])
      .then(d => setMethodologies(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch('/api/v1/teams', { headers: reqHeaders })
      .then(r => r.ok ? r.json() : [])
      .then(d => setTeams(Array.isArray(d) ? d : []))
      .catch(() => {});
    sessions.carregarSessoes();
  }, [token]);

  // Carrega reportLayout persistido por projeto ao mudar de sessão
  useEffect(() => {
    if (!projectState?.sessionId) return;
    const saved = localStorage.getItem(`reportLayout:${projectState.sessionId}`) as 'standard' | 'extended' | null;
    if (saved) setReportLayout(saved);
    else setReportLayout('standard');
  }, [projectState?.sessionId]);

  // Verifica interrupt pendente no checkpointer ao carregar/mudar de sessão.
  // Restaura hitlGate sem precisar iniciar nova análise (projeto pausado na sidebar).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!projectState.sessionId || !token) return;
    const checkInterrupt = async () => {
      try {
        const res = await fetch(
          `/api/v1/chat/status/${projectState.sessionId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'interrupted') {
          chat.setHitlGate({
            message:       data.message,
            agent:         data.agent,
            projectId:     data.projectId,
            interruptType: data.interruptType,
            output:        undefined,
          });
        }
      } catch { /* silencioso — não bloqueia carregamento */ }
    };
    checkInterrupt();
  }, [projectState.sessionId]);

  // Polling do status do cache de metodologias — apenas para admin, a cada 30s
  useEffect(() => {
    if (!token || user?.role !== 'admin') return;
    const fetchStatus = () =>
      fetch('/api/v1/settings/cache/status', { headers: reqHeaders })
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setCacheStatus(d))
        .catch(() => {});
    fetchStatus();
    const interval = setInterval(fetchStatus, 300_000); // 5 min — alinhado ao TTL dos caches
    return () => clearInterval(interval);
  }, [token, user?.role]);

  const handleInvalidateCache = async () => {
    await fetch('/api/v1/settings/cache/invalidate', { method: 'POST', headers: reqHeaders });
    setCacheStatus(prev => prev ? { ...prev, entries: 0, oldestEntryAt: null } : null);
  };

  // ── Derived values ───────────────────────────────────────────────────────
  const cenariosMethodologies = useMemo(
    () => methodologies.filter(m => ATHENA_SLUGS.has((m.slug ?? '').toLowerCase())),
    [methodologies],
  );

  const currentTeamName = useMemo(
    () => teams.find(t => t.id === projectState.projeto.teamId)?.name,
    [projectState.projeto.teamId, teams],
  );

  const currentMethodologySteps = useMemo(
    () => getMethodologySteps(projectState.projeto.metodologia, methodologies),
    [projectState.projeto.metodologia, methodologies],
  );

  const messageCount = chat.messages.length;

  // currentPhaseNum (do SSE 'athena'/'hitl_gate') é a fonte autoritativa — evita
  // false-positives do scan de mensagens quando todas as fases usam o mesmo agente
  // (ex: Grumbach fase 1-8 = KLIO → qualquer mensagem com "KLIO" mapeava para fase 8).
  // Fallback: scan de mensagens para sessões antigas sem currentPhaseNum rastreado.
  const currentStep = useMemo(() => {
    if (chat.currentPhaseNum > 0) return chat.currentPhaseNum;
    // Fallback: scan reverso de mensagens (legado — impreciso para metodologias
    // onde múltiplas fases compartilham o mesmo agente)
    for (let i = currentMethodologySteps.length - 1; i >= 0; i--) {
      const agent = currentMethodologySteps[i].agent;
      const patterns = STEP_DETECTION_PATTERNS[agent] ?? [];
      const found = chat.messages.some(m => {
        if (m.role !== 'assistant') return false;
        const c = typeof m.content === 'string' ? m.content : '';
        if (c.includes(`${agent} ·`) || c.includes(`**${agent}**`)) return true;
        return patterns.some(re => re.test(c));
      });
      if (found) return i + 1;
    }
    return messageCount > 0 ? 1 : 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.currentPhaseNum, messageCount, currentMethodologySteps]);

  // Detecta quando o motor aguarda confirmação do analista.
  // Olympus 1.0: hitlGate é a fonte primária — evita scan de mensagens durante streaming.
  // O branch legado (scan de texto) só executa quando hitlGate é null E vizMode=passos
  // E loading=false — i.e., nunca durante streaming (chat.loading=true nesse período).
  const isWaiting = useMemo(() => {
    if (chat.loading) return false;

    // LangGraph interrupts — caminho principal (sem scan de mensagens)
    //
    // hitl_required: EventsPanel "▶ Continuar" é o control primário.
    //   HitlDecisionCard NÃO aparece — o analista revisa eventos e clica ▶ Continuar.
    //
    // phase_complete: HitlDecisionCard é o control primário (Confirmar/Redirecionar).
    //   EventsPanel mostra eventos propostos para aprovação, mas sem "▶ Continuar".
    if (chat.hitlGate?.interruptType === 'hitl_required') return false;
    if (chat.hitlGate?.interruptType === 'phase_complete') return vizMode === 'etapa' || vizMode === 'passos';

    // Legado: scan da última mensagem de assistente. Limitado à última mensagem
    // (não scan completo) para O(1) em vez de O(N).
    if (vizMode === 'passos' && messageCount > 0) {
      for (let i = chat.messages.length - 1; i >= 0; i--) {
        const msg = chat.messages[i];
        if (msg.role !== 'assistant') continue;
        const c = typeof msg.content === 'string' ? msg.content : '';
        return c.includes('Confirme para prosseguir') || c.includes('Oriente com ajustes');
      }
    }

    return false;
  // messageCount (primitivo) em vez de chat.messages (referência) — evita re-run
  // a cada token de streaming que recria o array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vizMode, chat.loading, messageCount, chat.hitlGate]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getAgentInfo = (text: string) => {
    const foundKey = Object.keys(AGENTS).find(key => text.includes(`${key} ·`) || text.includes(`**${key}**`));
    return foundKey ? { name: foundKey, ...AGENTS[foundKey] } : { name: 'ATHENA', ...AGENTS.ATHENA };
  };

  const openNewSession = () => {
    // Default: grumbach (único com PHASE_CONFIGS implementados em Olympus 1.0).
    // Nunca usar 'MSEF' — removida do banco no seed do Olympus 1.0.
    projectState.setProjeto(p => ({ ...p, metodologia: 'grumbach' }));
    setActiveModal('newSession');
  };

  const handleStartSession = async (opts: Parameters<typeof NewSessionModal>[0]['onStart'] extends (o: infer O) => void ? O : never) => {
    setActiveModal(null);

    const { scopeForm, scopeFiles, selectedTeamId, metodologia, vizMode: newVizMode } = opts;
    const campos: string[] = [];
    if (scopeForm.tema)                campos.push(`Tema / Objeto de Análise: ${scopeForm.tema}`);
    if (scopeForm.horizonte)           campos.push(`Horizonte Temporal: ${scopeForm.horizonte}`);
    if (scopeForm.elaborador)          campos.push(`Equipe / Quem Elabora: ${scopeForm.elaborador}`);
    if (scopeForm.cliente)             campos.push(`Usuário / Cliente: ${scopeForm.cliente}`);
    if (scopeForm.questaoEstrategica)  campos.push(`Questão Estratégica Central: ${scopeForm.questaoEstrategica}`);
    if (scopeForm.mudancaIdentificada) campos.push(`Mudança Específica Já Identificada: ${scopeForm.mudancaIdentificada}`);

    const fileContext = scopeFiles.length > 0
      ? '\n\n' + scopeFiles.map(f => `--- DOCUMENTO DE CONTEXTO: ${f.name} ---\n${f.text}\n--- FIM DO DOCUMENTO ---`).join('\n\n')
      : '';
    const instrucaoExtra = scopeForm.instrucoes?.trim() ? `\n\nInstruções adicionais do usuário: ${scopeForm.instrucoes.trim()}` : '';

    const nome = scopeForm.tema || 'Nova Análise';
    const newSessionId = `sess_${Date.now()}`;

    projectState.setProjeto(p => ({ ...p, nome, ...scopeForm, metodologia }));
    projectState.setSessionId(newSessionId);
    setVizMode(newVizMode);
    setMainView('chat');

    const initMsg = campos.length > 0
      ? `Iniciar\n\nDados de escopo fornecidos pelo usuário:\n${campos.map(c => `- ${c}`).join('\n')}${fileContext}${instrucaoExtra}\n\nNão solicite essas informações novamente. Confirme o recebimento, apresente as etapas da metodologia e pergunte por onde iniciamos.`
      : `Iniciar${instrucaoExtra}`;

    await chat.iniciarSessao({ newSessionId, initMsg, nome, metodologia, selectedTeamId, onDone: () => {} });
  };

  /**
   * Inicia a análise no projeto ATIVO já carregado — sem abrir modal, sem gerar novo ID.
   * Usado pelo botão "Iniciar análise" quando um projeto já está selecionado no histórico.
   * Diferente de handleStartSession (que cria nova sessão via modal).
   */
  const handleIniciarAnalise = async () => {
    setMainView('chat');
    // Inclui nome do projeto no initMsg para que KLIO saiba exatamente o que analisar.
    // Sem isso, KLIO pode derivar o tema de eventos residuais de análises anteriores.
    const { nome, metodologia, horizonte, cliente, questaoEstrategica } = projectState.projeto;
    const campos: string[] = [`Projeto: "${nome || 'Análise'}"`];
    if (metodologia) campos.push(`Metodologia: ${metodologia}`);
    if (horizonte)   campos.push(`Horizonte temporal: ${horizonte}`);
    if (cliente)     campos.push(`Cliente: ${cliente}`);
    if (questaoEstrategica) campos.push(`Questão estratégica: ${questaoEstrategica}`);
    const initMsg = `Iniciar\n\n${campos.join('\n')}`;

    await chat.iniciarSessao({
      newSessionId:   projectState.sessionId,
      initMsg,
      nome:           nome || 'Análise',
      metodologia,
      selectedTeamId: projectState.projeto.teamId || '',
      onDone:         () => {},
    });
  };

  const handleKratosMode = () => {
    setMode('monitoring');
    if (!projectState.projeto.nome || chat.messages.length < 3) {
      setSidebarOpen(true);
      sessions.setShowSessoes(true);
      sessions.carregarSessoes();
    }
  };

  const openPainel = () => {
    if (!projectState.projeto.nome || projectState.projeto.nome === 'Nova Análise' || chat.messages.length < 3) {
      handleKratosMode();
      chat.sendMessage('Para visualizar o Painel KRATOS, carregue um projeto com cenários já definidos.');
      return;
    }
    const kratosMsg = chat.messages.filter(m => m.role === 'assistant' && typeof m.content === 'string' && m.content.toUpperCase().includes('KRATOS')).slice(-1)[0];
    const dados = { projeto: projectState.projeto, cenario: 'Aguardando avaliação KRATOS', status: 'verde', indicadores: [], geradoEm: new Date().toLocaleString('pt-BR') };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(dados))));
    window.open(`/api/v1/painel?d=${encoded}`, '_blank');
  };

  const copyClientLink = () => {
    const url = `${window.location.origin}/api/v1/painel/project/${projectState.sessionId}?token=${token}`;
    navigator.clipboard.writeText(url)
      .then(() => alert('✅ Link do cliente copiado!\n\nCompartilhe este link com o cliente para acesso ao Painel de Monitoramento.'))
      .catch(() => prompt('Copie o link abaixo:', url));
  };

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!token) return <LoginPage auth={auth} />;

  // ── Main application ──────────────────────────────────────────────────────
  return (
    <>
    <div className="flex h-screen font-sans bg-[#F0F4F0] overflow-hidden">

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {activeModal === 'newSession' && (
        <NewSessionModal
          onClose={() => setActiveModal(null)}
          onStart={handleStartSession}
          cenariosMethodologies={cenariosMethodologies}
          teams={teams}
          token={token}
          defaultMetodologia={projectState.projeto.metodologia}
          defaultVizMode={vizMode}
        />
      )}
      {activeModal === 'settings' && (
        <ProjectSettingsModal
          projeto={projectState.projeto}
          cenariosMethodologies={cenariosMethodologies}
          onClose={() => setActiveModal(null)}
          onSave={() => projectState.salvarConfiguracoes(() => setActiveModal(null))}
          onProjetoChange={projectState.setProjeto}
          onEnviarRelatorio={() => projectState.enviarRelatorioKratos()}
        />
      )}
      {activeModal === 'users'  && <UsersModal  onClose={() => setActiveModal(null)} reqHeaders={reqHeaders} />}
      {activeModal === 'backup' && <BackupModal onClose={() => setActiveModal(null)} reqHeaders={reqHeaders} />}
      {activeModal === 'audit'  && <AuditModal  onClose={() => setActiveModal(null)} reqHeaders={reqHeaders} />}
      {activeModal === 'review' && (
        <ReviewModal
          sessionId={projectState.sessionId}
          token={token}
          userName={user?.name || 'Analista'}
          review={projectData.analyticReview}
          onClose={() => setActiveModal(null)}
          onSaved={projectData.setAnalyticReview}
          onClearReview={() => projectData.setAnalyticReview(null)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <Sidebar
        open={sidebarOpen}
        user={user}
        projeto={projectState.projeto}
        sessoes={sessions.sessoes}
        showSessoes={sessions.showSessoes}
        sessionSearch={sessions.sessionSearch}
        filterStatus={sessions.filterStatus}
        analyticReview={projectData.analyticReview as any}
        sessionId={projectState.sessionId}
        exportingPdf={exports.exportingPdf}
        currentMsefStep={currentStep}
        currentStep={currentStep}
        methodologySteps={currentMethodologySteps}
        mode={mode}
        vizMode={vizMode}
        onModeChange={setMode}
        onVizModeChange={setVizMode}
        onNovaSessao={openNewSession}
        onIniciarAnalise={handleIniciarAnalise}
        onOpenPainel={openPainel}
        onGerarRelatorioKratos={chat.gerarRelatorioKratos}
        onShowUsers={() => setActiveModal('users')}
        onShowBackup={() => setActiveModal('backup')}
        onShowAudit={() => setActiveModal('audit')}
        onCopyClientLink={copyClientLink}
        onShowReviewModal={() => setActiveModal('review')}
        onGerarRelatorioPadrao={() => exports.gerarRelatorio('padrao')}
        onGerarRelatorioEstendido={() => exports.gerarRelatorio('estendido')}
        onShowSettings={() => setActiveModal('settings')}
        onToggleSessoes={sessions.toggleSessoes}
        onSessionSearchChange={sessions.setSessionSearch}
        onFilterChange={sessions.updateFilter}
        onCarregarSessao={projectState.carregarSessao}
        onDeletarSessao={sessions.deletarSessao}
        onLogout={() => { logout(); chat.setMessages([]); sessions.setSessoes([]); }}
      />

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <CommandBar
          mode={mode}
          projetoNome={projectState.projeto.nome}
          progressAgent={chat.progressAgent}
          streamingText={chat.streamingText}
          currentStep={currentStep}
          user={user}
          mainView={mainView}
          onToggleKratos={() => setMainView(v => v === 'kratos' ? 'chat' : 'kratos')}
          onToggleSidebar={() => setSidebarOpen(s => !s)}
          onNovaSessao={openNewSession}
          onGerarRelatorio={() => exports.gerarRelatorio('padrao')}
          onGerarPlaybook={user?.role === 'admin' ? exports.gerarPlaybook : undefined}
          onCopyClientLink={copyClientLink}
          cliente={projectState.projeto.cliente}
          horizonte={projectState.projeto.horizonte}
          questaoEstrategica={projectState.projeto.questaoEstrategica}
          teamName={currentTeamName}
          methodologyName={projectState.projeto.metodologia || 'grumbach'}
          methodologySteps={currentMethodologySteps}
          llmConfig={llm.llmConfig}
          anthropicModels={llm.anthropicModels}
          googleModels={llm.googleModels}
          deepseekModels={llm.deepseekModels}
          ollamaModels={llm.ollamaModels}
          ollamaAvailable={llm.ollamaAvailable}
          onLlmChange={user?.role === 'admin' ? llm.handleLlmChange : undefined}
          llmTiers={llm.llmTiers}
          onTierChange={user?.role === 'admin' ? llm.handleTierChange : undefined}
          cacheStatus={user?.role === 'admin' ? cacheStatus : undefined}
          onInvalidateCache={user?.role === 'admin' ? handleInvalidateCache : undefined}
          reportLayout={reportLayout}
          onReportLayoutChange={handleReportLayoutChange}
        />

        {projectState.sessionId && mainView === 'chat' && (
          <VizStatusBar
            vizMode={vizMode}
            isWaiting={isWaiting}
            activeAgent={chat.progressAgent}
            currentStep={currentStep}
            totalSteps={currentMethodologySteps.length}
            methodologyName={projectState.projeto.metodologia || 'grumbach'}
          />
        )}

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {mainView === 'kratos' && projectState.sessionId && (
            <KratosPanel
              sessionId={projectState.sessionId}
              reqHeaders={reqHeaders}
              onRunKratos={() => { setMainView('chat'); chat.gerarRelatorioKratos(); }}
              onSettings={() => setActiveModal('settings')}
            />
          )}

          {mainView === 'chat' && (
            <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {chat.messages.length === 0 && !chat.loading && (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-full bg-stratsight-dark/10 border-2 border-stratsight-medium/20 flex items-center justify-center text-4xl mb-6 shadow-inner">⚡</div>
                  <h2 className="text-xl font-bold text-stratsight-dark mb-3 tracking-wide">OLYMPUS v2.0</h2>
                  <p className="text-stratsight-medium text-sm max-w-md leading-relaxed mb-8">
                    {user?.role === 'cliente'
                      ? <>Bem-vindo ao painel de acompanhamento.<br/>Selecione um projeto no <strong>Histórico</strong> para visualizar os cenários e indicadores.</>
                      : <>Nossa equipe lhe dá as boas-vindas.<br/>Abra um dos projetos no <strong>Histórico</strong> ou inicie uma nova análise clicando em <strong>Nova Sessão</strong>.</>
                    }
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => { sessions.setShowSessoes(true); setSidebarOpen(true); sessions.carregarSessoes(); }} className="px-5 py-2.5 border-2 border-stratsight-medium text-stratsight-dark font-bold rounded-xl hover:bg-stratsight-light transition-colors text-sm">📂 Histórico de Análises</button>
                    {user?.role !== 'cliente' && (
                      <button onClick={openNewSession} className="px-5 py-2.5 bg-stratsight-dark text-white font-bold rounded-xl hover:bg-stratsight-medium transition-colors shadow-lg shadow-green-900/20 text-sm">🔄 Nova Sessão</button>
                    )}
                  </div>
                </div>
              )}

              {chat.messages.map((msg, idx) => {
                if (msg.role === 'user' && typeof msg.content === 'string' && msg.content.startsWith('Iniciar')) return null;
                // Preferir msg.agentName (definido pelo SSE hitl_gate) sobre detecção por conteúdo.
                // getAgentInfo(content) é frágil: se o output do KLIO mencionar "HERMES",
                // HERMES ganha porque está primeiro em AGENTS. msg.agentName é canônico.
                const agent = msg.role === 'assistant'
                  ? (msg.agentName && AGENTS[msg.agentName]
                      ? { name: msg.agentName, ...AGENTS[msg.agentName] }
                      : getAgentInfo(typeof msg.content === 'string' ? msg.content : ''))
                  : null;
                return (
                  <MessageBubble
                    key={idx}
                    role={msg.role as 'user' | 'assistant'}
                    content={typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                    idx={idx}
                    agentName={agent?.name || 'ATHENA'}
                    agentLabel={agent?.label || 'Sistema'}
                    agentHex={agent?.hex || '#1B3A2D'}
                    thinkingContent={chat.thinkingBlocks[idx]}
                    thinkingOpen={!!chat.thinkingOpen[idx]}
                    onToggleThinking={() => chat.toggleThinking(idx)}
                    userRole={user?.role}
                    onDelete={() => chat.deletarMensagem(msg.id, idx)}
                    onCopy={() => navigator.clipboard.writeText(typeof msg.content === 'string' ? msg.content : '').catch(() => {})}
                    onExportMd={() => exports.downloadMarkdown(typeof msg.content === 'string' ? msg.content : '')}
                    onExportDocx={() => exports.exportSingleDocx(typeof msg.content === 'string' ? msg.content : '')}
                    onExportPdf={() => exports.exportSinglePdf(typeof msg.content === 'string' ? msg.content : '')}
                  />
                );
              })}

              {chat.streamingText && (() => {
                const streamAgent = chat.progressAgent && AGENTS[chat.progressAgent]
                  ? { name: chat.progressAgent, ...AGENTS[chat.progressAgent] }
                  : { name: 'KLIO', ...AGENTS.KLIO };
                return (
                  <MessageBubble role="assistant" content={chat.streamingText} idx={-1}
                    agentName={streamAgent.name} agentLabel={streamAgent.label} agentHex={streamAgent.hex}
                    isStreaming />
                );
              })()}
              {chat.loading && !chat.streamingText && (
                <AgentWorking progressAgent={chat.progressAgent} stepLog={chat.stepLog} />
              )}
              <div ref={bottomRef} />
            </main>
          )}

          {mainView === 'chat' && (
            <>
              <EventsPanel
                proposedEvents={events.proposedEvents}
                loading={events.loading}
                onApprove={events.aprovarEvento}
                onReject={events.rejeitarEvento}
                onAprovarTodos={events.aprovarTodos}
                onRefresh={() => events.carregarEventos(projectState.sessionId)}
                hitlGate={chat.hitlGate}
                onResume={chat.resumeGraph}
              />
              <RightPanel
                projeto={projectState.projeto}
                indicadores={projectData.indicadores}
                weakSignals={projectData.weakSignals}
                signalStats={projectData.signalStats}
                onRefreshIndicators={() => projectData.carregarIndicadores(projectState.sessionId)}
                onRefreshSignals={() => projectData.carregarSinais(projectState.sessionId)}
                projectId={projectState.sessionId}
                token={token}
                currentPhaseNum={chat.currentPhaseNum}
              />
            </>
          )}
        </div>

        {mainView === 'chat' && isWaiting && (
          <HitlDecisionCard
            onConfirm={() => {
              // Olympus 1.0: TODOS os interrupts (phase_complete e hitl_required)
              // usam resumeGraph → Command({resume}) → isResuming=true.
              // O branch legado ('CONFIRMAR' via sendMessage) foi removido — em v5
              // não há mais HERMES como orquestrador aguardando texto.
              chat.resumeGraph();
              setInput('');
            }}
            onRedirect={(instruction) => {
              chat.resumeGraph(instruction);
              setInput('');
            }}
          />
        )}

        {mainView === 'chat' && (
          <InputZone
            userRole={user?.role}
            mode={mode}
            hasMessages={chat.messages.length > 0}
            input={input}
            loading={chat.loading}
            extracting={attachments.extracting}
            fileError={attachments.fileError}
            attachedFiles={attachments.attachedFiles}
            acceptedTypes={ACCEPTED_TYPES}
            metodologia={projectState.projeto.metodologia}
            onInputChange={setInput}
            onSend={() => { chat.sendMessage(input, attachments.attachedFiles, attachments.clearFiles); setInput(''); }}
            onQuickSend={cmd => chat.sendMessage(cmd, [], undefined)}
            onRemoveFile={attachments.removeFile}
            onFileChange={attachments.handleFileChange}
            onGerarRelatorio={() => exports.gerarRelatorio('padrao')}
            onExportEstimativa={exports.exportEstimativa}
          />
        )}
      </div>
    </div>
    </>
  );
}

export default App;
