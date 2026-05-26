const escHtml = (s: string) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
           .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

const inline = (s: string) => escHtml(s)
  .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/`(.+?)`/g, '<code>$1</code>');

interface ParseOpts {
  emptyPlaceholder?: string;
}

export function parseMarkdownToHtml(text: string, opts: ParseOpts = {}): string {
  const { emptyPlaceholder = '' } = opts;
  if (!text) return emptyPlaceholder;

  const lines = text.split('\n');
  const out: string[] = [];
  let ul = false, ol = false;
  let tableRows: string[][] = [], inTable = false;

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
    tableRows = []; inTable = false;
  };

  for (const line of lines) {
    const t = line.trim();
    if (/^\|/.test(t) && /\|$/.test(t)) {
      flushList();
      if (/^[\s|:-]+$/.test(t)) continue;
      tableRows.push(t.split('|').map(c => c.trim()).filter(Boolean));
      inTable = true;
      continue;
    }
    if (inTable) flushTable();
    if (/^#{1,4}\s/.test(line)) {
      flushList();
      const lvl = line.match(/^(#+)/)?.[1].length ?? 1;
      out.push(`<h${lvl}>${inline(line.replace(/^#+\s*/, ''))}</h${lvl}>`);
      continue;
    }
    if (/^[-─═*]{3,}$/.test(t)) { flushList(); out.push('<hr>'); continue; }
    if (/^\s*[-*•]\s/.test(line)) {
      if (ol) { out.push('</ol>'); ol = false; }
      if (!ul) { out.push('<ul>'); ul = true; }
      out.push(`<li>${inline(line.replace(/^\s*[-*•]\s+/, ''))}</li>`);
      continue;
    }
    if (/^\s*\d+\.\s/.test(line)) {
      if (ul) { out.push('</ul>'); ul = false; }
      if (!ol) { out.push('<ol>'); ol = true; }
      out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`);
      continue;
    }
    if (!t) { flushList(); continue; }
    flushList();
    out.push(`<p>${inline(t)}</p>`);
  }
  flushList(); flushTable();
  return out.join('\n');
}
