# OLYMPUS v4 — Histórico de Desenvolvimento e Estado Atual
**StratSight Brasil · Strategic Foresight · IA Agêntica**
**Atualizado em:** 30 Mai 2026 (Sprint 19 concluído)
**Destinatário:** Claude Chat / Claude Design — revisão de arquitetura e UI

---

## PARTE 1 — CONTEXTO E STACK

### O que é o OLYMPUS
Plataforma multi-agente de Strategic Foresight e monitoramento contínuo.

```
OLYMPUS
├── Motor ATHENA   → produção de cenários (11 metodologias, 9 agentes)
├── Motor KRATOS   → monitoramento contínuo (indicadores, alertas, cron)
├── Painel Cliente → URL compartilhável com JWT, dashboard de indicadores
└── API OLYMPUS    → webhooks n8n, integração com parceiros
```

**Premissas de negócio:** operação solo · custo < R$1.500/mês · clientes defesa/governo (air-gapped, CONFIDENCIAL, auditoria) · produto-âncora R$80K–250K · meta Ano 1: R$300K · exit Big Tech em 8 anos · O Playbook MSEF é o principal ativo de PI.

### Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Backend | Hono + Node.js + TypeScript |
| IA | Vercel AI SDK v6 (`ai@6.0.168`) — agnóstico de provider |
| Banco | PostgreSQL 15 + pgvector + Drizzle ORM |
| Orquestração v1 | ReAct via Agent.ts (produção) |
| Orquestração v2 | LangGraph JS (rota experimental `/stream/graph`) |
| Embeddings | Ollama nomic-embed-text (padrão local) / Voyage AI (cloud, opcional) |
| Containers | Docker Compose — api + web + db + ollama (auto-start Sprint 19) |

### Provider LLM ativo
- **Google Gemini 2.5 Flash** (plano profissional)
- `platform_settings.llm` → `{ "provider": "google", "model": "gemini-2.5-flash-lite" }`
- `platform_settings.llm_tiers` → `{ "economy": "gemini-2.5-flash-lite", "premium": "gemini-2.5-flash" }`

---

## PARTE 2 — ESTRUTURA DE ARQUIVOS

```
Olympus/
├── apps/
│   ├── api/src/
│   │   ├── index.ts                # Entry point, startup, CORS, JWT
│   │   ├── cron.ts                 # KratosOrchestrator — cron jobs
│   │   ├── graph/
│   │   │   ├── builder.ts          # getOlympusGraph() async — PostgresSaver
│   │   │   ├── postgresSaver.ts    # Singleton async — 4 tabelas checkpoint
│   │   │   ├── nodes.ts            # 6 nós LangGraph
│   │   │   ├── helpers.ts          # buildMemoryWindow(), buildAnchorCtx()
│   │   │   └── router.ts           # routeFromState()
│   │   ├── routes/
│   │   │   ├── chat.ts             # Motor principal — loadMethodology(), runAnalysis()
│   │   │   │                       # + PROTOCOLO DE PLANEJAMENTO DE FASE
│   │   │   │                       # + Strategic Slate Compiler
│   │   │   ├── events.ts           # HITL API — CRUD project_events
│   │   │   ├── export.ts           # Exportação DOCX/PDF/HTML
│   │   │   ├── settings.ts         # Config LLM — GET/PATCH, getLLMTiers()
│   │   │   └── audit.ts / sessions / kratos / indicators / signals / ...
│   │   ├── services/
│   │   │   └── report-compiler.ts  # Strategic Slate Compiler — 9 metodologias
│   │   ├── utils/
│   │   │   └── audit.ts            # logAudit() — hash-chain SHA-256
│   │   └── tools/
│   │       ├── analytical-engines.ts  # 8 ferramentas analíticas (JSON Schema puro)
│   │       ├── analytic-standards.ts  # ICD 203 (declarar_julgamento, etc.)
│   │       ├── technique-engine.ts    # SAT Engine
│   │       └── signals.ts / rag.ts
│   │
│   └── web/src/
│       ├── App.tsx                 # Componente raiz (~1700 linhas)
│       ├── hooks/useLlmConfig.ts   # Estado LLM — default: gemini-2.5-flash-lite
│       ├── components/
│       │   ├── layout/
│       │   │   ├── CommandBar.tsx  # Seletor LLM + Tiers
│       │   │   ├── KratosPanel.tsx # Dashboard KRATOS (~630 linhas)
│       │   │   └── Sidebar.tsx     # Histórico + sessões
│       │   ├── chat/               # MessageBubble, InputZone, AgentWorking
│       │   └── canvas/artifacts/   # Matriz2x2, PestelScatter
│       └── data/methodologySteps.ts
│
└── packages/
    ├── core/src/
    │   ├── Agent.ts        # Executa agentes — tier→model, Prompt Cache
    │   ├── Orchestrator.ts # Roteamento entre agentes
    │   ├── types.ts        # AgentContext completo
    │   └── nodeRouter.ts   # nodeSlug→agentName
    ├── db/src/schema.ts    # Todas as tabelas Drizzle
    └── tools/src/
        ├── embed.ts        # Roteador Voyage→Ollama automático
        ├── tavily.ts       # Guard connectivityMode
        └── dados-publicos.ts  # ~62 indicadores públicos
```

---

## PARTE 3 — BANCO DE DADOS

| Tabela | Descrição | Notas |
|--------|-----------|-------|
| `users` | Usuários | role: analista/admin/cliente |
| `methodologies` | 11 metodologias | agentsConfig JSONB (agents[] + steps[]) |
| `methodology_phases` | Fases por metodologia | slug, node_slug (mapeamento LangGraph) |
| `agents` | 9 agentes | systemPrompt, toolsConfig, modelOverride (tier label) |
| `agent_method_prompts` | Instruções agente×metodologia | extraInstructions injetado em runtime |
| `techniques` | 12 técnicas SAT (AltA) | — |
| `projects` | Projetos/sessões | methodology, kratosCron, alertEmails, deletedAt |
| `messages` | Histórico de mensagens | role, content, agentName |
| `embeddings` | Vetores RAG (pgvector) | vector(512) Voyage / vector(768) Ollama |
| `project_events` | Eventos analíticos (TAD) | sourceEvaluation JSONB (reliability A-F, credibility 1-6) |
| `project_scenarios` | Cenários prospectivos | probability, matrixValue JSONB |
| `matrix_direct_impacts` | MICMAC | fromEventId, toEventId, impactScore 0-3 |
| `technique_execution_outputs` | Saídas matemáticas SAT | techniqueType, outputData JSONB |
| `audit_logs` | Logs de auditoria | metadata._hash + ._previousHash (hash-chain SHA-256) |
| `platform_settings` | Config plataforma | llm, llm_tiers, anthropic_models |
| `checkpoints` + 3 tabelas | LangGraph | **Gerenciadas pelo PostgresSaver.setup() — NÃO no schema Drizzle** |

---

## PARTE 4 — AGENTES

### Orquestradores

| Agente | Metodologias | Observação |
|--------|--------------|------------|
| **HERMES** | MSEF, Godet, GBN, IPEA/FGV, OTAN/AltA, MPO, ASPLAN, ESG, SIPLEx/CEEEx | Orquestrador universal |
| **OLYMPUS** | Grumbach, SIEX-MPC | Planejamento Estratégico |

> **Sprint 17:** HERMES_SIPLEX foi removido como anti-padrão (orquestrador específico por metodologia). SIPLEx/CEEEx agora usa HERMES + `agentMethodPrompts/siplex`. O agente permanece no banco como legado mas não é recriado pelo seed.

### Especialistas

| Agente | Tier | Ferramentas analíticas principais | ATS ICD 203 |
|--------|------|----------------------------------|-------------|
| **SCOPUS** | economy | tool_register_event | ATS 5 (KIQ) + ATS 3 (linchpin) |
| **KLIO** | premium | **tool_register_event** (FIRST-STEP), tool_register_impact_relation, tool_mpc_source_evaluator | ATS 1 (TAD) + ATS 7 (trajetória) |
| **PYTHIA** | premium | tool_mactor_analysis, tool_esg_rii_calculator, tool_register_scenario | ATS 2 (Hendrikson) + ATS 8 + ATS 4 |
| **MNEMOSYNE** | premium | tool_register_scenario | ATS 6 (lógica causal) + ATS 8 |
| **THEMIS** | premium | tool_mpo_backcasting | ATS 5 (Bet vs. Hedge) + ATS 9 |
| **KRATOS** | economy | buscar_dados_publicos, atualizar_sentinela | Relatório monitoramento |
| **ATHENA** | premium | *(sem ferramentas — auditora pura)* | ATS 1-9 por macroetapa (ICD 203 + EB70) |

### Ferramentas analíticas (`analytical-engines.ts`)

Todas criadas via `createAnalyticalEngineTools(projectId)` — projectId injetado via closure, não exposto ao LLM:

| Ferramenta | Quem usa | Função |
|-----------|----------|--------|
| `tool_register_event` | KLIO (FIRST-STEP), SCOPUS | Registra FPF/tendência/incerteza com TAD |
| `tool_register_impact_relation` | KLIO | Impacto direto entre variáveis (MICMAC) |
| `tool_grumbach_expert_simulation` | OLYMPUS | 7 personas — projeção Grumbach |
| `tool_mactor_analysis` | PYTHIA | Análise de atores |
| `tool_mpo_backcasting` | THEMIS | Backcasting MPO |
| `tool_esg_rii_calculator` | PYTHIA | RII = I×(6-G)×(6-C) |
| `tool_mpc_source_evaluator` | KLIO | Avaliação MPC alfanumérica |
| `tool_register_scenario` | PYTHIA, MNEMOSYNE | *(Sprint 18)* Cenário estruturado, substitui regex |

---

## PARTE 5 — METODOLOGIAS

| Nome (banco) | Slug | Orquestrador | Fases |
|---|---|---|---|
| MSEF v3 (8 etapas ENAP) | msef | HERMES | 8 |
| Godet: Escola Estrutural | godet | HERMES | 7 |
| Grumbach: Produção de Cenários | grumbach | OLYMPUS | 9 |
| OTAN/AltA | alta | HERMES | 5 |
| MPC: Conhecimento Estimativa EB | siex | OLYMPUS | 5 |
| SIPLEx/CEEEx: Cenários da Força Terrestre | siplex | HERMES | 7 |
| IPEA/FGV: Cenários Estreitados | macroplan | HERMES | 7 |
| MPO: Estratégia Brasil 2050 | mpo | HERMES | 8 |
| ASPLAN/MD: Planejamento Setorial | asplan | HERMES | 7 |
| GBN (Global Business Network) | futures | HERMES | 8 |
| ESG: Cenários Prospectivos | esg | HERMES | 6 |

### Fluxo de execução

```
POST /api/v1/chat/stream
  └─ runAnalysis()
       ├─ loadMethodology()          → banco (lança exceção se ausente)
       ├─ getLLMConfig()+getLLMTiers()  → paralelo, de platform_settings
       ├─ buildMemoryWindow()        → orçamento 32k tokens
       ├─ buildAnchorContext()       → eventos approved como âncora HITL
       ├─ generateReportTemplateInstructions()  → seções obrigatórias
       ├─ PROTOCOLO DE PLANEJAMENTO DE FASE     → todos os vizModes
       ├─ Orquestrador.run() → streamText(stopWhen: stepCountIs(30))
       │    ├─ consultar_agente(ESPECIALISTA) → generateText(stepCountIs(8))
       │    └─ consultar_agente(ATHENA) → veredicto ATS por fase
       └─ Salva 2 mensagens no banco (1 user + 1 assistant)
```

---

## PARTE 6 — ATHENA v3 (ICD 203 + EB70-MT-10.401)

Auditora pura — `toolsConfig: []`. Combina ICD 203 (ODNI 2022) + EB70-MT-10.401 (Exército Brasileiro).

### Diretrizes EB70-MT-10.401
- **Nexo Temporal:** reprova "saltos quânticos" — cenários PYTHIA sem ancoragem na trajetória KLIO
- **Segregação Epistemológica:** valida `[FATO]` / `[INDÍCIO]` / `[SUPOSIÇÃO]` no scanning

### ATS por macroetapa

| node_slug | ATS auditados |
|---|---|
| node_framing | ATS 3 (premissas linchpin) + ATS 5 (relevância) |
| node_scanning_* | ATS 1 (TAD condicional) + ATS 7 (trajetória histórica) |
| node_modeling | ATS 2 (Hendrikson) + ATS 4 (ACH condicional) |
| node_matrix_design / node_narrative | ATS 6 (lógica causal) + ATS 8 (exatidão) |
| node_integration | ATS 5 (Hedges vs. Bets) + ATS 9 (signposts) |

### Validação específica SIPLEx/CEEEx
- Seção 4: exatamente **20 Oportunidades + 20 Ameaças + 10 Temas de Interesse**
- Seção 5.1: tabela Markdown 10 eventos binários × 4 cenários normativos
- Seção 5.2: 4 narrativas isomórficas com a tabela 5.1
- Seção 6: 6 campos obrigatórios por Folha Anexa

---

## PARTE 7 — TAD (Técnica de Avaliação de Dados)

| Código | Idoneidade da Fonte | Código | Credibilidade do Dado |
|--------|--------------------|---------|-----------------------|
| A | Totalmente idônea | 1 | Verdadeira (sem reservas) |
| B | Habitualmente idônea | 2 | Provavelmente verdadeira |
| C | Regularmente idônea | 3 | Possivelmente verdadeira |
| D | Habitualmente suspeita | 4 | Duvidosa |
| E | Totalmente suspeita | 5 | Improvável/inverdadeira |
| F | Sem condições de julgar | 6 | Não se pode julgar |

### Padrão condicional (KLIO)
- **SIEx / OTAN:** alfanumérico colado → `"PIB cresceu 3,2% — IBGE B2"`
- **Demais:** semântico → `"(Habitualmente idônea / Provavelmente verdadeira)"`

### Segregação epistemológica (KLIO)
- `[FATO]` — confirmado e corroborado
- `[INDÍCIO]` — plausível, sem corroboração completa
- `[SUPOSIÇÃO]` — hipótese para preencher lacuna

---

## PARTE 8 — STRATEGIC SLATE COMPILER

**Arquivo:** `apps/api/src/services/report-compiler.ts` *(Sprint 16)*

**Função:** `generateReportTemplateInstructions(methodologyRaw, layout)`

Modos: `standard` (seções com conteúdo obrigatório) · `extended` (+ Raciocínio Analítico e Lastro Cognitivo)

Injeção em `finalInputMsg` em produção. Parâmetro `body.reportLayout` (padrão: `"standard"`).

| Slug | Destaques das seções |
|---|---|
| msef | Enquadramento → PESTEL → FPFs → Matriz 2×2 → 4 Narrativas → Hedges/Bets |
| godet | Escopo → MICMAC/MACTOR → Dinâmica → MORPHOL → Estratégias |
| gbn | Questão Focal → STEEP → Incertezas → Matriz 2×2 → Narrativas → Early Warning |
| esg | Soberania → Conjuntura → Sementes → MICMAC → RII → Cenários → Backcasting |
| otan | Focus Issue → Structuring → Creative → Diagnostic → Challenge |
| ipea | Marco Teórico → Diagnóstico → Triagem → Hipóteses → Narrativas → Normativo |
| grumbach | Sistema → Diagnóstico → KIQs → Delphi → Monte Carlo → 4 Cenários → BSC |
| mpo | 9 etapas com MICMAC, MORPHOL, Narrativas, Quantificação |
| eb70_mt_10401 | Estimativa de Inteligência: Dados Conhecidos → Fatores → Hipóteses → Conclusão |
| siplex | Alinhamento PND/END/PMiD/EMiD → TAD → Fatores → 20+20+10 → Cenários → Folhas |

---

## PARTE 9 — PROTOCOLO DE PLANEJAMENTO DE FASE

Ativo em **todos** os vizModes (exceto TEST_MODE). Garante que SATs avançadas não sejam ignoradas.

```
Antes de acionar cada especialista:
1. Ferramentas/SAT MANDATÓRIAS pela metodologia ativa para esta fase
2. Ferramentas/SAT RECOMENDADAS dado o tema específico
3. Proposta de abordagem (1-2 linhas)
```

| vizMode | Comportamento |
|---|---|
| `passos` | Apresenta plano ao usuário → aguarda confirmação/orientação |
| `etapa` / `passagem` / `thinking` | Registra `[PLANO fase X]` → prossegue imediatamente |

---

## PARTE 10 — PROVIDER LLM E TIER SYSTEM

### Providers suportados

| Provider | SDK | Env var |
|----------|-----|---------|
| `anthropic` | `@ai-sdk/anthropic` | `ANTHROPIC_API_KEY` |
| `google` | `@ai-sdk/google` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| `groq` | `@ai-sdk/groq` | `GROQ_API_KEY` |
| `ollama` | `@ai-sdk/openai` compat | `OLLAMA_BASE_URL` |
| `deepseek` | `@ai-sdk/openai` compat | `DEEPSEEK_API_KEY` |

### Modelos Google disponíveis na UI *(Sprint 19 — gemini-2.0-flash removido)*

| ID | Label | Status |
|----|-------|--------|
| `gemini-2.5-flash` | Gemini 2.5 Flash (premium) | ✅ Ativo |
| `gemini-2.5-flash-lite` | Gemini 2.5 Flash Lite | ✅ Ativo (padrão) |
| `gemini-2.5-pro` | Gemini 2.5 Pro | ✅ Ativo |

### Tier System

| Tier | Agentes | Google | Anthropic |
|------|---------|--------|-----------|
| `economy` | SCOPUS, KRATOS | gemini-2.5-flash-lite | claude-sonnet-4-6 |
| `premium` | KLIO, PYTHIA, MNEMOSYNE, THEMIS, ATHENA | gemini-2.5-flash | claude-opus-4-7 |
| *(global)* | HERMES, OLYMPUS | gemini-2.5-flash-lite | via `llm.model` |

**Anthropic Prompt Cache:** `cacheControl: ephemeral` quando `provider === 'anthropic'` (~84% economia tokens em chamadas repetidas).

---

## PARTE 11 — EMBEDDINGS / RAG

### Roteamento automático *(Sprint 19 — Ollama como padrão, Voyage AI opcional)*

```
VOYAGE_API_KEY presente  → Voyage AI voyage-3-lite (512 dims, cloud)
OLLAMA_BASE_URL presente → Ollama nomic-embed-text (768 dims, local) ← PADRÃO ATUAL
Nenhum configurado       → erro explícito (não silencioso)
```

**Vantagens Ollama:** sem limite mensal, sem API key, funciona air-gapped, latência menor.

> ⚠️ **Incompatibilidade de dimensões:** índices Voyage (512 dims) e Ollama (768 dims) são incompatíveis. Ao trocar provider, **reindexar todos os embeddings**.

---

## PARTE 12 — INFRAESTRUTURA DOCKER

```yaml
services:
  postgres:    # PostgreSQL 15 + pgvector — healthcheck pg_isready
  api:         # Node.js/Hono 3333 — depends_on: postgres + ollama (service_started)
  web:         # Nginx + React build 80
  ollama:      # Sempre ativo (sem profile, Sprint 19) — healthcheck: ollama list
  ollama-init: # One-shot: baixa nomic-embed-text na primeira inicialização
```

**LangGraph:** PostgresSaver substitui BoundedMemorySaver. 4 tabelas checkpoint auto-criadas pelo `setup()`, **fora do schema Drizzle**.

---

## PARTE 13 — SEGURANÇA

| Feature | Arquivo | Status |
|---|---|---|
| JWT + 2FA TOTP | auth.ts + speakeasy | ✅ |
| Rate limiting API | rateLimit.ts (5 análises/h, 10 exports/h) | ✅ |
| Rate limiting nginx | api_zone 30r/min + auth_zone 10r/min | ✅ |
| Hash-chain SHA-256 | utils/audit.ts — `_hash` + `_previousHash` no JSONB | ✅ Sprint 18 |
| Marca d'água exports | CSS watermark opacity:0.06, texto = classificação do projeto | ✅ |
| Backup corporativo | pg_dump → .sql.gz autenticado | ✅ |
| Anti-enumeração login | setTimeout(70ms) timing mitigation | ✅ |

---

## PARTE 14 — SUITE DE TESTES (30/05/2026)

**Score total: 42/42 ✅**

| Suite | Resultado | Tipo |
|---|---|---|
| banco | **5/5 ✅** | Sem LLM |
| arquitetura | **6/6 ✅** | Sem LLM — DB state |
| segurança | **6/6 ✅** | Sem LLM |
| kratos | **3/3 ✅** | LLM (~20s) |
| artefatos | **5/5 ✅** | LLM (~1040s) |
| exportação | **4/4 ✅** | LLM |
| sat | **7/7 ✅** | LLM (~1208s) |
| metodologias | **6/6 ✅ (845s)** | MSEF, Godet, Grumbach, IPEA, OTAN, GBN |
| plano | Para stress test | LLM — [PLANO] no orquestrador |
| tad | Para stress test | LLM — segregação, TAD, nexo temporal |

---

## PARTE 15 — HISTÓRICO DE SPRINTS

| Sprint | Data | O que foi feito |
|---|---|---|
| 1–2 | Abr 2026 | Monolito: 7 agentes, exportação, autenticação, retry com backoff |
| 3 | Abr 2026 | Migração monorepo, Docker, JWT+2FA, backup |
| 4 | Abr 2026 | Resolução de 5 bugs críticos do SDK v6 (Zod, inputSchema, stopWhen, toolChoice, CMD) |
| 5 | 25 Abr | 51 indicadores em 9 fontes, pgvector RAG, streaming real |
| 6 | 25 Abr | GRUMBACH, GODET, Painel Cliente v2, Link do Cliente |
| 7 | Mai 2026 | Railway Deploy scripts, PoC offline, scripts USB |
| 8 | 19 Mai | ICD 203 (3 ferramentas), TechniqueEngine, NATO AltA (12 SAT), step streaming |
| 9 | 21 Mai | Stepper dinâmico, Provider Factory Ollama, Gauge SVG fix |
| 10 | 23 Mai | FRED+Câmara+Senado, Playbook DOCX, audit_logs, rate limit, seed demo |
| Final A | 26 Mai | LangGraph schema, 7 ferramentas analíticas, anchorContext, seed declarativo |
| Final B | 26 Mai | OLYMPUS criado, 4 orquestradores legado removidos, Tier System, KRONOS→KRATOS, HERMES_REVISOR→ATHENA |
| 11 | 28 Mai | ATHENA pura, loops eliminados. Suite: **6/6 ✅ 848s** |
| 12 | 29 Mai | ATHENA ICD 203 v2 (9 ATS), Shift-Left 5 especialistas. Suite: **6/6 ✅ 985s** |
| 13 | 29 Mai | Fix atualizar_sentinela enum ("string"), Anthropic Prompt Cache |
| 14 | 29 Mai | PostgresSaver (substitui BoundedMemorySaver), 4 tabelas checkpoint |
| 15 | 29 Mai | Suite 42/36→42: fixes toolsConfig, MNEMOSYNE 4 narrativas, regex, campo |
| 16 | 29 Mai | ATHENA v3 (EB70), KLIO TAD+segregação, PYTHIA nexo temporal, report-compiler |
| 17 | 30 Mai | CEEEx/SIPLEx 6 seções, **HERMES_SIPLEX removido**, Protocolo Planejamento de Fase |
| 18 | 30 Mai | Suites arquitetura/plano/tad, hash-chain SHA-256, tool_register_scenario |
| 19 | 30 Mai | **Voyage AI → Ollama** (auto-roteamento), Ollama sempre ativo, **Gemini 2.0 removido** |

---

## PARTE 16 — BACKLOG

### ✅ Todos os itens de alta/média prioridade concluídos (Sprints 1–19)

| Item | Sprint |
|---|---|
| PostgresSaver LangGraph | 14 |
| Anthropic Prompt Cache | 13 |
| Fix atualizar_sentinela enum Gemini | 13 |
| Suite completa 42/42 | 15–18 |
| tool_register_event Gemini | 15–16 |
| MNEMOSYNE narrativas=1 | 15 |
| Hash-chain audit_logs SHA-256 | 18 |
| Strategic Slate Compiler (report-compiler.ts) | 16 |
| Harmonized Scenario Schema (tool_register_scenario) | 18 |
| Voyage AI → Ollama nomic-embed-text | 19 |
| Sliding Window por Tokens (buildMemoryWindow) | Pré-LangGraph |
| HERMES_SIPLEX removido (anti-padrão) | 17 |
| Gemini 2.0 Flash removido (descontinuado) | 19 |

### 🔲 Pendente — Prioridade Média (pós-deploy)

| # | Item | Descrição |
|---|------|-----------|
| A | **Deploy Railway** | Todos os arquivos prontos (railway.toml, Dockerfile.api, .env.railway.example). Ação: criar conta Railway → 8 passos do RAILWAY_DEPLOY.md → testar /ping → athena.stratsight.com.br via CNAME. |
| B | **PoC Presencial USB** | Scripts prontos (build-offline.ps1, docker-compose.offline.yml, instalar.ps1). Ação: rodar build-offline.ps1 → gerar dist-poc\olympus-poc.tar → testar em máquina limpa. |
| C | **VPN + Dados Proprietários** | Acesso a dados internos do cliente via VPN. Depende de deploy Railway ativo. |
| D | **Audit Frontend** | Modal de visualização de audit_logs para admins — exportação CSV. Backend GET /audit + /audit/stats já implementados. |
| E | **Rate Limiting Redis** | Substituir bucket in-memory por Redis sliding window para múltiplas instâncias. Single-instance atual é suficiente até 2º contrato. |

### 🔮 Longo Prazo

| # | Item | Descrição |
|---|------|-----------|
| F | Hybrid Sovereign Embedding | SentenceTransformers para AIR_GAPPED (Ollama cobre SOBERANO) |
| G | Analytical Lineage Tracker | Trilha: cada conclusão → evidências originais |
| H | Adaptive Briefing Engine | Resumos adaptativos por stakeholder/classificação |
| I | Cross-Project Horizon Scanning | Sinais fracos entre projetos do portfólio |
| J | Fase D — LLM Soberano | Fine-tuning com dados MSEF · air-gapped para defesa · ativo de PI para exit. Provider Factory já prepara a transição. |
| K | Sabiá-3 / LLM Soberano BR | Troca via LLM_PROVIDER sem reescrever o motor. Argumento de soberania para clientes de defesa. |

---

## PARTE 17 — REGRAS DE ENGENHARIA CRÍTICAS

```
1.  Zod PROIBIDO em ferramentas e nós do grafo (TS2589 com @langchain/core)
2.  packages/tools NÃO importa @olympus/db
3.  stopWhen: stepCountIs(N) — nunca maxSteps (ignorado no SDK v6)
4.  (myTool as any).inputSchema = () => jsonSchema(rawSchema as any)
5.  CMD produção: node apps/api/dist/index.js — nunca npx tsx
6.  Rebuild obrigatório após alterar packages/core ou apps/api/src:
    docker compose build --no-cache api && docker compose up -d api
7.  Ao trocar provider LLM: atualizar AMBOS llm E llm_tiers em platform_settings
8.  Mudanças de prompt: via seed.ts (re-run) OU patch direto no banco
9.  methodology_cache TTL 5 min — restart do container limpa imediatamente
10. Tabelas checkpoint*: NÃO adicionar ao schema Drizzle
11. Enums Gemini: "type":"string" — Gemini rejeita "type":"number","enum":[1,2]
12. node_slug no prompt OLYMPUS: NÃO enumerar (confunde Gemini)
13. Ao trocar embedding provider (Voyage↔Ollama): reindexar todos os embeddings
14. SIPLEx usa HERMES + agentMethodPrompts/siplex — não criar orquestradores específicos
```

### Template canônico para novas ferramentas

**Passo 1 — Definir lógica** em `packages/tools/src/` (sem DB) ou `apps/api/src/tools/` (com DB):
```typescript
export const minhaFerramenta = {
  name: "minha_ferramenta",
  description: "Descrição clara do que a ferramenta faz.",
  execute: async (args: { parametro: string }, context: any): Promise<string> => {
    return resultado;
  },
};
```

**Passo 2 — Registrar schema puro** em `packages/core/src/Agent.ts`:
```typescript
const TOOL_JSON_SCHEMAS: Record<string, object> = {
  minha_ferramenta: {
    type: "object",
    properties: {
      parametro: { type: "string", description: "Descrição do parâmetro" }
    },
    required: ["parametro"]
  }
};
```

**Passo 3 — Rebuild obrigatório** após alterar `packages/core`:
```bash
docker compose build --no-cache api
docker compose up -d
```

---

## PARTE 18 — GUIA OPERACIONAL

### Fluxo normal de rebuild
```bash
# Após alterar API ou packages/:
docker compose build --no-cache api
docker compose up -d
docker compose logs -f api

# Após alterar apenas o frontend:
docker compose build --no-cache web
docker compose up -d
```

### Reset nuclear (APAGA O BANCO)
```bash
# 1. Zerar tudo
wsl --shutdown
docker compose down -v --rmi all
docker system prune -a -f --volumes

# 2. Reinstalar dependências
npm install

# 3. Build e subida completa
docker compose build --no-cache
docker compose up -d

# 4. OBRIGATÓRIO após -v: criar extensão e aplicar schema
docker exec olympus_db psql -U postgres -d olympus -c "CREATE EXTENSION IF NOT EXISTS vector;"
cd packages/db && npx drizzle-kit push && cd ../..

# 5. Repovoar banco
DATABASE_URL="postgres://postgres:postgres@localhost:5432/olympus" npx tsx apps/api/src/scripts/seed.ts

# 6. Verificar saúde
docker compose logs -f api
```

**Armadilhas do reset nuclear:**

| Erro | Causa | Solução |
|------|-------|---------|
| `relation "projects" does not exist` | Schema não aplicado após `-v` | Rodar passo 4 |
| `type "vector(512)" does not exist` | Extensão pgvector não criada | `docker exec olympus_db psql -U postgres -d olympus -c "CREATE EXTENSION IF NOT EXISTS vector;"` |
| `unknown command 'push'` | drizzle-kit desatualizado | Atualizar para `^0.31.10` |
| `ECONNREFUSED 172.x.x.x:5432` | Race condition API→Postgres | Corrigido com retry (10×3s) |

### Limpeza simples (preserva banco)
```bash
docker compose stop api
docker compose build --no-cache api
docker compose up -d api
docker compose logs -f api
```

> `docker compose down` (sem `-v`) preserva volumes. O banco só é perdido com `-v` ou `--volumes`.

### Configuração WSL2
Criar `%USERPROFILE%\.wslconfig`:
```ini
[wsl2]
memory=8GB
processors=4
swap=2GB
```
Se Docker travar com `input/output error`: `wsl --shutdown` + *Clean/Purge data* no Docker Desktop.

---

## PARTE 19 — RISCOS IDENTIFICADOS

### 19.1 Riscos Técnicos

| Risco | Status | Mitigação |
|-------|--------|-----------|
| Context bloat em análises longas | ✅ **Resolvido (Sprint Pré-LangGraph)** | `buildMemoryWindow()` com orçamento 32k tokens, `estimateTokens()`, suporte multimodal |
| Dependência Voyage AI (RAG) | ✅ **Resolvido (Sprint 19)** | Ollama nomic-embed-text como padrão. Roteamento automático. Air-gapped. |
| Esgotamento limite Tavily gratuito | ⚠️ Monitorar | Plano free: 1.000 req/mês. Migrar para Tavily Starter (~USD 29/mês) após primeiro contrato. Brave Search como fallback. |
| Race condition DB→API no Railway (cold start) | ⚠️ Testar ao deployar | Retry 10×3s funciona localmente. Configurar health check no Railway e testar startup. |

### 19.2 Riscos Operacionais e Estratégicos

| Risco | Contexto | Mitigação |
|-------|----------|-----------|
| Deploy ausente bloqueia KRATOS | Cron jobs dependem de servidor 24/7. Monitoramento para quando o computador é desligado. | Deploy Railway é a ação mais crítica. Sem isso, produto de monitoramento recorrente não pode ser ofertado. |
| Ausência de PoC presencial | Ambiente governamental sem acesso externo é inviável com Docker de 3 contêineres. | `docker save` → USB + script Windows. Fallback: server.js legado como modo standalone. |
| Complexidade operacional | Stack evoluiu de 2 arquivos para monorepo + 4 pacotes + Docker + pgvector + múltiplas APIs. Operação solo tem limite. | HISTORICO_DESENVOLVIMENTO.md é o principal ativo operacional. Contratar CIO técnico a partir do segundo contrato. |
| Dependências externas não orçadas | INLABS + ITU DataHub adicionados sem revisão de custos. Risco de surpresas ao escalar. | Revisar modelo de custos a cada sprint (ver Parte 20). |

---

## PARTE 20 — ATIVOS NÃO PLANEJADOS (Valor para Exit)

| Ativo | O Que É | Impacto no Exit / Valuation |
|-------|---------|----------------------------|
| Motor Dinâmico de Metodologias | Agentes e metodologias 100% via banco. Nova metodologia = upload de JSON, sem deploy. | Cria marketplace de metodologias. Parceiros publicam engines — modelo de receita adicional. |
| RAG com pgvector + Ollama | Documentos do cliente indexados semanticamente por projectId. Air-gapped. | Principal diferencial técnico para defesa. Lock-in e alto valor de retenção. |
| Token Streaming SSE Real | `streamText` + cursor piscante em tempo real na UI. | Experiência enterprise em demos ao vivo. Acelera fechamento de contratos. |
| Provider Factory (Agent.ts) | `getModel()` lê `LLM_PROVIDER`. Trocar Anthropic por Ollama/Sabiá-3 sem alterar código dos agentes. | Prepara Fase D sem reescrita. Demonstrável como "agnóstico de modelo" — maior múltiplo de valuation. |
| Backup Corporativo pg_dump | Rota admin-only que gera `.sql.gz`. BackupModal na UI. | Requisito compliance ISO 27001 antecipado. Elimina objeção de segurança em clientes de defesa. |
| Painel Admin (Engine Manager) | Instala novos Motores (JSON + agentes) sem deploy. Gerenciamento de usuários e roles na UI. | Permite operação por pessoal não-técnico. Requisito para escalar além da operação solo. |
| Metodologias militares operacionais | GRUMBACH + GODET + OTAN/AltA + SIPLEx/CEEEx com prompts v3 completos. | Diferencial direto para clientes de defesa e governo. Amplia mercado endereçável. |
| ICD 203 + EB70-MT-10.401 integrados | ATHENA v3, TAD condicional, segregação epistemológica. | Conformidade com doutrina militar brasileira e padrões ODNI. Diferencial único no mercado. |

---

## PARTE 21 — MODELO DE CUSTOS (atualizado 30/05/2026)

| Ferramenta / Serviço | Plano Atual | Custo pré-contrato | Custo pós-contrato | Status |
|---|---|---|---|---|
| Google Gemini API | Pay-per-use (profissional) | ~R$ 150 | ~R$ 500 (2 clientes) | ✅ Planejado |
| Anthropic Claude API | Pay-per-use | ~R$ 0 (teste) | ~R$ 400 (2 clientes) | ✅ Opcional |
| Tavily Search API | Free (1k req) | R$ 0 | ~R$ 150 (Starter) | ⚠️ Ampliar após 1º contrato |
| ~~Voyage AI (RAG embeddings)~~ | ~~Free tier~~ | ~~R$ 0~~ | ~~R$ 50~~ | ✅ **Substituído por Ollama (R$0)** |
| Railway (deploy 24/7 + PostgreSQL) | — | R$ 30 (a contratar) | ~R$ 80 (Pro) | 🔲 Ação imediata |
| Google Workspace | Business Starter | R$ 35 | R$ 35 | ✅ Planejado |
| Contador terceirizado | Mensalidade | R$ 500 | R$ 500 | ✅ Planejado |
| Demais (Notion, Canva, n8n) | Free/Pro | R$ 93 | R$ 93 | ✅ Planejado |
| **TOTAL** | — | **R$ 808/mês** | **~R$ 1.258/mês** | ✅ < R$ 1.500 |

> **Margem de segurança:** custo pós-contrato estimado em R$ 1.258/mês — dentro da diretriz de R$ 1.500/mês. Voyage AI substituído por Ollama local zerou este item. Margem de R$ 242/mês absorve variações.

---

## PARTE 22 — PONTOS DE ATENÇÃO ARQUITETURAIS E DE UI

### 22.1 Decisões arquiteturais conhecidas (intencionais, não problemas)

- **Duas rotas de análise:** `/chat/stream` (ReAct, produção) e `/chat/stream/graph` (LangGraph, experimental/futuro). Decisão intencional — LangGraph aguarda feature parity antes de substituir a rota principal.
- **App.tsx com estado global centralizado:** padrão deliberado para MVP. Decomposição em contextos React (LLMContext, SessionContext) está no roadmap mas não é bloqueadora.

### 22.2 Débito técnico conhecido

- **export.ts — mapeamentos duplicados:** `PHASE_LABELS`/`PHASE_COLORS` em `buildHtml()` e `DOCX_PHASE_LABELS` em `buildDocx()` devem ser mantidos em sincronia manualmente. Candidato a unificação.
- **parseScenarioProbabilities() — regex frágil:** ainda em uso para análises antigas. `tool_register_scenario` (Sprint 18) é o substituto para novas análises, mas a regex permanece para retrocompatibilidade.
- **HERMES_SIPLEX no banco:** agente inativo, não recriado pelo seed. Não causa problema operacional. Pode ser apagado manualmente se necessário.

### 22.3 UI/UX — itens pendentes de design

- **Modo `passos` supervisionado:** o orquestrador apresenta [PLANO DE FASE] e aguarda confirmação. A UI exibe inline na conversa, sem painel visual dedicado para o estado de "aguardando aprovação".
- **Seletor de `reportLayout`:** modo `extended` pronto no backend, sem controle na UI.
- **vizMode não comunicado ao usuário:** diferença entre `etapa` (autônomo), `passos` (HITL), `passagem` (contínuo) e `thinking` não é clara na interface.
- **EventsPanel (HITL):** funcional sem theming consistente com o restante da UI.
- **SIPLEx/CEEEx:** configurada com HERMES + agentMethodPrompts desde Sprint 17, não testada end-to-end após a migração.

---

*Gerado em 30/05/2026 — Sprint 19 concluído — 42/42 testes ✅*
*Para revisão de arquitetura e UI pelo Claude Chat e Design*
