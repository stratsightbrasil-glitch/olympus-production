/**
 * nodes.ts v5 (Olympus 1.0)
 *
 * Dois nós apenas:
 *  - phaseLoopNode: executa KLIO para a fase atual, persiste phase_output
 *  - synthesisNode: HERMES compila relatório final a partir dos phase_outputs
 *
 * Sem roteamento entre especialistas. Sem loadMemoryWindow para contexto.
 * PHASE_CONFIGS exportado para builder.ts.
 */

import { interrupt }          from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";
import { Agent }               from "@olympus/core";
import type { OlympusState }   from "@olympus/core";
import {
  db,
  phaseOutputs,
  agents as agentsTable,
  messages,
  projectEvents,
  projects,
} from "@olympus/db";
import { eq, asc, gte, and, inArray, sql } from "drizzle-orm";
import { athenaAuditPhase }           from "./athena-validator";
import type { KeyFinding }            from "./athena-validator";
import { loadPhaseContext, buildPhaseSummary, loadPhaseConfigs } from "./phase-context";
import { buildToolsForPhase, buildAnchorCtx } from "./helpers";
import type { PhaseConfig }           from "./phase-configs/grumbach";

// ── Caches de dados estáticos por análise ──────────────────────────────────────
// KLIO e project name são consultados em CADA uma das 9 fases — dados estáticos.
// Cache elimina 2 DB round-trips × 9 fases = 18 queries desnecessárias por análise.
const STATIC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

let _klioCache: { row: any; expiresAt: number } | null = null;

async function getCachedKlioRow() {
  const now = Date.now();
  if (_klioCache && now < _klioCache.expiresAt) return _klioCache.row;
  const row = await db.query.agents.findFirst({ where: eq(agentsTable.name, "KLIO") });
  _klioCache = { row, expiresAt: now + STATIC_CACHE_TTL_MS };
  return row;
}

const _projectNameCache = new Map<string, { name: string; expiresAt: number }>();

async function getCachedProjectName(projectId: string): Promise<string> {
  const now = Date.now();
  const cached = _projectNameCache.get(projectId);
  if (cached && now < cached.expiresAt) return cached.name;
  const row = await db.query.projects.findFirst({
    columns: { name: true },
    where: eq(projects.id, projectId),
  });
  const name = row?.name || "Não especificado";
  _projectNameCache.set(projectId, { name, expiresAt: now + STATIC_CACHE_TTL_MS });
  return name;
}

// Invalida project name cache ao deletar/atualizar (chamado externamente se necessário)
export function invalidateProjectNameCache(projectId: string) {
  _projectNameCache.delete(projectId);
}

// ── Cache de ferramentas por projeto + conjunto de ferramentas ─────────────────
// buildToolsForPhase cria 16 closures a cada chamada — mesmo projectId, mesmos tools.
// Para 9 fases: 9 × 16 = 144 objetos idênticos por análise. Cache por chave composta.
const _toolsCache = new Map<string, { tools: any[]; expiresAt: number }>();

function getToolsCacheKey(projectId: string, allowedTools: string[]): string {
  return `${projectId}:${[...allowedTools].sort().join(',')}`;
}

export function getCachedTools(
  allowedTools: string[],
  projectId: string,
  llmConfig?: any,
  llmTiers?: any,
): any[] {
  const key = getToolsCacheKey(projectId, allowedTools);
  const now = Date.now();
  const cached = _toolsCache.get(key);
  if (cached && now < cached.expiresAt) return cached.tools;
  const tools = buildToolsForPhase(allowedTools, projectId, llmConfig, llmTiers);
  _toolsCache.set(key, { tools, expiresAt: now + STATIC_CACHE_TTL_MS });
  return tools;
}

// ── Nó de loop de fases ────────────────────────────────────────────────────────

export async function phaseLoopNode(
  state:  OlympusState,
  config: RunnableConfig,
): Promise<Partial<OlympusState>> {
  const onStep  = config?.configurable?.onStep  as ((msg: string) => void) | undefined;
  const onToken = config?.configurable?.onToken as ((delta: string) => void) | undefined;
  const onAgent = config?.configurable?.onAgent as ((name: string) => void) | undefined;

  const methodology  = state.methodology ?? "grumbach";
  // loadPhaseConfigs lê do banco (com cache 5min) — lança erro descritivo se
  // a metodologia não tem systemPromptInject configurado via seed.
  const phaseConfigs = await loadPhaseConfigs(methodology);

  const currentIndex = state.currentPhaseIndex ?? 0;

  if (currentIndex >= phaseConfigs.length) {
    throw new Error(
      `[phaseLoopNode] currentPhaseIndex=${currentIndex} >= ${phaseConfigs.length}. `
      + "Deveria estar em synthesisNode."
    );
  }

  const phaseConfig = phaseConfigs[currentIndex];
  onAgent?.("KLIO");
  onStep?.(`[KLIO] Iniciando fase ${phaseConfig.phaseNum}: ${phaseConfig.label}`);

  // ── Portão HITL antes da fase (se requerido) ──────────────────────────────
  if (phaseConfig.requiresHitlBefore && process.env.TEST_MODE !== "true") {
    interrupt({
      interruptType: "hitl_required",
      agent:         "KLIO",
      phaseSlug:     phaseConfig.phaseSlug,
      phaseNum:      phaseConfig.phaseNum,
      message:       `Portão de revisão — Fase ${phaseConfig.phaseNum}: ${phaseConfig.label}. `
                   + "Revise os Fatos Portadores de Futuro (FPFs) no painel lateral. "
                   + "Aprove os relevantes e rejeite os que não se aplicam ao escopo. "
                   + "Ao concluir, clique em Continuar.",
      projectId:     state.projectId,
    });
  }

  // ── Round-trip 1: parallelizar todas as queries independentes ─────────────
  // firstPhaseOutput, phaseContext, klioRow, projectName em um único Promise.all.
  // anchorContext precisa de firstPhaseOutput.createdAt → round-trip 2 (dependente).
  const [firstPhaseOutput, phaseContext, klioRow, projectName] = await Promise.all([
    currentIndex > 0
      ? db.query.phaseOutputs.findFirst({
          where:   eq(phaseOutputs.projectId, state.projectId),
          orderBy: [asc(phaseOutputs.phaseNum)],
          columns: { createdAt: true },
        })
      : Promise.resolve(null),
    loadPhaseContext(state.projectId),
    getCachedKlioRow(),         // cached — elimina 1 DB query por fase
    getCachedProjectName(state.projectId), // cached — elimina 1 DB query por fase
  ]);

  if (!klioRow) throw new Error("[phaseLoopNode] Agente KLIO não encontrado no banco.");

  // ── Round-trip 2: anchorContext (depende de firstPhaseOutput) ─────────────
  const anchorContext = await buildAnchorCtx(
    state.projectId,
    state.connectivityMode,
    firstPhaseOutput?.createdAt ?? undefined,
    state.methodology,   // controla formato TAD: alfanumérico (siex/alta/ceeex) vs semântico
  );

  onStep?.(`[KLIO] Contexto: ${phaseContext.phaseCount} fase(s) ant. (~${phaseContext.estimatedTokens} tokens)`);

  // ── System prompt: base KLIO + guardrail de objeto + diretriz da fase + contexto
  // O guardrail de objeto é injetado ANTES do systemPromptInject da fase para garantir
  // que KLIO nunca analise um tema diferente do projeto ativo.
  const fullSystemPrompt = [
    klioRow.systemPrompt,
    `[OBJETO DE ANÁLISE DESTE PROJETO — INVIOLÁVEL]\nProjeto: "${projectName}"\nMetodologia: ${state.methodology}\nKLIO DEVE analisar exclusivamente este objeto. Não derive o tema de análise de eventos residuais, contextos anteriores ou suposições próprias.`,
    phaseConfig.systemPromptInject.trim(),
    phaseContext.contextText || "",
    anchorContext || "",
  ].filter(Boolean).join("\n\n");

  // ── Ferramentas para esta fase (cached) ──────────────────────────────────
  // buildToolsForPhase cria 16 closures por chamada; para 9 fases = 144 objetos.
  // getCachedTools reutiliza closures idênticas para o mesmo projectId+toolSet.
  const tools = getCachedTools(
    phaseConfig.allowedTools,
    state.projectId,
    state.llmConfig,
    state.llmTiers,
  );

  // ── Executar KLIO ─────────────────────────────────────────────────────────
  const agent = new Agent(
    "KLIO",
    klioRow.role,
    fullSystemPrompt,
    tools,
    klioRow.modelOverride ?? undefined,
  );

  const agentCtx = {
    projectId:          state.projectId,
    methodology:        state.methodology,
    memory:             [],            // sem loadMemoryWindow — contexto via phaseContext
    llmConfig:          state.llmConfig,
    llmTiers:           state.llmTiers,
    phases:             state.phases,
    agentMethodPrompts: {},            // prompts injetados via fullSystemPrompt
    connectivityMode:   state.connectivityMode,
    onStep,
    onToken,
  };

  // Timestamp de início da fase capturado do relógio do POSTGRESQL (não do Node.js).
  // Crítico: project_events.createdAt é gerado por PostgreSQL defaultNow().
  // Usar new Date() do Node.js causaria skew de clock → eventos da fase seriam
  // invisíveis na query de keyFindings (gte comparison falharia silenciosamente).
  const tsResult = await db.execute(sql`SELECT NOW() AS ts`);
  const phaseStartedAt: Date = (tsResult as any).rows?.[0]?.ts ?? new Date();

  const phaseInput = currentIndex === 0 && state.userInput
    ? `Contexto do projeto: ${state.userInput}\n\nExecute a fase ${phaseConfig.phaseNum}: ${phaseConfig.label}.`
    : `Execute a fase ${phaseConfig.phaseNum} (${phaseConfig.label}) conforme as instruções injetadas.`;

  const rawOutput = await agent.run(phaseInput, agentCtx, state.vizMode);
  onStep?.(`[KLIO] Fase ${phaseConfig.phaseNum} concluída — extraindo artefatos...`);

  // ── Extrair keyFindings dos eventos criados nesta fase ────────────────────
  const recentEvents = await db.query.projectEvents.findMany({
    where:   and(
      eq(projectEvents.projectId, state.projectId),
      gte(projectEvents.createdAt, phaseStartedAt),
    ),
    orderBy: [asc(projectEvents.createdAt)],
    limit:   100,
  });

  const keyFindings: KeyFinding[] = recentEvents.map(e => ({
    claim:      e.name ?? e.description ?? "evento sem descrição",
    factStatus: ((e.sourceEvaluation as any)?.factStatus ?? "INDICIO") as KeyFinding["factStatus"],
    tadScore:   (e.sourceEvaluation as any)?.alphanumericScore as string | undefined,
    source:     (e.sourceEvaluation as any)?.sourceType as string | undefined,
  }));

  const toolCallIds = recentEvents.map(e => e.id);

  // ── ATHENA: auditoria determinística ─────────────────────────────────────
  onStep?.(`[ATHENA] Auditando fase ${phaseConfig.phaseNum}...`);
  const athenaVerdict = await athenaAuditPhase(
    keyFindings,
    phaseConfig.nodeSlug,
    state.projectId,
    phaseConfig.label,
  );
  onStep?.(`[ATHENA] Veredicto: ${athenaVerdict.verdict} (LLM: ${athenaVerdict.usedLLM})`);

  // ── Summary determinístico ────────────────────────────────────────────────
  const summary = buildPhaseSummary(
    phaseConfig.label,
    phaseConfig.phaseNum,
    keyFindings,
    toolCallIds,
    athenaVerdict.verdict,
  );

  // ── Persistir phase_output (upsert) ───────────────────────────────────────
  onStep?.(`[phaseLoopNode] Persistindo phase_output: ${phaseConfig.phaseSlug} (${keyFindings.length} findings, ATHENA: ${athenaVerdict.verdict})`);
  await db.insert(phaseOutputs)
    .values({
      projectId:     state.projectId,
      phaseSlug:     phaseConfig.phaseSlug,
      nodeSlug:      phaseConfig.nodeSlug,
      phaseNum:      phaseConfig.phaseNum,
      methodologyId: methodology,
      summary,
      keyFindings:   keyFindings as any,
      toolCallIds,
      athenaVerdict: athenaVerdict.verdict,
      athenaChecks:  athenaVerdict.checks as any,
      athenaUsedLlm: athenaVerdict.usedLLM,
    })
    .onConflictDoUpdate({
      target: [phaseOutputs.projectId, phaseOutputs.phaseSlug],
      set: {
        summary,
        keyFindings:   keyFindings as any,
        toolCallIds,
        athenaVerdict: athenaVerdict.verdict,
        athenaChecks:  athenaVerdict.checks as any,
        athenaUsedLlm: athenaVerdict.usedLLM,
      },
    });

  onStep?.(`[phaseLoopNode] phase_output persistido ✅ — ${phaseConfig.phaseSlug}`);

  // ── Garantir output legível para o analista ───────────────────────────────
  // Quando KLIO produz apenas tool calls (sem texto narrativo), o output fica
  // vazio ou "Análise concluída." — substituir por resumo informativo.
  const phaseOutput = (!rawOutput || rawOutput.trim() === '' || rawOutput.trim() === 'Análise concluída.')
    ? `**KLIO** · \n\nFase ${phaseConfig.phaseNum} — ${phaseConfig.label} concluída.\n\n`
      + `${keyFindings.length} artefato(s) registrado(s) nesta fase. `
      + `Consulte o painel de eventos para revisar os FPFs e dados coletados.`
    : rawOutput;

  // ── Modo passos: interromper para revisão do analista ────────────────────
  if (state.vizMode === "passos" && process.env.TEST_MODE !== "true") {
    const verdictDisplay = athenaVerdict.verdict === "APROVADO"
      ? "✅ Rigor analítico aprovado"
      : athenaVerdict.verdict === "RESSALVAS"
      ? "⚠️ Aprovado com ressalvas"
      : "❌ Requer revisão";
    interrupt({
      interruptType: "phase_complete",
      agent:         "KLIO",
      phaseSlug:     phaseConfig.phaseSlug,
      phaseNum:      phaseConfig.phaseNum,
      verdict:       athenaVerdict.verdict,
      message:       `Fase ${phaseConfig.phaseNum} — ${phaseConfig.label} concluída. `
                   + `${verdictDisplay} por ATHENA. `
                   + `Clique em "Confirmar e Avançar" para ir à próxima fase, ou "Redirecionar" para ajustar o foco.`,
      output:        phaseOutput,
    });
  }

  // ── Avançar cursor ────────────────────────────────────────────────────────
  return {
    currentPhaseIndex: currentIndex + 1,
    totalPhases:       phaseConfigs.length,    // atualiza total para o roteador
    currentNodeSlug:   phaseConfig.phaseSlug,  // compat SSE chat.ts
    lastOutput:        phaseOutput,
    agentName:         "KLIO",
    messageType:       "parcial",
  };
}

// ── Nó de síntese ─────────────────────────────────────────────────────────────

export async function synthesisNode(
  state:  OlympusState,
  config: RunnableConfig,
): Promise<Partial<OlympusState>> {
  const onStep  = config?.configurable?.onStep  as ((msg: string) => void) | undefined;
  const onToken = config?.configurable?.onToken as ((delta: string) => void) | undefined;

  // ── Selecionar orquestrador (HERMES default; OLYMPUS se configurado) ──────
  const orchestratorCandidates =
    !state.agentMethodPrompts?.["OLYMPUS"] ? ["HERMES", "OLYMPUS"]
    : ["OLYMPUS", "HERMES"];

  const dbAgents = await db.query.agents.findMany({
    where: inArray(agentsTable.name, ["HERMES", "OLYMPUS"]),
  });
  const orchestratorRow =
    orchestratorCandidates
      .map(name => dbAgents.find(a => a.name === name))
      .find(Boolean)
    ?? dbAgents.find(a => a.type === "orchestrator");

  if (!orchestratorRow) {
    throw new Error("[synthesisNode] Nenhum agente orquestrador encontrado no banco.");
  }

  const orchestratorName = orchestratorRow.name;
  onStep?.(`[${orchestratorName}] Compilando relatório final...`);

  // ── Ler phase_outputs do projeto ─────────────────────────────────────────
  const outputs = await db.query.phaseOutputs.findMany({
    where:   eq(phaseOutputs.projectId, state.projectId),
    orderBy: [asc(phaseOutputs.phaseNum)],
  });

  console.log(`[synthesisNode] Buscando phase_outputs: projectId=${state.projectId} methodology=${state.methodology}`);
  console.log(`[synthesisNode] Encontrados: ${outputs.length} outputs`);

  if (outputs.length === 0) {
    throw new Error(
      `[synthesisNode] Nenhum phase_output para projeto '${state.projectId}' (metodologia: '${state.methodology}'). ` +
      `Causas possíveis: (1) phaseLoopNode falhou antes de persistir artefatos — ver logs acima; ` +
      `(2) metodologia '${state.methodology}' não tem fases com systemPromptInject configurados ` +
      `— execute o seed para popular as fases no banco; ` +
      `(3) o seed ainda não foi executado no ambiente Railway.`
    );
  }

  // ── Montar contexto completo para o orquestrador ──────────────────────────
  const phasesContext = outputs.map(o => {
    const findings = (o.keyFindings as any[]) ?? [];
    const findingsText = findings.slice(0, 10)
      .map((f: any) => `  · [${f.factStatus}] ${f.claim}${f.tadScore ? ` (TAD:${f.tadScore})` : ""}`)
      .join("\n");
    return [
      `=== Fase ${o.phaseNum}: ${o.phaseSlug} ===`,
      `Resumo: ${o.summary}`,
      `ATHENA: ${o.athenaVerdict ?? "—"}`,
      findings.length > 0 ? `Findings principais:\n${findingsText}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const synthesisPrompt = `[MODO SÍNTESE FINAL — ${orchestratorName}]

Todas as ${outputs.length} fases da análise foram concluídas.
Os dados estruturados de cada fase estão abaixo.

MISSÃO:
Compilar o RELATÓRIO FINAL em Markdown estruturado.
Baseie-se EXCLUSIVAMENTE nos dados abaixo — NÃO invente análises adicionais.
NÃO invoque ferramentas ou delegar para outros agentes.

Estrutura mínima do relatório:
1. Enquadramento do Sistema e Premissas (fase 1)
2. FPFs Identificados e Avaliados — scores TAD (fase 2-3)
3. Probabilidades P(i) e P(i|j) — vocabulário Hendrikson (fases 4-5)
4. As 4 Cenas com configuração booleana dos FPFs (fase 6)
5. Narrativas das 4 Cenas (fase 7)
6. Indicações Estratégicas e Signposts (fase 8)
7. Painel de Monitoramento (fase 9)

${phasesContext}`;

  const agent = new Agent(
    orchestratorRow.name,
    orchestratorRow.role,
    orchestratorRow.systemPrompt,
    [],    // sem ferramentas — síntese pura a partir dos phase_outputs
    orchestratorRow.modelOverride ?? undefined,
  );

  const finalOutput = await agent.run(synthesisPrompt, {
    projectId:          state.projectId,
    methodology:        state.methodology,
    memory:             [],
    llmConfig:          state.llmConfig,
    llmTiers:           state.llmTiers,
    phases:             state.phases,
    agentMethodPrompts: {},
    connectivityMode:   state.connectivityMode,
    onStep,
    onToken,
  }, "etapa");

  // Assinatura
  const signedOutput =
    finalOutput.includes(`**${orchestratorName}**`)
      ? finalOutput
      : `**${orchestratorName}** · \n\n${finalOutput}`;

  // Detectar se é relatório completo
  const REPORT_PATTERNS = [
    "RELATÓRIO FINAL", "RELATÓRIO GRUMBACH", "RELATÓRIO DE CENÁRIOS",
    "RELATÓRIO ESTRATÉGICO", "RELATÓRIO SIEX",
  ];
  const isReport = REPORT_PATTERNS.some(p => signedOutput.includes(p))
                || signedOutput.length > 2000;
  const messageType = isReport ? "relatorio_final" : "parcial";

  await db.insert(messages).values({
    projectId:   state.projectId,
    role:        "assistant",
    content:     signedOutput,
    agentName:   orchestratorName,
    messageType,
  });

  onStep?.(`[${orchestratorName}] Relatório final gerado (${signedOutput.length} chars).`);

  return {
    lastOutput:  signedOutput,
    agentName:   orchestratorName,
    messageType,
  };
}
