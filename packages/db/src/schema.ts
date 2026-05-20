import { pgTable, text, timestamp, uuid, jsonb, doublePrecision, boolean, customType } from "drizzle-orm/pg-core";

// pgvector custom column type (512 dims — Voyage voyage-3-lite)
const vector = customType<{ data: number[] }>({
  dataType() { return 'vector(512)'; },
  toDriver(v: number[]) { return `[${v.join(',')}]`; },
  fromDriver(v: any) {
    if (Array.isArray(v)) return v as number[];
    return String(v).replace(/[\[\]]/g, '').split(',').map(Number);
  },
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash"),
  role: text("role").default("analista").notNull(),
  twoFactorSecret: text("two_factor_secret"),
  isTwoFactorEnabled: boolean("is_two_factor_enabled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const methodologies = pgTable("methodologies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  category: text("category").default("Cenários Prospectivos").notNull(), // ex: Cenários, Planejamento Estratégico
  isDefault: boolean("is_default").default(false).notNull(),
  agentsConfig: jsonb("agents_config"), // Array de nomes de agentes (ex: ["HERMES", "KLIO", "SCOPUS"])
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const techniques = pgTable("techniques", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  instructions: text("instructions").notNull(), // O prompt/regras da técnica (SAT)
  toolsConfig: jsonb("tools_config"), // Array de nomes de ferramentas requeridas por esta técnica
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tools = pgTable("tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  schemaJson: jsonb("schema_json"), // Definição Zod/JSONSchema para uso dinâmico futuro
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  role: text("role").notNull(),
  type: text("type").default("expert").notNull(), // 'orchestrator' ou 'expert'
  systemPrompt: text("system_prompt").notNull(),
  toolsConfig: jsonb("tools_config"), // Array de nomes de ferramentas: ["web_search", "consultar_agente"]
  techniquesConfig: jsonb("techniques_config"), // Array de nomes de técnicas: ["Impacto Cruzado"]
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(), // Alterado para TEXT para suportar 'sess_12345'
  name: text("name").default("").notNull(),
  client: text("client").default(""),
  analyst: text("analyst").default(""),
  horizon: text("horizon").default(""),
  classification: text("classification").default("Confidencial").notNull(),
  methodology: text("methodology").default("MSEF").notNull(),
  techniquesConfig: jsonb("techniques_config"), // Técnicas SAT aplicadas diretamente ao projeto (ex: Red Teaming)
  panelToken: text("panel_token").unique(),
  status: text("status").default("Em produção").notNull(),
  kratosCron: text("kratos_cron").default("0 6 * * *").notNull(),
  createdBy: text("created_by").default("Sistema").notNull(),
  updatedBy: text("updated_by").default("Sistema").notNull(),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  filesJson: jsonb("files_json"),
  agentName: text("agent_name"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const embeddings = pgTable("embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  chunkText: text("chunk_text").notNull(),
  metadata: jsonb("metadata"), // { filename, source, chunk_index, ... }
  embedding: vector("embedding"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


export const analyticReviews = pgTable("analytic_reviews", {
  id:           uuid("id").defaultRandom().primaryKey(),
  projectId:    text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  reviewerId:   text("reviewer_id"),
  reviewerName: text("reviewer_name"),
  reviewedAt:   timestamp("reviewed_at"),
  atsCompliance: jsonb("ats_compliance"),
  notasRevisor: text("notas_revisor"),
  status: text("status", {
    enum: ["nao_revisado", "aprovado", "aprovado_com_ressalvas", "requer_revisao"]
  }).notNull().default("nao_revisado"),
  declaracaoPropriedade: text("declaracao_propriedade"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AnalyticReview    = typeof analyticReviews.$inferSelect;
export type NewAnalyticReview = typeof analyticReviews.$inferInsert;

export const weakSignals = pgTable("weak_signals", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),

  titulo:    text("titulo").notNull(),
  descricao: text("descricao").notNull(),

  tipo: text("tipo", {
    enum: ["weak_signal", "wild_card", "tendencia", "megatendencia"]
  }).notNull().default("weak_signal"),

  classificacao: text("classificacao", {
    enum: ["confirmavel", "ambiguo", "ruido"]
  }).notNull().default("ambiguo"),

  origemFonte:         text("origem_fonte"),
  tipoEvidencia:       text("tipo_evidencia"),
  porQueNovo:          text("por_que_novo"),
  potencialDisruptivo: text("potencial_disruptivo"),
  atoresPortadores:    text("atores_portadores"),
  janelaAnos:          text("janela_anos"),

  sentinela1Descricao: text("sentinela1_descricao"),
  sentinela1Fonte:     text("sentinela1_fonte"),
  sentinela1Status:    text("sentinela1_status", {
    enum: ["inativo", "ativo", "disparado"]
  }).default("inativo"),

  sentinela2Descricao: text("sentinela2_descricao"),
  sentinela2Fonte:     text("sentinela2_fonte"),
  sentinela2Status:    text("sentinela2_status", {
    enum: ["inativo", "ativo", "disparado"]
  }).default("inativo"),

  statusRadar: text("status_radar", {
    enum: ["monitorando", "amplificando", "materializado", "arquivado"]
  }).notNull().default("monitorando"),

  interpretacaoAtual: text("interpretacao_atual"),
  acaoRecomendada:    text("acao_recomendada"),
  clusterId:          text("cluster_id"),
  identificadoPor:    text("identificado_por").default("KLIO"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WeakSignal    = typeof weakSignals.$inferSelect;
export type NewWeakSignal = typeof weakSignals.$inferInsert;

export const indicators = pgTable("indicators", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  source: text("source"),
  parametersJson: jsonb("parameters_json"),
  thresholdYellow: doublePrecision("threshold_yellow"),
  thresholdRed: doublePrecision("threshold_red"),
  lastValue: doublePrecision("last_value"),
  lastCheckedAt: timestamp("last_checked_at"),
  status: text("status").default("verde").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});