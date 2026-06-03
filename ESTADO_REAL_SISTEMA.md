# ESTADO REAL DO SISTEMA — OLYMPUS 1.0
**Gerado em:** 03/06/2026 — Pós Sprint 22 (Olympus 1.0)
**Commit HEAD:** `9127117` (docs) · anterior: `fca0d4d` (fix) · `394552b` (feat Olympus 1.0)
**Método:** queries SQL reais no banco ativo + inspeção do dist compilado no container
**Containers:** olympus_api ✅ healthy · olympus_db ✅ healthy · olympus_web ✅ up · olympus_ollama ✅ healthy

---

## SEÇÃO 1 — AGENTES NO BANCO

```sql
SELECT name, type, LENGTH(system_prompt) as prompt_len, tools_config FROM agents ORDER BY name;
```

| name | type | prompt_len (chars) | tools_config |
|------|------|-------------------|--------------|
| ATHENA | expert | 5 838 | `[]` |
| HERMES | orchestrator | 1 299 | `[]` |
| KLIO | expert | 1 441 | 18 ferramentas (ver abaixo) |
| KRATOS | expert | 1 214 | `["web_search","buscar_dados_publicos","buscar_sinais","registrar_sinal","atualizar_sentinela"]` |
| OLYMPUS | orchestrator | 332 | `[]` |

**Total: 5 agentes** (2 orquestradores + 3 operacionais)

> **Mudança Olympus 1.0:** SCOPUS, PYTHIA, MNEMOSYNE e THEMIS foram removidos do banco. KLIO é agora o analista monolítico que executa todas as fases via phaseLoopNode + PHASE_CONFIGS.

### KLIO — toolsConfig completo (18 ferramentas)

```json
["tool_unified_search_engine","web_search","buscar_dados_publicos",
 "buscar_documentos_internos","avaliar_fonte","declarar_julgamento",
 "registrar_hipotese_alternativa","registrar_sinal","buscar_sinais",
 "tool_register_event","tool_register_impact_relation",
 "tool_tad_score_calculator","tool_mpc_source_evaluator",
 "tool_grumbach_expert_simulation","tool_mactor_analysis",
 "tool_esg_rii_calculator","tool_mpo_backcasting","tool_register_scenario"]
```

### OLYMPUS — stub ativo

systemPrompt = `[STUB — Olympus 2.0 — síntese multi-metodologia]` (332 chars). Não invocado em 1.0.

---

## SEÇÃO 2 — METODOLOGIAS E FASES

```sql
SELECT slug, name, implementation_status, methodology_type,
       COUNT(mp.id) as phase_count
FROM methodologies m LEFT JOIN methodology_phases mp ON mp.methodology_id = m.id
GROUP BY m.id ORDER BY methodology_type, slug;
```

### Bloco A — Cenários (9 metodologias, v1.0)

| slug | name | fases no banco | PHASE_CONFIGS | Observação |
|------|------|---------------|---------------|------------|
| `grumbach` | Grumbach: Produção de Cenários | **9** | ✅ implementado | **CASO DE VALIDAÇÃO 1.0** |
| `alta` | OTAN — Alternative Analysis (AltA) | 6 | ❌ erro explícito | phases no banco, sem phase-configs |
| `ceeex` | CEEEx: Cenários Prospectivos do Exército | 0 | ❌ erro explícito | novo slug; sem fases no banco |
| `esg` | ESG: Cenários Prospectivos | 6 | ❌ erro explícito | phases no banco, sem phase-configs |
| `gbn` | GBN — Global Business Network | 0 | ❌ erro explícito | novo slug; sem fases no banco |
| `godet` | Godet: Escola Estrutural | 7 | ❌ erro explícito | phases no banco, sem phase-configs |
| `ipea_buarque` | IPEA/Buarque — Metodologia de Cenários | 0 | ❌ erro explícito | novo slug; sem fases no banco |
| `mpo` | MPO: Estratégia Brasil 2050 | 8 | ❌ erro explícito | phases no banco, sem phase-configs |
| `siex` | SIEx: Conhecimento Estimativa EB | 7 | ❌ erro explícito | phases no banco, sem phase-configs |

### Bloco B — Planejamento Estratégico (3 stubs, v2.0)

| slug | name | fases no banco | status |
|------|------|---------------|--------|
| `siplex` | SIPLEx: Sistema de Planejamento do Exército | 7 | v2.0 stub — pipeline Olympus 2.0 |
| `grumbach_gestao` | Grumbach: Gestão Estratégica Completa | 0 | v2.0 stub |
| `sped` | SPED/PESD: Planejamento Estratégico Setorial de Defesa | 0 | v2.0 stub |

**Total: 12 metodologias · 57 fases totais no banco**

> **Comportamento se metodologia sem PHASE_CONFIGS for usada:** phaseLoopNode lança `Error: [OLYMPUS 1.0] Phase configs não implementados para metodologia 'X'. Metodologias disponíveis: [grumbach].`

### Grumbach — fases em detalhe (fonte da verdade para phaseLoopNode)

| phase_num | slug | node_slug | agent_role | label |
|-----------|------|-----------|-----------|-------|
| 1 | grumbach_p1 | node_framing | KLIO | Delimitação do Sistema |
| 2 | grumbach_p2 | node_scanning_macro | KLIO | Varredura de FPFs |
| 3 | grumbach_p3_hitl | node_scanning_forces | KLIO | Seleção de FPFs (HITL) |
| 4 | grumbach_p4 | node_modeling | KLIO | Delphi — Probabilidades P(i) |
| 5 | grumbach_p5 | node_modeling | KLIO | Impacto Cruzado P(i\|j) |
| 6 | grumbach_p6 | node_matrix_design | KLIO | Seleção das 4 Cenas |
| 7 | grumbach_p7 | node_narrative | KLIO | Narrativas das 4 Cenas |
| 8 | grumbach_p8 | node_integration | KLIO | Indicações Estratégicas |
| 9 | grumbach_p9 | node_integration | KRATOS | Painel de Monitoramento |

> **Nota:** `agentRole` na tabela é informativo — phaseLoopNode usa PHASE_CONFIGS do código, não agentRole do banco.

---

## SEÇÃO 3 — FERRAMENTAS ANALÍTICAS

**Arquivo:** `apps/api/src/tools/analytical-engines.ts`
**Todas usam JSON Schema puro. ZOD AUSENTE. ✅**

| Ferramenta | Agente | Função |
|-----------|--------|--------|
| `tool_unified_search_engine` | KLIO | Busca unificada com guard connectivityMode |
| `tool_register_event` | KLIO | Registra FPF/tendência/incerteza com TAD no banco |
| `tool_mpc_source_evaluator` | KLIO | Avaliação MPC alfanumérica A-F × 1-6 |
| `tool_tad_score_calculator` | KLIO | Score TAD paramétrico (6 subcritérios numéricos) |
| `tool_register_impact_relation` | KLIO | Impacto direto entre variáveis (MICMAC) |
| `tool_grumbach_expert_simulation` | KLIO | 7 personas — P(i) e P(i\|j) Grumbach |
| `tool_mactor_analysis` | KLIO | Análise de atores MACTOR |
| `tool_mpo_backcasting` | KLIO | Backcasting MPO por marcos |
| `tool_esg_rii_calculator` | KLIO | RII = I × (6-G) × (6-C) |
| `tool_register_scenario` | KLIO | Cenário estruturado com configuração booleana |

> **`consultar_agente`** foi removida do toolsConfig de todos os agentes. ATHENA roda via `athena-validator.ts` (TypeScript puro), não via tool call.

---

## SEÇÃO 4 — ESTADO DO GRAFO LANGGRAPH

**Arquivos:** `apps/api/src/graph/` (builder.ts, nodes.ts, helpers.ts, postgresSaver.ts)

### Nós do grafo — 2 nós (Olympus 1.0)

| Node name | Função |
|-----------|--------|
| `phase_loop` | phaseLoopNode — executa KLIO para a fase atual, persiste phase_output, roda ATHENA |
| `synthesis` | synthesisNode — HERMES lê todos phase_outputs e compila relatório final |

**Roteamento:**
- `routeFromStart()` → `phase_loop` se `PHASE_CONFIGS[methodology]` existe; `synthesis` se fases esgotadas
- `routeAfterPhase()` → `phase_loop` (currentPhaseIndex < N) ou `synthesis` (currentPhaseIndex >= N)

**PHASE_CONFIGS** (exportado de nodes.ts):
```typescript
{ grumbach: GRUMBACH_PHASES }  // único implementado em 1.0
```

### Novos arquivos no grafo

| Arquivo | Função | Status |
|---------|--------|--------|
| `athena-validator.ts` | ATHENA determinística por nodeSlug — `athenaAuditPhase()` + `validateStructuralCompliance()` | ✅ compilado |
| `phase-context.ts` | `loadPhaseContext()` + `buildPhaseSummary()` — contexto compacto entre fases | ✅ compilado |
| `phase-configs/grumbach.ts` | 9 `PhaseConfig[]` com systemPromptInject verificado (METODOLOGIAS_VERIFICADAS v4) | ✅ compilado |

### Estado do cursor

| Campo | Versão | Uso |
|-------|--------|-----|
| `currentNodeSlug` | v4 (legado) | Mantido para compat SSE chat.ts — atualizado por phaseLoopNode com phaseSlug |
| `currentPhaseIndex` | v5 (novo) | Cursor 0-based; drive do routing; `null` = não iniciado |

### Gestão de contexto entre fases

- **v4 (removido):** `loadMemoryWindow` — últimas N mensagens, até 48K tokens
- **v5 (ativo):** `loadPhaseContext` — summaries compactos de `phase_outputs`, **~268 tokens para 9 fases**

### Checkpoint / HITL

`PostgresSaver` ativo (4 tabelas gerenciadas por setup() — fora do schema Drizzle).
Portão HITL: `interrupt()` chamado em `phaseConfig.requiresHitlBefore = true` (fase 3 Grumbach).

---

## SEÇÃO 5 — TABELAS NO BANCO

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- 30 linhas retornadas
```

### Gerenciadas pelo Drizzle (26 tabelas de aplicação)

```
agent_method_prompts, agents, analytic_reviews, audit_logs, embeddings,
indicators, matrix_direct_impacts, messages, methodologies,
methodology_phases, methodology_types, phase_techniques, platform_settings,
project_events, project_scenarios, projects, rate_limit_logs,
revoked_tokens, team_members, teams, technique_execution_outputs,
techniques, tools, users, weak_signals,
phase_outputs   ← NOVO Olympus 1.0
```

### Gerenciadas externamente (4 tabelas PostgresSaver)

```
checkpoint_blobs, checkpoint_migrations, checkpoint_writes, checkpoints
```

### `phase_outputs` — estrutura real

| coluna | tipo | null | default |
|--------|------|------|---------|
| id | uuid | NO | gen_random_uuid() |
| project_id | text | NO | FK → projects.id |
| phase_slug | text | NO | — |
| node_slug | text | NO | — |
| phase_num | integer | NO | — |
| methodology_id | text | NO | — |
| summary | text | NO | `''` |
| key_findings | jsonb | NO | `[]` |
| tool_call_ids | text[] | YES | `{}` |
| athena_verdict | text | YES | — |
| athena_checks | jsonb | YES | `[]` |
| athena_used_llm | boolean | YES | false |
| created_at | timestamptz | NO | now() |

**Constraint:** `UNIQUE (project_id, phase_slug)` — um phase_output por fase por projeto.
**Index:** `idx_phase_outputs_project ON phase_outputs(project_id)`.
**Linhas atuais:** 0 (aguardando primeira análise Grumbach completa).

### Novos campos em `methodologies`

```
methodology_type        TEXT DEFAULT 'cenarios'   -- 'cenarios'|'planejamento'|'inteligencia'
implementation_status   TEXT DEFAULT 'v1.0'        -- 'v1.0'|'v2.0'
parent_relation         TEXT                       -- ex: 'Fase de cenários do grumbach_gestao'
source_documents        JSONB DEFAULT '[]'         -- array de strings com fontes verificadas
```

---

## SEÇÃO 6 — COMPILAÇÃO

```bash
npx tsc --noEmit --project apps/api/tsconfig.json  → (sem output) = ZERO ERROS ✅
npx tsc --noEmit --project apps/web/tsconfig.json  → (sem output) = ZERO ERROS ✅
```

Build do container (Dockerfile.api): compilação tsc de core → tools → db → api — **SUCESSO ✅**.

---

## SEÇÃO 7 — VERSÕES (package.json)

| Pacote | Versão instalada |
|--------|-----------------|
| `@langchain/langgraph` | ^1.3.2 |
| `@langchain/langgraph-checkpoint-postgres` | ^1.0.1 |
| `ai` (Vercel AI SDK) | ^6.0.168 |
| `drizzle-orm` | ^0.45.2 |
| `hono` | ^4.3.7 |
| `@ai-sdk/anthropic` | ^3.0.71 |
| `@ai-sdk/google` | ^3.0.80 |
| `@ai-sdk/openai` | ^3.0.65 |
| `@ai-sdk/groq` | ^3.0.39 |
| `@langchain/core` | ^1.1.48 |

### Platform settings no banco

| key | value |
|-----|-------|
| `llm` | `{"model": "claude-haiku-4-5-20251001", "provider": "anthropic"}` |
| `llm_tiers` | `{"economy": "claude-haiku-4-5-20251001", "premium": "claude-sonnet-4-6"}` |
| `anthropic_models` | Claude Opus 4 / Claude Sonnet 4.6 / Claude Haiku 4.5 |

> **Nota:** `getLLMConfig()` prioriza o banco. O `.env` local tem `ANTHROPIC_MODEL=claude-opus-4-7` mas o banco usa haiku como padrão — consistente com uso de desenvolvimento.

### TEST_MODE

- **Container local:** `TEST_MODE=true` (definido via docker-compose `.env`)
- **Railway (produção):** `TEST_MODE` não definido → `undefined` → comportamento de produção ✅

---

## SEÇÃO 8 — DIAGNÓSTICO: ESTADO ATUAL

### 8.1 — O que está funcionando ✅

| Item | Status | Verificação |
|------|--------|-------------|
| TypeScript API + Web | ✅ Zero erros | `tsc --noEmit` ambos projetos |
| Stress test v5 | ✅ 10/10 CPs | `stress_test_v5.ts` executado no container |
| Docker build | ✅ Compilou sem erros | core → tools → db → api |
| Container API | ✅ healthy (12h up) | `docker ps` |
| Banco — tabela `phase_outputs` | ✅ Existe com schema correto | `information_schema.columns` |
| Banco — novos campos `methodologies` | ✅ 4 campos presentes | `information_schema.columns` |
| Banco — 5 agentes corretos | ✅ HERMES/KLIO/KRATOS/ATHENA/OLYMPUS | query SQL |
| Banco — 12 metodologias | ✅ 9 Bloco A + 3 Bloco B stubs | query SQL |
| Banco — fases Grumbach | ✅ 9 fases com slugs corrigidos | query SQL |
| Banco — `clearCheckpointSql` | ✅ Fix commitado e pushado | commit fca0d4d |
| Railway deploy | ✅ Build passou após fix | push main |
| PHASE_CONFIGS compilado | ✅ `{grumbach: [9 fases]}` | node no container |
| `athena-validator.ts` compilado | ✅ | node no container |
| `phase-context.ts` compilado | ✅ | node no container |
| `phase-configs/grumbach.ts` compilado | ✅ | node no container |

### 8.2 — Pendências / Próximos passos

| # | Item | Prioridade | Observação |
|---|------|-----------|------------|
| P1 | **Executar análise Grumbach completa** | 🔴 CRÍTICO | Nenhuma análise foi executada com a nova arquitetura ainda. `phase_outputs` tem 0 linhas. Validar 9 phase_outputs no banco após análise. |
| P2 | **Seed Railway** | 🔴 CRÍTICO | Após deploy, rodar `railway run --service olympus-api npx tsx apps/api/src/scripts/seed.ts` para atualizar banco de produção. |
| P3 | **ATHENA LLM qualitativo** | 🟡 MÉDIO | `runQualitativeAudit()` em athena-validator.ts retorna stub "pendente". Implementar chamada real ao agente ATHENA em 1.1. |
| P4 | **Endpoint GET /api/v1/phases/:projectId** | 🟡 MÉDIO | Necessário para Tela ATHENA e Tela Lastro (UI Design). phase_outputs não tem rota de leitura ainda. |
| P5 | **PHASE_CONFIGS para ceeex** | 🟡 MÉDIO | Segunda prioridade após Grumbach validado. Compartilha ~70% da estrutura com grumbach. |
| P6 | **agent_method_prompts legado** | 🟢 BAIXO | 15 prompts no banco para metodologias sem phase-configs. Não causam erros; carregados mas não usados pelo phaseLoopNode. Limpar em 1.1. |
| P7 | **UI — PipelineTrack + AthenaVerdict** | 🟢 BAIXO | Componentes documentados em OLYMPUS_UI_DESIGN.md. Frontend ainda mostra a UI v4. |
| P8 | **ceeex, gbn, ipea_buarque fases** | 🟢 BAIXO | Metodologias sem fases no banco. Adicionar no seed quando phase-configs forem implementados. |

### 8.3 — Bugs conhecidos (herdados do v4, não bloqueadores)

| # | Severidade | Descrição | Arquivo |
|---|-----------|-----------|---------|
| T2 | 🟠 P1 | Tier mismatch cross-provider ao trocar provider no banco | Agent.ts + settings.ts |
| T8 | 🟠 P1 | Ollama `⚡ offline` falso positivo no startup | settings.ts / docker-compose.yml |
| T9 | 🟡 P2 | UI tiers só mostra modelos Google | CommandBar.tsx |
| T10 | 🟡 P2 | RAG inoperante localmente (vector(512) vs 768 dims Ollama) | schema.ts |
| T12 | 🔵 P3 | Mensagem parcial repetida durante streaming | App.tsx |

> **Bugs T1 (TEST_MODE), T3 (Anthropic system prompt format), T4 (consultar_agente ausente), T5 (HITL sem contexto), T6 (projeto não abre), T7 (metodologia trava), T11 (SIEx usa HERMES):** resolvidos estruturalmente pela migração para Olympus 1.0.

---

## SEÇÃO 9 — ARQUIVOS CRÍTICOS (referência rápida)

| Arquivo | Função | Status em 1.0 |
|---------|--------|---------------|
| `apps/api/src/graph/nodes.ts` | phaseLoopNode + synthesisNode + PHASE_CONFIGS | ✅ Reescrito |
| `apps/api/src/graph/builder.ts` | 2 nós: phase_loop + synthesis | ✅ Reescrito |
| `apps/api/src/graph/helpers.ts` | buildToolsForPhase() adicionado | ✅ Atualizado |
| `apps/api/src/graph/athena-validator.ts` | ATHENA determinística (novo) | ✅ Novo |
| `apps/api/src/graph/phase-context.ts` | loadPhaseContext / buildPhaseSummary (novo) | ✅ Novo |
| `apps/api/src/graph/phase-configs/grumbach.ts` | 9 PhaseConfig verificados (novo) | ✅ Novo |
| `apps/api/src/graph/postgresSaver.ts` | clearCheckpointSql exportada | ✅ Corrigido |
| `apps/api/src/routes/chat.ts` | currentPhaseIndex + phase_outputs cleanup | ✅ Atualizado |
| `apps/api/src/scripts/seed.ts` | 5 agentes + 12 metodologias + tolerância a ausentes | ✅ Reescrito |
| `apps/api/src/scripts/stress_test_v5.ts` | 10 CPs validação arquitetural (novo) | ✅ Novo |
| `apps/api/src/index.ts` | Migrations Olympus 1.0 idempotentes no startup | ✅ Atualizado |
| `packages/core/src/state.ts` | currentPhaseIndex adicionado | ✅ Atualizado |
| `packages/db/src/schema.ts` | phase_outputs + novos campos methodologies | ✅ Atualizado |

---

*Gerado por Claude Sonnet 4.6 — 03/06/2026 — Olympus 1.0 · commit 9127117*
*Queries SQL executadas em `olympus_db` (postgres/olympus) · Container api inspecionado via `docker exec`*
