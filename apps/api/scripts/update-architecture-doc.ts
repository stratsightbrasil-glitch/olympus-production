#!/usr/bin/env npx tsx
/**
 * OLYMPUS v4.0 — Atualizador de Documentação de Arquitetura
 * Lê o código-fonte real e sincroniza OLYMPUS_ARCHITECTURE_v4.md
 *
 * Uso:
 *   npx tsx scripts/update-architecture-doc.ts
 *   npx tsx scripts/update-architecture-doc.ts --dry-run   (mostra diff sem escrever)
 *   npx tsx scripts/update-architecture-doc.ts --section rotas
 *
 * Seções atualizáveis:
 *   rotas       — tabela de rotas da API (lê apps/api/src/routes/*.ts)
 *   agentes     — tabela de agentes e tiers (lê banco via API)
 *   metodologias — tabela de metodologias e fases (lê banco via API)
 *   schema      — tabela de tabelas do banco (lê packages/db/src/schema.ts)
 *   variaveis   — tabela de variáveis de ambiente (lê .env.example)
 *   tecnicas    — técnicas SAT (lê banco via API)
 *   all         — todas as seções (padrão)
 */

import * as fs from "fs";
import * as path from "path";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");
const SECTION_FILTER = (() => {
  const idx = process.argv.indexOf("--section");
  return idx !== -1 ? process.argv[idx + 1] : "all";
})();

const API = "http://localhost:3333";
const REPO_ROOT = process.cwd();   // assume execução na raiz do monorepo
const DOC_PATH = path.join(REPO_ROOT, "OLYMPUS_ARCHITECTURE.md");

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(`  ${msg}`); }
function warn(msg: string) { console.log(`  ⚠️  ${msg}`); }

async function apiGet(path: string, jwt?: string): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
  });
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`);
  return res.json();
}

async function getAdminJwt(): Promise<string> {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@olympus.test", password: "AdminTest123!" }),
  });
  if (!res.ok) throw new Error(`Login admin falhou: HTTP ${res.status}`);
  const data = await res.json() as { token: string };
  return data.token;
}

/** Substitui um bloco delimitado no doc pelo novo conteúdo */
function replaceSection(doc: string, marker: string, newContent: string): string {
  const start = `<!-- AUTO:${marker}:START -->`;
  const end   = `<!-- AUTO:${marker}:END -->`;
  const startIdx = doc.indexOf(start);
  const endIdx   = doc.indexOf(end);

  if (startIdx === -1 || endIdx === -1) {
    warn(`Marcador AUTO:${marker} não encontrado no doc — seção não atualizada`);
    return doc;
  }

  return (
    doc.slice(0, startIdx + start.length) +
    "\n" + newContent + "\n" +
    doc.slice(endIdx)
  );
}

/** Diff simples: conta linhas adicionadas/removidas */
function diffStats(before: string, after: string): { added: number; removed: number } {
  const bLines = new Set(before.split("\n"));
  const aLines = new Set(after.split("\n"));
  const added   = [...aLines].filter(l => !bLines.has(l)).length;
  const removed = [...bLines].filter(l => !aLines.has(l)).length;
  return { added, removed };
}

// ─── EXTRATORES ──────────────────────────────────────────────────────────────

/** Extrai rotas de todos os arquivos de routes/*.ts */
function extractRoutes(): string {
  const routesDir = path.join(REPO_ROOT, "apps/api/src/routes");

  if (!fs.existsSync(routesDir)) {
    warn(`Diretório de rotas não encontrado: ${routesDir}`);
    return "";
  }

  interface Route {
    method: string;
    path: string;
    auth: string;
    description: string;
    file: string;
  }

  const routes: Route[] = [];

  const files = fs.readdirSync(routesDir).filter(f => f.endsWith(".ts"));

  for (const file of files) {
    const content = fs.readFileSync(path.join(routesDir, file), "utf-8");
    const lines = content.split("\n");

    // Detectar rotas Hono: routerVar.get/post/put/patch/delete(path)
    const routeRegex = /\w+\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    let match: RegExpExecArray | null;

    routeRegex.lastIndex = 0;

    while ((match = routeRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const routePath = match[2];
      if (!routePath.startsWith("/")) continue;

      // Detectar auth: procurar 'authMiddleware' ou 'jwtMiddleware' na mesma linha ou próximas 3 linhas
      const lineIdx = content.slice(0, match.index).split("\n").length - 1;
      const context = lines.slice(Math.max(0, lineIdx - 1), lineIdx + 4).join(" ");
      const hasAuth = /authMiddleware|jwtMiddleware|requireAdmin|requireRole|jwt\(/.test(context);
      const isAdmin = /requireAdmin|role.*admin/i.test(context);
      const auth = !hasAuth ? "Público" : isAdmin ? "JWT (admin)" : "JWT";

      // Tentar extrair descrição do comentário acima
      const commentLine = lines[Math.max(0, lineIdx - 1)]?.trim() ?? "";
      const description = commentLine.startsWith("//")
        ? commentLine.replace(/^\/\/\s*/, "")
        : inferDescription(method, routePath);

      routes.push({ method, path: `/api/v1${routePath}`.replace(/\/api\/v1\/api\/v1/, "/api/v1"), auth, description, file });
    }
  }

  // Deduplicar e ordenar
  const seen = new Set<string>();
  const unique = routes.filter(r => {
    const key = `${r.method}:${r.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  if (unique.length === 0) return "";

  const rows = unique.map(r =>
    `| ${r.method.padEnd(6)} | \`${r.path}\` | ${r.auth} | ${r.description} | ${r.file} |`
  ).join("\n");

  return `| Método | Path | Auth | Função | Arquivo |\n|--------|------|------|--------|---------|\n${rows}`;
}

function inferDescription(method: string, routePath: string): string {
  const parts = routePath.split("/").filter(Boolean);
  const resource = parts[0] ?? "recurso";
  const map: Record<string, string> = {
    "GET": `Lista/busca ${resource}`,
    "POST": `Cria ${resource}`,
    "PUT": `Atualiza ${resource}`,
    "PATCH": `Atualiza parcialmente ${resource}`,
    "DELETE": `Remove ${resource}`,
  };
  return map[method] ?? resource;
}

/** Extrai schema do Drizzle */
function extractSchema(): string {
  const schemaPath = path.join(REPO_ROOT, "packages/db/src/schema.ts");

  if (!fs.existsSync(schemaPath)) {
    warn(`schema.ts não encontrado em ${schemaPath}`);
    return "";
  }

  const content = fs.readFileSync(schemaPath, "utf-8");

  // Extrair tabelas: export const tableName = pgTable('table_name', { ... })
  const tableRegex = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*['"`](\w+)['"`]/g;
  const tables: Array<{ varName: string; tableName: string; columns: string[] }> = [];

  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(content)) !== null) {
    const varName = match[1];
    const tableName = match[2];

    // Extrair colunas do bloco subsequente
    const blockStart = content.indexOf("{", match.index + match[0].length);
    let depth = 0;
    let blockEnd = blockStart;
    for (let i = blockStart; i < content.length; i++) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") {
        depth--;
        if (depth === 0) { blockEnd = i; break; }
      }
    }

    const block = content.slice(blockStart, blockEnd);
    const columnRegex = /^\s+(\w+)\s*:/gm;
    const columns: string[] = [];
    let colMatch: RegExpExecArray | null;
    while ((colMatch = columnRegex.exec(block)) !== null) {
      columns.push(colMatch[1]);
    }

    tables.push({ varName, tableName, columns });
  }

  if (tables.length === 0) return "";

  const rows = tables.map(t =>
    `| \`${t.tableName}\` | ${t.columns.slice(0, 5).join(", ")}${t.columns.length > 5 ? `... (+${t.columns.length - 5})` : ""} |`
  ).join("\n");

  return `| Tabela | Colunas principais |\n|--------|--------------------|${"\n" + rows}`;
}

/** Extrai variáveis de ambiente do .env.example */
function extractEnvVars(): string {
  const envPath = path.join(REPO_ROOT, ".env.example");
  const envActualPath = path.join(REPO_ROOT, ".env");

  // Usar .env.example; se não existir, tentar extrair do .env (sem valores)
  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf-8");
  } else if (fs.existsSync(envActualPath)) {
    // Sanitizar .env: remover valores reais
    content = fs.readFileSync(envActualPath, "utf-8")
      .split("\n")
      .map(line => {
        if (line.startsWith("#") || !line.includes("=")) return line;
        const [key] = line.split("=");
        return `${key}=<valor>`;
      })
      .join("\n");
    warn("Usando .env sanitizado (sem .env.example)");
  } else {
    warn(".env.example não encontrado");
    return "";
  }

  const vars: Array<{ name: string; required: string; description: string }> = [];
  let currentComment = "";

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      currentComment = trimmed.replace(/^#+\s*/, "");
    } else if (trimmed && trimmed.includes("=")) {
      const [name] = trimmed.split("=");
      const required = /obrigatório|required|OBRIGATÓRIO/i.test(currentComment) ? "**Sim**" : "Opcional";
      vars.push({ name: name.trim(), required, description: currentComment || inferEnvDescription(name.trim()) });
      currentComment = "";
    } else {
      currentComment = "";
    }
  }

  if (vars.length === 0) return "";

  const rows = vars.map(v =>
    `| \`${v.name}\` | ${v.required} | ${v.description} |`
  ).join("\n");

  return `| Variável | Obrigatório | Descrição |\n|----------|-------------|-----------|${"\n" + rows}`;
}

function inferEnvDescription(name: string): string {
  const map: Record<string, string> = {
    ANTHROPIC_API_KEY: "Chave API Anthropic",
    TAVILY_API_KEY: "Chave API Tavily (busca web)",
    JWT_SECRET: "Segredo para assinar JWTs (32+ chars)",
    DATABASE_URL: "URL de conexão PostgreSQL",
    VOYAGE_API_KEY: "Chave API Voyage AI (RAG embeddings)",
    SMTP_HOST: "Servidor SMTP para alertas KRATOS",
    SMTP_PORT: "Porta SMTP",
    SMTP_USER: "Usuário SMTP",
    SMTP_PASS: "Senha SMTP",
    ALLOWED_ORIGIN: "Origin CORS permitida",
    JWT_EXPIRY: "Expiração do JWT (1h|4h|8h|24h|7d)",
    CONNECTIVITY_MODE: "Modo de conectividade (ONLINE|SOBERANO|AIR_GAPPED)",
    OLLAMA_BASE_URL: "URL do servidor Ollama",
    FRED_API_KEY: "Chave API Federal Reserve (FRED)",
    INLABS_EMAIL: "Credencial DOU INLABS",
    INLABS_PASSWORD: "Senha DOU INLABS",
    ITU_EMAIL: "Credencial ITU DataHub",
    ITU_PASSWORD: "Senha ITU DataHub",
    N8N_WEBHOOK_URL: "Webhook n8n (automações externas)",
    POSTGRES_USER: "Usuário PostgreSQL Docker",
    POSTGRES_PASSWORD: "Senha PostgreSQL Docker",
    POSTGRES_DB: "Nome do banco PostgreSQL Docker",
  };
  return map[name] ?? name.toLowerCase().replace(/_/g, " ");
}

/** Busca agentes via API */
async function extractAgentes(jwt: string): Promise<string> {
  try {
    // Buscar via settings (admin)
    const settings = await apiGet("/api/v1/settings", jwt) as {
      agents?: Array<{ name: string; type: string; modelOverride?: string }>;
      llmTiers?: { economy: string; premium: string };
    };

    if (!settings.agents || settings.agents.length === 0) {
      // Fallback: informação estática do ESTADO_ATUAL
      return buildStaticAgentsTable();
    }

    const tiers = settings.llmTiers ?? { economy: "claude-sonnet-4-6", premium: "claude-opus-4-7" };

    const rows = settings.agents.map(a => {
      const tier = a.modelOverride ?? "global";
      const model = tier === "economy" ? tiers.economy :
                    tier === "premium" ? tiers.premium : "global do LLM Selector";
      return `| **${a.name}** | ${a.type} | \`${tier}\` | ${model} |`;
    }).join("\n");

    return `| Agente | Tipo | Tier | Modelo Efetivo |\n|--------|------|------|---------------|${"\n" + rows}`;
  } catch {
    return buildStaticAgentsTable();
  }
}

function buildStaticAgentsTable(): string {
  const agents = [
    { name: "HERMES", type: "orchestrator", tier: "global", model: "LLM Selector" },
    { name: "OLYMPUS", type: "orchestrator", tier: "global", model: "LLM Selector" },
    { name: "HERMES_SIPLEX", type: "orchestrator", tier: "global", model: "LLM Selector" },
    { name: "SCOPUS", type: "expert", tier: "economy", model: "claude-sonnet-4-6" },
    { name: "KLIO", type: "expert", tier: "premium", model: "claude-opus-4-7" },
    { name: "PYTHIA", type: "expert", tier: "premium", model: "claude-opus-4-7" },
    { name: "MNEMOSYNE", type: "expert", tier: "premium", model: "claude-opus-4-7" },
    { name: "THEMIS", type: "expert", tier: "premium", model: "claude-opus-4-7" },
    { name: "KRATOS", type: "expert", tier: "economy", model: "claude-sonnet-4-6" },
    { name: "ATHENA", type: "expert", tier: "premium", model: "claude-opus-4-7" },
  ];
  const rows = agents.map(a =>
    `| **${a.name}** | ${a.type} | \`${a.tier}\` | ${a.model} |`
  ).join("\n");
  return `| Agente | Tipo | Tier | Modelo Efetivo |\n|--------|------|------|---------------|${"\n" + rows}`;
}

/** Busca metodologias e fases via API */
async function extractMetodologias(jwt: string): Promise<string> {
  try {
    const meths = await apiGet("/api/v1/engine/methodologies", jwt) as Array<{
      name: string;
      category: string;
      steps?: Array<{ agentName?: string; label?: string }>;
    }>;

    const orchestratorMap: Record<string, string> = {
      "MSEF": "HERMES",
      "GRUMBACH - PLANEJAMENTO": "OLYMPUS",
      "GODET": "HERMES",
      "OTAN/AltA": "HERMES",
      "SIEX - MPC": "OLYMPUS",
      "SIPLEx": "HERMES_SIPLEX",
      "MACROPLAN": "HERMES",
      "MPO": "HERMES",
      "ASPLAN": "HERMES",
      "FUTURES": "HERMES",
    };

    const rows = meths.map(m => {
      const phases = m.steps?.length ?? "?";
      const orch = orchestratorMap[m.name] ?? "HERMES";
      const agentList = m.steps
        ? [...new Set(m.steps.map(s => s.agentName).filter(Boolean))].join(", ")
        : "";
      return `| ${m.name} | ${orch} | ${phases} | ${m.category} | ${agentList} |`;
    }).join("\n");

    return `| Metodologia | Orquestrador | Fases | Categoria | Agentes |\n|-------------|-------------|-------|-----------|---------|${"\n" + rows}`;
  } catch (e) {
    warn(`Falha ao buscar metodologias via API: ${e}`);
    return "";
  }
}

/** Busca técnicas SAT via API */
async function extractTecnicas(jwt: string): Promise<string> {
  try {
    const techs = await apiGet("/api/v1/engine/techniques", jwt) as Array<{
      name: string;
      description?: string;
    }>;

    const rows = techs.map((t, i) =>
      `| ${i + 1} | ${t.name} | ${t.description?.slice(0, 80) ?? ""} |`
    ).join("\n");

    return `| # | Nome | Descrição |\n|---|------|-----------|${"\n" + rows}`;
  } catch (e) {
    warn(`Falha ao buscar técnicas via API: ${e}`);
    return "";
  }
}

/** Extrai versão atual do package.json */
function extractVersionInfo(): string {
  const pkgPath = path.join(REPO_ROOT, "package.json");
  if (!fs.existsSync(pkgPath)) return "";

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
    name?: string;
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const keyDeps = ["ai", "@ai-sdk/anthropic", "hono", "drizzle-orm", "@langchain/langgraph",
                   "react", "typescript", "postgres"];
  const depRows = keyDeps
    .filter(d => allDeps[d])
    .map(d => `| \`${d}\` | \`${allDeps[d]}\` |`)
    .join("\n");

  return `**Versão:** \`${pkg.version ?? "4.0.0"}\` · **Atualizado:** ${new Date().toLocaleDateString("pt-BR")}\n\n| Dependência | Versão |\n|-------------|--------|${"\n" + depRows}`;
}

// ─── CRIADOR DE DOC SE NÃO EXISTIR ──────────────────────────────────────────

function ensureDocExists() {
  if (fs.existsSync(DOC_PATH)) return;

  warn(`${DOC_PATH} não encontrado — criando template inicial`);

  const template = `# OLYMPUS v4.0 — Documentação de Arquitetura
**StratSight Brasil · Strategic Foresight · IA Agêntica**

<!-- AUTO:versao:START -->
<!-- AUTO:versao:END -->

---

## 1. Rotas da API

<!-- AUTO:rotas:START -->
<!-- AUTO:rotas:END -->

---

## 2. Schema do Banco de Dados

<!-- AUTO:schema:START -->
<!-- AUTO:schema:END -->

---

## 3. Agentes

<!-- AUTO:agentes:START -->
<!-- AUTO:agentes:END -->

---

## 4. Metodologias

<!-- AUTO:metodologias:START -->
<!-- AUTO:metodologias:END -->

---

## 5. Técnicas SAT

<!-- AUTO:tecnicas:START -->
<!-- AUTO:tecnicas:END -->

---

## 6. Variáveis de Ambiente

<!-- AUTO:variaveis:START -->
<!-- AUTO:variaveis:END -->

---

*Gerado automaticamente por update-architecture-doc.ts · ${new Date().toISOString()}*
`;

  fs.writeFileSync(DOC_PATH, template, "utf-8");
  log(`Template criado em ${DOC_PATH}`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  OLYMPUS v4.0 — Atualizador de Documentação");
  console.log("  " + new Date().toISOString());
  if (DRY_RUN) console.log("  MODO DRY-RUN — sem escrita em disco");
  if (SECTION_FILTER !== "all") console.log(`  Seção: ${SECTION_FILTER}`);
  console.log("═".repeat(60) + "\n");

  ensureDocExists();

  let doc = fs.readFileSync(DOC_PATH, "utf-8");
  const docOriginal = doc;

  // Autenticar (necessário para seções que leem o banco)
  let jwt = "";
  try {
    jwt = await getAdminJwt();
    log("✅ Autenticado como admin");
  } catch (e) {
    warn(`Autenticação falhou — seções de banco serão puladas: ${e}`);
  }

  const sections: Record<string, () => Promise<string>> = {
    versao:       async () => extractVersionInfo(),
    rotas:        async () => extractRoutes(),
    schema:       async () => extractSchema(),
    variaveis:    async () => extractEnvVars(),
    agentes:      async () => jwt ? extractAgentes(jwt) : "",
    metodologias: async () => jwt ? extractMetodologias(jwt) : "",
    tecnicas:     async () => jwt ? extractTecnicas(jwt) : "",
  };

  let updatedCount = 0;
  let skippedCount = 0;

  for (const [sectionName, extractor] of Object.entries(sections)) {
    if (SECTION_FILTER !== "all" && SECTION_FILTER !== sectionName) continue;

    process.stdout.write(`  Atualizando ${sectionName}... `);

    try {
      const content = await extractor();

      if (!content) {
        console.log("⏭️  (sem conteúdo)");
        skippedCount++;
        continue;
      }

      const before = doc;
      doc = replaceSection(doc, sectionName, content);

      if (doc !== before) {
        const { added, removed } = diffStats(before, doc);
        console.log(`✅ (+${added}/-${removed} linhas)`);
        updatedCount++;
      } else {
        console.log("✓ (sem mudanças)");
      }
    } catch (e) {
      console.log(`❌ Erro: ${e}`);
    }
  }

  // Atualizar timestamp no topo
  doc = doc.replace(
    /\*\*Atualizado:\*\* [^\n]+/,
    `**Atualizado:** ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} · Gerado automaticamente`
  );

  // Escrever (se não dry-run e houve mudanças)
  if (!DRY_RUN && doc !== docOriginal) {
    fs.writeFileSync(DOC_PATH, doc, "utf-8");
    log(`\n  📝 ${DOC_PATH} atualizado (${updatedCount} seções)`);
  } else if (DRY_RUN) {
    log(`\n  Dry-run: ${updatedCount} seções seriam atualizadas`);
    if (doc !== docOriginal) {
      // Mostrar diff resumido
      const { added, removed } = diffStats(docOriginal, doc);
      log(`  Diff: +${added}/-${removed} linhas`);
    }
  } else {
    log(`\n  Sem mudanças detectadas.`);
  }

  console.log(`\n  Seções: ${updatedCount} atualizadas · ${skippedCount} puladas`);
  console.log("═".repeat(60) + "\n");
}

main().catch(e => {
  console.error("❌ Erro fatal:", e);
  process.exit(1);
});
