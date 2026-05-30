export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'analista' | 'cliente';
  isTwoFactorEnabled?: boolean;
}

export interface Projeto {
  id?: string;
  nome: string;
  metodologia: string;
  status: string;
  kratosCron: string;
  alertEmails: string;
  horizonte: string;
  elaborador: string;
  cliente: string;
  questaoEstrategica: string;
  mudancaIdentificada: string;
  teamId: string | null;
}

export type MessageContent = string | Array<{ type: string; text?: string; image?: string }>;

export interface Message {
  role: 'user' | 'assistant';
  content: MessageContent;
  id?: string;
  messageType?: string;
}

export interface AttachedFile {
  name: string;
  text: string;
  isImage?: boolean;
  dataUrl?: string;
}

export interface ScopeForm {
  tema: string;
  horizonte: string;
  elaborador: string;
  cliente: string;
  questaoEstrategica: string;
  mudancaIdentificada: string;
  instrucoes: string;
}

export interface LlmConfig {
  provider: string;
  model: string;
}

export interface AnthropicModel {
  id: string;
  label: string;
}

// Google e DeepSeek têm a mesma forma { id, label }
export type GoogleModel    = AnthropicModel;
export type DeepSeekModel  = AnthropicModel;

export interface OllamaModel {
  id: string;
  size?: number;
}

export interface Indicador {
  nome: string;
  valor: string;
  status: 'verde' | 'amarelo' | 'vermelho';
  fonte: string;
}

export interface SignalStats {
  total: number;
  [key: string]: unknown;
}

export interface AnalyticReview {
  status: 'aprovado' | 'aprovado_com_ressalvas' | 'requer_revisao' | 'nao_revisado';
  notasRevisor?: string;
  declaracaoPropriedade?: string;
  atsCompliance?: Record<string, number>;
  reviewerName?: string;
  reviewedAt?: string;
}

export interface Sessao {
  id: string;
  name: string;
  methodology: string;
  status: string;
  updatedAt: string;
  teamId?: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
}

export interface Methodology {
  id: string;
  name: string;
  slug: string;
  description: string;
  category?: string;
}

export type ActiveModal = 'newSession' | 'settings' | 'users' | 'backup' | 'review' | 'audit' | null;
