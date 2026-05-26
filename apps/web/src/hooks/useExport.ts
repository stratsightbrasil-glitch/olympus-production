import { useState } from 'react';
import type { Projeto, Message } from '../types';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function openHtmlBlob(html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function projectFilename(projeto: Projeto, ext: string) {
  const slug = (projeto.nome || 'Analise').replace(/\s+/g, '_');
  return `StratSight_${slug}_${new Date().toISOString().slice(0, 10)}.${ext}`;
}

export function useExport(token: string | null, projeto: Projeto, messages: Message[]) {
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingEstimativa, setExportingEstimativa] = useState(false);

  const reqHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  const exportDocx = async (targetMessages = messages) => {
    if (!targetMessages.length) return alert('Nenhuma mensagem para exportar.');
    setExportingDocx(true);
    try {
      const res = await fetch('/api/v1/export/docx', {
        method: 'POST', headers: reqHeaders,
        body: JSON.stringify({ projeto, messages: targetMessages }),
      });
      if (!res.ok) throw new Error('Erro ao gerar DOCX');
      downloadBlob(await res.blob(), projectFilename(projeto, 'docx'));
    } catch (e: any) { alert('Erro ao gerar DOCX: ' + e.message); }
    setExportingDocx(false);
  };

  const exportPdf = async (targetMessages = messages, tipo?: string) => {
    if (!targetMessages.length) return alert('Nenhuma mensagem para exportar.');
    setExportingPdf(true);
    try {
      const res = await fetch('/api/v1/export/pdf', {
        method: 'POST', headers: reqHeaders,
        body: JSON.stringify({ projeto, messages: targetMessages, tipo }),
      });
      if (!res.ok) throw new Error('Erro ao gerar PDF');
      openHtmlBlob(await res.text());
    } catch (e: any) { alert('Erro ao gerar PDF: ' + e.message); }
    setExportingPdf(false);
  };

  const exportSingleDocx = async (content: string) => {
    await exportDocx([{ role: 'assistant', content }]);
  };

  const exportSinglePdf = async (content: string) => {
    await exportPdf([{ role: 'assistant', content }], 'padrão');
  };

  const gerarRelatorio = async (tipo: 'padrao' | 'estendido') => {
    if (loading || messages.length === 0) return;

    if (tipo === 'padrao') {
      let targetMsg = messages.find(m => m.messageType === 'relatorio_final');
      if (!targetMsg) {
        const candidates = messages.filter(m => m.role === 'assistant' && typeof m.content === 'string' && m.content.length > 1500);
        if (candidates.length > 0)
          targetMsg = candidates.reduce((a, b) =>
            (typeof b.content === 'string' ? b.content.length : 0) > (typeof a.content === 'string' ? a.content.length : 0) ? b : a
          );
      }
      if (!targetMsg) return alert('Relatório Final Padrão não encontrado.\n\nCertifique-se de que o HERMES concluiu todas as etapas e gerou o relatório consolidado.');
      await exportSinglePdf(typeof targetMsg.content === 'string' ? targetMsg.content : '');

    } else {
      const agentMsgs = messages.filter(m => m.role === 'assistant');
      if (agentMsgs.length === 0) return alert('Nenhuma análise disponível.');
      await exportPdf(agentMsgs, 'estendido');
    }
  };

  const exportEstimativa = async () => {
    if (messages.length === 0) return alert('Nenhuma análise disponível para formalizar como Estimativa.');
    setExportingEstimativa(true);
    try {
      const res = await fetch('/api/v1/export/estimativa', {
        method: 'POST', headers: reqHeaders,
        body: JSON.stringify({ projeto, messages }),
      });
      if (!res.ok) throw new Error('Erro ao gerar Estimativa');
      openHtmlBlob(await res.text());
    } catch (e: any) { alert('Erro ao gerar Estimativa EB: ' + e.message); }
    setExportingEstimativa(false);
  };

  const downloadMarkdown = (content: string) => {
    downloadBlob(
      new Blob([content], { type: 'text/markdown;charset=utf-8' }),
      projectFilename(projeto, 'md').replace('StratSight_', 'StratSight_Relatorio_')
    );
  };

  const gerarPlaybook = async () => {
    try {
      const lastMsg = messages.filter(m => m.role === 'assistant').slice(-1)[0];
      const res = await fetch('/api/v1/playbook/gerar', {
        method: 'POST', headers: reqHeaders,
        body: JSON.stringify({
          projectId: projeto.id,
          projeto,
          excerpt: typeof lastMsg?.content === 'string' ? lastMsg.content.slice(0, 3000) : '',
        }),
      });
      if (!res.ok) throw new Error('Erro ao gerar Playbook');
      downloadBlob(await res.blob(), `Playbook_${(projeto.nome || 'Projeto').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`);
    } catch (e: any) { alert('Erro ao gerar Playbook: ' + e.message); }
  };

  const loading = exportingDocx || exportingPdf || exportingEstimativa;

  return {
    exportingDocx, exportingPdf, exportingEstimativa, loading,
    exportDocx, exportPdf, exportSingleDocx, exportSinglePdf,
    gerarRelatorio, exportEstimativa, downloadMarkdown, gerarPlaybook,
  };
}
