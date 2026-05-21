// ─── Parser determinístico — Matriz 2×2 PYTHIA ───────────────────────────────
// Calibrado contra output real do MSEF (Maio 2026).
//
// Formato esperado do PYTHIA:
//   - **Eixo A (horizontal):** Label\n *PoloNeg ↔ PoloPos*
//   - **Eixo B (vertical):**   Label\n *PoloNeg ↔ PoloPos*
//   ### Q1 · NOME DO CENÁRIO · ~15%
//   > *logline do cenário*
//
// Retorna null em qualquer falha → fallback para markdown em MessageBubble.

import type { Matriz2x2Data, Cenario, Eixo } from '../artifacts/Matriz2x2/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Separa "PoloNeg ↔ PoloPos" nos dois polos. */
function splitPoles(raw: string): [string, string] {
  const parts = raw.split(/↔|←→|<->|–>|→/).map(s => s.trim());
  return [parts[0] ?? 'Baixa', parts[1] ?? 'Alta'];
}

/** Limpa asteriscos, itálicos e espaços extras de uma string. */
function clean(s: string): string {
  return s.replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
}

// ─── Parsers de eixo ─────────────────────────────────────────────────────────

/**
 * Detecta:
 *   **Eixo A (horizontal):** Label da Incerteza
 *    *PoloNeg ↔ PoloPos*
 */
function parseEixo(text: string, orientation: 'horizontal' | 'vertical'): Eixo {
  // Match: **Eixo ? (horizontal|vertical):** LABEL \n *poles*
  const re = new RegExp(
    `\\*{1,2}Eixo\\s+\\w+\\s*\\(${orientation}\\):\\*{1,2}\\s*([^\\n]+)\\n[^\\n]*\\*([^*\\n]+)\\*`,
    'i'
  );
  const m = re.exec(text);
  if (m) {
    const label = clean(m[1]);
    const [poloNeg, poloPos] = splitPoles(clean(m[2]));
    return { label, poloNeg, poloPos };
  }

  // Fallback — linha "Eixo X: label | polo+ | polo-"
  const inline = new RegExp(
    `Eixo\\s+(?:X|${orientation === 'horizontal' ? 'A|H' : 'B|Y|V'})[:\\s]+([^\\n|]+)(?:\\|([^\\n|]+))?(?:\\|([^\\n]+))?`,
    'i'
  ).exec(text);
  if (inline) {
    return {
      label:   clean(inline[1]),
      poloPos: inline[2] ? clean(inline[2]) : 'Alta',
      poloNeg: inline[3] ? clean(inline[3]) : 'Baixa',
    };
  }

  return { label: orientation === 'horizontal' ? 'Eixo X' : 'Eixo Y', poloPos: 'Alta', poloNeg: 'Baixa' };
}

// ─── Parser de cenários ───────────────────────────────────────────────────────

/**
 * Detecta padrão real do PYTHIA:
 *   ### Q1 · NOME DO CENÁRIO · ~15%
 *   > *logline do cenário*
 *
 * Também suporta formatos alternativos:
 *   **Q1** — NOME (~15%)
 *   ## Q1: NOME
 */
function parseCenarios(text: string): Cenario[] {
  const cenarios: Cenario[] = [];

  // ── Padrão primário: ### Q1 · NOME · ~15% ────────────────────────────────
  // Suporta · (U+00B7), • (U+2022), — (em-dash), – (en-dash)
  const primaryRe = /###\s*(Q[1-4])\s*[·•—–-]\s*([^·•—–\n~%]+?)\s*(?:[·•—–]\s*~?(\d+)%)?(?:\s*\n)/gi;
  let m: RegExpExecArray | null;

  while ((m = primaryRe.exec(text)) !== null) {
    const id = m[1].toUpperCase() as `Q${1|2|3|4}`;
    if (cenarios.find(c => c.id === id)) continue; // evita duplicatas

    const titulo = clean(m[2]);
    const probabilidade = m[3] ? parseInt(m[3], 10) : undefined;

    // Extrai logline: primeira blockquote > *...* após o header
    const afterHeader = text.slice(m.index + m[0].length, m.index + m[0].length + 800);
    const loglineM = />\s*\*{1,2}([^*]+)\*{1,2}/.exec(afterHeader)
                  ?? />\s*([^\n>]{20,})/.exec(afterHeader);
    const descricao = loglineM ? clean(loglineM[1]) : titulo;

    cenarios.push({
      id,
      quadrante: parseInt(id[1], 10) as 1|2|3|4,
      titulo,
      descricao,
      probabilidade,
    });
  }

  if (cenarios.length === 4) return cenarios;

  // ── Padrão alternativo B: **Q1** — NOME ou ## Q1: NOME ──────────────────
  const altRe = /(?:#{1,4}\s*|[\*_]{1,2})(Q[1-4])(?:[\s·•—–:-]+)([^\n*#·•—–]+)(?:~(\d+)%)?/gi;
  const found: Record<string, { titulo: string; descricao: string; probabilidade?: number }> = {};
  while ((m = altRe.exec(text)) !== null) {
    const id = m[1].toUpperCase();
    if (found[id]) continue;
    const titulo = clean(m[2]);
    const probabilidade = m[3] ? parseInt(m[3], 10) : undefined;
    const afterIdx = m.index + m[0].length;
    const rest = text.slice(afterIdx, afterIdx + 600);
    const nextQIdx = /(?:#{1,4}\s*Q[1-4]|[\*_]{1,2}Q[1-4])/i.exec(rest)?.index ?? rest.length;
    const desc = rest.slice(0, nextQIdx).replace(/>\s*/g, '').trim();
    found[id] = { titulo, descricao: desc || titulo, probabilidade };
  }

  if (Object.keys(found).length === 4) {
    for (const [id, data] of Object.entries(found)) {
      cenarios.push({
        id,
        quadrante: parseInt(id[1], 10) as 1|2|3|4,
        ...data,
      });
    }
    return cenarios;
  }

  return cenarios;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function parseMatriz2x2(text: string): Matriz2x2Data | null {
  try {
    // Detecção: deve ter marcador de Matriz 2×2 E pelo menos um Q seguido de nome
    const hasMatriz = /MATRIZ\s*(?:DE\s*CENÁ?RIOS\s*)?2\s*[×xX]\s*2/i.test(text)
                   || /ETAPA\s*4\s*[·•]\s*MATRIZ/i.test(text);
    const hasQs = /Q[1-4]\s*[·•—–]\s*[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀ]/i.test(text);

    if (!hasMatriz || !hasQs) return null;

    const eixoX = parseEixo(text, 'horizontal');
    const eixoY = parseEixo(text, 'vertical');
    const cenarios = parseCenarios(text);

    if (cenarios.length !== 4) return null;

    // Título: "ETAPA 4 · MATRIZ DE CENÁRIOS 2×2 — Projeto"
    const tituloM = /ETAPA\s*4\s*[·•]\s*MATRIZ[^—\n]*[—–]\s*([^\n]+)/i.exec(text)
                 ?? /#{1,2}\s*(?:🎯\s*)?ETAPA\s*4[^·•\n]*[·•]\s*([^\n]+)/i.exec(text);

    return {
      eixoX,
      eixoY,
      cenarios,
      titulo: tituloM ? clean(tituloM[1]) : undefined,
    };
  } catch {
    return null;
  }
}
