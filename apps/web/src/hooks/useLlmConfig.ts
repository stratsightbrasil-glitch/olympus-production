import { useState, useEffect } from 'react';
import type { LlmConfig, AnthropicModel, OllamaModel } from '../types';

export function useLlmConfig(token: string | null) {
  const [llmConfig, setLlmConfig] = useState<LlmConfig>({ provider: 'anthropic', model: 'claude-opus-4-7' });
  const [anthropicModels, setAnthropicModels] = useState<AnthropicModel[]>([]);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);

  const reqHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/settings', { headers: reqHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.llm) setLlmConfig(d.llm);
        if (d?.anthropicModels) setAnthropicModels(d.anthropicModels);
      })
      .catch(() => {});
    fetch('/api/v1/settings/ollama-models', { headers: reqHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) { setOllamaAvailable(d.available); setOllamaModels(d.models || []); }
      })
      .catch(() => {});
  }, [token]);

  const handleLlmChange = async (config: LlmConfig) => {
    try {
      const res = await fetch('/api/v1/settings/llm', {
        method: 'PATCH',
        headers: reqHeaders,
        body: JSON.stringify(config),
      });
      if (res.ok) setLlmConfig(config);
      else alert((await res.json()).error || 'Erro ao alterar provedor LLM');
    } catch { alert('Erro na requisição'); }
  };

  return { llmConfig, anthropicModels, ollamaModels, ollamaAvailable, handleLlmChange };
}
