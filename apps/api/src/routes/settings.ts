import { Hono } from 'hono';
import { db } from '@olympus/db';
import { sql } from 'drizzle-orm';

const settingsRoutes = new Hono();

// Fallback compilado — usado quando platform_settings.anthropic_models não existe
export const ANTHROPIC_MODELS_DEFAULT = [
  { id: 'claude-opus-4-7',    label: 'Claude Opus 4'     },
  { id: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

// Lê lista de modelos do banco; cai no fallback se não houver registro
async function getAnthropicModels(): Promise<{ id: string; label: string }[]> {
  try {
    const result = await db.execute(
      sql`SELECT value FROM platform_settings WHERE key = 'anthropic_models'`
    );
    const rows = (result as any).rows ?? result;
    const row = rows[0];
    if (row?.value) {
      const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* fallback */ }
  return ANTHROPIC_MODELS_DEFAULT;
}

// Re-exportado para compatibilidade com imports existentes
export const ANTHROPIC_MODELS = ANTHROPIC_MODELS_DEFAULT;

// ── Helper: ler configuração LLM do banco (com fallback para env vars) ─────────
export async function getLLMConfig(): Promise<{ provider: string; model: string }> {
  try {
    const result = await db.execute(
      sql`SELECT value FROM platform_settings WHERE key = 'llm'`
    );
    const rows = (result as any).rows ?? result;
    const row = rows[0];
    if (row?.value) {
      return typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    }
  } catch { /* tabela ainda não criada ou query falhou */ }
  return {
    provider: process.env.LLM_PROVIDER || 'anthropic',
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-7',
  };
}

// ── Helper: busca modelos Ollama disponíveis ──────────────────────────────────
async function getOllamaModels(): Promise<{ available: boolean; models: { id: string; size?: number }[] }> {
  const baseURL = (process.env.OLLAMA_BASE_URL || 'http://ollama:11434/v1').replace(/\/v1\/?$/, '');
  try {
    const res = await fetch(`${baseURL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as any;
    const models = (data.models || []).map((m: any) => ({ id: m.name, size: m.size }));
    return { available: true, models };
  } catch {
    return { available: false, models: [] };
  }
}

// ── GET /api/v1/settings ── lê configurações (qualquer usuário autenticado) ────
settingsRoutes.get('/', async (c) => {
  const [llm, ollama, anthropicModels] = await Promise.all([
    getLLMConfig(),
    getOllamaModels(),
    getAnthropicModels(),
  ]);
  return c.json({
    llm,
    anthropicModels,
    ollamaModels: ollama.models,
    ollamaAvailable: ollama.available,
  });
});

// ── PATCH /api/v1/settings/llm ── altera provedor LLM (admin only) ─────────────
settingsRoutes.patch('/llm', async (c) => {
  const payload = c.get('jwtPayload') as any;
  if (!payload || payload.role !== 'admin') {
    return c.json({ error: 'Apenas administradores podem alterar o provedor LLM.' }, 403);
  }

  const body = await c.req.json() as any;
  const { provider, model } = body;

  if (!['anthropic', 'ollama'].includes(provider)) {
    return c.json({ error: `Provedor inválido: ${provider}` }, 400);
  }
  if (!model || typeof model !== 'string') {
    return c.json({ error: 'Campo "model" obrigatório.' }, 400);
  }

  const value = JSON.stringify({ provider, model });
  await db.execute(sql`
    INSERT INTO platform_settings (key, value, updated_at)
    VALUES ('llm', ${value}::jsonb, NOW())
    ON CONFLICT (key)
    DO UPDATE SET value = ${value}::jsonb, updated_at = NOW()
  `);

  return c.json({ ok: true, llm: { provider, model } });
});

// ── PATCH /api/v1/settings/anthropic-models ── atualiza lista sem rebuild ──────
settingsRoutes.patch('/anthropic-models', async (c) => {
  const payload = c.get('jwtPayload') as any;
  if (!payload || payload.role !== 'admin') {
    return c.json({ error: 'Apenas administradores podem alterar a lista de modelos.' }, 403);
  }
  const body = await c.req.json() as any;
  const models: { id: string; label: string }[] = body.models;
  if (!Array.isArray(models) || models.some(m => !m.id || !m.label)) {
    return c.json({ error: 'Campo "models" deve ser array de { id, label }.' }, 400);
  }
  const value = JSON.stringify(models);
  await db.execute(sql`
    INSERT INTO platform_settings (key, value, updated_at)
    VALUES ('anthropic_models', ${value}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${value}::jsonb, updated_at = NOW()
  `);
  return c.json({ ok: true, models });
});

// ── GET /api/v1/settings/ollama-models ── mantido para compatibilidade ────────
settingsRoutes.get('/ollama-models', async (c) => {
  const result = await getOllamaModels();
  return c.json(result);
});

// ── GET /api/v1/settings/kronos-cooldown ─────────────────────────────────────
settingsRoutes.get('/kronos-cooldown', async (c) => {
  try {
    const result = await db.execute(
      sql`SELECT value FROM platform_settings WHERE key = 'kronos_cooldown_ms'`
    );
    const rows = (result as any).rows ?? result;
    const ms = rows.length > 0 ? Number(rows[0].value) : 15000;
    return c.json({ kronos_cooldown_ms: ms });
  } catch {
    return c.json({ kronos_cooldown_ms: 15000 });
  }
});

// ── PATCH /api/v1/settings/kronos-cooldown ────────────────────────────────────
settingsRoutes.patch('/kronos-cooldown', async (c) => {
  const payload = c.get('jwtPayload') as any;
  if (!payload || payload.role !== 'admin') {
    return c.json({ error: 'Apenas administradores podem alterar configurações.' }, 403);
  }
  const body = await c.req.json() as any;
  const ms = Number(body.kronos_cooldown_ms);
  if (!Number.isFinite(ms) || ms < 1000 || ms > 300_000) {
    return c.json({ error: 'kronos_cooldown_ms deve ser entre 1000 e 300000 ms.' }, 400);
  }
  const value = String(ms);
  await db.execute(sql`
    INSERT INTO platform_settings (key, value, updated_at)
    VALUES ('kronos_cooldown_ms', ${value}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${value}::jsonb, updated_at = NOW()
  `);
  return c.json({ ok: true, kronos_cooldown_ms: ms });
});

export default settingsRoutes;
