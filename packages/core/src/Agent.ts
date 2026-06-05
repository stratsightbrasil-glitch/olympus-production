import { generateText, streamText, jsonSchema, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { AgentContext, Tool } from "./types";

// ── Provider Factory ──────────────────────────────────────────────────────────
// LLM_PROVIDER=anthropic (default) → Claude via Anthropic API
//   ANTHROPIC_API_KEY, ANTHROPIC_MODEL (default: claude-haiku-4-5-20251001)
// LLM_PROVIDER=google                → Google Gemini via AI Studio / Vertex
//   GOOGLE_GENERATIVE_AI_API_KEY, model ex: gemini-2.0-flash
// LLM_PROVIDER=groq                  → Groq (llama-3.3-70b-versatile, muito rápido)
//   GROQ_API_KEY, GROQ_MODEL (default: llama-3.3-70b-versatile)
// LLM_PROVIDER=ollama                → Ollama local via API OpenAI-compatível
//   OLLAMA_BASE_URL (default: http://ollama:11434/v1), OLLAMA_MODEL
export function getModel(config?: { provider: string; model: string }) {
  const provider = config?.provider || process.env.LLM_PROVIDER || 'anthropic';

  switch (provider) {
    case 'anthropic': {
      const modelName = config?.model || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
      console.log(`[Provider] Anthropic — ${modelName}`);
      return anthropic(modelName);
    }
    case 'google': {
      // Lê GOOGLE_GENERATIVE_AI_API_KEY automaticamente do ambiente
      const modelName = config?.model || process.env.GOOGLE_MODEL || 'gemini-2.0-flash';
      console.log(`[Provider] Google — ${modelName}`);
      return google(modelName);
    }
    case 'groq': {
      // Groq: inferência ultra-rápida (LPU), free tier generoso, ideal para testes
      const apiKey    = process.env.GROQ_API_KEY || '';
      const modelName = config?.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
      const groq      = createGroq({ apiKey });
      console.log(`[Provider] Groq — ${modelName}`);
      return groq(modelName);
    }
    case 'deepseek': {
      // DeepSeek API é compatível com OpenAI — usa @ai-sdk/openai com base URL customizada
      const baseURL   = 'https://api.deepseek.com/v1';
      const apiKey    = process.env.DEEPSEEK_API_KEY || '';
      const modelName = config?.model || 'deepseek-chat';
      const deepseek  = createOpenAI({ baseURL, apiKey });
      console.log(`[Provider] DeepSeek — ${modelName}`);
      return deepseek.chat(modelName);
    }
    case 'ollama': {
      const baseURL   = process.env.OLLAMA_BASE_URL || 'http://ollama:11434/v1';
      const modelName = config?.model || process.env.OLLAMA_MODEL || 'llama3.1:8b';
      // .chat() força OpenAIChatLanguageModel → /v1/chat/completions
      // A chamada padrão provider(model) usa OpenAIResponsesLanguageModel → /v1/responses
      // que o Ollama não implementa, causando Headers Timeout Error
      const ollama = createOpenAI({ baseURL, apiKey: 'ollama' });
      console.log(`[Provider] Ollama — ${baseURL} / ${modelName}`);
      return ollama.chat(modelName);
    }
    default:
      throw new Error(
        `[Provider] Provedor LLM desconhecido: "${provider}". Suportados: anthropic, google, groq, deepseek, ollama.`
      );
  }
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

// Schemas de ferramentas built-in (web_search) e das ferramentas
// carregadas via DB que ainda não têm schema próprio no seu arquivo de implementação.
// Ferramentas com schema próprio em analytical-engines.ts (tool_register_event,
// tool_register_impact_relation, tool_grumbach_expert_simulation, tool_mactor_analysis,
// tool_mpo_backcasting, tool_unified_search_engine, tool_mpc_source_evaluator) são
// resolvidas pelo fallback `t.schema` em Agent.run() — não precisam de entrada aqui.
const TOOL_JSON_SCHEMAS: Record<string, object> = {
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
      sentinela:       { type: "string", enum: ["1", "2"] },
      descricao:       { type: "string" },
      fonte:           { type: "string" },
      status:          { type: "string", enum: ["inativo","ativo","disparado"] },
      interpretacao:   { type: "string" },
      acaoRecomendada: { type: "string" },
      statusRadar:     { type: "string", enum: ["monitorando","amplificando","materializado","arquivado"] },
    },
    required: ["signalId", "sentinela", "status"],
  },
  // ── Harmonized Scenario Schema ───────────────────────────────────────────────
  tool_register_scenario: {
    type: "object",
    properties: {
      name:            { type: "string" },
      type:            { type: "string", enum: ["inercial","alternative","target","pessimist","optimist"] },
      probability:     { type: "number", minimum: 0, maximum: 1 },
      hendriksonLabel: { type: "string", enum: ["quase_certo","muito_provavel","provavel","possivel","improvavel","remoto"] },
      description:     { type: "string" },
      axes:            { type: "object", properties: { ic1Label: { type: "string" }, ic1Pole: { type: "string", enum: ["+","-"] }, ic2Label: { type: "string" }, ic2Pole: { type: "string", enum: ["+","-"] } } },
      binaryEvents:    { type: "object", additionalProperties: { type: "boolean" } },
    },
    required: ["name", "type", "probability", "hendriksonLabel"],
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
};

const FALLBACK_JSON_SCHEMA = {
  type: "object",
  properties: {},
  required: [] as string[],
};

// ── P2: Module-scope constants (extracted from run() — allocated once, not per call) ─

const TOOL_ICONS: Record<string, string> = {
  web_search:                      '🌐',
  buscar_dados_publicos:           '📊',
  buscar_documentos_internos:      '📚',
  registrar_sinal:                 '📡',
  buscar_sinais:                   '📡',
  atualizar_sentinela:             '🎯',
  declarar_julgamento:             '⚖️',
  registrar_hipotese_alternativa:  '🔀',
  avaliar_fonte:                   '🔍',
};

function stepLabel(toolName: string, args: any): string {
  const icon = TOOL_ICONS[toolName] || '🔧';
  if (toolName === 'web_search')                return `${icon} Buscando: "${(args.query || '').slice(0, 60)}"`;
  if (toolName === 'buscar_dados_publicos')      return `${icon} Dados: ${(args.indicadores || []).slice(0, 3).join(', ')}`;
  if (toolName === 'buscar_documentos_internos') return `${icon} RAG: "${(args.query || '').slice(0, 50)}"`;
  if (toolName === 'avaliar_fonte')              return `${icon} Avaliando fonte...`;
  if (toolName === 'declarar_julgamento')        return `${icon} Emitindo julgamento analítico...`;
  if (toolName === 'registrar_hipotese_alternativa') return `${icon} Hipótese alternativa...`;
  return `${icon} ${toolName}(${JSON.stringify(args).slice(0, 40)})`;
}

// Pre-compiled once at module load — not inside run()
const RAW_TOOL_CALL_RE = /^\*\*[A-Z][A-Z_0-9]*\*\*\s*[·•·\-–—]\s*/u;

function isRawToolCallText(text: string, toolCallCount: number): boolean {
  if (toolCallCount > 0) return false; // ferramenta foi executada de verdade — OK
  if (text.length > 900) return false; // texto longo demais para ser só uma tool call
  const stripped = text.replace(RAW_TOOL_CALL_RE, '').trim();
  if (!stripped.startsWith('{')) return false;
  return (
    (stripped.includes('"name"') || stripped.includes('"tool_name"') || stripped.includes('"tool_call"')) &&
    (stripped.includes('"parameters"') || stripped.includes('"arguments"') || stripped.includes('"input"'))
  );
}

function rawToolCallWarn(agentName: string, modelLabel: string): string {
  return `\n\n⚠️ **${agentName}** não conseguiu acionar o agente especialista porque o modelo **${modelLabel}** não suporta tool calling estruturado. Ele emitiu a chamada como texto bruto.\n\n**Solução:** troque para Anthropic Claude (recomendado) ou um modelo Ollama maior com suporte a function calling, como **llama3.1:70b**, **llama3.3:70b** ou **qwen2.5:72b**.`;
}

// ── Agent class ───────────────────────────────────────────────────────────────

export class Agent {
  constructor(
    public name: string,
    public role: string,
    private systemPrompt: string,
    public tools: Tool[] = [],
    // P3: model routing from DB — null means "use whatever the context provides"
    public modelOverride?: string | null,
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

    // Guard contra loop de ferramenta (Bug A — Gemini chama a mesma ferramenta N vezes
    // com args idênticos quando não recebe resposta satisfatória).
    // Rastreia por ferramenta: { argsKey, count, cachedResult }.
    const toolCallTracker: Record<string, { argsKey: string; count: number; cachedResult: any }> = {};
    const TOOL_LOOP_MAX = 2; // permite até 2 chamadas idênticas consecutivas; da 3ª em diante devolve cache

    for (const t of this.tools) {
      if (!t.name) {
        console.error(`[${this.name}] ⚠️ Ferramenta sem nome encontrada em toolsConfig — ignorada.`, t);
        continue;
      }
      // Prioriza o schema dinâmico vindo da ferramenta, ou faz fallback para o estático
      const rawSchema = t.schema || TOOL_JSON_SCHEMAS[t.name] || FALLBACK_JSON_SCHEMA;
      const wrappedSchema = jsonSchema(rawSchema as any);

      // Schema completo só em DEBUG — evitar 162 dumps por análise (18 tools × 9 fases)
      if (process.env.LOG_LEVEL === 'debug') {
        console.log(`[${this.name}] Registrando ferramenta: ${t.name} -> ${JSON.stringify(rawSchema)}`);
      } else {
        console.log(`[${this.name}] Registrando ferramenta: ${t.name}`);
      }

      const myTool = tool({
        description: t.description,
        parameters: wrappedSchema,
        execute: async (args: any) => {
          if (context.onToolCall) context.onToolCall(t.name, args);

          // Detectar chamadas consecutivas idênticas (loop de ferramenta)
          const argsKey = JSON.stringify(args);
          const tracker = toolCallTracker[t.name];
          if (tracker && tracker.argsKey === argsKey) {
            tracker.count++;
            if (tracker.count > TOOL_LOOP_MAX) {
              console.warn(`[${this.name}] ⚠️ Loop detectado: ${t.name} chamado ${tracker.count}× com args idênticos — devolvendo resultado em cache.`);
              return tracker.cachedResult;
            }
          } else {
            toolCallTracker[t.name] = { argsKey, count: 1, cachedResult: null };
          }

          console.log(`[${this.name}] Executando ferramenta: ${t.name}`, JSON.stringify(args));
          const result = await t.execute(args, context);
          toolCallTracker[t.name].cachedResult = result;
          return result;
        },
      } as any);

      // Fix: inputSchema deve retornar jsonSchema() completo (com validate)
      // para o SDK conseguir validar os args e invocar o execute.
      (myTool as any).inputSchema = () => jsonSchema(rawSchema as any);

      aiTools[t.name] = myTool;
    }

    // ── P3: Model routing — tier→model resolution via platform_settings ──────
    // agents.model_override armazena um label de tier ('economy' | 'premium') ou,
    // como fallback de compatibilidade, um ID de modelo direto (ex: 'claude-sonnet-4-6').
    // context.llmTiers carrega o mapa { economy: '<model-id>', premium: '<model-id>' }
    // de platform_settings — atualizável pela UI de Settings sem alterar código ou seed.
    // P3: tier routing — provider-agnóstico
    // agents.model_override = label do tier ('economy' | 'premium') ou ID de modelo direto.
    // llmTiers mapeia tier label → model ID para o provider ativo.
    // Funciona para qualquer provider: Anthropic, Google, DeepSeek, etc.
    const activeProvider = context.llmConfig?.provider ?? 'anthropic';
    const rawOverride    = this.modelOverride;                           // tier label ou ID direto
    const resolvedModel  = rawOverride
      ? ((context.llmTiers ?? {})[rawOverride] ?? rawOverride)          // tier→ID ou passthrough
      : undefined;
    const effectiveConfig = resolvedModel
      ? { provider: activeProvider, model: resolvedModel }
      : context.llmConfig;
    if (resolvedModel) console.log(`[${this.name}] Tier [${rawOverride}] → ${resolvedModel} (${activeProvider})`);

    // ── vizMode — controla profundidade de orquestração e limite de tokens ────
    // "etapa"    (padrão): análise por etapa de metodologia, maxTokens=32_000
    // "passos"  : passo-a-passo detalhado — instrução extra injetada em chat.ts
    // "passagem": processo autônomo completo — maxTokens=16_000 (reduz custo)
    // "thinking": raciocínio estendido — instrução de profundidade em chat.ts
    // TEST_MODE: limita tokens e steps para completar em <30s/agente.
    const isTestMode = process.env.TEST_MODE === 'true';
    // Olympus 1.0: orquestrador detectado exclusivamente por nome.
    // HERMES (synthesisNode) e OLYMPUS (stub v2.0) recebem maxSteps/maxTokens maiores
    // pois compilam relatórios longos a partir de múltiplos phase_outputs.
    const isOrchestrator = this.name === 'HERMES' || this.name === 'OLYMPUS';
    // HERMES (synthesisNode) precisa de 32k para compilar o relatório final a partir de 9 fases.
    // KLIO em uma fase analítica individual: 12k é mais que suficiente e evita OOM.
    // HERMES: 32k para compilar relatório final (9 phase_outputs).
    // KLIO: 8k por fase — suficiente para análises de qualidade, reduz picos de
    // memória que causavam OOM (exit 137) nas fases tardias do Grumbach.
    const maxTokens = isTestMode
      ? (isOrchestrator ? 8_000 : 4_000)
      : vizMode === "thinking"  ? 32000
      : isOrchestrator          ? 32000
      : 8000;
    // Orquestradores: 30 em TEST_MODE, 15 em produção.
    // Especialistas (KLIO): 5 em TEST_MODE, 12 em produção.
    const maxSteps = isOrchestrator ? (isTestMode ? 30 : 15) : (isTestMode ? 5 : 12);

    const hasTools = Object.keys(aiTools).length > 0;

    // System prompt: sempre string pura.
    // A abordagem de prompt cache via array [{type:'text', providerOptions:{cacheControl}}]
    // foi removida — o @ai-sdk/anthropic@3.0.71 não aceita esse formato no campo `system`
    // (requer string ou SystemModelMessage com role:'system'). Causa: InvalidPromptError.
    // TODO: reintroduzir cache quando migrar para @ai-sdk/anthropic≥3.1 ou via messages[].
    const systemContent: string = finalSystemPrompt;

    const sharedParams = {
      model: getModel(effectiveConfig),
      system: systemContent,
      messages,
      tools: hasTools ? aiTools : undefined,
      stopWhen: stepCountIs(maxSteps),
      prepareStep: hasTools
        ? async ({ stepNumber }: { stepNumber: number }) => ({
            toolChoice: stepNumber === 0 ? ("required" as const) : ("auto" as const),
          })
        : undefined,
      // AI SDK v6: parâmetro correto é maxOutputTokens (maxTokens era v4/v5)
      maxOutputTokens: maxTokens,
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
    const modelLabel = context.llmConfig?.model ?? 'Ollama';

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
          const warn = rawToolCallWarn(this.name, modelLabel);
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
        return rawToolCallWarn(this.name, modelLabel);
      }
    }
    return finalText;
  }
}
