function inlineFmt(t: string): string {
  return t
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-black/5 px-1.5 py-0.5 rounded text-[0.88em]">$1</code>');
}

export function fmt(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  const out: string[] = [];
  let inCode = false, inTable = false, tableRows: string[] = [];

  const flushTable = () => {
    if (!tableRows.length) return;
    let html = '<div class="overflow-x-auto my-4"><table class="min-w-full border-collapse border border-gray-200 text-sm">';
    tableRows.forEach((row, i) => {
      const isHeader = i === 0;
      if (/^[\s|:-]+$/.test(row)) return;
      const cells = row.split('|').filter((_, ci, arr) => ci > 0 && ci < arr.length - 1);
      html += '<tr>';
      cells.forEach(c => {
        const tag = isHeader ? 'th' : 'td';
        const style = isHeader
          ? 'bg-stratsight-dark text-white px-4 py-2 text-left font-bold border border-[#2D5A3D]'
          : 'px-4 py-2 border border-gray-200 align-top';
        html += `<${tag} class="${style}">${inlineFmt(c.trim())}</${tag}>`;
      });
      html += '</tr>';
    });
    html += '</table></div>';
    out.push(html);
    tableRows = [];
    inTable = false;
  };

  lines.forEach(line => {
    if (line.startsWith('```')) { inCode = !inCode; if (!inCode) out.push('</pre>'); else out.push('<pre class="bg-[#1a1a1a] text-[#e8e8e8] p-4 rounded-lg overflow-x-auto text-xs my-2">'); return; }
    if (inCode) { out.push(line.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '\n'); return; }
    if (line.includes('|') && line.trim().startsWith('|')) {
      if (!inTable) inTable = true;
      tableRows.push(line);
      return;
    }
    if (inTable) flushTable();
    if (line.startsWith('#### ')) { out.push(`<h4 class="text-stratsight-dark mt-3 mb-1.5 text-sm font-bold">${inlineFmt(line.slice(5))}</h4>`); return; }
    if (line.startsWith('### '))  { out.push(`<h3 class="text-stratsight-dark mt-3.5 mb-1.5 text-[15px] font-bold">${inlineFmt(line.slice(4))}</h3>`); return; }
    if (line.startsWith('## '))   { out.push(`<h2 class="text-stratsight-dark mt-4 mb-2 text-base font-bold border-b border-stratsight-gold pb-1">${inlineFmt(line.slice(3))}</h2>`); return; }
    if (line.startsWith('# '))    { out.push(`<h1 class="text-stratsight-dark mt-4.5 mb-2.5 text-lg font-bold">${inlineFmt(line.slice(2))}</h1>`); return; }
    if (/^[-─═*]{3,}$/.test(line.trim())) { out.push('<hr class="border-t border-stratsight-gold my-3"/>'); return; }
    if (line.match(/^(\s*[-*•]\s+)/)) {
      const isIndented = (line.match(/^(\s*)/)?.[1]?.length || 0) > 0;
      const txt = line.replace(/^\s*[-*•]\s+/, '');
      out.push(`<div class="flex gap-2 my-1 ${isIndented ? 'ml-5' : ''}"><span class="text-stratsight-gold shrink-0">•</span><span>${inlineFmt(txt)}</span></div>`);
      return;
    }
    if (line.match(/^\s*\d+\.\s+/)) {
      const num = line.match(/^\s*(\d+)\./)?.[1] || '';
      const txt = line.replace(/^\s*\d+\.\s+/, '');
      out.push(`<div class="flex gap-2 my-1"><span class="text-stratsight-gold font-bold shrink-0 min-w-[20px]">${num}.</span><span>${inlineFmt(txt)}</span></div>`);
      return;
    }
    if (line.trim() === '') { out.push('<div class="h-2"></div>'); return; }
    out.push(`<p class="my-1 leading-relaxed">${inlineFmt(line)}</p>`);
  });
  if (inTable) flushTable();
  return out.join('');
}
