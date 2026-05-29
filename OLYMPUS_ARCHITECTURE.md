# OLYMPUS v4.0 — Documentação de Arquitetura
**StratSight Brasil · Strategic Foresight · IA Agêntica**

<!-- AUTO:versao:START -->
**Versão:** `4.0.0` · **Atualizado:** 29 de maio de 2026 · Gerado automaticamente

| Dependência | Versão |
|-------------|--------|
| `drizzle-orm` | `^0.45.2` |
| `typescript` | `^5.4.5` |
<!-- AUTO:versao:END -->

---

## 1. Rotas da API

<!-- AUTO:rotas:START -->
| Método | Path | Auth | Função | Arquivo |
|--------|------|------|--------|---------|
| GET    | `/api/v1/` | Público | Query params: userId, action, resourceType, from (ISO date), to (ISO date), limit (default 100), offset (default 0) | audit.ts |
| POST   | `/api/v1/` | Público | Cria recurso | chat.ts |
| DELETE | `/api/v1/:id` | Público | ── DELETE /events/:id ───────────────────────────────────────────────────────── | events.ts |
| GET    | `/api/v1/:id` | Público | Lista/busca :id | sessions.ts |
| PATCH  | `/api/v1/:id` | Público | ── PATCH /events/:id — atualização geral (sourceEvaluation, name, description) ─ | events.ts |
| PUT    | `/api/v1/:id/members` | Público | Substitui todos os membros da equipe (array de { userId, role }) | teams.ts |
| DELETE | `/api/v1/:id/members/:userId` | Público | ── DELETE /api/v1/teams/:id/members/:userId ────────────────────────────────── | teams.ts |
| GET    | `/api/v1/:id/messages` | Público | SEGURANÇA: aplica o mesmo filtro de ownership que GET /:id — previne IDOR. | sessions.ts |
| DELETE | `/api/v1/:id/messages/:msgId` | Público | Remove :id | sessions.ts |
| PATCH  | `/api/v1/:id/status` | Público | ── PATCH /events/:id/status — aprovação / rejeição pelo analista ────────────── | events.ts |
| POST   | `/api/v1/:id/webhook` | Público | Cria :id | sessions.ts |
| DELETE | `/api/v1/:projectId` | Público | Remove todos os embeddings de um projeto (ex: antes de re-indexar) | embeddings.ts |
| GET    | `/api/v1/:projectId` | Público | GET /api/v1/reviews/:projectId — última revisão do projeto | reviews.ts |
| GET    | `/api/v1/:projectId/count` | Público | GET /api/v1/embeddings/:projectId/count | embeddings.ts |
| GET    | `/api/v1/:projectId/dashboard` | Público | Lista/busca :projectId | kratos.ts |
| POST   | `/api/v1/:projectId/report` | Público | Cria :projectId | kratos.ts |
| GET    | `/api/v1/:projectId/report/html` | Público | Lista/busca :projectId | kratos.ts |
| POST   | `/api/v1/2fa/enable` | Público | Cria 2fa | auth.ts |
| POST   | `/api/v1/2fa/generate` | Público | userId derivado do token JWT — nunca da payload do request (previne IDOR/escalada). | auth.ts |
| PATCH  | `/api/v1/anthropic-models` | Público | ── PATCH /api/v1/settings/anthropic-models ── atualiza lista sem rebuild ────── | settings.ts |
| PATCH  | `/api/v1/batch/status` | Público | ── PATCH /events/batch/status — aprovação em lote ──────────────────────────── | events.ts |
| POST   | `/api/v1/docx` | Público | Cria docx | export.ts |
| GET    | `/api/v1/download/:filename` | Público | Lista/busca download | backup.ts |
| POST   | `/api/v1/estimativa` | Público | Cria estimativa | export.ts |
| POST   | `/api/v1/generate` | Público | Cria generate | backup.ts |
| POST   | `/api/v1/gerar` | Público | ── POST /api/v1/playbook/gerar ────────────────────────────────────────────── | playbook.ts |
| POST   | `/api/v1/index` | Público | Body: { projectId, text, filename?, source?, chunkSize? } | embeddings.ts |
| POST   | `/api/v1/install` | Público | Endpoint de Upload/Instalação do Motor (engine.json) | engine.ts |
| GET    | `/api/v1/kratos-cooldown` | Público | ── GET /api/v1/settings/kratos-cooldown ───────────────────────────────────── | settings.ts |
| PATCH  | `/api/v1/kratos-cooldown` | Público | ── PATCH /api/v1/settings/kratos-cooldown ──────────────────────────────────── | settings.ts |
| GET    | `/api/v1/list` | Público | Lista/busca list | backup.ts |
| PATCH  | `/api/v1/llm` | Público | ── PATCH /api/v1/settings/llm ── altera provedor LLM (admin only) ───────────── | settings.ts |
| PATCH  | `/api/v1/llm-tiers` | Público | ── PATCH /api/v1/settings/llm-tiers ── mapeia tier labels → model IDs (admin) ─ | settings.ts |
| POST   | `/api/v1/login` | Público | Cria login | auth.ts |
| GET    | `/api/v1/methodologies` | Público | Retorna dados completos incluindo steps derivados de methodology_phases (banco) | engine.ts |
| GET    | `/api/v1/ollama-models` | Público | ── GET /api/v1/settings/ollama-models ── mantido para compatibilidade ──────── | settings.ts |
| GET    | `/api/v1/openapi.json` | Público | Serve OpenAPI JSON | docs.ts |
| POST   | `/api/v1/pdf` | Público | Cria pdf | export.ts |
| GET    | `/api/v1/project/:projectId` | Público | Listar indicadores de um projeto (Usado pelo Painel e pelo KRATOS) | indicators.ts |
| POST   | `/api/v1/register` | Público | Cria register | auth.ts |
| GET    | `/api/v1/setup-status` | Público | Lista/busca setup-status | auth.ts |
| GET    | `/api/v1/stats` | Público | GET /api/v1/audit/stats — resumo por ação (admin only) | audit.ts |
| POST   | `/api/v1/stream` | Público | Cria stream | chat.ts |
| POST   | `/api/v1/stream/graph` | Público | Cria stream | chat.ts |
| GET    | `/api/v1/techniques` | Público | Endpoint para listar técnicas SAT disponíveis | engine.ts |
<!-- AUTO:rotas:END -->

---

## 2. Schema do Banco de Dados

<!-- AUTO:schema:START -->
| Tabela | Colunas principais |
|--------|--------------------|
| `users` | id, name, email, passwordHash, role... (+3) |
| `methodologies` | id, name, slug, description, sourceDoc... (+4) |
| `techniques` | id, name, description, instructions, toolsConfig... (+1) |
| `tools` | id, name, description, schemaJson, createdAt |
| `agents` | id, name, role, type, systemPrompt... (+4) |
| `projects` | id, name, client, analyst, horizon... (+16) |
| `messages` | id, projectId, role, content, filesJson... (+4) |
| `embeddings` | id, projectId, chunkText, metadata, embedding... (+1) |
| `analytic_reviews` | id, projectId, reviewerId, reviewerName, reviewedAt... (+7) |
| `weak_signals` | id, projectId, titulo, descricao, tipo... (+25) |
| `indicators` | id, projectId, name, source, parametersJson... (+7) |
| `audit_logs` | id, userId, userName, action, resourceType... (+4) |
| `platform_settings` | key, value, updatedAt |
| `methodology_types` | id, methodologyId, category |
| `methodology_phases` | id, methodologyId, phaseNum, label, agentRole... (+3) |
| `phase_techniques` | phaseId, techniqueId, priority |
| `agent_method_prompts` | id, agentId, methodologyId, extraInstructions |
| `teams` | id, name, description, createdAt |
| `team_members` | teamId, userId, role |
| `project_events` | id, projectId, name, description, type... (+4) |
| `project_scenarios` | id, projectId, name, description, probability... (+3) |
| `matrix_direct_impacts` | id, projectId, fromEventId, toEventId, impactScore... (+1) |
| `technique_execution_outputs` | id, projectId, techniqueType, outputData, metadata... (+1) |
<!-- AUTO:schema:END -->

---

## 3. Agentes

<!-- AUTO:agentes:START -->
| Agente | Tipo | Tier | Modelo Efetivo |
|--------|------|------|---------------|
| **HERMES** | orchestrator | `global` | LLM Selector |
| **OLYMPUS** | orchestrator | `global` | LLM Selector |
| **HERMES_SIPLEX** | orchestrator | `global` | LLM Selector |
| **SCOPUS** | expert | `economy` | claude-sonnet-4-6 |
| **KLIO** | expert | `premium` | claude-opus-4-7 |
| **PYTHIA** | expert | `premium` | claude-opus-4-7 |
| **MNEMOSYNE** | expert | `premium` | claude-opus-4-7 |
| **THEMIS** | expert | `premium` | claude-opus-4-7 |
| **KRATOS** | expert | `economy` | claude-sonnet-4-6 |
| **ATHENA** | expert | `premium` | claude-opus-4-7 |
<!-- AUTO:agentes:END -->

### 3.1 Papéis e Responsabilidades

| Agente | Papel | Ferramentas SAT |
|--------|-------|-----------------|
| **HERMES** | Orquestrador geral — coordena a sequência das fases para qualquer metodologia prospectiva | — |
| **HERMES_SIPLEX** | Orquestrador para metodologias de planejamento estratégico (SIPLEx/CEEEx, ASPLAN) | — |
| **OLYMPUS** | Orquestrador de monitoramento contínuo (KRATOS reports) | — |
| **SCOPUS** | Enquadramento do problema — KAC, escopo, filtro Hendrikson | `tool_register_event` |
| **KLIO** | Varredura ambiental — PESTEL, megatendências, FPFs, trajetória histórica | `tool_register_event` |
| **PYTHIA** | Modelagem quantitativa — MICMAC, ACH, Matriz 2×2, probabilidades | `tool_register_impact_relation`, `tool_grumbach_expert_simulation` |
| **MNEMOSYNE** | Narrativas de cenários — travas probabilísticas, gatilhos, morfologia | — |
| **THEMIS** | Julgamento estratégico — alertas precoces, hedges/bets, backcasting, ICD | `declarar_julgamento_icd`, `tool_mpo_backcasting`, `buscar_dados_publicos` |
| **KRATOS** | Monitoramento de indicadores — análise de tendências, alertas, dashboard | — |
| **ATHENA** | Revisão de qualidade — validação inter-fases (HITL gate, desativada em TEST_MODE) | — |

### 3.2 Ferramentas Analíticas (SAT — Structured Analytical Techniques)

As ferramentas SAT ficam em `apps/api/src/tools/analytical-engines.ts` e são instanciadas via fábrica **`createAnalyticalEngineTools`**, que:

1. Recebe o `projectId` atual como parâmetro de closure.
2. Converte cada `OlympusTool` (campo `parameters`) para `Tool<any>` do AI SDK (campo `schema`).
3. Remove o `projectId` do schema exposto ao LLM (o agente não precisa informá-lo).
4. Injeta o `projectId` automaticamente na execução de cada ferramenta.

```
OlympusTool { parameters: JSONSchema }
       ↓  createAnalyticalEngineTools(projectId)
Tool<any> { schema: JSONSchema sem projectId, execute: (args) => fn({ ...args, projectId }) }
```

| Ferramenta | Agente(s) | Persistência |
|-----------|-----------|-------------|
| `tool_register_event` | SCOPUS, KLIO | `project_events` |
| `tool_register_impact_relation` | PYTHIA | `matrix_direct_impacts` |
| `tool_grumbach_expert_simulation` | PYTHIA | resposta inline |
| `declarar_julgamento_icd` | THEMIS | `weak_signals` |
| `tool_mpo_backcasting` | THEMIS | resposta inline |
| `buscar_dados_publicos` | THEMIS | resposta inline |
| `sat_advocacia_diabo` | qualquer | resposta inline |

---

## 4. Metodologias

<!-- AUTO:metodologias:START -->
| Metodologia | Orquestrador | Fases | Categoria | Agentes |
|-------------|-------------|-------|-----------|---------|
| Grumbach: Produção de Cenários | HERMES | 9 | Cenários Prospectivos |  |
| Godet: Escola Estrutural | HERMES | 7 | Cenários Prospectivos |  |
| MPC: Conhecimento Estimativa EB | HERMES | 6 | Produção do Conhecimento |  |
| SIPLEx/CEEEx: Cenários da Força Terrestre | HERMES | 8 | Planejamento Estratégico |  |
| ASPLAN/MD: Planejamento Setorial de Defesa | HERMES | 7 | Planejamento Estratégico |  |
| MSEF v3 (8 etapas ENAP) | HERMES | 8 | Cenários Prospectivos |  |
| OTAN/AltA | HERMES | 5 | Cenários Prospectivos |  |
| IPEA/FGV: Cenários Estreitados de Desenvolvimento | HERMES | 7 | Cenários Prospectivos |  |
| MPO: Estratégia Brasil 2050 | HERMES | 8 | Planejamento Estratégico |  |
| ESG: Cenários Prospectivos | HERMES | 6 | Cenários Prospectivos |  |
| GBN (Global Business Network - Peter Schwartz) | HERMES | 8 | Cenários Prospectivos |  |
<!-- AUTO:metodologias:END -->

---

## 5. Técnicas SAT

<!-- AUTO:tecnicas:START -->
| # | Nome | Descrição |
|---|------|-----------|
| 1 | Advocacia do Diabo | Um analista assume o papel de crítico e constrói o melhor argumento possível con |
| 2 | Análise Pré-Mortem | Simula mentalmente o fracasso de um plano ou análise e trabalha retrospectivamen |
| 3 | Análise E-Se | Assume que um evento (positivo ou negativo) já ocorreu e explora como poderia te |
| 4 | Análise SWOT | Avalia forças, fraquezas, oportunidades e ameaças de um projeto, decisão ou estr |
| 5 | Cinco Porquês | Identifica a causa-raiz de um problema perguntando "por quê?" cinco vezes, quebr |
| 6 | Verificação de Qualidade da Informação | Avalia a completude, precisão, credibilidade e confiabilidade das fontes de info |
| 7 | PMI — Prós, Contras e Pontos Interessantes | Técnica rápida que avalia os aspectos positivos, negativos e interessantes de um |
| 8 | Adversário Substituto | Modela o comportamento de atores externos (adversários, competidores, neutros) r |
| 9 | Time A / Time B | Dois grupos debatem hipóteses ou posições opostas diante de um júri neutro, expo |
| 10 | Pensamento de Fora para Dentro | Aborda um problema da perspectiva externa, mapeando forças externas que moldam a |
| 11 | Identificação de Premissas-Chave | Identifica sistematicamente as premissas que sustentam o raciocínio e avalia qua |
| 12 | Futuros Alternativos | Explora sistematicamente múltiplas formas em que uma situação complexa e incerta |
<!-- AUTO:tecnicas:END -->

---

## 6. Arquitetura Multi-Agente — Fluxo de Execução

### 6.1 Ciclo de uma Análise (rota POST /api/v1/stream)

```
Cliente HTTP
    │
    ▼
POST /api/v1/stream  { projectId, agentName, message }
    │
    ├─ Autenticação JWT (role: analista | admin)
    ├─ Carrega projeto, metodologia, fases (methodology_phases)
    ├─ Carrega agente pelo nome (tabela agents)
    ├─ Resolve model_override → effectiveConfig (ver §7)
    ├─ Injeta anchorContext no systemPrompt
    ├─ Se TEST_MODE=true e orchestrator → appenda prompt de sequência direta
    │
    ▼
streamText (Vercel AI SDK)
    │  { model: effectiveConfig, tools: [...SAT, ...specialists] }
    │
    ├─ Especialista chamado como ferramenta?
    │   ├─ Sim → instancia agente filho recursivamente (mesmo pipeline)
    │   │         resultado retorna como tool result
    │   └─ Não → executa SAT tool diretamente (banco ou inline)
    │
    ▼
SSE stream → cliente
    │  eventos: text, tool_call, tool_result, done
    │
    ▼
Persistência: messages (role=assistant, content=relatório final)
              project_events / matrix_direct_impacts / weak_signals (via tools)
```

### 6.2 Sequência Padrão — MSEF v3 (8 etapas ENAP)

```
HERMES (orquestrador)
  ├─ tool_call → SCOPUS   (fase 1: enquadramento + KAC)
  │   └─ tool_register_event ×N
  ├─ tool_call → KLIO     (fase 2: varredura PESTEL + FPFs)
  │   └─ tool_register_event ×N
  ├─ tool_call → PYTHIA   (fase 3: MICMAC + Matriz 2×2)
  │   ├─ tool_register_impact_relation ×N
  │   └─ tool_grumbach_expert_simulation
  ├─ tool_call → MNEMOSYNE (fase 4: narrativas)
  ├─ tool_call → THEMIS   (fase 5: alertas + hedges/bets)
  │   └─ declarar_julgamento_icd ×N
  └─ Relatório final inline (≥1500 palavras)
```

> **Nota TEST_MODE**: ATHENA é desativada explicitamente. HERMES avança direto para o próximo especialista após cada tool result.

### 6.3 Persistência de Mensagens

O sistema usa arquitetura **single-call**: apenas **2 mensagens** são gravadas no banco por análise completa:

| Role | Conteúdo | Quando |
|------|----------|--------|
| `user` | pergunta original do analista | imediatamente ao receber o request |
| `assistant` | relatório final completo (HERMES) | após `finish_reason: stop` |

Mensagens intermediárias (tool calls/results, sub-agentes) ficam **apenas no contexto em memória** da chamada SSE e não são persistidas.

---

## 7. Sistema de Roteamento LLM (Provider + Tier)

### 7.1 Fluxo de Resolução de Modelo

```
agents.model_override (ex: "economy" | "premium" | null)
        │
        ├─ null → usa platform_settings.llm.model diretamente
        │
        └─ "economy" | "premium"
                │
                ▼
        platform_settings.llm_tiers[label]
        ex: { economy: "gemini-2.5-flash-lite", premium: "gemini-2.5-flash" }
                │
                ▼
        effectiveConfig = {
          provider: platform_settings.llm.provider,  // "google" | "anthropic" | "groq"
          model:    resolvedModelId
        }
```

> ⚠️ **Regra crítica**: `llm_tiers` armazena IDs **específicos do provider**. Ao trocar `llm.provider`, os IDs em `llm_tiers` TAMBÉM devem ser atualizados. IDs Anthropic com provider Google causam HTTP 404.

### 7.2 Providers Suportados

| Provider | `llm.provider` | SDK | Modelos padrão |
|----------|----------------|-----|---------------|
| Anthropic | `"anthropic"` | `@ai-sdk/anthropic` | `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-7` |
| Google Gemini | `"google"` | `@ai-sdk/google` | `gemini-2.5-flash`, `gemini-2.5-flash-lite` |
| Groq | `"groq"` | `@ai-sdk/groq` | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant` |
| Ollama | `"ollama"` | SDK custom | modelos locais |

### 7.3 Modelos Google Disponíveis (verificado 28 Mai 2026)

```bash
# Dentro do container:
docker exec olympus_api node -e "
const https = require('https');
const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
https.get('https://generativelanguage.googleapis.com/v1beta/models?key=' + key, res => {
  let data = ''; res.on('data', c => data += c);
  res.on('end', () => JSON.parse(data).models.forEach(m => {
    if(m.name.includes('flash')) console.log(m.name);
  }));
});"
```

| Modelo | Status | Uso recomendado |
|--------|--------|----------------|
| `gemini-2.5-flash` | ✅ Ativo | Orquestradores + especialistas premium |
| `gemini-2.5-flash-lite` | ✅ Ativo | Especialistas economy |
| `gemini-2.0-flash` | ❌ Descontinuado para novas chaves | — |
| `gemini-2.5-flash-preview-05-20` | ❌ Não encontrado via v1beta | — |

### 7.4 Atualizar Provider (procedimento)

```sql
-- 1. Atualizar provider + modelo padrão
UPDATE platform_settings SET value = '{"model":"gemini-2.5-flash","provider":"google"}'::jsonb
WHERE key = 'llm';

-- 2. OBRIGATÓRIO: Atualizar tiers com IDs do novo provider
UPDATE platform_settings SET value = '{"economy":"gemini-2.5-flash-lite","premium":"gemini-2.5-flash"}'::jsonb
WHERE key = 'llm_tiers';
```

---

## 8. TEST_MODE

### 8.1 Ativação

```bash
TEST_MODE=true docker compose up -d --no-deps api
```

### 8.2 Comportamento por Tipo de Agente

**Orquestradores (HERMES, OLYMPUS, HERMES_SIPLEX)**:

O prompt de override é **APPENDADO ao final** do `agentPrompt` (após o system prompt base e os prompts de metodologia). Isso é crítico: prompts no início são substituídos pelo comportamento padrão do LLM; o último bloco tem precedência.

Efeitos:
- `[PROTOCOLO DE QUALIDADE — REVISÃO POR FASE]` suspenso completamente
- ATHENA desativada (nenhuma chamada em hipótese alguma)
- Sequência direta: especialista → próximo especialista → relatório final
- Relatório mínimo de 1500 palavras com seções obrigatórias
- `maxSteps` reduzido para 20 (vs. 50 em produção)

**ATHENA**:
- `maxSteps` reduzido para 5
- Sempre aprova transições HITL (elimina loops de validação)

**Especialistas (SCOPUS, KLIO, etc.)**:
- `maxSteps` reduzido para 5
- Comportamento normal preservado

### 8.3 Localização no Código

```typescript
// apps/api/src/routes/chat.ts
// ~linha 343: ATHENA
if (process.env.TEST_MODE === 'true' && ag.name === 'ATHENA') { ... }

// ~linha 355: orquestradores
if (process.env.TEST_MODE === 'true' && ag.type === 'orchestrator') {
  agentPrompt = agentPrompt + `\n\n[⚠️ MODO TESTE ATIVO — ESTAS INSTRUÇÕES REVOGAM TODOS OS PROTOCOLOS ANTERIORES]\n...`;
}
```

---

## 9. Contexto de Projeto (anchorContext)

Cada chamada ao `/stream` injeta o contexto atual do projeto no system prompt do agente:

```typescript
// apps/api/src/routes/chat.ts
const anchorContext = `
## CONTEXTO DO PROJETO
- Nome: ${project.name}
- Cliente: ${project.client}
- Horizonte: ${project.horizon}
- Metodologia: ${project.methodology?.name}
- Fases: ${phases.map(p => `[${p.phaseNum}] ${p.label} → ${p.agentRole}`).join(', ')}
- Eventos aprovados: ${approvedEvents.map(e => e.name).join(', ')}
`;
agentPrompt = anchorContext + '\n\n' + agentPrompt;
```

O contexto inclui: nome do projeto, cliente, horizonte temporal, metodologia ativa, lista de fases com agente responsável, e eventos MICMAC já aprovados.

---

## 10. Roadmap — Migração para LangGraph JS

### 10.1 Fase 1 (Concluída)

- [x] Schema de banco (Drizzle ORM): `project_events`, `project_scenarios`, `matrix_direct_impacts`, `technique_execution_outputs`
- [x] Ferramentas analíticas SAT com fábrica `createAnalyticalEngineTools`
- [x] Seed de metodologias, fases, técnicas (11 metodologias, 12 técnicas SAT)
- [x] Sistema de tiers LLM (economy/premium) com suporte a múltiplos providers
- [x] Suite de testes de integração (`apps/api/scripts/run-tests.ts`)
- [x] Suporte a Google Gemini como provider alternativo

### 10.2 Fase 2 (Próxima)

Migrar de loop ReAct (Vercel AI SDK) para grafo de estado explícito (LangGraph JS):

```
StateAnnotation {
  projectId, messages, currentPhase, approvedEvents,
  scenarios, matrixOutputs, narratives, judgments
}

Nodes:
  ├─ scopus_node     → node_framing
  ├─ klio_node       → node_scanning_macro / node_scanning_forces / node_retrospective
  ├─ pythia_node     → node_modeling / node_matrix_design
  ├─ mnemosyne_node  → node_narrative
  └─ themis_node     → node_integration

Edges condicionais:
  ├─ klio_node → pythia_node (após varredura completa)
  ├─ pythia_node → [interruptBefore] → HITL gate (aprovação analista)
  └─ themis_node → END
```

### 10.3 Mapeamento node_slug (DB → LangGraph)

| `node_slug` | Nó LangGraph | Agente |
|-------------|--------------|--------|
| `node_framing` | `scopus_node` | SCOPUS |
| `node_scanning_macro` | `klio_node` | KLIO |
| `node_scanning_forces` | `klio_node` | KLIO |
| `node_retrospective` | `klio_node` | KLIO |
| `node_modeling` | `pythia_node` | PYTHIA |
| `node_matrix_design` | `pythia_node` | PYTHIA |
| `node_narrative` | `mnemosyne_node` | MNEMOSYNE |
| `node_integration` | `themis_node` | THEMIS |

### 10.4 HITL Gate (Human-in-the-Loop)

- `project_events` com `status='proposed'` aguardam aprovação do analista
- PYTHIA (`node_modeling`, `node_matrix_design`) opera **apenas** sobre eventos `status='approved'`
- Implementação atual: verificação soft no prompt de PYTHIA
- LangGraph Fase 2: `interruptBefore: ['pythia_node']` como gate formal

---

## 11. Conectividade e Soberania de Dados

### 11.1 Modos de Operação

| Modo | `connectivityMode` | Comportamento |
|------|--------------------|---------------|
| **ONLINE** | `"ONLINE"` | Tavily + APIs externas habilitadas |
| **SOBERANO** | `"SOBERANO"` | RAG interno prioritário; intenção analítica não exposta externamente |
| **AIR_GAPPED** | `"AIR_GAPPED"` | Zero requisições SaaS; apenas documentos indexados localmente |

### 11.2 APIs de Dados Públicos (ONLINE)

| Fonte | Dados | Ferramenta |
|-------|-------|-----------|
| IBGE SIDRA | IPCA, PIB, desemprego | `buscar_dados_publicos` |
| Banco Central (BCB) | SELIC, câmbio, M1 | `buscar_dados_publicos` |
| DOU (INLABS) | Diário Oficial da União | RAG + webhook |
| ITU DataHub | Indicadores globais de telecomunicações | `buscar_dados_publicos` |
| Tavily | Pesquisa web geral | `search_web` |

### 11.3 RAG (Retrieval-Augmented Generation)

- Embeddings: VoyageAI (`voyage-3-lite`) ou OpenAI fallback
- Armazenamento: `embeddings` (pgvector, `vector(1536)`)
- Indexação: `POST /api/v1/embeddings/index` com chunking automático
- Modo AIR_GAPPED: RAG é a única fonte de contexto externo

---

## 12. Segurança

### 12.1 Roles e Permissões

| Role | `/chat` | `/settings` | `/admin` | Projetos |
|------|---------|------------|---------|---------|
| `admin` | ✅ | ✅ | ✅ | Todos |
| `analista` | ✅ | ❌ | ❌ | Atribuídos |
| `cliente` | ❌ | ❌ | ❌ | Leitura |

### 12.2 Controles Implementados

- **JWT**: todos os endpoints protegidos (exceto `/login`, `/register`, `/health`)
- **IDOR prevention**: `/sessions/:id/messages` aplica filtro de ownership
- **Rate limiting**: configurável por tier; pausa automática em testes
- **Audit log**: toda ação persistida em `audit_logs` (userId, action, resourceType, timestamp)
- **2FA**: TOTP opcional por usuário (`POST /api/v1/2fa/enable`)
- **CORS**: `ALLOWED_ORIGIN` configurável por ambiente

---

## 13. Variáveis de Ambiente (Referência)

<!-- AUTO:variaveis:START -->
| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Opcional | Docker Compose local: postgres container sobe automaticamente via docker-compose.yml |
| `LLM_PROVIDER` | Opcional | Opção 1 (padrão): Anthropic Claude |
| `ANTHROPIC_API_KEY` | Opcional | Chave API Anthropic |
| `ANTHROPIC_MODEL` | Opcional | anthropic model |
| `TAVILY_API_KEY` | Opcional | Tavily — registro gratuito em tavily.com |
| `JWT_SECRET` | Opcional | ── Autenticação ────────────────────────────────────────────────────────────── |
| `ALLOWED_ORIGIN` | Opcional | ── CORS — URL do frontend ──────────────────────────────────────────────────── |
| `PORT` | Opcional | ── Porta da API ────────────────────────────────────────────────────────────── |
| `VOYAGE_API_KEY` | Opcional | Registro gratuito em dash.voyageai.com |
| `SMTP_HOST` | Opcional | ── Alertas KRATOS por e-mail (opcional) ────────────────────────────────────── |
| `SMTP_PORT` | Opcional | Porta SMTP |
| `SMTP_USER` | Opcional | Usuário SMTP |
| `SMTP_PASS` | Opcional | Senha SMTP |
| `INLABS_EMAIL` | Opcional | Cadastro gratuito em inlabs.in.gov.br |
| `INLABS_PASSWORD` | Opcional | Senha DOU INLABS |
| `ITU_EMAIL` | Opcional | Cadastro gratuito em datahub.itu.int |
| `ITU_PASSWORD` | Opcional | Senha ITU DataHub |
| `N8N_WEBHOOK_URL` | Opcional | Webhook n8n para automações (ex: notificações, pipelines externos) |
<!-- AUTO:variaveis:END -->

---

---

*Seções 1–5 e 13: geradas automaticamente por `update-architecture-doc.ts`*  
*Seções 6–12: documentação manual de arquitetura · última atualização: 28 de maio de 2026*
