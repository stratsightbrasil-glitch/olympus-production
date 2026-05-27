import { Hono } from 'hono';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType,
  Header, Footer, PageNumber, PageBreak, LevelFormat,
} from 'docx';
import { db, indicators, weakSignals, messages as messagesTable, methodologyPhases, methodologies } from '@olympus/db';
import { eq, desc } from 'drizzle-orm';

const playbookRoutes = new Hono();

// ─── Paleta ──────────────────────────────────────────────────────────────────
const VERDE   = '1B5E20';
const AMARELO = 'F57F17';
const VERMELHO= 'B71C1C';
const AZUL    = '0D47A1';
const CINZA   = '37474F';

function bold(text: string, color = '1C3A2B', size = 22): TextRun {
  return new TextRun({ text, bold: true, color, size, font: 'Arial' });
}
function normal(text: string, color = '2E4035', size = 20): TextRun {
  return new TextRun({ text, color, size, font: 'Arial' });
}
function mono(text: string, color = '1B3A2D', size = 18): TextRun {
  return new TextRun({ text, color, size, font: 'Courier New' });
}

function heading1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    children: [new TextRun({ text, bold: true, size: 32, color: '0D2B15', font: 'Arial' })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2E7D32', space: 4 } },
  });
}
function heading2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: '1B5E20', font: 'Arial' })],
  });
}
function bodyPara(text: string, indent = false) {
  return new Paragraph({
    spacing: { after: 120 },
    indent: indent ? { left: 360 } : undefined,
    children: [normal(text)],
  });
}

function statusColor(s: string): string {
  if (s === 'vermelho') return VERMELHO;
  if (s === 'amarelo') return AMARELO;
  return VERDE;
}

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCDDCC' } as const;
const borders = { top: border, bottom: border, left: border, right: border };

function buildIndicatorsTable(inds: any[]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: ['INDICADOR', 'VALOR', 'STATUS', 'LIMIAR ⚠', 'CRÍTICO 🔴'].map(h =>
      new TableCell({
        borders, width: { size: h === 'INDICADOR' ? 3600 : 1300, type: WidthType.DXA },
        shading: { fill: '1B5E20', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16, color: 'FFFFFF', font: 'Arial' })] })],
      })
    ),
  });
  const dataRows = inds.map(ind => {
    const val = ind.lastValue != null ? String(ind.lastValue) : '—';
    const st = ind.status || 'verde';
    const yellow = ind.parametersJson?.yellowThreshold ?? ind.thresholdYellow ?? '—';
    const red    = ind.parametersJson?.redThreshold    ?? ind.thresholdRed    ?? '—';
    const sc = statusColor(st);
    return new TableRow({
      children: [
        new TableCell({ borders, width: { size: 3600, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [normal(ind.name || '—')] })] }),
        new TableCell({ borders, width: { size: 1300, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [mono(val, sc)] })] }),
        new TableCell({ borders, width: { size: 1300, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: st.toUpperCase(), bold: true, size: 18, color: sc, font: 'Arial' })] })] }),
        new TableCell({ borders, width: { size: 1300, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [mono(String(yellow), AMARELO)] })] }),
        new TableCell({ borders, width: { size: 1300, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [mono(String(red), VERMELHO)] })] }),
      ],
    });
  });
  return new Table({
    width: { size: 8800, type: WidthType.DXA },
    columnWidths: [3600, 1300, 1300, 1300, 1300],
    rows: [headerRow, ...dataRows],
  });
}

function buildSignalsTable(signals: any[]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: ['SINAL FRACO', 'CLASSIFICAÇÃO', 'STATUS RADAR', 'AÇÃO RECOMENDADA'].map((h, i) =>
      new TableCell({
        borders, width: { size: [3200, 1600, 1500, 2500][i], type: WidthType.DXA },
        shading: { fill: '0D47A1', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16, color: 'FFFFFF', font: 'Arial' })] })],
      })
    ),
  });
  const dataRows = signals.map(s => {
    const radarColors: Record<string, string> = { materializado: VERMELHO, amplificando: AMARELO, monitorando: AZUL, arquivado: CINZA };
    const rc = radarColors[s.statusRadar ?? 'monitorando'] ?? AZUL;
    return new TableRow({
      children: [
        new TableCell({ borders, width: { size: 3200, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [normal(s.titulo || '—')] })] }),
        new TableCell({ borders, width: { size: 1600, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [normal(s.classificacao || '—')] })] }),
        new TableCell({ borders, width: { size: 1500, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: (s.statusRadar || '—').toUpperCase(), bold: true, size: 18, color: rc, font: 'Arial' })] })] }),
        new TableCell({ borders, width: { size: 2500, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [normal((s.acaoRecomendada || '—').slice(0, 200))] })] }),
      ],
    });
  });
  return new Table({
    width: { size: 8800, type: WidthType.DXA },
    columnWidths: [3200, 1600, 1500, 2500],
    rows: [headerRow, ...dataRows],
  });
}

async function buildPlaybookDocx(
  projeto: any,
  inds: any[],
  signals: any[],
  phases: any[],
  excerpt: string,
): Promise<Document> {
  const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const nomeProjeto = projeto?.nome || 'Projeto sem nome';
  const metodologia = projeto?.metodologia || 'MSEF';

  const children: Paragraph[] = [];

  // ── Capa ──────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({ spacing: { before: 1440 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: 'PLAYBOOK ESTRATÉGICO', bold: true, size: 40, color: '0D2B15', font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: nomeProjeto, bold: true, size: 32, color: '1B5E20', font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: `Metodologia: ${metodologia}`, size: 22, color: '37474F', font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: `Gerado em: ${now}`, size: 20, color: '546E7A', font: 'Arial' })],
    }),
    ...(projeto?.cliente ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: `Cliente/OM: ${projeto.cliente}`, size: 20, color: '546E7A', font: 'Arial' })],
    })] : []),
    ...(projeto?.analista ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: `Analista: ${projeto.analista}`, size: 20, color: '546E7A', font: 'Arial' })],
    })] : []),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── 1. Identificação do Projeto ────────────────────────────────────────────
  children.push(heading1('1. Identificação do Projeto'));
  const meta: [string, string][] = [
    ['Projeto', nomeProjeto],
    ['Metodologia', metodologia],
    ['Horizonte', projeto?.horizonte || '—'],
    ['Classificação', projeto?.classificacao || '—'],
    ['Analista responsável', projeto?.analista || '—'],
    ['Data de geração', now],
  ];
  for (const [label, value] of meta) {
    children.push(new Paragraph({
      spacing: { after: 80 },
      indent: { left: 360 },
      children: [bold(`${label}: `, '0D2B15', 20), normal(value)],
    }));
  }

  // ── 2. Fases da Metodologia ────────────────────────────────────────────────
  if (phases.length > 0) {
    children.push(heading1('2. Fases da Metodologia'));
    for (const phase of phases) {
      children.push(new Paragraph({
        spacing: { after: 80 },
        numbering: { reference: 'phases', level: 0 },
        children: [
          bold(`Fase ${phase.phaseNum}: ${phase.label}`, '1B5E20', 20),
          ...(phase.description ? [normal(` — ${phase.description}`, '37474F')] : []),
        ],
      }));
    }
  }

  // ── 3. Síntese Analítica ──────────────────────────────────────────────────
  children.push(heading1('3. Síntese Analítica'));
  if (excerpt) {
    const lines = excerpt.split('\n').filter(l => l.trim());
    for (const line of lines.slice(0, 40)) {
      const stripped = line.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
      if (!stripped) continue;
      if (line.startsWith('#')) {
        children.push(heading2(stripped));
      } else if (line.startsWith('- ') || line.startsWith('• ')) {
        children.push(new Paragraph({
          spacing: { after: 60 },
          numbering: { reference: 'bullets', level: 0 },
          children: [normal(stripped.replace(/^[-•]\s*/, ''))],
        }));
      } else {
        children.push(bodyPara(stripped));
      }
    }
  } else {
    children.push(bodyPara('Nenhuma síntese disponível. Execute o ciclo KRATOS para gerar análise.'));
  }

  // ── 4. Indicadores Estratégicos ───────────────────────────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1('4. Indicadores Estratégicos'));
  if (inds.length > 0) {
    children.push(buildIndicatorsTable(inds) as any);
    const criticals = inds.filter(i => i.status === 'vermelho');
    const warnings  = inds.filter(i => i.status === 'amarelo');
    if (criticals.length > 0) {
      children.push(new Paragraph({ spacing: { before: 160, after: 80 }, children: [bold(`⚠ ${criticals.length} indicador(es) em estado CRÍTICO:`, VERMELHO, 20)] }));
      for (const ind of criticals) children.push(bodyPara(`• ${ind.name}: ${ind.lastValue ?? '—'}`, true));
    }
    if (warnings.length > 0) {
      children.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [bold(`${warnings.length} indicador(es) em ATENÇÃO:`, AMARELO, 20)] }));
      for (const ind of warnings) children.push(bodyPara(`• ${ind.name}: ${ind.lastValue ?? '—'}`, true));
    }
  } else {
    children.push(bodyPara('Nenhum indicador cadastrado.'));
  }

  // ── 5. Sinais Fracos ──────────────────────────────────────────────────────
  if (signals.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(heading1('5. Sinais Fracos e Wild Cards'));
    children.push(buildSignalsTable(signals) as any);
  }

  // ── 6. Recomendações e Próximos Passos ────────────────────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1('6. Recomendações e Próximos Passos'));
  children.push(bodyPara('Com base nos indicadores e sinais identificados, recomenda-se:'));
  const recs = [
    'Monitorar continuamente os indicadores em estado crítico ou de atenção.',
    'Acionar o agente KRATOS semanalmente ou ao detectar variação > 10% nos limiares.',
    'Revisar os cenários com o agente HERMES ao término de cada ciclo de análise.',
    'Registrar novos sinais fracos detectados durante o monitoramento.',
    'Compartilhar o painel KRATOS com a equipe de analistas via link seguro.',
  ];
  for (const rec of recs) {
    children.push(new Paragraph({
      spacing: { after: 80 },
      numbering: { reference: 'bullets', level: 0 },
      children: [normal(rec)],
    }));
  }

  return new Document({
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
        },
        {
          reference: 'phases',
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
        },
      ],
    },
    styles: {
      default: { document: { run: { font: 'Arial', size: 20, color: '1C3A2B' } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: 'Arial', color: '0D2B15' },
          paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Arial', color: '1B5E20' },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '2E7D32', space: 4 } },
            children: [
              new TextRun({ text: 'OLYMPUS — PLAYBOOK ESTRATÉGICO', bold: true, size: 16, color: '2E7D32', font: 'Arial' }),
              new TextRun({ text: `   |   ${nomeProjeto}`, size: 16, color: '546E7A', font: 'Arial' }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Página ', size: 16, color: '78909C', font: 'Arial' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '78909C', font: 'Arial' }),
              new TextRun({ text: ' / ', size: 16, color: '78909C', font: 'Arial' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '78909C', font: 'Arial' }),
              new TextRun({ text: `   |   Classificação: ${projeto?.classificacao || 'Acesso Restrito'}   |   StratSight © ${new Date().getFullYear()}`, size: 16, color: '90A4AE', font: 'Arial' }),
            ],
          })],
        }),
      },
      children,
    }],
  });
}

// ── POST /api/v1/playbook/gerar ──────────────────────────────────────────────
playbookRoutes.post('/gerar', async (c) => {
  try {
    const body = (await c.req.json()) as any;
    const projectId: string | undefined = body.projectId;
    const projeto = body.projeto || {};

    let inds: any[] = [];
    let signals: any[] = [];
    let phases: any[] = [];
    let excerpt = body.excerpt || '';

    if (projectId) {
      [inds, signals] = await Promise.all([
        db.query.indicators.findMany({ where: eq(indicators.projectId, projectId) }),
        db.query.weakSignals.findMany({ where: eq(weakSignals.projectId, projectId) }),
      ]);
      // Latest KRATOS/HERMES analysis excerpt from messages
      if (!excerpt) {
        const lastMsg = await db.query.messages.findFirst({
          where: eq(messagesTable.projectId, projectId),
          orderBy: [desc(messagesTable.createdAt)],
        });
        excerpt = lastMsg?.content?.slice(0, 3000) || '';
      }
      // Methodology phases
      const slug = (projeto?.metodologia || 'esg').toLowerCase();
      const method = await db.query.methodologies.findFirst({ where: eq(methodologies.slug, slug) });
      if (method) {
        phases = await db.select().from(methodologyPhases)
          .where(eq(methodologyPhases.methodologyId, method.id))
          .orderBy(methodologyPhases.phaseNum);
      }
    }

    const doc = await buildPlaybookDocx(projeto, inds, signals, phases, excerpt);
    const buffer = await Packer.toBuffer(doc);
    const safeName = (projeto?.nome || 'Projeto').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `Playbook_${safeName}_${new Date().toISOString().slice(0, 10)}.docx`;
    return new Response(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default playbookRoutes;
