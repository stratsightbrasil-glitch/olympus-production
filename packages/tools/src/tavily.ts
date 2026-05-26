import { Tool } from '@olympus/core';

export type TavilyArgs = {
  query: string;
};

export const tavilySearchTool: Tool<TavilyArgs> = {
  name: 'web_search',
  description: 'Realiza uma busca na internet em tempo real para encontrar informações atualizadas, notícias recentes, dados macroeconômicos ou evidências para cenários prospectivos. Use esta ferramenta SEMPRE que o usuário perguntar sobre dados do presente ou quando precisar embasar os "Drivers" com fatos reais do ambiente.',
  schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'A string de busca exata. MÁXIMO 100 CARACTERES. Seja extremamente conciso (ex: "taxa selic atual brasil"). NUNCA envie parágrafos longos ou a ferramenta falhará!'
      }
    },
    required: ['query']
  } as any,

  execute: async (args: TavilyArgs, context: any) => {
    // ── Modo de soberania: bloqueia acesso externo em AIR_GAPPED ──────────────
    const connectivity = context?.connectivityMode ?? 'ONLINE';
    if (connectivity === 'AIR_GAPPED') {
      return '[BLOQUEADO — AIR_GAPPED] Acesso à internet proibido neste modo de soberania. Use "buscar_documentos_internos" para consultar documentos indexados localmente.';
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return 'Erro do Sistema: A variável TAVILY_API_KEY não foi configurada. Informe o usuário de que o sistema não está com acesso à internet no momento.';
    }

    if (connectivity === 'SOBERANO') {
      console.warn('[Tavily] Modo SOBERANO — busca autorizada mas intenção analítica não deve ser exposta externamente.');
    }

    console.log(`[Tavily] 🌐 Buscando: "${args.query}"`);

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: args.query,
          search_depth: 'advanced',
          include_answer: true,
          max_results: 5
        })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }

      const data = await res.json();
      console.log(`[Tavily] ✅ ${data.results?.length ?? 0} resultados retornados.`);

      let result = `[Resposta gerada pela Busca Web]\nResumo: ${data.answer || 'Sem resumo direto.'}\n\n[Fontes Encontradas]:\n`;
      data.results?.forEach((r: any, i: number) => {
        result += `${i + 1}. Título: ${r.title}\n   URL: ${r.url}\n   Conteúdo: ${r.content}\n\n`;
      });

      return result;
    } catch (error: any) {
      console.error(`[Tavily] ❌ Erro:`, error.message);
      return `Falha ao tentar acessar a internet: ${error.message}`;
    }
  }
};
