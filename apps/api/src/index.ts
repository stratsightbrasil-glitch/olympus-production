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
import { db, users, platformSettings } from '@olympus/db';
import { eq, sql } from 'drizzle-orm';

// Força o carregamento do .env localizado na raiz do monorepo
config({ path: path.resolve(__dirname, '../../../.env') });

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

app.get('/ping', (c) => c.json({ status: 'ok', message: 'OLYMPUS API v1.0 rodando com Hono!' }));

app.get('/health', async (c) => {
  const start = Date.now();
  let dbStatus = 'disconnected';
  try {
    await db.execute(sql`SELECT 1`);
    dbStatus = 'connected';
  } catch { /* */ }
  const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY;
  const tavilyConfigured    = !!process.env.TAVILY_API_KEY;
  const ollamaProvider      = process.env.LLM_PROVIDER === 'ollama';
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('../../../package.json');
  return c.json({
    status:    dbStatus === 'connected' ? 'ok' : 'degraded',
    version:   pkg?.version || '4.0.0',
    database:  dbStatus,
    anthropic: anthropicConfigured ? 'configured' : 'not_configured',
    tavily:    tavilyConfigured    ? 'configured' : 'not_configured',
    llm:       ollamaProvider      ? 'ollama'     : 'anthropic',
    uptime:    Math.floor(process.uptime()),
    latencyMs: Date.now() - start,
    timestamp: new Date().toISOString(),
  });
});

// Rotas públicas de Autenticação
app.route('/api/v1/auth', authRoutes);

// Proteção JWT nas rotas privadas
const authMiddleware = jwt({ secret: process.env.JWT_SECRET || 'olympus_super_secret_key_2026', alg: 'HS256' });

const verifyUserExists = async (c: any, next: any) => {
  const payload = c.get('jwtPayload');
  // Ignora o id 'system' usado pelas automações do KRATOS/KRONOS em background
  if (payload && payload.id && payload.id !== 'system') {
    const user = await db.query.users.findFirst({ where: eq(users.id, payload.id) });
    if (!user) return c.json({ error: 'Sessão inválida ou usuário não encontrado no banco.' }, 401);
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
console.log(`🚀 Servidor OLYMPUS v1.0 iniciado na porta ${port}`);

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
      await db.insert(platformSettings)
        .values({ key: 'llm', value: { provider: 'anthropic', model: 'claude-opus-4-7' } })
        .onConflictDoNothing();
      await db.insert(platformSettings)
        .values({ key: 'anthropic_models', value: [
          { id: 'claude-opus-4-7',           label: 'Claude Opus 4'     },
          { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6' },
          { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5'  },
        ]})
        .onConflictDoNothing();
      console.log('[Settings] ✅ platform_settings inicializada.');

      await reloadCronJobs(app);
      console.log('[KRONOS] ✅ Cron jobs carregados com sucesso.');

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
        console.error('[KRONOS] ❌ Não foi possível carregar crons após todas as tentativas:', e.message);
      } else {
        console.log(`[KRONOS] DB ainda não pronto (tentativa ${i}/${MAX_RETRIES}), aguardando ${DELAY_MS / 1000}s...`);
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }
  }
})();