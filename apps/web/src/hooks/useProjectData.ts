import { useState } from 'react';

export function useProjectData(token: string | null) {
  // Typed as `any` — shapes are owned by the components that render them (RightPanel, Sidebar)
  const [indicadores, setIndicadores] = useState<any[]>([]);
  const [weakSignals, setWeakSignals] = useState<any[]>([]);
  const [signalStats, setSignalStats] = useState<any | null>(null);
  const [analyticReview, setAnalyticReview] = useState<any | null>(null);

  const authHeader = { 'Authorization': `Bearer ${token}` };

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

  return {
    indicadores, weakSignals, signalStats, analyticReview,
    setAnalyticReview,
    carregarIndicadores,
    carregarSinais,
    carregarRevisao,
  };
}
