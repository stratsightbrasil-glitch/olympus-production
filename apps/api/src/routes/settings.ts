import { Hono } from 'hono';
import { db } from '@olympus/db';
import { sql } from 'drizzle-orm';

const settingsRoutes = new Hono();

// ── Modelos Anthropic disponíveis para seleção ─────────────────────────────────
export const ANTHROPIC_MODELS = [
  { id: 'claude-opus-4-7',    label: 'Claude Opus 4'     },
  { id: 'claude-sonnet-4-5',  label: 'Claude Sonnet 4.5' },
  { id: 'claude-haiku-4-5',   label: 'Claude Haiku 4.5'  },
];

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

// ── GET /api/v1/settings ── lê configurações (qualquer usuário autenticado) ────
settingsRoutes.get('/', async (c) => {
  const llm = await getLLMConfig();
  return c.json({ llm, anthropicModels: ANTHROPIC_MODELS });
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

// ── GET /api/v1/settings/ollama-models ── modelos instalados no Ollama ─────────
settingsRoutes.get('/ollama-models', async (c) => {
  const baseURL = (process.env.OLLAMA_BASE_URL || 'http://ollama:11434/v1')
    .replace(/\/v1\/?$/, '');
  try {
    const res = await fetch(`${baseURL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json() as any;
    const models = (data.models || []).map((m: any) => ({
      id:   m.name,
      size: m.size,
    }));
    return c.json({ available: true, models });
  } catch (e: any) {
    return c.json({ available: false, models: [], error: e.message });
  }
});

export default settingsRoutes;
