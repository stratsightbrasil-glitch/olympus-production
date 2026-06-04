# ESTADO REAL DO SISTEMA — OLYMPUS 1.0
**Gerado em:** 04/06/2026 — Pós Sprint 23 (auditoria sec + perf + bugs)
**Commit HEAD:** `7c22f52` (docs CLAUDE.md) · `3164e7e` (fix Railway fase 3 + KLIO) · `c0ac0d0` (8 bugs Grumbach)
**Método:** queries SQL reais no banco ativo + inspeção do dist compilado + containers
**Containers:** olympus_api ✅ healthy · olympus_db ✅ healthy · olympus_web ✅ up · olympus_ollama ✅ healthy

---

## SEÇÃO 1 — AGENTES NO BANCO

| name | type | prompt_len (chars) | Observação |
|------|------|-------------------|-----------|
| ATHENA | expert | 5 838 | `[]` — auditora determinística, chamada como função TS |
| HERMES | orchestrator | 1 299 | `[]` — compilador de relatório final (sem ferramentas) |
| KLIO | expert | **2 187** | 18 ferramentas — analista monolítico de todas as fases |
| KRATOS | expert | 1 214 | `["web_search","buscar_dados_publicos","buscar_sinais","registrar_sinal","atualizar_sentinela"]` |
| OLYMPUS | orchestrator | 332 | stub — não ativo em 1.0 |

**Total: 5 agentes.** KLIO prompt cresceu de 1.441 → 2.187 chars no Sprint 23: adicionados guardrail de objeto de análise, regra de escopo por fase (não descrever outras fases), e regra FIRST-STEP removida (conflitava com PHASE_CONFIGS).

### KLIO — toolsConfig (18 ferramentas)
```json
["tool_unified_search_engine","web_search","buscar_dados_publicos",
 "buscar_documentos_internos","avaliar_fonte","declarar_julgamento",
 "registrar_hipotese_alternativa","registrar_sinal","buscar_sinais",
 "tool_register_event","tool_register_impact_relation",
 "tool_tad_score_calculator","tool_mpc_source_evaluator",
 "tool_grumbach_expert_simulation","tool_mactor_analysis",
 "tool_esg_rii_calculator","tool_mpo_backcasting","tool_register_scenario"]
```

---

## SEÇÃO 2 — METODOLOGIAS E FASES

### Bloco A — Cenários (9 metodologias, v1.0)

| slug | PHASE_CONFIGS | Fases DB | Observação |
|------|--------------|---------|-----------|
| `grumbach` ⭐ | ✅ 9 fases implementadas | 9 | **CASO DE VALIDAÇÃO 1.0** |
| `ceeex` | ❌ erro explícito | 0 | novo slug — sem fases DB ainda |
| `esg` | ❌ erro explícito | 6 | phases no banco, sem phase-configs |
| `godet` | ❌ erro explícito | 7 | phases no banco, sem phase-configs |
| `gbn` | ❌ erro explícito | 0 | novo slug — sem fases DB ainda |
| `alta` | ❌ erro explícito | 6 | phases no banco, sem phase-configs |
| `ipea_buarque` | ❌ erro explícito | 0 | novo slug — sem fases DB ainda |
| `mpo` | ❌ erro explícito | 8 | phases no banco, sem phase-configs |
| `siex` | ❌ erro explícito | 7 | phases no banco, sem phase-configs |

### Bloco B — Planejamento Estratégico (3 stubs, v2.0)

| slug | DB | Observação |
|------|-----|-----------|
| `siplex` | ✅ 7 fases | stub — pipeline Olympus 2.0 |
| `grumbach_gestao` | 0 fases | stub |
| `sped` | 0 fases | stub |

### Grumbach — fases em detalhe (Olympus 1.0 — Sprint 23)

| phase_num | slug | node_slug | label |
|-----------|------|-----------|-------|
| 1 | grumbach_p1 | node_framing | Delimitação do Sistema |
| 2 | grumbach_p2 | node_scanning_macro | Varredura de FPFs |
| 3 | grumbach_p3_hitl | node_scanning_forces | Seleção de FPFs (HITL) |
| 4 | grumbach_p4 | node_modeling | Delphi — Probabilidades P(i) |
| 5 | grumbach_p5 | node_modeling | Impacto Cruzado P(i\|j) |
| 6 | grumbach_p6 | node_matrix_design | Seleção das 4 Cenas |
| 7 | grumbach_p7 | node_narrative | Narrativas das 4 Cenas |
| 8 | grumbach_p8 | node_integration | Indicações Estratégicas |
| 9 | grumbach_p9 | node_integration | Painel de Monitoramento |

> **Sprint 23 fix — fase 3:** `allowedTools` agora inclui `tool_register_event` (estava ausente, causando recusa da fase no Railway). Prompt reescrito com instrução explícita de como registrar cada persona.

---

## SEÇÃO 3 — BANCO DE DADOS

### Tabelas principais (30 total)

```
Aplicação (26): agent_method_prompts, agents, analytic_reviews, audit_logs,
  embeddings, indicators, matrix_direct_impacts, messages, methodologies,
  methodology_phases, methodology_types, phase_outputs ← NOVO v1.0,
  phase_techniques, platform_settings, project_events, project_scenarios,
  projects, rate_limit_logs, revoked_tokens, team_members, teams,
  technique_execution_outputs, techniques, tools, users, weak_signals

LangGraph PostgresSaver (4): checkpoint_blobs, checkpoint_migrations,
  checkpoint_writes, checkpoints  ← NÃO tocar no schema Drizzle
```

### Estado atual do banco local

| Tabela | Linhas | Observação |
|--------|--------|-----------|
| projects | 1 | análise em andamento |
| phase_outputs | 2 | fases 1–2 concluídas |
| project_events | 19 | FPFs registrados nas fases |
| checkpoints | 4 | PostgresSaver ativo |

### Novos campos em `methodologies` (Sprint 22)
```
methodology_type        TEXT DEFAULT 'cenarios'
implementation_status   TEXT DEFAULT 'v1.0'
parent_relation         TEXT
source_documents        JSONB DEFAULT '[]'
```

### `phase_outputs` — tabela crítica do v1.0
```sql
id, project_id, phase_slug, node_slug, phase_num, methodology_id,
summary TEXT,          -- ~500 chars, determinístico (não gerado por LLM)
key_findings JSONB,    -- [{claim, factStatus, tadScore?, source?}]
tool_call_ids TEXT[],
athena_verdict TEXT,   -- APROVADO | RESSALVAS | REQUER_REVISAO
athena_checks JSONB,
athena_used_llm BOOLEAN
```

### Embeddings
- Dimensão: `vector(768)` — Ollama `nomic-embed-text`
- Voyage AI removido definitivamente
- HNSW index recriado para 768 dims

---

## SEÇÃO 4 — ESTADO DO GRAFO LANGGRAPH

### Topologia (2 nós)
```
START → phase_loop ──(loop N fases)──→ synthesis → END
```

### PHASE_CONFIGS (código, não banco)
```typescript
{ grumbach: GRUMBACH_PHASES }  // único implementado em 1.0
// outros slugs → throw explícito com mensagem clara
```

### Caches module-level em `nodes.ts` (Sprint 23, TTL 5min)
| Cache | Chave | O que elimina |
|-------|-------|--------------|
| `_klioCache` | global | 1 DB query × 9 fases = 9 round-trips |
| `_projectNameCache` | projectId | idem |
| `_toolsCache` | `projectId:sortedTools` | 16 closures × 9 fases = 144 objetos |

### Cursor de estado
- `currentPhaseIndex`: 0-based, null = não iniciado (v5)
- `currentNodeSlug`: legado v4 — mantido para compat SSE

---

## SEÇÃO 5 — VERSÕES E CONFIGURAÇÃO

| Pacote | Versão |
|--------|--------|
| `@langchain/langgraph` | ^1.3.2 |
| `@langchain/langgraph-checkpoint-postgres` | ^1.0.1 |
| `ai` (Vercel AI SDK) | ^6.0.168 |
| `drizzle-orm` | ^0.45.2 |
| `hono` | ^4.3.7 |

### Platform settings (banco local)
| key | value |
|-----|-------|
| `llm` | `{"provider": "google", "model": "gemini-2.5-flash-lite"}` |
| `llm_tiers` | `{"economy": "gemini-2.5-flash-lite", "premium": "gemini-2.5-flash"}` |

### Variáveis de ambiente relevantes
- `TEST_MODE=false` — interrupts ativos, análise para em cada fase (passos mode)
- `NODE_TLS_REJECT_UNAUTHORIZED` — comentado no .env local; bloqueado em produção
- `JWT_SECRET` — rotacionado em 04/Jun/2026 (≥32 chars, seguro)

---

## SEÇÃO 6 — COMPILAÇÃO

```bash
npx tsc --noEmit --project apps/api/tsconfig.json  → ZERO ERROS ✅
npx tsc --noEmit --project apps/web/tsconfig.json  → ZERO ERROS ✅
```

---

## SEÇÃO 7 — DIAGNÓSTICO: ESTADO ATUAL

### ✅ Funcionando

| Item | Verificação |
|------|-------------|
| TypeScript API + Web | Zero erros (confirmado) |
| Grumbach fase 1-2 | 2 phase_outputs no banco da análise atual |
| Google Gemini | Análises executando com gemini-2.5-flash |
| HITL fase 3 | `tool_register_event` disponível (fix Sprint 23) |
| Guardrail fase-count | KLIO não lista outras fases (fix Sprint 23) |
| Circular JSON fix | `onClick={() => onResume?.()}` (fix Sprint 23) |
| MPC por metodologia | Semântico (grumbach) vs alfanumérico (siex/alta/ceeex) |
| Security headers | nginx + Hono middleware |
| Login rate limit | Postgres-backed, 5/15min por IP |
| Hard delete | CASCADE para todos os dados associados |
| Seed Railway | Executado em 04/Jun/2026 — banco Railway sincronizado |

### 🔲 Pendências

| # | Item | Prioridade | Observação |
|---|------|-----------|-----------|
| P1 | **Validação completa Grumbach 9 fases** | 🔴 | Fases 1-2 OK; ainda não testado fases 3-9 end-to-end |
| P2 | **PHASE_CONFIGS para ceeex** | 🟡 | Segunda após Grumbach validado; compartilha 70% da estrutura |
| P3 | **ATHENA LLM qualitativo** | 🟡 | `runQualitativeAudit()` retorna stub; implementar em 1.1 |
| P4 | **Endpoint GET /api/v1/phases/:projectId** | 🟡 | Necessário para Tela ATHENA e Lastro na UI |
| P5 | **Paginação sessions list** | 🟢 | Hard cap 200 itens; cursor-based pagination para escala |
| P6 | **PHASE_CONFIGS demais metodologias** | 🟢 | Bloco A: godet, esg, mpo, alta, siex, gbn, ipea_buarque |

### ⚠️ Bugs conhecidos (menores, não bloqueadores)

| # | Descrição | Arquivo |
|---|-----------|---------|
| B1 | Fase 1 mostra fases do Grumbach erradas — **somente se Railway não tiver o seed atualizado** | Seed Railway foi rodado: OK ✅ |
| B2 | HERMES aparece após KLIO durante análise (display issue, não lógica) | Investigação pendente |
| B3 | Fases 1 e 2 somem da tela após mensagem ATHENA | Histórico de mensagens — investigação pendente |
| B4 | RAG inoperante (vector(512) resolvido → vector(768), mas índice HNSW pode precisar rebuild) | Banco vazio = OK por ora |

---

*Gerado por Claude Sonnet 4.6 — 04/06/2026 — Sprint 23 · Olympus 1.0*
*Queries SQL executadas em `olympus_db` (postgres/olympus) · Containers inspecionados via `docker exec`*
