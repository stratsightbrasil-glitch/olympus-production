import cron from 'node-cron';
import { db, projects, messages } from '@olympus/db';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { sign } from 'hono/jwt';
import { sendEmail } from './mailer';

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

      const alertEmail = process.env.ALERT_EMAIL || process.env.SMTP_USER || 'admin@stratsight.com.br';
      const subject = `[OLYMPUS] Alerta KRATOS - ${projectName}`;
      const htmlContent = `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Alerta de Monitoramento - KRATOS</h2>
          <p>O agente KRATOS finalizou uma nova análise autônoma para o projeto <strong>${projectName}</strong>.</p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin-top: 20px;">
            ${lastMessage.replace(/\n/g, '<br/>')}
          </div>
          <p style="margin-top: 30px; font-size: 12px; color: #888;">Este é um e-mail automático do orquestrador OLYMPUS v4.</p>
        </div>
      `;

      await sendEmail(alertEmail, subject, htmlContent);

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