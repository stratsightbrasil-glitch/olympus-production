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
    children: [new TextRun({ text: 'Produzido por OLYMPUS v1.0 — Sistema Multiagente de Cenários Prospectivos', size: 20, color: '555555' })],
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

  const DOCX_PHASE_LABELS: Record<string, string> = {
    SCOPUS: 'Enquadramento Estratégico', KLIO: 'Análise Ambiental',
    PYTHIA: 'Cenários Prospectivos', MNEMOSYNE: 'Narrativas de Cenários',
    THEMIS: 'Implicações e Alertas', KRATOS: 'Monitoramento Contínuo',
    HERMES: 'Síntese e Conclusão', HERMES_GRUMBACH: 'Síntese e Conclusão',
    HERMES_GODET: 'Síntese e Conclusão', HERMES_SIEX: 'Síntese e Conclusão',
  };
  const DOCX_AGENT_MARKER_RE = /\*\*(HERMES(?:_\w+)?|SCOPUS|KLIO|PYTHIA|MNEMOSYNE|THEMIS|KRATOS|HERMES_REVISOR)\*\*\s*[··•\-]\s*/g;

  const filtered = messages.filter(m =>
    m && m.role === 'assistant' && m.content?.trim() &&
    !m.content.startsWith('⚙️ Comando')
  );

  const docxPhasesSeen = new Set<string>();
  for (const msg of filtered) {
    const upper = msg.content.toUpperCase().slice(0, 300);
    let agente = 'HERMES';
    for (const a of ['HERMES_GRUMBACH','HERMES_GODET','HERMES_SIEX','KRATOS','MNEMOSYNE','THEMIS','PYTHIA','KLIO','SCOPUS','HERMES']) {
      if (upper.includes(a)) { agente = a; break; }
    }
    const phaseLabel = DOCX_PHASE_LABELS[agente] || 'Análise';
    // Evita repetir o mesmo cabeçalho de fase (ex: múltiplas mensagens do HERMES)
    if (!docxPhasesSeen.has(phaseLabel) || agente === 'HERMES') {
      if (!docxPhasesSeen.has(phaseLabel)) {
        docxPhasesSeen.add(phaseLabel);
        children.push(new Paragraph({ children: [new TextRun({ text: phaseLabel, bold: true, size: 20, color: 'FFFFFF' })], spacing: { before: 300, after: 0 }, shading: { type: ShadingType.SOLID, fill: '1B3A2D' } }));
      }
    }

      // Remove todos os marcadores de agente do conteúdo antes de processar
      const cleanedContent = msg.content.replace(DOCX_AGENT_MARKER_RE, '');
      const lines = cleanedContent.split('\n');
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

  return new Document({
    sections: [{
      properties: {},
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: 'StratSight Brasil  ·  OLYMPUS v1.0  ·  ', bold: true, size: 16, color: '1B3A2D' }), new TextRun({ text: nome || 'Relatório de Cenários', size: 16, color: '555555' })], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '2E7D52' } } })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: 'StratSight Brasil  ·  OLYMPUS v1.0  ·  ' + (classificacao || 'Confidencial') + '  ·  Página ', size: 16, color: '888888' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888' })], alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' } } })] }) },
      children,
    }],
  });
}

function buildHtml(projeto: any, messages: any[], tipo: string = 'relatorio') {
  const { nome, cliente, analista, horizonte, classificacao } = projeto;
  const filename = `${(nome || 'Relatorio').replace(/[<>:"/\\|?*]/g,'').replace(/\s+/g,'_')}_${tipo}`;
  const agora = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone: 'America/Sao_Paulo' });

  // Mapeamento agente → fase da metodologia (sem expor nomes internos ao cliente)
  const PHASE_LABELS: Record<string, string> = {
    SCOPUS:    'Enquadramento Estratégico',
    KLIO:      'Análise Ambiental',
    PYTHIA:    'Cenários Prospectivos',
    MNEMOSYNE: 'Narrativas de Cenários',
    THEMIS:    'Implicações e Alertas',
    KRATOS:    'Monitoramento Contínuo',
    HERMES:    'Síntese e Conclusão',
    HERMES_GRUMBACH: 'Síntese e Conclusão',
    HERMES_GODET:    'Síntese e Conclusão',
    HERMES_SIEX:     'Síntese e Conclusão',
  };
  const PHASE_COLORS: Record<string, string> = {
    SCOPUS: '#1565C0', KLIO: '#4527A0', PYTHIA: '#B71C1C',
    MNEMOSYNE: '#BF360C', THEMIS: '#37474F', KRATOS: '#004D40',
    HERMES: '#1B3A2D', HERMES_GRUMBACH: '#1B3A2D', HERMES_GODET: '#1B3A2D', HERMES_SIEX: '#1B3A2D',
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
  // Remove TODOS os marcadores de agente ("**AGENTE** · ") do conteúdo — globalmente
  const KNOWN_AGENTS = ['HERMES_GRUMBACH','HERMES_GODET','HERMES_SIEX','HERMES_REVISOR','HERMES','KRATOS','MNEMOSYNE','THEMIS','PYTHIA','KLIO','SCOPUS'];
  const AGENT_MARKER_RE = new RegExp(`\\*\\*(${KNOWN_AGENTS.join('|')})\\*\\*\\s*[··•\\-]\\s*`, 'g');

  const stripAllAgentMarkers = (text: string): string => {
    // 1. Remove **AGENT** · markdown markers
    let result = text.replace(AGENT_MARKER_RE, '');
    // 2. Remove plain-text agent coordination lines (e.g. "MNEMOSYNE entregou a Seção 1...")
    result = result.split('\n').filter(line => {
      const t = line.trim();
      return !KNOWN_AGENTS.some(agent =>
        t.startsWith(agent) && t.length > agent.length && /[\s,.:;]/.test(t[agent.length])
      );
    }).join('\n');
    return result;
  };

  // Detecta agente pela assinatura no início do conteúdo
  const detectAgent = (content: string): string => {
    const upper = content.slice(0, 300).toUpperCase();
    const ORDER = ['HERMES_GRUMBACH','HERMES_GODET','HERMES_SIEX','KRATOS','MNEMOSYNE','THEMIS','PYTHIA','KLIO','SCOPUS','HERMES'];
    for (const a of ORDER) { if (upper.includes(a)) return a; }
    return 'HERMES';
  };

  // Para o relatório padrão (single message): renderiza limpo, sem cabeçalho de agente
  // Para o estendido: agrupa por fase, elimina mensagens do usuário e conversas intermediárias
  const agentMsgsOnly = messages.filter(m =>
    m && m.role === 'assistant' && m.content?.trim() &&
    !m.content.startsWith('⚙️ Comando')
  );

  const isExtendido = tipo === 'estendido';
  const isPadrao    = !isExtendido;

  let body = '';

  if (isPadrao) {
    // Padrão: renderiza o conteúdo diretamente (já é o relatório final do HERMES)
    const content = agentMsgsOnly[0]?.content || '';
    body = `<div class="report-content">${mdToHtml(stripAllAgentMarkers(content))}</div>`;
  } else {
    // Estendido: uma seção por agente/fase, sem expor nomes de agentes
    const phasesSeen = new Set<string>();
    for (const msg of agentMsgsOnly) {
      const agente = detectAgent(msg.content);
      const phaseLabel = PHASE_LABELS[agente] || 'Análise';
      const color = PHASE_COLORS[agente] || '#1B3A2D';
      // Evita repetir a mesma fase seguida (ex: múltiplas mensagens de HERMES)
      const phaseKey = agente;
      const cleanContent = stripAllAgentMarkers(msg.content);
      if (phasesSeen.has(phaseKey) && agente.startsWith('HERMES')) {
        // Múltiplas mensagens do orquestrador: agrega na seção de síntese sem novo cabeçalho
        body += `<div class="phase-content-extra">${mdToHtml(cleanContent)}</div>`;
      } else {
        phasesSeen.add(phaseKey);
        body += `<div class="phase-block">
  <div class="phase-header" style="border-left-color:${color}">
    <span class="phase-label">${escHtml(phaseLabel)}</span>
  </div>
  <div class="phase-content">${mdToHtml(cleanContent)}</div>
</div>`;
      }
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

/* ── Relatório Padrão — conteúdo limpo ── */
.report-content { padding: 0; }
.report-content p:last-child { margin-bottom: 0; }

/* ── Relatório Estendido — seções por fase ── */
.phase-block { margin: 24px 0; page-break-inside: avoid; }
.phase-header { padding: 6px 0 6px 14px; border-left: 4px solid #1B3A2D; margin-bottom: 12px; }
.phase-label { font-size: 9pt; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #1B3A2D; }
.phase-content { padding: 0; }
.phase-content p:last-child { margin-bottom: 0; }
.phase-content-extra { padding: 0; margin-top: 8px; }

@media print {
  @page { margin: 2.2cm 2.5cm 2cm; size: A4; }
  @page :left  { margin-left: 2.5cm; }
  @page :right { margin-right: 2.5cm; }

  .save-bar { display: none !important; }
  body { padding-top: 0 !important; font-size: 10pt; }
  .cover { page-break-after: always; min-height: 100vh; justify-content: center; }

  /* Phase blocks: impressão */
  .phase-block { page-break-inside: avoid; margin: 16px 0; }
  .phase-header { border-left: 3px solid #1B3A2D !important; padding-left: 12px !important; }
  .phase-label { color: #1B3A2D !important; }
  .report-content { padding: 0; }

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
  <div class="brand-sub">Strategic Foresight · OLYMPUS v1.0</div>
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

// ─────────────────────────────────────────────────────────────────────────────
// ESTIMATIVA EB — §5.8 do EB70-MT-10.401 (SIEx)
// ─────────────────────────────────────────────────────────────────────────────
function buildEstimativaHtml(projeto: any, messages: any[]) {
  const { nome, cliente, analista, horizonte } = projeto;
  const agora = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const filename = `Estimativa_${(nome || 'SIEx').replace(/[<>:"/\\|?*]/g,'').replace(/\s+/g,'_')}`;

  // Extrai blocos de cada fase das mensagens dos agentes
  const agentMsgs = messages.filter(m => m && m.role === 'assistant' && m.content?.trim());

  const getBlock = (keywords: string[]): string => {
    const found = agentMsgs.find(m =>
      keywords.some(k => m.content.toUpperCase().includes(k.toUpperCase()))
    );
    return found ? found.content : '';
  };

  const planejamentoBlock = getBlock(['FICHA DE PLANEJAMENTO', 'AECK', 'AEC —', 'FASE 1', 'PLANEJAMENTO']);
  const reuniaoBlock      = getBlock(['TAD', 'AVALIAÇÃO DA FONTE', 'AVALIAÇÃO DO CONTEÚDO', 'REUNIÃO', 'FASE 2']);
  const analiseBlock      = getBlock(['FRAÇÕES SIGNIFICATIVAS', 'PERTINÊNCIA', 'SÍNTESE', 'ANÁLISE E SÍNTESE', 'FASE 3']);
  const interpretacaoBlock= getBlock(['FATORES DE INFLUÊNCIA', 'HIPÓTESE', 'DELINEAMENTO', 'INTERPRETAÇÃO', 'FASE 4']);
  const conclusaoBlock    = getBlock(['H1', 'H2', 'PROBABILIDADE ESTIMADA', 'CONCLUSÃO', 'FASE 5', 'FORMALIZAÇÃO']);

  // Markdown → HTML inline (reutiliza lógica similar ao buildHtml)
  const escH = (s: string) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inline = (s: string) => escH(s)
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>');

  const md2html = (text: string): string => {
    if (!text) return '<p><em>(sem conteúdo)</em></p>';
    const lines = text.split('\n');
    const out: string[] = [];
    let ul = false, ol = false;
    let tableRows: string[][] = [], inTable = false;

    const flushList  = () => { if (ul) { out.push('</ul>'); ul=false; } if (ol) { out.push('</ol>'); ol=false; } };
    const flushTable = () => {
      if (!inTable || tableRows.length === 0) return;
      const [head, ...body] = tableRows;
      out.push('<table><thead><tr>' + head.map(c=>`<th>${inline(c)}</th>`).join('') + '</tr></thead>');
      if (body.length) { out.push('<tbody>'); body.forEach(r=>out.push('<tr>'+r.map(c=>`<td>${inline(c)}</td>`).join('')+'</tr>')); out.push('</tbody>'); }
      out.push('</table>'); tableRows=[]; inTable=false;
    };
    for (const line of lines) {
      const t = line.trim();
      if (/^\|/.test(t) && /\|$/.test(t)) { flushList(); if (/^[\s|:-]+$/.test(t)) continue; tableRows.push(t.split('|').map(c=>c.trim()).filter(Boolean)); inTable=true; continue; }
      if (inTable) flushTable();
      if (/^#{1,4}\s/.test(line)) { flushList(); const lvl=line.match(/^(#+)/)?.[1].length||1; const txt=line.replace(/^#+\s*/,''); out.push(`<h${lvl}>${inline(txt)}</h${lvl}>`); continue; }
      if (/^[-─═*]{3,}$/.test(t)) { flushList(); out.push('<hr>'); continue; }
      if (/^\s*[-*•]\s/.test(line)) { if (ol){out.push('</ol>');ol=false;} if(!ul){out.push('<ul>');ul=true;} out.push(`<li>${inline(line.replace(/^\s*[-*•]\s+/,''))}</li>`); continue; }
      if (/^\s*\d+\.\s/.test(line)) { if (ul){out.push('</ul>');ul=false;} if(!ol){out.push('<ol>');ol=true;} out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/,''))}</li>`); continue; }
      if (!t) { flushList(); continue; }
      flushList(); out.push(`<p>${inline(t)}</p>`);
    }
    flushList(); flushTable();
    return out.join('\n');
  };

  const css = `
@page { margin: 2.5cm 3cm 2.5cm; size: A4; }
*, *::before, *::after { box-sizing: border-box; margin:0; padding:0;
  -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #111; line-height: 1.7; background:#fff; padding-top: 52px; }

/* ── Barra salvar ── */
.save-bar { position:fixed; top:0; left:0; right:0; z-index:9999; background:#1B3A2D; color:#fff;
  padding:10px 24px; display:flex; align-items:center; justify-content:space-between; font-size:12px;
  gap:16px; box-shadow:0 2px 8px rgba(0,0,0,.35); font-family:'DM Sans',system-ui,sans-serif; }
.save-bar strong { color:#C9A84C; }
.save-btn { background:#C9A84C; color:#1B3A2D; font-weight:800; border:none; padding:7px 20px;
  border-radius:4px; cursor:pointer; font-size:12px; }
.save-btn:hover { background:#d4b45a; }

/* ── Documento ── */
.doc { max-width: 680px; margin: 0 auto; padding: 0 0 40px; }

/* ── Cabeçalho ── */
.cabecalho { text-align:center; margin-bottom: 20px; border-bottom: 2px solid #111; padding-bottom: 10px; }
.classif { font-weight:900; font-size: 10pt; letter-spacing: 3px; text-transform:uppercase; }
.classif.conf { color: #7B0000; }
.doc-titulo { font-size: 12pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin: 6px 0 2px; }
.doc-subtitulo { font-size: 10pt; }
.doc-meta { font-size: 10pt; margin-top: 6px; display:flex; justify-content:space-between; }

/* ── Seções ── */
.secao { margin-bottom: 22px; }
.secao-titulo { font-size: 11pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;
  border-bottom: 1px solid #333; padding-bottom: 3px; margin-bottom: 10px; }
.secao-num { font-weight: bold; margin-right: 6px; }

/* ── Typography ── */
h1,h2,h3,h4 { font-family: 'Times New Roman', Times, serif; page-break-after: avoid; }
h2 { font-size: 11pt; font-weight: bold; margin: 14px 0 6px; }
h3 { font-size: 11pt; font-weight: bold; font-style: italic; margin: 10px 0 4px; }
p { margin: 0 0 8px; text-align: justify; }
ul, ol { margin: 6px 0 10px 22px; }
li { margin-bottom: 3px; }
code { font-family: 'Courier New', monospace; font-size: 9.5pt; background:#f5f5f5; border:1px solid #ddd; padding:1px 4px; border-radius:2px; }
hr { border:none; border-top:1px solid #aaa; margin:14px 0; }
table { border-collapse:collapse; width:100%; margin:10px 0 14px; font-size:10pt; }
thead th { background:#1B3A2D; color:#fff; font-weight:700; padding:6px 10px; text-align:left; font-size:9.5pt; }
td { border:1px solid #ccc; padding:5px 10px; vertical-align:top; }
tr:nth-child(even) td { background:#f9f9f9; }

/* ── Rodapé ── */
.rodape { margin-top: 30px; border-top: 2px solid #111; padding-top: 8px;
  text-align: center; font-size: 9.5pt; font-style: italic; color: #444; }

@media print {
  .save-bar { display:none !important; }
  body { padding-top: 0 !important; }
}`;

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
  <div style="display:flex;align-items:center;gap:10px;">
    <span>📋</span>
    <strong>${filename}.pdf</strong>
    <span style="opacity:.7;font-size:11px">· Estimativa SIEx — EB70-MT-10.401</span>
  </div>
  <div style="display:flex;align-items:center;gap:10px;">
    <span style="opacity:.65;font-size:11px">Selecione "Salvar como PDF" no diálogo</span>
    <button class="save-btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  </div>
</div>

<div class="doc">

  <!-- CABEÇALHO -->
  <div class="cabecalho">
    <div class="classif conf">CONFIDENCIAL</div>
    <div class="doc-titulo">Estimativa</div>
    <div class="doc-subtitulo">Sistema de Inteligência do Exército (SIEx) · EB70-MT-10.401</div>
    <div class="doc-meta">
      <span><strong>Assunto:</strong> ${escH(nome || '—')}</span>
      <span><strong>Data:</strong> ${agora}</span>
    </div>
    <div class="doc-meta">
      <span><strong>Usuário:</strong> ${escH(cliente || analista || '—')}</span>
      <span><strong>Horizonte:</strong> ${escH(horizonte || '—')}</span>
    </div>
  </div>

  <!-- 1. SITUAÇÃO -->
  <div class="secao">
    <div class="secao-titulo"><span class="secao-num">1.</span>Situação</div>
    <div class="secao-sub"><strong>1.1 Planejamento (Fase 1)</strong></div>
    ${md2html(planejamentoBlock)}
    <div class="secao-sub" style="margin-top:12px"><strong>1.2 Reunião (Fase 2)</strong></div>
    ${md2html(reuniaoBlock)}
    <div class="secao-sub" style="margin-top:12px"><strong>1.3 Análise e Síntese (Fase 3)</strong></div>
    ${md2html(analiseBlock)}
  </div>

  <!-- 2. ANÁLISE -->
  <div class="secao">
    <div class="secao-titulo"><span class="secao-num">2.</span>Análise</div>
    <div class="secao-sub"><strong>Fase 4 — Interpretação: Fatores de Influência, Trajetória e Hipóteses</strong></div>
    ${md2html(interpretacaoBlock)}
  </div>

  <!-- 3. CONCLUSÃO -->
  <div class="secao">
    <div class="secao-titulo"><span class="secao-num">3.</span>Conclusão</div>
    ${md2html(conclusaoBlock || interpretacaoBlock)}
  </div>

  <!-- RODAPÉ -->
  <div class="rodape">
    OLYMPUS v5.0 · SIEx/EB · EB70-MT-10.401 · CONFIDENCIAL
  </div>

</div>
</body>
</html>`;
}

exportRoutes.post('/estimativa', async (c) => {
  try {
    const { projeto, messages } = (await c.req.json()) as any;
    const html = buildEstimativaHtml(projeto || {}, messages || []);
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

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