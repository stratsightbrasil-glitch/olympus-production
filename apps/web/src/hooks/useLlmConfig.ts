import { useState, useEffect } from 'react';
import type { LlmConfig, AnthropicModel, GoogleModel, DeepSeekModel, OllamaModel } from '../types';

export function useLlmConfig(token: string | null) {
  const [llmConfig, setLlmConfig] = useState<LlmConfig>({ provider: 'google', model: 'gemini-2.5-flash-lite' });
  const [anthropicModels, setAnthropicModels] = useState<AnthropicModel[]>([]);
  const [googleModels, setGoogleModels] = useState<GoogleModel[]>([]);
  const [deepseekModels, setDeepseekModels] = useState<DeepSeekModel[]>([]);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [llmTiers, setLlmTiers] = useState<Record<string, string>>({});

  const reqHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    // Tudo em uma única chamada — GET /api/v1/settings inclui Ollama, Google e DeepSeek
    fetch('/api/v1/settings', { headers: reqHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        if (d.llm)             setLlmConfig(d.llm);
        if (d.anthropicModels) setAnthropicModels(d.anthropicModels);
        if (d.googleModels)    setGoogleModels(d.googleModels);
        if (d.deepseekModels)  setDeepseekModels(d.deepseekModels);
        if (d.ollamaModels)    setOllamaModels(d.ollamaModels);
        if (d.ollamaAvailable !== undefined) setOllamaAvailable(d.ollamaAvailable);
        if (d.llmTiers)        setLlmTiers(d.llmTiers);
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

  return {
    llmConfig, llmTiers,
    anthropicModels, googleModels, deepseekModels, ollamaModels, ollamaAvailable,
    handleLlmChange, handleTierChange,
  };
}
