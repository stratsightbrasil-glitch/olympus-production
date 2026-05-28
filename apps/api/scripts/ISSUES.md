# Olympus v4 — Relação de Issues (pós-testes)

> Criado em 27/05/2026. Rodada inicial: 30 testes, 8 ✅ 22 ❌ (568s).  
> Rodada 2 (após fixes): 36 testes, 21 ✅ 15 ❌ (créditos Anthropic esgotados — 6 metodologias pendentes).  
> Fonte: `run-tests.ts` + análise de código.

---

## CRÍTICO

### IS-001 · Agentes especialistas não são invocados — apenas HERMES responde
**Categoria:** API / Contrato de Interface  
**Evidência:** 5/6 metodologias falharam com "Sequência incorreta. Encontrado: HERMES". Análise revelou duas causas:

**Causa A — corpo da requisição incorreto no script de testes:**  
`consumeSSE` envia `{ projectId, message: "..." }`, mas o endpoint `/chat/stream` espera:
```json
{ "projectId": "...", "projectName": "...", "metodologia": "...", "vizMode": "passagem",
  "messages": [{ "role": "user", "content": "..." }] }
```
Com `body.messages` undefined, `rawInputMsg` é string vazia. HERMES recebe pergunta vazia → não aciona especialistas.

**Causa B — `metodologia` ausente no corpo:**  
Sem o campo, `runAnalysis` usa default `'MSEF'` e sobrescreve o projeto com o nome antigo. O roteamento de agentes pode falhar na busca pela metodologia.

**Status:** CORRIGIDO no script de testes (T-01 a T-05 fixados). Pendente verificação com créditos Anthropic recarregados.  
**Ação na API (IS-003 relacionado):** `POST /sessions` deve persistir todos os metadados do projeto, eliminando a necessidade de reenviá-los no chat.

---

## ALTO

### IS-002 · `methodology` nos projetos usa `name` como chave — frágil a renomeações
**Categoria:** Arquitetura / DB  
**Status:** **ABERTO**  
**Evidência:** Sprint ESG renomeou metodologias (ex: `MSEF` → `MSEF v3 (8 etapas ENAP)`), quebrando referências em projetos existentes. O campo `slug` existe na tabela `methodologies` e é estável.  
**Ação:** Usar `slug` (`msef`, `godet`, `grumbach`…) como chave programática em projetos, chat, exports e roteamento. O `name` vira label de exibição.

### IS-003 · Sem endpoint `POST /api/v1/sessions` — criação via PATCH com ID gerado no cliente
**Categoria:** API / Design  
**Status:** **ABERTO**  
**Evidência:** Endpoint convencional retorna 404. API usa `PATCH /sessions/:id` com upsert, retornando apenas `{ ok: true }`. ID gerado no frontend como `sess_${Date.now()}`.  
**Problemas adicionais:** IDs baseados em timestamp colidem sob carga; campos `client`, `analyst`, `horizon`, `questaoEstrategica` nunca são persistidos; `runAnalysis` recebe `metodologia` pelo corpo do chat (não do projeto salvo), criando acoplamento desnecessário.  
**Ação:** Criar `POST /api/v1/sessions` com UUID server-side, persistindo todos os campos. O `runAnalysis` deve ler a metodologia do projeto no banco, não do corpo do chat.

### IS-004 · `GET /api/v1/engine/techniques` não implementado
**Categoria:** API / Gap  
**Status:** ✅ **RESOLVIDO** (27/05/2026)  
**Evidência:** Retornava 404. Banco tem 12 técnicas SAT na tabela `techniques`. Endpoint irmão `/engine/methodologies` já existia.  
**Solução:** Adicionado `engineRoutes.get('/techniques', ...)` em `apps/api/src/routes/engine.ts`. TC-B4 agora testa o endpoint real.

---

## MÉDIO

### IS-005 · PATCH `/sessions/:id` hardcodeia `methodology: 'MSEF'` no INSERT
**Categoria:** Bug / API  
**Status:** ✅ **RESOLVIDO** (build anterior)  
**Evidência:** Linha no `sessions.ts` — `methodology: 'MSEF'` no `db.insert` ignorava o `body.methodology`.  
**Solução:** Fallback agora usa `body.methodology || 'MSEF v3 (8 etapas ENAP)'`. Pendente: mudar o fallback para o slug `msef` quando IS-002 for resolvido.

### IS-006 · `GET /sessions/:id` retorna campo `mensagens` em português
**Categoria:** API / Consistência  
**Status:** ✅ **RESOLVIDO** (27/05/2026)  
**Evidência:** Todos os outros endpoints usam inglês. `mensagens` quebrava consumers genéricos e scripts de teste.  
**Solução:** Renomeado para `messages` em `apps/api/src/routes/sessions.ts` linha 41.

### IS-007 · Rate limiter de login bloqueia automação
**Categoria:** Infraestrutura / Testing  
**Status:** ✅ **RESOLVIDO** (27/05/2026)  
**Evidência:** Limite de 5 tentativas/15 min por IP bloqueava runs consecutivos do script.  
**Solução:** Condição `if (process.env.TEST_MODE !== 'true' && !checkLoginRateLimit(ip))` em `auth.ts`. Bypass via `TEST_MODE=true`.

### IS-008 · `GET /api/v1/audit?action=login` retorna estrutura não documentada
**Categoria:** API / Segurança  
**Status:** ✅ **RESOLVIDO** (script corrigido, 27/05/2026)  
**Evidência:** Response é `{ logs: [...], total: N, limit: N, offset: N }` — não array simples. Script comparava tamanho de array undefined.  
**Solução:** Script atualizado para usar `b.total ?? b.logs?.length ?? 0`.

### IS-009 · PATCH `/settings/llm-tiers` retorna 400 para admin
**Categoria:** API / Bug  
**Status:** ✅ **RESOLVIDO** (script corrigido, 27/05/2026)  
**Evidência:** Endpoint espera `{ tiers: { economy, premium } }`. Script enviava objeto flat `{ economy, premium }`.  
**Solução:** Payload do script corrigido para envolver em `{ tiers: {...} }`.

### IS-014 · `runAnalysis` não lê metodologia do projeto no banco — depende do corpo do chat
**Categoria:** Arquitetura / Acoplamento  
**Status:** **ABERTO**  
**Evidência:** Linha `const metodologiaName = (body.metodologia as string) || 'MSEF'`. O projeto já contém `methodology` no banco; reler do banco eliminaria o campo obrigatório no body e o risco de dessincronização.  
**Ação:** Em `runAnalysis`, se `existingProject` existe, usar `existingProject.methodology` em vez de `body.metodologia`.

---

## BAIXO / OBSERVAÇÃO

### IS-010 · Role `cliente` bloqueado em `/chat` — timeout em vez de 403
**Categoria:** API / Segurança  
**Status:** ✅ **RESOLVIDO** (27/05/2026)  
**Evidência:** Request levava 10s até `AbortError` em vez de 403 imediato. Verificação de role ocorria dentro do callback `streamSSE`.  
**Solução:** Verificação movida para antes do `streamSSE` em ambas as rotas (`POST /` e `POST /stream`) em `chat.ts`.

### IS-011 · Nomes longos de metodologias aumentam ruído em logs e relatórios
**Categoria:** Produto / UX  
**Status:** **ABERTO**  
**Evidência:** `GBN (Global Business Network - Peter Schwartz)` em vez de `GBN`.  
**Ação:** Decidir convenção: `name` = nome curto/comercial (label), `description` = referência acadêmica completa. Resolve junto com IS-002.

### IS-012 · Rate limiter de análise (5/hora) bloqueia execução da suite de testes
**Categoria:** Infraestrutura / Testing  
**Status:** ✅ **RESOLVIDO** (27/05/2026)  
**Evidência:** Após 5 testes de metodologia, suites SAT, artefatos e exportação falhavam com HTTP 429.  
**Solução:** `rateLimitAnalysis` e `rateLimitExport` em `middleware/rateLimit.ts` agora fazem bypass quando `TEST_MODE=true`. Injetado via `docker-compose.yml`.

### IS-013 · Endpoints KRATOS — path incorreto no script de testes
**Categoria:** Testes / Gap  
**Status:** ✅ **RESOLVIDO** (script corrigido, 27/05/2026)  
**Evidência:** Script usava `POST /api/v1/indicators/:projectId` e campos em inglês. API usa `POST /api/v1/indicators` com campos em PT-BR (`fonte`, `ultimoValor`, `limiarAmarelo`, `limiarVermelho`) e `id` no body para update.  
**Solução:** TC-K1 e TC-K2 reescritos com path e campos corretos.

---

## Correções aplicadas no script de testes (`run-tests.ts`)

| # | Problema | Status |
|---|----------|--------|
| T-01 | `consumeSSE` envia `{ message }` em vez de `{ messages: [{role,content}] }` | ✅ Corrigido |
| T-02 | `consumeSSE` não envia `metodologia` → default 'MSEF' sobrescreve o projeto | ✅ Corrigido |
| T-03 | `consumeSSE` não envia `projectName` nem `vizMode` | ✅ Corrigido |
| T-04 | Parser SSE checa `evt.agentName` mas SSE emite `{ type:'agent', agent: name }` | ✅ Corrigido |
| T-05 | Rate de análise esgota após 5 testes | ✅ Corrigido via IS-012 |

---

## Placar geral

### Rodada inicial (antes dos fixes)
| Suite | Pass | Fail | Observação |
|-------|------|------|------------|
| banco | 5 | 0 | ✅ |
| metodologias | 0 | 6 | IS-001 (body errado) |
| sat | 0 | 7 | IS-012 (rate limit) |
| artefatos | 0 | 5 | IS-012 |
| exportacao | — | — | Pulada por IS-012 |
| seguranca | 3 | 3 | IS-008, IS-009, IS-010 |
| kratos | 0 | 1 | IS-013 (404) |
| **Total** | **8** | **22** | |

### Rodada 2 (após fixes, créditos Anthropic esgotados)
| Suite | Pass | Fail | Observação |
|-------|------|------|------------|
| banco | 5 | 0 | ✅ |
| metodologias | 0 | 6 | Créditos Anthropic esgotados — body IS-001 corrigido |
| sat | 6 | 1 | ✅ TC-B4 era skip, agora testa endpoint real |
| artefatos | 5 | 2 | Progressos em MNEMOSYNE/THEMIS/buscar_dados/PYTHIA |
| exportacao | 2 | 0 | ✅ |
| seguranca | 3 | 0 | ✅ IS-008, IS-009, IS-010 corrigidos |
| kratos | 0 | 3 | TC-K3 pendente créditos |
| **Total** | **21** | **15** | Bloqueio: créditos Anthropic |

---

## Legenda de prioridades
| Nível | Critério |
|-------|----------|
| CRÍTICO | Funcionalidade core quebrada, produto incorreto |
| ALTO | Gap de API ou dado corrompido, afeta múltiplos fluxos |
| MÉDIO | Bug isolado ou inconsistência com impacto previsível |
| BAIXO | Qualidade, convenção, melhoria |
