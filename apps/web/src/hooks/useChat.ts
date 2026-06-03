import { useState, useRef, useCallback } from 'react';
import type { Message, Projeto, AttachedFile } from '../types';

type DonePayload = { text: string; agentName: string; thinking: string; messageType: string };

interface UseChatProps {
  token: string | null;
  sessionId: string;
  projeto: Projeto;
  vizMode: string;
  reportLayout: 'standard' | 'extended';
  onIndicatorsRefresh: (id: string) => void;
  onSignalsRefresh: (id: string) => void;
  onSessionsRefresh: () => void;
}

export function useChat({
  token,
  sessionId,
  projeto,
  vizMode,
  reportLayout,
  onIndicatorsRefresh,
  onSignalsRefresh,
  onSessionsRefresh,
}: UseChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressAgent, setProgressAgent] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [stepLog, setStepLog] = useState<string[]>([]);
  const [thinkingBlocks, setThinkingBlocks] = useState<Record<number, string>>({});
  const [thinkingOpen, setThinkingOpen] = useState<Record<number, boolean>>({});

  // ── HITL gate — ativado quando /stream/graph emite hitl_gate ──
  // interruptType distingue os dois casos:
  //   'hitl_required'  → PYTHIA aguarda aprovação de eventos (EventsPanel)
  //   'phase_complete' → fase especialista concluída em passos (HitlDecisionCard)
  const [hitlGate, setHitlGate] = useState<{
    message:       string;
    agent:         string;
    projectId:     string;
    interruptType: string;
    output?:       string;
  } | null>(null);

  const reqHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  const authHeader = { 'Authorization': `Bearer ${token}` };

  // RAF token batching — acumula tokens entre frames e aplica num único setState a ~60fps.
  // Evita centenas de re-renders por segundo durante streaming (1 render/frame vs 1 render/token).
  const tokenBufferRef = useRef('');
  const rafIdRef = useRef<number | null>(null);

  const flushTokenBuffer = useCallback(() => {
    rafIdRef.current = null;
    if (tokenBufferRef.current) {
      const chunk = tokenBufferRef.current;
      tokenBufferRef.current = '';
      setStreamingText(prev => prev + chunk);
    }
  }, []);

  const appendToken = useCallback((text: string) => {
    tokenBufferRef.current += text;
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(flushTokenBuffer);
    }
  }, [flushTokenBuffer]);

  // Motor único LangGraph — todos os modos (passos/etapa/passagem/thinking) usam /stream/graph (Sprint 21)
  const streamEndpoint = '/api/v1/chat/stream/graph';

  const callChatStream = async (payload: object, onDone: (data: DonePayload) => void): Promise<void> => {
    // Cancela qualquer RAF pendente da stream anterior
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    tokenBufferRef.current = '';
    setStreamingText('');
    setStepLog([]);
    setHitlGate(null); // limpa gate anterior
    const res = await fetch(streamEndpoint, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.body) {
      const errData = await res.json().catch(() => ({})) as any;
      throw new Error(errData.error?.message || errData.error || `Erro HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
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
            appendToken(event.text);
          } else if (event.type === 'done') {
            setProgressAgent('');
            setStreamingText('');
            setStepLog([]);
            onDone({ text: event.text, agentName: event.agentName, thinking: event.thinking || '', messageType: event.messageType || 'parcial' });
          } else if (event.type === 'hitl_gate') {
            const interruptType = (event as any).interruptType || 'hitl_required';
            // phase_complete: mostrar output do especialista como mensagem no chat
            if (interruptType === 'phase_complete' && (event as any).output) {
              setMessages(prev => [...prev, {
                role: 'assistant' as const,
                content: (event as any).output,
                agentName: event.agent || '',
                messageType: 'parcial',
              }]);
            }
            setHitlGate({
              message:       event.message   || 'Fase concluída. Confirme para prosseguir.',
              agent:         event.agent     || 'PYTHIA',
              projectId:     event.projectId || '',
              interruptType,
              output:        (event as any).output,
            });
            setProgressAgent('');
            // Não chama onDone — stream encerra sem mensagem final (o grafo continua depois do resume)
            return;
          } else if (event.type === 'error') {
            throw new Error(event.message || 'Erro no servidor');
          }
        } catch (parseErr: any) {
          if (parseErr.message !== 'Unexpected token') throw parseErr;
        }
      }
    }
    setProgressAgent('');
    setStreamingText('');
  };

  const appendAssistantMessage = (text: string, thinking: string, messageType: string) => {
    setMessages(prev => {
      const next = [...prev, { role: 'assistant' as const, content: text, messageType }];
      if (thinking) setThinkingBlocks(tb => ({ ...tb, [next.length - 1]: thinking }));
      return next;
    });
  };

  const sendMessage = async (textOverride: string, attachedFiles: AttachedFile[] = [], onFilesClear?: () => void) => {
    if (!textOverride.trim() && attachedFiles.length === 0) return;
    if (loading) return;

    const textToProcess = textOverride;

    let fullContent: Message['content'] = textToProcess.trim();

    if (attachedFiles.length > 0) {
      const textFiles = attachedFiles.filter(f => !f.isImage);
      const imageFiles = attachedFiles.filter(f => f.isImage);

      if (textFiles.length > 0) {
        const fb = textFiles.map(f =>
          `\n\n--- DOCUMENTO DE REFERÊNCIA/MODELO: ${f.name} ---\n${f.text}\n--- FIM DO DOCUMENTO ---`
        ).join('\n');
        fullContent = fullContent ? `${fullContent}\n${fb}` : `Documentos em anexo:\n${fb}`;
      }

      if (imageFiles.length > 0) {
        const contentArray: any[] = [{ type: 'text', text: fullContent || 'Analise a imagem em anexo como referência ou modelo de formato.' }];
        imageFiles.forEach(img => contentArray.push({ type: 'image', image: img.dataUrl }));
        fullContent = contentArray;
      }
    }

    const newMessages = [...messages, { role: 'user' as const, content: fullContent }];
    setMessages(prev => [...prev, { role: 'user', content: textToProcess || '(documentos em anexo)' }]);
    onFilesClear?.();
    setLoading(true);

    try {
      await callChatStream(
        { projectId: sessionId, projectName: projeto.nome, metodologia: projeto.metodologia, vizMode, reportLayout, messages: newMessages },
        ({ text, thinking, messageType }) => {
          appendAssistantMessage(text, thinking, messageType);
          if (text.toUpperCase().includes('KRATOS')) { onIndicatorsRefresh(sessionId); onSignalsRefresh(sessionId); }
          if (text.toUpperCase().includes('KLIO')) onSignalsRefresh(sessionId);
        }
      );
    } catch (error: any) {
      console.error('Erro ao enviar:', error);
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ Erro ao conectar com o servidor: ${error.message}` }]);
    } finally {
      setLoading(false);
      setStreamingText('');
    }
  };

  const deletarMensagem = async (msgId: string | undefined, msgIdx: number) => {
    if (!window.confirm('Deseja remover esta mensagem da análise?')) return;

    const deletedMsg = messages[msgIdx];
    const wasAssistant = deletedMsg?.role === 'assistant';
    const prevUserMsg = wasAssistant
      ? [...messages].slice(0, msgIdx).reverse().find(m => m.role === 'user')
      : null;

    if (msgId) {
      try {
        await fetch(`/api/v1/sessions/${sessionId}/messages/${msgId}`, { method: 'DELETE', headers: authHeader });
      } catch (e: any) { console.warn('deletarMensagem falhou:', e.message); }
    }
    setMessages(prev => prev.filter((_, i) => i !== msgIdx));

    if (wasAssistant && prevUserMsg && window.confirm('Deseja reexecutar esta fase com a mesma entrada?')) {
      const content = typeof prevUserMsg.content === 'string' ? prevUserMsg.content : 'CONFIRMAR';
      await sendMessage(content);
    }
  };

  const gerarRelatorioKratos = async () => {
    if (loading) return;
    if (!projeto.nome || messages.length < 3) {
      alert('É necessário ter um projeto com cenários já definidos para acionar o KRATOS.');
      return;
    }

    const prompt = `COMANDO DO SISTEMA: Acione o agente KRATOS para o projeto de nome oficial "${projeto.nome}". \nREGRAS ESTRITAS DE OPERAÇÃO MÁQUINA:\n1. Não converse, vá direto à análise baseada no histórico desta sessão.\n2. Se houver falha na busca, prossiga com os dados conhecidos.\n3. Gere EXCLUSIVAMENTE o Relatório de Acompanhamento padronizado.\n4. IMPORTANTE: O usuário pode ter alterado o nome, fatores, eventos e indicadores ao longo da análise. Baseie-se SEMPRE nas últimas decisões do histórico e use o título atualizado do projeto ("${projeto.nome}").\nInicie a geração agora.`;

    const newMessages = [...messages, { role: 'user' as const, content: prompt }];
    setMessages(prev => [...prev, { role: 'user', content: '⚡ Comando Manual: Gerar Relatório de Monitoramento Atualizado' }]);
    setLoading(true);

    try {
      await callChatStream(
        { projectId: sessionId, projectName: projeto.nome, metodologia: projeto.metodologia, vizMode: 'etapa', messages: newMessages },
        ({ text, thinking }) => { appendAssistantMessage(text, thinking, 'relatorio_kratos'); }
      );
    } catch (error: any) {
      console.error('Erro ao gerar relatório KRATOS:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Erro ao conectar com o servidor: ${error.message}` }]);
    } finally {
      setLoading(false);
      setStreamingText('');
    }
  };

  const iniciarSessao = async (opts: {
    newSessionId: string;
    initMsg: string;
    nome: string;
    metodologia: string;
    selectedTeamId: string;
    onDone: () => void;
  }) => {
    setLoading(true);
    setMessages([]);
    setThinkingBlocks({});
    setThinkingOpen({});

    const newMessages: Message[] = [{ role: 'user', content: opts.initMsg }];
    setMessages(newMessages);

    try {
      await callChatStream(
        {
          projectId: opts.newSessionId,
          projectName: opts.nome,
          metodologia: opts.metodologia,
          vizMode,
          reportLayout,
          messages: newMessages,
          teamId: opts.selectedTeamId || undefined,
        },
        ({ text, thinking, messageType }) => {
          appendAssistantMessage(text, thinking, messageType);
          onSessionsRefresh();
          onIndicatorsRefresh(opts.newSessionId);
          onSignalsRefresh(opts.newSessionId);
        }
      );
    } catch (error: any) {
      console.error('Erro ao iniciar:', error);
      const detail = error?.message ? `: ${error.message}` : '';
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Erro ao conectar com o servidor${detail}` }]);
    } finally {
      setLoading(false);
      setStreamingText('');
      opts.onDone();
    }
  };

  const toggleThinking = (idx: number) => setThinkingOpen(prev => ({ ...prev, [idx]: !prev[idx] }));

  /**
   * Retoma o grafo LangGraph após aprovação HITL.
   * Chama /stream/graph com isResuming=true — o backend injeta Command({resume}).
   * Usado pelo botão "▶ Continuar → PYTHIA" no EventsPanel.
   */
  const resumeGraph = async (userInstruction?: string) => {
    if (!hitlGate || loading) return;
    setHitlGate(null);
    setLoading(true);
    try {
      await callChatStream(
        {
          projectId:   sessionId,
          projectName: projeto.nome,
          metodologia: projeto.metodologia,
          vizMode,
          isResuming:  true,
          // Se analista forneceu instrução, incluir como última mensagem
          // para que chat.ts extraia como userInputStr e passe no Command({resume})
          messages: userInstruction
            ? [{ role: 'user', content: userInstruction }]
            : [],
        },
        ({ text, thinking, messageType }) => {
          appendAssistantMessage(text, thinking, messageType);
          onIndicatorsRefresh(sessionId);
          onSignalsRefresh(sessionId);
        }
      );
    } catch (error: any) {
      console.error('Erro ao retomar grafo:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Erro ao retomar análise: ${error.message}` }]);
    } finally {
      setLoading(false);
      setStreamingText('');
    }
  };

  return {
    messages, setMessages,
    loading, progressAgent, streamingText, stepLog,
    thinkingBlocks, thinkingOpen,
    hitlGate, setHitlGate,
    sendMessage, deletarMensagem, gerarRelatorioKratos, iniciarSessao,
    toggleThinking, resumeGraph,
  };
}
