import { Hono } from 'hono';
import { Document, Packer, Paragraph, TextRun, HeadingLevel,
         AlignmentType, BorderStyle, Table, TableRow, TableCell,
         WidthType, ShadingType, Header, Footer, PageNumber } from 'docx';
import { db, methodologyPhases, methodologies } from '@olympus/db';
import { eq } from 'drizzle-orm';
import { parseMarkdownToHtml } from '../utils/markdown';

const exportRoutes = new Hono();

// ── Phase resolution ─────────────────────────────────────────────────────────

interface PhaseInfo { label: string; phaseNum: number; color: string; }

const PHASE_PALETTE = ['#1565C0','#4527A0','#B71C1C','#BF360C','#37474F','#004D40','#1B3A2D'];

/** P5: In-process cache; 5-minute TTL avoids repeated DB round-trips per export. */
const _phaseCache = new Map<string, { map: Map<string, PhaseInfo>; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function resolveAgentPhases(slug: string): Promise<Map<string, PhaseInfo>> {
  const now = Date.now();
  const hit = _phaseCache.get(slug);
  if (hit && hit.expiresAt > now) return hit.map;

  try {
    const method = await db.query.methodologies.findFirst({ where: eq(methodologies.slug, slug) });
    if (!method) return new Map();
    const phases = await db.select().from(methodologyPhases)
      .where(eq(methodologyPhases.methodologyId, method.id))
      .orderBy(methodologyPhases.phaseNum);
    const map = new Map<string, PhaseInfo>();
    for (const p of phases) {
      if (!map.has(p.agentRole))
        map.set(p.agentRole, {
          label: p.label,
          phaseNum: p.phaseNum,
          color: PHASE_PALETTE[Math.min(p.phaseNum - 1, PHASE_PALETTE.length - 1)],
        });
    }
    _phaseCache.set(slug, { map, expiresAt: now + CACHE_TTL_MS });
    return map;
  } catch { return new Map(); }
}

function lookupPhase(phaseMap: Map<string, PhaseInfo>, agent: string): PhaseInfo {
  const exact = phaseMap.get(agent);
  if (exact) return exact;
  if (agent.startsWith('HERMES')) { const h = phaseMap.get('HERMES'); if (h) return h; }
  return { label: 'Análise', phaseNum: 0, color: '#1B3A2D' };
}

// ── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Matches **AGENT** · style markers. Compiled once at module load.
 * Used by DOCX and HTML renderers — eliminates two previously-diverging inline regexes.
 */
const AGENT_MARKER_RE  = /\*\*[A-Z][A-Z_]*\*\*\s*[··•\-]\s*/g;
const AGENT_NAME_RE    = /\*\*([A-Z][A-Z_]*)\*\*\s*[··•\-]/;

const escHtml = (s: string) =>
  (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
           .replace(/"/g,'&quot;').replace(/'/g,'&#x27;');

/** Keep only real agent output messages (filters system commands). */
function filterAgentMessages(msgs: any[]): any[] {
  return msgs.filter(m =>
    m?.role === 'assistant' && m.content?.trim() && !m.content.startsWith('⚙️ Comando'));
}

/** Extract the agent name from the first 300 chars of the message content. */
function detectAgentName(content: string, fallback?: string): string {
  return AGENT_NAME_RE.exec(content.slice(0, 300))?.[1] ?? (fallback ?? 'HERMES');
}

/**
 * Full strip for HTML: removes agent markers AND agent-coordination lines
 * (lines that begin with an all-caps name like "MNEMOSYNE entregou…").
 */
function stripMarkersHtml(text: string): string {
  let r = text.replace(AGENT_MARKER_RE, '');
  return r.split('\n')
    .filter(l => !/^[A-Z][A-Z_]{3,}[\s,.:;]/.test(l.trim()))
    .join('\n');
}

/** Simple strip for DOCX: removes markers only (coordination lines kept). */
function stripMarkersDocx(text: string): string {
  return text.replace(AGENT_MARKER_RE, '');
}

function projectFilename(nome: string | undefined, suffix: string): string {
  return `${(nome || 'Relatorio').replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_')}_${suffix}`;
}

/** Shared .save-bar CSS used by every HTML builder. */
function saveBarCss(): string {
  return `
.save-bar { position:fixed; top:0; left:0; right:0; z-index:9999; background:#1B3A2D; color:#fff; padding:10px 24px; display:flex; align-items:center; justify-content:space-between; font-size:12px; gap:16px; box-shadow:0 2px 8px rgba(0,0,0,.35); }
.save-bar-left { display:flex; align-items:center; gap:10px; }
.save-bar-left span { opacity:.75; font-size:11px; }
.save-bar strong { color:#C9A84C; }
.save-bar-right { display:flex; align-items:center; gap:10px; }
.save-bar-hint { font-size:11px; opacity:.65; }
.save-btn { background:#C9A84C; color:#1B3A2D; font-weight:800; border:none; padding:7px 20px; border-radius:4px; cursor:pointer; font-size:12px; white-space:nowrap; letter-spacing:.3px; }
.save-btn:hover { background:#d4b45a; }`;
}

// ── DOCX inline markdown parser ──────────────────────────────────────────────

function parseInline(text: string, size: number): any[] {
  const runs: any[] = [];
  const re = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
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

// ── Document IR ──────────────────────────────────────────────────────────────

interface AgentSection {
  agentName: string;
  phaseLabel: string;
  phaseColor: string;
  rawContent: string;
  /** HTML renderer: aggregate under existing section instead of opening a new one. */
  isHermesRepeat: boolean;
  /** DOCX renderer: false when this phase label was already emitted — skip the header. */
  showPhaseHeader: boolean;
}

interface DocumentIR {
  projeto: any;
  tipo: string;
  sections: AgentSection[];
  filename: string;
  generatedAt: string;
}

/**
 * Single pass over messages: filters, detects agent names, looks up phases, computes
 * deduplication flags. Both renderers draw from this IR instead of repeating the logic.
 */
function buildIR(
  projeto: any,
  messages: any[],
  tipo: string,
  phaseMap: Map<string, PhaseInfo>,
): DocumentIR {
  const agentMsgs = filterAgentMessages(messages);
  const agentsSeen = new Set<string>();
  const phasesSeen = new Set<string>();
  const sections: AgentSection[] = [];

  for (const msg of agentMsgs) {
    const agentName = detectAgentName(msg.content, msg.agentName);
    const phaseInfo = lookupPhase(phaseMap, agentName);
    sections.push({
      agentName,
      phaseLabel: phaseInfo.label,
      phaseColor: phaseInfo.color,
      rawContent: msg.content,
      isHermesRepeat: agentsSeen.has(agentName) && agentName.startsWith('HERMES'),
      showPhaseHeader: !phasesSeen.has(phaseInfo.label),
    });
    agentsSeen.add(agentName);
    phasesSeen.add(phaseInfo.label);
  }

  return {
    projeto, tipo, sections,
    filename: projectFilename(projeto.nome, tipo),
    generatedAt: new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
    }),
  };
}

// Promisified setImmediate — cede o event loop entre seções pesadas para não
// bloquear outras requisições durante a renderização de relatórios longos.
const yieldToEventLoop = () => new Promise<void>(r => setImmediate(r));

// ── renderHtml (formerly buildHtml) ─────────────────────────────────────────

async function renderHtml(ir: DocumentIR): Promise<string> {
  const { projeto, tipo, sections, filename, generatedAt } = ir;
  const { nome, cliente, analista, horizonte, classificacao } = projeto;
  const mdToHtml = (text: string) => parseMarkdownToHtml(text);

  // Body ── two modes: standard (first message only) or extended (all sections)
  let body = '';
  if (tipo !== 'estendido') {
    const content = sections[0]?.rawContent ?? '';
    body = `<div class="report-content">${mdToHtml(stripMarkersHtml(content))}</div>`;
  } else {
    for (const s of sections) {
      const clean = stripMarkersHtml(s.rawContent);
      if (s.isHermesRepeat) {
        body += `<div class="phase-content-extra">${mdToHtml(clean)}</div>`;
      } else {
        body += `<div class="phase-block">
  <div class="phase-header" style="border-left-color:${s.phaseColor}">
    <span class="phase-label">${escHtml(s.phaseLabel)}</span>
  </div>
  <div class="phase-content">${mdToHtml(clean)}</div>
</div>`;
      }
      // Cede o event loop a cada seção para não bloquear a fila de I/O
      await yieldToEventLoop();
    }
  }

  const classif    = escHtml(classificacao || 'Acesso Restrito');
  const tipoLabel  = tipo === 'estendido' ? 'Relatório Estendido' : 'Relatório Padrão';

  const css = `
@page { margin: 2.2cm 2.5cm 2cm; size: A4; }
*, *::before, *::after {
  box-sizing: border-box; margin: 0; padding: 0;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}
body { font-family: 'Segoe UI', Inter, system-ui, -apple-system, sans-serif; font-size: 10.5pt; color: #1a1a1a; line-height: 1.75; background: #fff; padding-top: 52px; }
${saveBarCss()}
.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-45deg); font-size: 110px; font-weight: 900; color: rgba(180,0,0,0.06); white-space: nowrap; pointer-events: none; z-index: 0; user-select: none; letter-spacing: 4px; }
@media print { .watermark { position: fixed; top: 50%; left: 50%; } }

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

/* ── Relatório Padrão ── */
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
  .phase-block { page-break-inside: avoid; margin: 16px 0; }
  .phase-header { border-left: 3px solid #1B3A2D !important; padding-left: 12px !important; }
  .phase-label { color: #1B3A2D !important; }
  .meta-card td:first-child { background: #f0f0f0 !important; }
  .badge-conf { background: #1B3A2D !important; color: #C9A84C !important; }
  thead th { background: #1B3A2D !important; color: #fff !important; }
  tr:nth-child(even) td { background: #f9f9f9 !important; }
  h1, h2, h3, h4 { page-break-after: avoid; }
  table, ul, ol { page-break-inside: avoid; }
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

<div class="watermark" aria-hidden="true">${(classificacao || 'CONFIDENCIAL').toUpperCase()}</div>

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
  <div class="brand-sub">Strategic Foresight · OLYMPUS v2.0</div>
  <div class="cover-bar"></div>
  <h1>${escHtml(nome || 'Relatório de Cenários')}</h1>
  <div class="doc-sub">${tipoLabel} · Sistema Multiagente de Cenários Prospectivos</div>
  <table class="meta-card">
    <tr><td>Cliente / Organização</td><td>${escHtml(cliente||'—')}</td></tr>
    <tr><td>Analista Responsável</td><td>${escHtml(analista||'StratSight Brasil')}</td></tr>
    <tr><td>Horizonte Temporal</td><td>${escHtml(horizonte||'—')}</td></tr>
    <tr><td>Metodologia</td><td>${escHtml(projeto.metodologia||'MSEF')}</td></tr>
    <tr><td>Classificação</td><td><span class="badge-conf">${classif}</span></td></tr>
    <tr><td>Gerado em</td><td>${generatedAt}</td></tr>
  </table>
</div>

<div class="content">
${body}
</div>

</body>
</html>`;
}

// ── renderDocx (formerly buildDocx) ─────────────────────────────────────────

async function renderDocx(ir: DocumentIR): Promise<Document> {
  const { projeto, sections } = ir;
  const { nome, cliente, analista, horizonte, classificacao } = projeto;
  const children: any[] = [];

  // Title page
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
    children: [new TextRun({ text: 'Produzido por OLYMPUS v2.0 — Sistema Multiagente de Cenários Prospectivos', size: 20, color: '555555' })],
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
  children.push(new Table({
    rows: meta.map(([k, v]) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, size: 18, color: '1B3A2D' })] })], width: { size: 35, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, fill: 'E8F5E9' } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(v), size: 18 })] })], width: { size: 65, type: WidthType.PERCENTAGE } }),
      ],
    })),
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));
  children.push(new Paragraph({ children: [new TextRun({ text: '' })], pageBreakBefore: true }));

  // Content
  for (const s of sections) {
    if (s.showPhaseHeader) {
      children.push(new Paragraph({
        children: [new TextRun({ text: s.phaseLabel, bold: true, size: 20, color: 'FFFFFF' })],
        spacing: { before: 300, after: 0 },
        shading: { type: ShadingType.SOLID, fill: s.phaseColor.replace('#', '') },
      }));
    }

    const lines = stripMarkersDocx(s.rawContent).split('\n');
    for (const line of lines) {
      const clean = line.replace(/\*\*\*([^*]+)\*\*\*/g,'$1').replace(/\*\*([^*]+)\*\*/g,'$1')
                        .replace(/\*([^*]+)\*/g,'$1').replace(/`([^`]+)`/g,'$1').trim();
      if (!clean) {
        children.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 40 } }));
        continue;
      }
      if (/^[-─═*]{3,}$/.test(clean)) {
        children.push(new Paragraph({ children: [new TextRun({ text: '' })], border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' } }, spacing: { before: 80, after: 80 } }));
        continue;
      }
      if      (line.startsWith('#### ')) children.push(new Paragraph({ children: parseInline(clean.replace(/^#+\s*/,''), 18), heading: HeadingLevel.HEADING_4, spacing: { before: 120, after: 40 } }));
      else if (line.startsWith('### ' )) children.push(new Paragraph({ children: parseInline(clean.replace(/^#+\s*/,''), 20), heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 60 } }));
      else if (line.startsWith('## '  )) children.push(new Paragraph({ children: parseInline(clean.replace(/^#+\s*/,''), 22), heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 } }));
      else if (line.startsWith('# '   )) children.push(new Paragraph({ children: parseInline(clean.replace(/^#+\s*/,''), 26), heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } }));
      else if (/^\s*[-*•]\s+/.test(line)) children.push(new Paragraph({ children: parseInline(line.replace(/^\s*[-*•]\s+/,'').trim(), 18), bullet: { level: 0 }, spacing: { after: 60 } }));
      else if (/^\s*\d+\.\s+/.test(line)) children.push(new Paragraph({ children: parseInline(line.replace(/^\s*\d+\.\s+/,'').trim(), 18), bullet: { level: 0 }, spacing: { after: 60 } }));
      else if (/^\|/.test(line) && /\|$/.test(line)) {
        if (!/^[\s|:-]+$/.test(clean)) {
          const cells = line.split('|').map((c: string) => c.trim()).filter(Boolean);
          children.push(new Paragraph({
            children: cells.flatMap((c: string, i: number) => [
              ...parseInline(c, 16),
              ...(i < cells.length - 1 ? [new TextRun({ text: '  |  ', size: 16, color: '888888' })] : []),
            ]),
            spacing: { after: 40 },
          }));
        }
      } else {
        children.push(new Paragraph({ children: parseInline(line.trim(), 18), spacing: { after: 80 } }));
      }
    }

    // Cede o event loop entre seções (cada seção = 1 mensagem de agente,
    // podendo ter centenas de linhas) para não bloquear outras requisições.
    await yieldToEventLoop();
  }

  return new Document({
    sections: [{
      properties: {},
      headers: { default: new Header({ children: [new Paragraph({ children: [
        new TextRun({ text: 'StratSight Brasil  ·  OLYMPUS v2.0  ·  ', bold: true, size: 16, color: '1B3A2D' }),
        new TextRun({ text: nome || 'Relatório de Cenários', size: 16, color: '555555' }),
      ], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '2E7D52' } } })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ children: [
        new TextRun({ text: 'StratSight Brasil  ·  OLYMPUS v2.0  ·  ' + (classificacao || 'Acesso Restrito') + '  ·  Página ', size: 16, color: '888888' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888' }),
      ], alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' } } })] }) },
      children,
    }],
  });
}

// ── buildEstimativaHtml (SIEx §5.8 — EB70-MT-10.401) ────────────────────────

function buildEstimativaHtml(projeto: any, messages: any[]): string {
  const { nome, cliente, analista, horizonte } = projeto;
  const agora = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const filename = projectFilename(nome || 'SIEx', 'Estimativa');

  const agentMsgs = filterAgentMessages(messages);

  const getBlock = (keywords: string[]): string => {
    const found = agentMsgs.find(m =>
      keywords.some(k => m.content.toUpperCase().includes(k.toUpperCase())));
    return found ? found.content : '';
  };

  const planejamentoBlock  = getBlock(['FICHA DE PLANEJAMENTO','AECK','AEC —','FASE 1','PLANEJAMENTO']);
  const reuniaoBlock       = getBlock(['TAD','AVALIAÇÃO DA FONTE','AVALIAÇÃO DO CONTEÚDO','REUNIÃO','FASE 2']);
  const analiseBlock       = getBlock(['FRAÇÕES SIGNIFICATIVAS','PERTINÊNCIA','SÍNTESE','ANÁLISE E SÍNTESE','FASE 3']);
  const interpretacaoBlock = getBlock(['FATORES DE INFLUÊNCIA','HIPÓTESE','DELINEAMENTO','INTERPRETAÇÃO','FASE 4']);
  const conclusaoBlock     = getBlock(['H1','H2','PROBABILIDADE ESTIMADA','CONCLUSÃO','FASE 5','FORMALIZAÇÃO']);

  const md2html = (text: string) =>
    parseMarkdownToHtml(text, { emptyPlaceholder: '<p><em>(sem conteúdo)</em></p>' });

  const css = `
@page { margin: 2.5cm 3cm 2.5cm; size: A4; }
*, *::before, *::after { box-sizing: border-box; margin:0; padding:0;
  -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #111; line-height: 1.7; background:#fff; padding-top: 52px; }
${saveBarCss()}
.doc { max-width: 680px; margin: 0 auto; padding: 0 0 40px; }
.cabecalho { text-align:center; margin-bottom: 20px; border-bottom: 2px solid #111; padding-bottom: 10px; }
.classif { font-weight:900; font-size: 10pt; letter-spacing: 3px; text-transform:uppercase; }
.classif.conf { color: #7B0000; }
.doc-titulo { font-size: 12pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin: 6px 0 2px; }
.doc-subtitulo { font-size: 10pt; }
.doc-meta { font-size: 10pt; margin-top: 6px; display:flex; justify-content:space-between; }
.secao { margin-bottom: 22px; }
.secao-titulo { font-size: 11pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;
  border-bottom: 1px solid #333; padding-bottom: 3px; margin-bottom: 10px; }
.secao-num { font-weight: bold; margin-right: 6px; }
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
.rodape { margin-top: 30px; border-top: 2px solid #111; padding-top: 8px; text-align: center; font-size: 9.5pt; font-style: italic; color: #444; }
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
  <div class="save-bar-left">
    <span>📋</span>
    <strong>${filename}.pdf</strong>
    <span>· Estimativa SIEx — EB70-MT-10.401</span>
  </div>
  <div class="save-bar-right">
    <span class="save-bar-hint">Selecione "Salvar como PDF" no diálogo</span>
    <button class="save-btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  </div>
</div>

<div class="doc">
  <div class="cabecalho">
    <div class="classif conf">CONFIDENCIAL</div>
    <div class="doc-titulo">Estimativa</div>
    <div class="doc-subtitulo">Sistema de Inteligência do Exército (SIEx) · EB70-MT-10.401</div>
    <div class="doc-meta">
      <span><strong>Assunto:</strong> ${escHtml(nome || '—')}</span>
      <span><strong>Data:</strong> ${agora}</span>
    </div>
    <div class="doc-meta">
      <span><strong>Usuário:</strong> ${escHtml(cliente || analista || '—')}</span>
      <span><strong>Horizonte:</strong> ${escHtml(horizonte || '—')}</span>
    </div>
  </div>

  <div class="secao">
    <div class="secao-titulo"><span class="secao-num">1.</span>Situação</div>
    <div class="secao-sub"><strong>1.1 Planejamento (Fase 1)</strong></div>
    ${md2html(planejamentoBlock)}
    <div class="secao-sub" style="margin-top:12px"><strong>1.2 Reunião (Fase 2)</strong></div>
    ${md2html(reuniaoBlock)}
    <div class="secao-sub" style="margin-top:12px"><strong>1.3 Análise e Síntese (Fase 3)</strong></div>
    ${md2html(analiseBlock)}
  </div>

  <div class="secao">
    <div class="secao-titulo"><span class="secao-num">2.</span>Análise</div>
    <div class="secao-sub"><strong>Fase 4 — Interpretação: Fatores de Influência, Trajetória e Hipóteses</strong></div>
    ${md2html(interpretacaoBlock)}
  </div>

  <div class="secao">
    <div class="secao-titulo"><span class="secao-num">3.</span>Conclusão</div>
    ${md2html(conclusaoBlock || interpretacaoBlock)}
  </div>

  <div class="rodape">OLYMPUS v5.0 · SIEx/EB · EB70-MT-10.401 · CONFIDENCIAL</div>
</div>

</body>
</html>`;
}

// ── Routes ───────────────────────────────────────────────────────────────────

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
    const slug     = (projeto?.metodologia || 'esg').toLowerCase();
    const phaseMap = await resolveAgentPhases(slug);
    const ir       = buildIR(projeto || {}, messages || [], 'docx', phaseMap);
    const doc      = await renderDocx(ir);
    const buffer   = await Packer.toBuffer(doc);
    const filename = `StratSight_${(projeto?.nome || 'Cenarios').replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.docx`;
    return new Response(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

exportRoutes.post('/pdf', async (c) => {
  try {
    const { projeto, messages, tipo } = (await c.req.json()) as any;
    const slug     = (projeto?.metodologia || 'esg').toLowerCase();
    const phaseMap = await resolveAgentPhases(slug);
    const ir       = buildIR(projeto || {}, messages || [], tipo || 'relatorio', phaseMap);
    const html     = await renderHtml(ir);
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

export default exportRoutes;
