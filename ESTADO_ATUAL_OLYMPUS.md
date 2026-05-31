# ESTADO ATUAL DO OLYMPUS v4
**Documento técnico para revisão de arquitetura e design — atualizado em 31/05/2026 (Sprint 21 concluído — Motor LangGraph-first)**
**Gerado por:** Claude Code (análise estática do código-fonte + execução da suite de testes)
**Destinatário:** Claude Chat / Claude Design — análise arquitetural, revisão de UI e continuidade do desenvolvimento

---

## 1. ESTRUTURA DE ARQUIVOS

```
Olympus/
├── apps/
│   ├── api/                        # Backend Node.js — Hono framework
│   │   └── src/
│   │       ├── index.ts            # Entry point: startup, CORS, JWT, rotas, pg-boss init, embed guard
│   │       ├── mailer.ts           # Nodemailer — alertas SMTP do KRATOS
│   │       ├── cron.ts             # pg-boss worker + node-cron scheduler (T-10c Sprint 20)
│   │       │                       # → enqueueKratosJob() + initKratosQueue() + limpeza 03h
│   │       ├── graph/              # LangGraph StateGraph — motor de orquestração ÚNICO (Sprint 21)
│   │       │   ├── builder.ts      # getOlympusGraph() async singleton — PostgresSaver
│   │       │   ├── postgresSaver.ts# PostgresSaver singleton — 4 tabelas checkpoint
│   │       │   ├── nodes.ts        # scopus/klio/pythia(HITL interrupt)/mnemosyne/integration/synthesis
│   │       │   ├── helpers.ts      # buildMemoryWindow(), buildAnchorCtx(), runAgentForPhase()
│   │       │   ├── router.ts       # routeFromState() + NODE_SLUG_TO_GRAPH_NODE
│   │       │   └── index.ts        # Reexporta builder, router, helpers, postgresSaver
│   │       ├── routes/
│   │       │   ├── chat.ts         # Rota única POST /stream/graph — motor LangGraph (Sprint 21)
│   │       │   ├── events.ts       # HITL API — CRUD project_events + batch/status (ordem correta no Hono)
│   │       │   ├── export.ts       # DOCX/PDF/HTML — watermark usa classificacao || 'ACESSO RESTRITO'
│   │       │   ├── kratos.ts       # API painel KRATOS (com filtro userId — IDOR corrigido Sprint 20)
│   │       │   ├── sessions.ts     # CRUD sessões/projetos
│   │       │   ├── settings.ts     # Config LLM + cache invalidation endpoints
│   │       │   ├── signals.ts      # API sinais fracos (IDOR corrigido)
│   │       │   ├── indicators.ts   # API indicadores (IDOR corrigido)
│   │       │   ├── audit.ts        # GET /audit + /audit/stats + GET /audit/verify (hash-chain)
│   │       │   ├── auth.ts         # Login, JWT jti, POST /logout, 2FA TOTP
│   │       │   ├── embeddings.ts   # RAG indexação (IDOR corrigido)
│   │       │   └── ...             # users, playbook, backup, docs, teams, engine, painel, reviews
│   │       ├── middleware/
│   │       │   └── rateLimit.ts    # Rate limiting PostgreSQL sliding window — admins isentos
│   │       ├── services/
│   │       │   ├── analysis.service.ts  # Somente cache: loadMethodology, invalidate, status (Sprint 21)
│   │       │   │   # runAnalysis() ELIMINADO — motor único LangGraph em graph/
│   │       │   └── report-compiler.ts  # Strategic Slate Compiler — 11 metodologias, standard/extended
│   │       ├── utils/
│   │       │   └── audit.ts        # logAudit() — hash-chain SHA-256 (_hash + _previousHash + _createdAt)
│   │       └── tools/
│   │           ├── technique-engine.ts     # SAT Engine — injeção de prompts por técnica
│   │           ├── analytic-standards.ts   # Ferramentas ICD 203
│   │           ├── analytical-engines.ts   # 8 ferramentas analíticas (JSON Schema puro)
│   │           ├── signals.ts              # createSignalTools(projectId)
│   │           └── rag.ts                  # buscar_documentos_internos
│   │
│   └── web/                        # Frontend React + Vite + TypeScript
│       └── src/
│           ├── App.tsx             # Componente raiz — estado global, handlers
│           │                       # + reportLayout toggle + cacheStatus polling (admin)
│           ├── hooks/
│           │   ├── useLlmConfig.ts # Estado LLM — gemini-2.5-flash-lite padrão
│           │   ├── useChat.ts      # SSE consumer + reportLayout no payload
│           │   └── useEvents.ts    # HITL events — aprovarTodos usa /batch/status
│           ├── components/
│           │   ├── layout/
│           │   │   ├── CommandBar.tsx    # LLM selector + Tiers + cache badge + reportLayout toggle
│           │   │   ├── EventsPanel.tsx  # HITL panel — flicker corrigido (sem !loading na condição)
│           │   │   ├── KratosPanel.tsx  # Dashboard KRATOS
│           │   │   └── Sidebar.tsx      # + menu admin: Auditoria · Hash-chain
│           │   ├── modals/
│           │   │   ├── AuditModal.tsx   # Tabela paginada + filtros + CSV + verificação integridade
│           │   │   └── ...             # NewSession, ProjectSettings, Users, Backup, Review
│           │   └── chat/               # MessageBubble, InputZone, AgentWorking
│           └── data/
│               └── methodologySteps.ts
│
└── packages/
    ├── core/
    │   └── src/
    │       ├── Agent.ts        # toolCallTracker — guard de loop (Bug A fix, Sprint pós-deploy)
    │       │                   # Tier→model, Anthropic Prompt Cache, stopWhen: stepCountIs(N)
    │       ├── Orchestrator.ts # Roteamento entre agentes
    │       ├── types.ts        # AgentContext completo
    │       └── nodeRouter.ts   # nodeSlug→agentName
    ├── db/
    │   └── src/
    │       ├── schema.ts   # Todas as tabelas Drizzle + revoked_tokens + rate_limit_logs (Sprint 20)
    │       └── db.ts       # Conexão postgres
    └── tools/
        └── src/
            ├── tavily.ts          # Busca web — guard connectivityMode
            ├── dados-publicos.ts  # ~62 indicadores públicos
            ├── embed.ts           # Roteador Voyage→Ollama automático
            └── index.ts
```

---

## 2. BANCO DE DADOS — SCHEMA

| Tabela | Descrição | Observações |
|--------|-----------|-------------|
| `users` | Usuários | id, name, email, passwordHash (bcryptjs cost=10), role |
| `methodologies` | Catálogo de metodologias | agentsConfig JSONB |
| `agents` | Agentes cadastrados | systemPrompt, toolsConfig, modelOverride (tier label) |
| `techniques` | Técnicas SAT (12 AltA) | name, description, instructions |
| `projects` | Projetos/sessões | id, name, methodology, status, kratosCron, alertEmails |
| `messages` | Histórico de mensagens | role, content, agentName, messageType |
| `methodology_phases` | Fases por metodologia | slug, node_slug |
| `agent_method_prompts` | Instruções por agente×metodologia | extraInstructions |
| `embeddings` | Vetores RAG (pgvector) | HNSW index `embeddings_hnsw_idx` (Sprint 20 T-06) |
| `audit_logs` | Logs de auditoria | metadata.\_hash + \_previousHash + **\_createdAt** (Sprint 20) |
| `project_events` | Eventos analíticos (TAD) | type, status, sourceEvaluation JSONB |
| `project_scenarios` | Cenários prospectivos | probability, matrixValue JSONB |
| `matrix_direct_impacts` | MICMAC | fromEventId, toEventId, impactScore 0-3 |
| `technique_execution_outputs` | Saídas matemáticas SAT | techniqueType, outputData JSONB |
| `platform_settings` | Config da plataforma | llm, llm\_tiers, anthropic\_models |
| `revoked_tokens` | JWT revogados (Sprint 20) | jti PK, userId, expiresAt — limpeza diária 03h |
| `rate_limit_logs` | Rate limit sliding window (Sprint 20) | userId, action, createdAt — índice composto |
| `checkpoints` etc. (4) | LangGraph | **PostgresSaver.setup() — NÃO no schema Drizzle** |
| `pgboss.*` | Fila KRATOS (Sprint 20 T-10c) | **pg-boss v12 — NÃO no schema Drizzle** |

---

## 3. AGENTES — INVENTÁRIO ATUAL

### 3.1 Orquestradores

| Agente | Metodologias | Observações |
|--------|--------------|-------------|
| **HERMES** | MSEF, Godet, Grumbach/Cenários, OTAN/AltA, SIEx/Estimativa, SIPLEx/CEEEx, IPEA/FGV, MPO, ASPLAN/Cenários, GBN, ESG | Orquestrador universal — todas as metodologias implementadas |
| **OLYMPUS** | Grumbach/Planejamento, SIEx-MPC, SIPLEx/Planejamento, SPED | Planejamento Estratégico — **não implementado ainda** |

> Grumbach/Cenários (slug `grumbach`) usa HERMES. Grumbach/Planejamento Estratégico (slug futuro `grumbach_plj`) usará OLYMPUS quando implementado.

### 3.2 Especialistas

| Agente | Tier | Ferramentas principais | Obrigações ICD 203 |
|--------|------|----------------------|--------------------|
| **SCOPUS** | economy | web_search, avaliar_fonte, tool_register_event | ATS 5 (KIQ) + ATS 3 (linchpin) |
| **KLIO** | premium | tool_register_event (FIRST-STEP), tool_register_impact_relation, buscar_dados_publicos | ATS 1 (TAD) + ATS 7 |
| **PYTHIA** | premium | tool_mactor_analysis, tool_esg_rii_calculator, tool_register_scenario | ATS 2 + ATS 8 + ATS 4 |
| **MNEMOSYNE** | premium | tool_register_scenario | ATS 6 + ATS 8 |
| **THEMIS** | premium | tool_mpo_backcasting | ATS 5 (Bet/Hedge) + ATS 9 |
| **KRATOS** | economy | buscar_dados_publicos, registrar_sinal, atualizar_sentinela | Relatório de monitoramento |
| **ATHENA** | premium | *(sem ferramentas — auditora pura)* | ATS 1-9 por macroetapa |

---

## 4. METODOLOGIAS — Definições Canônicas

**Fonte:** `D:\Pessoais\DEV\_Diversos\_contexto\Design\REVISAO_ARQUITETURA\metodologias.txt` (canônico)

### 4.1 Implementadas — Cenários Prospectivos e Estimativas ✅

| Nome Canônico | Slug canônico | Slug no banco | Orquestrador | Fases |
|---|---|---|---|---|
| MSEF v3 (8 etapas ENAP) | `msef` | `msef` ✅ | HERMES | 8 |
| Godet: Escola Estrutural | `godet` | `godet` ✅ | HERMES | 7 |
| Grumbach: Produção de Cenários | `grumbach` | `grumbach` ✅ | HERMES | 9 |
| OTAN/AltA | `otan` | `alta` ⚠️ | HERMES | 6 |
| SIEx: Conhecimento Estimativa EB | `siex` | `siex` ✅ | HERMES | 5 |
| SIPLEx/CEEEx: Cenários da Força Terrestre | `siplex_ceex` | `siplex` ⚠️ | HERMES | 7 |
| IPEA/FGV: Cenários Estreitados | `ipea` | `macroplan` ⚠️ | HERMES | 7 |
| MPO: Estratégia Brasil 2050 | `mpo` | `mpo` ✅ | HERMES | 8 |
| ASPLAN/MD: Produção de Cenários | `asplan` | `asplan` ✅ | HERMES | 7 |
| GBN (Global Business Network) | `gbn` | `futures` ⚠️ | HERMES | 8 |
| ESG: Cenários Prospectivos | `esg` | `esg` ✅ | HERMES | 6 |

### 4.2 Não Implementadas — Planejamento Estratégico e MPC 🔲

| Nome Canônico | Slug canônico | Orquestrador | Status |
|---|---|---|---|
| Grumbach: Planejamento Estratégico | `grumbach_plj` | OLYMPUS | 🔲 Fases não definidas |
| SIEx: Metodologia de Produção do Conhecimento | `siex_mpc` | OLYMPUS | 🔲 Fases não definidas |
| SIPLEx: Sistema de Planejamento Estratégico do Exército | `siplex_plj` | OLYMPUS | 🔲 Fases não definidas |
| SPED: Sistema de Planejamento Estratégico de Defesa | `asplan_sped` | OLYMPUS | 🔲 Fases não definidas |

> ⚠️ **Slugs divergentes** (`alta`, `siplex`, `macroplan`, `futures`): slugs históricos que diferem dos canônicos. Funcional (loadMethodology busca por nome+slug). Migração pendente preservando FKs.

---

## 5. PROVIDER LLM E TIER SYSTEM

```
platform_settings.llm       = { "provider": "google", "model": "gemini-2.5-flash-lite" }
platform_settings.llm_tiers = { "economy": "gemini-2.5-flash-lite", "premium": "gemini-2.5-flash" }
```

Railway usa Anthropic e Google (ambos configurados). Local usa Google + Ollama para embeddings.

| Tier | Agentes | Google | Anthropic |
|------|---------|--------|-----------|
| `economy` | SCOPUS, KRATOS | gemini-2.5-flash-lite | claude-sonnet-4-6 |
| `premium` | KLIO, PYTHIA, MNEMOSYNE, THEMIS, ATHENA | gemini-2.5-flash | claude-opus-4-7 |
| *(global)* | HERMES, OLYMPUS | via llm.model | via llm.model |

---

## 6. SEGURANÇA — SPRINT 20

| Feature | Implementação | Status |
|---|---|---|
| JWT + 2FA TOTP | auth.ts + speakeasy | ✅ |
| JWT jti + revogação | revoked_tokens + POST /logout | ✅ Sprint 20 |
| Rate limiting API | rate_limit_logs (PostgreSQL sliding window) — admin isento | ✅ Sprint 20 |
| Rate limiting nginx | api\_zone 30r/min + auth\_zone 10r/min | ✅ |
| IDOR protection | assertProjectOwner() em 6 rotas JWT | ✅ Sprint 20 |
| Hash-chain SHA-256 | _hash + _previousHash + **_createdAt** em audit_logs | ✅ Sprint 18/20 |
| Audit verify | GET /audit/verify — percorre chain e retorna { valid, firstInvalidId } | ✅ Sprint 20 |
| Audit Frontend | AuditModal: tabela, filtros, CSV, verificação integridade | ✅ Sprint 20 |
| Marca d'água exports | CSS watermark opacity:0.06 — texto = classificacao \|\| 'ACESSO RESTRITO' | ✅ |
| Backup corporativo | pg_dump v18 → .sql.gz admin-only | ✅ |

---

## 7. DEPLOY RAILWAY (30 Mai 2026)

**Status: ✅ Online**

| Serviço | Railway | URL |
|---------|---------|-----|
| olympus-production (API) | Dockerfile.api, PORT=3333, healthcheck=/ping | `olympus-production-production.up.railway.app` |
| olympus-web (Frontend) | Dockerfile.web, PORT=80, RAILWAY_API_URL configurado | `olympus-web-production-883c.up.railway.app` |
| Postgres (Plugin) | PostgreSQL 18.4 | DATABASE_URL injetado automaticamente |

**Configuração nginx:**
- `proxy_ssl_server_name on` — SNI correto para HTTPS upstream Railway
- `listen $PORT` — porta injetada pelo Railway (não hardcoded)
- `proxy_pass RAILWAY_API_URL_PLACEHOLDER/api/` — sed substitui no startup

**pg_dump:**
- Railway usa PostgreSQL 18. `postgresql-client-18` instalado via repositório PGDG
- Binário: `/usr/lib/postgresql/18/bin/pg_dump` (chamado diretamente — não o wrapper Perl)

---

## 8. KRATOS — pg-boss (T-10c)

Substituiu `KratosOrchestrator` in-memory por fila PostgreSQL via pg-boss v12.

```
node-cron dispara no horário → boss.send('kratos-analysis', data)
boss.work('kratos-analysis', { localConcurrency: 1 }) → runKratosJob()
```

- `localConcurrency: 1` → 1 job por vez (sem concorrência de conexões)
- `retryLimit: 2` + `retryDelay: 60s` → retry automático em falha transiente
- Histórico em `pgboss.job` — auditável
- `initKratosQueue()` chamado no startup após DB ready

---

## 9. SUITE DE TESTES (31/05/2026)

**42/42 ✅ local · potencial 65/65 com LLM real**

| Suite | Resultado | Observações |
|---|---|---|
| banco | 5/5 ✅ | — |
| arquitetura | 6/6 ✅ | DB state sem LLM |
| segurança | 6/6 ✅ | Auth, roles, JWT, audit |
| kratos | 3/3 ✅ | pg-boss worker ativo |
| artefatos | 5/5 ✅ | MNEMOSYNE 4 narrativas, THEMIS alertas |
| exportação | 4/4 ✅ | DOCX, PDF, watermark |
| sat | 7/7 ✅ | 7 ferramentas analíticas |
| metodologias | 9/11 ✅ (2 infra) | 11 metodologias incl. SIEx+SIPLEx+ESG — 2 ❌ por restart API durante teste |
| plano | stress test pendente | [PLANO fase X] no orquestrador |
| tad | stress test pendente | Segregação + TAD + nexo temporal |

---

## 10. REGRAS DE ENGENHARIA CRÍTICAS

```
1.  Zod PROIBIDO em ferramentas e nós do grafo (TS2589)
2.  packages/tools NÃO importa @olympus/db
3.  stopWhen: stepCountIs(N) — nunca maxSteps (ignorado no SDK v6)
4.  Rebuild obrigatório após alterar packages/core ou apps/api/src
5.  Ao trocar provider LLM: atualizar AMBOS llm E llm_tiers em platform_settings
6.  Tabelas checkpoint* e pgboss.*: NÃO adicionar ao schema Drizzle
7.  Enums Gemini: "type":"string" — Gemini rejeita "type":"number","enum":[1,2]
8.  Enumerações node_slug no prompt OLYMPUS: NÃO usar
9.  Ao trocar embedding provider (Voyage↔Ollama): reindexar todos os embeddings
10. SIPLEx usa HERMES + agentMethodPrompts/siplex — não criar orquestradores por metodologia
11. Hono route order: PATCH /batch/status DEVE preceder PATCH /:id/status
12. railway.toml: sem dockerfilePath/healthcheckPath — cada serviço usa o dashboard
13. nginx Railway: proxy_ssl_server_name on + porta via $PORT
14. pg_dump Railway: /usr/lib/postgresql/18/bin/pg_dump via PGDG apt
15. Admin isento de rate limit de análise (8-10 calls por sessão MSEF em passos)
```

---

## 11. BUGS ATIVOS (identificados no smoke test 30 Mai 2026)

| # | Bug | Status | Localização |
|---|-----|--------|-------------|
| #2/#3 | Conteúdo duplicado (transcrito + resumido) | ✅ Sprint 21 | Instrução "Transcreva verbatim" → "Apresente sem duplicar" |
| D | Páginas vazias no PDF — mensagens `parcial` curtas | ✅ Sprint 21 | filterAgentMessages threshold 800 chars |
| #6 | `---` repetido (LLM artifact) | ✅ Sprint 21 | regex `/(\n\s*---\s*){3,}/g` |
| C | Export bloqueado quando especialista retorna erro | ✅ Sprint 21 | useExport.ts fallback 3 níveis (>300 chars) |

---

## 12. PONTOS DE ATENÇÃO ARQUITETURAIS E DE UI

### 12.1 Decisões arquiteturais conhecidas (intencionais)

- **Motor único LangGraph (Sprint 21):** `/chat/stream` e rota síncrona removidas. Apenas `/chat/stream/graph`. Os 4 modos (passos/etapa/passagem/thinking) são configurações do grafo.
- **`analysis.service.ts`:** gutted Sprint 21 — apenas 3 funções de cache de metodologia (loadMethodology, invalidateMethodologyCache, getMethodologyCacheStatus). runAnalysis() eliminado.
- **KRATOS:** usa `runDirectAgent()` de `graph/helpers.ts` — execução direta sem grafo (monitoramento single-agent).
- **App.tsx com estado global centralizado:** padrão MVP deliberado

### 12.2 Débito técnico

- **parseScenarioProbabilities() — regex:** ainda em uso para análises antigas (painel KRATOS). `tool_register_scenario` é o substituto para análises novas
- **Bug #2/#3:** mensagem duplicada — requer investigação do fluxo onDone + save em analysis.service.ts
- **Bug D:** páginas vazias PDF — threshold de conteúdo mínimo no export

### 12.3 UI/UX — itens pendentes

- **vizMode `passos` vs `etapa`:** diferença não é clara na UI para o usuário
- **EventsPanel:** funcional, sem theming consistente com restante da UI
- **CONFIRMAR contextualizado:** ✅ Sprint pós-deploy — injeta [Fase N/Total] automaticamente

---

*Gerado em 31/05/2026 — Sprint 20 + pós-deploy concluídos — Railway online — 42/42 testes ✅*
*Para revisão de arquitetura e UI pelo Claude Chat e Design*
