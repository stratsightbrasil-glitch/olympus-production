// ─── Parser determinístico — PESTEL Impacto × Incerteza (KLIO) ───────────────
// Multi-formato: tabela markdown, lista estruturada, inline.
// Retorna null em qualquer falha → fallback para markdown em MessageBubble.

import type { PestelData, DriverPestel, DimensaoPestel } from '../artifacts/PestelScatter/types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const VALID_DIMS: DimensaoPestel[] = ['P', 'E', 'S', 'T', 'A', 'L'];

function isDim(v: string): v is DimensaoPestel {
  return VALID_DIMS.includes(v.toUpperCase() as DimensaoPestel);
}

function clean(s: string): string {
  return s.replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
}

function parseNum(s: string): number | null {
  const n = parseFloat(s.trim().replace(',', '.'));
  return isNaN(n) || n < 1 || n > 5 ? null : n;
}

let _idCounter = 0;
function nextId(dim: string, nome: string): string {
  return `${dim}-${nome.slice(0, 8).replace(/\s+/g, '_')}-${++_idCounter}`.toLowerCase();
}

// ─── Formato A: tabela markdown ───────────────────────────────────────────────
// | P | Volatilidade cambial | 4 | 3 | ... |
// | Político | Volatilidade cambial | 4 | 3 | ... |

function parseTableFormat(text: string): DriverPestel[] {
  const drivers: DriverPestel[] = [];

  // Detecta linha de header da tabela PESTEL
  const headerRe = /\|[^|]*(?:dimen[sã]|PESTEL|driver|fator)[^|]*\|[^|]*(?:driver|nome|fator)[^|]*\|[^|]*impacto[^|]*\|[^|]*incerteza[^|]*/i;
  if (!headerRe.test(text)) return drivers;

  // Pega todas as linhas de dados (não header, não separador)
  const lineRe = /^\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]*)\|?\s*$/gm;
  let m: RegExpExecArray | null;

  while ((m = lineRe.exec(text)) !== null) {
    const [, col1, col2, col3, col4, col5] = m;

    // Pula separadores (---|---)
    if (/^[\s\-:]+$/.test(col1)) continue;

    // Tenta identificar dimensão na col1
    const dimRaw = clean(col1).toUpperCase();
    const dim = VALID_DIMS.find(d =>
      dimRaw === d ||
      dimRaw.startsWith(d + ' ') ||
      dimRaw === { P: 'POLÍTICO', E: 'ECONÔMICO', S: 'SOCIAL', T: 'TECNOLÓGICO', A: 'AMBIENTAL', L: 'LEGAL' }[d]
    );
    if (!dim) continue;

    const nome = clean(col2);
    if (!nome || nome.length < 2) continue;

    const impacto = parseNum(col3);
    const incerteza = parseNum(col4);
    if (!impacto || !incerteza) continue;

    const descricao = col5 ? clean(col5) : undefined;

    drivers.push({ id: nextId(dim, nome), nome, dimensao: dim, impacto, incerteza, descricao });
  }

  return drivers;
}

// ─── Formato B: lista por dimensão ───────────────────────────────────────────
// **P — Político**
// - **Driver X** | Impacto: 4 | Incerteza: 3
// - Driver Y — Impacto 3/5 · Incerteza 2/5

function parseListFormat(text: string): DriverPestel[] {
  const drivers: DriverPestel[] = [];

  // Divide em blocos por dimensão
  const blockRe = /\*{0,2}([PESTAL])\s*[·—–\-]\s*(?:Político|Econômico|Social|Tecnológico|Ambiental|Legal)\*{0,2}/gi;
  const blocks: { dim: DimensaoPestel; start: number }[] = [];
  let bm: RegExpExecArray | null;

  while ((bm = blockRe.exec(text)) !== null) {
    const d = bm[1].toUpperCase();
    if (isDim(d)) blocks.push({ dim: d as DimensaoPestel, start: bm.index + bm[0].length });
  }

  if (blocks.length === 0) return drivers;

  for (let i = 0; i < blocks.length; i++) {
    const { dim, start } = blocks[i];
    const end = blocks[i + 1]?.start ?? text.length;
    const chunk = text.slice(start, end);

    // Cada item: linha começando com - ou *
    const itemRe = /^[-*]\s*(.+)$/gm;
    let im: RegExpExecArray | null;

    while ((im = itemRe.exec(chunk)) !== null) {
      const line = im[1];

      // Extrai impacto e incerteza
      const impM = /(?:impacto|imp)\s*:?\s*(\d(?:[.,]\d)?)\s*(?:\/5)?/i.exec(line);
      const incM = /(?:incerteza|inc)\s*:?\s*(\d(?:[.,]\d)?)\s*(?:\/5)?/i.exec(line);
      if (!impM || !incM) continue;

      const impacto = parseNum(impM[1]);
      const incerteza = parseNum(incM[1]);
      if (!impacto || !incerteza) continue;

      // Nome = tudo antes do primeiro separador | ou —
      const nome = clean(line.split(/[|·—–]|\bImpacto\b|\bImp\./i)[0].replace(/\*+/g, ''));
      if (!nome || nome.length < 2) continue;

      // Descrição = eventual texto restante
      const descM = /[|]\s*([^|·\d][^|]{8,})$/.exec(line);
      const descricao = descM ? clean(descM[1]) : undefined;

      drivers.push({ id: nextId(dim, nome), nome, dimensao: dim, impacto, incerteza, descricao });
    }
  }

  return drivers;
}

// ─── Formato C: inline compacto ──────────────────────────────────────────────
// P · Volatilidade cambial · Impacto 4 · Incerteza 3
// [P] Driver X — imp:4 inc:3

function parseInlineFormat(text: string): DriverPestel[] {
  const drivers: DriverPestel[] = [];

  const lineRe = /^\[?([PESTAL])\]?\s*[·—–·•\-]\s*([^·—–\n|]+?)\s*[·—–|]\s*(?:imp(?:acto)?\s*:?\s*)(\d(?:[.,]\d)?)\s*(?:\/5)?\s*[·—–·•|]\s*(?:inc(?:erteza)?\s*:?\s*)(\d(?:[.,]\d)?)(?:\s*\/5)?/gim;
  let m: RegExpExecArray | null;

  while ((m = lineRe.exec(text)) !== null) {
    const dim = m[1].toUpperCase() as DimensaoPestel;
    if (!isDim(dim)) continue;

    const nome = clean(m[2]);
    const impacto = parseNum(m[3]);
    const incerteza = parseNum(m[4]);

    if (!nome || nome.length < 2 || !impacto || !incerteza) continue;
    drivers.push({ id: nextId(dim, nome), nome, dimensao: dim, impacto, incerteza });
  }

  return drivers;
}

// ─── Formato D: tabela compacta sem cabeçalho de coluna explícito ─────────────
// Detecta tabelas cujas colunas tenham a sequência: dim | nome | num | num
// Exemplos:
//   | P | Volatilidade | 4 | 3 |
//   | E | PIB estagnado | 5 | 2 | risco estrutural |

function parseBareTableFormat(text: string): DriverPestel[] {
  const drivers: DriverPestel[] = [];
  const lineRe = /^\|\s*([PESTAL])\s*\|\s*([^|]{3,}?)\s*\|\s*(\d(?:[.,]\d)?)\s*\|\s*(\d(?:[.,]\d)?)\s*\|?([^|\n]*)/gim;
  let m: RegExpExecArray | null;

  while ((m = lineRe.exec(text)) !== null) {
    const dim = m[1].toUpperCase() as DimensaoPestel;
    if (!isDim(dim)) continue;

    const nome = clean(m[2]);
    const impacto = parseNum(m[3]);
    const incerteza = parseNum(m[4]);
    if (!nome || !impacto || !incerteza) continue;

    const descricao = m[5] ? clean(m[5]) : undefined;
    drivers.push({ id: nextId(dim, nome), nome, dimensao: dim, impacto, incerteza, descricao: descricao || undefined });
  }

  return drivers;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function parsePestel(text: string): PestelData | null {
  try {
    // Portão de detecção — precisa ter alguma marca de PESTEL E valores numéricos
    const hasPestel = /PESTEL|PEST(?:\s|$)|matriz\s+de\s+drivers?|impacto\s*[×x]\s*incerteza/i.test(text);
    const hasScores = /(?:impacto|incerteza)\s*:?\s*[1-5]/i.test(text)
                   || /\|\s*[1-5]\s*\|\s*[1-5]\s*\|/i.test(text);

    if (!hasPestel || !hasScores) return null;

    _idCounter = 0; // reset por chamada

    // Tenta formatos em ordem de especificidade
    let drivers = parseTableFormat(text);
    if (drivers.length < 2) drivers = parseBareTableFormat(text);
    if (drivers.length < 2) drivers = parseListFormat(text);
    if (drivers.length < 2) drivers = parseInlineFormat(text);

    if (drivers.length < 3) return null; // mínimo razoável

    // Título: linha com PESTEL + tracejado + nome do contexto
    const tituloM = /(?:ETAPA|FASE|MÓDULO)?\s*\d*\s*[·•—–]?\s*(?:MATRIZ\s+)?PESTEL[^—–\n]*[—–]\s*([^\n]+)/i.exec(text)
                 ?? /#+\s*(?:🌐\s*)?PESTEL[^·•\n]*[·•]\s*([^\n]+)/i.exec(text);

    return {
      drivers,
      titulo: tituloM ? clean(tituloM[1]) : undefined,
    };
  } catch {
    return null;
  }
}
