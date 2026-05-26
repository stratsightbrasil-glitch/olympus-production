import { useState } from 'react';
import type { AttachedFile } from '../types';

export const ACCEPTED_TYPES = '.txt,.md,.csv,.json,.rtf,.pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.webp';

export function useAttachments(token: string | null) {
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [fileError, setFileError] = useState('');

  const authHeader = { 'Authorization': `Bearer ${token}` };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setExtracting(true);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      const res = await fetch('/api/v1/extract', { method: 'POST', headers: authHeader, body: fd });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const result = await res.json();
      const ok: AttachedFile[] = [];
      result.files.forEach((f: any) => {
        if (f.error) setFileError(prev => `${prev} | ${f.name}: ${f.error}`);
        else if (!f.text?.trim()) setFileError(prev => `${prev} | ${f.name}: Vazio`);
        else ok.push({ name: f.name, text: f.text, isImage: f.isImage, dataUrl: f.dataUrl });
      });
      if (ok.length) setAttachedFiles(prev => [...prev, ...ok]);
    } catch (err: any) { setFileError(err.message); }
    setExtracting(false);
  };

  const removeFile = (i: number) => setAttachedFiles(prev => prev.filter((_, j) => j !== i));
  const clearFiles = () => setAttachedFiles([]);

  return { attachedFiles, extracting, fileError, handleFileChange, removeFile, clearFiles };
}
