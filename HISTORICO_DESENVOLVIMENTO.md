# OLYMPUS 1.0 — Histórico de Desenvolvimento e Estado Atual
**StratSight Brasil · Strategic Foresight · IA Agêntica**
**Atualizado em:** 04 Jun 2026 (Sprint 23 concluído — auditoria sec+perf+bugs)
**Destinatário:** Claude Chat / Claude Design — revisão de arquitetura e UI

> **⚠️ Cuidado para Claude Code:** este arquivo (`HISTORICO_DESENVOLVIMENTO.md`) e o correspondente `HISTORICO_DESENVOLVIMENTO.html` são os registros canônicos da evolução do sistema. Sempre que uma mudança arquitetural relevante for implementada, **ambos os arquivos devem ser atualizados no mesmo commit**. O `.md` é a fonte da verdade; o `.html` é gerado a partir dele para leitura amigável. Nunca divergir os dois.

---

## PARTE 1 — CONTEXTO E STACK

### O que é o OLYMPUS
Plataforma soberana de análise prospectiva estruturada — agnóstica de metodologia, adaptável a cada cliente, executável sem dependência de infraestrutura externa. O analista humano está no centro; a IA é o motor que garante rigor.

```
OLYMPUS 1.0
├── Motor analítico   → phaseLoopNode (KLIO) + synthesisNode (HERMES)
│                       12 metodologias Bloco A/B · 5 agentes · PHASE_CONFIGS
├── Motor KRATOS      → monitoramento contínuo (indicadores, alertas, cron pg-boss)
├── ATHENA            → auditora determinística por fase (ATS 1-9 ICD 203 + EB70)
├── Painel Cliente    → URL compartilhável com JWT, dashboard de indicadores
└── API OLYMPUS       → webhooks n8n, integração com parceiros
```

**Premissas de negócio:** operação solo · custo < R$1.500/mês · clientes defesa/governo (air-gapped, CONFIDENCIAL, auditoria) · produto-âncora R$80K–250K · meta Ano 1: R$300K · exit Big Tech em 8 anos · O Playbook de metodologias verificadas é o principal ativo de PI.

### Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Backend | Hono + Node.js + TypeScript |
| IA | Vercel AI SDK v6 (`ai@6.0.168`) — agnóstico de provider |
| Banco | PostgreSQL 15 + pgvector + Drizzle ORM |
| Orquestração | LangGraph JS — motor único desde Sprint 21 (`/stream/graph`) |
| Embeddings | Ollama nomic-embed-text — vector(768). Voyage AI removido definitivamente. |
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
│   │   │                           # ⚡ Migrations Olympus 1.0 idempotentes aqui
│   │   ├── cron.ts                 # KratosOrchestrator — cron jobs
│   │   ├── graph/
│   │   │   ├── builder.ts          # 2 nós: phase_loop + synthesis
│   │   │   ├── postgresSaver.ts    # Singleton async — 4 tabelas checkpoint
│   │   │   ├── nodes.ts            # phaseLoopNode + synthesisNode + PHASE_CONFIGS export
│   │   │   ├── helpers.ts          # buildToolsForPhase(), buildAnchorCtx(), loadMemoryWindow()
│   │   │   ├── router.ts           # routeFromState() — legado, não usado pelo novo fluxo
│   │   │   ├── athena-validator.ts # ATHENA determinística: ATS por nodeSlug (sem LLM)
│   │   │   ├── phase-context.ts    # loadPhaseContext() + buildPhaseSummary()
│   │   │   └── phase-configs/
│   │   │       └── grumbach.ts     # 9 PhaseConfig com systemPromptInject verificado
│   │   ├── routes/
│   │   │   ├── chat.ts             # SSE /stream/graph — currentPhaseIndex + phaseOutputs cleanup
│   │   │   ├── events.ts           # HITL API — CRUD project_events
│   │   │   ├── export.ts           # Exportação DOCX/PDF/HTML
│   │   │   ├── settings.ts         # Config LLM — GET/PATCH, getLLMTiers()
│   │   │   └── audit.ts / sessions / kratos / indicators / signals / ...
│   │   ├── services/
│   │   │   └── report-compiler.ts  # Strategic Slate Compiler — legado
│   │   ├── utils/
│   │   │   └── audit.ts            # logAudit() — hash-chain SHA-256
│   │   └── tools/
│   │       ├── analytical-engines.ts  # 10 ferramentas analíticas (JSON Schema puro)
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
| `methodologies` | 12 metodologias | agentsConfig JSONB; **novos campos Olympus 1.0:** methodology_type, implementation_status, parent_relation, source_documents |
| `methodology_phases` | Fases por metodologia | slug, node_slug (mapeamento LangGraph) |
| `agents` | **5 agentes** (v1.0) | HERMES, KLIO, KRATOS, ATHENA, OLYMPUS(stub) |
| `agent_method_prompts` | Instruções agente×metodologia | Legado — não usado pelo phaseLoopNode (prompts em phase-configs/) |
| `techniques` | 12 técnicas SAT (AltA) | — |
| `projects` | Projetos/sessões | methodology, kratosCron, alertEmails, deletedAt |
| `messages` | Histórico de mensagens | role, content, agentName — relatório final persiste aqui |
| `embeddings` | Vetores RAG (pgvector) | vector(512) Voyage / vector(768) Ollama |
| `project_events` | Eventos analíticos (TAD) | sourceEvaluation JSONB (reliability A-F, credibility 1-6) |
| `project_scenarios` | Cenários prospectivos | probability, matrixValue JSONB |
| `matrix_direct_impacts` | MICMAC | fromEventId, toEventId, impactScore 0-3 |
| `technique_execution_outputs` | Saídas matemáticas SAT | techniqueType, outputData JSONB |
| `audit_logs` | Logs de auditoria | metadata._hash + ._previousHash (hash-chain SHA-256) |
| `platform_settings` | Config plataforma | llm, llm_tiers, anthropic_models |
| **`phase_outputs`** ⭐ | **Artefatos por fase (Olympus 1.0)** | **phaseSlug, summary, keyFindings JSONB, athenaVerdict, athenaChecks — substitui messages como canal de contexto entre fases** |
| `checkpoints` + 3 tabelas | LangGraph | **Gerenciadas pelo PostgresSaver.setup() — NÃO no schema Drizzle** |

---

## PARTE 4 — AGENTES (Olympus 1.0)

> **Mudança arquitetural crítica (Sprint 22):** SCOPUS, PYTHIA, MNEMOSYNE e THEMIS foram removidos. O KLIO agora executa TODAS as fases analíticas — prompts específicos por fase são injetados dinamicamente via `phase-configs/`. Esta é a arquitetura monolítica descrita no Design Arquitetural v5.

### Agentes ativos (5)

| Agente | Tipo | Função em Olympus 1.0 |
|--------|------|-----------------------|
| **HERMES** | orchestrator | Compilador de relatório final — lê phase_outputs e gera o relatório em Markdown. Sem ferramentas. |
| **KLIO** | expert | Analista monolítico — executa TODAS as 9 fases da análise Grumbach via phaseLoopNode. Tier: premium. 18 ferramentas. |
| **KRATOS** | expert | Monitoramento autônomo via pg-boss — cron jobs, alertas, runDirectAgent(). Tier: economy. |
| **ATHENA** | expert | Auditora qualitativa LLM — chamada por synthesisNode quando necessário. Sem ferramentas. Tier: premium. |
| **OLYMPUS** | orchestrator | **Stub — Olympus 2.0.** Reservado para síntese multi-metodologia futura. Não invocado ativamente. |

> **Regra arquitetural (Olympus 1.0):** HERMES é o orquestrador de síntese para todas as metodologias de cenários. ATHENA determinística roda via `athena-validator.ts` (TypeScript puro) — não via consultar_agente. Cada fase do phaseLoopNode recebe seu systemPromptInject específico de `phase-configs/`.

### Ferramentas analíticas (`analytical-engines.ts`)

| Ferramenta | Quem usa | Função |
|-----------|----------|--------|
| `tool_register_event` | KLIO | Registra FPF/tendência/incerteza com TAD |
| `tool_register_impact_relation` | KLIO | Impacto direto entre variáveis (MICMAC) |
| `tool_grumbach_expert_simulation` | KLIO | 7 personas — projeção Grumbach P(i) e P(i\|j) |
| `tool_mactor_analysis` | KLIO | Análise de atores |
| `tool_mpo_backcasting` | KLIO | Backcasting MPO |
| `tool_esg_rii_calculator` | KLIO | RII = I×(6-G)×(6-C) |
| `tool_mpc_source_evaluator` | KLIO | Avaliação MPC alfanumérica |
| `tool_register_scenario` | KLIO | Cenário estruturado com configuração booleana |
| `tool_tad_score_calculator` | KLIO | Cálculo score TAD paramétrico (6 subcritérios) |
| `tool_unified_search_engine` | KLIO | Busca unificada Tavily + fallback |


---

## PARTE 5 — METODOLOGIAS

**Fonte canônica:** `D:\Pessoais\DEV\_Diversos\_contexto\Design\REVISAO_ARQUITETURA\metodologias.txt`
**Fonte canônica:** `D:\Pessoais\DEV\_Diversos\_contexto\Design\REVISAO_ARQUITETURA\orquestradores.txt`

### Bloco A — Cenários (9 metodologias, v1.0)

| Slug no banco | Nome | PHASE_CONFIGS | Status |
|---|---|---|---|
| `grumbach` ⭐ | Grumbach: Produção de Cenários | ✅ 9 fases implementadas | **CASO DE VALIDAÇÃO 1.0** |
| `ceeex` | CEEEx: Cenários Prospectivos do Exército | 🔲 a implementar | Erro explícito se usado |
| `esg` | ESG: Cenários Prospectivos | 🔲 a implementar | Erro explícito se usado |
| `godet` | Godet: Escola Estrutural | 🔲 a implementar | Erro explícito se usado |
| `gbn` | GBN — Global Business Network | 🔲 a implementar | Erro explícito se usado |
| `alta` | OTAN — Alternative Analysis (AltA) | 🔲 a implementar | Erro explícito se usado |
| `ipea_buarque` | IPEA/Buarque — Metodologia de Cenários | 🔲 a implementar | Erro explícito se usado |
| `mpo` | MPO: Estratégia Brasil 2050 | 🔲 a implementar | Erro explícito se usado |
| `siex` | SIEx: Conhecimento Estimativa EB | 🔲 a implementar | Erro explícito se usado |

### Bloco B — Planejamento Estratégico (3 stubs, v2.0)

| Slug no banco | Nome | Status |
|---|---|---|
| `siplex` | SIPLEx: Sistema de Planejamento do Exército | Stub — pipeline Olympus 2.0 |
| `grumbach_gestao` | Grumbach: Gestão Estratégica Completa | Stub — pipeline Olympus 2.0 |
| `sped` | SPED/PESD: Planejamento Estratégico Setorial de Defesa | Stub — pipeline Olympus 2.0 |

> **Regra Olympus 1.0:** metodologia sem `PHASE_CONFIGS` implementado → `phaseLoopNode` lança erro explícito com mensagem clara (não fallback silencioso). Isso impede análises metodologicamente incorrectas rotuladas errado.
>
> **Slugs corrigidos vs. v4:** `futures` → `gbn`, `macroplan` → `ipea_buarque`, `asplan` removido, `msef` removido, `siplex` mantido (Bloco B).

### Fluxo de execução (Olympus 1.0 — phaseLoopNode)

```
POST /api/v1/chat/stream/graph               ← único endpoint
  ├─ loadMethodology()                       → banco (fases + agentMethodPrompts legado)
  ├─ DELETE phase_outputs WHERE projectId    → nova análise começa limpa
  ├─ getLLMConfig()+getLLMTiers()            → paralelo, de platform_settings
  └─ getOlympusGraph().stream()              → StateGraph (2 nós)
       ├─ routeFromStart()                   → phase_loop (se PHASE_CONFIGS existe)
       │                                        synthesis (se fases esgotadas)
       │
       ├─ [LOOP] phaseLoopNode               → executa para cada currentPhaseIndex
       │    ├─ PHASE_CONFIGS[methodology]    → resolve PhaseConfig da fase atual
       │    │   └─ se ausente → Error explícito
       │    ├─ interrupt() se requiresHitlBefore  ← HITL portão (fase 3 Grumbach)
       │    ├─ loadPhaseContext()            → summaries compactos das fases anteriores
       │    ├─ buildAnchorCtx()              → eventos aprovados (HITL)
       │    ├─ fullSystemPrompt = KLIO.base + phase.systemPromptInject + context
       │    ├─ buildToolsForPhase()          → só as ferramentas da fase atual
       │    ├─ Agent(KLIO).run()             → executa com token streaming
       │    ├─ query projectEvents(createdAt >= phaseStartedAt) → keyFindings
       │    ├─ athenaAuditPhase()            → ATHENA determinística (TypeScript puro)
       │    ├─ buildPhaseSummary()           → summary < 500 chars, determinístico
       │    ├─ INSERT phase_outputs          → persiste artefato estruturado
       │    ├─ interrupt() se vizMode=passos ← modo passo-a-passo
       │    └─ return { currentPhaseIndex: i+1 }
       │
       ├─ routeAfterPhase()                  → phase_loop (mais fases) | synthesis (fim)
       │
       └─ synthesisNode                      → lê phase_outputs do banco
            ├─ Agent(HERMES).run()           → compila relatório (sem ferramentas)
            └─ INSERT messages(relatorio_final)

vizMode:
  passos   → interrupt() após cada fase (analista confirma)
  etapa    → interrupt() só no HITL explícito (fase 3 Grumbach)
  passagem → sem interrupts (totalmente autônomo)
```

KRATOS (pg-boss): usa `runDirectAgent()` de `graph/helpers.ts` — execução direta sem grafo.

---

## PARTE 6 — ATHENA (ICD 203 + EB70-MT-10.401)

**Olympus 1.0 — dois modos de operação:**

1. **Determinístico** (`athena-validator.ts`) — TypeScript puro, sem LLM, sem custo. Roda automaticamente após cada fase do phaseLoopNode. Verifica estruturalmente: TAD em FATOs (ATS1), linchpin (ATS3), Hendrikson (ATS2), mínimo de narrativas (ATS6), signposts com limiar (ATS9).
2. **Qualitativo LLM** — chamado apenas se estágio determinístico passou E a fase requer julgamento qualitativo (node_narrative, node_integration, node_modeling). **TODO em 1.1.**

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
Antes de executar cada fase (KLIO):
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

| Tier | Agentes (Olympus 1.0) | Google | Anthropic |
|------|----------------------|--------|-----------|
| `economy` | KRATOS | gemini-2.5-flash-lite | claude-sonnet-4-6 |
| `premium` | KLIO, ATHENA | gemini-2.5-flash | claude-opus-4-7 |
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
| **Rate limiting login** | **Postgres-backed (rateLimitLogs), 5/15min por IP — funciona em múltiplas réplicas** | ✅ Sprint 23 |
| Hash-chain SHA-256 | utils/audit.ts — `_hash` + `_previousHash` no JSONB | ✅ Sprint 18 |
| Marca d'água exports | CSS watermark opacity:0.06, texto = classificação do projeto | ✅ |
| Backup corporativo | pg_dump + spawn() (não exec()) — proteção contra shell injection | ✅ Sprint 23 |
| Anti-enumeração login | setTimeout(70ms) timing mitigation | ✅ |
| **Role injection bloqueado** | **register ignora campo `role` do body; roles whitelistados em users.ts** | ✅ Sprint 23 |
| **Security headers** | **CSP + HSTS + X-Frame + Referrer-Policy em nginx.conf e Hono middleware** | ✅ Sprint 23 |
| **JWT secret guard** | **index.ts: ≥32 chars + não-óbvio; NODE_TLS_REJECT=0 bloqueado em produção** | ✅ Sprint 23 |

---

## PARTE 14 — SUITE DE TESTES (31/05/2026)

**Score local: 42/42 ✅ · Potencial com LLM real: 65/65**

| Suite | Resultado | Tipo |
|---|---|---|
| banco | **5/5 ✅** | Sem LLM |
| arquitetura | **6/6 ✅** | Sem LLM — DB state |
| segurança | **6/6 ✅** | Sem LLM |
| kratos | **3/3 ✅** | LLM (~20s) |
| artefatos | **5/5 ✅** | LLM (~1040s) |
| exportação | **4/4 ✅** | LLM |
| sat | **7/7 ✅** | LLM (~1208s) |
| metodologias | **10/10 (script)** | MSEF, Godet, Grumbach, IPEA, OTAN, GBN + siplex, mpo, asplan, esg (Sprint 20) |
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
| 20 | 30 Mai | 18 tarefas: IDOR 6 rotas, JWT jti+revogação, rate limit PG, JOIN loadMethodology, HNSW, cache UI, AuditModal, AnalysisService, reportLayout UI |
| Deploy | 30 Mai | **Railway online** — olympus-api + olympus-web. Fixes: railway.toml, nginx SNI, pg_dump PGDG, PORT dinâmica |
| Pós-deploy | 31 Mai | Bug A (tool loop guard Agent.ts), Bug B (fase no CONFIRMAR), watermark ACESSO RESTRITO, EventsPanel flicker, batch/status order, T-10c pg-boss KRATOS |
| **Sprint 22** | **02 Jun 2026** | **Olympus 1.0 — Migração arquitetural v4→v5:** phaseLoopNode substitui 6 nós especializados · PHASE_CONFIGS em código · phase_outputs (artefatos estruturados) · ATHENA determinística por fase · contexto ~268 tokens vs 40-60K · 5 agentes (remove SCOPUS/PYTHIA/MNEMOSYNE/THEMIS) · 12 metodologias (Bloco A/B) · migration idempotente em index.ts · stress test 10/10 · TypeScript zero erros · Railway deploy + fix clearCheckpointSql |
| **Sprint 23** | **03–04 Jun 2026** | **Auditoria de segurança + performance + bugs de produção:** Sec: role injection bloqueado no register, 2FA sem userId leak, /health minimal, backup spawn() vs exec(), validação de input em users/auth, JWT secret guard no startup, headers CSP/HSTS/X-Frame no nginx + Hono, login rate limit migrado para Postgres. Perf: 3 caches module-level em phaseLoopNode (KLIO/projectName/tools), buildToolsForPhase cached, buildPhaseSummary O(1), sessions list com colunas seletivas, reloadCronJobs → cirúrgico. Bugs: 8 observações do teste Grumbach corrigidas (circular JSON EventsPanel, PYTHIA legado removido, MPC condicional por metodologia, ATHENA message descritiva, empty KLIO output fallback, fase 3 tool_register_event adicionado, guardrail fase-count no phase-configs e seed). |

---

## PARTE 16 — BACKLOG

### ✅ Todos os itens de alta/média prioridade concluídos (Sprints 1–20 + pós-deploy)

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
| HERMES_SIPLEX removido (anti-padrão) | 17 |
| Gemini 2.0 Flash removido (descontinuado) | 19 |
| IDOR corrigido em 6 rotas JWT | 20 |
| JWT jti + revoked_tokens + logout | 20 |
| Rate limit PostgreSQL sliding window | 20 |
| JOIN único loadMethodology | 20 |
| Índice HNSW pgvector | 20 |
| Cache invalidation UI + badge | 20 |
| AuditModal + hash-chain verify | 20 |
| AnalysisService extraído de chat.ts | 20 |
| reportLayout Standard/Estendido na UI | 20 |
| **Deploy Railway** ✅ Online 30 Mai 2026 | 20 |
| PoC Presencial USB — pacote gerado (401 MB tar) | 20 |
| **Audit Frontend Modal** ✅ implementado | 20 |
| **Rate Limiting Redis** → PostgreSQL sliding window | 20 |
| Bug A — tool loop guard (Agent.ts) | Pós-deploy |
| Bug B — fase no CONFIRMAR (vizMode=passos) | Pós-deploy |
| Watermark CONFIDENCIAL → ACESSO RESTRITO | Pós-deploy |
| pg-boss KRATOS — isolamento de jobs | T-10c |

### 🔲 Pendente — Bugs confirmados em smoke test (30 Mai 2026)

| # | Bug | Descrição |
|---|-----|-----------|
| #2/#3 | **Mensagem duplicada** | HERMES transcreve saída do especialista nos tokens E inclui na síntese → 2 mensagens salvas no banco. Afeta chat e DOCX exportado. |
| D | **Páginas vazias PDF** | Mensagens `parcial` curtas (~800 chars) do HERMES entre fases exportadas como blocos quase vazios. |
| #6 | **`---` repetido** | LLM artifact: traço horizontal repetido por dezenas de linhas em alguns outputs. |
| C | **Bloco sem export visível** | Quando especialista retorna erro, HERMES gera resposta `parcial` — REPORT_PATTERNS não casa. |

### 🔲 Pendente — Funcionalidades

| # | Item | Descrição |
|---|------|-----------|
| A | **VPN + Dados Proprietários** | Acesso a dados internos do cliente via VPN. Railway ativo — desbloqueado, depende de contrato. |
| B | **PoC USB — teste máquina limpa** | Pacote gerado. Falta validar instalação do zero em máquina sem Docker/Node. |

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
15. Tabelas pgboss.*: NÃO adicionar ao schema Drizzle (gerenciadas pelo pg-boss internamente)
16. Hono route order: PATCH /batch/status DEVE preceder PATCH /:id/status — Hono casa /batch como id='batch'
17. railway.toml: NÃO incluir dockerfilePath/healthcheckPath na raiz — afeta TODOS os serviços
18. nginx Railway: proxy_ssl_server_name on (SNI para HTTPS upstream), porta via $PORT (não hardcoded 80)
19. pg_dump Railway usa PostgreSQL 18: binário real em /usr/lib/postgresql/18/bin/pg_dump (PGDG apt)
20. Admin isento de rate limit de análise — MSEF em passos usa 8-10 chamadas por sessão
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
| Race condition DB→API no Railway (cold start) | ✅ **Resolvido** | Retry 10×3s. Health check `/ping` configurado no dashboard Railway. |

### 19.2 Riscos Operacionais e Estratégicos

| Risco | Contexto | Mitigação |
|-------|----------|-----------|
| ~~Deploy ausente bloqueia KRATOS~~ | ✅ **Railway online desde 30 Mai 2026** | KRATOS com pg-boss (T-10c) — jobs enfileirados em PostgreSQL, retry automático. |
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
| Railway (deploy 24/7 + PostgreSQL) | Hobby ativo | ~R$ 70/mês | ~R$ 120 (Pro) | ✅ **Online desde 30 Mai 2026** |
| Google Workspace | Business Starter | R$ 35 | R$ 35 | ✅ Planejado |
| Contador terceirizado | Mensalidade | R$ 500 | R$ 500 | ✅ Planejado |
| Demais (Notion, Canva, n8n) | Free/Pro | R$ 93 | R$ 93 | ✅ Planejado |
| **TOTAL** | — | **R$ 808/mês** | **~R$ 1.258/mês** | ✅ < R$ 1.500 |

> **Margem de segurança:** custo pós-contrato estimado em R$ 1.258/mês — dentro da diretriz de R$ 1.500/mês. Voyage AI substituído por Ollama local zerou este item. Margem de R$ 242/mês absorve variações.

---

## PARTE 22 — PONTOS DE ATENÇÃO ARQUITETURAIS E DE UI

### 22.1 Decisões arquiteturais conhecidas (intencionais, não problemas)

- ~~**Duas rotas de análise:**~~ **✅ Sprint 21 — Motor único LangGraph.** `/chat/stream` e a rota síncrona foram removidas. Toda análise passa por `/chat/stream/graph`. Os 4 modos (passos/etapa/passagem/thinking) são configurações do grafo.
- **App.tsx com estado global centralizado:** padrão deliberado para MVP. Decomposição em contextos React (LLMContext, SessionContext) está no roadmap mas não é bloqueadora.

### 22.2 Débito técnico conhecido

- **export.ts — mapeamentos de fase:** usa `_getPhaseMap()` com TTL 5 min — fonte única via banco. ✅ Resolvido Sprint 20.
- **parseScenarioProbabilities() — regex frágil:** ainda em uso para análises antigas. `tool_register_scenario` é o substituto para novas análises.
- **HERMES_SIPLEX no banco:** deletado via seed.ts a partir do Sprint 20. Não recriado.
- ~~**Mensagem duplicada (Bug #2/#3):**~~ ✅ Resolvido Sprint 21 — instrução de transcrição verbatim removida.
- ~~**Páginas vazias PDF (Bug D):**~~ ✅ Resolvido Sprint 21 — filterAgentMessages threshold 800 chars.
- **Slugs canônicos atuais (ESTADO_REAL_SISTEMA.md):** `ceeex`, `gbn`, `ipea_buarque`, `alta`, `mpo`, `siex`, `grumbach`, `esg`, `godet` + stubs `siplex`, `grumbach_gestao`, `sped`. Os slugs legados `futures`, `macroplan`, `asplan`, `msef` foram removidos ou renomeados na migração para Olympus 1.0.
- **OLYMPUS stubs pendentes:** grumbach_plj, siex_mpc, siplex_plj, asplan_sped (metodologias de planejamento estratégico — fases indefinidas, orquestrador OLYMPUS).

### 22.3 UI/UX — itens pendentes de design

- **Modo `passos` — HitlDecisionCard:** ✅ Sprint 21 — cartão de Confirmar/Redirecionar implementado acima do InputZone.
- **VizStatusBar:** ✅ Sprint 21 — barra de status mostrando modo, fase e agente ativo.
- **Seletor de `reportLayout`:** ✅ Toggle Standard/Estendido implementado no CommandBar (Sprint 20). Estado em localStorage por projeto.
- **Seletor de `vizMode`:** ✅ Sprint 21 — 'Motor LangGraph' removido (obsoleto). 4 modos disponíveis: Passo a Passo, Etapa Completa, Processo Completo, Raciocínio Estendido.
- **EventsPanel (HITL):** funcional, flicker corrigido (Sprint 20). Theming ainda inconsistente com o restante da UI.

---

## Sprint 21 — Motor LangGraph-first + Bugs + OTAN (31 Mai 2026)

### Decisão arquitetural principal

**Eliminação do `runAnalysis()` e adoção do LangGraph como motor único.** Ver seção 22.1 acima.

### Mudanças críticas

| Componente | Antes | Depois |
|---|---|---|
| `chat.ts` | 3 rotas (/, /stream, /stream/graph) | 1 rota (/stream/graph) |
| `analysis.service.ts` | 569 linhas — orquestrador ReAct completo | 75 linhas — cache de metodologias |
| `useChat.ts` | Alternava entre /stream e /stream/graph | Sempre /stream/graph |
| `cron.ts KRATOS` | `runAnalysis()` | `runDirectAgent()` (sem grafo) |
| `synthesisNode` | Pegava primeiro orchestrator do DB | Prefere HERMES via agentMethodPrompts |
| `NewSessionModal` | 5 modos (incl. Motor LangGraph) | 4 modos (todos já usam LangGraph) |

### Bugs resolvidos

| Bug | Fix |
|---|---|
| pg-boss crash Railway (ERR_UNHANDLED_ERROR) | `cron.ts`: `boss.start()` → `boss.work()` + `boss.on('error')` |
| Bugs #2/#3: conteúdo duplicado | Instrução "Transcreva verbatim" → "Apresente sem duplicar" |
| Bug #6: `---` repetido | Regex `/(\n\s*---\s*){3,}/g` em analysis.service.ts |
| Bug C: export bloqueado em erro de especialista | useExport.ts: fallback 3 níveis (>300 chars, excl. planning) |
| Bug D: páginas vazias PDF | export.ts: filterAgentMessages threshold 800 chars |

### Metodologias

- **OTAN/AltA**: 6 fases per OTAN.md — KAC, What-If, Analysis of Alternatives, Red Teaming, Pre-Mortem
- **SIPLEx/CEEEx**: 7 fases — HERMES removido como agentRole (causava crash SSE ao tentar usar consultar_agente como especialista)
- **SIEx**: nome canônico "SIEx: Conhecimento Estimativa EB" (era "MPC: Conhecimento Estimativa EB")
- **HERMES agentMethodPrompts**: Grumbach (9 fases) e SIEx (5 fases) adicionados; Godet, OTAN, ESG, macroplan, futures reforçados com [MAPEAMENTO DE ESPECIALISTAS]
- **seed.ts**: cleanup automático de fases excedentes com `gt(phaseNum, max)`

---

*Atualizado em 31/05/2026 — Sprint 21 concluído — Railway deploy em andamento — LangGraph-first*
*Para revisão de arquitetura e UI pelo Claude Chat e Design*
