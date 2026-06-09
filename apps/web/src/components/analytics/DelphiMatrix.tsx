import type { DelphiResult } from '../../hooks/useAnalytics';

const QUALIFIER_STYLE: Record<string, string> = {
  'quase certo':          'bg-green-100 text-green-800',
  'altamente provável':   'bg-emerald-100 text-emerald-800',
  'provável':             'bg-teal-100 text-teal-800',
  'aproximadamente igual':'bg-yellow-100 text-yellow-800',
  'improvável':           'bg-orange-100 text-orange-800',
  'altamente improvável': 'bg-red-100 text-red-800',
  'remoto':               'bg-red-200 text-red-900',
};

function probColor(p: number): string {
  if (p >= 0.8) return '#16a34a';
  if (p >= 0.55) return '#2563eb';
  if (p >= 0.45) return '#d97706';
  return '#dc2626';
}

interface Props {
  results: DelphiResult[];
}

export function DelphiMatrix({ results }: Props) {
  if (results.length === 0) {
    return (
      <div className="text-[11px] text-center text-gray-400 py-6">
        Nenhum dado Delphi P(i) disponível.<br />
        Execute a Fase 4 para gerar as probabilidades.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide text-[9px]">FPF</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide text-[9px]">Qualificador</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500 uppercase tracking-wide text-[9px] w-20">P(i)</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-2 font-medium text-gray-800 max-w-[160px]">
                <div className="truncate" title={r.fpfName}>{r.fpfName}</div>
              </td>
              <td className="py-2 px-2">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${QUALIFIER_STYLE[r.qualifier.toLowerCase()] ?? 'bg-gray-100 text-gray-600'}`}>
                  {r.qualifier}
                </span>
              </td>
              <td className="py-2 px-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(r.probability * 100, 100)}%`, background: probColor(r.probability) }}
                    />
                  </div>
                  <span className="font-mono font-bold text-[11px] w-8 text-right" style={{ color: probColor(r.probability) }}>
                    {r.probability > 0 ? `${(r.probability * 100).toFixed(0)}%` : '—'}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
