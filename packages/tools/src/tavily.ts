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

    // ── TEST_MODE: retorna mock imediato — zero créditos, evita loops por 432 ──
    // Testes validam sequência e estrutura do relatório, não profundidade de pesquisa.
    if (process.env.TEST_MODE === 'true') {
      console.log(`[Tavily] 🧪 TEST_MODE — mock para: "${args.query}"`);
      return `[BUSCA WEB — MODO TESTE]\nQuery: ${args.query}\n\n` +
        `Resultado simulado para validação de fluxo:\n` +
        `1. Dado contextual sobre "${args.query}" disponível em fontes abertas.\n` +
        `   Contexto: Informações relevantes identificadas para análise prospectiva.\n\n` +
        `Use "buscar_dados_publicos" para dados macroeconômicos reais (BCB/IBGE/FMI).`;
    }

    // ── Modo SOBERANO: roteado para SearXNG self-hosted (se disponível) ───────
    if (connectivity === 'SOBERANO') {
      const searxngUrl = process.env.SEARXNG_URL;
      if (searxngUrl) {
        console.log(`[SearXNG] 🔒 SOBERANO — buscando: "${args.query}"`);
        try {
          const params = new URLSearchParams({ q: args.query, format: 'json', categories: 'general' });
          const res = await fetch(`${searxngUrl}/search?${params}`, {
            headers: { 'Accept': 'application/json' }
          });
          if (res.ok) {
            const data = await res.json();
            const results = (data.results ?? []).slice(0, 4);
            let result = `[Busca Soberana — SearXNG]\nQuery: ${args.query}\n\n[Resultados]:\n`;
            results.forEach((r: any, i: number) => {
              result += `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.content ?? r.snippet ?? ''}\n\n`;
            });
            return result || '[SearXNG] Nenhum resultado encontrado.';
          }
        } catch (e: any) {
          console.warn(`[SearXNG] Falha, continuando sem busca: ${e.message}`);
        }
        return '[SOBERANO] SearXNG indisponível. Use "buscar_documentos_internos" para fontes indexadas localmente.';
      }
      console.warn('[Tavily] Modo SOBERANO sem SearXNG — intenção analítica exposta externamente.');
    }

    // ── Brave Search (fallback primário quando Tavily está esgotado) ────────────
    // $5/1k requests + $5 free/mês. Ativar: BRAVE_SEARCH_API_KEY no .env
    const braveKey = process.env.BRAVE_SEARCH_API_KEY;
    if (braveKey) {
      try {
        console.log(`[Brave] 🦁 Buscando: "${args.query}"`);
        const res = await fetch(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(args.query)}&count=4&text_decorations=false`,
          { headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': braveKey } }
        );
        if (res.ok) {
          const data = await res.json();
          const results = data.web?.results ?? [];
          console.log(`[Brave] ✅ ${results.length} resultados.`);
          let result = `[Busca Web — Brave Search]\nQuery: ${args.query}\n\n[Fontes]:\n`;
          results.forEach((r: any, i: number) => {
            result += `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.description ?? ''}\n\n`;
          });
          return result;
        }
        console.warn(`[Brave] HTTP ${res.status} — tentando Tavily`);
      } catch (e: any) {
        console.warn(`[Brave] Falha: ${e.message} — tentando Tavily`);
      }
    }

    // ── Serper.io (fallback leve — snippets Google SERP, $1/1k requests) ────────
    // Ativar: SERPER_API_KEY no .env. Retorna snippets curtos (meta-descrição),
    // suficientes para o agente avançar quando Brave e Tavily estão indisponíveis.
    const serperKey = process.env.SERPER_API_KEY;
    if (serperKey && !braveKey) {
      try {
        console.log(`[Serper] 🔍 Buscando: "${args.query}"`);
        const res = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-Key': serperKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: args.query, num: 4, hl: 'pt' }),
        });
        if (res.ok) {
          const data = await res.json();
          const results = [...(data.organic ?? []), ...(data.knowledgeGraph ? [data.knowledgeGraph] : [])].slice(0, 4);
          console.log(`[Serper] ✅ ${results.length} resultados.`);
          let result = `[Busca Web — Serper/Google]\nQuery: ${args.query}\n\n[Fontes]:\n`;
          results.forEach((r: any, i: number) => {
            result += `${i + 1}. ${r.title ?? r.name ?? ''}\n   URL: ${r.link ?? r.website ?? ''}\n   ${r.snippet ?? r.description ?? ''}\n\n`;
          });
          return result;
        }
        console.warn(`[Serper] HTTP ${res.status} — tentando Tavily`);
      } catch (e: any) {
        console.warn(`[Serper] Falha: ${e.message} — tentando Tavily`);
      }
    }

    // ── Tavily (padrão quando Brave não está configurado) ────────────────────
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return 'Busca web não configurada. Use "buscar_dados_publicos" para dados macroeconômicos ou "buscar_documentos_internos" para fontes internas.';
    }

    console.log(`[Tavily] 🌐 Buscando: "${args.query}"`);

    try {
      // search_depth 'basic' (snippets semânticos, 1 crédito) vs 'advanced' (conteúdo completo, 2 créditos).
      // 'basic' cobre ~80% dos casos de Horizon Scanning; use 'advanced' apenas para análise documental densa.
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: args.query,
          search_depth: 'basic',   // era 'advanced' — 50% menos crédito por chamada
          include_answer: false,    // era true — reduz tokens de resposta
          max_results: 3            // era 5 — reduz custo e context bloat
        })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }

      const data = await res.json();
      console.log(`[Tavily] ✅ ${data.results?.length ?? 0} resultados retornados.`);

      let result = `[Busca Web]\nQuery: ${args.query}\n\n[Fontes]:\n`;
      data.results?.forEach((r: any, i: number) => {
        result += `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.content}\n\n`;
      });

      return result;
    } catch (error: any) {
      console.error(`[Tavily] ❌ Erro:`, error.message);
      return `Busca web indisponível: ${error.message}. Prossiga com dados disponíveis via "buscar_dados_publicos" ou "buscar_documentos_internos".`;
    }
  }
};
