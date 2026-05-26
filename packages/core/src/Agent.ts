import { generateText, streamText, jsonSchema, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { AgentContext, Tool } from "./types";

// ── Provider Factory ──────────────────────────────────────────────────────────
// LLM_PROVIDER=anthropic (default) → Claude via Anthropic API
// LLM_PROVIDER=ollama              → Ollama local via API OpenAI-compatível
//   OLLAMA_BASE_URL  (default: http://ollama:11434/v1)
//   OLLAMA_MODEL     (default: llama3.1:8b)
// Adicionar novos providers aqui quando necessário (gemini, bedrock, etc.).
function getModel(config?: { provider: string; model: string }) {
  const provider = config?.provider || process.env.LLM_PROVIDER || 'anthropic';

  if (provider === 'ollama') {
    const baseURL   = process.env.OLLAMA_BASE_URL || 'http://ollama:11434/v1';
    const modelName = config?.model || process.env.OLLAMA_MODEL || 'llama3.1:8b';
    // .chat() força OpenAIChatLanguageModel → /v1/chat/completions
    // A chamada padrão provider(model) usa OpenAIResponsesLanguageModel → /v1/responses
    // que o Ollama não implementa, causando Headers Timeout Error
    const ollama = createOpenAI({ baseURL, apiKey: 'ollama' });
    console.log(`[Provider] Ollama — ${baseURL} / ${modelName}`);
    return ollama.chat(modelName);
  }

  // Default: Anthropic
  const modelName = config?.model || process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';
  console.log(`[Provider] Anthropic — ${modelName}`);
  return anthropic(modelName);
}

// Agent.ts — motor de execução de agentes individuais via Vercel AI SDK v6

// RESOLUCAO DEFINITIVA DO TOOL CALLING (23/04/2026):
// ai@6.0.168 + @ai-sdk/anthropic@3.0.71
//
// Problema 1 - maxSteps ignorado: no SDK v6, o parâmetro é stopWhen: stepCountIs(N).
//   maxSteps: 10 é ignorado. O default é stepCountIs(1) → só 1 step → sem síntese.
//
// Problema 2 - inputSchema hack quebra execute: o hack anterior retornava um objeto
//   bare { jsonSchema: rawSchema } sem o método validate(). O SDK não conseguia
//   validar os args e pulava o execute. Fix: inputSchema = () => jsonSchema(rawSchema)
//   que retorna { _type, jsonSchema, validate } — o validate é passthrough.
//
// Problema 3 - toolChoice required em todos os steps: com stopWhen correto, o SDK
//   faz o loop. Mas toolChoice:'required' se aplica a todos os steps, impedindo a
//   síntese. Fix: usar prepareStep para forçar 'required' só no step 0.
//
// REGRA CRITICA: ZOD NAO E USADO AQUI. Ver secao 3.4 do HISTORICO_MIGRACAO.md.

const TOOL_JSON_SCHEMAS: Record<string, object> = {
  consultar_agente: {
    type: "object",
    properties: {
      agent_name: {
        type: "string",
        description: "Nome do agente especialista a ser consultado.",
      },
      query: {
        type: "string",
        description: "A pergunta ou tarefa detalhada a ser resolvida pelo agente. MÁXIMO 300 CARACTERES. Seja objetivo e conciso.",
      },
    },
    required: ["agent_name", "query"],
  },
  web_search: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "A string de busca exata. MÁXIMO 100 CARACTERES. Seja conciso.",
      },
    },
    required: ["query"],
  },
  buscar_dados_publicos: {
    type: "object",
    properties: {
      indicadores: {
        type: "array",
        items: {
          type: "string",
          enum: [
            // BCB/SGS — Nacional
            "selic", "cdi", "ipca", "ipca_12m", "igpm",
            "cambio_venda", "cambio_compra", "reservas",
            "divida_pib", "credito_pib", "ibc_br",
            // IBGE — Nacional
            "desemprego", "pib_tri", "pib_anual",
            // IPEA Data — Nacional
            "divida_bruta", "tjlp", "divida_externa", "igpdi", "fbkf",
            // Comex Stat MDic — Nacional
            "exportacoes", "importacoes", "balanca_comercial",
            // Banco Mundial
            "wb_pib", "wb_crescimento", "wb_inflacao_wb",
            "wb_conta_corrente", "wb_divida_central", "wb_fdi",
            "wb_desemprego", "wb_populacao", "wb_gini",
            "wb_exportacoes", "wb_importacoes",
            // FMI/WEO
            "imf_crescimento", "imf_inflacao", "imf_conta_corrente",
            "imf_divida_publica", "imf_desemprego", "imf_saldo_fiscal",
            // OMS/WHO
            "who_expectativa_vida", "who_mortalidade_infantil",
            "who_mortalidade_materna", "who_cobertura_vacinas",
            // ONU Population
            "un_populacao", "un_crescimento",
            // IBGE Países
            "ibge_pais_perfil", "ibge_turistas", "ibge_educacao",
            // ITU DataHub
            "itu_internet", "itu_celular", "itu_banda_larga",
            "itu_movel_bb", "itu_idi",
          ],
        },
        description: "Lista de indicadores. Nacionais dispensam 'pais'. Internacionais requerem 'pais' em ISO3. Máximo 5 por chamada.",
        maxItems: 5,
      },
      pais: {
        type: "string",
        description: "Código ISO3 do país para indicadores internacionais (wb_*, imf_*, who_*, un_*, ibge_pais_*, itu_*). Ex: BRA, USA, ARG, CHN, DEU. Padrão: BRA.",
      },
      termo_dou: {
        type: "string",
        description: "Termo de busca para o Diário Oficial da União Seção 1. Ativa a busca no DOU independente dos indicadores.",
      },
    },
    required: ["indicadores"],
  },
  buscar_documentos_internos: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Consulta semântica para recuperar trechos dos documentos carregados pelo cliente. Use antes do web_search.",
      },
    },
    required: ["query"],
  },
  registrar_sinal: {
    type: "object",
    properties: {
      titulo:              { type: "string" },
      descricao:           { type: "string" },
      tipo:                { type: "string", enum: ["weak_signal","wild_card","tendencia","megatendencia"] },
      classificacao:       { type: "string", enum: ["confirmavel","ambiguo","ruido"] },
      origemFonte:         { type: "string" },
      tipoEvidencia:       { type: "string", enum: ["anedotico","fragmentado","padrao_emergente"] },
      porQueNovo:          { type: "string" },
      potencialDisruptivo: { type: "string" },
      atoresPortadores:    { type: "string" },
      janelaAnos:          { type: "string", enum: ["2-5","5-10","incerto"] },
      clusterId:           { type: "string" },
    },
    required: ["titulo", "descricao", "tipo", "classificacao"],
  },
  buscar_sinais: {
    type: "object",
    properties: {
      filtroClassificacao: { type: "array", items: { type: "string" } },
      filtroStatusRadar:   { type: "array", items: { type: "string" } },
      incluirArquivados:   { type: "boolean" },
    },
    required: [],
  },
  atualizar_sentinela: {
    type: "object",
    properties: {
      signalId:        { type: "string" },
      sentinela:       { type: "number", enum: [1, 2] },
      descricao:       { type: "string" },
      fonte:           { type: "string" },
      status:          { type: "string", enum: ["inativo","ativo","disparado"] },
      interpretacao:   { type: "string" },
      acaoRecomendada: { type: "string" },
      statusRadar:     { type: "string", enum: ["monitorando","amplificando","materializado","arquivado"] },
    },
    required: ["signalId", "sentinela", "status"],
  },
  // ── ICD 203 Analytic Standards Tools ────────────────────────────────────────
  declarar_julgamento: {
    type: "object",
    properties: {
      informacaoBase:         { type: "string" },
      premissas:              { type: "array", items: { type: "string" } },
      julgamento:             { type: "string" },
      grauProbabilidade:      { type: "string", enum: ["remoto (01-05%)","altamente improvável (05-20%)","improvável (20-45%)","aproximadamente igual (45-55%)","provável (55-80%)","altamente provável (80-95%)","quase certo (95-99%)"] },
      nivelConfianca:         { type: "string", enum: ["alta confiança","confiança moderada","baixa confiança"] },
      indicadoresDeAlteracao: { type: "array", items: { type: "string" } },
      premissaLinchpin:       { type: "string" },
      contextoAnalise:        { type: "string" },
    },
    required: ["informacaoBase","premissas","julgamento","grauProbabilidade","nivelConfianca"],
  },
  registrar_hipotese_alternativa: {
    type: "object",
    properties: {
      hipotesePrincipal: { type: "string" },
      alternativas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            descricao:                      { type: "string" },
            premissas:                      { type: "array", items: { type: "string" } },
            probabilidade:                  { type: "string" },
            pontosFracosVsHipotesePrincipal:{ type: "string" },
            indicadoresDeAtivacao:          { type: "array", items: { type: "string" } },
          },
          required: ["descricao","probabilidade","pontosFracosVsHipotesePrincipal"],
        },
      },
      racionalRejeicao: { type: "string" },
    },
    required: ["hipotesePrincipal","alternativas","racionalRejeicao"],
  },
  avaliar_fonte: {
    type: "object",
    properties: {
      url:                    { type: "string" },
      titulo:                 { type: "string" },
      tipo:                   { type: "string", enum: ["primaria_oficial","academica_revisada","midia_referencia","think_tank","industria","midia_nicho","desconhecida"] },
      dataPublicacao:         { type: "string" },
      fidelidadeAoDocumento:  { type: "string", enum: ["citacao_direta","parafraseada_fiel","inferida","extrapolada"] },
      possibilidadeNeD:       { type: "boolean" },
      informacaoUsada:        { type: "string" },
      avaliacaoCredibilidade: { type: "string", enum: ["alta","moderada","baixa","indeterminada"] },
      notas:                  { type: "string" },
    },
    required: ["url","tipo","fidelidadeAoDocumento","informacaoUsada","avaliacaoCredibilidade"],
  },
  // ── Ferramentas Analíticas Avançadas (Fase 1 — JSON Schema puro, sem Zod) ──
  tool_unified_search_engine: {
    type: "object",
    required: ["query", "connectivityMode"],
    properties: {
      query: { type: "string" },
      connectivityMode: { type: "string", enum: ["ONLINE", "SOBERANO", "AIR_GAPPED"] },
      domainRestriction: { type: "string" },
      maxTokenBudget: { type: "integer", default: 6000 },
    },
  },
  tool_register_event: {
    type: "object",
    required: ["projectId", "name", "description", "type"],
    properties: {
      projectId: { type: "string" },
      name: { type: "string" },
      description: { type: "string" },
      type: { type: "string", enum: ["trend", "uncertainty", "inflection_factor", "fpf"] },
      reliability: { type: "string", enum: ["A", "B", "C", "D", "E", "F"] },
      credibility: { type: "string", enum: ["1", "2", "3", "4", "5", "6"] },
    },
  },
  tool_mpc_source_evaluator: {
    type: "object",
    required: ["eventId", "reliability", "credibility"],
    properties: {
      eventId: { type: "string" },
      reliability: { type: "string", enum: ["A", "B", "C", "D", "E", "F"] },
      credibility: { type: "string", enum: ["1", "2", "3", "4", "5", "6"] },
      justification: { type: "string" },
    },
  },
  tool_register_impact_relation: {
    type: "object",
    required: ["projectId", "fromEventId", "toEventId", "impactScore"],
    properties: {
      projectId: { type: "string" },
      fromEventId: { type: "string" },
      toEventId: { type: "string" },
      impactScore: { type: "integer", minimum: 0, maximum: 3 },
    },
  },
  tool_grumbach_expert_simulation: {
    type: "object",
    required: ["projectId", "eventIds"],
    properties: {
      projectId: { type: "string" },
      eventIds: { type: "array", items: { type: "string" } },
      numberOfExpertPersonas: { type: "integer", default: 7 },
      domain: { type: "string" },
    },
  },
  tool_mactor_analysis: {
    type: "object",
    required: ["actorsRelations"],
    properties: {
      actorsRelations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            actorId: { type: "string" },
            targetActorId: { type: "string" },
            influenceScore: { type: "integer", minimum: -3, maximum: 3 },
          },
          required: ["actorId", "targetActorId", "influenceScore"],
        },
      },
    },
  },
  tool_mpo_backcasting: {
    type: "object",
    required: ["projectId", "targetScenarioId"],
    properties: {
      projectId: { type: "string" },
      targetScenarioId: { type: "string" },
      horizonYears: { type: "integer", default: 30 },
      intermediateHorizons: { type: "array", items: { type: "integer" } },
    },
  },
};

const FALLBACK_JSON_SCHEMA = {
  type: "object",
  properties: {},
  required: [] as string[],
};

export class Agent {
  constructor(
    public name: string,
    public role: string,
    private systemPrompt: string,
    public tools: Tool[] = [],
  ) {}

  async run(
    input: string | any[],
    context: AgentContext,
    vizMode: string = "etapa",
  ): Promise<string> {
    console.log(`[${this.name}] Iniciando raciocínio...`);

    // Injetar extra_instructions por metodologia (Sprint 1 → populado via seed na Sprint 2)
    let finalSystemPrompt = this.systemPrompt;
    const extra = context.agentMethodPrompts?.[this.name];
    if (extra) {
      finalSystemPrompt += `\n\n[METODOLOGIA ATIVA: ${context.methodology}]\n${extra}`;
    }
    // Âncora de contexto: eventos aprovados pelo analista — prefixada para evitar Context Bloat
    if (context.anchorContext) {
      finalSystemPrompt = context.anchorContext + "\n\n" + finalSystemPrompt;
    }

    const rawMessages: any[] = [...context.memory];
    if (input) {
      rawMessages.push({ role: "user", content: input });
    }

    const messages: any[] = [];
    for (const msg of rawMessages) {
      if (messages.length === 0) {
        if (msg.role === "assistant") continue;
        messages.push(msg);
      } else {
        const prev = messages[messages.length - 1];
        if (prev.role === msg.role) {
          if (typeof prev.content === "string" && typeof msg.content === "string") {
            messages[messages.length - 1] = {
              ...prev,
              content: prev.content + `\n\n${msg.content}`,
            };
          } else {
            messages[messages.length - 1] = {
              ...prev,
              content: [
                ...(Array.isArray(prev.content)
                  ? prev.content
                  : [{ type: "text", text: prev.content }]),
                ...(Array.isArray(msg.content)
                  ? msg.content
                  : [{ type: "text", text: msg.content }]),
              ],
            };
          }
        } else {
          messages.push(msg);
        }
      }
    }

    const aiTools: Record<string, any> = {};

    for (const t of this.tools) {
      // Prioriza o schema dinâmico vindo da ferramenta, ou faz fallback para o estático
      const rawSchema = t.schema || TOOL_JSON_SCHEMAS[t.name] || FALLBACK_JSON_SCHEMA;
      const wrappedSchema = jsonSchema(rawSchema as any);

      console.log(`[${this.name}] Registrando ferramenta: ${t.name} -> ${JSON.stringify(rawSchema)}`);

      const myTool = tool({
        description: t.description,
        parameters: wrappedSchema,
        execute: async (args: any) => {
          if (context.onToolCall) context.onToolCall(t.name, args);
          console.log(`[${this.name}] Executando ferramenta: ${t.name}`, JSON.stringify(args));
          return await t.execute(args, context);
        },
      } as any);

      // Fix: inputSchema deve retornar jsonSchema() completo (com validate)
      // para o SDK conseguir validar os args e invocar o execute.
      (myTool as any).inputSchema = () => jsonSchema(rawSchema as any);

      aiTools[t.name] = myTool;
    }

    // ── vizMode — controla profundidade de orquestração e limite de tokens ────
    // "etapa"    (padrão): análise por etapa de metodologia, maxTokens=32_000
    // "passos"  : passo-a-passo detalhado — instrução extra injetada em chat.ts,
    //             maxTokens=32_000
    // "passagem": processo autônomo completo — instrução de síntese em chat.ts,
    //             maxTokens=16_000 (reduz custo em sessões de contexto longo)
    // "thinking": raciocínio estendido — instrução de profundidade em chat.ts,
    //             maxTokens=32_000. ⚠️ NÃO usa a API ExtendedThinking da Anthropic;
    //             apenas adiciona instrução de prompt. Compatibilidade com Ollama
    //             não garantida (depende do suporte do modelo local).
    const maxTokens =
      vizMode === "thinking" ? 32000
      : vizMode === "passagem" ? 16000
      : 32000;

    const hasTools = Object.keys(aiTools).length > 0;

    // ── Formatador de mensagem de progresso por step ──────────────────────────
    const TOOL_ICONS: Record<string, string> = {
      web_search: '🌐', buscar_dados_publicos: '📊', consultar_agente: '🤖',
      buscar_documentos_internos: '📚', registrar_sinal: '📡', buscar_sinais: '📡',
      atualizar_sentinela: '🎯', declarar_julgamento: '⚖️',
      registrar_hipotese_alternativa: '🔀', avaliar_fonte: '🔍',
    };
    const stepLabel = (toolName: string, args: any): string => {
      const icon = TOOL_ICONS[toolName] || '🔧';
      if (toolName === 'web_search') return `${icon} Buscando: "${(args.query || '').slice(0, 60)}"`;
      if (toolName === 'buscar_dados_publicos') return `${icon} Dados: ${(args.indicadores || []).slice(0, 3).join(', ')}`;
      if (toolName === 'consultar_agente') return `${icon} Consultando ${args.agent_name}...`;
      if (toolName === 'buscar_documentos_internos') return `${icon} RAG: "${(args.query || '').slice(0, 50)}"`;
      if (toolName === 'avaliar_fonte') return `${icon} Avaliando fonte...`;
      if (toolName === 'declarar_julgamento') return `${icon} Emitindo julgamento analítico...`;
      if (toolName === 'registrar_hipotese_alternativa') return `${icon} Hipótese alternativa...`;
      return `${icon} ${toolName}(${JSON.stringify(args).slice(0, 40)})`;
    };

    const AGENT_MODEL_OVERRIDES: Record<string, string> = {
      SCOPUS:    'claude-sonnet-4-6',
      KRATOS:    'claude-sonnet-4-6',
      KLIO:      'claude-opus-4-7',
      PYTHIA:    'claude-opus-4-7',
      MNEMOSYNE: 'claude-opus-4-7',
      THEMIS:    'claude-opus-4-7',
      ATHENA:    'claude-opus-4-7',
    };
    const agentOverride = (context.llmConfig?.provider ?? 'anthropic') === 'anthropic'
      ? AGENT_MODEL_OVERRIDES[this.name]
      : undefined;
    const effectiveConfig = agentOverride
      ? { provider: 'anthropic' as const, model: agentOverride }
      : context.llmConfig;
    if (agentOverride) console.log(`[${this.name}] Modelo override → ${agentOverride}`);

    const sharedParams = {
      model: getModel(effectiveConfig),
      system: finalSystemPrompt,
      messages,
      tools: hasTools ? aiTools : undefined,
      stopWhen: stepCountIs(15),
      prepareStep: hasTools
        ? async ({ stepNumber }: { stepNumber: number }) => ({
            toolChoice: stepNumber === 0 ? ("required" as const) : ("auto" as const),
          })
        : undefined,
      maxTokens,
      onStepFinish: async ({ toolCalls, text }: any) => {
        if (!context.onStep) return;
        if (toolCalls && toolCalls.length > 0) {
          for (const tc of toolCalls) {
            context.onStep(`[${this.name}] ${stepLabel(tc.toolName, tc.args)}`);
          }
        } else if (text && text.length > 10) {
          context.onStep(`[${this.name}] 💭 Sintetizando resposta...`);
        }
      },
    } as any;

    // ── Detectar tool call emitido como texto bruto (Ollama/modelos pequenos) ──
    // Modelos que não suportam structured tool calling obedecem o systemPrompt
    // ("inicie com **HERMES** · ") e depois emitem o JSON da ferramenta como texto.
    // A detecção simples startsWith('{') falha por causa desse prefixo.
    const isRawToolCallText = (text: string, toolCallCount: number): boolean => {
      if (toolCallCount > 0) return false; // ferramenta foi executada de verdade — OK
      if (text.length > 900) return false;  // texto longo demais para ser só uma tool call
      // Remove prefixos tipo "**HERMES** · " ou "**OLYMPUS** · " que o modelo adiciona
      const stripped = text.replace(/^\*\*[A-Z][A-Z_0-9]*\*\*\s*[·•·\-–—]\s*/u, '').trim();
      if (!stripped.startsWith('{')) return false;
      // Procura padrões de tool call: {"name":..., "parameters":...} ou {"tool_call":...}
      return (
        (stripped.includes('"name"') || stripped.includes('"tool_name"') || stripped.includes('"tool_call"')) &&
        (stripped.includes('"parameters"') || stripped.includes('"arguments"') || stripped.includes('"input"'))
      );
    };

    const RAW_TOOL_CALL_WARN = (agentName: string) =>
      `\n\n⚠️ **${agentName}** não conseguiu acionar o agente especialista porque o modelo **${context.llmConfig?.model ?? 'Ollama'}** não suporta tool calling estruturado. Ele emitiu a chamada como texto bruto.\n\n**Solução:** troque para Anthropic Claude (recomendado) ou um modelo Ollama maior com suporte a function calling, como **llama3.1:70b**, **llama3.3:70b** ou **qwen2.5:72b**.`;

    if (context.onToken) {
      // Token-by-token streaming — used only by the orchestrator (SSE route)
      const result = streamText(sharedParams);
      for await (const delta of result.textStream) {
        context.onToken(delta);
      }
      const finalText = (await result.text) || "Análise concluída.";
      if (hasTools) {
        const stepsArr = await result.steps;
        const actualCalls = stepsArr.reduce((n: number, s: any) => n + (s.toolCalls?.length ?? 0), 0);
        if (isRawToolCallText(finalText, actualCalls)) {
          const warn = RAW_TOOL_CALL_WARN(this.name);
          context.onToken(warn);
          return finalText + warn;
        }
      }
      return finalText;
    }

    // O chat.ts já faz o stamp do orquestrador; aqui só garantimos agentes especialistas
    const response = await generateText(sharedParams);
    const finalText = response.text || "Análise concluída.";
    if (hasTools) {
      const actualCalls = response.steps.reduce((n: number, s: any) => n + (s.toolCalls?.length ?? 0), 0);
      if (isRawToolCallText(finalText, actualCalls)) {
        return RAW_TOOL_CALL_WARN(this.name);
      }
    }
    return finalText;
  }
}
