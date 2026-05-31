import { PgBoss } from 'pg-boss';
import type { Job } from 'pg-boss';
import cron from 'node-cron';
import { db, projects, messages, revokedTokens, rateLimitLogs } from '@olympus/db';
import { eq, and, isNull, asc, lt } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { sendEmail } from './mailer';
import { runDirectAgent } from './graph/helpers';
import { getLLMConfig, getLLMTiers } from './routes/settings';

// ── pg-boss — fila KRATOS com isolamento por PostgreSQL ──────────────────────
// Substitui KratosOrchestrator in-memory (T-10c Sprint 20).
// teamSize: 1 garante execução sequencial — sem esgotamento de pool de conexões
// mesmo com N projetos disparando ao mesmo tempo.
// Histórico auditável em pgboss.job (não está no schema Drizzle).
let boss: PgBoss | null = null;

// ── Email builder ────────────────────────────────────────────────────────────

export function buildKratosEmailHtml(projectName: string, conteudo: string): string {
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const html = conteudo
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^#{1,3} (.+)$/gm, '<h3 style="color:#1B3A2D;margin:14px 0 6px">$1</h3>')
    .replace(/^[-*] (.+)$/gm, '<li style="margin:3px 0">$1</li>')
    .replace(/\n\n/g, '</p><p style="margin:6px 0">')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',sans-serif;color:#333;max-width:760px;margin:0 auto;padding:24px">
  <div style="background:#1B3A2D;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
    <strong>⚡ OLYMPUS v2.0 · StratSight Brasil</strong>
    <span style="float:right;font-size:12px;color:#A5D6A7">Relatório KRATOS · ${geradoEm}</span>
  </div>
  <div style="border:1px solid #ddd;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <h2 style="color:#1B3A2D;margin:0 0 8px">Relatório de Monitoramento</h2>
    <p style="color:#555;font-size:13px;margin:0 0 20px">Projeto: <strong>${projectName}</strong></p>
    <div style="background:#f8f9fa;border-left:4px solid #2E7D52;padding:16px 20px;border-radius:4px;font-size:13px;line-height:1.7">
      <p style="margin:6px 0">${html}</p>
    </div>
    <p style="margin-top:24px;font-size:11px;color:#aaa">
      Gerado automaticamente pelo KRATOS · OLYMPUS v2.0 · StratSight Brasil<br>
      Este relatório é confidencial e destinado exclusivamente ao destinatário indicado.
    </p>
  </div>
</body></html>`;
}

// ── Worker KRATOS (executa o job enfileirado pelo pg-boss) ───────────────────

type KratosJobData = { projectId: string; projectName: string; metodologia: string };

async function runKratosJob(job: Job<KratosJobData>): Promise<void> {
  const { projectId, projectName, metodologia } = job.data;
  console.log(`[KRATOS pg-boss] 🤖 Iniciando job ${job.id} — projeto: ${projectName}`);

  try {
    // runDirectAgent carrega o histórico de memória internamente
    const systemCommand = `COMANDO DO SISTEMA EM MODO AUTÔNOMO (CRON): Acione o agente KRATOS para o projeto de nome oficial "${projectName}". \nREGRAS ESTRITAS DE OPERAÇÃO MÁQUINA:\n1. Você está operando em background (sem interação humana). NUNCA converse, peça permissão ou ofereça opções (A, B, C).\n2. Se houver falha na ferramenta de busca, NÃO relate o erro técnico; proceda imediatamente com a análise baseada nos últimos dados conhecidos do histórico.\n3. Gere EXCLUSIVAMENTE o Relatório de Acompanhamento padronizado (Dashboard, Síntese de Mudanças, Sinais Fracos).\n4. IMPORTANTE: O usuário pode ter alterado o nome, fatores, eventos e indicadores ao longo da análise. Baseie-se SEMPRE nas decisões MAIS RECENTES do histórico e use o título atualizado ("${projectName}").\nInicie a geração do relatório agora.`;

    const cooldown = await getKratosCooldown();
    const [llmConfig, llmTiers] = await Promise.all([getLLMConfig(), getLLMTiers()]);
    const lastMessage = await runDirectAgent({
      agentName:   'KRATOS',
      input:       systemCommand,
      projectId,
      projectName,
      metodologia,
      llmConfig,
      llmTiers,
      onStatus: (t) => console.log(`[KRATOS pg-boss] Status: ${t}`),
      onAgent:  (n) => console.log(`[KRATOS pg-boss] Agente: ${n}`),
    });
    const projeto = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    const emailsStr = projeto?.alertEmails?.trim() || process.env.ALERT_EMAIL || process.env.SMTP_USER || '';
    const destinatarios = emailsStr.split(',').map((e: string) => e.trim()).filter(Boolean);

    if (destinatarios.length > 0) {
      const subject = `[OLYMPUS] Relatório KRATOS - ${projectName}`;
      const htmlContent = buildKratosEmailHtml(projectName, lastMessage);
      for (const dest of destinatarios) await sendEmail(dest, subject, htmlContent);
      console.log(`[KRATOS pg-boss] 📧 Relatório enviado para: ${destinatarios.join(', ')}`);
    }

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const hookRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projetoId: projectId, projetoNome: projectName, ultimaAnaliseKratos: lastMessage, timestamp: new Date().toISOString() }),
        });
        if (hookRes.ok) console.log(`[KRATOS pg-boss] Webhook n8n disparado.`);
      } catch { /* n8n offline — ignorar */ }
    }

    // Cooldown entre jobs — cede espaço para próximo sem sobrecarregar a API do LLM
    if (cooldown > 0) await new Promise(r => setTimeout(r, cooldown));

    console.log(`[KRATOS pg-boss] ✅ Job ${job.id} concluído — ${projectName}`);
  } catch (err: any) {
    console.error(`[KRATOS pg-boss] ❌ Erro no job ${job.id} — ${projectName}:`, err.message);
    throw err; // pg-boss recoloca em fila para retry automático
  }
}

async function getKratosCooldown(): Promise<number> {
  try {
    const result = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'kratos_cooldown_ms'`);
    const rows = (result as any).rows ?? result;
    if (rows.length > 0) {
      const v = rows[0].value;
      const ms = typeof v === 'number' ? v : Number(v);
      if (ms > 0) return ms;
    }
  } catch { /* fallback */ }
  return 15_000;
}

// ── Enfileirar job KRATOS (chamado pelo node-cron no disparo) ────────────────

async function enqueueKratosJob(data: KratosJobData): Promise<void> {
  if (boss) {
    await boss.send('kratos-analysis', data, {
      retryLimit: 2,
      retryDelay: 60, // 60s entre retries
      expireInSeconds: 3600, // expira após 1h sem processar
    });
    console.log(`[KRATOS] 📥 Job enfileirado via pg-boss — "${data.projectName}"`);
  } else {
    // Fallback se pg-boss não inicializou (ex: DATABASE_URL ausente em dev)
    console.warn(`[KRATOS] ⚠️ pg-boss não disponível — executando diretamente (sem isolamento)`);
    await runKratosJob({ id: 'direct', data } as any);
  }
}

// ── Inicialização do pg-boss (chamada em index.ts após DB ready) ─────────────

export async function initKratosQueue(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn('[pg-boss] DATABASE_URL ausente — KRATOS sem isolamento de fila');
    return;
  }
  try {
    boss = new PgBoss({ connectionString: dbUrl });
    // Captura erros não tratados do pg-boss (ex: reconexão) para não crashar o processo
    boss.on('error', (err: any) => console.error('[pg-boss] Erro interno:', err?.message ?? err));
    // start() DEVE preceder work() — pg-boss precisa da conexão antes de registrar workers
    await boss.start();
    await boss.work('kratos-analysis', { localConcurrency: 1 }, runKratosJob as any);
    console.log('[pg-boss] ✅ Fila KRATOS inicializada (teamSize=1, histórico em pgboss.job)');
  } catch (err: any) {
    console.error('[pg-boss] Erro ao inicializar:', err.message);
    boss = null;
  }
}

// ── Gestão de cron jobs (API pública — mantida compatível com index.ts) ──────

let activeJobs: Record<string, any> = {};

export async function reloadCronJobs() {
  Object.values(activeJobs).forEach(job => job.stop());
  activeJobs = {};
  try {
    const ativos = await db.query.projects.findMany({
      where: and(eq(projects.status, 'Ativo'), isNull(projects.deletedAt))
    });
    ativos.forEach(p => {
      if (p.kratosCron && cron.validate(p.kratosCron)) {
        activeJobs[p.id] = cron.schedule(p.kratosCron, () => {
          enqueueKratosJob({ projectId: p.id, projectName: p.name, metodologia: p.methodology });
        });
        console.log(`⏰ Automação agendada para [${p.name}]: ${p.kratosCron}`);
      }
    });
  } catch (err) { console.error('Erro ao recarregar crons:', err); }
}

export function updateCronJob(projectId: string, projectName: string, metodologia: string, cronExpr: string | null | undefined) {
  if (activeJobs[projectId]) {
    activeJobs[projectId].stop();
    delete activeJobs[projectId];
  }
  if (cronExpr && cron.validate(cronExpr)) {
    activeJobs[projectId] = cron.schedule(cronExpr, () => {
      enqueueKratosJob({ projectId, projectName, metodologia });
    });
    console.log(`⏰ Cron atualizado para [${projectName}]: ${cronExpr}`);
  }
}

export function removeCronJob(projectId: string) {
  if (activeJobs[projectId]) {
    activeJobs[projectId].stop();
    delete activeJobs[projectId];
    console.log(`⏰ Cron removido para projeto: ${projectId}`);
  }
}

// ── Limpeza diária às 03:00 — tokens expirados e rate_limit_logs ─────────────
cron.schedule('0 3 * * *', async () => {
  try {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const [revResult, rlResult] = await Promise.all([
      db.delete(revokedTokens).where(lt(revokedTokens.expiresAt, now)).returning({ jti: revokedTokens.jti }),
      db.delete(rateLimitLogs).where(lt(rateLimitLogs.createdAt, twoHoursAgo)).returning({ id: rateLimitLogs.id }),
    ]);
    console.log(`[Cron 03h] ♻ Limpeza: ${revResult.length} tokens revogados removidos, ${rlResult.length} logs de rate limit removidos.`);
  } catch (err: any) {
    console.error('[Cron 03h] Erro na limpeza:', err.message);
  }
});
