# OLYMPUS v4.0 — Documentação de Arquitetura
**StratSight Brasil · Strategic Foresight · IA Agêntica**

<!-- AUTO:versao:START -->
**Versão:** `4.0.0` · **Atualizado:** 09 de junho de 2026 · Gerado automaticamente

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
| POST   | `/api/v1/` | Público | ── POST /events — criação manual pelo analista (complementa tool_register_event) ─ | events.ts |
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
| GET    | `/api/v1/:projectId/delphi` | Público | Retorna todos os events com name começando por 'P(i)' para renderização da DelphiMatrix | analytics.ts |
| GET    | `/api/v1/:projectId/impacts` | Público | Retorna FPFs aprovados + matriz de impactos diretos para o ImpactMatrix | analytics.ts |
| POST   | `/api/v1/:projectId/report` | Público | Cria :projectId | kratos.ts |
| GET    | `/api/v1/:projectId/report/html` | Público | Lista/busca :projectId | kratos.ts |
| POST   | `/api/v1/2fa/enable` | Público | Cria 2fa | auth.ts |
| POST   | `/api/v1/2fa/generate` | Público | userId derivado do token JWT — nunca da payload do request (previne IDOR/escalada). | auth.ts |
| PATCH  | `/api/v1/anthropic-models` | Público | ── PATCH /api/v1/settings/anthropic-models ── atualiza lista sem rebuild ────── | settings.ts |
| PATCH  | `/api/v1/batch/status` | Público | /:id/status vier primeiro, causando UUID parse error (500) no banco. | events.ts |
| POST   | `/api/v1/cache/invalidate` | Público | ── POST /api/v1/settings/cache/invalidate — limpa todos os caches em memória (admin) ─ | settings.ts |
| GET    | `/api/v1/cache/status` | Público | ── GET /api/v1/settings/cache/status — estado dos caches em memória (admin) ── | settings.ts |
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
| POST   | `/api/v1/logout` | JWT | A verificação do jti no middleware authMiddleware rejeita o token após este endpoint. | auth.ts |
| GET    | `/api/v1/methodologies` | Público | Retorna dados completos incluindo steps derivados de methodology_phases (banco) | engine.ts |
| GET    | `/api/v1/ollama-models` | Público | ── GET /api/v1/settings/ollama-models ── mantido para compatibilidade ──────── | settings.ts |
| GET    | `/api/v1/openapi.json` | Público | Serve OpenAPI JSON | docs.ts |
| POST   | `/api/v1/parse-scope` | Público | e de baixo custo (~200 tokens de entrada + ~150 de saída). | sessions.ts |
| POST   | `/api/v1/pdf` | Público | Cria pdf | export.ts |
| GET    | `/api/v1/project/:projectId` | Público | Listar indicadores de um projeto (Usado pelo Painel e pelo KRATOS) | indicators.ts |
| POST   | `/api/v1/register` | Público | Cria register | auth.ts |
| GET    | `/api/v1/setup-status` | Público | Lista/busca setup-status | auth.ts |
| GET    | `/api/v1/stats` | Público | GET /api/v1/audit/stats — resumo por ação (admin only) | audit.ts |
| GET    | `/api/v1/status/:projectId` | Público | Deve preceder qualquer rota com parâmetro genérico para evitar interceptação. | chat.ts |
| POST   | `/api/v1/stream` | Público | Mantido para compatibilidade com clientes legados até próximo deploy. | chat.ts |
| POST   | `/api/v1/stream/graph` | Público | ── Rota SSE — motor LangGraph (único caminho de análise) ──────────────────── | chat.ts |
| GET    | `/api/v1/techniques` | Público | Endpoint para listar técnicas SAT disponíveis | engine.ts |
| GET    | `/api/v1/verify` | Público | Retorna { valid: true } se a cadeia está íntegra; firstInvalidId se adulterada. | audit.ts |
<!-- AUTO:rotas:END -->

---

## 2. Schema do Banco de Dados

<!-- AUTO:schema:START -->
| Tabela | Colunas principais |
|--------|--------------------|
| `users` | id, name, email, passwordHash, role... (+3) |
| `methodologies` | id, name, slug, description, sourceDoc... (+8) |
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
| `methodology_phases` | id, methodologyId, phaseNum, label, agentRole... (+8) |
| `phase_techniques` | phaseId, techniqueId, priority |
| `agent_method_prompts` | id, agentId, methodologyId, extraInstructions |
| `teams` | id, name, description, createdAt |
| `team_members` | teamId, userId, role |
| `project_events` | id, projectId, name, description, type... (+4) |
| `project_scenarios` | id, projectId, name, description, probability... (+3) |
| `matrix_direct_impacts` | id, projectId, fromEventId, toEventId, impactScore... (+1) |
| `technique_execution_outputs` | id, projectId, techniqueType, outputData, metadata... (+1) |
| `phase_outputs` | id, projectId, phaseSlug, nodeSlug, phaseNum... (+8) |
| `revoked_tokens` | jti, userId, expiresAt, revokedAt |
| `rate_limit_logs` | id, userId, action, createdAt |
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

---

## 4. Metodologias

<!-- AUTO:metodologias:START -->
| Metodologia | Orquestrador | Fases | Categoria | Agentes |
|-------------|-------------|-------|-----------|---------|
| Godet: Escola Estrutural | HERMES | 7 | Cenários Prospectivos |  |
| SIEx: Conhecimento Estimativa EB | HERMES | 7 | Produção do Conhecimento |  |
| Grumbach: Produção de Cenários | HERMES | 9 | Cenários Prospectivos |  |
| SIPLEx: Sistema de Planejamento do Exército | HERMES | 7 | Planejamento Estratégico |  |
| GBN — Global Business Network (Schwartz) | HERMES | ? | Cenários Prospectivos |  |
| SPED/PESD: Planejamento Estratégico Setorial de Defesa | HERMES | ? | Planejamento Estratégico |  |
| CEEEx: Cenários Prospectivos do Exército | HERMES | ? | Cenários Prospectivos |  |
| IPEA/Buarque — Metodologia de Cenários | HERMES | ? | Cenários Prospectivos |  |
| Grumbach: Gestão Estratégica Completa | HERMES | ? | Planejamento Estratégico |  |
| ESG: Cenários Prospectivos | HERMES | 6 | Cenários Prospectivos |  |
| OTAN — Alternative Analysis (AltA) | HERMES | 6 | Cenários Prospectivos |  |
| MPO: Estratégia Brasil 2050 | HERMES | 8 | Planejamento Estratégico |  |
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

## 6. Variáveis de Ambiente

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

*Gerado automaticamente por update-architecture-doc.ts · 2026-05-30T19:06:33.277Z*
