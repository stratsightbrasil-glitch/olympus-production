# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore the codebase.**

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

Fall back to Grep/Glob/Read only when the graph doesn't cover what you need. The graph auto-updates on file changes via hooks.

---

## Commands

### Development (local Docker)
```bash
# Start all services (API :3333, Web :8080, DB :5432, Ollama :11434)
docker compose up -d

# Rebuild after code changes (compile order: core → tools → db → api)
docker compose build --no-cache api   # API only
docker compose build --no-cache web   # Web only
docker compose build --no-cache api web  # Both

# Restart a container
docker compose restart api

# View logs
docker logs olympus_api --tail 50 -f

# Quick code deploy without full rebuild (dev only — for testing changes)
docker cp apps/api/src/routes/chat.ts olympus_api:/app/apps/api/src/routes/chat.ts
docker exec olympus_api sh -c "cd /app && npx tsc --project apps/api/tsconfig.json"
docker compose restart api
```

### TypeScript
```bash
# Check for errors (zero output = zero errors)
npx tsc --noEmit --project apps/api/tsconfig.json
npx tsc --noEmit --project apps/web/tsconfig.json
npx tsc --noEmit --project packages/core/tsconfig.json

# Build packages (must be in this order due to inter-dependencies)
npm run build --workspace=@olympus/core
npm run build --workspace=@olympus/tools
npm run build --workspace=@olympus/db
npm run build --workspace=@olympus/api
```

### Database
```bash
# Seed the database (upserts agents, methodologies, phases — idempotent)
docker exec olympus_api npx tsx apps/api/src/scripts/seed.ts

# Apply schema changes (use raw SQL, NOT db:push — it tries to drop LangGraph checkpoint tables)
docker exec olympus_db psql -U postgres -d olympus -c "ALTER TABLE ..."

# Run stress test (validates architecture integrity — 10 checkpoints)
docker exec olympus_api npx tsx apps/api/src/scripts/stress_test_v5.ts

# Emergency DB cleanup (hard-delete all projects + orphaned data)
docker exec olympus_db psql -U postgres -d olympus -c "DELETE FROM checkpoint_writes; DELETE FROM checkpoints; DELETE FROM projects;"
```

### Railway (production)
```bash
# Deploy: just push to main — Railway auto-rebuilds
git push origin main

# Run seed on Railway after deploy (service name is olympus-production, not olympus-api)
railway run --service olympus-production npx tsx apps/api/src/scripts/seed.ts
```

---

## Architecture

### Monorepo Structure
```
packages/core/    — OlympusState (LangGraph annotation), Agent.ts (LLM runner)
packages/db/      — Drizzle schema, db client
packages/tools/   — Tavily search, Ollama embeddings (NO @olympus/db import allowed here)
apps/api/         — Hono HTTP API, LangGraph graph, tools, routes, scripts
apps/web/         — React + Vite frontend
```

### LangGraph Pipeline (Olympus 1.0)

The analysis engine is a **2-node LangGraph StateGraph** with PostgreSQL checkpointing:

```
START → phase_loop ──(loop N phases)──→ synthesis → END
```

- **`phase_loop` (`phaseLoopNode`)** — Runs KLIO for the current phase (indexed by `currentPhaseIndex`). Persists a `phase_output` record with `keyFindings`, ATHENA verdict, and a deterministic summary. Calls `interrupt()` for HITL gates or passos mode.
- **`synthesis` (`synthesisNode`)** — HERMES reads all `phase_outputs` for the project and compiles the final report. Has NO tools.

**Routing:** `PHASE_CONFIGS[methodology]` (in `nodes.ts`) drives routing — not `node_slug` from the DB. Only `grumbach` is implemented in Olympus 1.0. Any other methodology throws an explicit error.

**State:** `OlympusStateAnnotation` in `packages/core/src/state.ts`. Key cursor: `currentPhaseIndex` (0-based, null = not started).

### Adding a New Methodology

1. Create `apps/api/src/graph/phase-configs/<slug>.ts` with `PhaseConfig[]` — each phase needs `phaseSlug`, `nodeSlug`, `systemPromptInject`, `allowedTools`, `requiresHitlBefore`.
2. Register in `PHASE_CONFIGS` in `apps/api/src/graph/nodes.ts`.
3. Add the methodology entry in the `defaultMethodologies` array in `apps/api/src/scripts/seed.ts`.
4. Run seed.

### Agents (Olympus 1.0)

| Agent | Role |
|-------|------|
| **KLIO** | Executes all analytical phases via `phaseLoopNode`. Premium tier. 18 tools. |
| **HERMES** | Synthesizes final report from `phase_outputs`. No tools. Detected as orchestrator by name (`this.name === 'HERMES'`), not by tool presence. |
| **ATHENA** | Deterministic quality auditor (`athena-validator.ts`). Called as TypeScript function, never via tool call. |
| **KRATOS** | Autonomous monitoring via pg-boss cron. Runs outside the graph via `runDirectAgent()`. |
| **OLYMPUS** | Stub for Olympus 2.0 — not active. |

### Key Invariants

**NEVER use Zod** in tools or graph nodes. Use pure JSON Schema (`Record<string, any>`). Reason: Zod ≥3.25.68 causes TS2589 with `@langchain/core`.

**`packages/tools` cannot import `@olympus/db`**. Tools with DB access live in `apps/api/src/tools/`.

**Build order is mandatory:** `core → tools → db → api`. The Dockerfile enforces this.

**`db:push` is DANGEROUS** — it tries to drop LangGraph's PostgresSaver tables (`checkpoints`, `checkpoint_blobs`, `checkpoint_migrations`, `checkpoint_writes`). Always apply schema changes via raw SQL with `IF NOT EXISTS` guards.

**Hard delete projects** (`DELETE FROM projects`) cascades to all associated data. The `deletedAt` column exists in the schema but is no longer used (legacy soft-delete removed). Do not re-introduce soft-delete.

**HITL interrupt types:**
- `phase_complete` — passos mode pause after a phase (resumed via `resumeGraph()`)
- `hitl_required` — mandatory gate before a phase (e.g., Grumbach phase 3 FPF approval)
- Both must use `resumeGraph()` on confirmation — **never** `sendMessage()`, which would restart the analysis.

### Project Cleanup on `isResuming=false`

`chat.ts` clears these tables before starting a fresh analysis: `checkpoints`, `checkpoint_writes`, `phase_outputs`, `project_events`, `project_scenarios`. If any are missing, KLIO inherits stale context from previous runs and analyzes the wrong topic.

**On resume (`isResuming=true`):** only deletes `proposed` events older than 1 hour (stale contamination from failed runs). `approved` events (confirmed by analyst at HITL gate) are never touched.

### Phase Config Rules (`apps/api/src/graph/phase-configs/grumbach.ts`)

- **`allowedTools`** controls exactly which tools KLIO can call in a phase. If a tool is missing, KLIO will refuse the phase rather than silently skip the tool. Always verify `allowedTools` matches the `systemPromptInject` requirements.
- **`systemPromptInject` must not describe other phases** — KLIO will hallucinate the methodology structure from its training data if given the opportunity. Every phase inject should include only its own instructions. Use the "REGRA ABSOLUTA — ESCOPO DESTA FASE" guardrail pattern from phase 1 as reference.
- **TAD format is methodology-dependent.** `buildAnchorCtx` (in `helpers.ts`) accepts `methodology` and formats TAD as alphanumeric `[B2]` for `siex`/`alta`/`ceeex`, or semantic `(habitualmente idônea / provavelmente verdadeiro)` for all others. Always pass `state.methodology` when calling it.

### phaseLoopNode — Clock and Cache Invariants

**`phaseStartedAt` uses PostgreSQL clock, not `new Date()`**: `project_events.createdAt` is set by `PostgreSQL defaultNow()`. Using Node.js `new Date()` causes clock skew (50–200ms in Docker) that silently drops events from `keyFindings`. Always capture with `SELECT NOW()`:
```typescript
const tsResult = await db.execute(sql`SELECT NOW() AS ts`);
const phaseStartedAt: Date = (tsResult as any).rows?.[0]?.ts ?? new Date();
```

**Three module-level caches in `nodes.ts`** (5-min TTL each):
- `_klioCache` — KLIO agent row (was 1 DB query × 9 phases = 9 round-trips)
- `_projectNameCache` (keyed by projectId) — project name (same)
- `_toolsCache` (keyed by `projectId:sortedTools`) — built tool closures (16 closures × 9 phases = 144 objects)

Call `invalidateProjectNameCache(projectId)` when updating a project name.

### LLM Configuration

Provider and model come from `platform_settings` table (key: `llm`, `llm_tiers`), not from `.env`. Change via the Settings UI or direct SQL. Default: `gemini-2.5-flash-lite` (economy) / `gemini-2.5-flash` (premium).

`TEST_MODE=true` in `.env` disables all LangGraph `interrupt()` calls — the analysis runs straight through to the final report without any HITL pauses.

### nginx Proxy (localhost)

The `nginx.conf` uses a **static `proxy_pass`** (no `set $var` + resolver). This was intentional: the previous variable-based approach caused intermittent `502` errors because Docker's internal DNS (`127.0.0.11`) failed re-resolution every 10s TTL. The URL is substituted once at container startup by `docker-entrypoint-web.sh`.

### Embedding Dimensions

Ollama `nomic-embed-text` = 768 dims. The schema uses `vector(768)`. Voyage AI support was removed. Do not reintroduce 512-dim embeddings.

### Historical Documentation

`HISTORICO_DESENVOLVIMENTO.md` and `HISTORICO_DESENVOLVIMENTO.html` are canonical records of architectural decisions. **Both must be updated in the same commit** whenever a significant architectural change is made. The `.md` is the source of truth; the `.html` is the human-readable version.

---

## Security Invariants

**Role injection is blocked at registration.** `POST /auth/register` ignores the `role` field in the request body. First user becomes `admin`; all others become `analista`. Only an existing admin can change roles via `PATCH /api/v1/users/:id`.

**Allowed roles are whitelisted.** `users.ts` validates against `['admin', 'analista', 'cliente']` — any other string is rejected with 400.

**`GET /health` is intentionally minimal** — it only returns `{ status, latencyMs, timestamp }`. Do not add version, provider, API key config, or any infrastructure details. That information is reconnaissance for attackers.

**Never use `exec()` or `execPromise()` with string interpolation.** The backup route uses `spawn()` with an argument array for this reason. Shell metacharacters in `DATABASE_URL` would otherwise execute arbitrary commands.

**JWT secret validation at startup.** `index.ts` checks that `JWT_SECRET` is ≥ 32 characters and does not contain obvious patterns (`'secret'`, `'olympus'`, `'2026'`, etc.). In `NODE_ENV=production`, a short secret or `NODE_TLS_REJECT_UNAUTHORIZED=0` causes `process.exit(1)`.

**`consultar_agente` was removed** from all agents in Olympus 1.0. The `isOrchestrator` detection in `Agent.ts` checks by agent name (`this.name === 'HERMES' || this.name === 'OLYMPUS'`) — do not restore the `consultar_agente`-based detection as the sole mechanism.

**Login rate limiting is Postgres-backed.** `checkLoginRateLimitPg` in `middleware/rateLimit.ts` uses the `rateLimitLogs` table keyed by `ip:<address>`. The in-process `Map` bucket approach (used only for `/register`) does not work across multiple API replicas.

**Security headers are applied in two places:** `nginx.conf` (for browser clients via the web proxy) and the Hono middleware at the top of `index.ts` (for direct Railway API access). Keep them in sync. The nginx `proxy_pass` must remain static — do not switch back to `set $var` + resolver, which causes intermittent 502s from Docker DNS failures.

**`onClick={handler}` on buttons that call graph functions passes the React SyntheticEvent as the first argument.** Always wrap: `onClick={() => handler()}`, not `onClick={handler}`. Passing a DOM event to a function that calls `JSON.stringify` causes a circular-structure crash via React Fiber (`stateNode`).
