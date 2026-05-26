import { useState, useEffect } from 'react';
import type { LlmConfig, AnthropicModel, OllamaModel } from '../types';

export function useLlmConfig(token: string | null) {
  const [llmConfig, setLlmConfig] = useState<LlmConfig>({ provider: 'anthropic', model: 'claude-opus-4-7' });
  const [anthropicModels, setAnthropicModels] = useState<AnthropicModel[]>([]);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [llmTiers, setLlmTiers] = useState<Record<string, string>>({});

  const reqHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/settings', { headers: reqHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.llm) setLlmConfig(d.llm);
        if (d?.anthropicModels) setAnthropicModels(d.anthropicModels);
        if (d?.llmTiers) setLlmTiers(d.llmTiers);
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

  const handleTierChange = async (tiers: Record<string, string>) => {
    try {
      const res = await fetch('/api/v1/settings/llm-tiers', {
        method: 'PATCH',
        headers: reqHeaders,
        body: JSON.stringify({ tiers }),
      });
      if (res.ok) setLlmTiers(tiers);
      else alert((await res.json()).error || 'Erro ao alterar tiers de modelo');
    } catch { alert('Erro na requisição'); }
  };

  return { llmConfig, anthropicModels, ollamaModels, ollamaAvailable, llmTiers, handleLlmChange, handleTierChange };
}
