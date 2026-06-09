# ESTADO REAL DO SISTEMA — OLYMPUS v4
**Gerado em:** 02/06/2026 — Passo 1 (Inventário com Docker ativo)  
**Sprint:** 22 concluída · Build aprovado · Containers saudáveis  
**Método:** queries SQL reais + leitura de código-fonte + análise de 7 logs de teste  
**Nenhum arquivo de produção foi alterado.**

---

## SEÇÃO 1 — AGENTES NO BANCO

```sql
SELECT name, type, LENGTH(system_prompt) as prompt_len, tools_config FROM agents ORDER BY name;
```

| name | type | prompt_len (chars) | tools_config |
|------|------|-------------------|--------------|
| ATHENA | expert | **5 838** | `[]` |
| HERMES | orchestrator | 2 451 | `["consultar_agente"]` |
| KLIO | expert | 4 939 | `["tool_unified_search_engine","web_search","buscar_dados_publicos","buscar_documentos_internos","avaliar_fonte","declarar_julgamento","registrar_hipotese_alternativa","registrar_sinal","buscar_sinais","tool_register_event","tool_register_impact_relation","tool_tad_score_calculator","tool_mpc_source_evaluator"]` |
| KRATOS | expert | 1 214 | `["web_search","buscar_dados_publicos","buscar_sinais","registrar_sinal","atualizar_sentinela"]` |
| MNEMOSYNE | expert | 2 385 | `["web_search","tool_register_scenario"]` |
| OLYMPUS | orchestrator | 2 255 | `["consultar_agente"]` |
| PYTHIA | expert | 3 507 | `["web_search","buscar_dados_publicos","avaliar_fonte","declarar_julgamento","registrar_hipotese_alternativa","tool_mactor_analysis","tool_grumbach_expert_simulation","tool_esg_rii_calculator","tool_register_scenario"]` |
| SCOPUS | expert | **1 907** | `["tool_unified_search_engine","web_search","buscar_documentos_internos","avaliar_fonte","declarar_julgamento","registrar_hipotese_alternativa","tool_tad_score_calculator","tool_register_event"]` |
| THEMIS | expert | 2 297 | `["web_search","buscar_sinais","avaliar_fonte","declarar_julgamento","registrar_hipotese_alternativa","tool_mpo_backcasting"]` |

**Total: 9 agentes** (2 orquestradores + 7 especialistas)

### Ausências críticas em toolsConfig

| Ferramenta | Agentes que precisam mas não têm | Impacto |
|-----------|----------------------------------|---------|
| `consultar_agente` | SCOPUS, KLIO, PYTHIA, MNEMOSYNE, THEMIS | **BLOQUEADOR** — todos os blocos ATHENA do Sprint 22 falham silenciosamente |
| `tool_mactor_analysis` | KLIO | Blueprint: MSEF passo 4, Godet passo 3, ESG passo 3 |
| `tool_register_impact_relation` | PYTHIA | Blueprint: MSEF passo 5 (MICMAC) |
| `tool_register_event` | PYTHIA | Blueprint: SIPLEx passo 4 (20+20+10) |
| `registrar_sinal` | THEMIS | Blueprint: MSEF passo 8 (signposts) |

---

## SEÇÃO 2 — METODOLOGIAS E FASES

```sql
SELECT slug, name, COUNT(phase_count) FROM ... GROUP BY slug, name ORDER BY slug;
```

| slug | name | fases |
|------|------|-------|
| alta | OTAN/AltA | 6 |
| asplan | ASPLAN/MD: Planejamento Setorial de Defesa | 7 |
| esg | ESG: Cenários Prospectivos | 6 |
| futures | GBN (Global Business Network - Peter Schwartz) | 8 |
| godet | Godet: Escola Estrutural | 7 |
| grumbach | Grumbach: Produção de Cenários | 9 |
| macroplan | IPEA/FGV: Cenários Estreitados de Desenvolvimento | 7 |
| mpo | MPO: Estratégia Brasil 2050 | 8 |
| msef | MSEF v3 (8 etapas ENAP) | 8 |
| siex | SIEx: Conhecimento Estimativa EB | **7** (corrigido Sprint 22) |
| siplex | SIPLEx/CEEEx: Cenários da Força Terrestre | 7 |

**Total: 11 metodologias · 80 fases**

### Grumbach — fases em detalhe (slug canônico, node_slug, agent_role)

| phase_num | slug | node_slug | agent_role | label |
|-----------|------|-----------|-----------|-------|
| 1 | grumbach_p1 | node_framing | SCOPUS | Planejamento e Delimitação |
| 2 | grumbach_p2 | node_scanning_macro | KLIO | Diagnóstico Estratégico — FPFs |
| 3 | grumbach_p3 | node_scanning_forces | KLIO | Avaliação MPC Alfanumérica |
| 4 | grumbach_p4 | node_modeling | PYTHIA | Painel de Peritos — P(i) |
| 5 | grumbach_p5 | node_modeling | PYTHIA | Probabilidades Condicionais P(i\|j) |
| 6 | grumbach_p6 | node_matrix_design | PYTHIA | Seleção de Cenas Mais Prováveis |
| 7 | grumbach_p7 | node_narrative | MNEMOSYNE | Narrativas dos 4 Cenários CEEEx |
| 8 | grumbach_p8 | node_integration | THEMIS | Indicações Estratégicas |
| 9 | grumbach_p9 | node_integration | KRATOS | Divulgação e Monitoramento |

### MSEF — fases (confirmado no banco)

| phase_num | slug | node_slug | agent_role | label |
|-----------|------|-----------|-----------|-------|
| 1 | msef_p1 | node_framing | SCOPUS | Triagem e Escopo |
| 2 | msef_p2 | **node_retrospective** | KLIO | Linha do Tempo Histórica |
| 3 | msef_p3 | node_scanning_macro | KLIO | Varredura PESTEL |
| 4 | msef_p4 | node_scanning_forces | KLIO | Conjuntura de Forças |
| 5 | msef_p5 | node_modeling | PYTHIA | Modelagem de Incertezas |
| 6 | msef_p6 | node_matrix_design | PYTHIA | Configuração Espacial |
| 7 | msef_p7 | node_narrative | MNEMOSYNE | Escrita de Enredos |
| 8 | msef_p8 | node_integration | THEMIS | Salvaguardas e Alertas |

✅ MSEF fase 2 = node_retrospective (LT Histórica) — ordem alinhada com blueprint Sprint 22.

---

## SEÇÃO 3 — FERRAMENTAS ANALÍTICAS

Arquivo: `apps/api/src/tools/analytical-engines.ts`  
**Todas usam JSON Schema puro. ZOD AUSENTE. ✅**

| Ferramenta | Schema | `analyticalEngineTools[]` | Agentes com acesso |
|-----------|--------|--------------------------|-------------------|
| tool_unified_search_engine | JSON Schema puro | ✅ | KLIO, SCOPUS |
| tool_register_event | JSON Schema puro | ✅ | KLIO, SCOPUS |
| tool_mpc_source_evaluator | JSON Schema puro | ✅ | KLIO |
| tool_tad_score_calculator | JSON Schema puro | ✅ Sprint 22 | KLIO, SCOPUS |
| tool_register_impact_relation | JSON Schema puro | ✅ | KLIO |
| tool_grumbach_expert_simulation | JSON Schema puro | ✅ | PYTHIA |
| tool_mactor_analysis | JSON Schema puro | ✅ | PYTHIA |
| tool_mpo_backcasting | JSON Schema puro | ✅ | THEMIS |
| tool_esg_rii_calculator | JSON Schema puro | ✅ | PYTHIA |
| tool_register_scenario | JSON Schema puro | ✅ Sprint 22 | PYTHIA, MNEMOSYNE |

**consultar_agente** — implementada em `helpers.ts` (`createConsultarAgenteTool`), no dict `available` do `buildToolsForAgent`. **❌ NÃO está em toolsConfig de nenhum especialista.**

**Tabela `tools` no banco** — apenas 2 entradas: `web_search`, `consultar_agente`. As ferramentas analíticas existem somente em código.

---

## SEÇÃO 4 — ESTADO DO GRAFO LANGGRAPH

**Arquivos:** `apps/api/src/graph/` (builder.ts, nodes.ts, router.ts, helpers.ts)

### Nós do grafo — 6 nós especializados

| Node name | node_slugs mapeados |
|-----------|---------------------|
| `scopus_node` | node_framing |
| `klio_node` | node_scanning_macro, node_scanning_forces, node_retrospective |
| `pythia_node` (com HITL gate) | node_modeling, node_matrix_design |
| `mnemosye_node` ⚠️ *typo — falta 'n'* | node_narrative |
| `integration_node` | node_integration |
| `synthesis_node` | — (síntese final) |

**Roteamento:** `routeFromState()` usa `state.currentNodeSlug` (phaseSlug único) → correto ✅

**loadMemoryWindow:** `helpers.ts` · `MEMORY_TOKEN_BUDGET = 48 000` · `MEMORY_WINDOW_MESSAGES = 16` ✅

**consultar_agente no `available` dict:** SIM (Sprint 22) — mas nunca chamada pelos especialistas (ver BUG#4)

### ⚠️ Bug estrutural — SIEx usa HERMES em vez de OLYMPUS

`synthesisNode` lógica:
```typescript
const preferHermes = !!state.agentMethodPrompts?.["HERMES"];
```
Para SIEx, **tanto HERMES quanto OLYMPUS têm agentMethodPrompts**. Como HERMES tem prompt para siex, `preferHermes = true` → HERMES é escolhido como orquestrador, não OLYMPUS. O agentsConfig declara OLYMPUS, mas o código seleciona HERMES.

---

## SEÇÃO 5 — TABELAS NO BANCO

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- 29 linhas retornadas
```

### Gerenciadas pelo Drizzle (25 tabelas de aplicação)
```
agent_method_prompts, agents, analytic_reviews, audit_logs, embeddings,
indicators, matrix_direct_impacts, messages, methodologies,
methodology_phases, methodology_types, phase_techniques, platform_settings,
project_events, project_scenarios, projects, rate_limit_logs,
revoked_tokens, team_members, teams, technique_execution_outputs,
techniques, tools, users, weak_signals
```

### Gerenciadas externamente (4 tabelas PostgresSaver)
```
checkpoint_blobs, checkpoint_migrations, checkpoint_writes, checkpoints
```

### `phase_outputs` — **NÃO EXISTE** ✅ (zero linhas no information_schema)

### ⚠️ Dimensão de vetor incompatível com Ollama

```
embeddings.embedding → vector(512)   [schema.ts]
nomic-embed-text (Ollama) → 768 dims [padrão desde Sprint 19]
```
**Resultado:** `buscar_documentos_internos` (RAG) falha ao tentar indexar documentos. HNSW index `embeddings_hnsw_idx` foi criado para 512 dims — incompatível com Ollama. Precisa de `ALTER TABLE` + reindexação ou usar `vector(768)`.

---

## SEÇÃO 6 — COMPILAÇÃO

```bash
npx tsc --noEmit --project apps/api/tsconfig.json  → (sem output) = ZERO ERROS ✅
npx tsc --noEmit --project apps/web/tsconfig.json  → (sem output) = ZERO ERROS ✅
```

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

**Nota:** `.env` tem `ANTHROPIC_MODEL=claude-opus-4-7`, mas `getLLMConfig()` prioriza o banco → usa haiku. Também tem `TEST_MODE=true` ativo.

---

## SEÇÃO 8 — DIAGNÓSTICO: O QUE ESTÁ QUEBRADO

### 8.1 — Ferramentas no código NÃO expostas a nenhum agente

Todas as ferramentas analíticas estão implementadas em `analytical-engines.ts` e no dict `available` de `buildToolsForAgent`. O que não chegou ao `toolsConfig` dos agentes:

| Ferramenta | Precisa chegar em |
|-----------|-------------------|
| `consultar_agente` | SCOPUS, KLIO, PYTHIA, MNEMOSYNE, THEMIS |
| `tool_mactor_analysis` | KLIO |
| `tool_register_impact_relation` | PYTHIA |
| `tool_register_event` | PYTHIA |
| `registrar_sinal` | THEMIS |

### 8.2 — Agentes com toolsConfig válido mas com lacunas

Todos os 9 agentes têm toolsConfig válido (array JSON). As lacunas são as listadas em 8.1.

### 8.3 — Fases com node_slug inválido no NODE_SLUG_TO_GRAPH_NODE

**Zero fases com node_slug inválido.** ✅  
Todos os node_slugs usados nas 80 fases existem em `NODE_SLUG_TO_GRAPH_NODE`:
`node_framing`, `node_scanning_macro`, `node_scanning_forces`, `node_retrospective`,  
`node_modeling`, `node_matrix_design`, `node_narrative`, `node_integration`

### 8.4 — Tabelas referenciadas no código mas ausentes no banco

**Nenhuma.** `phase_outputs` não existe no banco nem no código de produção. ✅

### 8.5 — 29 fases sem agentMethodPrompt correspondente

**Fases onde um especialista roda sem instrução específica de metodologia** (usa apenas o systemPrompt base):

| Metodologia | Agente | phase_num | label |
|-------------|--------|-----------|-------|
| asplan | SCOPUS | 1 | Enquadramento Soberano |
| asplan | KLIO | 2 | Análise do Ambiente |
| asplan | KLIO | 3 | Eixos de Inflexão Geopolítica |
| asplan | PYTHIA | 4 | Cenários de Ameaças e Oportunidades |
| asplan | THEMIS | 5 | Indicações Estratégicas |
| futures | SCOPUS | 1 | Enquadramento e Questão Focal |
| futures | KLIO | 2 | Sinais e Tendências |
| futures | KLIO | 3 | Análise de Forças Motrizes |
| futures | PYTHIA | 4 | Critérios de Distinção |
| futures | PYTHIA | 5 | Futuros Alternativos — Matriz 2×2 |
| futures | MNEMOSYNE | 6 | Narrativas de Futuros (CLA) |
| futures | THEMIS | 7 | Implicações e Alertas |
| grumbach | KLIO | 2 | Diagnóstico Estratégico — FPFs |
| grumbach | KLIO | 3 | Avaliação MPC Alfanumérica |
| macroplan | SCOPUS | 1 | Enquadramento e Horizonte |
| macroplan | KLIO | 2 | Macrotendências Globais |
| macroplan | KLIO | 3 | Dimensões de Desenvolvimento |
| macroplan | PYTHIA | 4 | Incertezas Críticas |
| macroplan | PYTHIA | 5 | Cenários Estreitados |
| macroplan | THEMIS | 6 | Implicações Estratégicas |
| mpo | SCOPUS | 1 | Visão e Diagnóstico |
| mpo | KLIO | 2 | Análise de Contexto |
| mpo | KLIO | 3 | Forças e Atores Estratégicos |
| mpo | PYTHIA | 4 | Cenário Normativo Alvo |
| mpo | PYTHIA | 5 | Backcasting — Marcos Intermediários |
| mpo | THEMIS | 6 | Objetivos e Plano de Ação |
| siex | SCOPUS | 1 | Planejamento |
| siex | PYTHIA | 5 | Interpretação |
| siex | THEMIS | 6 | Formalização e Difusão |

**Metodologias afetadas: asplan, futures, grumbach (KLIO), macroplan, mpo, siex (parcial)**

### 8.6 — Bugs confirmados nos testes de campo

| # | Severidade | Evidência | Root cause | Arquivo |
|---|-----------|-----------|-----------|---------|
| **T1** | 🔴 P0 | `TEST_MODE=true` no `.env` | Tavily retorna mocks; ATHENA auto-aprova; tokens limitados a 4k; 5 steps | `.env` |
| **T2** | 🔴 P0 | `[KLIO] Tier [premium] → premium (google)` | Ao mudar provider, `llm_tiers` no banco continua com model names do provider anterior | `settings.ts` + `Agent.ts` |
| **T3** | 🔴 P0 | `Invalid prompt: system must be a string, SystemModelMessage, or array of SystemModelMessage` | `Agent.ts` passa system como array `[{type:'text', text:..., providerOptions:{anthropic:{cacheControl}}}]` — formato não aceito pelo `@ai-sdk/anthropic@3.0.71` | `Agent.ts` |
| **T4** | 🔴 P0 | Blocos ATHENA adicionados em Sprint 22 nunca executam | `consultar_agente` ausente do toolsConfig de SCOPUS, KLIO, PYTHIA, MNEMOSYNE, THEMIS | `seed.ts` |
| **T5** | 🟠 P1 | HITL de PYTHIA dispara sem contexto de KLIO | Após erro de KLIO (T2), usuário retoma com `isResuming=false` mas checkpoint já existe com eventos de SCOPUS — `clearCheckpointSql` limpa o checkpoint, mas na sequência o checkpoint antigo foi parcialmente restaurado OU a HITL dispara por eventos de SCOPUS antes de KLIO rodar | `nodes.ts` + `chat.ts` |
| **T6** | 🟠 P1 | Clicar em projeto existente não abre sessão | Handler de click no Sidebar não carrega a sessão no estado do App | `App.tsx` / `Sidebar.tsx` |
| **T7** | 🟠 P1 | Seletor de metodologia trava após primeira seleção | Estado do formulário de nova sessão fica preso ao projeto ativo | `App.tsx` |
| **T8** | 🟠 P1 | `⚡ Ollama local offline` falso positivo | API inicia antes de Ollama estar pronto; `getOllamaModels()` falha no startup | `settings.ts` + `docker-compose.yml` |
| **T9** | 🟡 P2 | Tiers só mostram modelos Google na UI | `CommandBar.tsx` hardcoda lista Google para tier selector | `CommandBar.tsx` |
| **T10** | 🟡 P2 | RAG (buscar_documentos_internos) inoperante localmente | `vector(512)` no schema vs 768 dims do Ollama `nomic-embed-text` | `schema.ts` |
| **T11** | 🟡 P2 | SIEx usa HERMES em vez de OLYMPUS | `synthesisNode` prefere HERMES se agentMethodPrompt existe — HERMES tem prompt siex (legado) | `nodes.ts` seed.ts |
| **T12** | 🔵 P3 | Mensagem HERMES repetida durante ATHENA | SSE emite chunks parciais; UI renderiza como mensagens separadas | `App.tsx` |
| **T13** | 🔵 P3 | Label `Gemini 2.5 Flash (premium)` redundante | `GOOGLE_MODELS_DEFAULT` em settings.ts | `settings.ts` |
| **T14** | 🔵 P3 | Label `Padrão` no seletor de modo | UI string hardcoded | `App.tsx` / modal |

---

## RESUMO EXECUTIVO — PRIORIDADES

```
P0 (bloqueadores):
  ├─ T1: TEST_MODE=true no .env → remover 1 linha
  ├─ T2: Tier mismatch cross-provider → Agent.ts + settings.ts
  ├─ T3: Anthropic system prompt format → Agent.ts
  └─ T4: consultar_agente ausente dos especialistas → seed.ts (5 toolsConfig)

P1 (funcionais):
  ├─ T5: HITL sem contexto → nodes.ts / chat.ts
  ├─ T6: Projeto existente não abre → App.tsx
  ├─ T7: Metodologia trava → App.tsx
  └─ T8: Ollama falso-offline → settings.ts / docker-compose.yml

P2 (qualidade):
  ├─ T9: UI tiers só Google → CommandBar.tsx
  ├─ T10: vector(512) vs 768 → schema.ts + migração
  └─ T11: SIEx usa HERMES → nodes.ts / seed.ts

P3 (UX):
  ├─ T12: Mensagem repetida
  ├─ T13: Labels redundantes
  └─ T14: Label "Padrão"

Dívida técnica (não-bloqueadora):
  ├─ 29 fases sem agentMethodPrompt (asplan, futures, macroplan, mpo, siex parcial, grumbach KLIO)
  ├─ 5 ferramentas ausentes de toolsConfig de especialistas
  └─ Typo `mnemosye_node` (falta 'n') em builder.ts e nodes.ts
```

---

*Gerado por Claude Code — 02/06/2026 — Sprint 22 · Docker ativo*  
*Queries SQL reais executadas em `olympus_db` (postgres/olympus)*
