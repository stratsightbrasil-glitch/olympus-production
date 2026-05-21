import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from 'dotenv';
import { jwt } from 'hono/jwt';
import path from 'path';
import { db, users } from '@olympus/db';
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
  '/api/v1/test-email',
];
for (const prefix of PROTECTED_PREFIXES) {
  app.use(`${prefix}/*`, authMiddleware, verifyUserExists);
  app.use(prefix, authMiddleware, verifyUserExists);
}

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
      await reloadCronJobs(app);
      console.log('[KRONOS] ✅ Cron jobs carregados com sucesso.');
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