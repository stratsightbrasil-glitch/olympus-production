import { Hono } from 'hono';
import { Document, Packer, Paragraph, TextRun, HeadingLevel,
         AlignmentType, BorderStyle, Table, TableRow, TableCell,
         WidthType, ShadingType, Header, Footer, PageNumber } from 'docx';

const exportRoutes = new Hono();

const escHtml = (s: string) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');

// Parseia markdown inline (**bold**, *italic*, ***bold-italic***, `code`) em TextRun[]
function parseInline(text: string, size: number): any[] {
  const runs: any[] = [];
  const regex = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), size }));
    if      (m[1]) runs.push(new TextRun({ text: m[1], bold: true, italics: true, size }));
    else if (m[2]) runs.push(new TextRun({ text: m[2], bold: true, size }));
    else if (m[3]) runs.push(new TextRun({ text: m[3], italics: true, size }));
    else if (m[4]) runs.push(new TextRun({ text: m[4], font: 'Courier New', size: size - 2 }));
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), size }));
  return runs.length > 0 ? runs : [new TextRun({ text, size })];
}

function buildDocx(projeto: any, messages: any[]) {
  const { nome, cliente, analista, horizonte, classificacao } = projeto;
  const children: any[] = [];

  children.push(new Paragraph({
    children: [new TextRun({ text: 'StratSight Brasil', bold: true, size: 48, color: '1B3A2D' })],
    alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 200 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Strategic Foresight', size: 28, color: '2E7D52', italics: true })],
    alignment: AlignmentType.CENTER, spacing: { after: 800 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: nome || 'Relatório de Cenários', bold: true, size: 36, color: '1B3A2D' })],
    alignment: AlignmentType.CENTER, spacing: { after: 300 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Produzido por OLYMPUS v4.0 — Sistema Multiagente de Cenários Prospectivos', size: 20, color: '555555' })],
    alignment: AlignmentType.CENTER, spacing: { after: 800 },
  }));

  const meta = [
    ['Cliente / Organização', cliente || '—'],
    ['Analista Responsável', analista || 'StratSight Brasil'],
    ['Horizonte Temporal', horizonte || '—'],
    ['Metodologia', projeto.metodologia || 'MSEF'],
    ['Classificação', classificacao || 'Confidencial'],
    ['Versão do Documento', '1.0'],
  ];
  const metaRows = meta.map(([k, v]) => new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, size: 18, color: '1B3A2D' })] })], width: { size: 35, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, fill: 'E8F5E9' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(v), size: 18 })] })], width: { size: 65, type: WidthType.PERCENTAGE } }),
    ],
  }));
  children.push(new Table({ rows: metaRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
  children.push(new Paragraph({ children: [new TextRun({ text: '' })], pageBreakBefore: true }));

  const filtered = messages.filter(m => m && m.role && m.content && m.content.trim() && !(m.role === 'user' && m.content.startsWith('Iniciar')) && !(m.role === 'user' && m.content.startsWith('⚙️ Comando: Gerar Relatório')));

  for (const msg of filtered) {
    if (msg.role === 'user') {
      if (msg.content && msg.content.trim()) {
        const displayText = msg.content.length > 300 ? msg.content.slice(0, 300) + '...' : msg.content;
        children.push(new Paragraph({ children: [new TextRun({ text: 'Usuário: ', bold: true, size: 18, color: '1B3A2D' }), new TextRun({ text: displayText.trim(), size: 18, color: '444444' })], spacing: { before: 160, after: 80 } }));
      }
    } else {
      const upper = msg.content.toUpperCase().slice(0, 200);
      let agente = 'HERMES';
      for (const a of ['KRATOS','HERMES','SCOPUS','KLIO','PYTHIA','MNEMOSYNE','THEMIS']) if (upper.includes(a)) { agente = a; break; }

      children.push(new Paragraph({ children: [new TextRun({ text: agente, bold: true, size: 20, color: 'FFFFFF' })], spacing: { before: 300, after: 0 }, shading: { type: ShadingType.SOLID, fill: '1B3A2D' } }));

      const lines = msg.content.split('\n');
      for (const line of lines) {
        // clean: versão sem markdown inline, usada apenas para detecção de padrões
        const clean = line.replace(/\*\*\*([^*]+)\*\*\*/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
        if (!clean) { children.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 40 } })); continue; }
        if (/^[-─═*]{3,}$/.test(clean)) { children.push(new Paragraph({ children: [new TextRun({ text: '' })], border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' } }, spacing: { before: 80, after: 80 } })); continue; }
        if (line.startsWith('#### ')) children.push(new Paragraph({ children: parseInline(clean.replace(/^#+\s*/, ''), 18), heading: HeadingLevel.HEADING_4, spacing: { before: 120, after: 40 } }));
        else if (line.startsWith('### ')) children.push(new Paragraph({ children: parseInline(clean.replace(/^#+\s*/, ''), 20), heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 60 } }));
        else if (line.startsWith('## ')) children.push(new Paragraph({ children: parseInline(clean.replace(/^#+\s*/, ''), 22), heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 } }));
        else if (line.startsWith('# ')) children.push(new Paragraph({ children: parseInline(clean.replace(/^#+\s*/, ''), 26), heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } }));
        else if (/^\s*[-*•]\s+/.test(line)) {
          const bulletText = line.replace(/^\s*[-*•]\s+/, '').trim();
          children.push(new Paragraph({ children: parseInline(bulletText, 18), bullet: { level: 0 }, spacing: { after: 60 } }));
        } else if (/^\s*\d+\.\s+/.test(line)) {
          const numberedText = line.replace(/^\s*\d+\.\s+/, '').trim();
          children.push(new Paragraph({ children: parseInline(numberedText, 18), bullet: { level: 0 }, spacing: { after: 60 } }));
        } else if (/^\|/.test(line) && /\|$/.test(line)) {
          if (!/^[\s|:-]+$/.test(clean)) {
            const cells = line.split('|').map((c: string) => c.trim()).filter(Boolean);
            const cellRuns = cells.flatMap((c: string, i: number) => [
              ...parseInline(c, 16),
              ...(i < cells.length - 1 ? [new TextRun({ text: '  |  ', size: 16, color: '888888' })] : []),
            ]);
            children.push(new Paragraph({ children: cellRuns, spacing: { after: 40 } }));
          }
        } else {
          children.push(new Paragraph({ children: parseInline(line.trim(), 18), spacing: { after: 80 } }));
        }
      }
    }
  }

  return new Document({
    sections: [{
      properties: {},
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: 'StratSight Brasil  ·  OLYMPUS v4.0  ·  ', bold: true, size: 16, color: '1B3A2D' }), new TextRun({ text: nome || 'Relatório de Cenários', size: 16, color: '555555' })], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '2E7D52' } } })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: 'StratSight Brasil  ·  OLYMPUS v4.0  ·  ' + (classificacao || 'Confidencial') + '  ·  Página ', size: 16, color: '888888' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888' })], alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' } } })] }) },
      children,
    }],
  });
}

function buildHtml(projeto: any, messages: any[], tipo: string = 'relatorio') {
  const { nome, cliente, analista, horizonte, classificacao } = projeto;
  const filename = `${(nome || 'Relatorio').replace(/[<>:"/\\|?*]/g,'').replace(/\s+/g,'_')}_${tipo}`;
  const agora = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });

  const AGENT_COLORS: Record<string, string> = {
    HERMES: '#1B3A2D', SCOPUS: '#1565C0', KLIO: '#4527A0', PYTHIA: '#B71C1C',
    MNEMOSYNE: '#BF360C', THEMIS: '#37474F', KRATOS: '#004D40', ATHENA: '#2E7D52',
  };
  const AGENT_ROLES: Record<string, string> = {
    HERMES: 'Orquestrador MSEF', SCOPUS: 'Enquadramento Estratégico', KLIO: 'Análise Ambiental',
    PYTHIA: 'Geração de Cenários', MNEMOSYNE: 'Desenvolvimento Narrativo',
    THEMIS: 'Implicações Estratégicas', KRATOS: 'Monitoramento Contínuo', ATHENA: 'Motor Estratégico',
  };

  // ── Markdown → HTML ──────────────────────────────────────────────────────────
  const mdToHtml = (text: string): string => {
    if (!text) return '';
    const inline = (s: string) => escHtml(s)
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');

    const lines = text.split('\n');
    const out: string[] = [];
    let ul = false, ol = false;
    let tableRows: string[][] = [], inTable = false, tableFirstRow = true;

    const flushList = () => {
      if (ul) { out.push('</ul>'); ul = false; }
      if (ol) { out.push('</ol>'); ol = false; }
    };
    const flushTable = () => {
      if (!inTable || tableRows.length === 0) return;
      const [head, ...body] = tableRows;
      out.push('<table>');
      out.push('<thead><tr>' + head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead>');
      if (body.length) {
        out.push('<tbody>');
        body.forEach(row => out.push('<tr>' + row.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>'));
        out.push('</tbody>');
      }
      out.push('</table>');
      tableRows = []; inTable = false; tableFirstRow = true;
    };

    for (const line of lines) {
      const t = line.trim();
      // Table
      if (/^\|/.test(t) && /\|$/.test(t)) {
        flushList();
        if (/^[\s|:-]+$/.test(t)) { tableFirstRow = false; continue; }
        tableRows.push(t.split('|').map(c => c.trim()).filter(Boolean));
        inTable = true;
        continue;
      }
      if (inTable) flushTable();
      // Headings
      if (/^####\s/.test(line)) { flushList(); out.push(`<h4>${inline(line.replace(/^####\s*/,''))}</h4>`); continue; }
      if (/^###\s/.test(line))  { flushList(); out.push(`<h3>${inline(line.replace(/^###\s*/,''))}</h3>`); continue; }
      if (/^##\s/.test(line))   { flushList(); out.push(`<h2>${inline(line.replace(/^##\s*/,''))}</h2>`); continue; }
      if (/^#\s/.test(line))    { flushList(); out.push(`<h1>${inline(line.replace(/^#\s*/,''))}</h1>`); continue; }
      // HR
      if (/^[-─═*]{3,}$/.test(t)) { flushList(); out.push('<hr>'); continue; }
      // Lists
      if (/^\s*[-*•]\s/.test(line)) {
        if (ol) { out.push('</ol>'); ol = false; }
        if (!ul) { out.push('<ul>'); ul = true; }
        out.push(`<li>${inline(line.replace(/^\s*[-*•]\s+/,''))}</li>`);
        continue;
      }
      if (/^\s*\d+\.\s/.test(line)) {
        if (ul) { out.push('</ul>'); ul = false; }
        if (!ol) { out.push('<ol>'); ol = true; }
        out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/,''))}</li>`);
        continue;
      }
      // Empty — skip; CSS margins handle spacing between block elements
      if (!t) { flushList(); continue; }
      // Paragraph
      flushList();
      out.push(`<p>${inline(t)}</p>`);
    }
    flushList(); flushTable();
    return out.join('\n');
  };

  // ── Body ─────────────────────────────────────────────────────────────────────
  const filtered = messages.filter(m =>
    m && m.role && m.content && m.content.trim() &&
    !(m.role === 'user' && m.content.startsWith('Iniciar')) &&
    !(m.role === 'user' && m.content.startsWith('⚙️ Comando'))
  );

  let body = '';
  for (const msg of filtered) {
    if (msg.role === 'user') {
      if (msg.content?.trim()) {
        body += `<div class="user-msg"><span class="user-label">Usuário</span>${escHtml(msg.content.trim())}</div>`;
      }
    } else {
      const upper = msg.content.toUpperCase().slice(0, 200);
      let agente = 'HERMES';
      for (const a of ['KRATOS','HERMES','SCOPUS','KLIO','PYTHIA','MNEMOSYNE','THEMIS']) {
        if (upper.includes(a)) { agente = a; break; }
      }
      const color = AGENT_COLORS[agente] || '#1B3A2D';
      const role  = AGENT_ROLES[agente]  || '';
      body += `<div class="agent-block">
  <div class="agent-header" style="background:${color}">
    <span class="agent-name">${agente}</span>
    <span class="agent-role">${role}</span>
  </div>
  <div class="agent-content">${mdToHtml(msg.content)}</div>
</div>`;
    }
  }

  // ── CSS ──────────────────────────────────────────────────────────────────────
  const css = `
@page { margin: 2.2cm 2.5cm 2cm; size: A4; }
*, *::before, *::after {
  box-sizing: border-box; margin: 0; padding: 0;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}
body { font-family: 'Segoe UI', Inter, system-ui, -apple-system, sans-serif; font-size: 10.5pt; color: #1a1a1a; line-height: 1.75; background: #fff; padding-top: 52px; }

/* ── Barra salvar (apenas tela) ── */
.save-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 9999; background: #1B3A2D; color: #fff; padding: 10px 24px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; gap: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.35); }
.save-bar-left { display: flex; align-items: center; gap: 10px; }
.save-bar-left span { opacity: .75; font-size: 11px; }
.save-bar strong { color: #C9A84C; }
.save-bar-right { display: flex; align-items: center; gap: 10px; }
.save-bar-hint { font-size: 11px; opacity: .65; }
.save-btn { background: #C9A84C; color: #1B3A2D; font-weight: 800; border: none; padding: 7px 20px; border-radius: 4px; cursor: pointer; font-size: 12px; white-space: nowrap; letter-spacing: .3px; }
.save-btn:hover { background: #d4b45a; }

/* ── Cover ── */
.cover { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 94vh; padding: 60px 40px; page-break-after: always; text-align: center; }
.brand { font-size: 10pt; font-weight: 800; letter-spacing: 4px; text-transform: uppercase; color: #1B3A2D; }
.brand-sub { font-size: 9pt; color: #2E7D52; font-style: italic; margin-top: 3px; margin-bottom: 52px; }
.cover-bar { width: 52px; height: 4px; background: linear-gradient(90deg, #1B3A2D, #C9A84C); margin: 0 auto 40px; border-radius: 2px; }
.cover h1 { font-size: 21pt; font-weight: 800; color: #1B3A2D; line-height: 1.3; margin-bottom: 10px; border-bottom: none !important; padding-bottom: 0 !important; }
.cover .doc-sub { font-size: 9.5pt; color: #777; margin-bottom: 52px; }
.meta-card { width: 100%; max-width: 460px; border-collapse: collapse; border-radius: 8px; overflow: hidden; border: 1px solid #d6ead9; }
.meta-card tr { border-bottom: 1px solid #e8f5e9; }
.meta-card tr:last-child { border-bottom: none; }
.meta-card td:first-child { background: #f0f9f2; color: #1B3A2D; font-weight: 700; font-size: 8.5pt; padding: 9px 16px; width: 42%; letter-spacing: .3px; }
.meta-card td:last-child { color: #333; font-size: 9pt; padding: 9px 16px; }
.badge-conf { display: inline-block; background: #1B3A2D; color: #C9A84C; font-weight: 800; font-size: 7.5pt; padding: 3px 10px; border-radius: 3px; letter-spacing: 1.5px; }

/* ── Typography ── */
h1 { font-size: 14pt; font-weight: 800; color: #1B3A2D; border-bottom: 2.5px solid #C9A84C; padding-bottom: 5px; margin: 22px 0 12px; page-break-after: avoid; }
h2 { font-size: 12pt; font-weight: 700; color: #1B3A2D; margin: 18px 0 8px; page-break-after: avoid; }
h3 { font-size: 11pt; font-weight: 700; color: #2E7D52; margin: 14px 0 6px; page-break-after: avoid; }
h4 { font-size: 10.5pt; font-weight: 600; color: #37474F; margin: 10px 0 4px; page-break-after: avoid; }
p { margin: 0 0 8px; }
ul, ol { margin: 6px 0 10px 22px; }
li { margin-bottom: 3px; line-height: 1.65; }
code { font-family: 'Consolas', 'Courier New', monospace; font-size: 9pt; background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 3px; padding: 1px 5px; }
hr { border: none; border-top: 1px solid #e0e0e0; margin: 14px 0; }

/* ── Tables ── */
table { border-collapse: collapse; width: 100%; margin: 10px 0 16px; font-size: 9.5pt; page-break-inside: avoid; }
thead th { background: #1B3A2D; color: #fff; font-weight: 600; padding: 7px 11px; text-align: left; font-size: 8.5pt; letter-spacing: .3px; }
td { border: 1px solid #e0e0e0; padding: 6px 11px; vertical-align: top; }
tr:nth-child(even) td { background: #f9fbfa; }

/* ── Agent blocks ── */
.agent-block { margin: 20px 0; page-break-inside: avoid; border-radius: 6px; overflow: hidden; border: 1px solid #ddd; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.agent-header { padding: 9px 18px; display: flex; align-items: baseline; gap: 12px; }
.agent-name { font-size: 8.5pt; font-weight: 800; letter-spacing: 2.5px; color: #fff; }
.agent-role { font-size: 8pt; color: rgba(255,255,255,.65); font-style: italic; }
.agent-content { padding: 16px 20px; background: #fff; }
.agent-content p:last-child { margin-bottom: 0; }

/* ── User message ── */
.user-msg { background: #f8f8f8; border-left: 3px solid #bbb; padding: 8px 14px; margin: 14px 0; font-size: 9.5pt; color: #666; border-radius: 0 4px 4px 0; display: flex; gap: 10px; align-items: baseline; }
.user-label { font-weight: 700; color: #555; font-size: 8pt; letter-spacing: 1px; text-transform: uppercase; white-space: nowrap; }

@media print {
  @page { margin: 2.2cm 2.5cm 2cm; size: A4; }
  @page :left  { margin-left: 2.5cm; }
  @page :right { margin-right: 2.5cm; }

  .save-bar { display: none !important; }
  body { padding-top: 0 !important; font-size: 10pt; }
  .cover { page-break-after: always; min-height: 100vh; justify-content: center; }

  /* Agent headers: fallback when background-graphics is off */
  .agent-header {
    border-bottom: 2px solid #1B3A2D !important;
    background: #f5f5f5 !important;
    padding: 8px 18px !important;
  }
  .agent-name { color: #1B3A2D !important; font-size: 8pt; letter-spacing: 2px; }
  .agent-role { color: #555 !important; }
  .agent-block { border: 1px solid #ccc !important; box-shadow: none !important; page-break-inside: avoid; margin: 16px 0; }
  .agent-content { border-top: 1px solid #e0e0e0; }

  /* Meta-card cover table */
  .meta-card td:first-child { background: #f0f0f0 !important; }
  .badge-conf { background: #1B3A2D !important; color: #C9A84C !important; }

  /* Table headers */
  thead th { background: #1B3A2D !important; color: #fff !important; }
  tr:nth-child(even) td { background: #f9f9f9 !important; }

  h1, h2, h3, h4 { page-break-after: avoid; }
  table { page-break-inside: avoid; }
  ul, ol { page-break-inside: avoid; }

  /* Page numbers */
  body::after {
    content: none;
  }
}`;

  const classif = escHtml(classificacao || 'Confidencial');
  const badgeVal = `<span class="badge-conf">${classif}</span>`;
  const tipoLabel = tipo === 'estendido' ? 'Relatório Estendido' : 'Relatório Padrão';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${filename}</title>
<style>${css}</style>
</head>
<body>

<div class="save-bar">
  <div class="save-bar-left">
    <span>📄</span>
    <strong>${filename}.pdf</strong>
    <span>· ${tipoLabel}</span>
  </div>
  <div class="save-bar-right">
    <span class="save-bar-hint">No diálogo, selecione "Salvar como PDF"</span>
    <button class="save-btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  </div>
</div>

<div class="cover">
  <div class="brand">StratSight Brasil</div>
  <div class="brand-sub">Strategic Foresight · OLYMPUS v4.0</div>
  <div class="cover-bar"></div>
  <h1>${escHtml(nome || 'Relatório de Cenários')}</h1>
  <div class="doc-sub">${tipoLabel} · Sistema Multiagente de Cenários Prospectivos</div>
  <table class="meta-card">
    <tr><td>Cliente / Organização</td><td>${escHtml(cliente||'—')}</td></tr>
    <tr><td>Analista Responsável</td><td>${escHtml(analista||'StratSight Brasil')}</td></tr>
    <tr><td>Horizonte Temporal</td><td>${escHtml(horizonte||'—')}</td></tr>
    <tr><td>Metodologia</td><td>${escHtml(projeto.metodologia||'MSEF')}</td></tr>
    <tr><td>Classificação</td><td>${badgeVal}</td></tr>
    <tr><td>Gerado em</td><td>${agora}</td></tr>
  </table>
</div>

<div class="content">
${body}
</div>

</body>
</html>`;
}

exportRoutes.post('/docx', async (c) => {
  try {
    const { projeto, messages } = (await c.req.json()) as any;
    const doc = buildDocx(projeto || {}, messages || []);
    const buffer = await Packer.toBuffer(doc);
    const filename = `StratSight_${(projeto?.nome || 'Cenarios').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.docx`;
    return new Response(buffer as any, { status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="${filename}"` } });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

exportRoutes.post('/pdf', async (c) => {
  try {
    const { projeto, messages, tipo } = (await c.req.json()) as any;
    const html = buildHtml(projeto || {}, messages || [], tipo || 'relatorio');
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

export default exportRoutes;