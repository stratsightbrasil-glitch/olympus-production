import React, { useRef, useState } from 'react';
import type { ScopeForm, Team, Methodology } from '../../types';

interface Props {
  onClose: () => void;
  onStart: (opts: {
    scopeForm: ScopeForm;
    scopeFiles: { name: string; text: string }[];
    selectedTeamId: string;
    metodologia: string;
    vizMode: string;
  }) => void;
  cenariosMethodologies: Methodology[];
  teams: Team[];
  token: string | null;
  defaultMetodologia: string;
  defaultVizMode: string;
}

const ACCEPTED_TYPES = '.txt,.md,.csv,.json,.rtf,.pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.webp';

const EMPTY_SCOPE: ScopeForm = { tema: '', horizonte: '', elaborador: '', cliente: '', questaoEstrategica: '', mudancaIdentificada: '', instrucoes: '' };

// Sprint 21 — motor LangGraph único: os 4 modos diferem pelo nível de supervisão
// do analista, não pelo motor (todos usam /stream/graph internamente).
const VIZ_MODES = [
  { id: 'passos',   label: '👣 Passo a Passo',        desc: 'Pausa após cada fase — analista revisa e confirma antes de avançar' },
  { id: 'etapa',    label: '📋 Etapa Completa',        desc: 'Cada especialista entrega sua fase completa (Padrão). PYTHIA aguarda aprovação de eventos.' },
  { id: 'passagem', label: '⚡ Processo Completo',     desc: 'Todas as fases encadeadas de forma autônoma, sem interrupções' },
  { id: 'thinking', label: '🧠 Raciocínio Estendido',  desc: 'Raciocínio profundo antes de cada resposta — maior profundidade analítica' },
];

export function NewSessionModal({ onClose, onStart, cenariosMethodologies, teams, token, defaultMetodologia, defaultVizMode }: Props) {
  const [scopeForm, setScopeForm] = useState<ScopeForm>(EMPTY_SCOPE);
  const [scopeFiles, setScopeFiles] = useState<{ name: string; text: string }[]>([]);
  const [scopeExtracting, setScopeExtracting] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [metodologia, setMetodologia] = useState(defaultMetodologia);
  const [vizMode, setVizMode] = useState(defaultVizMode);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const authHeader = { 'Authorization': `Bearer ${token}` };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (!token) { alert('Sessão expirada. Faça login novamente.'); return; }
    setScopeExtracting(true);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      const res = await fetch('/api/v1/extract', { method: 'POST', headers: authHeader, body: fd });
      if (!res.ok) throw new Error(`Erro ${res.status} — verifique se está autenticado`);
      const result = await res.json();
      const ok: { name: string; text: string }[] = [];
      result.files.forEach((f: any) => { if (f.text?.trim()) ok.push({ name: f.name, text: f.text }); });
      if (ok.length) setScopeFiles(prev => [...prev, ...ok]);
    } catch (err: any) { alert('Erro ao processar arquivo: ' + err.message); }
    setScopeExtracting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const set = (field: keyof ScopeForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setScopeForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center gap-4 p-6 border-b border-gray-100">
          <div className="w-11 h-11 rounded-full bg-stratsight-dark flex items-center justify-center text-white text-xl font-bold shrink-0">⚡</div>
          <div className="flex-1">
            <h2 className="font-bold text-stratsight-dark text-lg tracking-wide">Nova Análise Prospectiva</h2>
            <p className="text-xs text-stratsight-medium mt-0.5">Preencha o escopo da análise ou carregue um documento de contexto.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 font-bold text-xl p-1">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <div className="bg-stratsight-light border border-stratsight-medium/30 rounded-xl p-4 text-sm text-stratsight-dark leading-relaxed">
            <strong>Como preencher:</strong> Informe ao menos o <em>tema/objeto</em> e o sistema sugere as demais opções. Você pode carregar documentos de contexto ou deixar todos os campos em branco e deixar o HERMES conduzir a sessão.
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Campo tema */}
            <div>
              <label className="block text-xs font-bold text-stratsight-dark uppercase mb-1.5 tracking-wide">1. Tema / Objeto de Análise <span className="text-stratsight-medium">(principal)</span></label>
              <input value={scopeForm.tema} onChange={set('tema')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-stratsight-medium outline-none transition-colors text-sm" placeholder="Ex: Cenários prospectivos para o setor de defesa até 2035" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stratsight-dark uppercase mb-1.5 tracking-wide">2. Horizonte Temporal</label>
                <input value={scopeForm.horizonte} onChange={set('horizonte')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-stratsight-medium outline-none transition-colors text-sm" placeholder="Ex: 10 anos (até 2035)" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stratsight-dark uppercase mb-1.5 tracking-wide">3. Quem Elabora</label>
                <input value={scopeForm.elaborador} onChange={set('elaborador')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-stratsight-medium outline-none transition-colors text-sm" placeholder="Ex: Célula de Inteligência Estratégica" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stratsight-dark uppercase mb-1.5 tracking-wide">4. Usuário / Cliente</label>
              <input value={scopeForm.cliente} onChange={set('cliente')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-stratsight-medium outline-none transition-colors text-sm" placeholder="Ex: Comando do Exército / Diretoria de Planejamento" />
            </div>

            <div>
              <label className="block text-xs font-bold text-stratsight-dark uppercase mb-1.5 tracking-wide">5. Questão Estratégica Central</label>
              <textarea value={scopeForm.questaoEstrategica} onChange={set('questaoEstrategica')} rows={2} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-stratsight-medium outline-none transition-colors text-sm resize-none" placeholder="Ex: Como o Brasil deve se posicionar diante das transformações tecnológicas no campo de batalha até 2035?" />
            </div>

            <div>
              <label className="block text-xs font-bold text-stratsight-dark uppercase mb-1.5 tracking-wide">6. Mudança Específica Já Identificada</label>
              <textarea value={scopeForm.mudancaIdentificada} onChange={set('mudancaIdentificada')} rows={2} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-stratsight-medium outline-none transition-colors text-sm resize-none" placeholder="Ex: Aceleração do uso de IA em sistemas autônomos de combate por potências rivais" />
            </div>

            <div>
              <label className="block text-xs font-bold text-stratsight-dark uppercase mb-1.5 tracking-wide">7. Instruções Livres para a IA <span className="text-stratsight-medium normal-case font-normal">(opcional)</span></label>
              <textarea value={scopeForm.instrucoes} onChange={set('instrucoes')} rows={3} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-stratsight-medium outline-none transition-colors text-sm resize-none" placeholder="Ex: Foco especial no impacto para o setor de defesa. Não abordar aspectos tributários." />
              <p className="text-[10px] text-gray-400 mt-1">Instruções de direcionamento, restrições ou preferências de formato que a IA deve seguir ao longo de toda a análise.</p>
            </div>
          </div>

          {/* Upload */}
          <div className="border-2 border-dashed border-stratsight-medium/40 rounded-xl p-4 bg-stratsight-light/50">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📂</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-stratsight-dark uppercase tracking-wide mb-1">Documentos de Contexto (opcional)</p>
                <p className="text-xs text-gray-500 mb-1">Carregue relatórios, estudos ou bases de dados. O sistema os incorporará como contexto da análise.</p>
                <p className="text-[10px] text-gray-400 mb-3">Formatos aceitos: PDF, DOCX, XLSX, CSV, TXT, MD, imagens · <strong>Tamanho máximo: 50 MB por envio</strong></p>
                <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} multiple className="hidden" onChange={handleFileChange} />
                <button onClick={() => fileInputRef.current?.click()} disabled={scopeExtracting} className="px-4 py-2 bg-white border border-stratsight-medium/40 text-stratsight-dark text-xs font-bold rounded-lg hover:bg-stratsight-light transition-colors shadow-sm disabled:opacity-50">
                  {scopeExtracting ? '⏳ Processando...' : '📎 Selecionar Arquivos'}
                </button>
                {scopeFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {scopeFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-white border border-stratsight-medium/30 rounded-full px-3 py-1 text-xs text-stratsight-dark">
                        <span>📄 {f.name}</span>
                        <button onClick={() => setScopeFiles(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 font-bold ml-1">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Equipe */}
          {teams.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-stratsight-dark uppercase mb-1.5 tracking-wide">Equipe Responsável <span className="text-stratsight-medium normal-case font-normal">(opcional)</span></label>
              <select value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-stratsight-medium outline-none transition-colors text-sm bg-white">
                <option value="">— Sem equipe vinculada —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}{t.description ? ` — ${t.description}` : ''}</option>)}
              </select>
            </div>
          )}

          {/* Metodologia */}
          <div>
            <label className="block text-xs font-bold text-stratsight-dark uppercase mb-1.5 tracking-wide">Metodologia de Análise</label>
            <select value={metodologia} onChange={e => setMetodologia(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-stratsight-medium outline-none transition-colors text-sm bg-white">
              {cenariosMethodologies.length > 0
                ? cenariosMethodologies.map(m => (
                    <option key={m.id} value={m.slug ?? m.name}>
                      {m.name}{m.description ? ` — ${m.description?.slice(0, 80)}` : ''}
                    </option>
                  ))
                : <option value="grumbach">Grumbach — Produção de Cenários Prospectivos</option>
              }
            </select>
          </div>

          {/* Nível de análise */}
          <div>
            <label className="block text-xs font-bold text-stratsight-dark uppercase mb-2 tracking-wide">Nível de Análise</label>
            <div className="grid grid-cols-2 gap-2">
              {VIZ_MODES.map(vm => (
                <button key={vm.id} onClick={() => setVizMode(vm.id)} className={`p-3 text-left border-2 rounded-xl transition-colors ${vizMode === vm.id ? 'border-stratsight-medium bg-stratsight-light text-stratsight-dark' : 'border-gray-200 bg-white text-gray-500 hover:border-stratsight-medium/50'}`}>
                  <div className="font-bold text-sm">{vm.label}</div>
                  <div className="text-[10px] mt-1 leading-tight text-gray-500">{vm.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 text-stratsight-medium border-2 border-gray-200 font-bold rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
          <button onClick={() => onStart({ scopeForm, scopeFiles, selectedTeamId, metodologia, vizMode })} className="flex-[2] py-3 bg-stratsight-dark text-white font-bold rounded-xl hover:bg-stratsight-medium transition-colors shadow-lg shadow-green-900/20">Iniciar Análise</button>
        </div>
      </div>
    </div>
  );
}
