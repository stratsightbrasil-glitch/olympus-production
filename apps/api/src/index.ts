// Estende os timeouts do undici (Node.js 20 usa o mesmo módulo para globalThis.fetch).
// Necessário para Ollama: o modelo pode demorar vários minutos para carregar na memória
// antes de enviar o primeiro byte de resposta (HeadersTimeoutError com default de ~30s).
import { setGlobalDispatcher, Agent } from 'undici';
setGlobalDispatcher(new Agent({
  headersTimeout: 15 * 60 * 1000,  // 15 min — tempo para o modelo carregar
  bodyTimeout:    30 * 60 * 1000,  // 30 min — tempo para completar a geração
  connectTimeout: 60 * 1000,       // 1 min  — tempo para estabelecer conexão TCP
}));

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from 'dotenv';
import { jwt } from 'hono/jwt';
import path from 'path';
import { db, users, platformSettings, revokedTokens } from '@olympus/db';
import { eq, sql } from 'drizzle-orm';

// Força o carregamento do .env localizado na raiz do monorepo
config({ path: path.resolve(__dirname, '../../../.env') });

// ── Startup guard ────────────────────────────────────────────────────────────
// Rejeita subida do processo se variáveis obrigatórias de segurança estiverem
// ausentes. Falhar em startup é muito melhor que operar com segredos hardcoded.
const REQUIRED_ENV = ['JWT_SECRET', 'ALLOWED_ORIGIN'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[STARTUP] ❌ Variável de ambiente obrigatória ausente: ${key}`);
    console.error(`[STARTUP]    Adicione ${key} ao arquivo .env antes de iniciar.`);
    process.exit(1);
  }
}

import chatRoutes from './routes/chat';
import extractRoutes from './routes/extract';
import sessionsRoutes from './routes/sessions';
import exportRoutes from './routes/export';
import painelRoutes from './routes/painel';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import { reloadCronJobs } from './cron';
import engineRoutes from './routes/engine';
import { sendEmail } from './mailer';
import backupRoute from './routes/backup';
import indicatorsRoutes from './routes/indicators';
import embeddingsRoutes from './routes/embeddings';
import docsRoutes from './routes/docs';
import signalsRouter from './routes/signals';
import reviewsRouter from './routes/reviews';
import kratosRoutes from './routes/kratos';
import settingsRoutes from './routes/settings';
import teamsRoutes from './routes/teams';
import playbookRoutes from './routes/playbook';
import auditRoutes from './routes/audit';
import eventsRoutes from './routes/events';
import { rateLimitAnalysis, rateLimitExport } from './middleware/rateLimit';

const app = new Hono();

// Logger filtrado — suprime health-checks /ping do output para não poluir os logs
const logMiddleware = logger();
app.use('*', async (c, next) => {
  if (c.req.path === '/ping') return next();
  return logMiddleware(c, next);
});
app.use('*', cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:8080',
}));

app.get('/ping', (c) => c.json({ status: 'ok', message: 'OLYMPUS API v2.0 rodando com Hono!' }));

app.get('/health', async (c) => {
  const start = Date.now();
  let dbStatus = 'disconnected';
  try {
    await db.execute(sql`SELECT 1`);
    dbStatus = 'connected';
  } catch { /* */ }
  const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY;
  const tavilyConfigured    = !!process.env.TAVILY_API_KEY;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('../../../package.json');
  let llmProvider = process.env.LLM_PROVIDER || 'anthropic';
  try {
    const { getLLMConfig } = await import('./routes/settings.js');
    const cfg = await getLLMConfig();
    llmProvider = cfg.provider;
  } catch { /* não bloquear o health se a leitura falhar */ }
  return c.json({
    status:    dbStatus === 'connected' ? 'ok' : 'degraded',
    version:   pkg?.version || '4.0.0',
    database:  dbStatus,
    anthropic: anthropicConfigured ? 'configured' : 'not_configured',
    tavily:    tavilyConfigured    ? 'configured' : 'not_configured',
    llm:       llmProvider,
    uptime:    Math.floor(process.uptime()),
    latencyMs: Date.now() - start,
    timestamp: new Date().toISOString(),
  });
});

// Rotas públicas de Autenticação
app.route('/api/v1/auth', authRoutes);

// Proteção JWT nas rotas privadas
const authMiddleware = jwt({ secret: process.env.JWT_SECRET!, alg: 'HS256' });

// Cache de existência de usuário — evita 1 query ao banco por request autenticado.
// TTL de 5 min: cobre a sessão típica sem deixar tokens de usuários deletados válidos por muito tempo.
// Estrutura: userId → { exists: boolean, expiresAt: timestamp }
const userExistenceCache = new Map<string, { exists: boolean; expiresAt: number }>();
const USER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of userExistenceCache) {
    if (now > v.expiresAt) userExistenceCache.delete(k);
  }
}, USER_CACHE_TTL_MS);

const verifyUserExists = async (c: any, next: any) => {
  const payload = c.get('jwtPayload');
  // Ignora o id 'system' usado pelas automações do KRATOS em background
  if (payload && payload.id && payload.id !== 'system') {
    // Verifica revogação por jti (logout explícito)
    if (payload.jti) {
      const revoked = await db.query.revokedTokens.findFirst({ where: eq(revokedTokens.jti, payload.jti) });
      if (revoked) return c.json({ error: 'Sessão encerrada. Faça login novamente.' }, 401);
    }

    const now = Date.now();
    const cached = userExistenceCache.get(payload.id);
    let exists: boolean;
    if (cached && now < cached.expiresAt) {
      exists = cached.exists;
    } else {
      const user = await db.query.users.findFirst({ where: eq(users.id, payload.id) });
      exists = !!user;
      userExistenceCache.set(payload.id, { exists, expiresAt: now + USER_CACHE_TTL_MS });
    }
    if (!exists) return c.json({ error: 'Sessão inválida ou usuário não encontrado no banco.' }, 401);
  }
  await next();
};

// Proteção JWT em bloco — cobre todas as sub-rotas de cada prefixo
const PROTECTED_PREFIXES = [
  '/api/v1/chat',
  '/api/v1/sessions',
  '/api/v1/extract',
  '/api/v1/export',
  '/api/v1/users',
  '/api/v1/engine',
  '/api/v1/backup',
  '/api/v1/indicators',
  '/api/v1/signals',
  '/api/v1/reviews',
  '/api/v1/kratos',
  '/api/v1/settings',
  '/api/v1/teams',
  '/api/v1/events',
  '/api/v1/test-email',
  // Rotas previamente desprotegidas — corrigido em auditoria de segurança
  '/api/v1/embeddings',
  '/api/v1/playbook',
  '/api/v1/audit',
  '/api/v1/painel',
  '/api/v1/auth/2fa',    // 2FA requer autenticação prévia — userId vem do token
  '/api/v1/auth/logout', // logout revoga o jti — requer token válido para identificar qual revogar
];
for (const prefix of PROTECTED_PREFIXES) {
  app.use(`${prefix}/*`, authMiddleware, verifyUserExists);
  app.use(prefix, authMiddleware, verifyUserExists);
}

app.use('/api/v1/chat/*',   rateLimitAnalysis);
app.use('/api/v1/export/*', rateLimitExport);
app.route('/api/v1/chat', chatRoutes);
app.route('/api/v1/extract', extractRoutes);
app.route('/api/v1/sessions', sessionsRoutes);
app.route('/api/v1/export', exportRoutes);
app.route('/api/v1/painel', painelRoutes);
app.route('/api/v1/users', usersRoutes);
app.route('/api/v1/engine', engineRoutes);
app.route('/api/v1/backup', backupRoute);
app.route('/api/v1/indicators', indicatorsRoutes);
app.route('/api/v1/embeddings', embeddingsRoutes);
app.route('/api/v1/signals', signalsRouter);
app.route('/api/v1/reviews', reviewsRouter);
app.route('/api/v1/kratos', kratosRoutes);
app.route('/api/v1/settings', settingsRoutes);
app.route('/api/v1/teams', teamsRoutes);
app.route('/api/v1/playbook', playbookRoutes);
app.route('/api/v1/audit', auditRoutes);
app.route('/api/v1/events', eventsRoutes);
app.route('/api/docs', docsRoutes);

// Rota de Teste do Nodemailer (KRATOS Mock) — auth via PROTECTED_PREFIXES
app.post('/api/v1/test-email', async (c) => {
  try {
    const body = await c.req.json();
    const to = body.to;
    const projectName = body.projectName || 'Projeto Teste';
    const subject = `[OLYMPUS] Alerta KRATOS - ${projectName}`;
    const htmlContent = `
      <div style="font-family: sans-serif; color: #333;">
        <h2>Alerta de Monitoramento - KRATOS</h2>
        <p>O agente KRATOS finalizou uma nova análise autônoma para o projeto <strong>${projectName}</strong>.</p>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin-top: 20px;">
          [Simulação] Nenhuma ameaça crítica detectada nas últimas 24h. O cenário base permanece estável com pequenos desvios na taxa de câmbio.
        </div>
        <p style="margin-top: 30px; font-size: 12px; color: #888;">Este é um e-mail de teste disparado manualmente do OLYMPUS v4.</p>
      </div>
    `;
    const success = await sendEmail(to, subject, htmlContent);
    if (success) return c.json({ success: true });
    else return c.json({ error: 'Falha no envio do e-mail. Verifique o terminal e as credenciais SMTP no .env.' }, 500);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

const port = Number(process.env.PORT) || 3333;
console.log(`🚀 Servidor OLYMPUS v2.0 iniciado na porta ${port}`);

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' });

// Aguarda o DB estar pronto antes de carregar os cron jobs (evita ECONNREFUSED no startup)
(async () => {
  const MAX_RETRIES = 10;
  const DELAY_MS = 3000;
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
      console.log('[pgvector] ✅ Extensão vector habilitada.');

      // Valores padrão em platform_settings — onConflictDoNothing = nunca sobrescreve customizações
      // Padrão dev: Haiku (mais barato). Para prod, use a UI de Settings ou PATCH /api/v1/settings/llm
      // onConflictDoNothing preserva customizações feitas via UI — nunca sobrescreve em restart.
      await db.insert(platformSettings)
        .values({ key: 'llm', value: { provider: 'google', model: 'gemini-2.5-flash-lite' } })
        .onConflictDoNothing();
      await db.insert(platformSettings)
        .values({ key: 'anthropic_models', value: [
          { id: 'claude-opus-4-7',           label: 'Claude Opus 4'     },
          { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6' },
          { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5'  },
        ]})
        .onConflictDoNothing();
      // Mapeamento de tiers de agentes → IDs de modelo.
      // Padrão dev: ambos em Haiku. Prod: use PATCH /api/v1/settings/llm-tiers para promover premium.
      await db.insert(platformSettings)
        .values({ key: 'llm_tiers', value: { economy: 'gemini-2.5-flash-lite', premium: 'gemini-2.5-flash' } })
        .onConflictDoNothing();
      console.log('[Settings] ✅ platform_settings inicializada.');

      // Guard de dimensão de embeddings — falha ruidosa > falha silenciosa.
      // Voyage (512d) e Ollama (768d) são incompatíveis: cosine similarity entre
      // vetores de dimensões diferentes retorna resultados plausíveis mas errados.
      try {
        const dimResult = await db.execute(sql`SELECT vector_dims(embedding) AS dims FROM embeddings LIMIT 1`);
        const dimRows = dimResult as unknown as Array<{ dims: number }>;
        if (dimRows.length > 0) {
          const stored = Number(dimRows[0].dims);
          const expected = process.env.VOYAGE_API_KEY ? 512 : 768;
          if (stored !== expected) {
            console.error(`[Embeddings] ❌ MISMATCH: banco=${stored}d provider_esperado=${expected}d`);
            console.error('[Embeddings]    Solução: reindexar todos os embeddings antes de subir.');
            console.error('[Embeddings]    DELETE FROM embeddings; então re-extraia os documentos.');
            process.exit(1);
          }
          console.log(`[Embeddings] ✅ Dimensões OK: ${stored}d`);
        } else {
          console.log('[Embeddings] ✅ Banco vazio — nenhuma verificação de dimensão necessária.');
        }
      } catch (e: any) {
        // vector_dims() requer pgvector — se falhar aqui, a extensão ainda está sendo criada
        console.log(`[Embeddings] ⚠ Guard de dimensão ignorado (pgvector ainda não disponível): ${e.message}`);
      }

      await reloadCronJobs();
      console.log('[KRATOS] ✅ Cron jobs carregados com sucesso.');

      // Pre-warm Ollama — carrega o modelo na memória para a primeira requisição ser rápida.
      // Executado em background para não bloquear o startup da API.
      if (process.env.LLM_PROVIDER === 'ollama') {
        const ollamaBase = (process.env.OLLAMA_BASE_URL || 'http://ollama:11434/v1').replace(/\/v1\/?$/, '');
        const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1:8b';
        (async () => {
          try {
            console.log(`[Ollama] ⏳ Pre-warm: carregando modelo ${ollamaModel}…`);
            const r = await fetch(`${ollamaBase}/api/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: ollamaModel, prompt: '', keep_alive: -1, stream: false }),
              signal: AbortSignal.timeout(15 * 60 * 1000),
            });
            if (r.ok) console.log(`[Ollama] ✅ Modelo ${ollamaModel} carregado (keep_alive=-1).`);
            else console.log(`[Ollama] ⚠ Pre-warm HTTP ${r.status} — modelo pode demorar na 1ª chamada.`);
          } catch (e: any) {
            console.log(`[Ollama] ⚠ Pre-warm falhou (não é fatal): ${e.message}`);
          }
        })();
      }

      break;
    } catch (e: any) {
      if (i === MAX_RETRIES) {
        console.error('[KRATOS] ❌ Não foi possível carregar crons após todas as tentativas:', e.message);
      } else {
        console.log(`[KRATOS] DB ainda não pronto (tentativa ${i}/${MAX_RETRIES}), aguardando ${DELAY_MS / 1000}s...`);
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }
  }
})();