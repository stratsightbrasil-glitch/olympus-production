import { MessageParam } from "@anthropic-ai/sdk/resources/messages";

export interface AgentContext {
  projectId: string;
  /** Nome da metodologia ativa (string livre para suportar metodologias dinâmicas) */
  methodology: string;
  memory: MessageParam[];

  onThinking?: (text: string) => void;
  onToolCall?: (name: string, args: any) => void;
  onToken?: (delta: string) => void;
  /** Emite mensagem de progresso de etapa (ex: "🔧 web_search: query...") */
  onStep?: (msg: string) => void;
  dispatch?: (agentName: string, input: string) => Promise<string>;
  /** Configuração de LLM ativa — sobrescreve as variáveis de ambiente */
  llmConfig?: { provider: string; model: string };
  /** Fases da metodologia ativa — carregadas via loadMethodology() */
  phases?: Array<{ phaseNum: number; label: string; agentRole: string; description?: string | null }>;
  /** Instruções extras por agente para a metodologia ativa — agentName → extraInstructions */
  agentMethodPrompts?: Record<string, string>;
  /** Modo de soberania de dados do projeto */
  connectivityMode?: "ONLINE" | "SOBERANO" | "AIR_GAPPED";
  /** Âncora de contexto estruturado — injetada no system prompt quando há eventos aprovados */
  anchorContext?: string;
}

export interface Tool<T = any> {
  name: string;
  description: string;
  /** JSON Schema puro (objeto JS simples). NÃO usar Zod — ver HISTORICO_MIGRACAO.md §8.1 */
  schema: Record<string, any>;
  execute: (args: T, context: AgentContext) => Promise<string>;
}