import cron from 'node-cron';
import { db, projects, messages } from '@olympus/db';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { sign } from 'hono/jwt';
import { sendEmail } from './mailer';

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
    <strong>⚡ OLYMPUS v1.0 · StratSight Brasil</strong>
    <span style="float:right;font-size:12px;color:#A5D6A7">Relatório KRATOS · ${geradoEm}</span>
  </div>
  <div style="border:1px solid #ddd;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <h2 style="color:#1B3A2D;margin:0 0 8px">Relatório de Monitoramento</h2>
    <p style="color:#555;font-size:13px;margin:0 0 20px">Projeto: <strong>${projectName}</strong></p>
    <div style="background:#f8f9fa;border-left:4px solid #2E7D52;padding:16px 20px;border-radius:4px;font-size:13px;line-height:1.7">
      <p style="margin:6px 0">${html}</p>
    </div>
    <p style="margin-top:24px;font-size:11px;color:#aaa">
      Gerado automaticamente pelo KRONOS · OLYMPUS v1.0 · StratSight Brasil<br>
      Este relatório é confidencial e destinado exclusivamente ao destinatário indicado.
    </p>
  </div>
</body></html>`;
}

interface KratosTask {
  projectId: string;
  projectName: string;
  metodologia: string;
  app: any;
}

class KronosOrchestrator {
  private queue: KratosTask[] = [];
  private isProcessing = false;

  addTask(task: KratosTask) {
    this.queue.push(task);
    console.log(`[KRONOS] 📥 Projeto "${task.projectName}" entrou na Fila de Processamento (Posição: ${this.queue.length}).`);
    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    console.log(`[KRONOS] ⚙️ Iniciando processamento em lote da fila...`);
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await this.runKratos(task);
        if (this.queue.length > 0) {
          console.log(`[KRONOS] ⏱️ Resfriamento de 15s (Rate Limit) antes do próximo...`);
          await new Promise(r => setTimeout(r, 15000));
        }
      }
    }
    this.isProcessing = false;
    console.log(`[KRONOS] ✅ Lote concluído. Fila vazia.`);
  }

  private async runKratos(task: KratosTask) {
    const { projectId, projectName, metodologia, app } = task;
    console.log(`[KRATOS CRON] 🤖 Iniciando extração autônoma para: ${projectName}`);
    try {
      const port = process.env.PORT || 3333;
      const secret = process.env.JWT_SECRET || 'olympus_super_secret_key_2026';
      const token = await sign({ id: 'system', name: 'Sistema Automático', role: 'admin', exp: Math.floor(Date.now() / 1000) + 60 * 5 }, secret);
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

      const msgs = await db.query.messages.findMany({
        where: eq(messages.projectId, projectId),
        orderBy: [asc(messages.createdAt)]
      });

      const formattedMsgs = msgs.map(m => ({ role: m.role, content: m.content }));
      formattedMsgs.push({ role: 'user', content: `COMANDO DO SISTEMA EM MODO AUTÔNOMO (CRON): Acione o agente KRATOS para o projeto de nome oficial "${projectName}". \nREGRAS ESTRITAS DE OPERAÇÃO MÁQUINA:\n1. Você está operando em background (sem interação humana). NUNCA converse, peça permissão ou ofereça opções (A, B, C).\n2. Se houver falha na ferramenta de busca, NÃO relate o erro técnico; proceda imediatamente com a análise baseada nos últimos dados conhecidos do histórico.\n3. Gere EXCLUSIVAMENTE o Relatório de Acompanhamento padronizado (Dashboard, Síntese de Mudanças, Sinais Fracos).\n4. IMPORTANTE: O usuário pode ter alterado o nome, fatores, eventos e indicadores ao longo da análise. Baseie-se SEMPRE nas decisões MAIS RECENTES do histórico e use o título atualizado ("${projectName}").\nInicie a geração do relatório agora.` });

      console.log(`[KRATOS CRON] 🧠 Solicitando análise à IA...`);
      
      const chatPayload = { method: 'POST', headers, body: JSON.stringify({ projectId, projectName, metodologia, vizMode: 'etapa', messages: formattedMsgs }) };
      const chatRes = app 
        ? await app.request('/api/v1/chat', chatPayload) 
        : await fetch(`http://127.0.0.1:${port}/api/v1/chat`, chatPayload);

      if (!chatRes.ok) {
        const errText = await chatRes.text();
        throw new Error(`Falha na API HTTP ${chatRes.status}: ${errText}`);
      }

      console.log(`[KRATOS CRON] ✅ Análise gerada! Preparando envio de E-mail...`);

      // 1. Disparo de E-mail Nativo (Nodemailer)
      const latestMsgs = await db.query.messages.findMany({
        where: eq(messages.projectId, projectId),
        orderBy: [asc(messages.createdAt)]
      });
      const lastMessage = latestMsgs[latestMsgs.length - 1]?.content || 'Análise concluída sem detalhes legíveis.';

      // Destinatários: alertEmails do projeto (vírgula-separado) ou fallback para ALERT_EMAIL do .env
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

      // 2. Disparo de Webhook Opcional (Mantido para extensibilidade futura, mas não quebra se o n8n estiver off)
      try {
        const hookPayload = { method: 'POST', headers };
        const hookRes = app 
          ? await app.request(`/api/v1/sessions/${projectId}/webhook`, hookPayload)
          : await fetch(`http://127.0.0.1:${port}/api/v1/sessions/${projectId}/webhook`, hookPayload);
        
        if (hookRes.ok) {
          console.log(`[KRATOS CRON] Webhook opcional disparado com sucesso.`);
        }
      } catch (err) {
        // Ignora silenciosamente erros de conexão recusada se o n8n não estiver rodando
      }

      console.log(`[KRATOS CRON] 🚀 Automação concluída com sucesso para ${projectName}!`);
    } catch (err: any) {
      console.error(`[KRATOS CRON] ❌ Erro na automação de ${projectName}:`, err);
    }
  }
}

const kronos = new KronosOrchestrator();
let activeJobs: Record<string, any> = {};

export async function reloadCronJobs(app: any = null) {
  Object.values(activeJobs).forEach(job => job.stop());
  activeJobs = {};
  try {
    const ativos = await db.query.projects.findMany({
      where: and(eq(projects.status, 'Ativo'), isNull(projects.deletedAt))
    });
    ativos.forEach(p => {
      if (p.kratosCron && cron.validate(p.kratosCron)) {
        activeJobs[p.id] = cron.schedule(p.kratosCron, () => {
          kronos.addTask({ projectId: p.id, projectName: p.name, metodologia: p.methodology, app });
        });
        console.log(`⏰ Automação agendada para [${p.name}]: ${p.kratosCron}`);
      }
    });
  } catch (err) { console.error('Erro ao recarregar crons:', err); }
}