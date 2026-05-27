/**
 * EventsPanel — HITL Review Panel
 *
 * Mostra eventos booleanos propostos pelos agentes (status='proposed') e permite
 * que o analista humano aprove ou rejeite cada um antes que PYTHIA os processe.
 *
 * Arquitetura HITL (Fase 2):
 *   Agente propõe evento → status='proposed'
 *   Analista aprova aqui → status='approved'
 *   anchorContext em chat.ts injeta apenas eventos 'approved' nos agentes
 *   LangGraph interruptBefore: ['node_modeling'] aguardará esse gate
 */

import { useState } from 'react';
import type { ProjectEvent } from '../../hooks/useEvents';

const TYPE_LABELS: Record<string, string> = {
  trend:              'Tendência',
  uncertainty:        'Incerteza',
  inflection_factor:  'Fator de Inflexão',
  fpf:                'FPF',
};

const TYPE_COLORS: Record<string, string> = {
  trend:             'bg-blue-100 text-blue-800',
  uncertainty:       'bg-orange-100 text-orange-800',
  inflection_factor: 'bg-purple-100 text-purple-800',
  fpf:               'bg-green-100 text-green-800',
};

interface EventCardProps {
  event: ProjectEvent;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
  busy:      boolean;
}

function EventCard({ event, onApprove, onReject, busy }: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const mpc = event.sourceEvaluation;

  return (
    <div className="border border-amber-200 rounded-lg bg-amber-50 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-start gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[event.type] ?? 'bg-gray-100 text-gray-700'}`}>
          {TYPE_LABELS[event.type] ?? event.type}
        </span>
        <button
          className="text-sm font-medium text-gray-800 text-left leading-tight flex-1 hover:underline"
          onClick={() => setExpanded(v => !v)}
        >
          {event.name}
        </button>
      </div>

      {/* Expanded description */}
      {expanded && (
        <p className="text-xs text-gray-600 leading-relaxed pl-1">{event.description}</p>
      )}

      {/* MPC badge */}
      {mpc && (
        <p className="text-xs text-gray-500 pl-1">
          MPC: Confiabilidade <strong>{mpc.reliability}</strong> · Credibilidade <strong>{mpc.credibility}</strong>
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onApprove(event.id)}
          disabled={busy}
          className="flex-1 text-xs font-semibold py-1 px-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          ✓ Aprovar
        </button>
        <button
          onClick={() => onReject(event.id)}
          disabled={busy}
          className="flex-1 text-xs font-semibold py-1 px-2 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 transition-colors"
        >
          ✕ Rejeitar
        </button>
      </div>
    </div>
  );
}

interface HitlGate {
  message:   string;
  agent:     string;
  projectId: string;
}

interface EventsPanelProps {
  proposedEvents: ProjectEvent[];
  loading: boolean;
  onApprove:    (id: string) => Promise<boolean>;
  onReject:     (id: string) => Promise<boolean>;
  onAprovarTodos: (ids: string[]) => Promise<boolean>;
  onRefresh: () => void;
  /** Definido quando o motor LangGraph pausou aguardando revisão HITL */
  hitlGate?:  HitlGate | null;
  /** Callback para retomar o grafo após aprovação */
  onResume?:  () => void;
}

export function EventsPanel({ proposedEvents, loading, onApprove, onReject, onAprovarTodos, onRefresh, hitlGate, onResume }: EventsPanelProps) {
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Painel visível quando: há eventos propostos OU o motor está pausado no gate HITL
  if (proposedEvents.length === 0 && !loading && !hitlGate) return null;

  const handleApprove = async (id: string) => {
    setBusy(true);
    await onApprove(id);
    setBusy(false);
  };

  const handleReject = async (id: string) => {
    setBusy(true);
    await onReject(id);
    setBusy(false);
  };

  const handleAprovarTodos = async () => {
    setBusy(true);
    await onAprovarTodos(proposedEvents.map(e => e.id));
    setBusy(false);
  };

  return (
    <div className="border-l border-amber-300 bg-amber-50/60 w-72 shrink-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 border-b ${hitlGate ? 'border-purple-300 bg-purple-100' : 'border-amber-200 bg-amber-100'}`}>
        <div className="flex items-center gap-2">
          <span className={`font-bold text-xs ${hitlGate ? 'text-purple-700' : 'text-amber-700'}`}>
            {hitlGate ? `⏸ MOTOR PAUSADO — ${hitlGate.agent}` : '⏸ AGUARDANDO REVISÃO'}
          </span>
          {proposedEvents.length > 0 && (
            <span className="bg-amber-600 text-white text-xs rounded-full px-1.5 py-0.5 font-bold leading-none">
              {proposedEvents.length}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={onRefresh}
            className="text-amber-600 hover:text-amber-800 text-xs px-1"
            title="Recarregar eventos"
          >↻</button>
          <button
            onClick={() => setCollapsed(v => !v)}
            className="text-amber-600 hover:text-amber-800 text-xs px-1"
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Approve all */}
          {proposedEvents.length > 1 && (
            <div className="px-3 py-2 border-b border-amber-200">
              <button
                onClick={handleAprovarTodos}
                disabled={busy}
                className="w-full text-xs font-semibold py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                ✓ Aprovar todos ({proposedEvents.length})
              </button>
            </div>
          )}

          {/* Event list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loading ? (
              <p className="text-xs text-amber-600 text-center py-4">Carregando eventos...</p>
            ) : (
              proposedEvents.map(evt => (
                <EventCard
                  key={evt.id}
                  event={evt}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  busy={busy}
                />
              ))
            )}
          </div>

          {/* Botão de retomada HITL — visível quando o motor pausou E não há mais eventos pendentes */}
          {hitlGate && proposedEvents.length === 0 && onResume && (
            <div className="px-3 py-3 border-t border-purple-200 bg-purple-50">
              <p className="text-[11px] text-purple-700 mb-2 leading-snug">
                ✅ Todos os eventos foram revisados. Clique para continuar a análise com PYTHIA.
              </p>
              <button
                onClick={onResume}
                disabled={busy}
                className="w-full text-sm font-bold py-2 px-3 rounded-lg bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50 transition-colors"
              >
                ▶ Continuar → {hitlGate.agent}
              </button>
            </div>
          )}

          {/* Banner de instrução quando gate ativo mas ainda há eventos para revisar */}
          {hitlGate && proposedEvents.length > 0 && (
            <div className="px-3 py-2 border-t border-purple-200 bg-purple-50/60">
              <p className="text-[10px] text-purple-700 leading-tight">
                O motor está pausado. Aprove ou rejeite todos os eventos acima para liberar a continuação.
              </p>
            </div>
          )}

          {/* Footer hint (modo normal, sem gate) */}
          {!hitlGate && (
            <div className="px-3 py-2 border-t border-amber-200 bg-amber-100/60">
              <p className="text-[10px] text-amber-700 leading-tight">
                Eventos aprovados alimentam a Âncora de Contexto dos agentes.
                PYTHIA só processa incertezas e FPFs com status <em>approved</em>.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
