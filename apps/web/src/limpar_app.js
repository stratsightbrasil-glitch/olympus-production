const fs = require('fs');
const path = require('path');
const file = path.join('D:', 'Pessoais', 'DEV', 'Olympus_v4', 'apps', 'web', 'src', 'App.tsx');

let code = fs.readFileSync(file, 'utf-8');

const startMarker = '{/* Histórico de Sessões */}';
const endMarker = '{/* Agentes */}';

const startIndex = code.indexOf(startMarker);
const endIndex = code.lastIndexOf(endMarker); // Pega o último para apagar todas as duplicações

if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
  const lines = [
    '{/* Histórico de Sessões */}',
    '            <div className="mt-2">',
    '              <button onClick={() => { setShowSessoes(s => !s); if (!showSessoes) carregarSessoes(); }} className="w-full px-3 py-2 bg-white/5 hover:bg-white/10 text-sm rounded-lg transition-colors text-left text-gray-200 flex justify-between items-center">',
    '                <span>{showSessoes ? \'▲\' : \'▼\'} Histórico de Análises</span>',
    '                {sessoes.length > 0 && <span className="bg-stratsight-dark text-[#A5D6A7] px-1.5 py-0.5 rounded text-[10px] font-bold">{sessoes.length}</span>}',
    '              </button>',
    '              {showSessoes && (',
    '                <div className="mt-2 max-h-48 overflow-y-auto pr-1 space-y-1">',
    '                  {sessoes.length === 0 ? (',
    '                    <div className="text-xs text-gray-400 px-2 py-1">Nenhuma análise salva.</div>',
    '                  ) : (',
    '                    <>',
    '                      {sessoes.filter(s => s.status === \'Em produção\' || !s.status).length > 0 && (',
    '                        <div className="mb-2">',
    '                          <div className="text-[9px] text-[#90CAF9] font-bold px-2 py-1 uppercase">Em Produção</div>',
    '                          {sessoes.filter(s => s.status === \'Em produção\' || !s.status).map(s => (',
    '                            <div key={s.id} onClick={() => carregarSessao(s.id)} className="p-2 bg-black/20 hover:bg-black/40 border border-white/5 rounded-lg cursor-pointer transition-colors group relative mb-1">',
    '                              <div className="text-xs font-bold text-white truncate pr-6">{s.name || \'(sem título)\'}</div>',
    '                              <div className="flex justify-between items-center mt-1">',
    '                                <span className="text-[9px] text-[#A5D6A7]">{s.methodology}</span>',
    '                                <span className="text-[9px] text-gray-500">{new Date(s.updatedAt).toLocaleDateString(\'pt-BR\')}</span>',
    '                              </div>',
    '                              <button onClick={(e) => deletarSessao(s.id, e)} className="absolute top-1 right-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">✕</button>',
    '                            </div>',
    '                          ))}',
    '                        </div>',
    '                      )}',
    '                      {sessoes.filter(s => s.status === \'Ativo\').length > 0 && (',
    '                        <div className="mb-2">',
    '                          <div className="text-[9px] text-[#66BB6A] font-bold px-2 py-1 uppercase">Monitorados (Ativos)</div>',
    '                          {sessoes.filter(s => s.status === \'Ativo\').map(s => (',
    '                            <div key={s.id} onClick={() => carregarSessao(s.id)} className="p-2 bg-black/20 hover:bg-black/40 border border-white/5 rounded-lg cursor-pointer transition-colors group relative mb-1">',
    '                              <div className="text-xs font-bold text-white truncate pr-6">{s.name || \'(sem título)\'}</div>',
    '                              <div className="flex justify-between items-center mt-1">',
    '                                <span className="text-[9px] text-[#A5D6A7]">{s.methodology}</span>',
    '                                <span className="text-[9px] text-gray-500">{new Date(s.updatedAt).toLocaleDateString(\'pt-BR\')}</span>',
    '                              </div>',
    '                              <button onClick={(e) => deletarSessao(s.id, e)} className="absolute top-1 right-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">✕</button>',
    '                            </div>',
    '                          ))}',
    '                        </div>',
    '                      )}',
    '                      {sessoes.filter(s => s.status === \'Inativo\').length > 0 && (',
    '                        <div>',
    '                          <div className="text-[9px] text-gray-500 font-bold px-2 py-1 uppercase">Arquivados (Inativos)</div>',
    '                          {sessoes.filter(s => s.status === \'Inativo\').map(s => (',
    '                            <div key={s.id} onClick={() => carregarSessao(s.id)} className="p-2 bg-black/10 hover:bg-black/30 border border-white/5 rounded-lg cursor-pointer transition-colors group relative opacity-70 mb-1">',
    '                              <div className="text-xs font-bold text-gray-300 truncate pr-6">{s.name || \'(sem título)\'}</div>',
    '                              <div className="flex justify-between items-center mt-1">',
    '                                <span className="text-[9px] text-[#A5D6A7]">{s.methodology}</span>',
    '                                <span className="text-[9px] text-gray-500">{new Date(s.updatedAt).toLocaleDateString(\'pt-BR\')}</span>',
    '                              </div>',
    '                              <button onClick={(e) => deletarSessao(s.id, e)} className="absolute top-1 right-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">✕</button>',
    '                            </div>',
    '                          ))}',
    '                        </div>',
    '                      )}',
    '                    </>',
    '                  )}',
    '                </div>',
    '              )}',
    '            </div>',
    '          </div>',
    '',
    '          {/* Agentes */}'
  ];
  
  const cleanBlock = lines.join('\n');
  const newCode = code.substring(0, startIndex) + cleanBlock + code.substring(endIndex + endMarker.length);
  fs.writeFileSync(file, newCode, 'utf-8');
  console.log('✅ Arquivo App.tsx corrigido e limpo com sucesso!');
} else {
  console.log('❌ Não encontrou os marcadores no arquivo.');
}
