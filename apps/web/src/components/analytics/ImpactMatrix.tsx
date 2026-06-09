import type { FpfNode, ImpactRelation } from '../../hooks/useAnalytics';

interface Props {
  fpfs:    FpfNode[];
  impacts: ImpactRelation[];
}

function getScore(impacts: ImpactRelation[], fromId: string, toId: string): number {
  return impacts.find(imp => imp.fromEventId === fromId && imp.toEventId === toId)?.impactScore ?? 0;
}

function scoreColor(s: number): string {
  if (s === 0) return '#e5e7eb';
  if (s > 0)   return s >= 2 ? '#16a34a' : '#86efac';
  return s <= -2 ? '#dc2626' : '#fca5a5';
}

function scoreLabel(s: number): string {
  if (s === 0) return '—';
  return s > 0 ? `+${s}` : `${s}`;
}

export function ImpactMatrix({ fpfs, impacts }: Props) {
  if (fpfs.length === 0) {
    return (
      <div className="text-[11px] text-center text-gray-400 py-6">
        Nenhum FPF aprovado encontrado.<br />
        Execute as Fases 2-3 para registrar FPFs.
      </div>
    );
  }

  if (impacts.length === 0) {
    return (
      <div className="text-[11px] text-center text-gray-400 py-6">
        Matriz de impactos não preenchida.<br />
        Execute a Fase 5 (Impacto Cruzado) para gerar os dados.
      </div>
    );
  }

  // Calcular motricidade e dependência para cada FPF
  const motricidade = fpfs.map(f =>
    fpfs.reduce((sum, g) => sum + Math.abs(getScore(impacts, f.id, g.id)), 0)
  );
  const dependencia = fpfs.map((_, j) =>
    fpfs.reduce((sum, f) => sum + Math.abs(getScore(impacts, f.id, fpfs[j].id)), 0)
  );

  return (
    <div className="space-y-4">
      {/* ── Heatmap ── */}
      <div className="overflow-x-auto">
        <table className="text-[9px] border-collapse w-full">
          <thead>
            <tr>
              <th className="p-1 text-gray-400 font-normal text-left w-16">→</th>
              {fpfs.map(f => (
                <th key={f.id} className="p-1 text-center font-semibold text-gray-600 w-8" title={f.name}>
                  {f.label}
                </th>
              ))}
              <th className="p-1 text-center font-semibold text-indigo-600 text-[9px]">Motr.</th>
            </tr>
          </thead>
          <tbody>
            {fpfs.map((fpfI, i) => (
              <tr key={fpfI.id}>
                <td className="p-1 font-semibold text-gray-600 truncate max-w-[60px]" title={fpfI.name}>
                  {fpfI.label}
                </td>
                {fpfs.map((fpfJ, j) => {
                  const s = i === j ? null : getScore(impacts, fpfI.id, fpfJ.id);
                  return (
                    <td
                      key={fpfJ.id}
                      className="p-0.5 text-center font-mono text-[9px] font-bold"
                      title={s !== null ? `I(${fpfI.label}→${fpfJ.label}) = ${s}` : undefined}
                    >
                      {s === null ? (
                        <div className="w-6 h-5 rounded bg-gray-200 mx-auto flex items-center justify-center text-gray-400">×</div>
                      ) : (
                        <div
                          className="w-6 h-5 rounded mx-auto flex items-center justify-center"
                          style={{ background: scoreColor(s), color: s === 0 ? '#9ca3af' : '#fff' }}
                        >
                          {scoreLabel(s)}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="p-1 text-center font-bold text-indigo-700 text-[10px]">
                  {motricidade[i]}
                </td>
              </tr>
            ))}
            {/* Linha de dependência */}
            <tr className="border-t border-gray-200">
              <td className="p-1 font-semibold text-purple-600 text-[9px]">Dep.</td>
              {fpfs.map((f, j) => (
                <td key={f.id} className="p-1 text-center font-bold text-purple-700 text-[10px]">
                  {dependencia[j]}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Legenda FPFs ── */}
      <div className="space-y-1">
        {fpfs.map(f => (
          <div key={f.id} className="flex gap-1.5 text-[9px]">
            <span className="font-bold text-gray-600 shrink-0">{f.label}</span>
            <span className="text-gray-500 truncate" title={f.name}>{f.name}</span>
          </div>
        ))}
      </div>

      {/* ── Escala ── */}
      <div className="flex gap-2 text-[9px] text-gray-500 flex-wrap">
        <span className="font-semibold">Escala:</span>
        {[[-3, '#dc2626'], [-2, '#fca5a5'], [-1, '#fca5a5'], [0, '#e5e7eb'], [1, '#86efac'], [2, '#86efac'], [3, '#16a34a']].map(([v, c]) => (
          <span key={v} className="flex items-center gap-0.5">
            <span className="w-4 h-3 rounded inline-block" style={{ background: c as string }} />
            {(v as number) > 0 ? `+${v}` : v}
          </span>
        ))}
      </div>
    </div>
  );
}
