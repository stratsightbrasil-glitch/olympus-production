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
}

export interface Tool<T = any> {
  name: string;
  description: string;
  /** JSON Schema puro (objeto JS simples). NÃO usar Zod — ver HISTORICO_MIGRACAO.md §8.1 */
  schema: Record<string, any>;
  execute: (args: T, context: AgentContext) => Promise<string>;
}