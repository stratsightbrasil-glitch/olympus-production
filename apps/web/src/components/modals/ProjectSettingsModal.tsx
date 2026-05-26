import React from 'react';
import type { Projeto, Methodology } from '../../types';

interface Props {
  projeto: Projeto;
  cenariosMethodologies: Methodology[];
  onClose: () => void;
  onSave: () => void;
  onProjetoChange: (p: Projeto) => void;
  onEnviarRelatorio: () => void;
}

const CRON_OPTIONS = [
  { value: '0 6 * * *',  label: 'Diário — Todo dia às 06:00' },
  { value: '0 18 * * *', label: 'Diário — Todo dia às 18:00' },
  { value: '0 8 * * 1',  label: 'Semanal — Toda Segunda-feira às 08:00' },
  { value: '0 8 * * 5',  label: 'Semanal — Toda Sexta-feira às 08:00' },
  { value: '0 8 1 * *',  label: 'Mensal — Todo dia 1º às 08:00' },
  { value: '* * * * *',  label: 'A cada minuto (⚠️ Apenas Testes)' },
];

export function ProjectSettingsModal({ projeto, cenariosMethodologies, onClose, onSave, onProjetoChange, onEnviarRelatorio }: Props) {
  const set = (field: keyof Projeto) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onProjetoChange({ ...projeto, [field]: e.target.value });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col">
        <div className="p-8 overflow-y-auto flex-1">
          <h2 className="font-bold text-stratsight-dark text-xl mb-4">Configurações do Projeto</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stratsight-dark uppercase mb-2">Nome do Projeto</label>
              <input value={projeto.nome} onChange={set('nome')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-stratsight-medium outline-none" placeholder="Ex: Cenários 2030" />
            </div>
            <div>
              <label className="block text-xs font-bold text-stratsight-dark uppercase mb-2">Metodologia</label>
              <select value={projeto.metodologia} onChange={set('metodologia')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-stratsight-medium outline-none bg-white">
                {cenariosMethodologies.length > 0
                  ? cenariosMethodologies.map(m => <option key={m.id} value={m.name}>{m.name} — {m.description}</option>)
                  : <option value="MSEF">MSEF</option>
                }
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stratsight-dark uppercase mb-2">Status do Projeto</label>
              <select value={projeto.status} onChange={set('status')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-stratsight-medium outline-none">
                <option value="Em produção">Em produção (Sem monitoramento)</option>
                <option value="Ativo">Ativo (Monitoramento KRATOS ligado)</option>
                <option value="Inativo">Inativo (Arquivado / Pausado)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stratsight-dark uppercase mb-2">Frequência do Monitoramento</label>
              <select value={projeto.kratosCron} onChange={set('kratosCron')} disabled={projeto.status !== 'Ativo'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-stratsight-medium outline-none bg-white transition-colors">
                {CRON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <p className="text-[10px] text-gray-500 mt-1">O agente acordará automaticamente nestes horários para varrer a internet.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-stratsight-dark uppercase mb-2">E-mails de Alerta KRATOS</label>
              <input type="text" value={projeto.alertEmails} onChange={set('alertEmails')} placeholder="email1@dominio.com, email2@dominio.com" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-stratsight-medium outline-none text-sm" />
              <p className="text-[10px] text-gray-500 mt-1">Destinatários dos relatórios automáticos e sob demanda. Separe múltiplos e-mails por vírgula.</p>
            </div>
          </div>
          <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <h3 className="text-xs font-bold text-blue-900 uppercase mb-2">Relatório KRATOS por E-mail</h3>
            <p className="text-[10px] text-blue-700 mb-3">Gera o relatório de monitoramento agora e envia imediatamente para os e-mails configurados acima.</p>
            <button onClick={onEnviarRelatorio} className="w-full py-2 bg-blue-700 text-white font-bold rounded-lg hover:bg-blue-800 transition-colors text-xs shadow-sm">📊 Gerar e Enviar Relatório Agora</button>
          </div>
        </div>
        <div className="px-8 py-5 border-t border-gray-100 flex gap-3 bg-white rounded-b-2xl flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-3 text-stratsight-medium border-2 border-gray-200 font-bold rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
          <button onClick={onSave} className="flex-[2] py-3 bg-stratsight-dark text-white font-bold rounded-xl hover:bg-stratsight-medium transition-colors">Salvar Configurações</button>
        </div>
      </div>
    </div>
  );
}
