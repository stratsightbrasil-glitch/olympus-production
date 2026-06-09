import { useState, useCallback } from 'react';

export interface DelphiEvent {
  id: string;
  name: string;
  description: string | null;
  status: string;
}

export interface DelphiResult {
  fpfName:     string;
  qualifier:   string;
  probability: number;
  rawDescription: string;
}

export interface FpfNode {
  id:   string;
  name: string;
  label: string; // FPF-N abreviado
}

export interface ImpactRelation {
  fromEventId: string;
  toEventId:   string;
  impactScore: number;
}

export interface ImpactData {
  fpfs:    FpfNode[];
  impacts: ImpactRelation[];
}

/** Parseia "Provável (P=0.65) — consenso 5/7 especialistas" → { qualifier, probability } */
export function parseDelphiDescription(desc: string | null): { qualifier: string; probability: number } {
  if (!desc) return { qualifier: 'desconhecido', probability: 0 };
  const match = desc.match(/^([\wÀ-ÿ\s]+)\s*\(P=([\d.]+)\)/i);
  if (match) return { qualifier: match[1].trim(), probability: parseFloat(match[2]) };
  const pMatch = desc.match(/P\s*=\s*([\d.]+)/i);
  if (pMatch) return { qualifier: 'estimado', probability: parseFloat(pMatch[1]) };
  return { qualifier: 'desconhecido', probability: 0 };
}

export function useAnalytics(token: string | null) {
  const [delphiResults, setDelphiResults] = useState<DelphiResult[]>([]);
  const [impactData,    setImpactData]    = useState<ImpactData | null>(null);
  const [loading,       setLoading]       = useState(false);

  const authHeader = { Authorization: `Bearer ${token}` };

  const fetchDelphi = useCallback(async (projectId: string) => {
    if (!projectId || !token) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/analytics/${projectId}/delphi`, { headers: authHeader });
      if (!r.ok) return;
      const events: DelphiEvent[] = await r.json();
      const results: DelphiResult[] = events.map(e => {
        const { qualifier, probability } = parseDelphiDescription(e.description);
        return {
          fpfName:        e.name.replace(/^P\(i\)\s*[—\-–]\s*/i, ''),
          qualifier,
          probability,
          rawDescription: e.description ?? '',
        };
      }).sort((a, b) => b.probability - a.probability);
      setDelphiResults(results);
    } catch { /* silencioso */ } finally { setLoading(false); }
  }, [token]);

  const fetchImpacts = useCallback(async (projectId: string) => {
    if (!projectId || !token) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/analytics/${projectId}/impacts`, { headers: authHeader });
      if (!r.ok) return;
      const data: { fpfs: Array<{ id: string; name: string; description: string | null }>; impacts: ImpactRelation[] } = await r.json();
      const fpfs: FpfNode[] = data.fpfs.map((f, i) => ({
        id:    f.id,
        name:  f.name,
        label: `FPF-${i + 1}`,
      }));
      setImpactData({ fpfs, impacts: data.impacts });
    } catch { /* silencioso */ } finally { setLoading(false); }
  }, [token]);

  const fetchAll = useCallback(async (projectId: string) => {
    await Promise.all([fetchDelphi(projectId), fetchImpacts(projectId)]);
  }, [fetchDelphi, fetchImpacts]);

  return { delphiResults, impactData, loading, fetchDelphi, fetchImpacts, fetchAll };
}
