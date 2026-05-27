const fs = require('fs');
const path = require('path');

const destDir = path.join('D:', 'Pessoais', 'DEV', 'Olympus_v4', 'apps', 'api', 'src', 'routes');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const destFile = path.join(destDir, 'export.ts');
const code = `import { Hono } from 'hono';
import { Document, Packer, Paragraph, TextRun, HeadingLevel,
         AlignmentType, BorderStyle, Table, TableRow, TableCell,
         WidthType, ShadingType, Header, Footer, PageNumber } from 'docx';

const exportRoutes = new Hono();

const escHtml = (s: string) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');

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
    ['Classificação', classificacao || 'Acesso Restrito'],
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

      const lines = msg.content.split('\\n');
      for (const line of lines) {
        const clean = line.replace(/\\*\\*\\*([^*]+)\\*\\*\\*/g, '$1').replace(/\\*\\*([^*]+)\\*\\*/g, '$1').replace(/\\*([^*]+)\\*/g, '$1').replace(/\`([^\`]+)\`/g, '$1').trim();
        if (!clean) { children.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 40 } })); continue; }
        if (/^[-─═*]{3,}$/.test(clean)) { children.push(new Paragraph({ children: [new TextRun({ text: '' })], border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' } }, spacing: { before: 80, after: 80 } })); continue; }
        if (line.startsWith('#### ')) children.push(new Paragraph({ text: clean.replace(/^#+\\s*/, ''), heading: HeadingLevel.HEADING_4, spacing: { before: 120, after: 40 } }));
        else if (line.startsWith('### ')) children.push(new Paragraph({ text: clean.replace(/^#+\\s*/, ''), heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 60 } }));
        else if (line.startsWith('## ')) children.push(new Paragraph({ text: clean.replace(/^#+\\s*/, ''), heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 } }));
        else if (line.startsWith('# ')) children.push(new Paragraph({ text: clean.replace(/^#+\\s*/, ''), heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } }));
        else if (/^\\s*[-*•]\\s+/.test(line)) children.push(new Paragraph({ children: [new TextRun({ text: clean.replace(/^[-*•]\\s*/, ''), size: 18 })], bullet: { level: 0 }, spacing: { after: 60 } }));
        else if (/^\\s*\\d+\\.\\s+/.test(line)) children.push(new Paragraph({ children: [new TextRun({ text: clean, size: 18 })], bullet: { level: 0 }, spacing: { after: 60 } }));
        else if (/^\\|/.test(line) && /\\|$/.test(line)) {
          if (!/^[\\s|:-]+$/.test(clean)) {
            const cells = line.split('|').map((c: string) => c.trim()).filter(Boolean).join('  ·  ');
            children.push(new Paragraph({ children: [new TextRun({ text: cells, size: 16, font: 'Courier New' })], spacing: { after: 40 } }));
          }
        } else {
          children.push(new Paragraph({ children: [new TextRun({ text: clean, size: 18 })], spacing: { after: 80 } }));
        }
      }
    }
  }

  return new Document({
    sections: [{
      properties: {},
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: 'StratSight Brasil  ·  OLYMPUS v4.0  ·  ', bold: true, size: 16, color: '1B3A2D' }), new TextRun({ text: nome || 'Relatório de Cenários', size: 16, color: '555555' })], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '2E7D52' } } })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: 'StratSight Brasil  ·  OLYMPUS v4.0  ·  ' + (classificacao || 'Acesso Restrito') + '  ·  Página ', size: 16, color: '888888' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888' })], alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' } } })] }) },
      children,
    }],
  });
}

function buildHtml(projeto: any, messages: any[]) {
  const { nome, cliente, analista, horizonte, classificacao } = projeto;
  const agora = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const AGENT_COLORS: Record<string, string> = { HERMES: '#2E7D52', SCOPUS: '#1565C0', KLIO: '#6A1B9A', PYTHIA: '#B71C1C', MNEMOSYNE: '#E65100', THEMIS: '#37474F', KRATOS: '#004D40', ATHENA: '#2E7D52' };

  const mdToHtml = (text: string) => {
    if (!text) return '';
    return text.split('\\n').map(line => {
      const esc = escHtml(line);
      if (/^####\\s+/.test(line))  return \`<h4>\${escHtml(line.replace(/^####\\s*/,''))}</h4>\`;
      if (/^###\\s+/.test(line))   return \`<h3>\${escHtml(line.replace(/^###\\s*/,''))}</h3>\`;
      if (/^##\\s+/.test(line))    return \`<h2>\${escHtml(line.replace(/^##\\s*/,''))}</h2>\`;
      if (/^#\\s+/.test(line))     return \`<h1>\${escHtml(line.replace(/^#\\s*/,''))}</h1>\`;
      if (/^\\s*[-*•]\\s+/.test(line)) return \`<li>\${escHtml(line.replace(/^\\s*[-*•]\\s*/,''))}</li>\`;
      if (/^\\s*\\d+\\.\\s+/.test(line)) return \`<li>\${escHtml(line.replace(/^\\s*\\d+\\.\\s*/,''))}</li>\`;
      if (/^[-─═]{3,}$/.test(line.trim())) return '<hr>';
      if (/^\\|/.test(line) && /\\|$/.test(line)) {
        if (/^[\\s|:-]+$/.test(line.trim())) return '';
        const cells = line.split('|').map(c=>c.trim()).filter(Boolean);
        return '<tr>' + cells.map(c=>\`<td>\${escHtml(c)}</td>\`).join('') + '</tr>';
      }
      if (!line.trim()) return '<br>';
      return \`<p>\${esc.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g,'<strong><em>$1</em></strong>').replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>').replace(/\\*(.+?)\\*/g,'<em>$1</em>').replace(/\`(.+?)\`/g,'<code>$1</code>')}</p>\`;
    }).join('\\n').replace(/(<tr>.*?<\\/tr>\\n?)+/gs, m => \`<table>\${m}</table>\`);
  };

  const filtered = messages.filter(m => m && m.role && m.content && m.content.trim() && !(m.role === 'user' && m.content.startsWith('Iniciar')) && !(m.role === 'user' && m.content.startsWith('⚙️ Comando: Gerar Relatório')));

  let body = '';
  for (const msg of filtered) {
    if (msg.role === 'user') {
      if (msg.content && msg.content.trim()) body += \`<div class="user-msg"><strong>Usuário:</strong> \${escHtml(msg.content.trim())}</div>\`;
    } else {
      const upper = msg.content.toUpperCase().slice(0, 200);
      let agente = 'HERMES';
      for (const a of ['KRATOS','HERMES','SCOPUS','KLIO','PYTHIA','MNEMOSYNE','THEMIS']) if (upper.includes(a)) { agente = a; break; }
      body += \`<div class="agent-block"><div class="agent-header" style="background:\${AGENT_COLORS[agente] || '#2E7D52'}">\${agente}</div><div class="agent-content">\${mdToHtml(msg.content)}</div></div>\`;
    }
  }

  return \`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>\${escHtml(nome || 'Relatório OLYMPUS')}</title><style>@page { margin: 2cm 2.5cm; } * { box-sizing: border-box; } body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #222; line-height: 1.6; } h1 { font-size: 16pt; color: #1B3A2D; border-bottom: 2px solid #C9A84C; padding-bottom: 4px; margin-top: 20px; } h2 { font-size: 14pt; color: #1B3A2D; margin-top: 16px; } h3 { font-size: 12pt; color: #2E7D52; margin-top: 12px; } h4 { font-size: 11pt; color: #37474F; margin-top: 10px; } p  { margin: 4px 0 8px; } li { margin: 2px 0; } ul, ol { margin: 6px 0 6px 20px; } code { background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 10pt; } hr { border: none; border-top: 1px solid #ddd; margin: 12px 0; } table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 10pt; } td, th { border: 1px solid #ddd; padding: 5px 8px; vertical-align: top; } tr:nth-child(even) td { background: #fafafa; } .cover { text-align: center; padding: 60px 0 40px; page-break-after: always; } .cover h1 { font-size: 26pt; border: none; color: #1B3A2D; } .cover .subtitle { font-size: 13pt; color: #2E7D52; font-style: italic; margin-bottom: 30px; } .meta-table { width: 100%; border-collapse: collapse; margin: 20px 0; } .meta-table td { padding: 7px 12px; border: 1px solid #ddd; font-size: 10.5pt; } .meta-table td:first-child { background: #E8F5E9; font-weight: 700; color: #1B3A2D; width: 35%; } .agent-block { margin: 16px 0; page-break-inside: avoid; } .agent-header { color: #fff; font-weight: 800; font-size: 10pt; letter-spacing: 1px; padding: 5px 12px; border-radius: 4px 4px 0 0; } .agent-content { border: 1px solid #ddd; border-top: none; padding: 12px 16px; border-radius: 0 0 4px 4px; } .user-msg { background: #f5f5f5; padding: 8px 12px; border-radius: 6px; margin: 8px 0; font-size: 10.5pt; color: #333; } .footer-note { text-align: center; font-size: 9pt; color: #aaa; margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px; } @media print { .no-print { display: none; } .agent-block { page-break-inside: avoid; } body { font-size: 10.5pt; } }</style></head><body><div class="cover"><div class="subtitle">StratSight Brasil · Strategic Foresight</div><h1>\${escHtml(nome || 'Relatório de Cenários')}</h1><p style="color:#555;font-size:11pt">Produzido por OLYMPUS v4.0 — Sistema Multiagente de Cenários Prospectivos</p><table class="meta-table" style="margin:30px auto;max-width:500px"><tr><td>Cliente / Organização</td><td>\${escHtml(cliente||'—')}</td></tr><tr><td>Metodologia</td><td>\${escHtml(projeto.metodologia||'MSEF')}</td></tr><tr><td>Horizonte Temporal</td><td>\${escHtml(horizonte||'—')}</td></tr><tr><td>Classificação</td><td><strong>\${escHtml(classificacao||'Acesso Restrito')}</strong></td></tr><tr><td>Gerado em</td><td>\${agora}</td></tr></table></div>\${body}<div class="footer-note">StratSight Brasil · OLYMPUS v4.0 · \${escHtml(classificacao||'Acesso Restrito')}</div><script>window.onload=function(){setTimeout(function(){window.print();},500)};</script></body></html>\`;
}

exportRoutes.post('/docx', async (c) => {
  try {
    const { projeto, messages } = await c.req.json();
    const doc = buildDocx(projeto || {}, messages || []);
    const buffer = await Packer.toBuffer(doc);
    const filename = \`StratSight_\${(projeto?.nome || 'Cenarios').replace(/\\s+/g, '_')}_\${new Date().toISOString().slice(0,10)}.docx\`;
    return new Response(buffer, { status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': \`attachment; filename="\${filename}"\` } });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

exportRoutes.post('/pdf', async (c) => {
  try {
    const { projeto, messages } = await c.req.json();
    const html = buildHtml(projeto || {}, messages || []);
    const filename = \`StratSight_\${(projeto?.nome || 'Cenarios').replace(/\\s+/g, '_')}_\${new Date().toISOString().slice(0,10)}.html\`;
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': \`inline; filename="\${filename}"\` } });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

export default exportRoutes;`;

fs.writeFileSync(destFile, code, 'utf-8');
console.log('✅ Arquivo export.ts criado com SUCESSO em: ' + destFile);
