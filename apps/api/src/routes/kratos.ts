import { Hono } from 'hono';
import { db, projects, messages, indicators, weakSignals } from '@olympus/db';
import { eq, isNull, and, asc, desc, like } from 'drizzle-orm';
import { sendEmail } from '../mailer';

const kratosRoutes = new Hono();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const esc = (s: string) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const STATUS_EMOJI: Record<string, string> = { verde: '🟢', amarelo: '🟡', vermelho: '🔴' };
const STATUS_COLOR: Record<string, string> = { verde: '#1B5E20', amarelo: '#7D5A00', vermelho: '#7B1A1A' };
const STATUS_BG:    Record<string, string> = { verde: '#E8F5E9', amarelo: '#FFF9C4', vermelho: '#FFEBEE' };
const RADAR_EMOJI:  Record<string, string> = { materializado: '🔴', amplificando: '🟠', monitorando: '🔵', arquivado: '⚫' };

function overallStatus(inds: any[]): string {
  if (inds.some(i => i.status === 'vermelho')) return 'vermelho';
  if (inds.some(i => i.status === 'amarelo')) return 'amarelo';
  return 'verde';
}

// ─── Snapshot HTML ────────────────────────────────────────────────────────────

function buildSnapshotHtml(
  projetoNome: string,
  inds: any[],
  sinais: any[],
  lastMsg: string | null,
): string {
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const status = overallStatus(inds);

  const indRows = inds.map(i => {
    const st = i.status || 'verde';
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;font-size:13px">${esc(i.name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:center;font-family:monospace">${i.lastValue ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">
        <span style="background:${STATUS_BG[st]};color:${STATUS_COLOR[st]};border-radius:12px;padding:3px 10px;font-size:11px;font-weight:700">
          ${STATUS_EMOJI[st]} ${(st).toUpperCase()}
        </span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:11px;color:#888">${esc(i.source || '—')}</td>
    </tr>`;
  }).join('');

  const bySinalGroup = (stat: string) => sinais.filter(s => s.statusRadar === stat);
  const materializ  = bySinalGroup('materializado');
  const amplific    = bySinalGroup('amplificando');
  const monitor     = bySinalGroup('monitorando');

  const sinalSection = (label: string, emoji: string, items: any[], color: string) => {
    if (!items.length) return '';
    const rows = items.map(s =>
      `<li style="margin:4px 0;font-size:12px">${emoji} <strong>${esc(s.titulo)}</strong>${s.interpretacaoAtual ? ` — ${esc(s.interpretacaoAtual.slice(0,120))}…` : ''}</li>`
    ).join('');
    return `<h4 style="color:${color};margin:14px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px">${label} (${items.length})</h4><ul style="padding-left:18px;margin:0">${rows}</ul>`;
  };

  const lastMsgHtml = lastMsg
    ? `<div style="background:#f8f9fa;border-left:4px solid #2E7D52;padding:12px 16px;border-radius:4px;font-size:12px;line-height:1.7;color:#444;margin-top:8px">${esc(lastMsg.slice(0, 1800))}${lastMsg.length > 1800 ? '…' : ''}</div>`
    : '<p style="color:#aaa;font-size:12px">Nenhuma análise KRATOS registrada ainda.</p>';

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',sans-serif;color:#333;max-width:800px;margin:0 auto;padding:24px;background:#f4f6f4">

  <!-- Cabeçalho -->
  <div style="background:#1B3A2D;color:white;padding:18px 24px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center">
    <div>
      <strong style="font-size:15px;letter-spacing:1px">⚡ OLYMPUS · KRATOS</strong>
      <div style="font-size:11px;color:#A5D6A7;margin-top:2px">Relatório de Acompanhamento — Fotografia dos Indicadores</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#A5D6A7">${esc(geradoEm)}</div>
  </div>

  <div style="background:white;border:1px solid #ddd;border-top:none;padding:24px;border-radius:0 0 8px 8px">

    <!-- Status geral -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;padding:14px 18px;background:${STATUS_BG[status]};border-radius:8px;border:1px solid ${STATUS_COLOR[status]}33">
      <span style="font-size:28px">${STATUS_EMOJI[status]}</span>
      <div>
        <div style="font-weight:700;font-size:14px;color:${STATUS_COLOR[status]}">STATUS GERAL: ${status.toUpperCase()}</div>
        <div style="font-size:12px;color:#555;margin-top:2px">Projeto: <strong>${esc(projetoNome)}</strong> · ${inds.length} indicadores · ${sinais.length} sinais monitorados</div>
      </div>
    </div>

    <!-- Indicadores -->
    ${inds.length > 0 ? `
    <h3 style="color:#1B3A2D;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px">Indicadores</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead><tr style="background:#1B3A2D;color:white">
        <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600">Indicador</th>
        <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:600">Valor</th>
        <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:600">Status</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600">Fonte</th>
      </tr></thead>
      <tbody>${indRows}</tbody>
    </table>` : ''}

    <!-- Radar de Sinais -->
    ${sinais.length > 0 ? `
    <h3 style="color:#1B3A2D;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px">Radar de Sinais</h3>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px">
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px">
        ${[['materializado','🔴','#7B1A1A'], ['amplificando','🟠','#BF360C'], ['monitorando','🔵','#0D47A1']].map(([k,e,c]) => {
          const cnt = sinais.filter(s => s.statusRadar === k).length;
          return cnt > 0 ? `<span style="background:white;border:1px solid ${c}33;border-radius:20px;padding:4px 12px;font-size:12px;color:${c};font-weight:700">${e} ${k.charAt(0).toUpperCase()+k.slice(1)}: ${cnt}</span>` : '';
        }).join('')}
      </div>
      ${sinalSection('Materializados', '🔴', materializ, '#7B1A1A')}
      ${sinalSection('Amplificando', '🟠', amplific, '#BF360C')}
      ${sinalSection('Monitorando', '🔵', monitor.slice(0,5), '#0D47A1')}
      ${monitor.length > 5 ? `<p style="font-size:11px;color:#888;margin-top:6px">+ ${monitor.length - 5} sinais em monitoramento</p>` : ''}
    </div>` : ''}

    <!-- Última análise -->
    <h3 style="color:#1B3A2D;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px">Última Análise KRATOS</h3>
    ${lastMsgHtml}

    <p style="margin-top:24px;font-size:10px;color:#bbb;text-align:center">
      Gerado automaticamente · OLYMPUS v1.0 · StratSight Brasil · Este relatório é confidencial.
    </p>
  </div>
</body></html>`;
}

// ─── GET /api/v1/kratos/:projectId/dashboard ──────────────────────────────────
// Retorna dados estruturados para o painel KRATOS no frontend.

kratosRoutes.get('/:projectId/dashboard', async (c) => {
  const projectId = c.req.param('projectId');

  const [projeto, inds, sinaisRes, lastKratosMsgRow] = await Promise.all([
    db.query.projects.findFirst({ where: and(eq(projects.id, projectId), isNull(projects.deletedAt)) }),
    db.select().from(indicators).where(eq(indicators.projectId, projectId)),
    db.select().from(weakSignals).where(eq(weakSignals.projectId, projectId)),
    db.query.messages.findFirst({
      where: and(eq(messages.projectId, projectId), like(messages.content, '%KRATOS%')),
      orderBy: [desc(messages.createdAt)],
    }),
  ]);

  if (!projeto) return c.json({ error: 'Projeto não encontrado.' }, 404);

  const stats = {
    total:         sinaisRes.length,
    materializado: sinaisRes.filter(s => s.statusRadar === 'materializado').length,
    amplificando:  sinaisRes.filter(s => s.statusRadar === 'amplificando').length,
    monitorando:   sinaisRes.filter(s => s.statusRadar === 'monitorando').length,
    arquivado:     sinaisRes.filter(s => s.statusRadar === 'arquivado').length,
    confirmavel:   sinaisRes.filter(s => s.classificacao === 'confirmavel').length,
    ambiguo:       sinaisRes.filter(s => s.classificacao === 'ambiguo').length,
    ruido:         sinaisRes.filter(s => s.classificacao === 'ruido').length,
  };

  return c.json({
    projeto: { id: projectId, nome: projeto.name, kratosCron: projeto.kratosCron, alertEmails: projeto.alertEmails },
    indicadores: inds,
    sinais: sinaisRes,
    sinalStats: stats,
    overallStatus: overallStatus(inds),
    lastKratosAt:      lastKratosMsgRow?.createdAt ?? null,
    lastKratosExcerpt: lastKratosMsgRow?.content?.slice(0, 500) ?? null,
  });
});

// ─── POST /api/v1/kratos/:projectId/report ────────────────────────────────────
// Gera relatório snapshot (fotografia dos indicadores) e envia por e-mail.
// NÃO chama o endpoint de chat — responde em < 2s.

kratosRoutes.post('/:projectId/report', async (c) => {
  const projectId = c.req.param('projectId');
  const body = await c.req.json().catch(() => ({})) as { emails?: string[] };

  const projeto = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), isNull(projects.deletedAt))
  });
  if (!projeto) return c.json({ error: 'Projeto não encontrado.' }, 404);

  // Resolve destinatários
  let destinatarios: string[] = [];
  if (body.emails?.length) {
    destinatarios = body.emails.map(e => e.trim()).filter(Boolean);
  } else if (projeto.alertEmails?.trim()) {
    destinatarios = projeto.alertEmails.split(',').map(e => e.trim()).filter(Boolean);
  } else if (process.env.ALERT_EMAIL || process.env.SMTP_USER) {
    destinatarios = [(process.env.ALERT_EMAIL || process.env.SMTP_USER)!];
  }

  if (!destinatarios.length) {
    return c.json({ error: 'Nenhum e-mail de destino configurado.' }, 400);
  }

  try {
    // Carrega dados estruturados do DB — sem IA, sem streaming
    const [inds, sinaisRes, lastKratosMsgRow] = await Promise.all([
      db.select().from(indicators).where(eq(indicators.projectId, projectId)),
      db.select().from(weakSignals).where(eq(weakSignals.projectId, projectId)),
      db.query.messages.findFirst({
        where: and(eq(messages.projectId, projectId), like(messages.content, '%KRATOS%')),
        orderBy: [desc(messages.createdAt)],
      }),
    ]);

    const html = buildSnapshotHtml(
      projeto.name,
      inds,
      sinaisRes,
      lastKratosMsgRow?.content ?? null,
    );

    const subject = `[OLYMPUS] Relatório KRATOS — ${projeto.name}`;
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
        ? `Relatório enviado para ${destinatarios.length} destinatário(s).`
        : 'Gerado, mas houve falha em alguns envios.',
    });

  } catch (err: any) {
    console.error('[KRATOS] Erro no relatório sob demanda:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

export default kratosRoutes;
