import { Hono } from 'hono';
import { db, projects, messages } from '@olympus/db';
import { eq, isNull, and, asc } from 'drizzle-orm';
import { sign } from 'hono/jwt';
import { sendEmail } from '../mailer';
import { buildKratosEmailHtml } from '../cron';

const kratosRoutes = new Hono();

// POST /api/v1/kratos/:projectId/report
// Gera relatório KRATOS sob demanda e envia por e-mail imediatamente.
// Body opcional: { emails: string[] }  — sobrescreve os e-mails configurados no projeto.
kratosRoutes.post('/:projectId/report', async (c) => {
  const projectId = c.req.param('projectId');
  const body = await c.req.json().catch(() => ({})) as { emails?: string[] };

  // Busca projeto
  const projeto = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), isNull(projects.deletedAt))
  });
  if (!projeto) return c.json({ error: 'Projeto não encontrado.' }, 404);

  // Resolve destinatários: body.emails > projeto.alertEmails > ALERT_EMAIL env
  let destinatarios: string[] = [];
  if (body.emails && body.emails.length > 0) {
    destinatarios = body.emails.map(e => e.trim()).filter(Boolean);
  } else if (projeto.alertEmails?.trim()) {
    destinatarios = projeto.alertEmails.split(',').map(e => e.trim()).filter(Boolean);
  } else if (process.env.ALERT_EMAIL || process.env.SMTP_USER) {
    destinatarios = [(process.env.ALERT_EMAIL || process.env.SMTP_USER)!];
  }

  if (destinatarios.length === 0) {
    return c.json({ error: 'Nenhum e-mail de destino configurado. Informe e-mails no corpo da requisição ou configure "E-mails de Alerta" no projeto.' }, 400);
  }

  try {
    // Gera token de sistema para chamar a API de chat
    const secret = process.env.JWT_SECRET || 'olympus_super_secret_key_2026';
    const token = await sign(
      { id: 'system', name: 'Sistema Automático', role: 'admin', exp: Math.floor(Date.now() / 1000) + 300 },
      secret
    );
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    // Carrega histórico do projeto
    const msgs = await db.query.messages.findMany({
      where: eq(messages.projectId, projectId),
      orderBy: [asc(messages.createdAt)]
    });

    const formattedMsgs = msgs.map(m => ({ role: m.role, content: m.content }));
    formattedMsgs.push({
      role: 'user',
      content: `COMANDO DO SISTEMA — RELATÓRIO SOB DEMANDA: Acione o agente KRATOS para o projeto "${projeto.name}".
REGRAS:
1. Opere em modo autônomo — sem conversa, sem perguntas, sem opções ao usuário.
2. Consulte o histórico desta sessão e as fontes disponíveis no momento.
3. Gere o Relatório de Acompanhamento KRATOS completo e padronizado.
4. Use os dados mais recentes disponíveis; se uma fonte falhar, prossiga com os dados conhecidos.
Inicie agora.`
    });

    // Chama a API de chat (endpoint não-streaming)
    const port = process.env.PORT || 3333;
    const chatRes = await fetch(`http://127.0.0.1:${port}/api/v1/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId,
        projectName: projeto.name,
        metodologia: projeto.methodology,
        vizMode: 'etapa',
        messages: formattedMsgs
      })
    });

    if (!chatRes.ok) {
      const errText = await chatRes.text();
      throw new Error(`Erro na geração do relatório (HTTP ${chatRes.status}): ${errText}`);
    }

    // Busca a mensagem mais recente gerada
    const latestMsgs = await db.query.messages.findMany({
      where: eq(messages.projectId, projectId),
      orderBy: [asc(messages.createdAt)]
    });
    const lastContent = latestMsgs[latestMsgs.length - 1]?.content || 'Relatório gerado sem conteúdo legível.';

    // Envia para cada destinatário
    const subject = `[OLYMPUS] Relatório KRATOS — ${projeto.name}`;
    const html = buildKratosEmailHtml(projeto.name, lastContent);
    const resultados: { email: string; ok: boolean }[] = [];
    for (const dest of destinatarios) {
      const ok = await sendEmail(dest, subject, html);
      resultados.push({ email: dest, ok });
    }

    const todos = resultados.every(r => r.ok);
    return c.json({
      success: todos,
      sentTo: resultados,
      message: todos
        ? `Relatório enviado com sucesso para ${destinatarios.length} destinatário(s).`
        : 'Relatório gerado, mas houve falha em alguns envios. Verifique o terminal.'
    });

  } catch (err: any) {
    console.error('[KRATOS] Erro no relatório sob demanda:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

export default kratosRoutes;
