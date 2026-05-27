# OLYMPUS v4.0 — Briefing Completo para Claude Chat
## Geração de Documentação e Plano de Testes
**StratSight Brasil · 27 Mai 2026 · Acesso Restrito**

> **Como usar este documento:** Copie PARTE 1 inteira para uma conversa Claude Chat para gerar a Documentação de Arquitetura completa. Em seguida, copie PARTE 2 para gerar o Plano de Testes. Cada parte já contém todas as informações do sistema pré-preenchidas — não é necessário editar os campos `[Ex: ...]`.

---

# PARTE 1 — PROMPT: DOCUMENTAÇÃO COMPLETA DE ARQUITETURA

```
Você é um Arquiteto de Software e Tech Lead Sênior. Sua tarefa é gerar a documentação técnica completa do OLYMPUS v4.0, seguindo o modelo C4 em Markdown. Use exclusivamente as informações fornecidas abaixo — não invente componentes ou comportamentos não descritos.

## INFORMAÇÕES DO SISTEMA

**Nome:** OLYMPUS v4.0 — Plataforma de Strategic Foresight e Monitoramento Contínuo
**Empresa:** StratSight Brasil
**Stack:**
- Backend: Node.js 20 + Hono framework + TypeScript (porta 3333)
- Frontend: React 18 + Vite + TypeScript + TailwindCSS (porta 80 via Nginx)
- Banco: PostgreSQL 15 + pgvector (porta 5432 interna Docker)
- IA: Vercel AI SDK v6 (ai@6.0.168) + @ai-sdk/anthropic + @ai-sdk/openai (Ollama)
- Grafo: @langchain/langgraph (StateGraph, BoundedMemorySaver, interrupt HITL)
- ORM: Drizzle ORM v0.45.2
- Containers: Docker Compose (3 serviços: api, web, db + ollama opcional)
- Deploy: Railway (produção) + docker-compose local

**Monorepo NPM Workspaces:**
- apps/api/ — backend Hono
- apps/web/ — frontend React
- packages/core/ — motor multi-agente (Agent.ts, Orchestrator.ts, nodeRouter.ts)
- packages/db/ — Drizzle schema + conexão
- packages/tools/ — ferramentas externas (Tavily, dados-publicos, embed)

## CONTEXTO DE NEGÓCIO

O OLYMPUS tem dois motores:
1. **ATHENA** — produção de cenários prospectivos para clientes estratégicos (governo, defesa, corporativo). Ticket: R$80K–250K por projeto.
2. **KRATOS** — monitoramento contínuo de indicadores com análises autônomas agendadas via node-cron. Recorrência: R$8K–25K/mês.

Restrições críticas: operação solo, custo <R$1.500/mês pré-contrato, clientes de defesa exigem operação offline/air-gapped e marca d'água CONFIDENCIAL em exports.

## MOTOR DE IA — AGENTES

10 agentes ativos gerenciados pelo seed.ts declarativo:

| Agente | Tipo | Tier | Ferramentas |
|--------|------|------|-------------|
| HERMES | orchestrator | — | consultar_agente |
| OLYMPUS | orchestrator | — | consultar_agente |
| HERMES_SIPLEX | orchestrator | — | consultar_agente |
| SCOPUS | expert | economy (Sonnet) | web_search, buscar_dados_publicos, avaliar_fonte, declarar_julgamento |
| KLIO | expert | premium (Opus) | web_search, buscar_dados_publicos, buscar_documentos_internos, avaliar_fonte |
| PYTHIA | expert | premium (Opus) | web_search, buscar_dados_publicos, tool_register_event, tool_mpc_source_evaluator |
| MNEMOSYNE | expert | premium (Opus) | web_search |
| THEMIS | expert | premium (Opus) | web_search, buscar_sinais, avaliar_fonte, declarar_julgamento |
| KRATOS | expert | economy (Sonnet) | web_search, buscar_dados_publicos |
| ATHENA | expert | premium (Opus) | avaliar_fonte, declarar_julgamento, registrar_hipotese_alternativa |

Tier system: labels 'economy'/'premium' em agents.model_override → resolvidos em platform_settings.llm_tiers (configurável sem redeploy).

## METODOLOGIAS (10 no catálogo)

| Metodologia | Orquestrador | Fases | Categoria |
|-------------|-------------|-------|-----------|
| MSEF | HERMES | 7 | Cenários Prospectivos |
| GRUMBACH - PLANEJAMENTO | OLYMPUS | 5 | Cenários Prospectivos |
| GODET | HERMES | 6 | Cenários Prospectivos |
| OTAN/AltA | HERMES | 5 | Análise Alternativa (12 técnicas NATO) |
| SIEX - MPC | OLYMPUS | 6 | Produção do Conhecimento (EB70-MT-10.401) |
| SIPLEx | HERMES_SIPLEX | 7 | Planejamento Estratégico |
| MACROPLAN | HERMES | 5 | Cenários Prospectivos |
| MPO | HERMES | 5 | Planejamento Estratégico |
| ASPLAN | HERMES | 6 | Planejamento Estratégico |
| FUTURES | HERMES | 7 | Cenários Prospectivos |

Todas as 10 metodologias têm fases em methodology_phases com slug único e node_slug LangGraph. Prompts por metodologia via tabela agent_method_prompts (sem hardcode).

## LANGGRAPH (motor de orquestração v2)

StateGraph<OlympusState> com 6 nós:
- scopus_node (node_framing) → klio_node (node_scanning_*) → pythia_node (node_modeling, HITL via interrupt()) → mnemosyne_node → integration_node → synthesis_node → END
- BoundedMemorySaver: LRU in-memory 50 threads, TTL 2h, thread_id=projectId
- HITL: interrupt() em pythia_node → frontend hitlGate → aprovação via EventsPanel → resumeGraph()
- Rota: POST /api/v1/chat/stream/graph (SSE com eventos do grafo)
- Two-step slug lookup (phaseSlug→nodeSlug→graphNode) resolve nodeSlug duplicados entre fases

## FERRAMENTAS DOS AGENTES

Ferramentas externas (packages/tools/):
- web_search: Tavily API — guard AIR_GAPPED bloqueia completamente
- buscar_dados_publicos: 62 séries de 14 fontes (BCB, IBGE, IPEA, FMI, OMS, ONU, ITU, Comex, FRED, Câmara, Senado, Banco Mundial, DOU, IBGE Países)
- buscar_documentos_internos: pgvector RAG (Voyage AI voyage-3-lite, 512 dims)

Ferramentas analíticas (apps/api/src/tools/analytical-engines.ts — JSON Schema puro, sem Zod):
- tool_register_event: registra tendência/incerteza/FPF com MPC A-F × 1-6
- tool_mpc_source_evaluator: avalia confiabilidade de fonte
- tool_register_impact_relation: matriz MICMAC
- tool_grumbach_expert_simulation: 7 personas especialistas (método Grumbach)
- tool_mactor_analysis: análise de influência entre atores
- tool_mpo_backcasting: backcasting com horizontes intermediários
- tool_unified_search_engine: busca respeitando connectivityMode

Ferramentas ICD 203 / ODNI 2022 (apps/api/src/tools/analytic-standards.ts):
- declarar_julgamento: escala de probabilidade 7 pontos + nível de confiança
- registrar_hipotese_alternativa: hipótese principal vs. alternativas
- avaliar_fonte: URL + fidelidade + possibilidade NeD + credibilidade

Técnicas SAT / NATO AltA (12 — tabela techniques no banco):
Identificação de Premissas-Chave, PMI, Verificação de Qualidade da Informação, Cinco Porquês, Análise E-Se, Futuros Alternos, Pensamento de Fora para Dentro, SWOT, Adversário Substituto, Advocacia do Diabo, Análise Pré-Mortem, Time A/Time B.

## EXPORTAÇÃO DE RELATÓRIOS

| Endpoint | Formato | Função |
|---------|---------|--------|
| POST /api/v1/export/pdf | HTML (print→PDF) | buildIR() + async renderHtml() — marca d'água CONFIDENCIAL, async via yieldToEventLoop |
| POST /api/v1/export/docx | .docx binário | buildIR() + async renderDocx() — capa + seções por agente + marca d'água |
| POST /api/v1/export/estimativa | HTML SIEx | buildEstimativaHtml() — formato EB70-MT-10.401 (Situação/Análise/Conclusão) |
| POST /api/v1/playbook/gerar | .docx operacional | buildPlaybookDocx() — capa + metodologia + indicadores + sinais + recomendações |

Cache: resolveAgentPhases() com TTL 5min via Map interno.

## MONITORAMENTO KRATOS

1. Agendamento via node-cron por projeto (kratosCron = expressão cron, ex: "0 8 * * *")
2. KratosOrchestrator (fila com cooldown configurável — platform_settings.kronos_cooldown_ms)
3. Execução: runAnalysis() direto (sem HTTP loopback), systemPayload={id:'system'}
4. Pós-análise: envio de e-mail (Nodemailer) para alertEmails do projeto
5. Webhook n8n opcional (falha silenciosa se offline)
6. exports: updateCronJob(id, name, met, expr?) e removeCronJob(id) — cirurgia sem reload global
7. Dashboard: GET /api/v1/kratos/:id/dashboard — indicadores + sparklines + sinais + probabilidades

## SEGURANÇA E CONFORMIDADE

- JWT (Hono/jwt): JWT_EXPIRY configurável (1h|4h|8h|24h|7d), validação de userId no banco
- Rate limiting: 3 camadas — nginx (api_zone 30r/m, auth_zone 10r/m), auth.ts (makeRateLimiter por IP), middleware/rateLimit.ts (por userId: 5 análises/h, 10 exports/h)
- Enumeração de usuários: mensagem neutra no /register + setTimeout(70ms) timing mitigation
- Audit logs: tabela audit_logs append-only, logAudit() silencioso
- Watermark: CSS CONFIDENCIAL rotated nos exports HTML/PDF
- 2FA: TOTP via speakeasy (opcional por usuário)
- connectivityMode: ONLINE/SOBERANO/AIR_GAPPED — controla acesso a APIs externas

## INFRAESTRUTURA DOCKER

Serviços: olympus_api (Node:20-slim, 1GB RAM), olympus_web (nginx:alpine, 128MB RAM), olympus_db (pgvector/pgvector:pg15, 512MB RAM)
Nginx: proxy reverso, timeout 300s, rate limiting via conf.d/00-limits.conf
Volumes: pgdata, olympus_backups, ollama_data
Credenciais: ${POSTGRES_USER:-postgres}, ${POSTGRES_PASSWORD:-postgres}, ${POSTGRES_DB:-olympus}

## DECISÕES ARQUITETURAIS CRÍTICAS (não regredir)

1. Agent.ts: NUNCA usar Zod — JSON Schema puro + jsonSchema() do Vercel AI SDK
2. SDK v6: NUNCA usar maxSteps — usar stopWhen: stepCountIs(N)
3. toolChoice: 'required' apenas no step 0 via prepareStep (não globalmente)
4. packages/tools/ NÃO PODE importar @olympus/db (ordem de build: core→tools→db→api)
5. HERMES: sem blocos que isentem de usar ferramentas — prompts contraditórios causam regressão
6. DATABASE_URL no docker: montada de partes (não ${DATABASE_URL}) — nested substitution não suportado
7. Dockerfile CMD: sempre node apps/api/dist/index.js (nunca tsx em produção)

---

## DIRETRIZES DE SAÍDA

Gere a documentação nas 4 seções abaixo, usando o `ARCHITECTURE.md` já existente no repositório como base mas expandindo cada seção com mais profundidade técnica:

### 1. Arquitetura (Modelo C4)
- **Nível 1 (Contexto):** diagrama textual dos usuários (Analista, Admin, Cliente) e 14 sistemas externos, com tipo de integração e protocolo
- **Nível 2 (Contêineres):** diagrama ASCII dos 4 contêineres Docker com protocolos de comunicação e limites de recursos
- **Nível 3 (Componentes):** tabela completa de rotas da API com método HTTP, path, auth, função e arquivo; diagrama do grafo LangGraph com 6 nós e conditional edges

### 2. Setup e Configuração
- Tabela de pré-requisitos com versões mínimas
- Passo a passo exato (Docker + bare metal) com comandos copiáveis
- Tabela de todas as variáveis de ambiente (obrigatória/opcional, descrição, formato)
- Pipeline Railway: 6 passos do zero ao domínio

### 3. Guia de Manutenção (Ops)
- Tabela de troubleshooting com 10+ problemas reais do histórico do projeto
- Comandos de diagnóstico prontos para copiar (docker logs, health check, etc.)
- Onde os logs ficam e métricas críticas a monitorar (com limiares numéricos)

### 4. Decisões Arquiteturais (ADR)
- 7 ADRs já documentados com contexto, decisão, prós, contras e status
- Enfatize especialmente ADR-05 (JSON Schema puro) e ADR-03 (LangGraph) pois são as decisões mais críticas para quem vai manter o código

Formate em Markdown limpo com seções delimitadas por --- para fácil divisão em arquivos.
```

---

# PARTE 2 — PROMPT: PLANO DE TESTES COMPLETO

```
Você é um Engenheiro de QA Sênior e Especialista em Automação de Testes. Crie um Plano de Testes de Software completo para o OLYMPUS v4.0. O plano deve cobrir TODAS as funcionalidades descritas abaixo e produzir código de teste executável — não pseudo-código ou esqueletos genéricos.

IMPORTANTE PARA EFICIÊNCIA DE EXECUÇÃO: Os exemplos de código devem usar os padrões reais do projeto. Especificamente:
- Backend: Hono com `@hono/node-server`, testes via `hono/testing` (não Express/Supertest)
- ORM: Drizzle ORM com `postgres.js` (não `pg` ou `prisma`)
- LangGraph: `@langchain/langgraph` StateGraph com BoundedMemorySaver
- Frontend: React 18 + Vitest + Testing Library (não Jest para frontend)
- E2E: Playwright com `@playwright/test`
- Carga: k6

## INFORMAÇÕES DO SISTEMA

**Nome:** OLYMPUS v4.0
**Stack:** Node.js 20 + Hono + TypeScript (backend) | React 18 + Vite + TypeScript (frontend) | PostgreSQL 15 + pgvector | LangGraph JS | Vercel AI SDK v6

**Repositório:** monorepo NPM Workspaces
- apps/api/src/ — rotas, grafo, ferramentas, cron
- apps/web/src/ — React App.tsx (~1800 linhas), componentes
- packages/core/ — Agent.ts, Orchestrator.ts, nodeRouter.ts
- packages/db/ — schema.ts (Drizzle), db.ts

**Ambiente de teste:** docker-compose.yml existente. Variáveis via .env.test (separar de .env de produção).

## FUNCIONALIDADES A TESTAR (COBERTURA OBRIGATÓRIA)

### 1. AUTENTICAÇÃO E AUTORIZAÇÃO (auth.ts)
Endpoints: POST /api/v1/auth/login, POST /api/v1/auth/register, POST /api/v1/auth/setup-status
Cenários críticos:
- Login com credenciais válidas → JWT retornado com campos corretos (id, name, role, exp)
- Login com credenciais inválidas → 401, mensagem genérica (sem vazamento de existência)
- Rate limit login: 6ª tentativa do mesmo IP em 15min → 429
- Rate limit register: 4ª tentativa do mesmo IP em 60min → 429
- Register com e-mail já existente → 400, mensagem neutra (não vaza existência)
- JWT expirado → 401 em rota protegida
- Role 'cliente' tentando criar sessão → 403
- 2FA: login com TOTP inválido → 401; login com TOTP válido → JWT

### 2. MOTOR DE IA — ANÁLISE (chat.ts)
Endpoints: POST /api/v1/chat, POST /api/v1/chat/stream, POST /api/v1/chat/stream/graph
Cenários críticos:
- POST /chat com metodologia MSEF → resposta contém nome de agente SCOPUS no content
- POST /chat com metodologia não cadastrada → 404 com mensagem "Metodologia não encontrada"
- SSE /stream: emite {type:'token'}, {type:'step'}, {type:'done'} na ordem correta
- SSE /stream/graph (vizMode='grafo'): emite {type:'node', nodeId} para cada nó do grafo
- Memória server-authoritative: messages do body.messages são IGNORADOS; somente banco é fonte
- connectivityMode=AIR_GAPPED: web_search retorna [] sem chamada Tavily
- KRATOS cron direto: runAnalysis() com systemPayload={id:'system'} não requer JWT válido

### 3. HITL — HUMAN IN THE LOOP (events.ts)
Endpoints: GET /api/v1/events, POST /api/v1/events, PUT /api/v1/events/:id, DELETE /api/v1/events/:id
Cenários críticos:
- GET /events?projectId=X → lista apenas eventos do projeto X
- POST /events → cria evento com status='proposed', retorna id
- PUT /events/:id com status='approved' → anchorContext injeta evento nas próximas análises
- PUT /events/:id com status='rejected' → evento removido do anchorContext
- Evento approved com matrixDirectImpacts preenchido → pythia_node pode continuar sem interrupt()
- interrupt() no pythia_node: grafo pausa, frontend recebe {type:'hitl_interrupt'}, resumeGraph() retoma

### 4. TODAS AS 10 METODOLOGIAS

Para cada metodologia, testar o ciclo completo via POST /api/v1/chat:
- MSEF: 7 fases, agentes SCOPUS→KLIO→PYTHIA→MNEMOSYNE→THEMIS→KRATOS→HERMES. Relatório final deve conter "RELATÓRIO FINAL PADRÃO" ou "RELATÓRIO DE CENÁRIOS". Cenários Q1-Q4 com probabilidades numéricas.
- GRUMBACH: 5 fases, orquestrador OLYMPUS. Produto: 3 cenários (Tendencial/Pessimista/Otimista). Parser KRATOS reconhece "Mais Provável/Ideal/Alvo/Tendência".
- GODET: 6 fases, HERMES. Relatório deve conter "RAPPORT PROSPECTIF GODET". MICMAC M^k, MACTOR, morfologia, SMIC.
- OTAN/AltA: 5 fases. 12 técnicas SAT disponíveis. Produto final: "PRODUTO ALTA FINAL".
- SIEX-MPC: 6 fases, OLYMPUS. Export via /export/estimativa retorna HTML com seções Situação/Análise/Conclusão.
- SIPLEx: 7 fases, HERMES_SIPLEX. Assinatura **HERMES_SIPLEX** · (com ponto-médio, não ponto simples).
- MACROPLAN: 5 fases, HERMES. 4 agentes: KLIO→PYTHIA→THEMIS→HERMES.
- MPO: 5 fases, HERMES. Ferramenta tool_mpo_backcasting disponível para PYTHIA.
- ASPLAN: 6 fases, HERMES. ATHENA chamada antes do relatório final.
- FUTURES: 7 fases, HERMES. 6 agentes: SCOPUS→KLIO→PYTHIA→MNEMOSYNE→THEMIS→HERMES.

### 5. FERRAMENTAS ANALÍTICAS E SAT

Testes unitários para cada ferramenta (apps/api/src/tools/analytical-engines.ts):
- tool_register_event: args válidos → registro no banco + retorno com id; MPC inválido (G, 7) → erro de validação
- tool_mpc_source_evaluator: args válidos → atualiza evento existente; eventId inexistente → erro
- tool_register_impact_relation: fromEventId=toEventId → rejeitar (loop); impactScore fora 0-3 → erro
- tool_grumbach_expert_simulation: 7 personas → output contém perspectiva de cada especialista
- tool_mactor_analysis: lista de atores → output contém matriz de influência
- tool_mpo_backcasting: horizonte e objetivo → output contém marcos intermediários

Técnicas SAT / NATO AltA:
- GET /api/v1/engine/techniques → lista 12 técnicas com name, description, instructions
- TechniqueEngine.getTechniqueInstructions(['advocacia_do_diabo', 'pre_mortem']) → retorna bloco de prompt não-vazio
- Agente OTAN/AltA com technique_advocacia_do_diabo → output contém perspectiva adversarial explícita

### 6. RAG — RETRIEVAL-AUGMENTED GENERATION (embeddings.ts + rag.ts)

Endpoints: POST /api/v1/embeddings/index, DELETE /api/v1/embeddings/:id, GET /api/v1/embeddings/count/:projectId
Cenários críticos:
- Upload PDF → /extract → chunkTextSafe → /embeddings/index → banco.embeddings cresce N rows
- buscar_documentos_internos com query relevante → retorna chunks com similarity > 0.7
- buscar_documentos_internos com query irrelevante → retorna array vazio (não hallucina)
- Isolamento por projectId: chunks do projeto A NÃO aparecem em busca do projeto B
- generateEmbeddingsOllama: MAX_CONCURRENT=2, pausa 150ms entre batches — mock Ollama endpoint

### 7. KRATOS — MONITORAMENTO AUTOMÁTICO (cron.ts + indicators.ts + kratos.ts)

Endpoints: GET /api/v1/kratos/:id/dashboard, GET/POST/PATCH/DELETE /api/v1/indicators/:projectId, GET/POST/PATCH/DELETE /api/v1/signals/:projectId
Cenários críticos:
- appendHistory(): novo valor appended corretamente; entradas >90 dias purgadas
- autoRegisterSignal(): status 'amarelo' → sinal fraco criado; executar 2x → sem duplicata (deduplicação por título+projectId)
- updateCronJob(id, name, met, '0 8 * * *') → job agendado em activeJobs; trocar expr → job anterior parado
- removeCronJob(id) → job removido de activeJobs; não lança erro se id não existia
- Dashboard: overallStatus='vermelho' se qualquer indicador for vermelho
- Sparkline: indicador com 5 valores em valueHistory → Sparkline renderiza polyline com 5 pontos
- KRATOS direct call com systemPayload={id:'system'} → análise completa sem JWT real

### 8. EXPORTAÇÃO DE RELATÓRIOS (export.ts + playbook.ts)

Endpoints: POST /api/v1/export/pdf, /docx, /estimativa; POST /api/v1/playbook/gerar
Cenários críticos:
- /export/pdf: HTML retornado contém div.watermark com texto "CONFIDENCIAL" ou classificação do projeto
- /export/docx: buffer binário retornado é .docx válido (magic bytes: PK\x03\x04)
- /export/estimativa: HTML contém seções "SITUAÇÃO", "ANÁLISE", "CONCLUSÃO"
- renderHtml async: não bloqueia event loop em docs com >50 seções (medir tempo < 5s)
- renderDocx async: não bloqueia event loop em docs com >50 seções
- Cache: 2ª chamada com mesmo projectId em <5min usa cache (resolveAgentPhases retorna em <10ms)
- Playbook: DOCX gerado contém tabela de indicadores e tabela de sinais fracos

### 9. SEGURANÇA E CONFORMIDADE

- Audit log: login bem-sucedido → audit_logs cresce 1 row com action='login'
- Audit log: ação de admin → row com userId correto, resourceType correto
- Rate limit middleware: 6ª análise do mesmo userId em 1h → 429
- Rate limit middleware: 11ª exportação do mesmo userId em 1h → 429
- nginx auth_zone: mock 11 requisições/min para /auth/login → 429 (teste de integração com Docker)
- JWT expirado: token com exp=past → 401 em toda rota protegida
- Role cliente: POST /api/v1/chat → 403 Forbidden
- connectivityMode=AIR_GAPPED: web_search → 0 resultados, sem chamada HTTP externa

### 10. PAINEL DO CLIENTE E ACESSO EXTERNO (painel.ts + sessions.ts)

Endpoints: GET /api/v1/painel/project/:id?token=JWT, GET /api/v1/sessions, GET /api/v1/sessions/:id
Cenários críticos:
- GET /painel/project/:id sem token → 401
- GET /painel/project/:id com JWT válido de 'cliente' → HTML com dashboard (200 OK)
- HTML do painel contém marca d'água e relatório do HERMES renderizado
- GET /sessions com JWT admin → lista todos os projetos
- GET /sessions com JWT analista → lista apenas projetos do analista
- PATCH /sessions/:id → atualiza metodologia, dispara updateCronJob se kratosCron mudou

### 11. CONFIGURAÇÕES E TIERS LLM (settings.ts)

Endpoints: GET /api/v1/settings, PATCH /api/v1/settings/llm, PATCH /api/v1/settings/llm-tiers
Cenários críticos:
- PATCH /settings/llm-tiers com {economy:'claude-haiku-4-5', premium:'claude-sonnet-4-6'} → próxima análise usa haiku para SCOPUS
- PATCH /settings/llm-tiers por não-admin → 403
- GET /settings → retorna ollamaModels (lista de modelos Ollama disponíveis) quando provider=ollama
- Tier sem mapeamento → fallback passthrough (usar valor bruto como model ID)

## SEÇÕES OBRIGATÓRIAS DO PLANO

### Seção 1 — Estratégia e Ferramentas

Defina o escopo de cada tipo de teste para o OLYMPUS especificamente (não genericamente):
- **Unitários** (Jest + ts-jest): packages/core/ e tools/ isolados com mocks de LLM e banco
- **Integração API** (Hono test client + Drizzle test DB): cada rota com banco real PostgreSQL em container de teste
- **E2E UI** (Playwright): fluxos completos de análise MSEF, aprovação HITL, exportação
- **Carga** (k6): endpoint /api/v1/chat/stream com 10 VUs simultâneos por 2min
- **Contrato** (tsc --noEmit): nenhum erro de tipo em todos os 5 pacotes

### Seção 2 — Matriz de Cenários (mínimo 15 casos)

Tabela com: ID | Funcionalidade | Metodologia/Endpoint | Pré-condição | Passos | Resultado Esperado | Tipo | Prioridade

Inclua obrigatoriamente:
- TC-01: Análise MSEF completa 7 fases (caminho feliz) → E2E
- TC-02: Análise MSEF com LLM mock → Integração
- TC-03: HITL interrupt em pythia_node → Integração
- TC-04: HITL resume após aprovação → Integração
- TC-05: Enumeração de usuários via /register → Unitário
- TC-06: Rate limit /auth/login (6ª tentativa) → Integração
- TC-07: RAG upload PDF + busca semântica → Integração
- TC-08: KRATOS cron disparo + email mock → Integração
- TC-09: Export DOCX com watermark → Integração
- TC-10: connectivityMode=AIR_GAPPED bloqueia web_search → Unitário
- TC-11: Tool tool_register_event com MPC inválido → Unitário
- TC-12: GODET rapport separado no export → Integração
- TC-13: SIEX estimativa formato EB70 → Integração
- TC-14: Tier change PATCH /settings/llm-tiers → Integração
- TC-15: E2E Playwright: login → nova sessão MSEF → análise → exportar DOCX

### Seção 3 — Código de Automação Executável

**Exemplo 1 — Teste de integração de API (Hono test client):**
Teste completo de POST /api/v1/auth/login com banco de teste real. Inclua:
- Setup: criar usuário de teste via Drizzle, hash senha com bcrypt
- Execução: POST /login com credenciais corretas
- Verificação: status 200, JWT decodificado com campos corretos
- Teardown: DELETE FROM users WHERE email = 'test@test.com'
- Padrão Hono: usar `const res = await app.request('/api/v1/auth/login', { method: 'POST', ... })`

**Exemplo 2 — Teste unitário do cron (updateCronJob/removeCronJob):**
Testar que updateCronJob registra o job correto em activeJobs e que removeCronJob o remove. Mock do node-cron. Verificar que trocar expr para o mesmo projectId para o job anterior antes de criar o novo.

**Exemplo 3 — Teste E2E Playwright (fluxo completo):**
Login → criar sessão MSEF → aguardar análise SSE completa → verificar que mensagem HERMES contém "RELATÓRIO" → clicar Exportar DOCX → verificar download com extensão .docx.
Inclua seletores data-testid específicos que devem ser adicionados aos componentes React relevantes.

**Exemplo 4 — Teste de carga k6:**
Script k6 para POST /api/v1/chat/stream com metodologia MSEF. Métricas: p95 < 30s, taxa de erro < 1%, 10 VUs por 2min.

### Seção 4 — Massa de Dados e CI/CD

**Massa de dados:**
- Usar banco PostgreSQL dedicado para testes: DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5433/olympus_test
- Seed de testes: scripts/seed-test.ts (baseado em seed-demo.ts mas com dados determinísticos)
- Fixtures LLM: usar @ai-sdk/provider-utils/test (MockLanguageModelV1) para substituir chamadas Anthropic nos testes de integração
- Fixture Tavily: mock global fetch para URL api.tavily.com → resposta fixa JSON
- Fixture SMTP: nodemailer-mock ou mailhog container

**Pipeline CI/CD (GitHub Actions):**
Arquivo .github/workflows/test.yml com:
- Trigger: push para main e pull_request para main
- Jobs paralelos: unit-tests (sem Docker), integration-tests (com Docker Compose), e2e-tests (Playwright headless)
- Regra de bloqueio: qualquer falha em unit-tests ou integration-tests bloqueia merge
- Cache: npm ci com cache de node_modules
- Cobertura: Jest --coverage com threshold mínimo 60% para packages/core

Formate toda a saída em Markdown limpo com blocos de código TypeScript/JavaScript reais, prontos para copiar e colar em arquivos de teste.
```

---

# NOTAS PARA EXECUÇÃO PELO CLAUDE CODE

Após o Claude Chat gerar o plano de testes, o Claude Code deve criar os seguintes arquivos no repositório:

## Estrutura de testes a criar

```
Olympus/
├── .github/
│   └── workflows/
│       └── test.yml                    # CI/CD pipeline
├── apps/
│   ├── api/
│   │   └── src/
│   │       └── __tests__/
│   │           ├── auth.test.ts        # TC-05, TC-06
│   │           ├── chat.test.ts        # TC-02, TC-10
│   │           ├── events.test.ts      # TC-03, TC-04
│   │           ├── export.test.ts      # TC-09, TC-13
│   │           ├── cron.test.ts        # TC-08 + LP-5 (updateCronJob/removeCronJob)
│   │           ├── indicators.test.ts  # TC-08 (autoRegisterSignal)
│   │           └── embeddings.test.ts  # TC-07
│   └── web/
│       └── src/
│           └── __tests__/
│               └── App.test.tsx        # Componentes críticos
├── e2e/
│   ├── msef-analysis.spec.ts           # TC-01, TC-15
│   ├── hitl-flow.spec.ts               # TC-03, TC-04
│   └── export-flow.spec.ts             # TC-09
├── packages/
│   └── core/
│       └── src/
│           └── __tests__/
│               ├── Agent.test.ts       # Rate limiting, tool calling
│               ├── nodeRouter.test.ts  # Routing logic
│               └── tools.test.ts       # TC-10, TC-11
├── scripts/
│   └── seed-test.ts                    # Dados determinísticos para testes
└── k6/
    └── load-test.js                    # TC (carga)
```

## Padrões e regras para o Claude Code

1. **Nunca mockar Drizzle ORM** — usar banco PostgreSQL real em container de teste (porta 5433)
2. **Sempre mockar chamadas LLM** — usar MockLanguageModelV1 do @ai-sdk/provider-utils/test
3. **Teardown obrigatório** — cada teste que escreve no banco deve limpar após si (beforeEach/afterEach com DELETE)
4. **Variáveis de ambiente de teste** em `.env.test` (nunca em `.env` de produção)
5. **Hono test pattern**: `app.request(path, init)` (não supertest, não express)
6. **LangGraph em testes**: usar `BoundedMemorySaver` diretamente (já é in-memory, sem mock)
7. **node-cron em testes**: mockar `cron.schedule` → retornar objeto com `.stop()` spy
8. **Playwright**: `npx playwright install --with-deps chromium` obrigatório no CI

---

*OLYMPUS v4.0 · StratSight Brasil · 27 Mai 2026 · Acesso Restrito*
