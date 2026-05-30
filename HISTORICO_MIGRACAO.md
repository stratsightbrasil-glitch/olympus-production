# OLYMPUS v4.0 — Histórico Consolidado de Arquitetura e Desenvolvimento
**StratSight Brasil · Strategic Foresight · IA Agêntica**
**Última atualização:** 30 de Maio de 2026 (Sprint 18 concluído) · **Acesso Restrito**

> Este documento é a memória técnica do projeto. Registra a arquitetura, as justificativas de cada decisão, tudo o que funcionou, tudo o que falhou, e o estado atual do backlog. Deve ser lido antes de qualquer intervenção no código.

---

## 1. CONTEXTO DE NEGÓCIO

**O que é o OLYMPUS:** Plataforma integrada de planejamento estratégico e monitoramento contínuo.

```
OLYMPUS
├── Motor ATHENA   → produção de cenários · 9 agentes · 11 metodologias
├── Motor KRATOS   → monitoramento contínuo · indicadores · alertas
├── Painel Cliente → acesso remoto · semáforo de cenário · histórico
├── API OLYMPUS    → integração com parceiros · webhooks n8n
└── Vault de Dados → dados do cliente · dados abertos · offline
```

**Premissas:** operação solo · custo < R$ 1.500/mês · clientes de defesa/governo (air-gapped, CONFIDENCIAL, auditoria) · produto-âncora R$ 80K–250K · meta Ano 1: R$ 300K · exit: aquisição por Big Tech em 8 anos.

---

## 2. EVOLUÇÃO HISTÓRICA DA ARQUITETURA

### 2.1 Athena v1/v2 — O Monolito (Sprints 1–2)

**Stack:** React 18 JSX (`App.jsx` ~1.750 linhas) + Node.js Express 5 (`server.js` ~915 linhas)
**Persistência:** `athena_sessions.json` · **IA:** Anthropic direto · **Porta:** 8080

**O que funcionava:** 7 agentes MSEF · 7 metodologias · 4 modos de visualização · exportação .md/.docx/PDF · `projetoRef` · `sessionLock` · retry com backoff.

**Bugs corrigidos (não regredir):**

| Bug | Fix |
|---|---|
| Wildcard Express 5 conflito | `/{*path}`, nunca `'*'` |
| Rotas interceptadas pelo wildcard | `/api/v1/sessions` ANTES do `express.static` |
| `vizMode` chegava na API | Allowlist de campos no servidor |
| `.docx` corrompido | Removido `numbering reference` inválido |
| XSS no `/painel` | `escHtml()` + `safeStatus()` |
| Base64 decode aninhado | `Buffer.from` uma vez; falha logada |
| Sessões corrompidas | Backup `.corrupted.<timestamp>` antes de `{}` |

### 2.2 OLYMPUS v4.0 — O Monorepo (Sprint 3+)

Migração para arquitetura corporativa: TypeScript estrito, PostgreSQL, Docker, motor de IA componentizável com múltiplos providers.

---

## 3. STACK TECNOLÓGICA

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Build rápido, hot reload, tipagem |
| Backend | Hono + Node.js + TypeScript | Ultra-leve, I/O assíncrono, Edge-compatible |
| IA | Vercel AI SDK (`ai@6.0.168`) + múltiplos providers | Agnóstico de provider |
| Banco | PostgreSQL 15 + pgvector + Drizzle ORM | Concorrência, multi-tenant, vetores |
| Orquestração | LangGraph JS (rota alternativa) | StateGraph, HITL nativo, checkpointing |
| Busca Web | Tavily Search API | Resultados estruturados para RAG |
| Embeddings | Ollama nomic-embed-text (padrão) / Voyage AI (fallback) | Local, air-gapped, sem limite mensal |
| Proxy | Nginx | Reverse proxy, estáticos, rate limiting |
| Containers | Docker Compose (api + web + db + ollama) | Deploy one-command, air-gapped |

---

## 4. DECISÕES ARQUITETURAIS CRÍTICAS

### 4.1 Por que TypeScript e não Python
Python é superior para *treinar* modelos. TypeScript é superior para *construir produtos web* que orquestram LLMs: unificação frontend/backend/banco, Vercel AI SDK, I/O assíncrono nativo.

### 4.2 Por que PostgreSQL e não SQLite
Multi-usuário concorrente, fila assíncrona KRATOS, preparação para pgvector (RAG no mesmo banco), deploy Docker simplificado.

### 4.3 Constraint de pacotes (CRÍTICO)
- `packages/tools` NÃO pode importar `@olympus/db`
- Ferramentas com acesso ao banco ficam em `apps/api/src/tools/`
- Ordem de build: core → tools → db → api

### 4.4 Zod absolutamente proibido (CRÍTICO)
Versões ≥ 3.25.68 causam TS2589 com `@langchain/core`. `instanceof ZodObject` falha entre pacotes no monorepo. Usar JSON Schema puro (`Record<string, any>`) em todas as ferramentas.

---

## 5. BUGS CRÍTICOS CORRIGIDOS (SDK v6 + Motor)

### 5.1 A Guerra de Instâncias Zod
**Sintoma:** `tools.0.custom.input_schema.type: Field required`
**Fix:** Abandonar Zod completamente. Schemas são objetos JS puros embrulhados em `jsonSchema()`.

### 5.2 Campo errado — `parameters` vs `inputSchema`
**Sintoma:** tool calling não enviava `input_schema`
**Fix:** `(myTool as any).inputSchema = () => jsonSchema(rawSchema as any);`

### 5.3 `maxSteps` ignorado no SDK v6
**Sintoma:** ferramenta invocada mas `response.text` vazio
**Fix:** `stopWhen: stepCountIs(10)` — `maxSteps` foi removido no v6

### 5.4 `toolChoice: 'required'` bloqueando síntese
**Fix:** `prepareStep: async ({stepNumber}) => ({ toolChoice: stepNumber === 0 ? "required" : "auto" })`

### 5.5 CMD Dockerfile errado
**Fix:** `CMD ["node", "apps/api/dist/index.js"]` — nunca `npx tsx` em produção

### 5.6 Prompt HERMES contraditório
**Fix:** Prompt único, sem blocos "NÃO USE FERRAMENTAS" que conflitam com a regra absoluta

### 5.7 Histórico ilimitado causando context bloat
**Fix inicial:** `.slice(-12)` · **Fix final:** `buildMemoryWindow()` com orçamento 32k tokens, `estimateTokens()`, suporte multimodal

### 5.8 Gauge SVG desenhado para baixo
**Fix:** `sweep-flag=1` (horário) + endpoint `toXY(0.1°)` para evitar ambiguidade de arco de 180°

### 5.9 Relatório Padrão selecionando mensagem errada
**Fix:** helper `isHermes()` + fallback removido — sem HERMES real, exibe alert ao usuário

### 5.10 ATHENA auto-loop (Sprint 11)
**Sintoma:** ATHENA "REQUER REVISÃO" → HERMES loopava especialistas
**Fix:** ATHENA como auditora pura (toolsConfig: []) + rule 3: "REQUER REVISÃO → registra e avança"

### 5.11 OLYMPUS saltava SCOPUS no Grumbach (Sprint 12)
**Causa:** enumeração `(node_slug: [...])` no template OLYMPUS → Gemini associava slugs ao KLIO
**Fix:** remover enumeração; usar "Fase: [rótulo] — Agente: [Nome]"

### 5.12 `atualizar_sentinela` enum numérico rejeitado pelo Gemini (Sprint 13)
**Causa:** `TOOL_JSON_SCHEMAS` em `Agent.ts` declarava `"type":"number","enum":[1,2]`
**Fix:** `"type":"string","enum":["1","2"]` — Gemini rejeita enum numérico em ferramentas

### 5.13 `tool_register_event` nunca chamado (Sprint 15)
**Causa:** ferramenta ausente do `toolsConfig` de KLIO/SCOPUS
**Fix:** banco + seed.ts corrigidos. First-step rule + reordenação de ferramentas no prompt

### 5.14 MNEMOSYNE narrativas=1 (Sprint 15)
**Causa:** prompt sem instrução explícita de "uma narrativa por quadrante"
**Fix:** REGRA OBRIGATÓRIA DE COBERTURA no systemPrompt

### 5.15 Gemini 2.0 Flash e preview-05-20 inválidos (Sprint 19)
**Causa:** modelos descontinuados permaneciam na UI
**Fix:** removidos do `GOOGLE_MODELS_DEFAULT`, `GOOGLE_DEFAULT`, `index.ts` defaults

---

## 6. REGRAS CRÍTICAS — NUNCA VIOLAR

```
1. Zod PROIBIDO em ferramentas e nós do grafo
2. packages/tools NÃO importa @olympus/db
3. stopWhen: stepCountIs(N) — nunca maxSteps
4. (myTool as any).inputSchema = () => jsonSchema(rawSchema as any)
5. CMD em produção: node apps/api/dist/index.js
6. Prompt HERMES/OLYMPUS: regra única, sem blocos contraditórios
7. Enums Gemini: "type":"string" — nunca "type":"number"
8. node_slug no prompt OLYMPUS: NÃO enumerar
9. Tabelas checkpoint*: NÃO adicionar ao schema Drizzle
10. Ao trocar embedding provider: reindexar todos os embeddings
11. HERMES_SIPLEX: removido — SIPLEx usa HERMES + agentMethodPrompts/siplex
```

---

## 7. HISTÓRICO DE SPRINTS

### Sprint 1–2 (Monolito — Abr 2026)
- Arquitetura inicial funcional: 7 agentes MSEF no master prompt
- `projetoRef` e `sessionLock` para closure stale e concorrência
- Retry com backoff escalonado

### Sprint 3 (Migração OLYMPUS v4 — Abr 2026)
- Monorepo NPM Workspaces + PostgreSQL + Drizzle ORM
- Dockerização completa (3 contêineres + Nginx)
- Sistema de autenticação JWT com 2FA
- Motor Dinâmico de Metodologias
- KRONOS: fila assíncrona com cooldown para monitoramento KRATOS
- Módulo de backup corporativo (`pg_dump` → `.sql.gz`)

### Sprint 4 (Resolução bugs SDK v6 — Abr 2026)
- 4 bugs sobrepostos do Vercel AI SDK v6 identificados e corrigidos (seção 5)
- Prompt HERMES reescrito com regra única
- `proxy_read_timeout 300s` no Nginx (HTTP 504 em análises ~97s)

### Sprint 5 (Dados Públicos + RAG + Streaming — 25 Abr 2026)
- `buscar_dados_publicos`: 51 indicadores em 9 fontes (BCB/SGS, IBGE, IPEA, Comex Stat, Banco Mundial, FMI/WEO, OMS/WHO, ONU Population, IBGE Países, ITU DataHub)
- DOU Seção 1 via INLABS (JWT com cache 6h)
- pgvector RAG: `embeddings vector(512)`, Voyage AI, auto-index no upload
- Token streaming real: `streamText` no `Agent.ts`, bolha HERMES com cursor piscante

### Sprint 6 (Expansão Metodológica + Acesso Cliente — 25 Abr 2026)
- Prompts MSEF v2 completos para 7 agentes
- `TOOL_JSON_SCHEMAS` com todos os 51 indicadores
- `HERMES_GRUMBACH` (4 fases) e `HERMES_GODET` (5 fases MICMAC/MACTOR/SMIC)
- Painel Cliente v2: HTML completo com dashboard de indicadores, relatório markdown, CONFIDENCIAL
- Botão 🔗 Link do Cliente — URL permanente com JWT

### Sprint 7 (Railway Deploy + PoC Presencial — Mai 2026)
- `nginx.conf` refatorado: `proxy_pass ${RAILWAY_API_URL}/api/`, SSE headers, envsubst
- `Dockerfile.api`: `node:20-slim` + HEALTHCHECK nativo
- `docker-compose.yml` reescrito: imagens explícitas, healthcheck pg_isready, depends_on service_healthy
- `railway.toml`, `.env.railway.example`, `RAILWAY_DEPLOY.md` (guia 8 passos)
- `scripts/poc-offline/`: `build-offline.ps1`, `docker-compose.offline.yml`, `instalar.ps1`, `GUIA_POC.md`
- `ARCHITECTURE.html` e `AGENT_CONTEXT.json` criados

### Sprint 8 (ICD 203 · TechniqueEngine · NATO AltA · Step Streaming — 19 Mai 2026)
- ICD 203 — 3 ferramentas: `declarar_julgamento`, `registrar_hipotese_alternativa`, `avaliar_fonte`
- `HERMES_REVISOR` (depois renomeado ATHENA) + tabela `analytic_reviews`
- `TechniqueEngine` (`technique-engine.ts`): injeção dinâmica de técnicas SAT
- NATO AltA: 12 técnicas SAT, metodologia `OTAN/AltA`, orquestrador `HERMES_ALTA`
- Step streaming: `onStep` em `AgentContext`, `TOOL_ICONS`, `stepLabel()`, SSE `{type:'step'}`

### Sprint 9 (Stepper Dinâmico + Provider Factory Ollama — 21 Mai 2026)
- `methodologySteps.ts`: etapas para 6 metodologias, `STEP_DETECTION_PATTERNS`
- CommandBar/Sidebar: stepper genérico `{metodologia} · N/Total`
- `getModel()` Provider Factory: suporte Ollama via `@ai-sdk/openai` com `createOpenAI({baseURL})`
- `LlmSelector` no CommandBar: dropdown Anthropic / Google / Ollama
- KratosPanel Gauge SVG fix: `sweep-flag 0 → 1`, `toXY(0.1°)`
- Relatório Padrão fix: `isHermes()`, fallback removido

### Sprint 10 (Dados Globais · Playbook · Audit · Rate Limit · PoC — 23 Mai 2026)
- FRED + Câmara + Senado: ~62 indicadores no total
- Histórico de indicadores: `valueHistory jsonb`, `appendHistory()`, prune 90 dias
- Sparkline SVG inline, expand/collapse com tabela de histórico
- Auto-registro de sinais: `autoRegisterSignal()` — amarelo/vermelho cria sinal fraco
- Playbook DOCX: `POST /api/v1/playbook/gerar`
- Audit logs: tabela `audit_logs`, `logAudit()`, `GET /audit`
- JWT_EXPIRY configurável: 1h/4h/8h/24h/7d
- Marca d'água exports: CSS watermark CONFIDENCIAL
- Rate limiting: `rateLimit.ts` + nginx `00-limits.conf`
- Health endpoint: `GET /health`
- Seed de demonstração: `seed-demo.ts`
- Fix Ollama timeout: `setGlobalDispatcher(headersTimeout:15min)` + pre-warm

### Sprint Final — Parte A: LangGraph Preps + Nomenclatura (26 Mai 2026)
- Schema LangGraph: `connectivity_mode`, `methodology_phases.node_slug`, 4 tabelas novas (`project_events`, `project_scenarios`, `matrix_direct_impacts`, `technique_execution_outputs`)
- 7 ferramentas analíticas em `analytical-engines.ts` (JSON Schema puro, sem Zod)
- `AgentContext`: `connectivityMode`, `anchorContext`
- Hardening Ollama embed: `chunkTextSafe()`, `runWithLimit()`, `generateEmbeddingsOllama()`
- Seed declarativo: 10 metodologias, 73 fases com slug/node_slug
- `KRONOS → KRATOS` (KronosOrchestrator → KratosOrchestrator)
- `HERMES_REVISOR → ATHENA`
- QEC box sem truncamento, chip de agente com label completo
- `OLYMPUS` criado: orquestrador para GRUMBACH e SIEX
- Eliminados: `HERMES_ALTA`, `HERMES_GODET`, `HERMES_GRUMBACH`, `HERMES_SIEX`
- Regras Claude Code: `.claude/rules/langgraph.md`

### Sprint Final — Parte B: Sprint Pré-LangGraph + Tier System (26 Mai 2026)

**R1–R6 (hardening):**
- R1: `getOrSeedMethodology()` removido → `loadMethodology()` lança exceção
- R2: Memória server-authoritative (`db.query.messages` ao invés de `body.messages`)
- R3: HITL API completa: `GET/POST/PATCH/DELETE /api/v1/events`, `EventsPanel.tsx`
- R4: `connectivityMode` guard em `tavily.ts` (AIR_GAPPED bloqueia, SOBERANO avisa)
- R5: `getNodeRouter(phases)` em `nodeRouter.ts`
- R6: `buildMemoryWindow()`: `estimateTokens()` serializa arrays multimodal

**Tier System:**
- `agents.model_override` → labels `'economy'`/`'premium'` (não IDs hardcoded)
- `platform_settings.llm_tiers` = `{ economy: '...', premium: '...' }`
- Resolução em `Agent.ts`: `tiers[rawOverride] ?? rawOverride`
- UI admin: seção "⚙ Tiers de Agentes" no CommandBar

**LangGraph (rota alternativa):**
- `BoundedMemorySaver`: LRU 50 threads, TTL 2h (substituído no Sprint 14)
- Topologia: START → scopus_node → klio_node → pythia_node(HITL) → ...
- `/stream/graph`, `hitlGate`, `resumeGraph()`, `vizMode='grafo'`

**Renomeação:** `Olympus_v4` → `Olympus`

### Sprint 11 — ATHENA Redesign + 6/6 Metodologias (28 Mai 2026)

**Problema:** ATHENA chamava `declarar_julgamento` → "REQUER REVISÃO" → HERMES loopava especialistas. Suite 4/6.

**Fixes:**
1. ATHENA como auditora pura: `toolsConfig: []`, ATS 1-5
2. HERMES/OLYMPUS rule 3: "REQUER REVISÃO → registra e avança"
3. HERMES rule 1: conteúdo essencial para ATHENA (não 200 chars)
4. TEST_MODE hard cap: `phaseCounts` por agente
5. TEST_MODE ATHENA: prompt → "APROVADO — avance."
6. TEST_MODE rule 7 "PROIBIDO REVISAR": quebra ciclo KLIO→ATHENA×N
7. finalInputMsg: phase-list removida (causava loops no Grumbach)

**Resultado: 6/6 ✅ em 848s**

### Sprint 12 — ATHENA ICD 203 v2 + Shift-Left + Fixes (29 Mai 2026)

**ATHENA systemPrompt v3 — 9 ATS por macroetapa:**

| node_slug | ATS |
|---|---|
| node_framing | ATS 3 + ATS 5 |
| node_scanning_* | ATS 1 + ATS 7 |
| node_modeling | ATS 2 + ATS 4 |
| node_matrix_design / node_narrative | ATS 6 + ATS 8 |
| node_integration | ATS 5 + ATS 9 |

**Shift-Left ICD 203 nos especialistas:**

| Agente | ATS obrigatórios |
|---|---|
| SCOPUS | ATS 5 (KIQ) + ATS 3 (premissas linchpin) |
| KLIO | ATS 1 (MPC inline) + ATS 7 (CONTINUIDADE/ALTERAÇÃO) |
| PYTHIA | ATS 2 (Hendrikson, % proibido) + ATS 8 + ATS 4 (condicional) |
| MNEMOSYNE | ATS 6 (INÍCIO/DESENVOLVIMENTO/FIM) + ATS 8 |
| THEMIS | ATS 5 (Bet vs. Hedge) + ATS 9 (signposts ≥2/cenário) |

**`createConsultAgentTool` v2:** injeta metadados MPC (`╔══ METADADOS ESTRUTURADOS ══╗`) nas chamadas ATHENA em produção.

**Fix 1 (regressão):** queries ATHENA longas em TEST_MODE → truncamento hard 400 chars.
**Fix 2 (regressão):** enumeração node_slug no OLYMPUS → Gemini saltava SCOPUS.

**Resultado: 6/6 ✅ em 985s**

### Sprint 13 — Fix KRATOS Enum + Anthropic Prompt Cache (29 Mai 2026)

- **Fix `atualizar_sentinela`:** `"type":"number","enum":[1,2]` → `"type":"string","enum":["1","2"]` em `TOOL_JSON_SCHEMAS`. KRATOS desbloqueado com Gemini.
- **Anthropic Prompt Cache:** `systemContent` com `cacheControl: {type:'ephemeral'}` quando `activeProvider === 'anthropic'`. ~84% economia tokens.

### Sprint 14 — PostgresSaver LangGraph (29 Mai 2026)

- `@langchain/langgraph-checkpoint-postgres@1.0.1` instalado
- `postgresSaver.ts`: singleton async, `setup()` idempotente, retry em falha
- `getOlympusGraph()` virou async (Promise singleton)
- 4 tabelas criadas pelo `setup()`: `checkpoints`, `checkpoint_blobs`, `checkpoint_migrations`, `checkpoint_writes`
- **Regra:** NUNCA adicionar ao schema Drizzle

### Sprint 15 — Suite de Testes (29 Mai 2026)

**Resultados:** banco 5/5 · segurança 6/6 · kratos 3/3 · artefatos 5/5 · exportação 4/4 · SAT 5/7

**Bugs encontrados e corrigidos:**
1. `toolsConfig` ausente para KLIO/SCOPUS/PYTHIA/THEMIS → banco + seed.ts
2. MNEMOSYNE narrativas=1 → REGRA OBRIGATÓRIA DE COBERTURA no systemPrompt ✅
3. Regex `hasNumericData` muito restritiva → ampliada
4. Campo `ev.reliability` → `ev.sourceEvaluation?.reliability`

**SAT 7/7 após correção first-step rule (Sprint 16).**

### Sprint 16 — TAD + ATHENA v3 + Strategic Slate Compiler (29 Mai 2026)

**Origem:** análise de conversa com Gemini sobre TAD (ICD 203 + EB70-MT-10.401). Filtro: prompts e report-compiler aceitos; `tool_tad_score_calculator` rejeitado (pseudo-determinismo).

**ATHENA v3:**
- Diretriz Nexo Temporal (EB70): reprova "saltos quânticos" KLIO→PYTHIA
- Diretriz Segregação Epistemológica: valida FATO/INDÍCIO/SUPOSIÇÃO no scanning
- ATS 1 expandido: alfanumérico SIEx/OTAN vs. semântico demais

**KLIO:**
- Segregação epistemológica FATO/INDÍCIO/SUPOSIÇÃO obrigatória
- TAD condicional: alfanumérico (SIEx/OTAN) vs. semântico (demais)
- First-step rule: `tool_register_event` listada PRIMEIRA + instrução "STEP 1 OBRIGATÓRIO"

**PYTHIA:**
- Nexo temporal: "consuma trajetória de KLIO antes de bifurcar cenários"

**Strategic Slate Compiler:**
- `apps/api/src/services/report-compiler.ts`
- 9 metodologias com seções obrigatórias e conteúdo doutrinário
- Modos: `standard` / `extended` (+ Raciocínio Analítico e Lastro Cognitivo)
- Injeção em `finalInputMsg` em produção

**Resultado:** metodologias **6/6 ✅ em 845s** · SAT **7/7 ✅**

### Sprint 17 — CEEEx/SIPLEx + Transparência de Ferramentas (30 Mai 2026)

**CEEEx/SIPLEx:**
- `SLUG_MAP` corrigido: `siplex/ceeex` → `"siplex"` (era `"siex"` — metodologia errada)
- 6 seções CEEEx adicionadas ao report-compiler
- ATHENA v3: validação SIPLEx (20+20+10, tabela 10×4, isomorfismo, 6 campos/folha)
- **HERMES_SIPLEX removido** (anti-padrão) → SIPLEx usa HERMES + `agentMethodPrompts/siplex`
- `agents_config` do siplex atualizado: HERMES + especialistas standard
- `agentMethodPrompts` inseridos para HERMES, SCOPUS, KLIO, PYTHIA, MNEMOSYNE, THEMIS / siplex

**Transparência de ferramentas:**
- PROTOCOLO DE PLANEJAMENTO DE FASE injetado em **todos os vizModes** (exceto TEST_MODE)
- `passos`: apresenta plano ao usuário + aguarda confirmação/orientação
- `etapa`/`passagem`/`thinking`: `[PLANO fase X — Ferramentas: ...]` + prossegue imediatamente
- Garante que SATs avançadas não sejam ignoradas pelo LLM

### Sprint 18 — Testes + Hash-chain + registrar_cenario (30 Mai 2026)

**Novas suites de teste:**
- `arquitetura` (6/6 ✅): DB state sem LLM — SIPLEx=HERMES, toolsConfigs, hash-chain, report-compiler
- `plano`: [PLANO] na resposta do orquestrador (para stress test)
- `tad`: segregação, TAD alfanumérica, semântica, nexo temporal PYTHIA (para stress test)

**Hash-chain audit_logs:**
- `utils/audit.ts`: `getPreviousHash()` + `computeHash(userId|action|createdAt|previousHash)`
- Campos `_hash` e `_previousHash` no JSONB `metadata` de cada registro
- Sem migração de schema — usa o JSONB existente
- Detecta adulteração retroativa de logs

**Harmonized Scenario Schema (`tool_register_scenario`):**
- `analytical-engines.ts`: nova ferramenta tipada (name, type, probability, hendriksonLabel, axes, binaryEvents)
- Persiste em `project_scenarios` com estrutura normalizada
- Substitui `parseScenarioProbabilities()` regex para novas análises
- PYTHIA e MNEMOSYNE com toolsConfig atualizado

### Sprint 19 — Voyage AI → Ollama + Ollama Auto-start + Gemini 2.0 removido (30 Mai 2026)

**Voyage AI substituído por Ollama nomic-embed-text:**
- `embed.ts`: roteador automático — `VOYAGE_API_KEY` → Voyage; `OLLAMA_BASE_URL` → Ollama; nenhum → erro explícito
- `extract.ts`: removido `return silencioso`; log identifica provider ativo
- Dimensões: Voyage 512 vs Ollama 768 — incompatíveis ao trocar provider (reindexar)
- Vantagens: sem limite mensal, sem API key, funciona air-gapped, latência menor

**Ollama auto-start:**
- Removido de `profiles: ["ollama"]` → sempre ativo
- Healthcheck: `ollama list` (binário nativo, sem curl)
- Novo serviço `ollama-init`: baixa `nomic-embed-text` na primeira inicialização
- API: `depends_on: ollama: condition: service_started`
- UI: "Iniciando… aguarde" em vez de comando docker

**Gemini 2.0 Flash removido:**
- `gemini-2.0-flash` e `gemini-2.5-flash-preview-05-20` removidos de todos os lugares
- `GOOGLE_MODELS_DEFAULT` (settings.ts): gemini-2.5-flash / lite / pro
- `GOOGLE_DEFAULT` (CommandBar.tsx): idem
- `platform_settings.llm` padrão: `gemini-2.5-flash-lite`
- `useLlmConfig.ts` default: `gemini-2.5-flash-lite`

---

## 8. ESTADO ATUAL DO BACKLOG

### ✅ Concluído (toda a history)

| Sprint | Item | Entrega |
|---|---|---|
| 1–2 | Arquitetura monolito | 7 agentes MSEF, exportação, autenticação |
| 3 | Migração v4 | Monorepo, Docker, JWT+2FA, backup |
| 4 | SDK v6 bugs | 5 bugs críticos corrigidos |
| 5 | Dados públicos + RAG | 51 indicadores, pgvector, streaming |
| 6 | Expansão metodológica | GRUMBACH, GODET, Painel Cliente |
| 7 | Railway + PoC | Deploy scripts, offline scripts |
| 8 | ICD 203 + AltA | 3 ferramentas ATS, 12 técnicas SAT, step streaming |
| 9 | Stepper + Ollama | Stepper dinâmico, Provider Factory |
| 10 | Dados globais + Playbook | FRED, Câmara, Senado, audit, rate limit |
| Sprint Final A+B | LangGraph preps + Tier System | 7 ferramentas analíticas, PostgresSaver preparado, tiers |
| 11 | ATHENA redesign | 6/6 suite, auditora pura, loops eliminados |
| 12 | ICD 203 v2 + Shift-Left | 9 ATS por macroetapa, 5 especialistas, 6/6 ✅ 985s |
| 13 | Fix enum + Prompt Cache | KRATOS desbloqueado, ~84% economia tokens |
| 14 | PostgresSaver | Checkpointing persistente, 4 tabelas auto-criadas |
| 15 | Suite de testes | banco+seg+kratos+artefatos+export 5×100%, SAT 5/7→7/7 |
| 16 | TAD + ATHENA v3 + Compiler | Segregação epistemológica, TAD condicional, report-compiler |
| 17 | CEEEx/SIPLEx + Tool Transparency | HERMES_SIPLEX removido, planejamento de fase |
| 18 | Testes + hash-chain + cenário | Suites arquitetura/plano/tad, SHA-256, tool_register_scenario |
| 19 | Voyage AI → Ollama + cleanup | Auto-start, nomic-embed-text, Gemini 2.0 removido |

### 🔲 Pendente — Longo Prazo

| # | Item | Descrição |
|---|---|---|
| 8 | Hybrid Sovereign Embedding | SentenceTransformers para AIR_GAPPED (Ollama já cobre SOBERANO) |
| 11 | Analytical Lineage Tracker | Trilha de auditoria: cada conclusão → evidências originais |
| 12 | Adaptive Briefing Engine | Resumos adaptativos por stakeholder/classificação |
| 13 | Cross-Project Horizon Scanning | Sinais fracos entre projetos do portfólio |

---

## 9. SUITE DE TESTES — RESULTADO ATUAL

**30/05/2026 · Google Gemini 2.5 Flash · TEST_MODE=true**

| Suite | Resultado | Tempo |
|---|---|---|
| banco | **5/5 ✅** | ~3s |
| arquitetura | **6/6 ✅** | ~4s |
| segurança | **6/6 ✅** | ~8s |
| kratos | **3/3 ✅** | ~20s |
| artefatos | **5/5 ✅** | ~1040s |
| exportação | **4/4 ✅** | ~123s |
| sat | **7/7 ✅** | ~1208s |
| metodologias | **6/6 ✅** | ~845s |
| **Total** | **42/42 ✅** | — |

---

## 10. INFRAESTRUTURA — COMANDOS ESSENCIAIS

### Rebuild normal (após alterar código)
```bash
docker compose build --no-cache api
docker compose up -d api
docker compose logs -f api
```

### Rebuild completo (api + web)
```bash
docker compose build --no-cache api web
docker compose up -d
```

### Patch de prompt direto no banco (sem rebuild)
```bash
docker exec olympus_api node -e "
const { db } = require('./packages/db/dist/db.js');
const { agents } = require('./packages/db/dist/schema.js');
const { eq } = require('drizzle-orm');
db.update(agents).set({ systemPrompt: '...' }).where(eq(agents.name,'KLIO'))
  .then(() => process.exit(0));
"
```

### Reset nuclear (APAGA O BANCO)
```bash
wsl --shutdown
docker compose down -v --rmi all
docker system prune -a -f --volumes
npm install
docker compose build --no-cache
docker compose up -d
docker exec olympus_db psql -U postgres -d olympus -c "CREATE EXTENSION IF NOT EXISTS vector;"
cd packages/db && npx drizzle-kit push && cd ../..
DATABASE_URL="postgres://postgres:postgres@localhost:5432/olympus" npx tsx apps/api/src/scripts/seed.ts
```

### Limpeza simples (preserva banco)
```bash
docker compose stop api
docker compose build --no-cache api
docker compose up -d api
```

---

## 11. RISCOS TÉCNICOS — AVALIAÇÃO ATUALIZADA

| Risco | Status | Observação |
|---|---|---|
| Context bloat em análises longas | ✅ **Resolvido** | `buildMemoryWindow()` com orçamento 32k tokens em produção desde Sprint Pré-LangGraph |
| Dependência Voyage AI | ✅ **Resolvido Sprint 19** | Ollama nomic-embed-text como padrão. Roteamento automático. Air-gapped. |
| Esgotamento limite Tavily gratuito | ⚠️ Monitorar | 1000 req/mês. Com 2+ clientes em monitoramento diário pode ser insuficiente |
| Rate limit Gemini em testes longos | ✅ Mitigado | Pauses entre suites + first-step rule reduz chamadas desnecessárias |
| HERMES_SIPLEX legado no banco | ⚠️ Cosmético | Agente inativo, seed não recria. Não causa problema operacional |
| Modelos Google descontinuados | ✅ **Resolvido Sprint 19** | gemini-2.0-flash removido de todos os lugares |

---

*Documento atualizado em 30/05/2026 — Sprint 19 concluído. Última suite de testes: 42/42 ✅.*
