import { db } from "@olympus/db";
import { projectEvents, projectScenarios, matrixDirectImpacts, techniqueExecutionOutputs } from "@olympus/db";
import { eq, and } from "drizzle-orm";

export interface OlympusTool {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, any>; required: string[] };
  execute: (args: any, context?: any) => Promise<string>;
}

// ── 1. MOTOR DE BUSCA UNIFICADO — MODOS DE SOBERANIA ─────────────────────────
export const toolUnifiedSearchEngine: OlympusTool = {
  name: "tool_unified_search_engine",
  description: `Buscador estratégico em dois passos com três modos de soberania de dados.
ONLINE: Tavily para extração de conteúdo em fontes primárias (.gov.br, .mil.br, organismos internacionais).
SOBERANO: Repositório vetorial local (RAG interno) — intenção analítica não exposta a APIs externas.
AIR_GAPPED: Bloqueio total de requisições SaaS — exclusivamente documentos indexados no projeto.
Parâmetro maxTokenBudget controla o tamanho do resultado para evitar Context Bloat.`,
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Query de pesquisa analítica refinada" },
      connectivityMode: { type: "string", enum: ["ONLINE", "SOBERANO", "AIR_GAPPED"] },
      domainRestriction: { type: "string", description: "Filtro de domínio (ex: eb.mil.br, ipea.gov.br)" },
      maxTokenBudget: { type: "integer", default: 6000, description: "Limite de tokens do resultado" },
    },
    required: ["query", "connectivityMode"],
  },
  execute: async (args) => {
    const { query, connectivityMode, domainRestriction, maxTokenBudget = 6000 } = args;

    if (connectivityMode === "AIR_GAPPED") {
      return JSON.stringify({
        mode: "AIR_GAPPED",
        message: "Busca restrita ao RAG local. Nenhuma requisição externa enviada.",
        instruction: "Chamar buscar_documentos_internos com esta query.",
        query,
      });
    }

    if (connectivityMode === "SOBERANO") {
      return JSON.stringify({
        mode: "SOBERANO",
        message: "Intenção analítica não exposta externamente. Usar RAG local prioritariamente.",
        query,
      });
    }

    // ONLINE — Tavily
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) return JSON.stringify({ error: "TAVILY_API_KEY não configurada." });

    const searchQuery = domainRestriction ? `site:${domainRestriction} ${query}` : query;
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: tavilyKey, query: searchQuery, search_depth: "advanced", max_results: 5 }),
      });
      const data = await res.json() as { results?: Array<{ title: string; url: string; content: string }> };
      const results = (data.results ?? []).map(r => ({
        title: r.title, url: r.url, excerpt: r.content?.substring(0, 800),
      }));
      const text = JSON.stringify(results);
      return text.length > maxTokenBudget * 4 ? text.substring(0, maxTokenBudget * 4) + "...[truncado]" : text;
    } catch (err: any) {
      return JSON.stringify({ error: `Falha Tavily: ${err.message}` });
    }
  },
};

// ── 2. REGISTRO DE EVENTO BOOLEANO ────────────────────────────────────────────
export const toolRegisterEvent: OlympusTool = {
  name: "tool_register_event",
  description: `Registra um Fato Portador de Futuro (FPF), tendência estruturante, incerteza crítica ou fator de inflexão geopolítica no banco como evento booleano discreto (OCORRE/NÃO OCORRE).
Esses eventos são os blocos construtivos das matrizes combinatórias de cenários.
O analista humano aprova ou rejeita via painel (HITL) antes de Pythia usar os dados.`,
  parameters: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      name: { type: "string", description: "Nome curto (máx 60 chars)" },
      description: { type: "string", description: "Descrição completa e relevância prospectiva" },
      type: { type: "string", enum: ["trend", "uncertainty", "inflection_factor", "fpf"] },
      reliability: { type: "string", enum: ["A", "B", "C", "D", "E", "F"], description: "Idoneidade MPC da fonte" },
      credibility: { type: "string", enum: ["1", "2", "3", "4", "5", "6"], description: "Credibilidade MPC do fato" },
    },
    required: ["projectId", "name", "description", "type"],
  },
  execute: async (args) => {
    const { projectId, name, description, type, reliability = "C", credibility = "3" } = args;
    try {
      const [event] = await db.insert(projectEvents).values({
        projectId,
        name: name.substring(0, 255),
        description,
        type,
        status: "proposed",
        sourceEvaluation: { reliability, credibility },
      }).returning({ id: projectEvents.id });
      return JSON.stringify({
        success: true,
        eventId: event.id,
        message: `Evento '${name}' [${type}] registrado. Status: proposed — aguardando aprovação HITL.`,
      });
    } catch (err: any) {
      return JSON.stringify({ error: `Falha ao registrar: ${err.message}` });
    }
  },
};

// ── 3. AVALIAÇÃO ALFANUMÉRICA MPC ─────────────────────────────────────────────
export const toolMpcSourceEvaluator: OlympusTool = {
  name: "tool_mpc_source_evaluator",
  description: `Aplica classificação alfanumérica militar MPC (EB70-MT-10.401) a um evento registrado.
Idoneidade (A-F): A=completamente confiável, B=geralmente confiável, C=suficientemente confiável,
D=geralmente não confiável, E=não confiável, F=idoneidade não julgável.
Credibilidade (1-6): 1=confirmado por outras fontes, 2=provavelmente verdadeiro, 3=possivelmente verdadeiro,
4=duvidoso, 5=improvável, 6=veracidade não julgável.`,
  parameters: {
    type: "object",
    properties: {
      eventId: { type: "string", description: "UUID do evento em project_events" },
      reliability: { type: "string", enum: ["A", "B", "C", "D", "E", "F"] },
      credibility: { type: "string", enum: ["1", "2", "3", "4", "5", "6"] },
      justification: { type: "string", description: "Justificativa analítica" },
    },
    required: ["eventId", "reliability", "credibility"],
  },
  execute: async (args) => {
    const { eventId, reliability, credibility, justification } = args;
    try {
      await db.update(projectEvents)
        .set({ sourceEvaluation: { reliability, credibility, justification }, updatedAt: new Date() })
        .where(eq(projectEvents.id, eventId));
      return JSON.stringify({ success: true, evaluation: `${reliability}${credibility}`, eventId });
    } catch (err: any) {
      return JSON.stringify({ error: `Falha MPC: ${err.message}` });
    }
  },
};

// ── 4. REGISTRO DA MATRIZ DE IMPACTO DIRETO (MICMAC INPUT) ───────────────────
export const toolRegisterImpactRelation: OlympusTool = {
  name: "tool_register_impact_relation",
  description: `Registra o impacto direto entre dois eventos aprovados na matriz N×N do MICMAC.
Escala: 0=sem influência, 1=fraca, 2=moderada, 3=forte.
Deve ser chamado para cada par de eventos após aprovação HITL.
O pythia_node usará essa matriz para calcular M^k e posicionar variáveis no plano cartesiano.`,
  parameters: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      fromEventId: { type: "string", description: "UUID do evento que exerce influência" },
      toEventId: { type: "string", description: "UUID do evento que recebe influência" },
      impactScore: { type: "integer", minimum: 0, maximum: 3, description: "0=nulo, 1=fraco, 2=médio, 3=forte" },
    },
    required: ["projectId", "fromEventId", "toEventId", "impactScore"],
  },
  execute: async (args) => {
    const { projectId, fromEventId, toEventId, impactScore } = args;
    try {
      await db.insert(matrixDirectImpacts)
        .values({ projectId, fromEventId, toEventId, impactScore })
        .onConflictDoNothing();
      return JSON.stringify({ success: true, relation: `${fromEventId} →[${impactScore}]→ ${toEventId}` });
    } catch (err: any) {
      return JSON.stringify({ error: `Falha matriz: ${err.message}` });
    }
  },
};

// ── 5. SIMULAÇÃO DO PAINEL DE PERITOS GRUMBACH ────────────────────────────────
export const toolGrumbachExpertSimulation: OlympusTool = {
  name: "tool_grumbach_expert_simulation",
  description: `Instancia painel simulado de especialistas com perspectivas complementares e conflitantes.
Calcula probabilidades simples P(i) de cada FPF e probabilidades condicionais cruzadas P(i|j).
Produz a base matemática para seleção das cenas de cenário mais prováveis.
Use apenas com FPFs aprovados pelo analista (status='approved').`,
  parameters: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      eventIds: { type: "array", items: { type: "string" }, description: "UUIDs dos FPFs aprovados (10-15)" },
      numberOfExpertPersonas: { type: "integer", default: 7, description: "Número de personas (mín 5)" },
      domain: { type: "string", description: "Domínio do painel (ex: defesa, energia)" },
    },
    required: ["projectId", "eventIds"],
  },
  execute: async (args) => {
    const { projectId, eventIds, numberOfExpertPersonas = 7, domain = "estratégia" } = args;
    const approved = await db.select({ id: projectEvents.id, name: projectEvents.name })
      .from(projectEvents)
      .where(and(eq(projectEvents.projectId, projectId), eq(projectEvents.status, "approved")));

    const validIds = eventIds.filter((id: string) => approved.some(e => e.id === id));
    if (validIds.length < 3) {
      return JSON.stringify({
        error: "Mínimo 3 eventos aprovados necessários.",
        approvedCount: approved.length,
        requestedCount: eventIds.length,
      });
    }
    return JSON.stringify({
      instruction: `Simule ${numberOfExpertPersonas} especialistas em ${domain} avaliando cada FPF.`,
      validEventIds: validIds,
      eventNames: approved.filter(e => validIds.includes(e.id)).map(e => e.name),
      outputFormat: "Para cada evento: P(i) simples [0.0-1.0]. Para pares relevantes: P(i|j ocorre) e P(i|j não ocorre). JSON com UUIDs como chaves.",
      personas: [
        "Otimista estrutural", "Pessimista estratégico", "Tecnocrata institucional",
        "Analista geopolítico", `Especialista em ${domain}`,
        ...(numberOfExpertPersonas > 5 ? ["Inovador disruptivo"] : []),
        ...(numberOfExpertPersonas > 6 ? ["Historiador comparativo"] : []),
      ].slice(0, numberOfExpertPersonas),
    });
  },
};

// ── 6. ANÁLISE MACTOR ─────────────────────────────────────────────────────────
export const toolMactorAnalysis: OlympusTool = {
  name: "tool_mactor_analysis",
  description: `Calcula matrizes de influência e dependência entre atores estratégicos (MACTOR — Godet).
Classifica atores em: MOTOR (alta influência/baixa dependência), RELÉ, DEPENDENTE, AUTÔNOMO.
Identifica convergências (aliados) e divergências (oponentes) táticas.`,
  parameters: {
    type: "object",
    properties: {
      actorsRelations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            actorId: { type: "string" },
            targetActorId: { type: "string" },
            influenceScore: { type: "integer", minimum: -3, maximum: 3, description: "-3=bloqueio total, 0=neutro, 3=suporte total" },
          },
          required: ["actorId", "targetActorId", "influenceScore"],
        },
      },
    },
    required: ["actorsRelations"],
  },
  execute: async (args) => {
    const { actorsRelations } = args;
    const actors = [...new Set([
      ...actorsRelations.map((r: any) => r.actorId),
      ...actorsRelations.map((r: any) => r.targetActorId),
    ])];
    const influence: Record<string, number> = {};
    const dependence: Record<string, number> = {};
    actors.forEach(a => { influence[a] = 0; dependence[a] = 0; });
    actorsRelations.forEach((r: any) => {
      const abs = Math.abs(r.influenceScore);
      influence[r.actorId] = (influence[r.actorId] || 0) + abs;
      dependence[r.targetActorId] = (dependence[r.targetActorId] || 0) + abs;
    });
    const avg = actors.reduce((s, a) => s + (influence[a] + dependence[a]) / 2, 0) / (actors.length || 1);
    const classification = actors.map(a => {
      const i = influence[a] || 0, d = dependence[a] || 0;
      const q = i > avg && d < avg ? "MOTOR" : i > avg && d > avg ? "RELÉ" : i < avg && d > avg ? "DEPENDENTE" : "AUTÔNOMO";
      return { actor: a, influence: i, dependence: d, quadrant: q };
    });
    return JSON.stringify({ actorClassification: classification, totalActors: actors.length });
  },
};

// ── 7. BACKCASTING MPO ────────────────────────────────────────────────────────
export const toolMpoBackcasting: OlympusTool = {
  name: "tool_mpo_backcasting",
  description: `Executa retroprospecção (Backcasting) a partir de cenário-alvo normativo aprovado.
Desdobra o futuro desejado em marcos intermediários e identifica políticas necessárias em cada horizonte.
Usado em MPO (Estratégia Brasil 2050) e SIPLEx (PBC — Planejamento Baseado em Capacidades).`,
  parameters: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      targetScenarioId: { type: "string", description: "UUID do cenário normativo em project_scenarios" },
      horizonYears: { type: "integer", default: 30 },
      intermediateHorizons: { type: "array", items: { type: "integer" }, description: "Ex: [5,10,20,30]" },
    },
    required: ["projectId", "targetScenarioId"],
  },
  execute: async (args) => {
    const { projectId, targetScenarioId, horizonYears = 30, intermediateHorizons = [5, 10, 20, 30] } = args;
    const [scenario] = await db.select().from(projectScenarios)
      .where(and(eq(projectScenarios.projectId, projectId), eq(projectScenarios.id, targetScenarioId)));
    if (!scenario) return JSON.stringify({ error: `Cenário ${targetScenarioId} não encontrado.` });
    const horizons = (intermediateHorizons as number[]).filter(h => h <= horizonYears).sort((a, b) => a - b);
    return JSON.stringify({
      targetScenario: { id: scenario.id, name: scenario.name, probability: scenario.probability },
      horizonYears,
      instruction: `A partir de '${scenario.name}', construa linha do tempo regressiva. Para cada horizonte [${horizons.join(", ")} anos]: (1) estado do sistema, (2) marcos regulatórios necessários, (3) capacidades institucionais requeridas, (4) signposts de verificação, (5) riscos de desvio.`,
      horizons: horizons.map((h: number) => ({ year: new Date().getFullYear() + h, label: `H+${h}` })),
    });
  },
};

// ── 8. ESG RII CALCULATOR ─────────────────────────────────────────────────────
export const toolEsgRiiCalculator: OlympusTool = {
  name: "tool_esg_rii_calculator",
  description: `Calcula o Ranking Integrado de Incertezas (RII) da metodologia ESG/Escola Superior de Guerra.
Fórmula: II = I × (6 - G) × (6 - C)
  I = Impacto sistêmico (1-5): quanto o sistema muda se esta variável mudar
  G = Governabilidade (1-5): grau de controle dos atores sobre a variável
  C = Convergência (1-5): nível de consenso de interesses dos atores
Lógica: maior impacto + menor controle + menor consenso = maior incerteza.
Retorna variáveis ranqueadas por II decrescente e identifica as 2 Incertezas Críticas (IC1, IC2).
Persiste resultado em technique_execution_outputs para consulta pelo MNEMOSYNE.`,
  parameters: {
    type: "object",
    properties: {
      projectId:  { type: "string", description: "UUID do projeto" },
      variables:  {
        type: "array",
        description: "Lista de variáveis/eventos a ranquear",
        items: {
          type: "object",
          properties: {
            name:           { type: "string",  description: "Nome da variável ou evento" },
            impact:         { type: "number",  description: "Impacto sistêmico I (1-5)" },
            governability:  { type: "number",  description: "Governabilidade G pelos atores estratégicos (1-5)" },
            convergence:    { type: "number",  description: "Convergência C de interesses dos atores (1-5)" },
          },
          required: ["name", "impact", "governability", "convergence"],
        },
      },
    },
    required: ["projectId", "variables"],
  },
  execute: async (args) => {
    const { projectId, variables } = args as {
      projectId: string;
      variables: Array<{ name: string; impact: number; governability: number; convergence: number }>;
    };

    if (!variables || variables.length === 0) {
      return JSON.stringify({ error: "Nenhuma variável fornecida para o RII." });
    }

    // Calcular II = I × (6 - G) × (6 - C) para cada variável
    const ranked = variables
      .map(v => ({
        name:          v.name,
        I:             v.impact,
        G:             v.governability,
        C:             v.convergence,
        II:            v.impact * (6 - v.governability) * (6 - v.convergence),
      }))
      .sort((a, b) => b.II - a.II);

    const topTwo = ranked.slice(0, 2).map(v => v.name);
    const result = {
      methodology: "ESG — Ranking Integrado de Incertezas (RII)",
      formula:     "II = I × (6 - G) × (6 - C)",
      ranked,
      topTwo,
      ic1: topTwo[0] ?? null,
      ic2: topTwo[1] ?? null,
      interpretation: `As 2 incertezas críticas estruturantes da Matriz de Cenários são: IC1="${topTwo[0]}" e IC2="${topTwo[1] ?? 'N/A'}".`,
    };

    // Persistir em technique_execution_outputs
    try {
      await db.insert(techniqueExecutionOutputs).values({
        projectId,
        techniqueType: "esg_rii",
        outputData:    result,
      });
    } catch { /* upsert silencioso — não bloqueia o agente */ }

    return JSON.stringify(result);
  },
};

// ── FACTORY — Tool<any> com projectId injetado via closure ───────────────────
// Compatível com o sistema de ferramentas do Agent.ts (@olympus/core).
// Mesma estrutura de createSignalTools: não expõe projectId no schema (o agente não precisa saber).

export interface ProjectBoundTool {
  name: string;
  description: string;
  schema: Record<string, any>;
  execute: (args: any, ctx?: any) => Promise<string>;
}

export function createAnalyticalEngineTools(projectId: string): Record<string, ProjectBoundTool> {
  // Helper: cria schema sem o campo projectId (injetado via closure)
  function withoutProjectId(params: OlympusTool['parameters']): Record<string, any> {
    const { projectId: _pid, ...rest } = params.properties;
    return {
      type: params.type,
      properties: rest,
      required: params.required.filter(r => r !== 'projectId'),
    };
  }

  const registerEvent: ProjectBoundTool = {
    name: toolRegisterEvent.name,
    description: toolRegisterEvent.description,
    schema: withoutProjectId(toolRegisterEvent.parameters),
    execute: (args) => toolRegisterEvent.execute({ ...args, projectId }),
  };

  const registerImpactRelation: ProjectBoundTool = {
    name: toolRegisterImpactRelation.name,
    description: toolRegisterImpactRelation.description,
    schema: withoutProjectId(toolRegisterImpactRelation.parameters),
    execute: (args) => toolRegisterImpactRelation.execute({ ...args, projectId }),
  };

  const grumbachExpertSimulation: ProjectBoundTool = {
    name: toolGrumbachExpertSimulation.name,
    description: toolGrumbachExpertSimulation.description,
    schema: withoutProjectId(toolGrumbachExpertSimulation.parameters),
    execute: (args) => toolGrumbachExpertSimulation.execute({ ...args, projectId }),
  };

  return {
    [registerEvent.name]:             registerEvent,
    [registerImpactRelation.name]:    registerImpactRelation,
    [grumbachExpertSimulation.name]:  grumbachExpertSimulation,
  };
}

// ── EXPORTAÇÕES ────────────────────────────────────────────────────────────────
export const analyticalEngineTools: OlympusTool[] = [
  toolUnifiedSearchEngine,
  toolRegisterEvent,
  toolMpcSourceEvaluator,
  toolRegisterImpactRelation,
  toolGrumbachExpertSimulation,
  toolMactorAnalysis,
  toolMpoBackcasting,
  toolEsgRiiCalculator,
];

export const analyticalEngineSchemas: Record<string, object> = Object.fromEntries(
  analyticalEngineTools.map(t => [t.name, t.parameters])
);
