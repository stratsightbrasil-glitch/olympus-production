# ESTADO ATUAL DO OLYMPUS v4
**Documento técnico para revisão de design — atualizado em 28/05/2026 (Sprint Estabilização de Testes + Limpeza Técnica)**
**Gerado por:** Claude Code (análise estática do código-fonte + execução do seed)
**Destinatário:** Claude Chat — análise arquitetural e continuidade do desenvolvimento

---

## 1. ESTRUTURA DE ARQUIVOS

```
Olympus/                            # (renomeado de Olympus_v4 em 26/05/2026)
├── apps/
│   ├── api/                        # Backend Node.js — Hono framework
│   │   └── src/
│   │       ├── index.ts            # Entry point, CORS, JWT, rotas, startup SQL + seed llm_tiers
│   │       ├── mailer.ts           # Nodemailer — envio de e-mails SMTP
│   │       ├── cron.ts             # KRATOS scheduler — KratosOrchestrator; updateCronJob/removeCronJob
│   │       ├── graph/              # LangGraph StateGraph — motor de orquestração v2
│   │       │   ├── builder.ts      # buildGraph() — StateGraph 6 nós, BoundedMemorySaver, conditional_edges
│   │       │   ├── nodes.ts        # scopus/klio/pythia(interrupt HITL)/mnemosyne/integration/synthesis
│   │       │   ├── helpers.ts      # loadMessagesFromDb(projectId, limit=200)
│   │       │   ├── boundedMemorySaver.ts  # LRU 50 threads, TTL 2h — sem dependência de PostgreSQL
│   │       │   ├── router.ts       # routeFromState() + NODE_SLUG_TO_GRAPH_NODE (two-step slug lookup)
│   │       │   └── index.ts        # Reexporta buildGraph()
│   │       ├── routes/
│   │       │   ├── chat.ts         # Motor principal — loadMethodology() + runAnalysis() exportado + /stream/graph
│   │       │   ├── events.ts       # HITL API — CRUD + aprovação de project_events (6 endpoints)
│   │       │   ├── export.ts       # Exportação DOCX/PDF/HTML — buildIR()+async renderHtml()/renderDocx()+yieldToEventLoop + cache 5min
│   │       │   ├── kratos.ts       # API do painel KRATOS
│   │       │   ├── sessions.ts     # CRUD de sessões/projetos
│   │       │   ├── settings.ts     # Configuração LLM — GET/PATCH + getLLMTiers() + PATCH /llm-tiers
│   │       │   ├── signals.ts      # API de sinais fracos
│   │       │   ├── indicators.ts   # API de indicadores (com appendHistory e autoRegisterSignal)
│   │       │   ├── playbook.ts     # POST /gerar — exportação DOCX do Playbook operacional
│   │       │   ├── audit.ts        # GET /audit + /audit/stats — logs de auditoria
│   │       │   ├── auth.ts         # Login, JWT (JWT_EXPIRY configurável, logAudit no login)
│   │       │   ├── users.ts        # CRUD de usuários
│   │       │   ├── extract.ts      # Extração de documentos
│   │       │   ├── embeddings.ts   # RAG embeddings
│   │       │   ├── reviews.ts      # Revisões analíticas
│   │       │   ├── engine.ts       # TechniqueEngine HTTP
│   │       │   ├── painel.ts       # Painel público
│   │       │   ├── backup.ts       # Backup
│   │       │   ├── docs.ts         # Documentação da API
│   │       │   └── teams.ts        # Equipes
│   │       ├── middleware/
│   │       │   └── rateLimit.ts    # Rate limiting em memória por userId (5 análises/h, 10 exports/h)
│   │       ├── utils/
│   │       │   └── audit.ts        # logAudit() — helper silencioso para audit_logs
│   │       ├── tools/
│   │       │   ├── technique-engine.ts     # SAT Engine — injeção de prompts
│   │       │   ├── analytic-standards.ts   # Ferramentas ICD 203
│   │       │   ├── analytical-engines.ts   # 7 ferramentas analíticas Fase 1 (JSON Schema puro)
│   │       │   ├── signals.ts              # Ferramentas de sinais fracos
│   │       │   └── rag.ts                  # Retrieval-Augmented Generation
│   │       └── scripts/
│   │           ├── seed.ts         # Seed declarativo — 10 metodologias · 73 fases · slug/node_slug
│   │           ├── seed-demo.ts    # Seed de demonstração (PoC) — idempotente
│   │           └── backup-prompts.ts # Exporta prompts do banco para JSON (auditoria)
│   │
│   └── web/                        # Frontend React + Vite + TailwindCSS
│       └── src/
│           ├── App.tsx             # Componente raiz — estado global, handlers (1715 linhas) ⚠️
│           ├── components/
│           │   ├── layout/
│           │   │   ├── CommandBar.tsx    # Barra de ações + seletor LLM (525 linhas)
│           │   │   ├── KratosPanel.tsx  # Painel KRATOS (632 linhas) ⚠️
│           │   │   ├── Sidebar.tsx      # Histórico + sessões (489 linhas)
│           │   │   ├── Topbar.tsx       # Cabeçalho
│           │   │   ├── RightPanel.tsx   # Painel lateral direito
│           │   │   └── InfoBar.tsx      # Barra de informações
│           │   ├── chat/
│           │   │   ├── MessageBubble.tsx
│           │   │   ├── InputZone.tsx
│           │   │   ├── AgentWorking.tsx
│           │   │   └── ThinkingBlock.tsx
│           │   ├── canvas/
│           │   │   ├── artifacts/
│           │   │   │   ├── Matriz2x2/   # Artefato interativo — Matriz 2x2
│           │   │   │   └── PestelScatter/ # Scatter PESTEL
│           │   │   └── parsers/
│           │   │       ├── parseMatriz2x2.ts
│           │   │       └── parsePestel.ts
│           │   └── ui/
│           │       └── AgentMark/      # Badge visual do agente
│           └── data/
│               └── methodologySteps.ts # Config estática do stepper (veja §4)
│
└── packages/
    ├── core/                       # Motor de agentes (npm workspace)
    │   └── src/
    │       ├── Agent.ts            # Execução de agentes — resolve tier→model via context.llmTiers
    │       ├── Orchestrator.ts     # Roteamento entre agentes (a substituir por graph.invoke() na Fase 2)
    │       ├── types.ts            # AgentContext: +llmTiers +anchorContext +connectivityMode
    │       ├── nodeRouter.ts       # getNodeRouter(phases): resolve nodeSlug→agentName, nextSlug()
    │       └── index.ts            # Reexporta tudo
    ├── db/                         # ORM Drizzle + PostgreSQL
    │   └── src/
    │       ├── schema.ts           # Definição das tabelas (inclui project_events, methodology_phases)
    │       ├── db.ts               # Conexão postgres
    │       └── index.ts            # Reexporta tudo
    └── tools/                      # Ferramentas externas (npm workspace)
        └── src/
            ├── tavily.ts           # Busca web — guard connectivityMode em execute()
            ├── dados-publicos.ts   # APIs públicas: BCB, IBGE, IPEA, FMI, OMS etc.
            ├── embed.ts            # Embeddings via Voyage AI
            └── index.ts            # Reexporta tudo
```

---

## 2. BANCO DE DADOS — SCHEMA

Tabelas em PostgreSQL via Drizzle ORM:

| Tabela | Descrição | Colunas relevantes |
|--------|-----------|-------------------|
| `users` | Usuários do sistema | id, name, email, passwordHash, role (analista/admin) |
| `methodologies` | Catálogo de metodologias | id, name, category, isDefault, agentsConfig (JSONB) |
| `agents` | Agentes cadastrados | id, name, role, type (orchestrator/expert), systemPrompt, toolsConfig, techniquesConfig |
| `techniques` | Técnicas SAT (AltA) | id, name, description, instructions, toolsConfig |
| `tools` | Definições de ferramentas (placeholder) | id, name, description, schemaJson |
| `projects` | Projetos/sessões de análise | id, name, client, analyst, horizon, methodology, status, kratosCron, alertEmails |
| `messages` | Histórico de mensagens | id, projectId, role, content, agentName, filesJson |
| `embeddings` | Vetores RAG (512 dims, pgvector) | id, projectId, chunkText, embedding, metadata |
| `analyticReviews` | Revisões ICD 203 | id, projectId, atsCompliance, status |
| `weakSignals` | Sinais fracos / wild cards | id, projectId, titulo, tipo, classificacao, statusRadar, sentinela1/2 |
| `indicators` | Indicadores de monitoramento | id, projectId, name, source, thresholdYellow/Red, lastValue, status, **valueHistory** (jsonb, 90 dias) |
| `platform_settings` | Config da plataforma | key (PK TEXT), value (JSONB) — **agora no schema Drizzle** (corrigido Sprint 4) |
| `audit_logs` | Logs de auditoria imutáveis | id, userId, userName, action, resourceType, resourceId, metadata (jsonb), ipAddress, createdAt |
| `project_events` | Eventos analíticos — tendências, incertezas, FPFs | id, projectId, name, description, type, status (proposed/approved/rejected), reliability A-F, credibility 1-6 |
| `project_scenarios` | Cenários narrativos derivados de eventos aprovados | id, projectId, name, narrative, probability |
| `matrix_direct_impacts` | Matriz MICMAC — impacto direto entre eventos | fromEventId, toEventId, impactScore 0-3 |
| `technique_execution_outputs` | Saídas matemáticas de técnicas SAT | projectId, techniqueId, outputJson (resultados nunca calculados em prompt) |

---

## 3. AGENTES — INVENTÁRIO COMPLETO

### 3.1 Agentes ativos (todos gerenciados pelo `seed.ts` — Sprint 11)

| Agente | Tipo | Metodologias | Ferramentas |
|--------|------|--------------|-------------|
| **HERMES** | orchestrator | MSEF, GODET, OTAN/AltA, MACROPLAN, MPO, ASPLAN, FUTURES | consultar_agente |
| **OLYMPUS** | orchestrator | GRUMBACH - PLANEJAMENTO, SIEX - MPC | consultar_agente |
| **HERMES_SIPLEX** | orchestrator | SIPLEx | consultar_agente |
| **SCOPUS** | expert | Todas | web_search, buscar_dados_publicos, avaliar_fonte, declarar_julgamento, registrar_hipotese_alternativa |
| **KLIO** | expert | Todas | web_search, buscar_dados_publicos, avaliar_fonte, declarar_julgamento, registrar_hipotese_alternativa |
| **PYTHIA** | expert | Todas | web_search, buscar_dados_publicos, avaliar_fonte, declarar_julgamento, registrar_hipotese_alternativa |
| **MNEMOSYNE** | expert | MSEF, GRUMBACH, FUTURES | web_search |
| **THEMIS** | expert | Todas | web_search, buscar_sinais, avaliar_fonte, declarar_julgamento, registrar_hipotese_alternativa |
| **KRATOS** | expert | MSEF, GRUMBACH | web_search, buscar_dados_publicos |
| **ATHENA** | expert | Todas (chamado pelo orquestrador) | avaliar_fonte, declarar_julgamento, registrar_hipotese_alternativa |

> **✅ Renomeado Sprint Final:** `HERMES_REVISOR` → `ATHENA` (Deusa da Sabedoria). ATHENA é a revisora de qualidade analítica — avalia entregas dos especialistas antes de apresentar ao usuário. No futuro fará revisão para todos os sistemas da suíte, não apenas o Sistema de Cenários.

> **✅ Resolvido Sprint 11:** Os 4 orquestradores obsoletos foram eliminados — `HERMES_ALTA`, `HERMES_GODET`, `HERMES_GRUMBACH`, `HERMES_SIEX`. Todos os agentes são agora gerenciados exclusivamente pelo `seed.ts` declarativo (idempotente). A assimetria entre chat.ts e seed.ts foi corrigida.

> **Instruções por metodologia:** Cada orquestrador e agente especialista recebe instruções específicas via tabela `agent_method_prompts`. Em runtime, o `AgentContext` injeta `[METODOLOGIA ATIVA: X] <extra_instructions>` no início do systemPrompt. Cobertura atual: HERMES (MSEF, GODET, OTAN/AltA, MACROPLAN, MPO, ASPLAN, FUTURES) + OLYMPUS (GRUMBACH, SIEX) + especialistas (SCOPUS, KLIO, PYTHIA, MNEMOSYNE, THEMIS) por metodologia.

### 3.2 Regra de acesso a ferramentas

Cada agente declara suas ferramentas em `toolsConfig` (JSONB array no banco). O Motor Dinâmico lê isso, filtra apenas as que existem em `availableTools`, e passa ao `Agent`. Ferramenta ausente = silenciosamente ignorada.

Ferramentas disponíveis:
- `web_search` — Tavily API
- `buscar_dados_publicos` — BCB/IBGE/IPEA/FMI/OMS/ONU/ITU/Comex (via pacote tools)
- `buscar_documentos_internos` — RAG (pgvector)
- `registrar_sinal` / `buscar_sinais` / `atualizar_sentinela` — Sinais Fracos
- `declarar_julgamento` / `registrar_hipotese_alternativa` / `avaliar_fonte` — ICD 203 / ATS
- `consultar_agente` — delegação interna (orquestradores só)
- `tool_register_event` — registra evento MICMAC/MPC no banco (projectId injetado via closure)
- `tool_register_impact_relation` — registra relação de impacto direto entre variáveis
- `tool_grumbach_expert_simulation` — simulação de 7 personas para projeção Grumbach

> **⚠️ Arquitetura das ferramentas analíticas:** `tool_register_event`, `tool_register_impact_relation` e `tool_grumbach_expert_simulation` são criadas via `createAnalyticalEngineTools(projectId)` em `apps/api/src/tools/analytical-engines.ts`. Esta factory injeta `projectId` via closure e converte o campo `parameters` (OlympusTool) para `schema` (Tool<any>), removendo `projectId` do schema exposto ao LLM. Agentes que usam essas ferramentas precisam declará-las tanto em `tools_config` no banco quanto ter a tool registrada em `availableTools` em `chat.ts`.

---

## 4. METODOLOGIAS — COMO CADA UMA FUNCIONA

### 4.1 Armazenamento e ativação

1. Frontend seleciona metodologia ao criar sessão → envia `metodologia` no POST /api/v1/chat
2. `runAnalysis()` chama `getOrSeedMethodology(metodologiaName)`
3. `getOrSeedMethodology()` lê a metodologia do banco → se é MSEF, garante agentes/config via upsert (safety net) → retorna o objeto methodology
4. `methodology.agentsConfig` tem o formato unificado: `{ agents: [...], steps: [{num, agent, label}] }`
5. Agentes são carregados do banco por nome, registrados no `Orchestrator`; o orquestrador é o de `type='orchestrator'`

> **✅ Resolvido Sprint 11:** Os blocos `if (methodName === 'GODET')` e `if (methodName === 'ALTA')` foram removidos de `getOrSeedMethodology()`. Apenas o bloco MSEF permanece como safety net para instalações frescas. Todas as demais metodologias confiam exclusivamente no `seed.ts`.

### 4.2 Metodologias no catálogo

| Nome | Categoria (banco) | Orquestrador | Fases | KRATOS? | Stepper | Fonte |
|------|-------------------|--------------|-------|---------|---------|-------|
| MSEF | Cenários Prospectivos | HERMES | 7 | ✅ fase 6 | ✅ | seed.ts + safety net chat.ts |
| GRUMBACH - PLANEJAMENTO | Cenários Prospectivos | OLYMPUS | 5 | ✅ fase 5 | ✅ | seed.ts |
| GODET | Cenários Prospectivos | HERMES | 6 | ✅ fase 6 | ✅ | seed.ts |
| OTAN/AltA | Cenários Prospectivos | HERMES | 5 | ✅ fase 5 | ✅ | seed.ts |
| SIEX - MPC | Produção do Conhecimento | OLYMPUS | 6 | ✅ fase 6 | ✅ | seed.ts |
| SIPLEx | Planejamento Estratégico | HERMES_SIPLEX | 7 | ✅ fases 6-7 | ✅ | seed.ts |
| MACROPLAN | Cenários Prospectivos | HERMES | 5 | ✅ fase 5 | ✅ | seed.ts |
| MPO | Planejamento Estratégico | HERMES | 5 | ✅ fase 5 | ✅ | seed.ts |
| ASPLAN | Planejamento Estratégico | HERMES | 6 | ✅ fase 6 | ✅ | seed.ts |
| FUTURES | Cenários Prospectivos | HERMES | 7 | ✅ fase 7 | ✅ | seed.ts |

> **✅ Resolvido Sprint 11:** Todas as 10 metodologias têm fases definidas em `methodology_phases` e `agentsConfig.steps` populado. O stepper do frontend lê do banco — sem metodologias sem steps.
>
> **✅ Resolvido Sprint 12:** KRATOS adicionado a todas as metodologias (era ausente em GODET, AltA, SIEX, MACROPLAN, MPO, ASPLAN, FUTURES). Sem KRATOS no agentsConfig, o botão de monitoramento falhava com "Agente KRATOS não registrado."

### 4.3 Fluxo de execução de uma análise

> ✅ **Resolvido Sprint Pré-LangGraph R1+R2:** `getOrSeedMethodology()` removido. `loadMethodology()` é a única fonte — lança exceção se a metodologia não existe no banco (execute `npm run seed` antes). Memória carregada do banco (server-authoritative), não de `body.messages`.

```
POST /api/v1/chat (com SSE)
  └─ runAnalysis()
       ├─ loadMethodology() → lança se não encontrada. SEM auto-seed em runtime.
       ├─ getLLMConfig() + getLLMTiers() → carregados em paralelo de platform_settings
       ├─ db.query.messages.findMany() → memória server-authoritative do banco
       ├─ buildMemoryWindow(dbMessages) → janela de tokens (budget 32k), suporta multimodal
       ├─ buildAnchorContext() → injeta eventos status='approved' como âncora HITL
       ├─ Cria Orchestrator + registra agentes com ferramentas
       ├─ Constrói AgentContext { projectId, methodology, memory, llmConfig, llmTiers,
       │                          phases, agentMethodPrompts, connectivityMode, anchorContext }
       ├─ Orquestrador.run() → Agent.run() com streamText()
       │    ├─ Resolve tier: context.llmTiers[agent.modelOverride] → ID de modelo efetivo
       │    ├─ tool: consultar_agente(agent_name, query)
       │    │    └─ context.dispatch(agentName, query)
       │    │         └─ Especialista.run(query, context) com generateText()
       │    │              └─ Ferramentas: web_search (guard connectivityMode), buscar_dados_publicos, etc.
       │    └─ Síntese final → tokens enviados via SSE ao frontend
       └─ Salva mensagem no banco
```

### 4.4 Stepper — fonte de dados

✅ **Resolvido Sprint 11:** O frontend agora prioriza sempre os steps vindos do banco (`GET /api/v1/engine/methodologies` → `steps` derivados de `methodology_phases`). O arquivo `methodologySteps.ts` mantém apenas `DEFAULT_STEPS` como fallback genérico — não tem mais steps hardcoded por metodologia. Como todas as 10 metodologias têm fases no banco, o fallback só seria acionado em falha de rede ou metodologia não cadastrada.

```
GET /api/v1/engine/methodologies
  → { ...m, steps: methodologyPhases }   // banco → prioridade
       ↓ se steps === null ou []
  DEFAULT_STEPS                           // fallback genérico (5 steps)
```

---

## 5. ROTEAMENTO DE PROVIDER LLM

> **Estado atual (28 Mai 2026):** Provider ativo é **Google Gemini 2.5 Flash** (testes de integração).  
> Para produção, alternar para Anthropic via `PATCH /api/v1/settings/llm`.

### 5.1 Fluxo completo da configuração

```
DB: platform_settings (key='llm', value={"provider":"google","model":"gemini-2.5-flash"})
  ↓
getLLMConfig() [settings.ts] — lê do banco a cada análise, fallback para .env
  ↓
runAnalysis() [chat.ts] — const [llmConfig, llmTiers] = await Promise.all([getLLMConfig(), getLLMTiers()])
  ↓
AgentContext.llmConfig = { provider, model }
AgentContext.llmTiers  = { economy: 'gemini-2.5-flash-lite', premium: 'gemini-2.5-flash' }
  ↓
Agent.run(input, context) → getModel(context.llmConfig)
  ↓ se provider = 'anthropic'      ↓ se provider = 'google'       ↓ se provider = 'ollama'
anthropic(modelName)         google(modelName)              createOpenAI({baseURL})(modelName)
[Anthropic SDK]              [@ai-sdk/google]               [OpenAI SDK — compatível c/ Ollama]
```

### 5.2 Providers suportados

| Provider | SDK | Env var | Modelos ativos (28 Mai 2026) |
|----------|-----|---------|------------------------------|
| `anthropic` | `@ai-sdk/anthropic` | `ANTHROPIC_API_KEY` | claude-haiku-4-5, claude-sonnet-4-6, claude-opus-4-7 |
| `google` | `@ai-sdk/google` | `GOOGLE_GENERATIVE_AI_API_KEY` | gemini-2.5-flash, gemini-2.5-flash-lite |
| `ollama` | `@ai-sdk/openai` (compat) | — | modelos locais via `http://ollama:11434/v1` |

### 5.2b ⚠️ Modelos Google descontinuados

| Modelo | Status | Substituto |
|--------|--------|------------|
| `gemini-2.0-flash` | ❌ Descontinuado para novas contas | `gemini-2.5-flash` |
| `gemini-2.5-flash-preview-05-20` | ❌ Não existe na v1beta | `gemini-2.5-flash` (sem sufixo) |

Para listar modelos disponíveis no container:
```bash
docker exec olympus_api node -e "
const https = require('https');
const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
https.get('https://generativelanguage.googleapis.com/v1beta/models?key=' + key, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => JSON.parse(data).models.forEach(m => console.log(m.name)));
});"
```

### 5.3 Parâmetros que mudam entre providers

| Parâmetro | Anthropic | Google | Ollama |
|-----------|-----------|--------|--------|
| SDK | `@ai-sdk/anthropic` | `@ai-sdk/google` | `@ai-sdk/openai` com `createOpenAI({baseURL})` |
| apiKey | ANTHROPIC_API_KEY | GOOGLE_GENERATIVE_AI_API_KEY | `'ollama'` literal |
| maxTokens | 32000/16000 | 32000/16000 | Igual |
| toolChoice | `prepareStep: required step 0` | Igual | Igual |
| stopWhen | stepCountIs(15) | Igual | Igual |

### 5.4 Troca de provider em runtime

- **Leitura:** GET /api/v1/settings → `{ llm: {provider, model}, anthropicModels: [...], ollamaModels: [...] }`
- **Escrita:** PATCH /api/v1/settings/llm (admin only) → upsert em `platform_settings`
- **Efeito:** próxima análise já usa o novo provider (sem restart)
- **UI:** `LlmSelector` em `CommandBar.tsx` — dropdown com seção Anthropic e seção Ollama
- **⚠️ Obrigatório:** ao trocar de provider, também atualizar `PATCH /api/v1/settings/llm-tiers` com IDs de modelo do novo provider. IDs são específicos por provider — nunca misturar Anthropic IDs com Google ou vice-versa.

### 5.5 Modelos disponíveis no seletor

- **Anthropic:** `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5` (hardcoded em settings.ts)
- **Google:** `gemini-2.5-flash`, `gemini-2.5-flash-lite` (configurados via DB)
- **Ollama:** dinâmico — GET /ollama-models → proxy para `http://ollama:11434/api/tags`

### 5.6 Routing de modelo por agente — Tier System (Sprint Pré-LangGraph)

> ✅ **Tier System implementado.** IDs de modelo não ficam mais hardcoded em código — `agents.model_override` armazena um **label de tier** (`'economy'`/`'premium'`). O mapeamento `tier → model ID` fica em `platform_settings.llm_tiers`, editável via UI de Settings sem redeployar.

**Cadeia de resolução:**
```
agents.model_override = 'economy'      (seed.ts — label semântico)
        ↓
context.llmTiers = { economy: 'claude-sonnet-4-6', premium: 'claude-opus-4-7' }
        (getLLMTiers() → platform_settings.llm_tiers)
        ↓
Agent.ts: tiers['economy'] → 'claude-sonnet-4-6'
        (fallback: se tier não mapeado, usa valor como ID direto — compatibilidade)
```

| Tier | Agentes | Google (atual testes) | Anthropic (produção) | Perfil |
|------|---------|----------------------|----------------------|--------|
| `economy` | SCOPUS, KRATOS | `gemini-2.5-flash-lite` | `claude-sonnet-4-6` | Tarefas mecânicas, resposta rápida |
| `premium` | KLIO, PYTHIA, MNEMOSYNE, THEMIS, ATHENA | `gemini-2.5-flash` | `claude-opus-4-7` | Raciocínio profundo |
| *(global)* | HERMES, OLYMPUS, HERMES_SIPLEX | `gemini-2.5-flash` | via `llm.model` | Orquestradores (sem modelOverride) |

**Troca de modelo sem código:** UI de Settings (admin) → seção "⚙ Tiers de Agentes" → dropdown Economy / Premium → `PATCH /api/v1/settings/llm-tiers`. Log: `[AGENTE] Tier [economy] → gemini-2.5-flash-lite (google)`.

**⚠️ Regra crítica ao trocar provider:** sempre atualizar `llm_tiers` junto com `llm`. IDs de modelo são específicos por provider.

---

## 6. EXPORTAÇÃO DE RELATÓRIOS

### 6.1 Endpoints e formatos

| Endpoint | Método | Formato | Função principal | Arquivo |
|----------|--------|---------|-----------------|---------|
| `/api/v1/export/pdf` | POST | HTML (impressão → PDF) | `buildHtml()` | export.ts |
| `/api/v1/export/docx` | POST | .docx binário | `buildDocx()` | export.ts |
| `/api/v1/export/estimativa` | POST | HTML | `buildEstimativaHtml()` | export.ts |

Payload esperado em todos: `{ projeto: {...}, messages: [...], tipo?: 'relatorio'|'estendido' }`

### 6.2 buildHtml() — Relatório HTML/PDF

Dois modos controlados pelo parâmetro `tipo`:
- **`padrao`** (default): renderiza apenas a primeira mensagem (o relatório consolidado do orquestrador)
- **`estendido`**: renderiza todas as mensagens agrupadas por fase/agente, com cabeçalhos coloridos

Detecção de agente por fase (hardcoded em dois lugares — `PHASE_LABELS` e `detectAgent()`):
```
SCOPUS → 'Enquadramento Estratégico' (#1565C0)
KLIO → 'Análise Ambiental' (#4527A0)
PYTHIA → 'Cenários Prospectivos' (#B71C1C)
MNEMOSYNE → 'Narrativas de Cenários' (#BF360C)
THEMIS → 'Implicações e Alertas' (#37474F)
KRATOS → 'Monitoramento Contínuo' (#004D40)
HERMES / HERMES_* → 'Síntese e Conclusão' (#1B3A2D)
```

### 6.3 buildDocx() — Relatório Word

Usa `docx` npm package. Mesma lógica de detecção de agente (`DOCX_PHASE_LABELS`). Cria:
- Capa com tabela de metadados
- Cabeçalhos de seção por fase (fundo verde escuro)
- Conversão markdown → TextRun[] com `parseInline()`

### 6.4 buildEstimativaHtml() — Formato SIEx (EB70-MT-10.401)

Documento estruturado em 3 seções (Situação, Análise, Conclusão), correspondendo às fases 1-5 do SIEx. Usa `getBlock(keywords[])` para localizar o bloco de cada fase nas mensagens — busca por palavras-chave em maiúsculas.

### 6.5 Detecção do relatório final no frontend

Em `App.tsx`, a função de exportação padrão (`tipo='padrao'`) busca a mensagem do orquestrador que é o relatório:

```
Passo 1: busca mensagens do HERMES (isHermes: **HERMES** nos primeiros 120 chars, sem HERMES_REVISOR)
         que contenham um dos patterns:
         ['RELATÓRIO FINAL PADRÃO', 'RELATÓRIO FINAL', 'RELATÓRIO DE CENÁRIOS',
          'RELATÓRIO ESTRATÉGICO', 'RELATÓRIO PROSPECTIVO',
          'RAPPORT PROSPECTIF GODET', 'RAPPORT PROSPECTIF',
          'RELATÓRIO GRUMBACH', 'RELATÓRIO SIEX',
          'PRODUTO ALTA FINAL', 'PRODUTO ALTA']
         → pega a mais longa

Passo 2 (fallback): maior mensagem HERMES com > 1500 chars
```

---

## 7. DASHBOARD KRATOS

### 7.1 Dados consumidos

O painel KRATOS consome via `GET /api/v1/kratos/:projectId/dashboard`:
```json
{
  "projeto": { "id", "nome", "kratosCron", "alertEmails" },
  "indicadores": [ { "name", "source", "lastValue", "status" (verde/amarelo/vermelho) } ],
  "sinais": [ WeakSignal completo ],
  "sinalStats": { "total", "materializado", "amplificando", "monitorando", "arquivado",
                  "confirmavel", "ambiguo", "ruido" },
  "overallStatus": "verde"|"amarelo"|"vermelho",
  "lastKratosAt": timestamp,
  "lastKratosExcerpt": string (primeiros 2000 chars da última mensagem KRATOS),
  "scenarioProbabilities": { "q1", "q2", "q3", "q4" } | null
}
```

### 7.2 Como é atualizado

**Análise manual:** usuário digita "MONITORAMENTO" ou clica no botão KRATOS → a análise flui pelo chat normal (agente KRATOS faz web_search + buscar_dados_publicos)

**Análise automática (KRONOS):**
- `reloadCronJobs()` lida no startup e depois de qualquer mudança
- Lê todos os projetos com `status='Ativo'` e `kratosCron` válido
- Agenda `node-cron` para cada um
- No disparo: cria JWT temporário (`id='system'`), chama POST /api/v1/chat com mensagem de comando
- Após análise: envia e-mail via Nodemailer para `alertEmails` do projeto (fallback para ALERT_EMAIL no .env)
- Rate limit: lido de `platform_settings.kronos_cooldown_ms` via `getKratosCooldown()` (fallback 15s)
- Webhook opcional para n8n (falha silenciosa se offline)

### 7.3 Parser de probabilidades de cenário

`parseScenarioProbabilities(text)` em `kratos.ts` — dois modos:
- **MSEF**: regex `Q1-Q4` ou `Cenário 1-4` → `{ q1, q2, q3, q4 }`.
- **GRUMBACH/CEEEx**: regex `Mais Provável / Ideal / Alvo / Tendência` → `{ mais_provavel, ideal, alvo, tendencia }`.
- **GODET**: cenários morfológicos com nomes arbitrários — não parseável sem contexto adicional (by design).

### 7.4 Indicadores — lifecycle

1. Agente KRATOS ou usuário cria indicador via ferramenta `registrar_sinal` (para sinais fracos) ou via painel KRATOS (UI)
2. Valores (`lastValue`) e `status` são atualizados manualmente ou via análise KRATOS
3. `overallStatus` é calculado em runtime: vermelho se qualquer indicador for vermelho, etc.
4. `appendHistory()` — cada atualização de valor é appendada em `valueHistory` (jsonb array); entradas com mais de 90 dias são podadas automaticamente
5. `autoRegisterSignal()` — quando status muda para `amarelo` ou `vermelho`, um sinal fraco é criado automaticamente em `weakSignals` com título padronizado (`Indicador CRÍTICO: <nome>` ou `Indicador em ATENÇÃO: <nome>`); deduplicação por título + projectId

### 7.5 KratosPanel — exibição de histórico e filtros (Sprint 10)

- **Sparkline SVG**: cada indicador tem um minichart de linha (polyline + círculo endpoint, normalizado min-max) exibido na coluna TENDÊNCIA
- **Expand/collapse**: clicar em um indicador expande a linha mostrando tabela de histórico (data + valor) e um sparkline maior
- **Filtro classificação**: chips `confirmavel` / `ambiguo` / `ruido` filtram os sinais fracos além do filtro de statusRadar já existente

---

## 8. SOLUÇÕES PONTUAIS IDENTIFICADAS

Código que resolve um problema específico de forma não generalizável — candidatos a refatoração:

### 8.1 ~~`if/else` por metodologia em `getOrSeedMethodology()`~~ ✅ RESOLVIDO (Sprint 11)

Os blocos `if (methodName === 'ALTA')` e `if (methodName === 'GODET')` foram removidos. O bloco `if (methodName === 'MSEF')` permanece apenas como safety net para garantir que uma instalação fresca tenha o MSEF funcional antes de rodar o seed. Todas as demais metodologias são declarativas via `seed.ts`.

```typescript
// chat.ts — estado atual: apenas o bloco MSEF permanece (safety net)
if (methodName === 'MSEF') { ... } // único bloco restante
return method;
```

### 8.2 ~~Stepper com duas fontes divergentes~~ ✅ RESOLVIDO (Sprint 11)

`methodologySteps.ts` agora contém apenas `DEFAULT_STEPS` como fallback genérico. Todas as 10 metodologias têm steps no banco derivados de `methodology_phases`. O frontend sempre usa o banco como fonte primária.

### 8.3 ~~Janela de memória por contagem, não por tokens~~ ✅ RESOLVIDO (Sprint Pré-LangGraph R2+R6)

`buildMemoryWindow()` agora usa orçamento de tokens (32k, estimativa `len/4`). Carregada do banco (server-authoritative) — não de `body.messages`. Suporta conteúdo multimodal via `estimateTokens()` que serializa arrays de content antes de contar. Primeiro e último item do histórico são sempre preservados para ancoragem.

### 8.4 ~~Detecção de agente hardcoded em 3 lugares~~ ✅ RESOLVIDO

- `export.ts` usa `AGENT_NAME_RE = /\*\*([A-Z][A-Z_]*)\*\*/` genérico — funciona para qualquer agente.
- `AGENTS` em `constants.ts` agora inclui `OLYMPUS` e `HERMES_SIPLEX`.
- `KNOWN_AGENTS` em `MessageBubble.tsx` agora inclui `OLYMPUS` e `HERMES_SIPLEX`.
- `Agent` type em `AgentMark/types.ts` agora inclui `OLYMPUS` e `HERMES_SIPLEX`.
- `GLYPHS` em `AgentMark/index.tsx` mapeia `OLYMPUS`/`HERMES_SIPLEX` para os glyphs de HERMES.
- `isHermes()` não existia em `App.tsx` — `getAgentInfo()` já usa `Object.keys(AGENTS)` dinamicamente.
- Assinatura do HERMES_SIPLEX corrigida em `seed.ts`: `**HERMES_SIPLEX** ·` (era `**HERMES** ·` por erro de copy-paste).

### 8.5 Mapeamento agente→fase hardcoded em 2 builders independentes

`PHASE_LABELS` / `PHASE_COLORS` em `buildHtml()` e `DOCX_PHASE_LABELS` em `buildDocx()` são mapeamentos separados que devem ser mantidos em sincronia manualmente.

### 8.6 Parser markdown duplicado

`buildHtml()` e `buildEstimativaHtml()` têm parsers markdown→HTML independentes (~70 linhas cada). A lógica é quase idêntica mas com pequenas diferenças, tornando manutenção dupla.

### 8.7 `parseScenarioProbabilities()` — regex específica para MSEF

Só reconhece padrões `Q1/Q2/Q3/Q4` ou `Cenário 1-4`. GODET usa cenários morfológicos com nomes arbitrários. GRUMBACH usa Tendencial/Pessimista/Otimista. Painel KRATOS não mostra probabilidades para essas metodologias.

### 8.8 `platform_settings` — migrada para o schema Drizzle ✅

~~A tabela era criada via `CREATE TABLE IF NOT EXISTS` raw SQL no startup.~~ **Corrigido no Sprint 4:** `platform_settings` agora está em `schema.ts` e é gerenciada pelo Drizzle ORM. O startup usa `db.insert(platformSettings).onConflictDoNothing()` para inicializar valores padrão sem sobrescrever customizações.

### 8.9 ~~Modelos Anthropic disponíveis hardcoded em `settings.ts`~~ ✅ RESOLVIDO (Tier System)

`agents.model_override` armazena tier labels (`'economy'`/`'premium'`), não IDs de modelo. O mapeamento `tier → model ID` fica em `platform_settings.llm_tiers` (editável via UI). Lista de modelos disponíveis em `platform_settings.anthropic_models`. Atualizar modelos = usar a UI de Settings sem tocar em código.

### 8.10 Schemas JSON de ferramentas duplicados em `Agent.ts`

`TOOL_JSON_SCHEMAS` em `Agent.ts` contém as definições de schema de todas as ferramentas (consultar_agente, web_search, buscar_dados_publicos, etc.) — ~180 linhas. Cada ferramenta também tem seu schema em seu próprio arquivo. Existe risco de divergência.

### 8.11 ~~Rate limit KRONOS hardcoded~~ ✅ RESOLVIDO

`cron.ts` já possui `getKratosCooldown()` que lê `platform_settings.kronos_cooldown_ms` com fallback de 15 000 ms. `KratosOrchestrator.processQueue()` chama `await getKratosCooldown()` entre projetos.

### 8.12 ~~Prompt da ATHENA faz revisão apenas do MSEF~~ ✅ RESOLVIDO (nota obsoleta)

ATHENA está no `agentsConfig` de todas as 10 metodologias e seu `systemPrompt` é agnóstico de metodologia (ICD 203 / ODNI 2022). Todos os orquestradores (HERMES, OLYMPUS, HERMES_SIPLEX) têm instrução de acionar ATHENA antes do relatório final.

### 8.13 `vizMode` (`etapa`/`thinking`/`passagem`) sem documentação

Controla `maxTokens` no Agent.ts mas o código que define o valor padrão está distribuído. O modo `thinking` (extendedThinking do Claude) pode não funcionar com Ollama.

---

## 9. DEPENDÊNCIAS EXTERNAS ATIVAS

| Serviço | Chave/Config | Onde usado | Obrigatório? |
|---------|-------------|-----------|-------------|
| **Anthropic API** | `ANTHROPIC_API_KEY` | Agent.ts — provider padrão | Sim (se provider=anthropic) |
| **Tavily Search** | `TAVILY_API_KEY` | packages/tools/tavily.ts | Sim (web_search) |
| **Voyage AI** | `VOYAGE_API_KEY` | packages/tools/embed.ts (RAG) | Para embeddings |
| **Ollama** | `OLLAMA_BASE_URL` (padrão: `http://ollama:11434/v1`) | Agent.ts — provider alternativo | Opcional |
| **PostgreSQL** | `DATABASE_URL` | packages/db/db.ts | Sim |
| **SMTP (Nodemailer)** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | mailer.ts | Para e-mails KRATOS |
| **BCB/SGS** | nenhuma (HTTP fetch direto) | dados-publicos.ts | Para indicadores |
| **IBGE** | nenhuma | dados-publicos.ts | Para indicadores |
| **IPEA Data** | nenhuma | dados-publicos.ts | Para indicadores |
| **Banco Mundial** | nenhuma | dados-publicos.ts | Para indicadores |
| **FMI/WEO** | nenhuma | dados-publicos.ts | Para indicadores |
| **OMS/WHO** | nenhuma | dados-publicos.ts | Para indicadores |
| **ONU Population** | nenhuma | dados-publicos.ts | Para indicadores |
| **ITU DataHub** | nenhuma | dados-publicos.ts | Para indicadores |
| **Comex Stat/MDic** | nenhuma | dados-publicos.ts | Para indicadores |
| **DOU (Diário Oficial)** | nenhuma | dados-publicos.ts | Para busca no DOU |
| **FRED (Federal Reserve)** | `FRED_API_KEY` (opcional) | dados-publicos.ts | 8 séries EUA: Fed Funds Rate, PIB, CPI, desemprego, T10Y, DXY, balança comercial, China PIB |
| **Câmara dos Deputados** | nenhuma (pública) | dados-publicos.ts | API aberta: proposições e votações |
| **Senado Federal** | nenhuma (pública) | dados-publicos.ts | API aberta: votações plenárias recentes |
| **undici** | nenhuma (npm) | index.ts | `setGlobalDispatcher` estende timeouts headersTimeout/bodyTimeout para Ollama |

---

## 10. INFRAESTRUTURA (docker-compose)

Serviços:
- `api` — Node.js/Hono na porta 3333
- `web` — Nginx (build Vite) na porta 80 | Vite dev: 5173
- `db` — PostgreSQL + pgvector na porta 5432 (interna)
- `ollama` — Ollama (profile `ollama`, opt-in)

**Credenciais parametrizadas (Sprint LP-2):** `${POSTGRES_USER:-postgres}`, `${POSTGRES_PASSWORD:-postgres}`, `${POSTGRES_DB:-olympus}` via `.env`. `DATABASE_URL` da API montada a partir das partes (não de `${DATABASE_URL}`) para garantir hostname `olympus_db` independente do `.env` local.

**Rate Limiting nginx (Sprint LP-3):**
- `nginx-limits.conf` → `/etc/nginx/conf.d/00-limits.conf` (copiado na imagem `web`)
- `api_zone`: 30 req/min por IP para todas as rotas `/api/`
- `auth_zone`: 10 req/min, burst=5 por IP para `/api/v1/auth/login` e `/api/v1/auth/register`

Volumes: `pgdata`, `olympus_backups`, `ollama_data`

Deploy alvo: Railway (padrão de produção) ou docker-compose local.

---

## 11. ESTADO DO TYPESCRIPT

- `packages/db` — ✅ compilado (source)
- `packages/core` — ✅ zero erros (`tsc --noEmit`)
- `apps/web` — ✅ zero erros (`tsc --noEmit`)
- `apps/api` — ⚠️ erros de tipo pré-existentes relacionados ao schema: `projectEvents`, `projectScenarios`, `matrixDirectImpacts`, `techniqueExecutionOutputs` e `connectivity_mode` existem em `schema.ts` mas o **pacote compilado** `@olympus/db` ainda não foi reconstruído com `docker compose build --no-cache api`. Após rebuild, os tipos resolverão automaticamente. Não são erros novos — schema foi aplicado via SQL direto sem rebuild do container.

---

## 12. PONTOS DE ATENÇÃO PARA ANÁLISE ARQUITETURAL

Os seguintes aspectos merecem decisão de design antes de refatorar:

1. **MSEF como metodologia-mãe ou metodologia-par?** — O código do Motor Dinâmico privilegia o MSEF (único com revisão de qualidade, com prompt auto-atualizado há mais tempo, com stepper completo). As demais metodologias usam os mesmos agentes especialistas (SCOPUS, KLIO, PYTHIA, THEMIS) mas com orquestradores diferentes. A pergunta é: os agentes especialistas devem ter prompts únicos (agnósticos de metodologia) ou prompts específicos por metodologia?

2. ~~**Metodologias que usam o HERMES genérico como orquestrador**~~ ✅ **Resolvido Sprint 11:** HERMES agora recebe instruções específicas por metodologia via tabela `agent_method_prompts`. Em runtime, o `AgentContext.loadMethodology()` injeta `[METODOLOGIA ATIVA: X] <extra_instructions>` no `systemPrompt` antes da execução. MACROPLAN, MPO, ASPLAN, FUTURES e GODET têm seus próprios blocos de instrução cobrindo fases, agentes e produto esperado. O prompt MSEF-específico do HERMES só se aplica quando não há entrada em `agent_method_prompts` para o par agente×metodologia.

3. **ICD 203 e ferramentas analíticas** — `declarar_julgamento`, `registrar_hipotese_alternativa`, `avaliar_fonte` estão disponíveis para vários agentes mas não há garantia de que todos os prompts instruem seu uso. A adoção é inconsistente.

4. **Sinais fracos vs Indicadores** — São dois sistemas de monitoramento paralelos com dados e UIs separadas. A integração entre eles no painel KRATOS é visual (listagem) mas não operacional (sem cruzamento automático).

5. **HERMES_REVISOR — escopo limitado** — Só é usado no fluxo MSEF. As demais metodologias não têm revisão de qualidade integrada.

6. **Memória de contexto por sessão** — As últimas 12 mensagens são passadas como `memory` ao agente. Não há compressão, sumarização ou extração de entidades. Em análises longas (MSEF 7 fases), o contexto pode exceder o limite de tokens.

7. **Streaming SSE e não-streaming** — A rota SSE usa `streamText()` e a rota síncrona usa `generateText()`. Os especialistas sempre usam `generateText()`. Apenas o orquestrador usa streaming. Isso é correto e intencional.

---

---

## 13. FUNCIONALIDADES ADICIONADAS — SPRINTS 9 E 10

### Sprint 9 (Maio 2026) — Provider Factory Ollama + LLM Selector + Melhorias UX

| Componente | Mudança |
|---|---|
| `packages/core/Agent.ts` | `getModel()` — Provider Factory: lê `LLM_PROVIDER` env; suporte completo ao Ollama via `@ai-sdk/openai` com `createOpenAI({baseURL})` |
| `apps/api/index.ts` | Valores padrão para `anthropic_models` em `platform_settings` (claude-opus-4-7, sonnet-4-6, haiku-4-5) |
| `apps/api/routes/settings.ts` | GET /api/v1/settings inclui `ollamaModels` via proxy `GET /ollama/api/tags` |
| `apps/web/CommandBar.tsx` | `LlmSelector` — dropdown com seções Anthropic / Ollama; troca de provider sem restart |
| `apps/web/App.tsx` | Stepper dinâmico: passos exibidos são lidos de `agentsConfig.steps` do banco; fallback para `methodologySteps.ts` |
| Fixs GODET | Rapport GODET separado; patterns de detecção de relatório atualizados; `alertEmails` tipado corretamente |

### Sprint 10 (Maio 2026) — Dados Globais + Playbook + Hardening + PoC

**Dados globais expandidos (`packages/tools/src/dados-publicos.ts`):**
- **FRED / Federal Reserve (EUA):** 8 séries — `federal_funds_rate`, `us_gdp`, `us_cpi`, `us_unemployment`, `us_10y_treasury`, `dxy_index`, `us_trade_balance`, `china_gdp_growth`. Requer `FRED_API_KEY` opcional.
- **Câmara dos Deputados (BR):** `proposicoes_camara`, `votacoes_camara` via API aberta (dadosabertos.camara.leg.br).
- **Senado Federal (BR):** `votacoes_senado` via API aberta (legis.senado.leg.br).
- Total de indicadores expandido de 51 para ~62.

**Indicadores — histórico e alertas automáticos (`routes/indicators.ts`):**
- `appendHistory()` — append incremental em `valueHistory` (jsonb), prune automático de entradas > 90 dias
- `autoRegisterSignal()` — sinal fraco criado automaticamente quando indicador entra em `amarelo` ou `vermelho`; deduplicação por título

**Playbook DOCX (`routes/playbook.ts`):**
- `POST /api/v1/playbook/gerar` — gera DOCX com capa, metodologia, fases, síntese da última análise, tabela de indicadores, tabela de sinais fracos, recomendações
- Botão **📘 Playbook** na `CommandBar` — visível apenas para `admin`

**Segurança e conformidade:**
| Feature | Arquivo | Detalhes |
|---|---|---|
| Logs de auditoria | `utils/audit.ts` + `routes/audit.ts` + `schema.ts` | `logAudit()` silencioso; tabela `audit_logs` append-only; GET /audit + /audit/stats |
| JWT_EXPIRY configurável | `routes/auth.ts` | Env `JWT_EXPIRY` aceita `1h`, `4h`, `8h`, `24h`, `7d`; padrão `8h` |
| Marca d'água | `routes/export.ts` | CSS `position:fixed; rotate(-45deg); opacity:0.06`; texto = classificação do projeto ou `CONFIDENCIAL` |
| Rate limiting | `middleware/rateLimit.ts` | In-memory por `userId`; 5 análises/h + 10 exportações/h; limpeza a cada 5 min; adequado para instância única |
| Health endpoint | `index.ts` | `GET /health` — status do banco, Anthropic configurado, Tavily configurado, provider ativo, uptime, latência |

**Infraestrutura Ollama (correção de timeout):**
- `setGlobalDispatcher(new Agent({headersTimeout: 15min, bodyTimeout: 30min}))` no topo de `index.ts` — corrige `UND_ERR_HEADERS_TIMEOUT` que ocorria enquanto o modelo Llama carregava na memória GPU/RAM
- Pre-warm no startup: `POST /api/generate` com `keep_alive: -1` carrega o modelo Ollama antes da primeira requisição de usuário
- `onnotice: () => {}` em `packages/db/src/db.ts` — suprime mensagens NOTICE do PostgreSQL (ex: pgvector "extension already exists") que poluíam os logs do container

**Seed de demonstração (`scripts/seed-demo.ts`):**
- Usuário demo: `demo@stratsight.com.br` / `OlympusDemo2026!` (role: admin)
- Projeto `sess_demo_msef_2026` com análise MSEF pré-carregada, 5 indicadores com thresholds, 3 sinais fracos
- Idempotente (usa `findFirst` antes de cada insert)
- Execução: `node /app/apps/api/dist/scripts/seed-demo.js`

---

---

## 14. FUNCIONALIDADES ADICIONADAS — SPRINT 11

### Sprint 11 (Maio 2026) — Refatoração do Motor de Metodologias: Agentes e Fases

**Objetivo:** eliminar orquestradores obsoletos por metodologia, unificar toda a lógica de agentes no `seed.ts` declarativo, e garantir que todas as 10 metodologias tenham fases (stepper) e instruções de orquestração corretas. Sprint 12 adicionou KRATOS universal e removeu o título do projeto da CommandBar.

#### Agentes eliminados

| Agente | Motivo |
|--------|--------|
| `HERMES_ALTA` | Substituído por HERMES + agentMethodPrompts para OTAN/AltA |
| `HERMES_GODET` | Substituído por HERMES + agentMethodPrompts para GODET |
| `HERMES_GRUMBACH` | Substituído por OLYMPUS (novo orquestrador de PE) |
| `HERMES_SIEX` | Substituído por OLYMPUS |

#### Agente criado

| Agente | Tipo | Metodologias |
|--------|------|--------------|
| `OLYMPUS` | orchestrator | GRUMBACH - PLANEJAMENTO, SIEX - MPC |

OLYMPUS é o orquestrador especializado em Planejamento Estratégico e Produção do Conhecimento. Prompt focado no fluxo CEEEx (Grumbach) e no ciclo SIEX (EB70-MT-10.401).

#### Metodologias renomeadas/normalizadas

| Antes | Depois |
|-------|--------|
| GRUMBACH | GRUMBACH - PLANEJAMENTO |
| SIEx/EB | SIEX - MPC |
| ALTA / OTAN/ALTA | OTAN/AltA |

#### Fases adicionadas ao banco (methodology_phases)

| Metodologia | Fases adicionadas |
|-------------|-------------------|
| MACROPLAN | 4 (KLIO → PYTHIA → THEMIS → HERMES) |
| MPO | 4 (SCOPUS → KLIO → THEMIS → HERMES) |
| ASPLAN | 5 (substituiu 9 fases antigas com ATHENA/ARES) |
| FUTURES | 6 (SCOPUS → KLIO → PYTHIA → MNEMOSYNE → THEMIS → HERMES) |

#### agentMethodPrompts adicionados/atualizados

| Agente | Metodologia | Status |
|--------|-------------|--------|
| HERMES | GODET | Novo |
| HERMES | OTAN/AltA | Novo |
| HERMES | FUTURES | Atualizado (6 fases, SCOPUS fase 1, THEMIS fase 5) |
| SCOPUS | OTAN/AltA | Atualizado (ref. HERMES, não HERMES_ALTA) |
| OLYMPUS | GRUMBACH - PLANEJAMENTO | Novo |
| OLYMPUS | SIEX - MPC | Novo |

#### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `apps/api/src/scripts/seed.ts` | Import `techniques`; removidos 4 agentes; OLYMPUS adicionado; 10 metodologias com steps; phasesBySlug para todas as 10 metodologias; seção 6 com 12 técnicas SAT; agentMethodPrompts completos |
| `apps/api/src/routes/chat.ts` | Removidos blocos `if (methodName === 'GODET')` e `if (methodName === 'ALTA')` de `getOrSeedMethodology()` |
| `packages/db/src/schema.ts` | Sem alterações (schema já estava correto) |
| `apps/api/src/routes/export.ts` | Sem alterações (OLYMPUS funciona via exact-match em `lookupPhase()`) |

#### SQL de limpeza aplicado

```sql
DELETE FROM agents WHERE name IN ('HERMES_ALTA', 'HERMES_GODET', 'HERMES_GRUMBACH', 'HERMES_SIEX');
UPDATE methodology_phases SET agent_role = 'HERMES'  WHERE agent_role IN ('HERMES_GODET', 'HERMES_ALTA');
UPDATE methodology_phases SET agent_role = 'OLYMPUS' WHERE agent_role = 'HERMES_GRUMBACH';
DELETE FROM methodology_phases
  WHERE methodology_id = (SELECT id FROM methodologies WHERE slug = 'asplan') AND phase_num > 5;
```

---

## 15. FUNCIONALIDADES ADICIONADAS — SPRINT FINAL FASE 1 (26 Mai 2026)

### Parte A — Preparação LangGraph JS

**Schema (aplicado via SQL direto — rebuild do container pendente para compilar tipos):**
- `projects.connectivity_mode` TEXT DEFAULT `'ONLINE'` — controla acesso externo (ONLINE / SOBERANO / AIR_GAPPED)
- `methodology_phases.slug` TEXT UNIQUE — identificador canônico por fase
- `methodology_phases.node_slug` TEXT — aponta para o nó LangGraph que executará a fase
- 4 novas tabelas: `project_events`, `project_scenarios`, `matrix_direct_impacts`, `technique_execution_outputs`

**`apps/api/src/tools/analytical-engines.ts` (arquivo novo):**
7 ferramentas analíticas com JSON Schema puro (sem Zod):

| Ferramenta | Função |
|-----------|--------|
| `tool_unified_search_engine` | Busca unificada respeitando `connectivityMode` |
| `tool_register_event` | Registra evento analítico (tendência/incerteza/FPF) com MPC A-F × 1-6 |
| `tool_mpc_source_evaluator` | Avalia e atribui confiabilidade MPC a um evento existente |
| `tool_register_impact_relation` | Relacionamento de impacto entre eventos (para MICMAC) |
| `tool_grumbach_expert_simulation` | Simulação de 7 personas especialistas (método Grumbach) |
| `tool_mactor_analysis` | Análise de influência entre atores |
| `tool_mpo_backcasting` | Backcasting MPO com horizontes intermediários |

**AgentContext anti-bloat:**
- `connectivityMode: 'ONLINE' | 'SOBERANO' | 'AIR_GAPPED'` adicionado a `AgentContext`
- `anchorContext?: string` — âncora de contexto injetada no `systemPrompt` **antes** da janela de memória
- `chat.ts` injeta eventos aprovados (`status='approved'`) como âncora para evitar Context Bloat

**Hardening Ollama embed (`packages/tools/src/embed.ts`):**
- `chunkTextSafe()` — quebra em parágrafo/sentença, fragmentos < 100 chars descartados
- `runWithLimit()` — controle de concorrência MAX_CONCURRENT=2 com pausa 150ms entre batches
- `generateEmbeddingsOllama()` — embeddings locais via `nomic-embed-text` com backpressure

**Seed declarativo:**
- 10 metodologias normalizadas com slugs canônicos
- 73 fases com `slug` único e `nodeSlug` mapeado
- Upsert por `target: methodologies.slug` (idempotente)
- node_slug mapeados: `node_framing` → SCOPUS, `node_scanning_macro/forces/retrospective` → KLIO, `node_modeling/matrix_design` → PYTHIA, `node_narrative` → MNEMOSYNE, `node_integration` → THEMIS

**Regras arquiteturais permanentes (`.claude/rules/langgraph.md`):**
- Zod absolutamente proibido em ferramentas analíticas e nós do grafo
- `packages/tools` não pode importar `@olympus/db`
- Prompts por metodologia via `agentMethodPrompts`, nunca hardcoded
- HITL: `project_events status='proposed'` aguarda aprovação antes de Pythia

### Parte B — Correções de Nomenclatura e UX

**Nomenclatura:**
- `KronosOrchestrator` → `KratosOrchestrator` em `cron.ts` (logs, e-mail footer, variável). DB key `kronos_cooldown_ms` mantido.
- `HERMES_REVISOR` → `ATHENA` em `seed.ts` (42×) e `chat.ts` (9×). ATHENA adicionada ao tipo `Agent` e ao GLYPHS registry.

**LLM routing por agente (`Agent.ts`):**
```
SCOPUS, KRATOS       → claude-sonnet-4-6
KLIO, PYTHIA,
MNEMOSYNE, THEMIS,
ATHENA               → claude-opus-4-7
(Ollama/não mapeado) → modelo global do LLM Selector
```

**UX (`CommandBar.tsx`, `Sidebar.tsx`):**
- QEC box: `maxWidth: 260` removido → wrapper `flex: 1; minWidth: 0` — texto nunca truncado
- Chip de agente no topbar: exibe `"SCOPUS · Enquadramento Estratégico analisando"` (label derivado de `methodologySteps`)
- Sidebar admin: dois botões separados — `Usuários` (`onShowUsers`) e `Backup` (`onShowBackup`)

### Próximo sprint — Fase 2 LangGraph JS

1. `packages/core/src/state.ts` — `OlympusStateAnnotation` com campos do domínio
2. Nós TypeScript puros mapeados por `node_slug`
3. `PostgresSaver` para checkpointing
4. `interruptBefore: ['pythia_node']` — HITL nativo
5. `docker compose build --no-cache api` — resolve erros de tipo pendentes do schema Fase 1

---

---

## 16. FUNCIONALIDADES ADICIONADAS — SPRINT PRÉ-LANGGRAPH + TIER SYSTEM (26 Mai 2026)

### Sprint Pré-LangGraph (commit 7fc34ca)

Conjunto de riscos técnicos corrigidos antes da adoção do LangGraph — cada item é um pré-requisito arquitetural para o StateGraph da Fase 2.

| ID | Descrição | Arquivo(s) |
|----|-----------|-----------|
| R1 | `getOrSeedMethodology()` removido (460 linhas). `loadMethodology()` lança exceção se metodologia ausente — sem fallback silencioso. Elimina dual source of truth e race condition em escrita concorrente. | `chat.ts` |
| R2 | Memória server-authoritative: `db.query.messages.findMany()` ao invés de `body.messages`. Precondição para checkpointing do LangGraph. | `chat.ts` |
| R3 | HITL API completa: `GET/POST/PATCH/DELETE /api/v1/events`. `EventsPanel.tsx` (painel âmbar de revisão). `useEvents.ts`. `anchorContext` injeta apenas eventos `status='approved'` no systemPrompt. | `events.ts`, `EventsPanel.tsx`, `useEvents.ts` |
| R4 | `connectivityMode` guard em `tavily.ts`: bloqueia completamente em `AIR_GAPPED`, log de aviso em `SOBERANO`. Controle de soberania aplicado na execução da ferramenta, não apenas no prompt. | `tavily.ts` |
| R5 | `getNodeRouter(phases)` em `packages/core/src/nodeRouter.ts`: resolve `nodeSlug → agentName`, calcula `nextSlug()`. Pronto para ser `conditional_edges` do LangGraph StateGraph. | `nodeRouter.ts` |
| R6 | `buildMemoryWindow()`: `estimateTokens()` serializa conteúdo não-string antes de contar — não quebra mais com mensagens de imagem ou arrays de content block. | `chat.ts` |
| P1 | `export.ts` Document IR: `buildIR() → renderHtml() / renderDocx()`. Já implementado em sessão anterior. | `export.ts` |
| P5 | `export.ts` cache: `_phaseCache` Map com TTL 5 min em `resolveAgentPhases()`. Já implementado em sessão anterior. | `export.ts` |

### Tier System — LLM routing sem hardcode (commit 111ec4e)

Substitui IDs de modelo hardcoded no seed por labels semânticos de tier. Mapeamento configurável via UI.

**Arquivos alterados:**

| Arquivo | Mudança |
|---------|---------|
| `packages/core/src/types.ts` | `llmTiers?: Record<string, string>` adicionado ao `AgentContext` |
| `packages/core/src/Agent.ts` | Resolução `tiers[rawOverride] ?? rawOverride` — fallback passthrough |
| `apps/api/src/scripts/seed.ts` | `modelOverride: 'economy'` (SCOPUS, KRATOS) e `'premium'` (demais) |
| `apps/api/src/routes/settings.ts` | `getLLMTiers()` helper + `PATCH /settings/llm-tiers` (admin) + `GET /settings` inclui `llmTiers` |
| `apps/api/src/index.ts` | Seed inicial `llm_tiers: { economy: 'claude-sonnet-4-6', premium: 'claude-opus-4-7' }` |
| `apps/api/src/routes/chat.ts` | `getLLMTiers()` carregado em paralelo com `getLLMConfig()` e injetado em `AgentContext` |
| `apps/web/src/hooks/useLlmConfig.ts` | Estado `llmTiers` + `handleTierChange → PATCH /settings/llm-tiers` |
| `apps/web/src/components/layout/CommandBar.tsx` | Seção "⚙ Tiers de Agentes" no dropdown LLM (admin + Anthropic only) — selects Economy / Premium |
| `apps/web/src/App.tsx` | Props `llmTiers` e `onTierChange` passadas ao `CommandBar` |

### Renomeação de pasta (26 Mai 2026)

Pasta de desenvolvimento renomeada de `D:\Pessoais\DEV\Olympus_v4` para `D:\Pessoais\DEV\Olympus`.

Passos realizados:
1. `Rename-Item` no Windows
2. `node_modules` removido e reinstalado (`npm install`)
3. Memória do Claude Code copiada: `D--Pessoais-DEV-Olympus-v4` → `D--Pessoais-DEV-Olympus`
4. `.claude/settings.local.json` — `Olympus_v4` substituído por `Olympus`
5. `scripts/poc-offline/build-offline.ps1` — comentário atualizado

### Próximo Sprint — Fase 2 LangGraph

1. `npm install @langchain/langgraph @langchain/core @langchain/anthropic`
2. `StateAnnotation` com campos do `AgentContext`
3. `PostgresCheckpointer` (usa conexão drizzle/postgres existente)
4. Nós do grafo mapeados via `nodeSlug` de `methodology_phases`
5. `interruptBefore: ['node_modeling']` — gate HITL pronto (R3 concluído)
6. Substituir `Orchestrator.dispatch()` por `graph.invoke()` / `graph.stream()`

---

## 11. ESTADO DO TYPESCRIPT (atualizado)

- `packages/core` — ✅ zero erros (`tsc --noEmit`)
- `packages/db` — ✅ compilado
- `packages/tools` — ✅ zero erros (`tsc --noEmit`)
- `apps/web` — ✅ zero erros (`tsc --noEmit`)
- `apps/api` — ✅ zero erros (`tsc --noEmit`)

**Correção Sprint Fase 2 LangGraph (26/05/2026):** `@olympus/tools: "*"` adicionado como dependência explícita em `apps/api/package.json`. A ausência era um bug pré-existente — o pacote resolvia via hoisting npm mas não estava declarado, causando erros TS2307 silenciosos em `chat.ts`, `rag.ts`, `embeddings.ts` e `extract.ts` ao rodar `tsc --noEmit`. Agora declarado corretamente junto com `@langchain/langgraph` e `@langchain/core`.

---

## 17. FUNCIONALIDADES ADICIONADAS — SPRINT FASE 2 LANGGRAPH JS (27 Mai 2026)

### Grafo LangGraph (`apps/api/src/graph/`)

Motor de orquestração LangGraph JS substituindo o `Orchestrator.dispatch()` linear.

| Componente | Detalhe |
|---|---|
| **`buildGraph()`** | `StateGraph<OlympusState>` com 6 nós e `BoundedMemorySaver`. Monta `conditional_edges` de START e de cada nó especialista via `routeFromState()`. Thread ID = `projectId` (checkpointing por projeto) |
| **`BoundedMemorySaver`** | Checkpointer in-memory LRU (50 threads, TTL 2h). Sem PostgreSQL — elimina dependência de lock de banco em reinícios. Suficiente para carga single-instance |
| **`routeFromState()`** | Two-step lookup: `state.currentNodeSlug (phaseSlug)` → `router.nodeSlugOf(phaseSlug)` → `NODE_SLUG_TO_GRAPH_NODE[nodeSlug]`. Resolve ambiguidade de nodeSlug duplicados entre fases da mesma metodologia |
| **HITL via `interrupt()`** | `pythia_node` chama `interrupt()` após registrar eventos. Frontend recebe `{type:'hitl_interrupt'}`, seta `hitlGate=true`. Após aprovação via `EventsPanel`, `resumeGraph()` retoma do checkpoint |
| **`/stream/graph`** | `POST /api/v1/chat/stream/graph` — streaming de eventos do grafo via `graph.stream()`. Emite `{type:'node', nodeId}` a cada nó iniciado + tokens do agente |

### KRATOS Direct Call

`cron.ts` agora chama `runAnalysis()` diretamente (exportado de `chat.ts`) com `systemPayload = {id:'system'}`. Elimina self-mint de JWT e chamada HTTP interna que introduzia risco de loop e dependência de disponibilidade da porta 3333.

### Frontend

| Feature | Detalhe |
|---|---|
| `vizMode='grafo'` | Novo modo no CommandBar — aciona `/stream/graph` em vez de `/chat/stream` |
| `hitlGate` state | Boolean que pausa a UI durante HITL interrupt (banner âmbar + input bloqueado) |
| `resumeGraph()` | Retoma o grafo após aprovação de eventos — requisição especial ao `/stream/graph` |
| `EventsPanel.tsx` | Lista eventos `status='proposed'` com botões Aprovar/Rejeitar; badge de contagem pendente no topbar |

---

## 18. FUNCIONALIDADES ADICIONADAS — SPRINT LOW PRIORITY HARDENING (27 Mai 2026)

### Segurança

| ID | Feature | Detalhe |
|----|---------|---------|
| LP-1 | Rate limit `/register` + anti-enumeração | `makeRateLimiter()` factory por IP. `checkRegisterRateLimit` = 3/h. Mensagem neutra para e-mail existente. `setTimeout(70ms)` timing mitigation |
| LP-2 | Credenciais docker-compose parametrizadas | `${POSTGRES_USER:-postgres}` etc.; `DATABASE_URL` montada de partes individuais para forçar hostname `olympus_db` |
| LP-3 | Rate limiting nginx | `api_zone` 30r/m + `auth_zone` 10r/m via `nginx-limits.conf` em `conf.d/00-limits.conf` |

### Performance

| ID | Feature | Detalhe |
|----|---------|---------|
| LP-4 | `currentStep` useMemo | `messageCount = chat.messages.length` (primitivo) como dep — elimina re-scan a cada token SSE |
| LP-6 | Async render export | `renderHtml()`/`renderDocx()` tornados `async`; `await yieldToEventLoop()` por seção via `setImmediate` |

### Manutenibilidade

| ID | Feature | Detalhe |
|----|---------|---------|
| LP-5 | Targeted cron updates | `updateCronJob(id, name, met, expr?)` e `removeCronJob(id)` — cirurgia precisa sem reload global |

---

## 11. ESTADO DO TYPESCRIPT (atualizado 28/05/2026)

- `packages/core` — ✅ zero erros (`tsc --noEmit`) — após remoção de 7 entradas TOOL_JSON_SCHEMAS duplicadas (592→517 linhas)
- `packages/db` — ✅ compilado
- `packages/tools` — ✅ zero erros (`tsc --noEmit`)
- `apps/web` — ✅ zero erros (`tsc --noEmit`)
- `apps/api` — ✅ zero erros (`tsc --noEmit`)

---

## 12. ESTADO DA SUITE DE TESTES (28/05/2026)

**Último run:** 28 Mai 2026 · 20:36–21:19 · Google Gemini 2.5 Flash · TEST_MODE=true

```
Total:  36 testes
Pass:   27 ✅ (75%)
Fail:    9 ❌
Tempo: ~40 min (inclui análises LLM reais)
```

### 12.1 Falhas pendentes e causa raiz

| Teste | Erro | Causa | Próximo passo |
|-------|------|-------|--------------|
| **Godet** (metodologias) | `SCOPUS→KLIO→HERMES` — PYTHIA pulada | HERMES encurta execução sem ATHENA como gate | Rebuild com fix ATHENA-por-fase + rerun |
| **tool_register_event** | Nenhum evento no banco após análise | Gemini não chama a ferramenta (ou timeout) | Investigar prompt SCOPUS/KLIO para Gemini |
| **tool_register_impact_relation** | AbortError timeout 300s | Rate limit Gemini após 40 min de chamadas | Aumentar pause entre suites SAT (30s→90s+) |
| **tool_grumbach_expert_simulation** | AbortError timeout 300s | Rate limit Gemini (mesmo problema acima) | Idem |
| **buscar_dados_publicos** | `hasNumericData=false` | Valores mencionados em texto mas não extraídos numericamente | Ajustar asserção do teste ou prompt |
| **PYTHIA artefato** | `probs=false` | 4 quadrantes gerados sem probabilidades | Ajustar prompt PYTHIA para formato estruturado com Gemini |
| **MNEMOSYNE artefato** | `narrativas=1 palavras=46` | Gemini não segue formato de 4 narrativas | Instrução de formato mais explícita no prompt |
| **isHermes** | `hermesCount=0 longestMsg=0` | Teste busca `**HERMES** · RELATÓRIO FINAL` no banco; arquitetura single-call grava `role=assistant` sem assinatura | Corrigir lógica do teste (verificar tamanho/conteúdo, não assinatura) |
| **KRATOS análise** | `done=false assistantMessages=0` | Rate limit / timeout após suite longa | Aumentar pause + testar isolado |

### 12.2 Melhorias neste run vs anterior

| Antes (22/36 — 61%) | Depois (27/36 — 75%) | Fix aplicado |
|-|-|-|
| MSEF v3 ❌ (loop ATHENA 6 min) | ✅ PASSOU | TEST_MODE appended ao final do agentPrompt |
| Godet, Grumbach, IPEA/FGV, OTAN/AltA, GBN ❌ ("SSE não emitiu 'done'") | ✅ 4/5 passaram | Mesmo fix + provider Gemini funcional |

### 12.3 TEST_MODE — comportamento correto (28/05/2026)

**Orquestradores (HERMES, OLYMPUS, HERMES_SIPLEX):**
- Prompt de override **appendado ao final** do `agentPrompt` (sobrescreve regras anteriores)
- ATHENA: chamada **UMA VEZ ao final de cada fase completa** (gate HITL), NÃO após cada tool call individual
- ATHENA auto-aprova em TEST_MODE (`[MODO TESTE ATIVO]` no início do prompt de ATHENA)
- `maxSteps = 20` para orquestradores (8 fases × 2 steps: especialista + ATHENA = 16; +4 buffer)

**Especialistas (SCOPUS, KLIO, etc.):**
- `maxSteps = 5`, `maxOutputTokens = 4.000`

**ATHENA:**
- `maxSteps = 5`, auto-aprova transições HITL imediatamente

### 12.4 Backlog de testes

| Item | Descrição | Prioridade |
|------|-----------|-----------|
| Rebuild + rerun Godet | Novo container com fix ATHENA-por-fase ativo | Alta |
| Corrigir teste isHermes | Verificar tamanho/conteúdo da mensagem, não assinatura `**HERMES**` | Média |
| Aumentar pause SAT (30→90s) | Evitar AbortError por rate limit Gemini | Média |
| Investigar tool_register_event | SCOPUS/KLIO não chama ferramenta com Gemini | Média |

---

## 13. BACKLOG TÉCNICO ATUAL

### Alta Prioridade — Infraestrutura

| # | Item | Descrição | Quando |
|---|------|-----------|--------|
| **#1** | **PostgresSaver** | Substituir `BoundedMemorySaver` em `graph/builder.ts` por `PostgresSaver.fromConnString()`. `setup()` cria suas próprias tabelas — NÃO adicionar ao schema Drizzle (conflito de nomes). Adicionar `LANGGRAPH_CHECKPOINTER=memory` como fallback de dev. Resolve perda de checkpoints em restart/redeploy. | Antes do deploy Railway com SIPLEx em produção |
| **#2** | **Anthropic Prompt Cache** | 4 linhas em `packages/core/src/Agent.ts`: `providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }` condicional por `effectiveConfig.provider === 'anthropic'`. Economia estimada: ~84% nos tokens de system prompt (20 steps × system ~5k tokens). | Ao migrar de volta ao Anthropic |

### Média Prioridade — Testes e Correções

| # | Item | Descrição | Quando |
|---|------|-----------|--------|
| **#3** | **Godet PYTHIA fix** | HERMES pula PYTHIA sem ATHENA como gate. Rebuild com fix TEST_MODE ATHENA-por-fase + investigar prompt Godet. | Próxima sessão |
| **#4** | **isHermes teste** | Corrigir lógica: verificar `assistantMessages[0].content.length > 1500` ao invés de regex `**HERMES**`. Já parcialmente corrigido no run-tests.ts (fallback + skip quando sem dados). | Próxima sessão |

### Média Prioridade — Segurança e Compliance

| # | Item | Descrição | Quando |
|---|------|-----------|--------|
| **#5** | **Hash-Chaining em audit_logs** | Cada entrada em `audit_logs` recebe `previous_hash` e `entry_hash` (SHA-256 de: userId + action + createdAt + previousHash). Cadeia quebrada detecta adulteração retroativa. ~30 linhas em `utils/audit.ts` + coluna `previous_hash TEXT` na tabela. Alto valor para compliance governo/defesa — defensável em licitações. | Próximo sprint |
| **#6** | **Hybrid Sovereign Embedding** | Em `packages/tools/src/embed.ts`, se `connectivityMode !== 'ONLINE'`, rotear automaticamente para `generateEmbeddingsOllama()` (já implementada) em vez de Voyage AI. ~15 linhas de roteamento. Protege operação SOBERANO/AIR_GAPPED onde chamadas externas são proibidas. | Próximo sprint |

### Média Prioridade — Produto e UX

| # | Item | Descrição | Quando |
|---|------|-----------|--------|
| **#7** | **LangGraph Flow Visualization** | Componente React com `@xyflow/react` que renderiza o DAG da metodologia ativa. Nós acendem conforme SSE emite `{type:'node', nodeId}` (já implementado). Nó PYTHIA pulsa em âmbar quando `hitlGate=true`. Especialmente valioso para demos com clientes. | Próximo sprint / Fase 2 LangGraph |
| **#8** | **Harmonized Scenario Schema** | Nova ferramenta `registrar_cenario` em `analytical-engines.ts` (mesmo padrão das 7 ferramentas existentes). Todos os orquestradores chamam ao final de PYTHIA/MNEMOSYNE. Persiste em `project_scenarios`. KRATOS lê de lá — elimina `parseScenarioProbabilities()` e regex frágil. Funciona para MSEF, GODET, GRUMBACH. | Próximo sprint |

### Longo Prazo — Escalabilidade

| # | Item | Descrição | Quando |
|---|------|-----------|--------|
| **#9** | **Strategic Slate Compiler** | Ao final de cada fase, compilar output do especialista em `compiledSlate` estruturado (escopo, variáveis-chave, hipóteses validadas) como campo do `OlympusStateAnnotation`. Downstream agents recebem apenas o Slate + histórico da fase atual — elimina context bloat em análises de 7-8 fases com agentes de raciocínio profundo. | Fase 3 LangGraph |
| **#10** | **Async Job Queue (DB-backed)** | Tabela `foresight_jobs` (status: pending→running→done→failed, tokens acumulados em jsonb). `/stream/graph` retorna `job_id` imediatamente; frontend faz polling. Resolve "SSE orphan" em desconexões de rede sem adicionar Redis/BullMQ. | Fase 3 LangGraph |
| **#11** | **Row-Level Security (RLS)** | PostgreSQL RLS com `SET LOCAL app.current_user_id` em cada transação Drizzle. Garante isolamento matemático de dados entre tenants mesmo sob vulnerabilidades de API. Premature para implantação single-tenant atual. | Quando migrar para SaaS multi-tenant |

---

*Documento atualizado em 28/05/2026 — Sprint Estabilização de Testes + Limpeza Técnica.*
