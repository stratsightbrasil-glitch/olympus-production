# OLYMPUS v4.0 — Documentação de Arquitetura
**StratSight Brasil · Strategic Foresight · IA Agêntica**
**Atualizado:** 27 de Maio de 2026 (Sprint Fase 2 LangGraph JS + Low Priority Hardening)

---

## 1. Arquitetura do Sistema — Modelo C4

### Nível 1 — Contexto

**Usuários finais:**
- **Analista Estratégico** — cria sessões de análise, seleciona metodologia, interage com o motor de IA via chat, aprova eventos HITL, exporta relatórios
- **Administrador** — gerencia usuários, configura modelos LLM, visualiza audit logs, agenda monitoramento KRATOS
- **Cliente (role: cliente)** — acesso somente-leitura ao painel de cenários e indicadores via URL autenticada

**Sistemas externos:**
| Sistema | Tipo | Uso |
|---------|------|-----|
| Anthropic API | LLM | Geração de texto, tool calling, Extended Thinking |
| Ollama (opcional) | LLM local | Alternativa soberana/air-gapped via OpenAI-compat API |
| Tavily Search API | Busca web | Acesso a dados em tempo real pelos agentes SCOPUS, KLIO, KRATOS |
| Voyage AI | Embeddings | Geração de vetores 512-dim para RAG (voyage-3-lite) |
| BCB/IBGE/IPEA/FMI/OMS/ONU/ITU/Comex | APIs públicas | Indicadores econômicos e geopolíticos (62 séries) |
| FRED / Federal Reserve | API | 8 séries econômicas dos EUA (chave opcional) |
| Câmara dos Deputados / Senado | APIs abertas | Proposições e votações BR |
| DOU (INLABS) | API | Diário Oficial da União |
| SMTP (Nodemailer) | E-mail | Alertas automáticos do KRATOS |
| n8n | Webhook | Integração de automações externas (opcional) |
| Railway | PaaS | Plataforma de hospedagem em produção |

---

### Nível 2 — Contêineres

```
┌─────────────────────────────────────────────────────────────────┐
│                         OLYMPUS v4.0                            │
│                                                                 │
│  ┌──────────────┐     HTTPS/80      ┌─────────────────────┐    │
│  │  olympus_web  │ ◄──────────────► │  Analista / Admin   │    │
│  │  Nginx:alpine │                  └─────────────────────┘    │
│  │  porta: 80    │                                             │
│  │  - Serve      │  /api/* →         ┌──────────────────────┐  │
│  │    build Vite │ ─────────────────►│   olympus_api        │  │
│  │  - Rate limit │  HTTP/3333        │   Hono + Node.js 20  │  │
│  │  - Proxy rev. │                   │   porta: 3333        │  │
│  └──────────────┘                   │   - REST API         │  │
│                                     │   - SSE Streaming    │  │
│                                     │   - LangGraph Graph  │  │
│                                     │   - Cron KRATOS      │  │
│                                     └──────────┬───────────┘  │
│                                                │ TCP/5432      │
│                                     ┌──────────▼───────────┐  │
│                                     │   olympus_db          │  │
│                                     │   PostgreSQL 15       │  │
│                                     │   + pgvector          │  │
│                                     │   porta: 5432 interna │  │
│                                     └──────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  olympus_ollama (opcional — profile: ollama)             │  │
│  │  Ollama:latest · porta: 11434 · 8GB RAM · llama3.1:8b    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Comunicação:**
- Frontend → API: REST + SSE via nginx proxy reverso (timeout 300s)
- API → PostgreSQL: Drizzle ORM via `postgres.js` (pool interno Docker)
- API → Anthropic: HTTPS via `@ai-sdk/anthropic`
- API → Ollama: HTTP/`/v1/chat/completions` via `@ai-sdk/openai` (compatível)
- API → APIs externas: HTTPS via `fetch` nativo (Node.js 20)
- API → SMTP: TCP via Nodemailer

---

### Nível 3 — Componentes Principais

#### Backend (`apps/api/src/`)

```
apps/api/src/
├── index.ts              Entry point — CORS, JWT middleware, startup, seed platform_settings
├── mailer.ts             Nodemailer — envio de e-mails SMTP (alertas KRATOS)
├── cron.ts               KratosOrchestrator — fila de análises autônomas com cooldown
│
├── graph/                ── LangGraph StateGraph (motor v2) ──────────────────────────────
│   ├── builder.ts        buildGraph() — StateGraph<OlympusState> com 6 nós
│   ├── nodes.ts          Nós: scopus/klio/pythia(HITL)/mnemosyne/integration/synthesis
│   ├── helpers.ts        loadMessagesFromDb(limit=200)
│   ├── boundedMemorySaver.ts  Checkpointer LRU in-memory
│   ├── router.ts         routeFromState() — conditional edges com two-step slug lookup
│   └── index.ts          Reexporta buildGraph()
│
├── routes/               ── Endpoints HTTP ───────────────────────────────────────────────
│   ├── chat.ts           POST /chat + POST /chat/stream + POST /chat/stream/graph (SSE)
│   ├── events.ts         GET/POST/PATCH/DELETE /events — HITL API
│   ├── export.ts         POST /export/pdf | /docx | /estimativa — async render + cache 5min
│   ├── sessions.ts       CRUD /sessions
│   ├── auth.ts           POST /login | /register — JWT + 2FA + rate limiting por IP
│   ├── users.ts          CRUD /users (admin)
│   ├── indicators.ts     CRUD /indicators + appendHistory() + autoRegisterSignal()
│   ├── signals.ts        CRUD /signals — sinais fracos
│   ├── kratos.ts         GET /kratos/:id/dashboard — painel de monitoramento
│   ├── settings.ts       GET/PATCH /settings — LLM config, tiers, modelos
│   ├── embeddings.ts     POST /embeddings/index | delete | count — RAG
│   ├── extract.ts        POST /extract — extração de documentos (PDF/DOCX/TXT/img)
│   ├── playbook.ts       POST /playbook/gerar — DOCX operacional
│   ├── audit.ts          GET /audit + /audit/stats — logs de auditoria
│   ├── engine.ts         GET /engine/methodologies | /techniques
│   ├── painel.ts         GET /painel/project/:id — painel HTML do cliente
│   └── backup.ts         GET/POST /backup — pg_dump + download
│
├── tools/                ── Ferramentas dos agentes ──────────────────────────────────────
│   ├── analytical-engines.ts  7 ferramentas (JSON Schema puro): tool_register_event,
│   │                           tool_mpc_source_evaluator, tool_mactor_analysis, etc.
│   ├── analytic-standards.ts  ICD 203: declarar_julgamento, registrar_hipotese_alternativa,
│   │                           avaliar_fonte
│   ├── signals.ts         registrar_sinal, buscar_sinais, atualizar_sentinela
│   ├── rag.ts             buscar_documentos_internos (pgvector 512-dim)
│   └── technique-engine.ts    TechniqueEngine — injeção dinâmica de prompts SAT
│
├── middleware/
│   └── rateLimit.ts      In-memory bucket por userId: 5 análises/h, 10 exports/h
│
└── utils/
    └── audit.ts          logAudit() — helper silencioso para audit_logs
```

#### Motor Multi-Agente (`packages/core/src/`)

```
packages/core/src/
├── Agent.ts          Executa agente via generateText/streamText; resolve tier→model
├── Orchestrator.ts   Registra agentes, despacha execuções (motor v1, substituído pelo grafo)
├── types.ts          AgentContext: projectId, methodology, memory, llmConfig, llmTiers,
│                     phases, connectivityMode, anchorContext, callbacks
├── nodeRouter.ts     getNodeRouter(phases): nodeSlugOf(phaseSlug), firstSlug(), nextSlug()
└── index.ts          Reexporta tudo + OlympusState
```

#### Banco de Dados (`packages/db/src/schema.ts`) — tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `users` | Autenticação, roles (admin/analista/cliente), 2FA TOTP |
| `projects` | Sessões de análise — methodology, status, kratosCron, alertEmails, connectivity_mode |
| `messages` | Histórico do chat — role, content, agentName |
| `methodology_phases` | Fases por metodologia — slug único, node_slug LangGraph |
| `project_events` | Eventos analíticos — tendências, incertezas, FPFs; status proposed/approved/rejected; MPC A-F × 1-6 |
| `project_scenarios` | Cenários narrativos derivados de eventos aprovados |
| `matrix_direct_impacts` | Impactos diretos MICMAC — fromEventId × toEventId × impactScore 0-3 |
| `technique_execution_outputs` | Saídas matemáticas SAT (MICMAC, SMIC, MACTOR) persistidas |
| `embeddings` | Vetores RAG — chunkText, embedding vector(512), metadata JSONB |
| `indicators` | Monitoramento KRATOS — thresholds, lastValue, valueHistory JSONB |
| `weak_signals` | Sinais fracos — tipo, statusRadar, sentinela, classificação |
| `platform_settings` | Config plataforma — key TEXT PK, value JSONB (llm, llm_tiers, etc.) |
| `audit_logs` | Logs de auditoria append-only imutáveis |

#### Frontend (`apps/web/src/`)

```
apps/web/src/
├── App.tsx                Raiz — estado global, vizMode, hitlGate, resumeGraph
├── components/
│   ├── layout/
│   │   ├── CommandBar.tsx  LLM Selector, Tier Config, EventsPanel, modos de análise
│   │   ├── KratosPanel.tsx Dashboard indicadores (Sparkline SVG), sinais fracos, filtros
│   │   ├── Sidebar.tsx     Histórico de sessões, busca, admin (Usuários/Backup)
│   │   └── RightPanel.tsx  Painel de artefatos visuais (Matriz 2×2, PESTEL Scatter)
│   ├── chat/
│   │   ├── MessageBubble.tsx  Bolha por agente com AgentMark e ações inline
│   │   ├── InputZone.tsx      Input com upload de arquivos
│   │   └── AgentWorking.tsx   Spinner + stepLog (últimas 7 etapas em tempo real)
│   └── canvas/artifacts/
│       ├── Matriz2x2/      Artefato interativo — Matriz 2×2 PYTHIA
│       └── PestelScatter/  Scatter PESTEL com eixos clicáveis
```

---

## 2. Instruções de Funcionamento e Configuração

### Requisitos Prévios

| Ferramenta | Versão | Obrigatório |
|-----------|--------|-------------|
| Docker Desktop | 24+ | Sim |
| Node.js | 20+ | Para desenvolvimento local |
| npm | 10+ | Para desenvolvimento local |
| WSL2 (Windows) | — | Recomendado para builds |

**WSL2 `.wslconfig` recomendado** (`%USERPROFILE%\.wslconfig`):
```ini
[wsl2]
memory=8GB
processors=4
swap=2GB
```

### Setup Local (Docker — recomendado)

```bash
# 1. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com: ANTHROPIC_API_KEY, TAVILY_API_KEY, JWT_SECRET, VOYAGE_API_KEY

# 2. Build e subida
docker compose build --no-cache
docker compose up -d

# 3. Aplicar schema (apenas primeira vez ou após -v)
docker exec olympus_db psql -U postgres -d olympus -c "CREATE EXTENSION IF NOT EXISTS vector;"
cd packages/db && npx drizzle-kit push && cd ../..

# 4. Seed de agentes, metodologias e configurações
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/olympus"
npx tsx apps/api/src/scripts/seed.ts

# 5. Verificar saúde
docker compose logs -f api     # aguardar "Server running on port 3333"
curl http://localhost/health   # deve retornar { status: "ok" }
```

**Variáveis de ambiente obrigatórias** (`.env`):
```bash
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
JWT_SECRET=<string aleatória 32+ chars>
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/olympus
VOYAGE_API_KEY=pa-...                    # RAG
ALLOWED_ORIGIN=http://localhost:80
```

**Variáveis opcionais:**
```bash
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS   # Alertas KRATOS
FRED_API_KEY                                     # Séries FRED/Federal Reserve
INLABS_EMAIL / INLABS_PASSWORD                  # DOU
ITU_EMAIL / ITU_PASSWORD                        # ITU DataHub
OLLAMA_BASE_URL=http://ollama:11434/v1           # Provider alternativo
N8N_WEBHOOK_URL                                  # Webhook n8n
JWT_EXPIRY=8h                                    # 1h|4h|8h|24h|7d
CONNECTIVITY_MODE=ONLINE                         # ONLINE|SOBERANO|AIR_GAPPED
```

### Rebuild após mudança de código

```bash
# Qualquer mudança em packages/* ou apps/api:
docker compose build --no-cache api && docker compose up -d api

# Apenas frontend:
docker compose build --no-cache web && docker compose up -d web

# Reset nuclear (apaga banco — USE COM CUIDADO):
docker compose down -v --rmi all && docker system prune -a -f --volumes
# → repetir steps 2-5 do setup acima
```

### Pipeline de Deploy (Railway)

1. Criar projeto no Railway → adicionar PostgreSQL addon → copiar `DATABASE_URL`
2. Serviço API: `Dockerfile.api`, porta 3333, variáveis do `.env` + `PORT` injetado pelo Railway
3. Serviço Web: `Dockerfile.web`, `RAILWAY_API_URL=https://<url-api>`, porta 80
4. Health check: `GET /health` — Railway monitora automaticamente
5. Após primeiro deploy: `railway run npx tsx apps/api/src/scripts/seed.ts`
6. Domínio: configurar CNAME `athena.stratsight.com.br` → URL Railway Web

Referência completa: `RAILWAY_DEPLOY.md`

---

## 3. Guia de Manutenção e Operação (Ops)

### Troubleshooting

| Problema | Sintoma | Solução |
|---------|---------|---------|
| **API não sobe** | `ECONNREFUSED 127.0.0.1:5432` nos logs | Postgres não está pronto — aguardar `healthcheck` ou rodar retry manual. Verificar `docker compose ps` |
| **Análise retorna string vazia** | `response.text = ""` após tool calls | `stopWhen` ausente — sempre usar `stopWhen: stepCountIs(N)` (não `maxSteps`) no Vercel AI SDK v6 |
| **KRATOS não envia e-mail** | Log `⚠️ Nenhum e-mail de alerta configurado` | Preencher `alertEmails` no projeto via painel Admin ou `ALERT_EMAIL` no `.env` |
| **Embeddings falhando** | Erros no `/extract` com RAG | Verificar `VOYAGE_API_KEY`. Para Ollama, verificar que `nomic-embed-text` está disponível |
| **Timeout nas análises** | HTTP 504 pelo nginx | `proxy_read_timeout 300s` já configurado — se persistir, verificar `NODE_OPTIONS=--max-old-space-size=1024` |
| **HITL não retoma** | Grafo travado após aprovação de evento | Verificar se `hitlGate` foi resetado no frontend e se `PUT /api/v1/events/:id` retornou 200 |
| **Credenciais docker erradas** | `authentication failed for user` | Verificar que `.env` tem `POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB` corretos. `DATABASE_URL` do `.env` é ignorada para a API (montada de partes individuais) |
| **Rate limit 429 inesperado** | Respostas 429 em chamadas repetidas | nginx `auth_zone` = 10r/m para `/auth/*`. Aguardar janela ou aumentar burst em `nginx-limits.conf` |
| **Build TypeScript com TS2307** | `Cannot find module '@olympus/tools'` | `@olympus/tools: "*"` precisa estar em `apps/api/package.json`. `docker compose build --no-cache api` |
| **Container sem memória** | OOMKilled no Railway | Aumentar limite em `deploy.resources.limits.memory`. API: 1024M; Web: 128M; DB: 512M |

### Logs e Monitoramento

**Onde os logs ficam:**
```bash
# Logs do container (últimas 100 linhas):
docker compose logs --tail=100 api

# Seguir em tempo real:
docker compose logs -f api

# Logs estruturados JSON (driver json-file, max 10MB × 3 arquivos):
/var/lib/docker/containers/<id>/<id>-json.log
```

**Métricas críticas a observar:**

| Métrica | Como verificar | Limiar de atenção |
|---------|---------------|-------------------|
| Saúde geral | `GET /health` | `status != "ok"` ou `latencyMs > 500` |
| Uso de memória API | `docker stats olympus_api` | > 900MB (limite: 1024M) |
| Fila KRATOS | Logs `[KRATOS] 📥 Projeto ... entrou na Fila` | Fila > 5 projetos acumulados |
| Erros Anthropic | Logs `[KRATOS CRON] ❌ Erro` | Qualquer erro — verificar API key e rate limits |
| Tokens Tavily | Logs `web_search` 429 | Esgotou 1.000 req/mês do plano free |
| Disco pgdata | Volume `pgdata` | > 80% capacity |

**Audit logs via API:**
```bash
# Últimas 50 ações de login:
GET /api/v1/audit?action=login&limit=50
Authorization: Bearer <jwt-admin>

# Estatísticas por ação:
GET /api/v1/audit/stats
```

---

## 4. Histórico de Decisões Arquiteturais (ADR)

### ADR-01 — TypeScript Full-Stack em vez de Python

**Contexto:** Stack de IA geralmente usa Python (LangChain, FastAPI). O OLYMPUS é um produto web que orquestra LLMs comerciais.

**Decisão:** TypeScript em todo o stack (frontend React + backend Hono + ORM Drizzle).

**Prós:** Contrato de tipo compartilhado do banco ao UI; Vercel AI SDK de referência para streaming e tool calling; I/O assíncrono nativo em Node.js; sem bridging de linguagens.

**Contras:** Ecossistema Python mais maduro para cálculos numéricos densos (MICMAC M^k, SMIC). Mitigação futura: microserviço Python isolado para matemática SAT.

---

### ADR-02 — Vercel AI SDK (`ai@6`) em vez de SDK Anthropic direto

**Contexto:** SDK Anthropic é o mais simples, mas agnóstico de provedor facilita experimentação com Ollama/Sabiá-3.

**Decisão:** Vercel AI SDK v6 com `@ai-sdk/anthropic` e `@ai-sdk/openai` (para Ollama).

**Prós:** Provider factory genérica; streaming real com `streamText`; tool calling padronizado; Extended Thinking nativo.

**Contras:** Curva de aprendizado dos breaking changes do SDK v6 (`stopWhen`, `inputSchema`, `prepareStep`). Armadilhas documentadas em `HISTORICO_MIGRACAO.md §8`.

---

### ADR-03 — LangGraph JS em vez de orquestração linear

**Contexto:** `Orchestrator.dispatch()` era linear e stateless — impossível fazer checkpointing, HITL ou roteamento condicional por fase.

**Decisão:** `@langchain/langgraph` com `StateGraph<OlympusState>` substituindo o Orchestrator como motor principal.

**Prós:** Checkpointing nativo (retomada após interrupção); HITL via `interrupt()`; roteamento condicional por metodologia (10 metodologias × N fases); auditável por thread_id.

**Contras:** `PostgresSaver` adiado — `BoundedMemorySaver` in-memory não persiste entre reinícios do container. Para produção multi-instância, migrar para `PostgresSaver`.

---

### ADR-04 — PostgreSQL + pgvector em vez de SQLite + embedding separado

**Contexto:** SQLite era o plano original (simples, zero-config).

**Decisão:** PostgreSQL 15 com extensão pgvector para RAG integrado.

**Prós:** Concorrência real para múltiplos analistas; pgvector elimina banco de vetores separado (sem Pinecone/Weaviate); pg_dump para backup corporativo; Drizzle ORM com tipagem completa.

**Contras:** Overhead operacional de um serviço PostgreSQL. Mitigado pelo healthcheck do Docker e pelo design de single-instance.

---

### ADR-05 — JSON Schema puro em vez de Zod para ferramentas do agente

**Contexto:** Dual-package hazard do Zod no monorepo NPM — duas instâncias físicas causavam `instanceof ZodObject = false` no Agent.ts, quebrando tool calling silenciosamente.

**Decisão:** Schemas de ferramentas como objetos JavaScript puros em `TOOL_JSON_SCHEMAS`, embrulhados em `jsonSchema()` do Vercel AI SDK.

**Prós:** Zero dependência de Zod no motor de IA; sem risco de versão dupla; schemas legíveis como JSON.

**Contras:** Sem validação em runtime de argumentos das ferramentas (aceito — os agentes LLM geram schemas corretos com a instrução adequada).

---

### ADR-06 — BoundedMemorySaver em vez de PostgresSaver

**Contexto:** LangGraph requer um checkpointer para persistir o estado do grafo entre retomadas HITL.

**Decisão:** `BoundedMemorySaver` in-memory (LRU 50 threads, TTL 2h) como primeira implementação.

**Prós:** Zero dependência de banco para checkpointing; sem race condition de lock em reinícios; suficiente para carga single-instance.

**Contras:** Estado perdido em restart do container. Para projetos com análises muito longas (>2h) ou multi-instância Railway, migrar para `PostgresSaver` no schema `langgraph_checkpoints`.

---

### ADR-07 — Rate Limiting em 3 camadas

**Decisão:** Três camadas independentes de rate limiting:
1. **nginx** (`nginx-limits.conf`): defesa de borda — bloqueia antes de tocar a API
2. **auth.ts** (`makeRateLimiter`): proteção específica de `/register` contra enumeração
3. **middleware/rateLimit.ts**: limites por `userId` para análises e exports

**Justificativa:** Clientes de defesa e governo exigem demonstração de controles de segurança em múltiplas camadas. Redundância intencional.

---

*OLYMPUS v4.0 · StratSight Brasil · Maio 2026 · Acesso Restrito*
