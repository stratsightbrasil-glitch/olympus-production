# ESTADO ATUAL DO OLYMPUS v4
**Documento técnico para revisão de design — atualizado em 23/05/2026 (Sprint 11)**
**Gerado por:** Claude Code (análise estática do código-fonte + execução do seed)
**Destinatário:** Claude Chat — análise arquitetural e produção de guia de refatoração

---

## 1. ESTRUTURA DE ARQUIVOS

```
Olympus_v4/
├── apps/
│   ├── api/                        # Backend Node.js — Hono framework
│   │   └── src/
│   │       ├── index.ts            # Entry point, CORS, JWT, rotas, startup SQL (148 linhas)
│   │       ├── mailer.ts           # Nodemailer — envio de e-mails SMTP
│   │       ├── cron.ts             # KRONOS — agendador de análises autônomas (149 linhas)
│   │       ├── routes/
│   │       │   ├── chat.ts         # Motor principal de análise — Motor Dinâmico ⚠️
│   │       │   ├── export.ts       # Exportação DOCX/PDF/HTML/Estimativa (marca d'água CONFIDENCIAL)
│   │       │   ├── kratos.ts       # API do painel KRATOS
│   │       │   ├── sessions.ts     # CRUD de sessões/projetos
│   │       │   ├── settings.ts     # Configuração LLM — GET/PATCH
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
│   │       │   ├── technique-engine.ts  # SAT Engine — injeção de prompts (262 linhas)
│   │       │   ├── analytic-standards.ts # Ferramentas ICD 203 (196 linhas)
│   │       │   ├── signals.ts      # Ferramentas de sinais fracos (161 linhas)
│   │       │   └── rag.ts          # Retrieval-Augmented Generation (68 linhas)
│   │       └── scripts/
│   │           ├── seed.ts         # Seed manual do banco — agentes/metodologias (303 linhas)
│   │           └── seed-demo.ts    # Seed de demonstração (PoC) — idempotente
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
    │       ├── Agent.ts            # Execução individual de agentes (353 linhas)
    │       ├── Orchestrator.ts     # Roteamento entre agentes (19 linhas)
    │       ├── types.ts            # Interfaces AgentContext, Tool (22 linhas)
    │       └── index.ts            # Reexporta tudo
    ├── db/                         # ORM Drizzle + PostgreSQL
    │   └── src/
    │       ├── schema.ts           # Definição das tabelas (163 linhas)
    │       ├── db.ts               # Conexão postgres
    │       └── index.ts            # Reexporta tudo
    └── tools/                      # Ferramentas externas (npm workspace)
        └── src/
            ├── tavily.ts           # Busca web via Tavily API
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
| **HERMES_REVISOR** | expert | Todas (chamado pelo orquestrador) | avaliar_fonte, declarar_julgamento, registrar_hipotese_alternativa |

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

```
POST /api/v1/chat (com SSE)
  └─ runAnalysis()
       ├─ getOrSeedMethodology() → carrega/atualiza metodologia e agentes no banco
       ├─ Cria Orchestrator + registra agentes com ferramentas
       ├─ Constrói AgentContext { projectId, methodology, memory (últimas 12 msgs), llmConfig, callbacks }
       ├─ Orquestrador.run() → Agent.run() com streamText()
       │    ├─ tool: consultar_agente(agent_name, query)
       │    │    └─ context.dispatch(agentName, query)
       │    │         └─ Especialista.run(query, context) com generateText()
       │    │              └─ Ferramentas: web_search, buscar_dados_publicos, etc.
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

## 5. ROTEAMENTO ANTHROPIC / OLLAMA

### 5.1 Fluxo completo da configuração

```
DB: platform_settings (key='llm', value={"provider":"anthropic","model":"claude-opus-4-7"})
  ↓
getLLMConfig() [settings.ts] — lê do banco a cada análise, fallback para .env
  ↓
runAnalysis() [chat.ts] — const llmConfig = await getLLMConfig()
  ↓
AgentContext.llmConfig = { provider, model }
  ↓
Agent.run(input, context) → getModel(context.llmConfig)
  ↓ se provider = 'anthropic'      ↓ se provider = 'ollama'
anthropic(modelName)         createOpenAI({baseURL, apiKey:'ollama'})(modelName)
[Anthropic SDK]              [OpenAI SDK — compatível com Ollama /v1]
```

### 5.2 Parâmetros que mudam entre providers

| Parâmetro | Anthropic | Ollama |
|-----------|-----------|--------|
| SDK | `@ai-sdk/anthropic` | `@ai-sdk/openai` com `createOpenAI({baseURL})` |
| apiKey | ANTHROPIC_API_KEY (env) | String literal `'ollama'` |
| baseURL | (padrão Anthropic) | OLLAMA_BASE_URL (padrão: `http://ollama:11434/v1`) |
| maxTokens | 32000 (thinking/etapa) ou 16000 (passagem) | Igual |
| toolChoice | prepareStep: required no step 0 | Igual |
| stopWhen | stepCountIs(15) | Igual |

### 5.3 Troca de provider em runtime

- **Leitura:** GET /api/v1/settings → `{ llm: {provider, model}, anthropicModels: [...], ollamaModels: [...] }`
- **Escrita:** PATCH /api/v1/settings/llm (admin only) → upsert em `platform_settings`
- **Efeito:** próxima análise já usa o novo provider (sem restart)
- **UI:** `LlmSelector` em `CommandBar.tsx` — dropdown com seção Anthropic e seção Ollama

### 5.4 Modelos disponíveis no seletor

- **Anthropic:** `claude-opus-4-7`, `claude-sonnet-4-5`, `claude-haiku-4-5` (hardcoded em settings.ts)
- **Ollama:** dinâmico — GET /ollama-models → proxy para `http://ollama:11434/api/tags`

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
- Rate limit: 15s entre projetos na fila (hardcoded)
- Webhook opcional para n8n (falha silenciosa se offline)

### 7.3 Parser de probabilidades de cenário

`parseScenarioProbabilities(text)` — regex para padrões `Q1... 40%` ou `Cenário 1... 40%`. Funciona para MSEF (Matriz 2x2 Q1-Q4). Não funciona para GODET/GRUMBACH que têm nomenclatura diferente.

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

### 8.3 Janela de memória por contagem, não por tokens

```typescript
// chat.ts linha ~851
memory: body.messages ? body.messages.slice(0, -1).slice(-12) : []
```
Fixo em 12 mensagens independente do tamanho. Uma análise MSEF completa tem 10+ mensagens longas, cada uma com milhares de tokens.

### 8.4 Detecção de agente hardcoded em 3 lugares

- `detectAgent()` em `export.ts` — lista ordenada de nomes
- `DOCX_AGENT_MARKER_RE` em `export.ts` — regex com nomes
- `KNOWN_AGENTS` em `export.ts` — lista de nomes para strip
- `isHermes()` em `App.tsx` — verifica `**HERMES**` literal
- Adicionar um novo orquestrador exige atualizar todos esses pontos

### 8.5 Mapeamento agente→fase hardcoded em 2 builders independentes

`PHASE_LABELS` / `PHASE_COLORS` em `buildHtml()` e `DOCX_PHASE_LABELS` em `buildDocx()` são mapeamentos separados que devem ser mantidos em sincronia manualmente.

### 8.6 Parser markdown duplicado

`buildHtml()` e `buildEstimativaHtml()` têm parsers markdown→HTML independentes (~70 linhas cada). A lógica é quase idêntica mas com pequenas diferenças, tornando manutenção dupla.

### 8.7 `parseScenarioProbabilities()` — regex específica para MSEF

Só reconhece padrões `Q1/Q2/Q3/Q4` ou `Cenário 1-4`. GODET usa cenários morfológicos com nomes arbitrários. GRUMBACH usa Tendencial/Pessimista/Otimista. Painel KRATOS não mostra probabilidades para essas metodologias.

### 8.8 `platform_settings` — migrada para o schema Drizzle ✅

~~A tabela era criada via `CREATE TABLE IF NOT EXISTS` raw SQL no startup.~~ **Corrigido no Sprint 4:** `platform_settings` agora está em `schema.ts` e é gerenciada pelo Drizzle ORM. O startup usa `db.insert(platformSettings).onConflictDoNothing()` para inicializar valores padrão sem sobrescrever customizações.

### 8.9 Modelos Anthropic disponíveis hardcoded em `settings.ts`

```typescript
export const ANTHROPIC_MODELS = [
  { id: 'claude-opus-4-7', label: 'Claude Opus 4' },
  ...
]
```
Atualizar modelos requer alterar o código-fonte.

### 8.10 Schemas JSON de ferramentas duplicados em `Agent.ts`

`TOOL_JSON_SCHEMAS` em `Agent.ts` contém as definições de schema de todas as ferramentas (consultar_agente, web_search, buscar_dados_publicos, etc.) — ~180 linhas. Cada ferramenta também tem seu schema em seu próprio arquivo. Existe risco de divergência.

### 8.11 Rate limit KRONOS hardcoded

```typescript
await new Promise(r => setTimeout(r, 15000)); // 15s entre projetos
```
Não configurável sem alterar o código.

### 8.12 Prompt do HERMES_REVISOR faz revisão apenas do MSEF

O HERMES_REVISOR é definido no Motor Dinâmico do MSEF e acoplado ao fluxo MSEF. Outras metodologias não têm revisão integrada de qualidade analítica.

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
- `web` — Vite React na porta 8080
- `db` — PostgreSQL com pgvector
- `ollama` — Ollama (profile `ollama`, opt-in)

Volumes: `postgres_data`, `ollama_data`

Deploy alvo: Railway (padrão de produção) ou docker-compose local.

---

## 11. ESTADO DO TYPESCRIPT

- `packages/db` — ✅ compilado, `alertEmails` presente no `.d.ts`
- `packages/core` — ✅ compilado, `llmConfig` presente no `.d.ts`
- `apps/api` — ✅ zero erros
- `apps/web` — ✅ zero erros

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

*Documento atualizado por análise estática + execução do seed em 23/05/2026.*
