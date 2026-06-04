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
import { eq, asc, gte, and, inArray } from "drizzle-orm";
import { athenaAuditPhase }           from "./athena-validator";
import type { KeyFinding }            from "./athena-validator";
import { loadPhaseContext, buildPhaseSummary } from "./phase-context";
import { buildToolsForPhase, buildAnchorCtx } from "./helpers";
import { GRUMBACH_PHASES }            from "./phase-configs/grumbach";
import type { PhaseConfig }           from "./phase-configs/grumbach";

// ── Registro de phase configs ──────────────────────────────────────────────────
// Adicionar novas metodologias aqui quando implementadas.
export const PHASE_CONFIGS: Record<string, PhaseConfig[]> = {
  grumbach: GRUMBACH_PHASES,
};

// ── Nó de loop de fases ────────────────────────────────────────────────────────

export async function phaseLoopNode(
  state:  OlympusState,
  config: RunnableConfig,
): Promise<Partial<OlympusState>> {
  const onStep  = config?.configurable?.onStep  as ((msg: string) => void) | undefined;
  const onToken = config?.configurable?.onToken as ((delta: string) => void) | undefined;
  const onAgent = config?.configurable?.onAgent as ((name: string) => void) | undefined;

  const methodology  = state.methodology ?? "grumbach";
  const phaseConfigs = PHASE_CONFIGS[methodology];

  if (!phaseConfigs) {
    throw new Error(
      `[phaseLoopNode] Metodologia '${methodology}' não tem phase configs implementados. `
      + `Metodologias disponíveis: ${Object.keys(PHASE_CONFIGS).join(", ")}.`
    );
  }

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
      message:       `Fase ${phaseConfig.phaseNum} (${phaseConfig.label}) requer aprovação do analista. `
                   + "Revise os eventos no painel e clique Continuar.",
      projectId:     state.projectId,
    });
  }

  // ── Contexto: fases anteriores + eventos aprovados ────────────────────────
  const [phaseContext, anchorContext] = await Promise.all([
    loadPhaseContext(state.projectId),
    buildAnchorCtx(state.projectId, state.connectivityMode),
  ]);
  onStep?.(`[KLIO] Contexto: ${phaseContext.phaseCount} fase(s) ant. (~${phaseContext.estimatedTokens} tokens)`);

  // ── Agente KLIO do banco ──────────────────────────────────────────────────
  const [klioRow, projectRow] = await Promise.all([
    db.query.agents.findFirst({ where: eq(agentsTable.name, "KLIO") }),
    db.query.projects.findFirst({
      columns: { name: true },
      where: eq(projects.id, state.projectId),
    }),
  ]);
  if (!klioRow) throw new Error("[phaseLoopNode] Agente KLIO não encontrado no banco.");

  const projectName = projectRow?.name || "Não especificado";

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

  // ── Ferramentas para esta fase ────────────────────────────────────────────
  const tools = buildToolsForPhase(
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

  // Timestamp antes da execução para filtrar eventos criados nesta fase
  const phaseStartedAt = new Date();

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

  // ── Modo passos: interromper para revisão do analista ────────────────────
  if (state.vizMode === "passos" && process.env.TEST_MODE !== "true") {
    interrupt({
      interruptType: "phase_complete",
      agent:         "KLIO",
      phaseSlug:     phaseConfig.phaseSlug,
      phaseNum:      phaseConfig.phaseNum,
      verdict:       athenaVerdict.verdict,
      message:       `Fase ${phaseConfig.phaseNum} (${phaseConfig.label}) concluída. `
                   + `ATHENA: ${athenaVerdict.verdict}. Confirme para continuar.`,
      output:        rawOutput,
    });
  }

  // ── Avançar cursor ────────────────────────────────────────────────────────
  return {
    currentPhaseIndex: currentIndex + 1,
    currentNodeSlug:   phaseConfig.phaseSlug,  // compat SSE chat.ts
    lastOutput:        rawOutput,
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
      `(2) metodologia '${state.methodology}' não tem PHASE_CONFIGS implementados ` +
      `— disponíveis: [${Object.keys(PHASE_CONFIGS).join(", ")}]; ` +
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
