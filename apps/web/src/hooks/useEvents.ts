import { useState, useCallback } from 'react';

export interface ProjectEvent {
  id: string;
  projectId: string;
  name: string;
  description: string;
  type: 'trend' | 'uncertainty' | 'inflection_factor' | 'fpf';
  status: 'proposed' | 'approved' | 'rejected';
  sourceEvaluation?: { reliability: string; credibility: string } | null;
  createdAt: string;
  updatedAt: string;
}

export function useEvents(token: string | null) {
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const authHeader = { 'Authorization': `Bearer ${token}` };

  const carregarEventos = useCallback(async (projectId: string, status?: string) => {
    if (!projectId || !token) return;
    setLoading(true);
    try {
      const qs = status ? `?projectId=${projectId}&status=${status}` : `?projectId=${projectId}`;
      const r = await fetch(`/api/v1/events${qs}`, { headers: authHeader });
      if (r.ok) setEvents(await r.json());
    } catch { /* silencioso */ } finally {
      setLoading(false);
    }
  }, [token]);

  const aprovarEvento = useCallback(async (id: string): Promise<boolean> => {
    try {
      const r = await fetch(`/api/v1/events/${id}/status`, {
        method: 'PATCH',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (r.ok) {
        const updated = await r.json() as ProjectEvent;
        setEvents(prev => prev.map(e => e.id === id ? updated : e));
        return true;
      }
      return false;
    } catch { return false; }
  }, [token]);

  const rejeitarEvento = useCallback(async (id: string): Promise<boolean> => {
    try {
      const r = await fetch(`/api/v1/events/${id}/status`, {
        method: 'PATCH',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      if (r.ok) {
        const updated = await r.json() as ProjectEvent;
        setEvents(prev => prev.map(e => e.id === id ? updated : e));
        return true;
      }
      return false;
    } catch { return false; }
  }, [token]);

  const aprovarTodos = useCallback(async (ids: string[]): Promise<boolean> => {
    if (ids.length === 0) return true;
    try {
      const r = await fetch('/api/v1/events/batch/status', {
        method: 'PATCH',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status: 'approved' }),
      });
      if (r.ok) {
        setEvents(prev => prev.map(e => ids.includes(e.id) ? { ...e, status: 'approved' } : e));
        return true;
      }
      return false;
    } catch { return false; }
  }, [token]);

  const proposedEvents = events.filter(e => e.status === 'proposed');
  const approvedEvents = events.filter(e => e.status === 'approved');

  return {
    events,
    proposedEvents,
    approvedEvents,
    loading,
    carregarEventos,
    aprovarEvento,
    rejeitarEvento,
    aprovarTodos,
  };
}
