import React, { useState } from 'react';
import type { AnalyticReview } from '../../types';

interface ReviewFormProps {
  sessionId: string;
  token: string;
  userName: string;
  onSaved: (rev: AnalyticReview) => void;
  onClose: () => void;
}

function ReviewForm({ sessionId, token, userName, onSaved, onClose }: ReviewFormProps) {
  const [status, setStatus] = useState('nao_revisado');
  const [notas, setNotas] = useState('');
  const [declaracao, setDeclaracao] = useState(`Esta análise foi produzida por ${userName} com assistência de IA como ferramenta auxiliar. A responsabilidade analítica é do analista.`);
  const [ats, setAts] = useState({ ats1: '', ats2: '', ats3: '', ats4: '' });
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    setSaving(true);
    try {
      const atsCompliance: Record<string, number> = {};
      if (ats.ats1) atsCompliance['ATS1-Fontes'] = Number(ats.ats1);
      if (ats.ats2) atsCompliance['ATS2-Probabilidade'] = Number(ats.ats2);
      if (ats.ats3) atsCompliance['ATS3-Julgamento'] = Number(ats.ats3);
      if (ats.ats4) atsCompliance['ATS4-Alternativas'] = Number(ats.ats4);

      const r = await fetch('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          projectId: sessionId, status,
          notasRevisor: notas || null,
          declaracaoPropriedade: declaracao || null,
          atsCompliance: Object.keys(atsCompliance).length > 0 ? atsCompliance : null,
        }),
      });
      const d = await r.json();
      if (d.ok) onSaved(d.review);
    } finally { setSaving(false); }
  };

  const ATS_FIELDS = [
    { key: 'ats1' as const, label: 'Fontes', display: 'ATS1' },
    { key: 'ats2' as const, label: 'Probabilidade', display: 'ATS2' },
    { key: 'ats3' as const, label: 'Julgamento', display: 'ATS3' },
    { key: 'ats4' as const, label: 'Alternativas', display: 'ATS4' },
  ];

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
          {ATS_FIELDS.map(f => (
            <div key={f.key} className="text-center">
              <input type="number" min="0" max="25" value={ats[f.key]} onChange={e => setAts(a => ({ ...a, [f.key]: e.target.value }))} placeholder="—" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:border-stratsight-medium" />
              <div className="text-[10px] text-gray-400 mt-0.5">{f.label}</div>
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

const STATUS_STYLES: Record<string, string> = {
  aprovado: 'bg-green-100 text-green-800',
  aprovado_com_ressalvas: 'bg-yellow-100 text-yellow-800',
  requer_revisao: 'bg-red-100 text-red-800',
};
const STATUS_LABELS: Record<string, string> = {
  aprovado: '✅ Aprovado',
  aprovado_com_ressalvas: '⚠️ Aprovado com Ressalvas',
  requer_revisao: '🔴 Requer Revisão',
  nao_revisado: '⏳ Não Revisado',
};

interface ReviewModalProps {
  sessionId: string;
  token: string;
  userName: string;
  review: AnalyticReview | null;
  onClose: () => void;
  onSaved: (rev: AnalyticReview) => void;
  onClearReview: () => void;
}

export function ReviewModal({ sessionId, token, userName, review, onClose, onSaved, onClearReview }: ReviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="bg-stratsight-dark text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <div className="font-bold text-lg">Revisão de Qualidade Analítica</div>
            <div className="text-xs text-gray-300 mt-0.5">Padrão ICD 203 · ODNI 2022 · McMahon 2024</div>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-white text-xl">✕</button>
        </div>

        {review ? (
          <div className="p-6 space-y-4">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${STATUS_STYLES[review.status] || 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[review.status]}
            </div>

            {review.atsCompliance && (
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pontuação por Padrão ATS</div>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(review.atsCompliance).map(([k, v]) => (
                    <div key={k} className="text-center bg-gray-50 rounded-lg p-2">
                      <div className="text-lg font-bold text-stratsight-dark">{v}</div>
                      <div className="text-[10px] text-gray-500">{k}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {review.notasRevisor && (
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notas do Revisor</div>
                <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{review.notasRevisor}</div>
              </div>
            )}

            {review.declaracaoPropriedade && (
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Declaração de Propriedade</div>
                <div className="text-xs text-gray-600 italic bg-blue-50 rounded-lg p-3">{review.declaracaoPropriedade}</div>
              </div>
            )}

            <div className="text-[10px] text-gray-400">
              Revisado por: {review.reviewerName || '—'} · {review.reviewedAt ? new Date(review.reviewedAt).toLocaleString('pt-BR') : '—'}
            </div>

            <div className="flex gap-2">
              <button onClick={onClearReview} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors">Nova Revisão</button>
              <button onClick={onClose} className="flex-1 bg-stratsight-dark text-white py-2 rounded-xl font-bold hover:bg-stratsight-medium transition-colors">Fechar</button>
            </div>
          </div>
        ) : (
          <ReviewForm sessionId={sessionId} token={token} userName={userName} onSaved={onSaved} onClose={onClose} />
        )}
      </div>
    </div>
  );
}
