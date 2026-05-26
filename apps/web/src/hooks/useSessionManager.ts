import { useState } from 'react';
import type { Sessao } from '../types';

export function useSessionManager(token: string | null) {
  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [showSessoes, setShowSessoes] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState({ producao: true, ativos: true, inativos: false });

  const authHeader = { 'Authorization': `Bearer ${token}` };

  const carregarSessoes = async () => {
    try {
      const r = await fetch('/api/v1/sessions?t=' + Date.now(), { headers: authHeader });
      if (r.ok) setSessoes(await r.json());
    } catch (_) {}
  };

  const deletarSessao = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Deseja realmente excluir esta análise?')) return;
    try {
      const r = await fetch('/api/v1/sessions/' + id, { method: 'DELETE', headers: authHeader });
      if (r.ok) setSessoes(prev => prev.filter(s => s.id !== id));
    } catch (err: any) { console.warn('deletarSessao falhou:', err.message); }
  };

  const toggleSessoes = () => {
    setShowSessoes(s => {
      if (!s) carregarSessoes();
      return !s;
    });
  };

  const updateFilter = (key: keyof typeof filterStatus, value: boolean) => {
    setFilterStatus(f => ({ ...f, [key]: value }));
  };

  return {
    sessoes, setSessoes,
    showSessoes, setShowSessoes,
    sessionSearch, setSessionSearch,
    filterStatus,
    carregarSessoes,
    deletarSessao,
    toggleSessoes,
    updateFilter,
  };
}
