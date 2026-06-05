# ESTADO REAL DO SISTEMA — OLYMPUS 1.0
**Gerado em:** 05/06/2026 — Sprint 25 concluído · HITL state machine validado · 12 bugs resolvidos · 4 novos identificados
**Commit HEAD:** `4484711` (Sprint 25i — ATHENA checks + fase1 sem FPFs + labels semanticos)
**Método:** queries SQL reais no banco ativo + inspeção do código-fonte + containers + teste end-to-end
**Containers:** olympus_api ✅ healthy · olympus_db ✅ healthy · olympus_web ✅ up · olympus_ollama ✅ healthy

---

## SEÇÃO 1 — AGENTES NO BANCO

| name | type | prompt_len (chars) | Observação |
|------|------|-------------------|-----------|
| ATHENA | expert | 5 838 | `[]` — auditora determinística, chamada como função TS via `athena-validator.ts` |
| HERMES | orchestrator | 1 299 | `[]` — compilador de relatório final. Sem ferramentas. Roda em `synthesisNode`. |
| KLIO | expert | 2 187 | 18 ferramentas — analista monolítico de todas as fases via `phaseLoopNode` |
| KRATOS | expert | 1 214 | `["web_search","buscar_dados_publicos","buscar_sinais","registrar_sinal","atualizar_sentinela"]` |
| OLYMPUS | orchestrator | 332 | Stub — não ativo em Olympus 1.0 |

**Total: 5 agentes.** `consultar_agente` removido de todo o código (Sprint 24 — resíduo ReAct).
Orquestrador detectado por nome: `this.name === 'HERMES' || this.name === 'OLYMPUS'`.

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

### Sprint 24 — PHASE_CONFIGS migrados para o banco

5 novas colunas em `methodology_phases` (Sprint 24):
`system_prompt_inject`, `allowed_tools`, `requires_hitl_before`, `requires_qualitative_audit`, `ats_codes`

**`loadPhaseConfigs(slug)`** em `phase-context.ts` substitui `PHASE_CONFIGS[slug]` em código.
Cache 5 min. Erro descritivo se `systemPromptInject` ausente. `grumbach.ts` marcado `@deprecated`.

### Bloco A — Cenários (9 metodologias)

| slug | phase_configs no banco | Fases DB | Observação |
|------|------------------------|---------|-----------|
| `grumbach` ⭐ | ✅ 9 fases com prompts + tools | 9 | **VALIDADO end-to-end 9 fases (05/Jun/2026)** |
| `esg` | ❌ sem systemPromptInject | 6 | fases no banco, prompts pendentes |
| `godet` | ❌ sem systemPromptInject | 7 | fases no banco, prompts pendentes |
| `mpo` | ❌ sem systemPromptInject | 8 | fases no banco, prompts pendentes |
| `alta` | ❌ sem systemPromptInject | 6 | fases no banco, prompts pendentes |
| `siex` | ❌ sem systemPromptInject | 7 | fases no banco, prompts pendentes |
| `ceeex` | ❌ sem fases no banco | 0 | novo slug — criar fases + prompts |
| `gbn` | ❌ sem fases no banco | 0 | novo slug — criar fases + prompts |
| `ipea_buarque` | ❌ sem fases no banco | 0 | novo slug — criar fases + prompts |

### Bloco B — Planejamento Estratégico (3 stubs, v2.0)

| slug | DB | Observação |
|------|-----|-----------|
| `siplex` | 7 fases | stub — pipeline Olympus 2.0 |
| `grumbach_gestao` | 0 fases | stub |
| `sped` | 0 fases | stub |

### Grumbach — fases (Olympus 1.0 — Sprint 24)

| phase_num | slug | n_tools | requires_hitl_before | label |
|-----------|------|---------|---------------------|-------|
| 1 | grumbach_p1 | 5 | false | Delimitação do Sistema |
| 2 | grumbach_p2 | 8 | false | Varredura de FPFs |
| 3 | grumbach_p3_hitl | 3 | **true** | Seleção de FPFs (HITL) |
| 4 | grumbach_p4 | 3 | false | Delphi — Probabilidades P(i) |
| 5 | grumbach_p5 | 4 | false | Impacto Cruzado P(i\|j) |
| 6 | grumbach_p6 | 2 | false | Seleção das 4 Cenas |
| 7 | grumbach_p7 | 2 | false | Narrativas das 4 Cenas |
| 8 | grumbach_p8 | 5 | false | Indicações Estratégicas |
| 9 | grumbach_p9 | 4 | false | Painel de Monitoramento |

> **Sprint 24 — Fase 4:** prompt reescrito para deixar claro que `tool_grumbach_expert_simulation`
> retorna INSTRUÇÕES (não P(i)). KLIO deve simular as 7 personas e GERAR probabilidades.
> `tool_register_event` adicionado a allowedTools (sem ele os keyFindings da fase ficavam vazios).

---

## SEÇÃO 3 — BANCO DE DADOS

### Tabelas principais

```
Aplicação (26): agent_method_prompts, agents, analytic_reviews, audit_logs,
  embeddings, indicators, matrix_direct_impacts, messages, methodologies,
  methodology_phases ← Sprint 24: +5 colunas phase config,
  methodology_types, phase_outputs, phase_techniques, platform_settings,
  project_events, project_scenarios, projects, rate_limit_logs,
  revoked_tokens, team_members, teams, technique_execution_outputs,
  techniques, tools, users, weak_signals

LangGraph PostgresSaver (4): checkpoint_blobs, checkpoint_migrations,
  checkpoint_writes, checkpoints  ← NÃO tocar no schema Drizzle
```

### Campos-chave Sprint 24 em `methodology_phases`
```sql
system_prompt_inject       TEXT              -- prompt injetado em KLIO por fase
allowed_tools              JSONB NOT NULL DEFAULT '[]'
requires_hitl_before       BOOLEAN NOT NULL DEFAULT FALSE
requires_qualitative_audit BOOLEAN NOT NULL DEFAULT FALSE
ats_codes                  JSONB NOT NULL DEFAULT '[]'
```

### `phase_outputs` — tabela crítica
```sql
id, project_id, phase_slug, node_slug, phase_num, methodology_id,
summary TEXT,          -- ~500 chars, determinístico
key_findings JSONB,    -- [{claim, factStatus, tadScore?, source?}]
tool_call_ids TEXT[],
athena_verdict TEXT,   -- APROVADO | RESSALVAS | REQUER_REVISAO
athena_checks JSONB,
athena_used_llm BOOLEAN
```

### Embeddings
- Dimensão: `vector(768)` — Ollama `nomic-embed-text`
- Voyage AI removido definitivamente
- HNSW index para 768 dims

---

## SEÇÃO 4 — ESTADO DO GRAFO LANGGRAPH

### Topologia (2 nós)
```
START → phase_loop ──(loop N fases)──→ synthesis → END
```

### Roteamento (Sprint 24)
`routeFromStart` e `routeAfterPhase` usam `state.totalPhases` (populado pelo `chat.ts` via `loadPhaseConfigs()` e atualizado pelo `phaseLoopNode` após cada fase).
Fallback `totalPhases = 9` para checkpoints antigos sem o campo.

### Caches module-level em `nodes.ts` (TTL 5 min)
| Cache | Chave | O que elimina |
|-------|-------|--------------|
| `_klioCache` | global | 1 DB query × 9 fases |
| `_projectNameCache` | projectId | 1 DB query × 9 fases |
| `_toolsCache` | `projectId:sortedTools` | 16 closures × 9 fases = 144 objetos |

### Cache em `phase-context.ts` (TTL 5 min)
| Cache | Chave | O que elimina |
|-------|-------|--------------|
| `_phaseConfigCache` | methodologySlug | DB query por fase (antes: 9 queries/análise) |

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

**Sprint 24:** PATCH /settings/llm agora upserta `llm_tiers` automaticamente com defaults do novo provider.

### Tokens (Agent.ts)
| Agente | maxOutputTokens | maxSteps |
|--------|----------------|---------|
| HERMES | 32 000 | 15 |
| KLIO | **8 000** | 12 |
| KLIO (TEST_MODE) | 4 000 | 5 |

---

## SEÇÃO 6 — COMPILAÇÃO

```bash
npx tsc --noEmit --project apps/api/tsconfig.json  → ZERO ERROS ✅
npx tsc --noEmit --project apps/web/tsconfig.json  → ZERO ERROS ✅
stress test: 10/10 ✅ (CP-9: banco, CP-10: erro descritivo)
```

---

## SEÇÃO 7 — DIAGNÓSTICO: ESTADO ATUAL

### ✅ Funcionando (05/Jun/2026 — Sprint 25 concluído)

| Item | Verificação |
|------|-------------|
| TypeScript API + Web | Zero erros ✅ |
| Stress test | 10/10 ✅ (CP-9 banco grumbach, CP-10 erro descritivo esg) |
| **Grumbach end-to-end** | **9 fases executadas com sucesso (teste geopolítica Brasil)** |
| **HITL state machine** | **etapa mode: KLIO propõe → usuário aprova → ATHENA audita aprovados** |
| ATHENA visível no chat | Canal onAthena → mensagem permanente ✅/⚠️/❌ por fase + checks array com ATS codes |
| **ATHENA timing correto** | **Audit APÓS interrupt (pós-resumeGraph), não antes** |
| Fase 1 — linchpin | declarar_julgamento cria project_event "Premissa-Linchpin" |
| Fase 2 — FPFs únicos | Fase 1 sem tool_register_event, fase 2 é única a registrar FPFs |
| Fase 4 Delphi | Prompt corrigido — KLIO gera P(i) após tool retorna instruções |
| Fases 5-9 eventos | KeyFinding.description opcional + mapeado, ATS2 checks funcionam |
| **Event panel labels** | **Semânticas: Delphi P(i), Cenário, Narrativa, Signpost, Linchpin em vez de "FPF"** |
| Phase configs no banco | loadPhaseConfigs('grumbach') ✅ 9 fases, prompts OK |
| nginx auto-healing | resolver 127.0.0.11 valid=300s — auto-heals após restart Docker |
| **Rate limit analysis** | **30/hora (etapa mode ≈19 POSTs por análise completa)** |
| Fix resume (isResuming) | sendMessage() bloqueado durante hitlGate |
| Importar escopo via arquivo | POST /sessions/parse-scope + botão no modal |
| **vizMode default** | **'etapa' (per-fase com aprovação)** |
| **vizMode alternativa** | **'passagem' (totalmente autônoma, auto-aprova todos)** |
| tier mismatch | PATCH /settings/llm upserta llm_tiers automaticamente |
| Railway seed | Executado em 05/Jun/2026 — banco Railway sincronizado |
| **Phase counter SSE** | **Rastreado APENAS via 'athena' event, nunca via hitl_gate** |

### 🔲 Pendências — Sprint 25+

| # | Item | Prioridade | Observação |
|---|------|-----------|-----------|
| **P1-A** | **ATHENA reprova fase 1 com dados incompletos (mesmo pós-fix)** | 🔴 CRÍTICO | Investigar: status='approved' setado no PATCH? |
| **P1-B** | **Varredura FPF fracionada em fase 2** | 🔴 CRÍTICO | KLIO emitindo `tool_register_event` incrementalmente vs. em batch? |
| **P1-C** | **Visualização gráfica Delphi P(i)** | 🔴 CRÍTICO | Matriz FPFs × P(i) com qualificadores Hendrikson |
| **P1-D** | **Visualização gráfica Impactos Cruzados** | 🔴 CRÍTICO | Heatmap 5×5 Motricidade × Dependência |
| **P1-E** | **Fase 6 reprovações cascata Fase 7** | 🔴 CRÍTICO | buildAnchorCtx deve filtrar scenarios reprovados? |
| P2 | **HERMES compilar relatório final** | 🟡 | 9 fases validadas; falta testar synthesisNode com fase_outputs completos |
| P3 | **PHASE_CONFIGS para ceeex** | 🟡 | 2ª prioridade após bugs Sprint 25 resolvidos; 70% estrutura Grumbach reutilizável |
| P4 | **ATHENA LLM qualitativo** | 🟢 | `runQualitativeAudit()` retorna stub; implementar em 1.1 |
| P5 | **PHASE_CONFIGS demais metodologias** | 🟢 | godet, esg, mpo, alta, siex, gbn, ipea_buarque — template reutilizável após bugs P1 resolvidos |
| P6 | **Paginação sessions list** | 🟢 | Hard cap 200 itens |
| P7 | **Renomear "Cena" → "Cenário"** | 🟢 | Correção terminológica em systemPromptInject fase 6-7 |

### ⚠️ Bugs conhecidos

| # | Descrição | Arquivo | Status |
|---|-----------|---------|--------|
| B3 | Fases somem da tela após mensagem ATHENA | Histórico de mensagens | Investigação pendente |
| RAG | RAG inoperante localmente (índice HNSW pode precisar rebuild) | schema.ts | Banco vazio = OK por ora |

---

*Gerado por Claude Sonnet 4.6 — 05/06/2026 — Sprint 25 concluído · Olympus 1.0*
*Grumbach 9 fases validado end-to-end · HITL state machine sólido · TypeScript zero erros · 12 bugs resolvidos*
*4 bugs novos identificados via teste geopolítica Brasil; diagnóstico e roadmap em SPRINT_25_DIAGNOSTICO_FINAL.md*
