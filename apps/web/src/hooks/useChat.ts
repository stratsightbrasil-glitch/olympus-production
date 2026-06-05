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

  // Número da fase atual, atualizado por eventos SSE ('athena', 'hitl_gate').
  // Mais confiável que o scan de mensagens para step counter (evita false-positives
  // quando múltiplas fases usam o mesmo agente, ex: todas as 9 fases do Grumbach → KLIO).
  const [currentPhaseNum, setCurrentPhaseNum] = useState(0);

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
    setProgressAgent(''); // reset agente anterior — evita mostrar "HERMES raciocinando" no início
    setHitlGate(null);    // limpa gate anterior
    // Reset currentPhaseNum apenas para análises novas — em resumes preservar o número
    // da última fase para não causar salto do counter para a fase errada via message scan.
    const isResuming = (payload as any).isResuming;
    if (!isResuming) setCurrentPhaseNum(0);
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
          } else if (event.type === 'phase_output') {
            // Output de KLIO após cada fase — salva como mensagem permanente antes da ATHENA.
            // Sem isso, em vizMode=etapa o streaming bubble desaparece sem deixar rastro (Bug B3).
            const text: string = (event as any).text ?? '';
            if (text.trim()) {
              // Cancela RAF pendente: o token buffer do streaming ainda pode ter conteúdo acumulado
              if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
              tokenBufferRef.current = '';
              setStreamingText(''); // limpa streaming bubble — fase concluída
              setMessages(prev => [...prev, {
                role:        'assistant' as const,
                agentName:   'KLIO',
                messageType: 'parcial',
                content:     text,
              }]);
            }
          } else if (event.type === 'athena') {
            // Veredicto ATHENA após cada fase — persiste no chat como mensagem AT
            const verdict: string = (event as any).verdict ?? '';
            const phaseNum: number = (event as any).phaseNum ?? 0;
            const label: string = (event as any).label ?? '';
            const checks: Array<{ atsCode: string; passed: boolean; finding: string }> = (event as any).checks ?? [];
            const emoji = verdict === 'APROVADO' ? '✅' : verdict === 'RESSALVAS' ? '⚠️' : '❌';
            if (phaseNum > 0) setCurrentPhaseNum(phaseNum);
            // Veredicto + checks reprovados (para REQUER_REVISAO e RESSALVAS)
            const failedChecks = checks.filter(c => !c.passed);
            const pendingChecks = checks.filter(c => c.passed && c.finding.toLowerCase().includes('pendente'));
            let content = `${emoji} **Fase ${phaseNum} — ${label}** · ATHENA: **${verdict}**`;
            if (failedChecks.length > 0) {
              content += '\n\n**Verificações reprovadas:**\n' +
                failedChecks.map(c => `- \`${c.atsCode}\` ${c.finding}`).join('\n');
            } else if (pendingChecks.length > 0) {
              content += '\n\n**Ressalvas:**\n' +
                pendingChecks.map(c => `- \`${c.atsCode}\` ${c.finding}`).join('\n');
            }
            setMessages(prev => [...prev, {
              role:        'assistant' as const,
              agentName:   'ATHENA',
              messageType: 'athena',
              content,
            }]);
          } else if (event.type === 'hitl_gate') {
            const interruptType = (event as any).interruptType || 'hitl_required';
            // NÃO atualizar currentPhaseNum aqui:
            //   phase_complete → athena já o atualizou (fase que acabou de correr)
            //   hitl_required  → phaseNum é da fase que VAI rodar, não da que completou
            // Fonte autoritativa: apenas eventos 'athena' (disparam APÓS a fase completar)
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
              agent:         event.agent     || 'KLIO',
              projectId:     event.projectId || '',
              interruptType,
              output:        (event as any).output,
            });
            setProgressAgent('');
            setStreamingText('');  // limpa streaming bubble — o conteúdo foi salvo na mensagem acima
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
    // Bloquear sendMessage enquanto o motor está pausado em gate HITL.
    // Sem este guard, o usuário pode usar o InputZone acidentalmente e disparar
    // isResuming=false, limpando checkpoints e recomeçando do zero.
    if (hitlGate) return;

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
   * Usado pelo botão "▶ Continuar" no EventsPanel e HitlDecisionCard.
   */
  const resumeGraph = async (userInstruction?: string) => {
    if (!hitlGate || loading) return;
    const savedGate = hitlGate; // preserva para restaurar em caso de erro transitório
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
      // Erros transitórios (503/sobrecarga): restaura o gate para que o analista
      // possa clicar "Confirmar" novamente sem reiniciar a análise do zero.
      const isTransient = error.message?.includes('sobrecarregado')
        || error.message?.includes('tente retomar')
        || error.message?.includes('rate limit')
        || error.message?.includes('503');
      if (isTransient && savedGate) setHitlGate(savedGate);
      setMessages(prev => [...prev, {
        role: 'assistant' as const,
        content: `⚠️ ${error.message}\n\n${isTransient
          ? '→ **Clique em "Confirmar e Avançar"** para retomar quando o modelo estiver disponível.'
          : 'Use "Confirmar e Avançar" para tentar retomar, ou crie uma nova sessão.'}`,
      }]);
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
    currentPhaseNum,
    sendMessage, deletarMensagem, gerarRelatorioKratos, iniciarSessao,
    toggleThinking, resumeGraph,
  };
}
