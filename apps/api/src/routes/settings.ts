import { Hono } from 'hono';
import { db } from '@olympus/db';
import { sql } from 'drizzle-orm';

const settingsRoutes = new Hono();

// Fallback compilado — usado quando platform_settings.anthropic_models não existe
export const ANTHROPIC_MODELS_DEFAULT = [
  { id: 'claude-opus-4-7',              label: 'Claude Opus 4'       },
  { id: 'claude-sonnet-4-6',            label: 'Claude Sonnet 4.6'   },
  { id: 'claude-haiku-4-5-20251001',    label: 'Claude Haiku 4.5'    },
];

// Modelos alternativos por provider (para UI de Settings futura)
export const GOOGLE_MODELS_DEFAULT = [
  { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash (premium)' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite'      },
  { id: 'gemini-2.5-pro',        label: 'Gemini 2.5 Pro'             },
];

export const DEEPSEEK_MODELS_DEFAULT = [
  { id: 'deepseek-chat',                label: 'DeepSeek V3'         },  // ~6x mais barato que Haiku
  { id: 'deepseek-reasoner',            label: 'DeepSeek R1 (raciocínio)' },
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
    // Padrão de desenvolvimento: Haiku — mais barato, suficiente para a maioria dos agentes.
    // Para produção com raciocínio mais elaborado, configure ANTHROPIC_MODEL=claude-sonnet-4-6
    // ou use a UI de Settings para ajustar os tiers premium/economy.
    model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
  };
}

// ── Helper: carregar mapeamento de tiers de modelo ────────────────────────────
// tier labels ('economy', 'premium') → IDs de modelo Anthropic
// Armazenado em platform_settings.llm_tiers como JSONB.
//
// Tiers padrão (desenvolvimento):
//   economy → Haiku   (SCOPUS, KRATOS — tarefas estruturadas)
//   premium → Haiku   (PYTHIA, MNEMOSYNE, THEMIS, ATHENA — em dev; Sonnet em produção)
//
// Para habilitar raciocínio premium em produção, via UI de Settings:
//   PATCH /api/v1/settings/llm-tiers  { tiers: { economy: 'claude-haiku-4-5-20251001',
//                                                  premium: 'claude-sonnet-4-6' } }
export async function getLLMTiers(): Promise<Record<string, string>> {
  try {
    const result = await db.execute(
      sql`SELECT value FROM platform_settings WHERE key = 'llm_tiers'`
    );
    const rows = (result as any).rows ?? result;
    const row = rows[0];
    if (row?.value) {
      const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }
  } catch { /* fallback */ }
  // Fallback seguro: ambos os tiers apontam para Haiku — evita string literal 'economy'/'premium'
  // chegar ao SDK da Anthropic como nome de modelo inválido.
  return {
    economy: 'claude-haiku-4-5-20251001',
    premium: 'claude-haiku-4-5-20251001',
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
  const [llm, ollama, anthropicModels, llmTiers] = await Promise.all([
    getLLMConfig(),
    getOllamaModels(),
    getAnthropicModels(),
    getLLMTiers(),
  ]);
  return c.json({
    llm,
    anthropicModels,
    googleModels:   GOOGLE_MODELS_DEFAULT,
    deepseekModels: DEEPSEEK_MODELS_DEFAULT,
    ollamaModels:   ollama.models,
    ollamaAvailable: ollama.available,
    llmTiers,
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

  if (!['anthropic', 'google', 'deepseek', 'ollama'].includes(provider)) {
    return c.json({ error: `Provedor inválido: ${provider}. Suportados: anthropic, google, deepseek, ollama.` }, 400);
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

// ── PATCH /api/v1/settings/llm-tiers ── mapeia tier labels → model IDs (admin) ─
settingsRoutes.patch('/llm-tiers', async (c) => {
  const payload = c.get('jwtPayload') as any;
  if (!payload || payload.role !== 'admin') {
    return c.json({ error: 'Apenas administradores podem alterar os tiers de modelo.' }, 403);
  }
  const body = await c.req.json() as any;
  const tiers = body.tiers as Record<string, string>;
  if (!tiers || typeof tiers !== 'object' || Array.isArray(tiers)) {
    return c.json({ error: 'Campo "tiers" deve ser um objeto { tierLabel: modelId }.' }, 400);
  }
  const VALID_TIERS = ['economy', 'premium'];
  for (const k of Object.keys(tiers)) {
    if (!VALID_TIERS.includes(k)) {
      return c.json({ error: `Tier inválido: "${k}". Tiers suportados: ${VALID_TIERS.join(', ')}` }, 400);
    }
  }
  const value = JSON.stringify(tiers);
  await db.execute(sql`
    INSERT INTO platform_settings (key, value, updated_at)
    VALUES ('llm_tiers', ${value}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${value}::jsonb, updated_at = NOW()
  `);
  return c.json({ ok: true, llmTiers: tiers });
});

// ── GET /api/v1/settings/ollama-models ── mantido para compatibilidade ────────
settingsRoutes.get('/ollama-models', async (c) => {
  const result = await getOllamaModels();
  return c.json(result);
});

// ── GET /api/v1/settings/kratos-cooldown ─────────────────────────────────────
settingsRoutes.get('/kratos-cooldown', async (c) => {
  try {
    const result = await db.execute(
      sql`SELECT value FROM platform_settings WHERE key = 'kratos_cooldown_ms'`
    );
    const rows = (result as any).rows ?? result;
    const ms = rows.length > 0 ? Number(rows[0].value) : 15000;
    return c.json({ kratos_cooldown_ms: ms });
  } catch {
    return c.json({ kratos_cooldown_ms: 15000 });
  }
});

// ── PATCH /api/v1/settings/kratos-cooldown ────────────────────────────────────
settingsRoutes.patch('/kratos-cooldown', async (c) => {
  const payload = c.get('jwtPayload') as any;
  if (!payload || payload.role !== 'admin') {
    return c.json({ error: 'Apenas administradores podem alterar configurações.' }, 403);
  }
  const body = await c.req.json() as any;
  const ms = Number(body.kratos_cooldown_ms);
  if (!Number.isFinite(ms) || ms < 1000 || ms > 300_000) {
    return c.json({ error: 'kratos_cooldown_ms deve ser entre 1000 e 300000 ms.' }, 400);
  }
  const value = String(ms);
  await db.execute(sql`
    INSERT INTO platform_settings (key, value, updated_at)
    VALUES ('kratos_cooldown_ms', ${value}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${value}::jsonb, updated_at = NOW()
  `);
  return c.json({ ok: true, kratos_cooldown_ms: ms });
});

// ── GET /api/v1/settings/cache/status — estado do cache de metodologias (admin) ─
settingsRoutes.get('/cache/status', async (c) => {
  const payload = c.get('jwtPayload') as any;
  if (!payload || payload.role !== 'admin') {
    return c.json({ error: 'Apenas administradores podem ver o status do cache.' }, 403);
  }
  const { getMethodologyCacheStatus } = await import('../services/analysis.service.js');
  return c.json(getMethodologyCacheStatus());
});

// ── POST /api/v1/settings/cache/invalidate — limpa cache de metodologias (admin) ─
settingsRoutes.post('/cache/invalidate', async (c) => {
  const payload = c.get('jwtPayload') as any;
  if (!payload || payload.role !== 'admin') {
    return c.json({ error: 'Apenas administradores podem invalidar o cache.' }, 403);
  }
  const { invalidateMethodologyCache } = await import('../services/analysis.service.js');
  invalidateMethodologyCache();
  return c.json({ ok: true, clearedAt: new Date().toISOString() });
});

export default settingsRoutes;
