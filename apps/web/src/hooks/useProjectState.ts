import { useState } from 'react';
import type { Projeto, Message } from '../types';

const DEFAULT_PROJETO: Projeto = {
  nome: '', metodologia: 'MSEF', status: 'Em produção',
  kratosCron: '0 6 * * *', alertEmails: '',
  horizonte: '', elaborador: '', cliente: '',
  questaoEstrategica: '', mudancaIdentificada: '', teamId: null,
};

interface UseProjectStateProps {
  token: string | null;
  onSessionLoaded: (sessionId: string, messages: Message[]) => void;
  onSessionsRefresh: () => void;
  onIndicatorsRefresh: (id: string) => void;
  onSignalsRefresh: (id: string) => void;
  onReviewRefresh: (id: string) => void;
}

export function useProjectState({
  token,
  onSessionLoaded,
  onSessionsRefresh,
  onIndicatorsRefresh,
  onSignalsRefresh,
  onReviewRefresh,
}: UseProjectStateProps) {
  const [projeto, setProjeto] = useState<Projeto>(DEFAULT_PROJETO);
  const [sessionId, setSessionId] = useState(() => `sess_${Date.now()}`);

  const reqHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  const authHeader = { 'Authorization': `Bearer ${token}` };

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
        alertEmails: s.alertEmails || '',
        horizonte: s.horizon || '',
        elaborador: s.analyst || '',
        cliente: s.client || '',
        questaoEstrategica: '',
        mudancaIdentificada: '',
        teamId: s.teamId || null,
      });
      setSessionId(s.id);
      const msgs: Message[] = (s.mensagens || []).map((m: any) => ({
        role: m.role,
        content: m.content,
        id: m.id,
        messageType: m.messageType ?? m.message_type,
      }));
      onSessionLoaded(s.id, msgs);
      onIndicatorsRefresh(s.id);
      onSignalsRefresh(s.id);
      onReviewRefresh(s.id);
    } catch (e: any) { alert('Erro ao carregar análise: ' + e.message); }
  };

  const salvarConfiguracoes = async (onSuccess: () => void) => {
    try {
      const r = await fetch('/api/v1/sessions/' + sessionId, {
        method: 'PATCH',
        headers: reqHeaders,
        body: JSON.stringify({
          name: projeto.nome,
          status: projeto.status,
          kratosCron: projeto.kratosCron,
          alertEmails: projeto.alertEmails,
          methodology: projeto.metodologia,
        }),
      });
      if (r.ok) { onSuccess(); onSessionsRefresh(); }
    } catch (e: any) { alert('Erro ao salvar configurações: ' + e.message); }
  };

  const enviarRelatorioKratos = async (overrideEmails?: string[]) => {
    if (!sessionId) { alert('Nenhum projeto ativo.'); return; }
    const destinos = overrideEmails ?? (
      projeto.alertEmails
        ? projeto.alertEmails.split(',').map(e => e.trim()).filter(Boolean)
        : []
    );
    if (destinos.length === 0) {
      const manual = window.prompt('Nenhum e-mail configurado neste projeto.\nDigite o(s) e-mail(s) de destino (separados por vírgula):');
      if (!manual?.trim()) return;
      destinos.push(...manual.split(',').map(e => e.trim()).filter(Boolean));
    }
    try {
      const res = await fetch(`/api/v1/kratos/${sessionId}/report`, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({ emails: destinos }),
      });
      const data = await res.json();
      if (res.ok && data.success) alert(`✅ Relatório KRATOS gerado e enviado para:\n${destinos.join('\n')}`);
      else alert(data.error || data.message || 'Erro ao gerar relatório. Verifique o terminal do Docker.');
    } catch (e: any) { alert('Erro na requisição: ' + e.message); }
  };

  return {
    projeto, setProjeto,
    sessionId, setSessionId,
    carregarSessao,
    salvarConfiguracoes,
    enviarRelatorioKratos,
    DEFAULT_PROJETO,
  };
}
