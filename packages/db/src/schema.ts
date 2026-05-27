import { pgTable, text, timestamp, uuid, jsonb, doublePrecision, boolean, customType, integer, primaryKey, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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
  slug: text("slug").unique(), // identificador URL-safe (ex: 'msef', 'grumbach')
  description: text("description"),
  sourceDoc: text("source_doc"), // documento de referência (ex: 'EB70-MT-10.401')
  category: text("category").default("Cenários Prospectivos").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  agentsConfig: jsonb("agents_config"),
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
  modelOverride: text("model_override"), // Override de modelo por agente (ex: 'claude-sonnet-4-6'). NULL = usa o modelo global configurado.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(), // Alterado para TEXT para suportar 'sess_12345'
  name: text("name").default("").notNull(),
  client: text("client").default(""),
  analyst: text("analyst").default(""),
  horizon: text("horizon").default(""),
  classification: text("classification").default("Acesso Restrito").notNull(),
  methodology: text("methodology").default("MSEF").notNull(),
  techniquesConfig: jsonb("techniques_config"), // Técnicas SAT aplicadas diretamente ao projeto (ex: Red Teaming)
  panelToken: text("panel_token").unique(),
  status: text("status").default("Em produção").notNull(),
  kratosCron: text("kratos_cron").default("0 6 * * *").notNull(),
  connectivityMode: text("connectivity_mode").default("ONLINE").notNull(), // 'ONLINE' | 'SOBERANO' | 'AIR_GAPPED'
  alertEmails: text("alert_emails").default("").notNull(),
  teamId: uuid("team_id"),    // FK para teams — nullable (projetos existentes não são afetados)
  analystId: uuid("analyst_id"), // FK para users — nullable (substitui gradualmente o campo texto analyst)
  createdBy: text("created_by").default("Sistema").notNull(),
  updatedBy: text("updated_by").default("Sistema").notNull(),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  // Cobre a query do KRATOS cron: WHERE status = 'Ativo' AND deletedAt IS NULL
  projectsStatusDeletedIdx: index("projects_status_deleted_at_idx").on(t.status, t.deletedAt),
  // Cobre a listagem de sessões por analista (não-admin): WHERE createdBy = X
  projectsCreatedByIdx: index("projects_created_by_idx").on(t.createdBy),
}));

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  filesJson: jsonb("files_json"),
  agentName: text("agent_name"),
  messageType: text("message_type").default("parcial"), // 'relatorio_final'|'parcial'|'monitoramento'|'revisao'
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  // Cobre todas as queries WHERE projectId = X (chat, memory, export, sessions)
  messagesProjectIdx: index("messages_project_id_idx").on(t.projectId),
  // Cobre queries ORDER BY createdAt — carregamento de histórico de mensagens
  messagesProjectCreatedIdx: index("messages_project_id_created_at_idx").on(t.projectId, t.createdAt),
}));

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
  valueHistory: jsonb("value_history").default('[]'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Audit Logs (imutável — sem update/delete) ────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id:           uuid("id").primaryKey().defaultRandom(),
  userId:       text("user_id"),       // pode ser 'system' ou usuário deletado
  userName:     text("user_name"),
  action:       text("action").notNull(), // 'login'|'logout'|'create_project'|'delete_project'|'run_analysis'|'export_docx'|'export_pdf'|'generate_backup'|'view_painel'|'update_settings'|'create_user'|'update_user'
  resourceType: text("resource_type"),   // 'project'|'user'|'backup'|'analysis'|'export'|'settings'
  resourceId:   text("resource_id"),
  metadata:     jsonb("metadata"),
  ipAddress:    text("ip_address"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

export type AuditLog    = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

// ── platform_settings (migrada do raw SQL no startup) ─────────────────────────
export const platformSettings = pgTable("platform_settings", {
  key:       text("key").primaryKey(),
  value:     jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ── Motor de Metodologias Normalizado (Sprint 1) ──────────────────────────────

// Tipos/categorias — N:N com methodologies
// Ex: GRUMBACH → "Planejamento Estratégico" E "Cenários Prospectivos"
export const methodologyTypes = pgTable("methodology_types", {
  id:            uuid("id").primaryKey().defaultRandom(),
  methodologyId: uuid("methodology_id").notNull().references(() => methodologies.id, { onDelete: "cascade" }),
  category:      text("category").notNull(),
  // Valores: "Cenários Prospectivos"|"Planejamento Estratégico"|"Produção do Conhecimento"|"Análise Estratégica"
});

// Fases de cada metodologia
export const methodologyPhases = pgTable("methodology_phases", {
  id:            uuid("id").primaryKey().defaultRandom(),
  methodologyId: uuid("methodology_id").notNull().references(() => methodologies.id, { onDelete: "cascade" }),
  phaseNum:      integer("phase_num").notNull(),
  label:         text("label").notNull(),
  agentRole:     text("agent_role").notNull(), // nome do agente responsável pela fase
  description:   text("description"),
  slug:          text("slug").unique(),        // identificador URL-safe para upsert, ex: 'msef_triagem'
  nodeSlug:      text("node_slug"),            // nó LangGraph futuro: 'node_framing', 'node_modeling', etc.
});

// Técnicas recomendadas por fase — pool livre (não obrigatório)
export const phaseTechniques = pgTable("phase_techniques", {
  phaseId:     uuid("phase_id").notNull().references(() => methodologyPhases.id, { onDelete: "cascade" }),
  techniqueId: uuid("technique_id").notNull().references(() => techniques.id, { onDelete: "cascade" }),
  priority:    integer("priority").default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.phaseId, t.techniqueId] }),
}));

// Instruções específicas por agente × metodologia — injetadas em runtime
export const agentMethodPrompts = pgTable("agent_method_prompts", {
  id:                uuid("id").primaryKey().defaultRandom(),
  agentId:           uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  methodologyId:     uuid("methodology_id").notNull().references(() => methodologies.id, { onDelete: "cascade" }),
  extraInstructions: text("extra_instructions").notNull(),
}, (t) => ({
  agentMethodUniq: uniqueIndex('agent_method_prompts_agent_method_unique').on(t.agentId, t.methodologyId),
}));

// ── Equipes de analistas (Sprint 1-B) ─────────────────────────────────────────

export const teams = pgTable("teams", {
  id:          uuid("id").primaryKey().defaultRandom(),
  name:        text("name").notNull(),
  description: text("description"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// N:N users × teams
export const teamMembers = pgTable("team_members", {
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role:   text("role").notNull().default("analista"), // 'lider'|'analista'|'revisor'
}, (t) => ({
  pk: primaryKey({ columns: [t.teamId, t.userId] }),
}));

// ── Eventos Booleanos de Projeto (Fase 1 — HITL) ──────────────────────────────
// FPFs, tendências, incertezas e fatores de inflexão propostos pelos agentes.
// Fluxo HITL: proposed → approved/rejected pelo analista humano.
// Na Fase 2, o StateGraph lê apenas eventos com status='approved'.
export const projectEvents = pgTable("project_events", {
  id:               uuid("id").defaultRandom().primaryKey(),
  projectId:        text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name:             text("name").notNull(),
  description:      text("description").notNull(),
  type:             text("type").notNull().default("uncertainty"), // 'trend'|'uncertainty'|'inflection_factor'|'fpf'
  status:           text("status").notNull().default("proposed"),  // 'proposed'|'approved'|'rejected'
  // Avaliação alfanumérica MPC/EB70-MT-10.401: reliability A-F, credibility 1-6
  sourceEvaluation: jsonb("source_evaluation").default({ reliability: "C", credibility: "3" }),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  // Cobre a query de âncora de contexto: WHERE projectId = X AND status = 'approved'
  eventsProjectStatusIdx: index("project_events_project_id_status_idx").on(t.projectId, t.status),
}));

// ── Cenários de Projeto ────────────────────────────────────────────────────────
// matrixValue: { "uuid_do_evento": "OCORRE" | "NÃO OCORRE" } — estados booleanos.
// Probabilidade calculada via Grumbach/SMIC (soma ≈ 1.0).
export const projectScenarios = pgTable("project_scenarios", {
  id:          uuid("id").defaultRandom().primaryKey(),
  projectId:   text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name:        text("name").notNull(),
  description: text("description").notNull(),
  probability: doublePrecision("probability").default(0.0),
  type:        text("type").notNull().default("alternative"), // 'inercial'|'alternative'|'target'
  matrixValue: jsonb("matrix_value").notNull().default({}),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ── Matriz de Impactos Diretos (entrada do MICMAC) ────────────────────────────
// Escala MICMAC: 0=sem influência, 1=fraca, 2=moderada, 3=forte.
// pythia_node calculará M^k (k=4 ou 5) para motricidade e dependência indireta.
export const matrixDirectImpacts = pgTable("matrix_direct_impacts", {
  id:          uuid("id").defaultRandom().primaryKey(),
  projectId:   text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fromEventId: uuid("from_event_id").notNull(),
  toEventId:   uuid("to_event_id").notNull(),
  impactScore: integer("impact_score").notNull().default(0),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ── Saídas de Técnicas Determinísticas (MICMAC, MACTOR, SMIC) ─────────────────
// Resultados persistidos como JSONB — agentes leem esses dados sem precisar calcular.
// Elimina alucinações quantitativas e torna os resultados auditáveis.
export const techniqueExecutionOutputs = pgTable("technique_execution_outputs", {
  id:            uuid("id").defaultRandom().primaryKey(),
  projectId:     text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  techniqueType: text("technique_type").notNull(), // 'micmac'|'mactor'|'smic'|'morphol'|'grumbach_panel'
  outputData:    jsonb("output_data").notNull().default({}),
  metadata:      jsonb("metadata").default({}),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});

// ── Relações das novas tabelas ─────────────────────────────────────────────────
export const projectEventsRelations = relations(projectEvents, ({ one }) => ({
  project: one(projects, { fields: [projectEvents.projectId], references: [projects.id] }),
}));

export const projectScenariosRelations = relations(projectScenarios, ({ one }) => ({
  project: one(projects, { fields: [projectScenarios.projectId], references: [projects.id] }),
}));

export const matrixDirectImpactsRelations = relations(matrixDirectImpacts, ({ one }) => ({
  project: one(projects, { fields: [matrixDirectImpacts.projectId], references: [projects.id] }),
}));

export const techniqueOutputsRelations = relations(techniqueExecutionOutputs, ({ one }) => ({
  project: one(projects, { fields: [techniqueExecutionOutputs.projectId], references: [projects.id] }),
}));