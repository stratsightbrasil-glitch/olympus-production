import { Hono } from 'hono';
import { verify } from 'hono/jwt';
import { db, projects, messages, indicators } from '@olympus/db';
import { eq, asc, isNull, and, desc } from 'drizzle-orm';

const painelRoutes = new Hono();

const escHtml = (s: string) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');

painelRoutes.get('/', (c) => {
  let dados: any = null;
  const d = c.req.query('d');
  
  if (d) {
    const raw = Buffer.from(d, 'base64').toString('utf-8');
    try {
      dados = JSON.parse(decodeURIComponent(raw));
    } catch (_) {
      try { dados = JSON.parse(raw); } 
      catch (err: any) { console.warn('Painel: falha ao parsear parâmetro ?d —', err.message); }
    }
  }

  const projeto  = dados?.projeto  || {};
  const cenario  = dados?.cenario  || 'Não avaliado';
  const status   = dados?.status   || 'verde';
  const indicadores = dados?.indicadores || [];
  const geradoEm = dados?.geradoEm || new Date().toLocaleString('pt-BR');

  const corStatus: Record<string, string> = { verde: '#2E7D52', amarelo: '#F9A825', vermelho: '#C62828' };
  const emojiStatus: Record<string, string> = { verde: '🟢', amarelo: '🟡', vermelho: '🔴' };

  const safeStatus = (s: string) => ['verde','amarelo','vermelho'].includes(s) ? s : 'indefinido';
  
  const rowsHtml = indicadores.map((ind: any) => {
    const st = safeStatus(ind.status);
    return `
    <tr>
      <td>${escHtml(ind.nome)}</td>
      <td>${escHtml(ind.valor || '—')}</td>
      <td style="color:${corStatus[st] || '#888'};font-weight:700">${emojiStatus[st] || '⚪'} ${escHtml(st.toUpperCase())}</td>
      <td style="color:#555;font-size:12px">${escHtml(ind.fonte || '—')}</td>
    </tr>`;
  }).join('');

  return c.html(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Painel · ${escHtml(projeto.nome || 'StratSight Brasil')}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',system-ui,sans-serif; background:#F5F5F5; color:#333; }
    header { background:#1B3A2D; color:white; padding:16px 32px; display:flex; align-items:center; justify-content:space-between; }
    header h1 { font-size:18px; letter-spacing:1px; }
    header span { font-size:12px; color:#A5D6A7; }
    .container { max-width:960px; margin:0 auto; padding:32px 24px; }
    .card { background:white; border-radius:10px; padding:24px; margin-bottom:20px; box-shadow:0 1px 4px rgba(0,0,0,0.08); }
    .card h2 { font-size:13px; text-transform:uppercase; letter-spacing:1px; color:#2E7D52; margin-bottom:16px; }
    .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .meta-item label { display:block; font-size:11px; color:#888; margin-bottom:3px; text-transform:uppercase; letter-spacing:0.5px; }
    .meta-item span { font-size:14px; font-weight:600; color:#1B3A2D; }
    .cenario-badge { display:inline-block; background:#E8F5E9; color:#1B3A2D; border:2px solid #2E7D52; border-radius:8px; padding:10px 20px; font-size:16px; font-weight:700; }
    .status-badge { display:inline-flex; align-items:center; gap:8px; padding:8px 16px; border-radius:20px; font-weight:700; font-size:14px; }
    .status-verde   { background:#E8F5E9; color:#1B3A2D; }
    .status-amarelo { background:#FFF9C4; color:#7D5A00; }
    .status-vermelho{ background:#FFEBEE; color:#7B1A1A; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th { background:#1B3A2D; color:white; padding:10px 12px; text-align:left; font-weight:600; font-size:12px; }
    td { padding:10px 12px; border-bottom:1px solid #EEEEEE; }
    tr:nth-child(even) td { background:#FAFAFA; }
    .btn { display:inline-block; background:#2E7D52; color:white; border:none; border-radius:8px; padding:12px 28px; font-size:14px; font-weight:600; cursor:pointer; text-decoration:none; margin-top:12px; }
    footer { text-align:center; font-size:11px; color:#AAA; padding:24px; }
    .confidencial { background:#FFF3E0; border:1px solid #FFB74D; color:#795548; font-size:11px; padding:8px 14px; border-radius:6px; margin-bottom:16px; }
  </style>
</head>
<body>
  <header>
    <h1>⚡ ATHENA v4.0 · StratSight Brasil</h1>
    <span>Painel de Monitoramento · ${escHtml(geradoEm)}</span>
  </header>
  <div class="container">
    <div class="confidencial">⚠️ Acesso restrito · Documento confidencial · StratSight Brasil</div>
    <div class="card">
      <h2>Informações do Projeto</h2>
      <div class="meta-grid">
        <div class="meta-item"><label>Projeto</label><span>${escHtml(projeto.nome || '—')}</span></div>
        <div class="meta-item"><label>Cliente</label><span>${escHtml(projeto.cliente || '—')}</span></div>
        <div class="meta-item"><label>Horizonte</label><span>${escHtml(projeto.horizonte || '—')}</span></div>
        <div class="meta-item"><label>Classificação</label><span>${escHtml(projeto.classificacao || '—')}</span></div>
      </div>
    </div>
    <div class="card">
      <h2>Cenário Atual</h2>
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div class="cenario-badge">${escHtml(cenario)}</div>
        <div class="status-badge status-${safeStatus(status)}">${emojiStatus[safeStatus(status)] || '⚪'} ${escHtml(safeStatus(status).toUpperCase())}</div>
      </div>
    </div>
    ${indicadores.length > 0 ? `
    <div class="card">
      <h2>Indicadores de Alerta</h2>
      <table>
        <thead><tr><th>Indicador</th><th>Valor Atual</th><th>Status</th><th>Fonte</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>` : ''}
    <div class="card">
      <h2>Solicitar Análise</h2>
      <p style="font-size:13px;color:#555;margin-bottom:12px">Para solicitar uma análise atualizada ou nova sessão de monitoramento, entre em contato com o analista responsável.</p>
      <a href="mailto:contato@stratsight.com.br?subject=${encodeURIComponent('Solicitação de Análise — ' + (projeto.nome || 'Projeto'))}" class="btn">📧 Solicitar Análise Completa</a>
    </div>
  </div>
  <footer>StratSight Brasil · OLYMPUS v4.0 · Strategic Foresight · Confidencial</footer>
</body>
</html>`);
});

// ── PAINEL DO CLIENTE — URL permanente autenticada por token ─────────────────
// Aceita JWT via query param ?token= ou header Authorization: Bearer
// Usado pelo botão "Link do Cliente" no frontend para compartilhar com o cliente.
painelRoutes.get('/project/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const rawToken = c.req.query('token') || c.req.header('Authorization')?.replace('Bearer ', '');

  if (!rawToken) {
    return c.html(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center">
      <h2>⛔ Acesso negado</h2><p>Token de acesso não fornecido.</p></body></html>`, 401);
  }

  let payload: any;
  try {
    payload = await verify(rawToken, process.env.JWT_SECRET || 'olympus_super_secret_key_2026', 'HS256');
  } catch {
    return c.html(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center">
      <h2>⛔ Token inválido ou expirado</h2><p>Solicite um novo link ao analista responsável.</p></body></html>`, 401);
  }

  try {
    // Busca o projeto
    const projeto = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), isNull(projects.deletedAt))
    });
    if (!projeto) {
      return c.html(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2>Projeto não encontrado</h2></body></html>`, 404);
    }

    // Clientes só veem projetos criados com seu nome (segurança)
    if (payload.role === 'cliente' && projeto.createdBy !== payload.name) {
      return c.html(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2>⛔ Acesso negado</h2><p>Você não tem permissão para visualizar este projeto.</p></body></html>`, 403);
    }

    // Busca indicadores do banco
    const inds = await db.query.indicators.findMany({
      where: eq(indicators.projectId, projectId),
      orderBy: [desc(indicators.lastCheckedAt)]
    });

    // Busca a última mensagem KRATOS para status e cenário atual
    const msgs = await db.query.messages.findMany({
      where: and(eq(messages.projectId, projectId), eq(messages.role, 'assistant')),
      orderBy: [asc(messages.createdAt)]
    });

    // Detecta cenário atual e status a partir da última mensagem KRATOS
    const kratosMsgs = msgs.filter(m => m.content?.toUpperCase().includes('KRATOS') || m.agentName === 'KRATOS');
    let cenarioAtual = 'Aguardando avaliação KRATOS';
    let statusGeral = 'verde';

    if (kratosMsgs.length > 0) {
      const lastKratos = kratosMsgs[kratosMsgs.length - 1].content || '';
      const cenarioMatch = lastKratos.match(/cen[aá]rio\s*(atual[:\s]*)?\*?\*?(Q[1-4][^*\n,;.]*)/i);
      if (cenarioMatch) cenarioAtual = cenarioMatch[2].trim();
      const lower = lastKratos.toLowerCase();
      if (lower.includes('alerta') || lower.includes('crítico') || lower.includes('vermelho')) statusGeral = 'vermelho';
      else if (lower.includes('atenção') || lower.includes('amarelo') || lower.includes('monitorar')) statusGeral = 'amarelo';
    }

    // Último relatório HERMES
    const hermesPatterns = ['RELATÓRIO FINAL PADRÃO', 'RELATÓRIO FINAL', 'RELATÓRIO DE CENÁRIOS', 'RELATÓRIO ESTRATÉGICO'];
    let relatorioMsg: string | null = null;
    for (const pat of hermesPatterns) {
      const m = [...msgs].reverse().find(m => m.content?.toUpperCase().includes(pat));
      if (m) { relatorioMsg = m.content; break; }
    }
    if (!relatorioMsg && msgs.length > 0) {
      relatorioMsg = [...msgs].reverse().find(m => m.agentName === 'HERMES' || m.content?.includes('**HERMES**'))?.content || null;
    }

    const geradoEm = new Date().toLocaleString('pt-BR');
    const corStatus: Record<string, string> = { verde: '#2E7D52', amarelo: '#F9A825', vermelho: '#C62828' };
    const emojiStatus: Record<string, string> = { verde: '🟢', amarelo: '🟡', vermelho: '🔴' };
    const safeStatus = (s: string) => ['verde', 'amarelo', 'vermelho'].includes(s) ? s : 'verde';
    const st = safeStatus(statusGeral);

    const indicadoresHtml = inds.length > 0 ? inds.map(ind => {
      const ist = safeStatus(ind.status || 'verde');
      const params = ind.parametersJson as any || {};
      return `<tr>
        <td>${escHtml(ind.name)}</td>
        <td><strong>${escHtml(String(ind.lastValue ?? '—'))}</strong></td>
        <td style="color:${corStatus[ist]};font-weight:700">${emojiStatus[ist]} ${ist.toUpperCase()}</td>
        <td style="color:#555;font-size:12px">${escHtml(params.yellowThreshold ? `🟡 ${params.yellowThreshold}` : '—')}</td>
        <td style="color:#555;font-size:12px">${escHtml(params.redThreshold ? `🔴 ${params.redThreshold}` : '—')}</td>
        <td style="color:#888;font-size:11px">${escHtml(ind.source || '—')}</td>
        <td style="font-size:11px;color:#aaa">${ind.lastCheckedAt ? new Date(ind.lastCheckedAt).toLocaleDateString('pt-BR') : '—'}</td>
      </tr>`;
    }).join('') : '';

    const mdToSimpleHtml = (md: string) => {
      if (!md) return '';
      return md
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/^#### (.+)$/gm, '<h4 style="color:#1B3A2D;margin:12px 0 6px">$1</h4>')
        .replace(/^### (.+)$/gm, '<h3 style="color:#1B3A2D;margin:14px 0 8px">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 style="color:#1B3A2D;border-bottom:2px solid #C8A84B;padding-bottom:4px;margin:18px 0 10px">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 style="color:#1B3A2D;margin:20px 0 12px">$1</h1>')
        .replace(/^[-*] (.+)$/gm, '<div style="display:flex;gap:8px;margin:4px 0"><span style="color:#C8A84B">•</span><span>$1</span></div>')
        .replace(/\n\n/g, '</p><p style="margin:6px 0">')
        .replace(/\n/g, '<br>');
    };

    return c.html(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Painel · ${escHtml(projeto.name || 'StratSight Brasil')}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',system-ui,sans-serif;background:#F5F5F5;color:#333}
    header{background:#1B3A2D;color:white;padding:16px 32px;display:flex;align-items:center;justify-content:space-between}
    header h1{font-size:18px;letter-spacing:1px}
    header span{font-size:12px;color:#A5D6A7}
    .container{max-width:1100px;margin:0 auto;padding:32px 24px}
    .card{background:white;border-radius:10px;padding:24px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
    .card h2{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#2E7D52;margin-bottom:16px}
    .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .meta-item label{display:block;font-size:11px;color:#888;margin-bottom:3px;text-transform:uppercase;letter-spacing:.5px}
    .meta-item span{font-size:14px;font-weight:600;color:#1B3A2D}
    .status-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:20px;font-weight:700;font-size:14px}
    .status-verde{background:#E8F5E9;color:#1B3A2D}
    .status-amarelo{background:#FFF9C4;color:#7D5A00}
    .status-vermelho{background:#FFEBEE;color:#7B1A1A}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#1B3A2D;color:white;padding:10px 12px;text-align:left;font-weight:600;font-size:12px}
    td{padding:9px 12px;border-bottom:1px solid #EEE;vertical-align:top}
    tr:nth-child(even) td{background:#FAFAFA}
    .relatorio{background:#FFFEF7;border:1px solid #E8D87F;border-radius:8px;padding:20px 24px;font-size:13px;line-height:1.7;max-height:600px;overflow-y:auto}
    .confidencial{background:#FFF3E0;border:1px solid #FFB74D;color:#795548;font-size:11px;padding:8px 14px;border-radius:6px;margin-bottom:16px}
    footer{text-align:center;font-size:11px;color:#AAA;padding:24px;border-top:1px solid #ddd;margin-top:8px}
    @media print{header,footer{background:#1B3A2D!important;-webkit-print-color-adjust:exact}}
  </style>
</head>
<body>
<header>
  <h1>⚡ OLYMPUS v4.0 · StratSight Brasil</h1>
  <span>Painel do Cliente · ${escHtml(geradoEm)}</span>
</header>
<div class="container">
  <div class="confidencial">⚠️ Acesso restrito · Documento CONFIDENCIAL · StratSight Brasil · Usuário: ${escHtml(payload.name)}</div>

  <div class="card">
    <h2>Informações do Projeto</h2>
    <div class="meta-grid">
      <div class="meta-item"><label>Projeto</label><span>${escHtml(projeto.name || '—')}</span></div>
      <div class="meta-item"><label>Metodologia</label><span>${escHtml(projeto.methodology || 'MSEF')}</span></div>
      <div class="meta-item"><label>Status</label><span>${escHtml(projeto.status || '—')}</span></div>
      <div class="meta-item"><label>Analista</label><span>${escHtml(projeto.createdBy || '—')}</span></div>
      <div class="meta-item"><label>Última Atualização</label><span>${projeto.updatedAt ? new Date(projeto.updatedAt).toLocaleDateString('pt-BR') : '—'}</span></div>
      <div class="meta-item"><label>Gerado em</label><span>${escHtml(geradoEm)}</span></div>
    </div>
  </div>

  <div class="card">
    <h2>Cenário Atual & Status</h2>
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div style="background:#E8F5E9;border:2px solid #2E7D52;border-radius:8px;padding:10px 20px;font-size:15px;font-weight:700;color:#1B3A2D">${escHtml(cenarioAtual)}</div>
      <div class="status-badge status-${st}">${emojiStatus[st]} ${st.toUpperCase()}</div>
    </div>
  </div>

  ${inds.length > 0 ? `
  <div class="card">
    <h2>Dashboard de Indicadores (${inds.length} indicador${inds.length > 1 ? 'es' : ''})</h2>
    <table>
      <thead><tr><th>Indicador</th><th>Valor Atual</th><th>Status</th><th>Limiar 🟡</th><th>Limiar 🔴</th><th>Fonte</th><th>Atualizado</th></tr></thead>
      <tbody>${indicadoresHtml}</tbody>
    </table>
  </div>` : ''}

  ${relatorioMsg ? `
  <div class="card">
    <h2>Relatório Estratégico (Último HERMES)</h2>
    <div class="relatorio"><p style="margin:6px 0">${mdToSimpleHtml(relatorioMsg)}</p></div>
    <div style="margin-top:12px;text-align:right">
      <button onclick="window.print()" style="background:#1B3A2D;color:white;border:none;border-radius:8px;padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
    </div>
  </div>` : ''}

  <div class="card">
    <h2>Solicitar Análise</h2>
    <p style="font-size:13px;color:#555;margin-bottom:12px">Para solicitar análise atualizada ou nova sessão de monitoramento, entre em contato com o analista responsável.</p>
    <a href="mailto:stratsightbrasil@gmail.com?subject=${encodeURIComponent('Solicitação de Análise — ' + (projeto.name || 'Projeto'))}" style="display:inline-block;background:#2E7D52;color:white;border:none;border-radius:8px;padding:12px 28px;font-size:14px;font-weight:600;text-decoration:none">📧 Solicitar Análise</a>
  </div>
</div>
<footer>StratSight Brasil · OLYMPUS v4.0 · Strategic Foresight · CONFIDENCIAL</footer>
</body></html>`);
  } catch (e: any) {
    return c.html(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px"><h2>Erro interno</h2><pre>${escHtml(e.message)}</pre></body></html>`, 500);
  }
});

export default painelRoutes;