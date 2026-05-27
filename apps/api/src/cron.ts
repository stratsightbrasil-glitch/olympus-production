import cron from 'node-cron';
import { db, projects, messages } from '@olympus/db';
import { eq, and, isNull, asc, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { sendEmail } from './mailer';
import { runAnalysis } from './routes/chat';

export function buildKratosEmailHtml(projectName: string, conteudo: string): string {
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  // Converte markdown mínimo em HTML
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

interface KratosTask {
  projectId: string;
  projectName: string;
  metodologia: string;
}

class KratosOrchestrator {
  private queue: KratosTask[] = [];
  private isProcessing = false;

  addTask(task: KratosTask) {
    this.queue.push(task);
    console.log(`[KRATOS] 📥 Projeto "${task.projectName}" entrou na Fila de Processamento (Posição: ${this.queue.length}).`);
    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    console.log(`[KRATOS] ⚙️ Iniciando processamento em lote da fila...`);
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await this.runKratos(task);
        if (this.queue.length > 0) {
          const cooldown = await getKratosCooldown();
          console.log(`[KRATOS] ⏱️ Resfriamento de ${cooldown / 1000}s (Rate Limit) antes do próximo...`);
          await new Promise(r => setTimeout(r, cooldown));
        }
      }
    }
    this.isProcessing = false;
    console.log(`[KRATOS] ✅ Lote concluído. Fila vazia.`);
  }

  private async runKratos(task: KratosTask) {
    const { projectId, projectName, metodologia } = task;
    console.log(`[KRATOS CRON] 🤖 Iniciando extração autônoma para: ${projectName}`);
    try {
      // ── Carrega histórico (sem self-mint de JWT, sem HTTP interno) ────────────
      // Limita a 100 mensagens para evitar contexto gigantesco para o LLM.
      const msgs = await db.query.messages.findMany({
        where: eq(messages.projectId, projectId),
        orderBy: [asc(messages.createdAt)],
        limit: 100,
      });

      const formattedMsgs = msgs.map(m => ({ role: m.role, content: m.content }));
      const systemCommand = `COMANDO DO SISTEMA EM MODO AUTÔNOMO (CRON): Acione o agente KRATOS para o projeto de nome oficial "${projectName}". \nREGRAS ESTRITAS DE OPERAÇÃO MÁQUINA:\n1. Você está operando em background (sem interação humana). NUNCA converse, peça permissão ou ofereça opções (A, B, C).\n2. Se houver falha na ferramenta de busca, NÃO relate o erro técnico; proceda imediatamente com a análise baseada nos últimos dados conhecidos do histórico.\n3. Gere EXCLUSIVAMENTE o Relatório de Acompanhamento padronizado (Dashboard, Síntese de Mudanças, Sinais Fracos).\n4. IMPORTANTE: O usuário pode ter alterado o nome, fatores, eventos e indicadores ao longo da análise. Baseie-se SEMPRE nas decisões MAIS RECENTES do histórico e use o título atualizado ("${projectName}").\nInicie a geração do relatório agora.`;
      formattedMsgs.push({ role: 'user', content: systemCommand });

      console.log(`[KRATOS CRON] 🧠 Solicitando análise à IA...`);

      // ── Chamada direta — sem JWT self-mint, sem loopback HTTP ────────────────
      // jwtPayload com id='system' é ignorado pelo verifyUserExists no middleware.
      const systemPayload = { id: 'system', name: 'Sistema Automático', role: 'admin' };
      const result = await runAnalysis(
        { projectId, projectName, metodologia, vizMode: 'etapa', messages: formattedMsgs },
        systemPayload,
        {
          onStatus: (t) => console.log(`[KRATOS CRON] Status: ${t}`),
          onAgent:  (n) => console.log(`[KRATOS CRON] Agente: ${n}`),
        },
      );

      console.log(`[KRATOS CRON] ✅ Análise gerada! Preparando envio de E-mail...`);

      // 1. Disparo de E-mail — usa responseText direto (sem re-query ao banco)
      const lastMessage = result.responseText || 'Análise concluída sem detalhes legíveis.';

      const projeto = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
      const emailsStr = projeto?.alertEmails?.trim() || process.env.ALERT_EMAIL || process.env.SMTP_USER || '';
      const destinatarios = emailsStr.split(',').map((e: string) => e.trim()).filter(Boolean);

      if (destinatarios.length === 0) {
        console.log(`[KRATOS CRON] ⚠️ Nenhum e-mail de alerta configurado para "${projectName}". Pulando envio.`);
      } else {
        const subject = `[OLYMPUS] Relatório KRATOS - ${projectName}`;
        const htmlContent = buildKratosEmailHtml(projectName, lastMessage);
        for (const dest of destinatarios) {
          await sendEmail(dest, subject, htmlContent);
        }
        console.log(`[KRATOS CRON] 📧 Relatório enviado para: ${destinatarios.join(', ')}`);
      }

      // 2. Webhook n8n opcional — este SIM é um HTTP externo legítimo (não loopback)
      const webhookUrl = process.env.N8N_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          const hookRes = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projetoId:            projectId,
              projetoNome:          projectName,
              ultimaAnaliseKratos:  lastMessage,
              timestamp:            new Date().toISOString(),
            }),
          });
          if (hookRes.ok) console.log(`[KRATOS CRON] Webhook n8n disparado com sucesso.`);
        } catch {
          // Ignora silenciosamente — n8n pode estar offline
        }
      }

      console.log(`[KRATOS CRON] 🚀 Automação concluída com sucesso para ${projectName}!`);
    } catch (err: any) {
      console.error(`[KRATOS CRON] ❌ Erro na automação de ${projectName}:`, err);
    }
  }
}

async function getKratosCooldown(): Promise<number> {
  try {
    const result = await db.execute(
      sql`SELECT value FROM platform_settings WHERE key = 'kratos_cooldown_ms'`
    );
    const rows = (result as any).rows ?? result;
    if (rows.length > 0) {
      const v = rows[0].value;
      const ms = typeof v === 'number' ? v : Number(v);
      if (ms > 0) return ms;
    }
  } catch { /* fallback */ }
  return 15_000;
}

const kratos = new KratosOrchestrator();
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
          kratos.addTask({ projectId: p.id, projectName: p.name, metodologia: p.methodology });
        });
        console.log(`⏰ Automação agendada para [${p.name}]: ${p.kratosCron}`);
      }
    });
  } catch (err) { console.error('Erro ao recarregar crons:', err); }
}

/**
 * Atualiza (ou cria) o cron de um único projeto sem recarregar todos.
 * Chamado quando o cronExpression de um projeto muda via API de configurações.
 */
export function updateCronJob(projectId: string, projectName: string, metodologia: string, cronExpr: string | null | undefined) {
  // Para o job anterior se existir
  if (activeJobs[projectId]) {
    activeJobs[projectId].stop();
    delete activeJobs[projectId];
  }
  if (cronExpr && cron.validate(cronExpr)) {
    activeJobs[projectId] = cron.schedule(cronExpr, () => {
      kratos.addTask({ projectId, projectName, metodologia });
    });
    console.log(`⏰ Cron atualizado para [${projectName}]: ${cronExpr}`);
  }
}

/**
 * Remove o cron de um projeto específico (deletado ou desativado).
 * Chamado quando o projeto é arquivado/deletado via API — evita o full reload.
 */
export function removeCronJob(projectId: string) {
  if (activeJobs[projectId]) {
    activeJobs[projectId].stop();
    delete activeJobs[projectId];
    console.log(`⏰ Cron removido para projeto: ${projectId}`);
  }
}