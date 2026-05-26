# OLYMPUS v4.0 — Histórico Consolidado de Arquitetura e Desenvolvimento
**StratSight Brasil · Strategic Foresight · IA Agêntica**
**Última atualização:** 23 de Maio de 2026 (Sprint 10 — FRED + Legislativo · Playbook · Audit · Rate Limiting · Ollama Hardening · PoC Seed) · **Confidencial**

> Este documento é a memória técnica do projeto. Registra a arquitetura, as justificativas de cada decisão, tudo o que foi feito e funcionou, tudo o que foi feito errado e precisou ser revertido, e o estado atual do backlog. Deve ser lido antes de qualquer intervenção no código.

---

## 1. CONTEXTO DE NEGÓCIO

**O que é o OLYMPUS:** Plataforma integrada de planejamento estratégico e monitoramento contínuo. O motor **ATHENA** é o produto-âncora — especializado em *Strategic Foresight* (cenários prospectivos). O motor **KRATOS** cuida do monitoramento automático de indicadores.

```
OLYMPUS
├── Motor ATHENA   → produção de cenários · 9 agentes · 7 metodologias (MSEF · GRUMBACH · GODET · MACROPLAN · MPO · ASPLAN · FUTURES)
├── Motor KRATOS   → monitoramento contínuo · indicadores · alertas
├── Painel Cliente → acesso remoto · semáforo de cenário · histórico
├── API OLYMPUS    → integração com parceiros · webhooks n8n
└── Vault de Dados → dados do cliente · dados abertos · offline
```

**Premissas que guiam decisões técnicas:**
- Operação **solo** — toda decisão deve minimizar complexidade operacional
- Custo **< R$ 1.500/mês** até o segundo contrato
- Clientes de defesa e governo exigem: marca d'água CONFIDENCIAL, logs de auditoria, possibilidade de operação **offline/air-gapped**
- Produto-âncora: R$ 80K–250K por projeto de cenários
- Recorrente: R$ 8K–25K/mês (monitoramento KRATOS)
- Meta Ano 1: R$ 300K · **Exit: aquisição por Big Tech em 8 anos**
- O **Playbook MSEF** é o principal ativo de Propriedade Intelectual

---

## 2. EVOLUÇÃO HISTÓRICA DA ARQUITETURA

### 2.1. Athena v1/v2 — O Monolito (Sprint 1 e Sprint 2)

**Stack:** React 18 JSX (`src/App.jsx` ~1.750 linhas) + Node.js Express 5 (`server.js` ~915 linhas)  
**Persistência:** `athena_sessions.json` (arquivo JSON local)  
**IA:** API Anthropic `claude-sonnet-4-6` chamada diretamente no `server.js`  
**Porta:** 8080

**O que já funcionava:**
- 7 agentes MSEF no master prompt: HERMES · SCOPUS · KLIO · PYTHIA · MNEMOSYNE · THEMIS · KRATOS
- 7 metodologias: MSEF · Grumbach · Macroplan · Godet · MPO · ASPLAN · Futures
- 4 modos de visualização: Por Etapa · Passo a Passo · Extended Thinking · Uma Passagem
- Exportação: `.md` · `.docx` · PDF (via `window.print`)
- Sincronização automática da Ficha de Escopo via `sincronizarProjeto()`
- `sessionLock` para serializar operações concorrentes de sessão
- `projetoRef` para evitar closure stale em callbacks assíncronos
- CORS · rate limiting · `requireBody()` · retry com backoff (2s, 4s)

**Bugs corrigidos nessa fase — não regredir:**

| Bug | Fix aplicado |
|---|---|
| Wildcard Express 5 causava conflito | Usar `/{*path}`, nunca `'*'` |
| Rotas de sessão interceptadas pelo wildcard | `/api/v1/sessions` ANTES do `express.static` |
| `vizMode` chegava na API Anthropic | Allowlist de campos no servidor |
| `.docx` corrompido no Word | Removido `numbering reference` inválido |
| XSS no `/painel` | `escHtml()` em todos os valores; `safeStatus()` protege CSS class |
| `escHtml` redefinida localmente | Única definição no topo do módulo |
| Base64 decode aninhado silencioso | `Buffer.from` executado uma vez; falha logada |
| Sessões corrompidas perdiam tudo | Backup `.corrupted.<timestamp>` antes de retornar `{}` |
| `setTimeout(() => init(), 100)` | `projetoRef.current` atualizado diretamente |
| Model hardcoded no frontend | Constante `ANTHROPIC_MODEL` no servidor, nunca enviada pelo cliente |

**Roadmap planejado à época (Fase A):**
- A1: Migrar para SQLite — **superado** (migração direto para PostgreSQL na v4)
- A2: Web search nos agentes via Tavily — **concluído na v4**
- A3: Upload ampliado (XLSX, CSV, JSON) — **concluído na v4**
- A4: Executável desktop via Electron — pendente
- A5: Repositórios abertos (BCB, IBGE, IPEA) — pendente

---

### 2.2. Athena v3 / OLYMPUS v4.0 — O Monorepo (Sprint 3 em diante)

**Decisão:** Em vez de evoluir incrementalmente o monolito, foi feita uma migração completa para uma arquitetura corporativa escalável. A mudança foi motivada pela necessidade de:
- TypeScript estrito em todo o stack (eliminar erros de contrato)
- PostgreSQL em vez de SQLite (concorrência, multi-tenant, filas)
- Dockerização completa (deploy on-premise / air-gapped)
- Componentização do motor de IA para suportar múltiplos provedores

---

## 3. ARQUITETURA ATUAL (v4)

### 3.1. Estrutura do Monorepo

```
Olympus_v4/
├── apps/
│   ├── web/          → Frontend React 18 + Vite + TypeScript (Porta 80 / 5173 dev)
│   └── api/          → Backend Hono + Node.js + TypeScript (Porta 3333)
├── packages/
│   ├── core/         → Motor de IA Multi-Agente (Agent.ts · Orchestrator.ts)
│   ├── db/           → Drizzle ORM + Schemas PostgreSQL
│   └── tools/        → Ferramentas externas (Tavily Search API)
├── docker-compose.yml
├── nginx.conf
└── .env              → Variáveis de ambiente (nunca commitar)
```

**Gerenciamento:** NPM Workspaces nativo. Cada `apps/*` e `packages/*` é um workspace com seu próprio `package.json`. Dependências compartilhadas ficam na raiz.

### 3.2. Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Tipagem estrita, build rápido, hot reload |
| Backend | Hono + Node.js + TypeScript | Ultra-leve, I/O assíncrono, compatível com Edge |
| IA | Vercel AI SDK (`ai@6.0.168`) + `@ai-sdk/anthropic@3.0.71` | Agnóstico de provedor, gerencia tool calling e multi-step |
| Banco | PostgreSQL + Drizzle ORM | Concorrência, multi-tenant, tipagem via schema |
| Busca Web | Tavily Search API | Resultados estruturados, ideal para RAG |
| Proxy | Nginx | Reverse proxy, serve estáticos, absorve timeouts |
| Container | Docker Compose (3 contêineres) | Deploy one-command, air-gapped, volumes persistentes |

### 3.3. Por que TypeScript e não Python

Python é a língua franca para *treinar* modelos. TypeScript é superior para *construir produtos web* que orquestram LLMs comerciais:

- **Unificação absoluta:** Frontend, backend e banco compartilham linguagem e tipagem — erro de contrato no banco reflete no build do frontend
- **Vercel AI SDK:** Estado da arte em orquestração UI/IA. Gerencia streaming, blocos de raciocínio e tool calling de forma agnóstica
- **I/O assíncrono:** Node.js brilha em cargas orientadas a I/O — múltiplas buscas Tavily paralelas com 512MB de RAM
- **Sem overhead:** Não há servidor Python paralelo, sem bridging de linguagens, sem latência extra

**Onde Python faria falta (dívida técnica):**
- Processamento bruto de planilhas com milhões de linhas (falta Pandas/NumPy)
- Embeddings locais e RAG avançado (ecossistema nasce primeiro em Python)

**Visão futura:** Se o OLYMPUS escalar para cálculos matemáticos densos, criar um **microserviço Python isolado** (Agente Cientista de Dados) invocado sob demanda via HTTP/Webhook pelo Orquestrador TypeScript.

### 3.4. Por que PostgreSQL e não SQLite

SQLite foi o plano original (item A1 do roadmap v2). A decisão de pular direto para PostgreSQL foi motivada por:
- Multi-usuário concorrente (múltiplos analistas simultâneos)
- Fila assíncrona do KRONOS (cron jobs com cooldown entre execuções)
- Preparação para `pgvector` (embeddings/RAG no mesmo banco)
- Deploy Docker simplificado (contêiner oficial PostgreSQL)

### 3.5. Tabelas Principais (Drizzle ORM)

| Tabela | Descrição |
|---|---|
| `users` | Usuários do sistema (id UUID, email único, role, 2FA) |
| `projects` | Projetos / sessões de análise (id texto tipo `sess_12345`) |
| `messages` | Mensagens do chat (id UUID, role, content, agentName, createdAt) |
| `agents` | Definição dinâmica dos agentes (systemPrompt, toolsConfig) |
| `methodologies` | Metodologias disponíveis (agentsConfig como array JSON) |
| `indicators` | Indicadores monitorados pelo KRATOS |
| `embeddings` | Chunks de documentos indexados para RAG — id UUID, projectId, chunkText, metadata JSONB, embedding vector(512) |
| `tools` | Ferramentas registradas no motor |
| `techniques` | Técnicas SAT disponíveis |

---

## 4. MOTOR DE IA MULTI-AGENTE

### 4.1. Arquitetura do Motor

O núcleo de IA vive em `packages/core/`:
- **`Orchestrator.ts`:** Registra agentes, despacha execuções
- **`Agent.ts`:** Executa um agente individual via `generateText` do Vercel AI SDK
- **`types.ts`:** Contratos TypeScript (`AgentContext`, `Tool`)

O HERMES (orquestrador) usa a ferramenta `consultar_agente` para delegar tarefas. Os especialistas (SCOPUS, KLIO, etc.) usam `web_search` via Tavily. A delegação é **sempre sequencial** — um agente por vez.

### 4.2. Configuração Crítica do Agent.ts (sdk ai@6.0.168)

```typescript
import { generateText, jsonSchema, tool, stepCountIs } from "ai";

// Parâmetros corretos no SDK v6:
const response = await generateText({
  model: anthropic("claude-opus-4-7"),
  system: this.systemPrompt,
  messages,
  tools: hasTools ? aiTools : undefined,
  stopWhen: stepCountIs(10),          // ← NÃO é maxSteps
  prepareStep: hasTools
    ? async ({ stepNumber }) => ({
        toolChoice: stepNumber === 0 ? "required" : "auto",
      })
    : undefined,
  maxTokens: 32000,
});
```

### 4.3. Motor Dinâmico de Metodologias

Os agentes e metodologias não ficam hardcoded no código — são gerenciados 100% via banco de dados:
- **Auto-seed:** Na primeira requisição ao chat, `getOrSeedMethodology()` popula o banco com os 7 agentes clássicos e a metodologia MSEF automaticamente
- **Orquestração dinâmica:** `chat.ts` consulta a metodologia escolhida e instancia apenas os agentes vinculados a ela em tempo de execução
- **Atualização de prompts:** Cada requisição atualiza os `systemPrompts` no banco, garantindo que o seed sempre reflita a versão mais recente do código
- **Painel Admin (Engine Manager):** Interface para instalar novos "Motores" (arquivos JSON com definição de agentes e metodologias) sem novo deploy

### 4.4. Guardrails Anti-Alucinação

Se o LLM tentar acionar um agente não registrado na metodologia ativa, a ferramenta `consultar_agente` intercepta, devolve mensagem de erro estruturada e instrui o modelo a corrigir autonomamente — sem crash.

---

## 5. INFRAESTRUTURA DOCKER

### 5.1. Contêineres

| Contêiner | Imagem base | Porta | Função |
|---|---|---|---|
| `olympus_db` | `pgvector/pgvector:pg15` | 5432 (interno) | PostgreSQL + extensão pgvector |
| `olympus_api` | `node:20-slim` (Debian) | 3333 | Backend Hono compilado |
| `olympus_web` | `node:20-alpine` → `nginx:alpine` | 80 | Vite build servido pelo Nginx |

**Por que `node:20-slim` (Debian) na API:** Compatibilidade total com ferramentas de build do Node.js. Imagens Alpine causam falhas silenciosas em dependências nativas (ex: `bcrypt`, `pg`).

### 5.2. Nginx

O `nginx.conf` faz proxy reverso: rotas `/api/*` → contêiner `olympus_api:3333`. Resolve CORS sem configuração adicional no frontend.

**Timeouts críticos** (análises completas levam ~97s):
```nginx
location /api/ {
    proxy_pass http://api:3333/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
}
```
Sem esses timeouts, o Nginx corta a conexão em 60s com HTTP 504, mesmo que a API responda com sucesso.

### 5.3. Volumes Persistentes

| Volume | Conteúdo |
|---|---|
| `pgdata` | Dados do PostgreSQL — nunca apagar sem querer |
| `olympus_backups` | Backups `.sql.gz` gerados pela rota `/api/v1/backup/generate` |

---

## 6. FRONTEND (App.tsx)

### 6.1. Funcionalidades Implementadas

- **Autenticação completa:** Login/Registro com JWT, suporte a 2FA (TOTP via `speakeasy`), Roles (`admin`, `analista`, `cliente`)
- **Sem auto-login:** O token pode estar salvo no localStorage, mas o login manual é sempre exigido na abertura do sistema
- **Tela de boas-vindas:** Estado vazio exibe mensagem de orientação com botões "Histórico de Análises" e "Nova Sessão"
- **Modal de Nova Sessão:** Formulário com 6 campos de escopo (tema, horizonte temporal, quem elabora, cliente, questão estratégica central, mudança específica identificada), upload de arquivos de contexto e seleção de nível de análise
- **Modos de análise:** Etapa Completa · Passo a Passo · Raciocínio Estendido · Processo Completo
- **Extended Thinking:** Bloco colapsável com raciocínio interno do modelo
- **Alternância de modos:** Produção de Cenários ↔ Modo Monitoramento (KRATOS)
- **Exportação por mensagem:** Cada bubble de agente tem botões ⬇ Markdown · ⬇ DOCX · ⬇ PDF
- **Exportação sidebar:** Relatório Padrão (busca especificamente o "RELATÓRIO FINAL" do HERMES) · Relatório Estendido (todas as mensagens de agentes em PDF)
- **Exclusão de mensagem:** Botão 🗑 Excluir em cada bubble — remove do banco e da UI
- **Histórico com timestamp:** Data e hora exibidos em cada sessão listada
- **Upload de arquivos:** PDF, DOCX, TXT, imagens — com OCR/RAG via `multer` + `pdf2json` + `mammoth`
- **Painel KRATOS:** Abre dashboard HTML gerado com dados extraídos da última análise do KRATOS
- **Anti-prompt injection:** Botões de ação rápida injetam comandos silenciosamente no payload — sem poluir o chat
- **Interceptador JWT 401:** Auto-logout automático quando o token expira ou usuário é deletado

### 6.2. Variáveis de Ambiente (`.env`)

```bash
ANTHROPIC_API_KEY=sk-ant-...        # obrigatório
ANTHROPIC_MODEL=claude-opus-4-7     # modelo em uso
TAVILY_API_KEY=tvly-...             # obrigatório para KLIO/KRATOS
DATABASE_URL=postgres://postgres:postgres@olympus_db:5432/olympus
JWT_SECRET=olympus_super_secret_key_2026
ALLOWED_ORIGIN=http://localhost:80
SMTP_HOST=...                       # opcional — alertas por e-mail KRATOS
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
VOYAGE_API_KEY=pa-...               # RAG — Voyage AI voyage-3-lite 512 dims (dash.voyageai.com — gratuito)
INLABS_EMAIL=...                    # DOU — inlabs.in.gov.br (cadastro gratuito)
INLABS_PASSWORD=...
ITU_EMAIL=...                       # ITU DataHub — datahub.itu.int (cadastro gratuito)
ITU_PASSWORD=...
```

**⚠️ Regra crítica do `.env`:** Cada variável em sua própria linha. `\n` literal concatena variáveis e envia chaves malformadas para as APIs.

---

## 7. CRONOLOGIA — O QUE FOI FEITO E FUNCIONOU

Esta seção registra, em ordem cronológica, cada decisão que se provou correta.

### Sprint 1–2 (Athena v1/v2 — Monolito)
- Arquitetura inicial: `App.jsx` + `server.js` funcional com 7 agentes no master prompt
- `projetoRef` e `sessionLock` para evitar bugs de closure e concorrência
- `sincronizarProjeto()` extrai Ficha de Escopo do SCOPUS via parsing de tabela markdown
- Retry com backoff escalonado para a API Anthropic
- Rota `/api/v1/extract` com rate limiting para uploads

### Sprint 3 — Migração para OLYMPUS v4 (Monorepo TypeScript)
- Estruturação do monorepo com NPM Workspaces
- Migração do banco para PostgreSQL + Drizzle ORM
- Componentização do motor de IA em `packages/core`
- Dockerização completa (3 contêineres + Nginx)
- Sistema de autenticação JWT com 2FA
- Motor Dinâmico de Metodologias (auto-seed no primeiro acesso)
- Guardrails anti-alucinação na ferramenta `consultar_agente`
- Módulo de backup corporativo (`pg_dump` → `.sql.gz`)
- KRONOS: fila assíncrona com cooldown para monitoramento KRATOS
- Serviço de e-mail via Nodemailer (alertas KRATOS)
- Painel do cliente com extração automática de indicadores

### Resolução dos Bugs do SDK v6 (23–24 de Abril de 2026)
- Identificação e correção dos 4 bugs sobrepostos (seção 8)
- Prompt do HERMES reescrito com regra única e absoluta (sem blocos contraditórios)
- Trimming do histórico: `.slice(-12)` previne context bloat e respostas encolhendo
- `proxy_read_timeout 300s` no Nginx previne HTTP 504

### Funcionalidades UX (24 de Abril de 2026)
- Modal de Nova Sessão com 6 campos de escopo + upload de contexto
- Exportação inteligente: Relatório Padrão localiza automaticamente o "RELATÓRIO FINAL PADRÃO" do HERMES
- Exclusão de mensagem individual com confirmação + deleção no banco
- Timestamps com hora no histórico de análises
- Prompt do HERMES atualizado: ao concluir análise, instrui usuário sobre Nova Sessão e KRATOS
- Remoção do auto-login: sistema sempre exige autenticação manual

### Sprint 6 — Expansão Metodológica + Acesso Cliente (25 de Abril de 2026)
- Prompts MSEF v2 completos para todos os 7 agentes (estrutura metodológica explícita, regras de formatação, entregáveis por etapa)
- `TOOL_JSON_SCHEMAS` no `Agent.ts` atualizado: 51 indicadores em `buscar_dados_publicos`, schema de `buscar_documentos_internos`, enum fixo removido do `consultar_agente.agent_name`
- `HERMES_GRUMBACH` (4 fases militares) e `HERMES_GODET` (5 fases francesas MICMAC/MACTOR/SMIC) adicionados ao `seed.ts`; metodologias GRUMBACH e GODET apontam para os novos orquestradores
- Rota `GET /api/v1/painel/project/:id` em `painel.ts`: HTML completo com dashboard de indicadores (7 colunas + limiares 🟡/🔴), relatório do HERMES com markdown renderizado, marca d'água CONFIDENCIAL, autenticação via `?token=` para URL compartilhável
- Botão `🔗 Link do Cliente` na sidebar (visível para admin/analista): copia URL permanente com JWT embutido para o clipboard
- Role `cliente` passa a ser somente-leitura: sem Nova Sessão, sem KRATOS, sem exportação, sem exclusão de mensagens; banner "Modo leitura" no footer

---

## 8. CRONOLOGIA — O QUE DEU ERRADO (PARA NÃO REPETIR)

### 8.1. A Guerra de Instâncias Zod (Dual-Package Hazard)

**Sintoma:** Erro `tools.0.custom.input_schema.type: Field required` da API Anthropic.

**Causa:** O pacote `@olympus/tools` exportava schemas usando Zod. O pacote `@olympus/core` recebia esses schemas, mas a verificação `instanceof ZodObject` retornava `false` porque havia duas instâncias físicas do Zod no monorepo — o `instanceof` compara referências de objetos, não estrutura.

**Tentativas fracassadas:**
1. Usar Zod 3.25+ com Standard Schema (duck typing) — o erro persistiu
2. Implementar Schema Factory com injeção de `z` — funcionou brevemente, mas instável
3. Usar `ZodLike` / Proxy — workaround que foi descartado junto com toda a abordagem Zod

**Solução definitiva:** Abandonar Zod completamente no `Agent.ts`. Os schemas das ferramentas são **objetos JavaScript puros** em um dicionário estático `TOOL_JSON_SCHEMAS`, embrulhados em `jsonSchema()` da Vercel.

**Para o Drizzle ORM:** Mesmo problema — duas instâncias físicas do `drizzle-orm`. Solução: `peerDependencies` nos pacotes filhos + `overrides` no `package.json` raiz para forçar singleton.

### 8.2. Campo Errado: `parameters` vs `inputSchema`

**Sintoma:** Tool calling com `parameters: jsonSchema(schema)` não enviava `input_schema` para a Anthropic.

**Causa:** O adaptador `@ai-sdk/anthropic` lê `tool.inputSchema` para montar o payload. A função `tool()` da Vercel popula `parameters` mas deixa `inputSchema` undefined. São campos diferentes.

**Diagnóstico:** Inspecionando o código compilado do adaptador dentro do container:
```bash
docker exec olympus_api node -e "
const { tool, jsonSchema } = require('ai');
const t = tool({ description: 'test', parameters: jsonSchema({type:'object',properties:{}}), execute: async()=>{} });
console.log('inputSchema:', JSON.stringify(t.inputSchema)); // undefined
console.log('parameters:', JSON.stringify(t.parameters));  // preenchido
"
```

**Solução:** Injetar manualmente o `inputSchema` como função após criar o `tool()`:
```typescript
(myTool as any).inputSchema = () => jsonSchema(rawSchema as any);
// jsonSchema() retorna { _type, jsonSchema, validate } — o validate é passthrough
```

### 8.3. `maxSteps` silenciosamente ignorado no SDK v6

**Sintoma:** Ferramenta era invocada mas não havia síntese — `response.text` vazio, resposta de 33 caracteres.

**Causa:** No `ai@6.0.168`, `maxSteps` foi **removido** e substituído por `stopWhen: stepCountIs(N)`. O default é `stepCountIs(1)` — apenas 1 step, sem step de síntese.

**Solução:**
```typescript
// ERRADO (ignorado silenciosamente):
maxSteps: 10,

// CORRETO:
import { stepCountIs } from "ai";
stopWhen: stepCountIs(10),
```

### 8.4. `toolChoice: 'required'` bloqueando a síntese

**Sintoma:** Com `stopWhen` correto, o loop funcionava, mas `response.text` continuava vazio.

**Causa:** `toolChoice: 'required'` se aplica a **todos** os steps. Após o especialista retornar resultado, HERMES era forçado a chamar outra ferramenta em vez de sintetizar. Loop até o limite sem gerar texto.

**Solução:** Usar `prepareStep` para aplicar `'required'` apenas no step 0:
```typescript
prepareStep: async ({ stepNumber }) => ({
  toolChoice: stepNumber === 0 ? "required" : "auto",
}),
```

### 8.5. `inputSchema` com objeto bare (sem `validate`) quebrando o `execute`

**Sintoma:** `execute` nunca era invocado, mesmo com a ferramenta registrada.

**Causa:** O hack anterior retornava `() => ({ jsonSchema: rawSchema })` — objeto bare sem o método `validate`. O SDK chama `asSchema(tool.inputSchema)` e usa o resultado para validar args. Sem `validate`, a validação falha silenciosamente e `execute` nunca é chamado.

**Solução:** Retornar o resultado completo de `jsonSchema()`:
```typescript
// ERRADO:
(myTool as any).inputSchema = () => ({ jsonSchema: rawSchema });

// CORRETO:
(myTool as any).inputSchema = () => jsonSchema(rawSchema as any);
```

### 8.6. Prompt HERMES com instruções contraditórias

**Sintoma:** HERMES ignorava a obrigação de usar ferramentas e respondia diretamente.

**Causa:** O bloco `[INICIALIZAÇÃO DA SESSÃO]` continha `"NÃO USE FERRAMENTAS NA INICIALIZAÇÃO"` e vinha **depois** da regra `"SEMPRE invoque consultar_agente"`, sobrescrevendo-a. O LLM segue a instrução mais recente no prompt quando há conflito.

**Solução:** Reescrever o prompt com regra única, sem exceções, sem blocos contraditórios.

### 8.7. Histórico ilimitado encolhendo respostas a cada turno

**Sintoma:** Respostas de 5.000 caracteres na primeira mensagem → 2.000 → 500 → "Análise concluída."

**Causa:** `context.memory = body.messages.slice(0, -1)` enviava o histórico completo. Com análises longas (~8 mensagens de 5k caracteres cada), o contexto disponível para a síntese final ficava mínimo.

**Solução:** `.slice(0, -1).slice(-12)` — máximo de 12 mensagens no histórico enviado à API.

### 8.8. CMD do Dockerfile rodando `tsx` em vez do `dist/`

**Sintoma:** Após rebuild limpo, o erro `tools.0.custom.input_schema.type` voltava.

**Causa:** O `CMD` original rodava `npx tsx apps/api/src/index.ts` — o `tsx` interpretava o source em runtime, mas os pacotes internos (`@olympus/core`) eram resolvidos pelo `dist/` compilado. Qualquer inconsistência entre source e dist corrompía os schemas.

**Solução:**
```dockerfile
# ERA (desenvolvimento — não usar em produção):
CMD ["npx", "tsx", "apps/api/src/index.ts"]

# FICA (produção — sempre apontar para o dist compilado):
CMD ["node", "apps/api/dist/index.js"]
```

### 8.9. `.env` com variáveis concatenadas na mesma linha

**Sintoma:** TAVILY_API_KEY inválida — HTTP 403 no Tavily.

**Causa:** Variáveis separadas por `\n` literal ficavam na mesma linha do arquivo `.env`. O Node.js incluía as variáveis subsequentes como parte do valor da primeira.

**Diagnóstico:** `docker exec olympus_api sh -c "printenv | grep -i tavily"` — se mostrar mais de uma variável na mesma linha, o `.env` está malformado.

**Regra:**
```bash
# ERRADO (variáveis concatenadas):
TAVILY_API_KEY=tvly-xxx\nJWT_SECRET=yyy

# CORRETO (cada variável em sua linha):
TAVILY_API_KEY=tvly-xxx
JWT_SECRET=yyy
```

Após corrigir o `.env`, reiniciar sem rebuild: `docker compose down && docker compose up -d`

### 8.10. Nginx com timeout padrão de 60s

**Sintoma:** HTTP 504 Gateway Timeout em análises completas. Logs da API mostravam resposta gerada com sucesso (~97s), mas o cliente recebia 504.

**Causa:** `proxy_read_timeout` padrão do Nginx é 60s. Análises com múltiplas buscas Tavily levam ~97s.

**Solução:** Adicionar explicitamente no bloco `/api/` do `nginx.conf`:
```nginx
proxy_read_timeout 300s;
proxy_connect_timeout 300s;
proxy_send_timeout 300s;
```

### 8.11. maxTokens insuficiente truncando respostas

**Sintoma:** Agentes executavam buscas (HTTP 200 no Tavily), mas entregavam frases de desculpa em vez de relatórios.

**Causa:** Com 4 buscas gerando ~8k tokens de contexto, `maxTokens: 4096` não tinha espaço para escrever a síntese final.

**Solução:**
```typescript
const maxTokens =
  vizMode === "thinking" ? 32000
  : vizMode === "passagem" ? 16000
  : 32000;  // etapa e demais modos
```

---

## 9. ⛔ REGRAS CRÍTICAS — NUNCA VIOLAR

### 9.1. Zod não entra no Agent.ts

O `Agent.ts` **não usa Zod** para construir schemas de ferramentas. Isso é uma decisão arquitetural definitiva, não omissão.

**Rejeite imediatamente qualquer sugestão de:**

| Sugestão a recusar | Por que falha |
|---|---|
| `parameters: z.object({...})` | `instanceof` falha entre pacotes no monorepo |
| `parameters: t.schema(z)` (Schema Factory) | Ainda depende de Zod; instável com v3.25+ e v4 |
| Proxy `~standard` em cima de schema Zod | Workaround de Zod — desnecessário |
| `inputSchema: jsonSchema(...)` em vez de `parameters` | Quebra o loop `stopWhen` da Vercel |
| `inputSchema: { type: "object", ... }` (JSON bare) | `asSchema()` da Vercel rejeita JSON sem wrapper |
| `maxSteps: N` | Ignorado silenciosamente no SDK v6 — usar `stopWhen: stepCountIs(N)` |
| `toolChoice: 'required'` sem `prepareStep` | Bloqueia síntese em todos os steps |

**✅ Único padrão correto para schemas de ferramentas:**
```typescript
parameters: jsonSchema(OBJETO_JS_PURO as any)
// + após criar o tool():
(myTool as any).inputSchema = () => jsonSchema(rawSchema as any);
```

### 9.2. Prompt do HERMES — regra de ouro

**Nunca adicionar blocos que isentem o HERMES de usar ferramentas.** Qualquer instrução do tipo "neste caso não use ferramentas" conflita com a regra absoluta e o LLM seguirá a exceção. Se precisar de comportamento diferenciado por contexto, usar `prepareStep` no SDK — não o prompt.

### 9.3. CMD em produção sempre aponta para `dist/`

```dockerfile
# PRODUÇÃO (correto):
CMD ["node", "apps/api/dist/index.js"]

# DESENVOLVIMENTO (apenas local, nunca no Dockerfile):
CMD ["npx", "tsx", "apps/api/src/index.ts"]
```

---

## 10. TEMPLATE CANÔNICO PARA NOVAS FERRAMENTAS

**⚠️ Regra de build do monorepo:** O Dockerfile compila na ordem `core → tools → db → api`. Portanto, `packages/tools` **não pode importar** `@olympus/db`. Ferramentas que precisam de acesso ao banco (ex: `ragTool`) devem ficar em `apps/api/src/tools/` onde `@olympus/db` já está compilado.

**Passo 1:** Definir a lógica em `packages/tools/src/` (sem dependência de `@olympus/db`) ou em `apps/api/src/tools/` (com banco):
```typescript
export const minhaFerramenta = {
  name: "minha_ferramenta",
  description: "Descrição clara do que a ferramenta faz.",
  execute: async (args: { parametro: string }, context: any): Promise<string> => {
    return resultado;
  },
};
```

**Passo 2:** Registrar o schema puro no dicionário `TOOL_JSON_SCHEMAS` em `packages/core/src/Agent.ts`:
```typescript
const TOOL_JSON_SCHEMAS: Record<string, object> = {
  minha_ferramenta: {
    type: "object",
    properties: {
      parametro: { type: "string", description: "Descrição do parâmetro" }
    },
    required: ["parametro"]
  }
};
```

**Passo 3:** Rebuild obrigatório após alterar `packages/core`:
```bash
docker compose build --no-cache api
docker compose up -d
```

---

## 11. GUIA OPERACIONAL

### 11.1. Fluxo Normal de Rebuild

Sempre que alterar código em `packages/core/`, `packages/db/`, `packages/tools/` ou `apps/api/`:
```bash
docker compose build --no-cache api
docker compose up -d
docker compose logs -f api   # verificar saúde
```

Para alterar apenas o frontend (`apps/web/`):
```bash
docker compose build --no-cache web
docker compose up -d
```

### 11.2. Reset Nuclear (quando ambiente está "fantasma")

```bash
# 1. Zerar tudo
wsl --shutdown
docker compose down -v --rmi all
docker system prune -a -f --volumes

# 2. Reinstalar dependências
npm install

# 3. Build e subida completa
docker compose build --no-cache
docker compose up -d

# 4. OBRIGATÓRIO após -v: criar extensão vector e aplicar schema
#    (drizzle-kit lê DATABASE_URL do .env automaticamente)
docker exec olympus_db psql -U postgres -d olympus -c "CREATE EXTENSION IF NOT EXISTS vector;"
cd packages/db
npx drizzle-kit push
cd ../..

# 5. OPCIONAL — repovoar banco com agentes e metodologias via seed.ts
#    (só necessário se quiser os prompts completos ANTES da primeira requisição)
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:5432/olympus"
npx tsx apps/api/src/scripts/seed.ts

# 6. Verificar saúde
docker compose logs -f api
```

**⚠️ Armadilhas do reset nuclear:**

| Erro | Causa | Solução |
|---|---|---|
| `relation "projects" does not exist` | Schema não aplicado após `-v` | Rodar passo 4 |
| `error: unknown command 'push'` | Versão antiga do drizzle-kit | Atualizar para `^0.31.10` — o comando é `push` (sem `:pg`) |
| `type "vector(512)" does not exist` | Extensão pgvector não criada antes do push | Rodar `docker exec olympus_db psql -U postgres -d olympus -c "CREATE EXTENSION IF NOT EXISTS vector;"` antes do push |
| DATABASE_URL usa `olympus_db` como host | Hostname Docker só funciona dentro do container | drizzle-kit lê do `.env` (já configurado com `localhost`) |
| Comportamento fantasma após rebuild | `CMD` rodando `tsx` em vez do `dist/` | Ver seção 9.3 |
| Build duplo desnecessário | Rodar `build api` depois de `build --no-cache` | `--no-cache` já inclui tudo |
| `ECONNREFUSED 172.x.x.x:5432` no startup da API | Race condition: API sobe antes do Postgres estar pronto | Corrigido no `index.ts` com retry automático (10x, 3s entre tentativas) |

**Nota sobre seed vs auto-seed:**
- O `getOrSeedMethodology()` no `chat.ts` faz um auto-seed mínimo na **primeira requisição** ao chat. Isso é suficiente para o sistema funcionar.
- O `apps/api/src/scripts/seed.ts` contém prompts mais completos e ricos para os 7 agentes + 7 metodologias. Use-o após limpezas de produção para garantir o estado completo do banco antes de qualquer uso.
- **O auto-seed SOBRESCREVE os prompts do banco a cada requisição** (para garantir que o código seja sempre a fonte da verdade). Se quiser prompts customizados persistentes, desative a linha `await db.update(agentsTable).set(...)` em `chat.ts`.

### 11.2.1. Limpeza Simples (sem apagar volume do banco)

Quando só precisa reconstruir a imagem (ex: mudanças de código), sem perder dados:

```bash
# Para apenas a API, reconstrói e reinicia — banco intacto
docker compose stop api
docker compose build --no-cache api
docker compose up -d api
docker compose logs -f api
```

**Atenção:** `docker compose down` (sem `-v`) preserva volumes. `docker system prune -f` (sem `--volumes`) também preserva volumes. O banco só é perdido com `-v` ou `--volumes`.

### 11.3. Ambiente de Desenvolvimento Local (sem Docker)

```bash
# 1. Instalar dependências
npm install

# 2. Aplicar schema no banco local (Postgres em localhost ou Neon)
npm run db:push

# 3. Backend (terminal 1)
npm run dev --workspace=apps/api

# 4. Frontend (terminal 2)
npm run dev --workspace=apps/web

# Acesso: http://localhost:5173
```

### 11.4. Configuração WSL2 (importante para build)

Criar `%USERPROFILE%\.wslconfig`:
```ini
[wsl2]
memory=8GB
processors=4
swap=2GB
```

Se o Docker travar com `input/output error` ou `EOF` durante o build: `wsl --shutdown` + *Clean/Purge data* (WSL 2 disk image) nas configurações de Troubleshooting do Docker Desktop.

---

## 12. BACKLOG ATUALIZADO

### ✅ Concluído

| Item | Descrição |
|---|---|
| A2 | Web search nos agentes via Tavily — KLIO e KRATOS com dados reais |
| A3 | Upload ampliado: PDF, DOCX, TXT, imagens (OCR), CSV, JSON |
| B1 | Agentes reais com tool_use — `consultar_agente` + `web_search` via SDK |
| B3 | Monitoramento automático KRATOS — cron via KRONOS + fila com cooldown |
| B4 | Painel cliente com extração automática de cenário e indicadores |
| B5 | Autenticação JWT com roles (`admin`, `analista`, `cliente`) + 2FA (TOTP) |
| — | Motor Dinâmico de Metodologias — agentes e prompts via banco de dados |
| — | Integração nativa por e-mail (Nodemailer) para alertas KRATOS |
| — | Módulo de Backup Corporativo (`pg_dump` → `.sql.gz`) |
| — | Exportação DOCX com markdown inline (bold, italic, code) |
| — | Exportação por mensagem individual (inline DOCX + PDF) |
| — | Relatório Padrão: localiza automaticamente o "RELATÓRIO FINAL PADRÃO" do HERMES |
| — | Relatório Estendido: exporta todas as mensagens de agentes (PDF) |
| — | Exclusão de mensagem individual com confirmação + deleção no banco |
| — | Histórico de análises com data e hora |
| — | Modal de Nova Sessão com 6 campos de escopo + upload de contexto |
| — | Tela de boas-vindas no estado vazio |
| — | Login sempre obrigatório (sem auto-login por localStorage) |
| — | Prompt HERMES: ao concluir análise, instrui Nova Sessão e KRATOS |
| — | Validação de existência do usuário no JWT (evita login com token antigo) |
| — | KRONOS: fila assíncrona com cooldown de 15s entre execuções |
| — | Varredura e limpeza do código: 36 arquivos mortos/debug removidos |
| — | Bug Agent.ts: assinatura com `.` (ponto) em vez de `·` (ponto médio) corrigida |
| — | Metodologia hardcoded `'MSEF'` em chat.ts removida — agora usa `body.metodologia` |
| — | `types.ts`: union type fixo de metodologias substituído por `string` (suporta motor dinâmico) |
| — | `carregarSessao`: mapeamento incorreto `s.horizonte`/`s.elaborador` corrigido para `s.horizon`/`s.analyst` |
| — | `backup.ts`: adicionada verificação de role admin (falha de segurança) |
| — | `index.ts`: middleware duplicado consolidado em array `PROTECTED_PREFIXES` |
| — | `index.ts`: race condition startup DB→API corrigida com retry automático (10×, 3s) |
| — | Endpoint duplicado `/api/v1/methodologies` removido — usar `/api/v1/engine/methodologies` |
| — | Seletor de metodologia nos modais Nova Sessão e Configurações — carrega do banco, persiste no PATCH |
| — | `BackupModal` para admins — lista, gera e baixa backups; botão na sidebar |
| — | SSE streaming no chat — rota `/api/v1/chat/stream`; frontend mostra agente ativo em tempo real |
| — | `backup.ts`: endpoint `GET /download/:filename` para baixar `.sql.gz` com auth |
| — | XLSX/XLS adicionados ao file picker (já suportados pelo extract.ts via SheetJS) |
| — | Reiniciar fase: após excluir mensagem do assistente, oferece reexecutar com a mesma entrada |
| — | `chat.ts` refatorado — lógica extraída para `runAnalysis()` compartilhada entre rota síncrona e SSE |
| — | Conectores de dados abertos: tool `buscar_dados_publicos` com BCB/SGS (SELIC, IPCA, câmbio, IGP-M, CDI, reservas, IBC-Br) e IBGE (desemprego PNAD, PIB trimestral/anual) |
| — | KRATOS: `buscar_dados_publicos` adicionada ao toolsConfig — dados oficiais BCB/IBGE prioritários sobre web_search |
| — | Provider Factory em `Agent.ts`: `getModel()` lê `LLM_PROVIDER` do env; ponto único de expansão para futuros providers |
| — | Dashboard de indicadores KRATOS inline: painel com badges verde/amarelo/vermelho, carregados de `/api/v1/indicators/project/:id` |
| — | Busca de sessões: campo de pesquisa filtra o histórico em tempo real (sidebar) |
| — | Botão "📋 Copiar" em cada bubble de agente (`navigator.clipboard.writeText`) |
| — | Logs de debug temporários do Tavily removidos |

### ✅ Sprint 5 — Concluído + Pré-rebuild (25 Abr 2026)

| Item | Descrição |
|---|---|
| **IPEA + DOU + Comex Stat + Orgs Internacionais** | `buscar_dados_publicos` ampliada: IPEA Data (5 séries), Comex Stat MDic, DOU Seção 1 (INLABS). Internacionais: Banco Mundial (11), FMI/WEO (6, inclui previsões*), OMS/WHO GHO (4), ONU Population (2), IBGE Países (3: perfil + turistas + educação), ITU DataHub (5: internet, celular, banda larga fixa/móvel, IDI). Parâmetros `pais` (ISO3, padrão BRA) e `termo_dou`. Tabela ISO3→ISO2 (50+ países) compartilhada por IBGE Países e ITU. Auth Bearer ITU com cache 6h (padrão INLABS). **Total: 51 indicadores, 9 fontes.** Constraint de build: ferramentas que importam `@olympus/db` vivem em `apps/api/src/tools/` (não em `packages/tools/`). |
| **pgvector RAG** | Banco vetorial: `pgvector/pgvector:pg15` no Docker, tabela `embeddings` (Voyage AI voyage-3-lite, 512 dims), tool `buscar_documentos_internos`, auto-indexing no upload (`/api/v1/extract` com `projectId`), rota `/api/v1/embeddings/` (index/delete/count). SCOPUS e KLIO com a nova tool. |
| **Token streaming real** | `streamText` no `Agent.ts` quando `context.onToken` está definido; propagação via `AnalysisCallbacks.onToken`; SSE emite `{type:'token', text:delta}`; frontend acumula em `streamingText` e exibe bolha HERMES com cursor piscante enquanto tokens chegam. |
| **Dashboard KRATOS enriquecido** | Barra de proporção verde/amarelo/vermelho; cards ordenados por severidade; threshold amarelo/vermelho exibidos; `lastCheckedAt` formatado; alerta com contagem exata. Somente App.tsx — sem nova dependência. |
| **API pública (Swagger)** | `@hono/swagger-ui` instalado. Rota `GET /api/docs` serve Swagger UI; `GET /api/docs/openapi.json` retorna spec OpenAPI 3.0.3 com todos os endpoints documentados (Auth · Sessions · Chat · Indicators · Embeddings · Extract · Users · Engine · Backup). Rota pública — sem JWT. |
| **drizzle-kit** `0.20.18` → `0.31.10` · **drizzle-orm** `0.30.10` → `0.45.2` | Eliminou workaround de comentar `embeddings` no schema. `drizzle.config.ts`: `driver:"pg"` → `dialect:"postgresql"`, `connectionString` → `url`. Comandos: `push` (sem `:pg`). |

### ✅ Sprint 6 — Concluído (25 Abr 2026)

| Item | Descrição |
|---|---|
| **Prompts MSEF v2** | Todos os 7 agentes reescritos com estrutura metodológica completa: HERMES com fluxo explícito de 7 etapas e instrução de Relatório Final Padrão; SCOPUS com Ficha de Escopo completa (8 campos); KLIO com análise PESTEL + Matriz Impacto×Incerteza; PYTHIA com Etapas 3-4 (incertezas → eixos → Matriz 2×2 → Q1-Q4 com probabilidades); MNEMOSYNE com 7 componentes por cenário (logline, trajetória, Wild Cards, mín. 400 palavras); THEMIS com implicações × dimensão, hedges vs bets, tabela de alertas precoces; KRATOS com formato de Relatório de Acompanhamento padronizado e semáforo. |
| **`buscar_dados_publicos` completo** | `TOOL_JSON_SCHEMAS` em `Agent.ts` atualizado com todos os 51 indicadores + parâmetros `pais` (ISO3) e `termo_dou`. Adicionado schema de `buscar_documentos_internos`. Removido enum fixo de `agent_name` no `consultar_agente` (agora aceita qualquer string para suportar HERMES_GRUMBACH, HERMES_GODET). |
| **Metodologias GRUMBACH e GODET** | `seed.ts` ampliado com agentes orquestradores dedicados: `HERMES_GRUMBACH` (4 fases: Conjuntura → Variáveis → Cenários Tendencial/Pessimista/Otimista → Estratégias) e `HERMES_GODET` (5 fases: MICMAC → MACTOR → Morfologia → Probabilidades SMIC → Opções Estratégicas). Metodologias GRUMBACH e GODET apontam para os novos orquestradores. Todas as 7 metodologias têm `agentsConfig` revisado. |
| **Painel do Cliente v2** | Nova rota `GET /api/v1/painel/project/:id` em `painel.ts`: autenticada via JWT (header ou `?token=` query param para URL compartilhável), lê projeto + indicadores + última mensagem HERMES direto do banco, renderiza HTML completo com Dashboard de Indicadores (7 colunas, limiares 🟡/🔴), Relatório Estratégico com renderização markdown e botão imprimir, marca d'água CONFIDENCIAL. |
| **Botão "Link do Cliente"** | Sidebar do App.tsx: botão `🔗 Link do Cliente` (visível para admin/analista quando há projeto ativo) copia URL `<origin>/api/v1/painel/project/<id>?token=<jwt>` para o clipboard — link permanente e autenticado para o cliente. |
| **Role `cliente` — modo leitura** | App.tsx: usuários com `role: cliente` veem tela de boas-vindas adaptada, sem botão Nova Sessão, sem Painel KRATOS, sem Gerar Relatório, sem Exportar, sem botão Excluir em mensagens. Footer substituído por banner "Modo leitura". |

### Sprint 7 — Railway Deploy + PoC Presencial (Maio 2026)
- `nginx.conf` refatorado: `proxy_pass ${RAILWAY_API_URL}/api/` — URL injetada por envsubst no startup do container web
- `Dockerfile.api`: `node:20-slim` + HEALTHCHECK nativo (node one-liner sem dependências extra)
- `Dockerfile.web`: CMD executa envsubst antes de nginx; fallback `http://api:3333` para Docker local
- `docker-compose.yml` reescrito: imagens explícitas (`olympus/api:latest`, `olympus/web:latest`), postgres healthcheck `pg_isready`, API com `depends_on: condition: service_healthy`
- `railway.toml` criado: `builder=DOCKERFILE`, `dockerfilePath=Dockerfile.api`, `healthcheckPath=/ping`, timeout 300s
- `.env.railway.example` criado: template com 13 variáveis anotadas (DATABASE_URL e PORT injetados automaticamente pelo Railway)
- `RAILWAY_DEPLOY.md` criado: guia 8 passos — Railway project → Postgres addon → serviço API → serviço Web → CORS → seed → domínio → teste
- `scripts/poc-offline/build-offline.ps1`: builder na máquina do analista — `docker compose build` → `docker save` das 3 imagens → `dist-poc\olympus-poc.tar`
- `scripts/poc-offline/docker-compose.offline.yml`: Compose sem build, `restart: unless-stopped`, `RAILWAY_API_URL=http://api:3333`
- `scripts/poc-offline/instalar.ps1`: instalador Windows 6 etapas — verifica Docker, tar, .env; `docker load`; `docker compose up -d`; health check 20×3s; abre navegador
- `scripts/poc-offline/GUIA_POC.md`: guia end-user — Docker Desktop único pré-requisito, 3 passos, troubleshooting
- `ARCHITECTURE.html` criado: mapa visual completo (11 seções, sidebar TOC, flow diagrams, schema cards, route table, regras críticas)
- `AGENT_CONTEXT.json` criado: contexto machine-readable para o próximo agente (stack, schemas, rotas, padrões, backlog)

### ✅ Sprint 8 — ICD 203 · TechniqueEngine · NATO AltA · Step Streaming (19 Mai 2026)

| Item | Descrição |
|---|---|
| **ICD 203 — Padrões Analíticos** | 3 novas tools ICD 203/ODNI 2022 em `Agent.ts` + `chat.ts`: `declarar_julgamento` (grau de probabilidade padronizado + nível de confiança + indicadores de alteração + premissa linchpin), `registrar_hipotese_alternativa` (hipótese principal + alternativas com probabilidade e pontos fracos + racional de rejeição), `avaliar_fonte` (URL + tipo + fidelidade ao documento + possibilidade NeD + credibilidade). Schemas JSON puros, sem Zod. |
| **HERMES_REVISOR + `analytic_reviews`** | Agente `HERMES_REVISOR` dedicado a revisão de qualidade analítica (McMahon 2024). Tabela `analytic_reviews` (Drizzle): `sessionId`, `status` (aprovado / aprovado_com_ressalvas / requer_revisao / nao_revisado), `atsCompliance` (JSONB com score por padrão ATS), `notasRevisor`, `declaracaoPropriedade`, `reviewerName`, `reviewedAt`. Rota `POST /api/v1/analytic-review`. Modal de Revisão Analítica no App.tsx (botão ⚖️ na barra de ferramentas). |
| **TechniqueEngine** | `apps/api/src/tools/technique-engine.ts`: motor de injeção dinâmica de técnicas SAT (Structured Analytic Techniques) em prompts de agentes. `getTechniqueInstructions(names[])` busca na tabela `techniques` e retorna bloco de prompt com instruções passo a passo. `getAltATechniquesForSeed()` exporta os 12 objetos para seed. Constraint: localizado em `apps/api/src/tools/` (importa `@olympus/db`). |
| **NATO Alternative Analysis (AltA)** | Metodologia completa da *NATO AltA Handbook* (2017, 137 páginas) integrada ao seed. 12 técnicas SAT categorizadas: Estruturação (Identificação de Premissas-Chave, PMI, Verificação de Qualidade da Informação, Cinco Porquês), Criativas (Análise E-Se, Futuros Alternos, Pensamento de Fora para Dentro), Diagnóstico (SWOT, Adversário Substituto), Desafio (Advocacia do Diabo, Análise Pré-Mortem, Time A/Time B). 5 agentes AltA: `HERMES_ALTA` (orquestrador 4 fases: Iniciação → Preparação → Aplicação → Encerramento), `SCOPUS`, `KLIO`, `PYTHIA`, `THEMIS` com prompts AltA-específicos. Metodologia `'ALTA'` com categoria `'Análise Alternativa'`. |
| **Streaming de Etapas do Raciocínio** | `AgentContext.onStep?: (msg: string) => void` adicionado em `types.ts`. `Agent.ts`: `onStepFinish` em `sharedParams` do Vercel AI SDK v6 — emite mensagem de progresso após cada step: tool call (com ícone e resumo de args) ou texto (`💭 Sintetizando resposta...`). `TOOL_ICONS` + `stepLabel()` para 10 ferramentas. SSE emite `{type:'step', text:msg}`. Frontend: `stepLog: string[]` (últimas 7 entradas), renderizado com opacidade progressiva (0.5→1.0) abaixo do spinner. O usuário vê em tempo real: `🌐 Buscando: "..."`, `📊 Dados: selic, ipca`, `🤖 Consultando SCOPUS...`, etc. |
| **JSX Fragment fix** | `return (...)` do componente principal do App.tsx envolvia apenas `<div className="flex h-screen...">`, enquanto o Modal de Revisão Analítica estava como sibling fora do div. Corrigido envolvendo tudo em `<>...</>` (React Fragment). |

**Arquivos modificados no Sprint 8:**
- `packages/core/src/types.ts` — `onStep` adicionado ao `AgentContext`
- `packages/core/src/Agent.ts` — `TOOL_ICONS`, `stepLabel()`, `onStepFinish` em `sharedParams`
- `apps/api/src/tools/technique-engine.ts` — **arquivo novo** — TechniqueEngine com 12 técnicas AltA
- `apps/api/src/routes/chat.ts` — seed AltA (5 agentes + 12 técnicas), TechniqueEngine na montagem de agentes, `onStep` no contexto, SSE `{type:'step'}`
- `apps/web/src/App.tsx` — `stepLog` state, handler `type:'step'`, bloco de progresso dinâmico, Fragment fix

### ✅ Sprint 9 — Provider Factory Ollama · LLM Selector · Stepper Dinâmico (Maio 2026)

| Item | Descrição |
|---|---|
| **Provider Factory Ollama** | `getModel()` em `Agent.ts` lê `LLM_PROVIDER` do env: `'anthropic'` (padrão) ou `'ollama'`. Ollama usa `@ai-sdk/openai` com `createOpenAI({ baseURL: OLLAMA_BASE_URL, apiKey: 'ollama' })` — compatível com `/v1/chat/completions`. **Ponto único de expansão para provedores futuros.** |
| **Seletor LLM em runtime** | `CommandBar.tsx`: `LlmSelector` dropdown com seção Anthropic (modelos do banco) e seção Ollama (modelos carregados via `GET /api/v1/settings` → proxy `ollama/api/tags`). Troca de provider sem restart — PATCH /api/v1/settings/llm grava em `platform_settings`. |
| **Stepper dinâmico** | `App.tsx`: passos exibidos no stepper lidos de `agentsConfig.steps` retornado pelo Motor Dinâmico; fallback para `methodologySteps.ts` estático quando `steps` não está presente. Elimina divergência de exibição para MSEF e GODET. |
| **Modelos Anthropic no banco** | `index.ts` startup: `platform_settings` `anthropic_models` inicializada com `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` via `onConflictDoNothing`. |
| **GODET rapport separado** | Parser de `isHermes()` e patterns de relatório atualizados para reconhecer `RAPPORT PROSPECTIF GODET` como relatório final separado do MSEF. Evita mistura de formatos na exportação. |
| **alertEmails TS fix** | Tipo de `alertEmails` corrigido em `schema.ts` e nos handlers KRATOS/KRONOS — era `string[]` no código mas `text` no banco; unificado para `string` (CSV de emails). |

**Arquivos modificados no Sprint 9:**
- `packages/core/src/Agent.ts` — `getModel()` Provider Factory
- `apps/api/src/routes/settings.ts` — `ollamaModels` via proxy, PATCH /settings/llm
- `apps/api/src/index.ts` — `platform_settings` inicializada com `anthropic_models`
- `apps/web/src/components/layout/CommandBar.tsx` — `LlmSelector` com Anthropic + Ollama
- `apps/web/src/App.tsx` — stepper dinâmico por metodologia
- `apps/api/src/routes/sessions.ts` / `cron.ts` / `kratos.ts` — fix alertEmails TS

### ✅ Sprint 10 — Dados Globais · Playbook · Audit · Rate Limit · Hardening Ollama · PoC (23 Mai 2026)

| Item | Descrição |
|---|---|
| **FRED + Legislativo BR** | `dados-publicos.ts` ampliada: **FRED** (Federal Reserve EUA) — 8 séries (`federal_funds_rate`, `us_gdp`, `us_cpi`, `us_unemployment`, `us_10y_treasury`, `dxy_index`, `us_trade_balance`, `china_gdp_growth`); **Câmara dos Deputados** — proposições e votações recentes (API aberta, sem chave); **Senado Federal** — votações plenárias recentes (API aberta, sem chave). `FRED_API_KEY` opcional no `.env`. Total passa de 51 para ~62 indicadores disponíveis. |
| **Histórico de indicadores + Sparkline** | `schema.ts`: coluna `valueHistory jsonb DEFAULT '[]'` adicionada a `indicators`. `indicators.ts`: `appendHistory()` — append incremental com prune automático de entradas >90 dias. `KratosPanel.tsx`: componente `Sparkline` SVG (polyline min-max normalizado); `IndicadorRow` com expand/collapse (tabela de histórico + sparkline ampliado ao clicar). |
| **Auto-registro de sinais** | `indicators.ts`: `autoRegisterSignal()` — quando status do indicador muda para `amarelo` ou `vermelho`, um sinal fraco é criado automaticamente em `weakSignals` com tipo adequado e ação recomendada. Deduplicação por `titulo + projectId` evita duplicatas em execuções consecutivas do KRATOS. |
| **Filtro classificação em sinais** | `KratosPanel.tsx`: chips de filtro `confirmavel` / `ambiguo` / `ruido` além do filtro existente de `statusRadar`. Filtros são independentes e combináveis. |
| **Playbook DOCX** | `routes/playbook.ts` (arquivo novo): `POST /api/v1/playbook/gerar` — gera DOCX completo com capa (metadados do projeto), fases metodológicas, síntese da última análise HERMES (primeiros 3k chars), tabela de indicadores com status colorido, tabela de sinais fracos, recomendações estratégicas. `CommandBar.tsx`: botão **📘 Playbook** visível apenas para `role: admin`. |
| **Logs de auditoria** | `schema.ts`: tabela `audit_logs` (append-only, imutável). `utils/audit.ts`: `logAudit()` — helper com try/catch silencioso (falha não bloqueia fluxo principal). `routes/audit.ts`: `GET /api/v1/audit` (filtros: userId, action, resourceType, from, to, limit, offset) + `GET /api/v1/audit/stats` (contagem por ação). `auth.ts`: evento `login` registrado no audit. |
| **JWT_EXPIRY configurável** | `auth.ts`: `jwtExpirySeconds()` lê env `JWT_EXPIRY` (formatos: `1h`, `4h`, `8h`, `24h`, `7d`; padrão `8h`). Clientes de defesa podem usar `24h` para sessões diárias sem re-login. |
| **Marca d'água nos exports** | `export.ts`: CSS `.watermark { position:fixed; rotate(-45deg); opacity:0.06; font-size:110px }` injetado no HTML/PDF. Texto é a `classificacao` do projeto (ex: `CONFIDENCIAL`); `@media print` mantém o watermark na impressão. |
| **Rate limiting em memória** | `middleware/rateLimit.ts` (arquivo novo): bucket in-memory por `userId` (fallback IP); 5 análises/hora (`/api/v1/chat/*`) + 10 exportações/hora (`/api/v1/export/*`); limpeza periódica a cada 5 min. Adequado para instância única — nota de refatoração futura para Redis em multi-instância. |
| **Health endpoint** | `index.ts`: `GET /health` (público, sem JWT) — retorna `{ status, database, anthropic, tavily, llm, version, uptime, latencyMs, timestamp }`. Usado por Railway health checks e monitoramento externo. |
| **Seed de demonstração** | `scripts/seed-demo.ts` (arquivo novo): cria usuário `demo@stratsight.com.br / OlympusDemo2026!`, projeto `sess_demo_msef_2026` (CEEx · MSEF · 2030), análise MSEF pré-carregada (4 cenários com probabilidades), 5 indicadores com thresholds (2 amarelo, 1 vermelho), 3 sinais fracos. Idempotente. |
| **Fix pgvector NOTICE** | `packages/db/src/db.ts`: `onnotice: () => {}` no cliente postgres.js. Suprime mensagens NOTICE do PostgreSQL (pgvector "extension already exists, skipping") que eram impressas como JSON nos logs do container — visual confuso na inicialização. |
| **Fix Ollama Headers Timeout** | `apps/api/src/index.ts`: `setGlobalDispatcher(new Agent({headersTimeout:15min, bodyTimeout:30min}))` via `undici` no topo do arquivo, antes de qualquer import. Corrige `UND_ERR_HEADERS_TIMEOUT` que ocorria quando o modelo Llama precisava de >30s para carregar na memória antes de enviar o primeiro byte de resposta. **Causa raiz:** Em Node.js 20, `globalThis.fetch` usa o mesmo módulo undici interno — `setGlobalDispatcher` de `npm undici` afeta ambos. Complementado por Ollama pre-warm no startup: `POST /api/generate` com `keep_alive:-1` carrega o modelo na GPU/RAM antes da primeira requisição de usuário. |

**Arquivos modificados no Sprint 10:**
- `packages/tools/src/dados-publicos.ts` — `fetchFRED()`, `fetchCamara()`, `fetchSenado()`, 11 novos indicadores em `ALL_INDICATORS` e `execute()`
- `packages/db/src/schema.ts` — `valueHistory` em `indicators`; tabela `audit_logs`; export de `AuditLog`/`NewAuditLog`
- `packages/db/src/db.ts` — `onnotice: () => {}`
- `apps/api/src/routes/indicators.ts` — `HistoryEntry`, `appendHistory()`, `autoRegisterSignal()`
- `apps/api/src/routes/playbook.ts` — **arquivo novo** — `buildPlaybookDocx()` + rota POST /gerar
- `apps/api/src/routes/audit.ts` — **arquivo novo** — GET /audit, GET /audit/stats
- `apps/api/src/utils/audit.ts` — **arquivo novo** — `logAudit()` helper
- `apps/api/src/middleware/rateLimit.ts` — **arquivo novo** — `rateLimitAnalysis`, `rateLimitExport`
- `apps/api/src/scripts/seed-demo.ts` — **arquivo novo** — seed idempotente para PoC
- `apps/api/src/routes/auth.ts` — `jwtExpirySeconds()`, `logAudit` no login
- `apps/api/src/routes/export.ts` — `.watermark` CSS + div no `buildHtml()`
- `apps/api/src/index.ts` — `setGlobalDispatcher`, pre-warm Ollama, `GET /health`, rate limit middleware, rotas audit/playbook, `PROTECTED_PREFIXES` atualizado
- `apps/api/package.json` — `"undici": "^6.21.2"` adicionado às dependências
- `apps/web/src/components/layout/KratosPanel.tsx` — `Sparkline`, `IndicadorRow`, `classifFilter`
- `apps/web/src/components/layout/CommandBar.tsx` — `onGerarPlaybook` prop + botão Playbook
- `apps/web/src/App.tsx` — `gerarPlaybook()` function, `onGerarPlaybook` passado ao CommandBar

---

### ⛔ BLOQUEADORES — Caminho Crítico para o Primeiro Contrato

| # | Item | Status | Próxima ação |
|---|---|---|---|
| **#1** | **Deploy Railway (C2)** — athena.stratsight.com.br | 🟡 Infraestrutura pronta | Criar conta Railway, executar 8 passos do `RAILWAY_DEPLOY.md` |
| **#2** | **PoC Presencial (A4 adaptado)** — USB autocontido | 🟡 Scripts prontos | Rodar `build-offline.ps1` na máquina com Docker para gerar `dist-poc\olympus-poc.tar` |

**O que foi feito no Sprint 7 (infraestrutura de deploy):**
- `nginx.conf` suporta `${RAILWAY_API_URL}` via envsubst — mesma imagem funciona local e no Railway
- `Dockerfile.api` usa `node:20-slim` + HEALTHCHECK nativo em `node -e` (sem dependências extras)
- `Dockerfile.web` executa envsubst no CMD antes de iniciar nginx — injeção de URL em runtime
- `docker-compose.yml` tem tags de imagem explícitas (`olympus/api:latest`, `olympus/web:latest`) para `docker save`
- `postgres` com healthcheck `pg_isready`; API com `depends_on: condition: service_healthy` — elimina race condition
- `railway.toml` — deploy automático do serviço API a partir do Dockerfile.api
- `.env.railway.example` — template comentado com todas as 13 variáveis necessárias
- `RAILWAY_DEPLOY.md` — guia 8 passos do zero ao domínio próprio (athena.stratsight.com.br)
- `scripts/poc-offline/build-offline.ps1` — gera pacote USB (`docker save` das 3 imagens em 1 tar)
- `scripts/poc-offline/docker-compose.offline.yml` — sem build, usa imagens pré-carregadas
- `scripts/poc-offline/instalar.ps1` — instalador Windows 6 passos com health check automático
- `scripts/poc-offline/GUIA_POC.md` — guia de instalação para o cliente (Docker Desktop único pré-req)
- `ARCHITECTURE.html` — mapa visual completo do sistema (11 seções, sidebar TOC)
- `AGENT_CONTEXT.json` — contexto machine-readable para agente futuro trabalhando nova feature

**Protocolo caminho crítico (8 semanas):**
- **Sem 1–2:** Executar deploy Railway — URL pública + análise MSEF completa em produção
- **Sem 2–3:** Rodar `build-offline.ps1` → gerar USB → testar instalação em máquina limpa
- **Sem 3–5:** Primeira PoC formal — CEEx ou CIE — relatório entregue + NPS ≥ 8
- **Sem 5–8:** Pipeline para primeiro contrato (R$ 60K–120K)

### ✅ Sprints 9–10 — Concluídos (adicionados ao backlog)

| Item | Concluído em |
|---|---|
| **FRED API + Legislativo BR** | Sprint 10 |
| **Ollama Local (A5 antecipado)** | Sprint 9 |
| **Playbook Automatizado (C3)** | Sprint 10 |
| **Dashboard Gráficos KRATOS** | Sprint 10 (Sparkline SVG inline) |
| **Audit logs + Rate limiting** | Sprint 10 |
| **Marca d'água nos exports** | Sprint 10 |
| **JWT_EXPIRY configurável** | Sprint 10 |
| **Health endpoint** | Sprint 10 |
| **Seed de demonstração** | Sprint 10 |

### 🔲 Pendente — Prioridade Média (pós-deploy)

| Item | Descrição | Prazo estimado |
|---|---|---|
| **VPN + dados proprietários (B2)** | Acesso a dados internos do cliente via VPN. Depende do deploy Railway ativo. | Mês 6 |
| **Sliding window por tokens** | Substituir `.slice(-12)` (arbitrário) por janela baseada em token count (tiktoken). Previne degradação em análises longas. | Mês 6 |
| **API pública + Swagger (C5)** | Rate limiting por plano (Redis) na API docs. Swagger UI já existe (`GET /api/docs`). Falta documentação de parceiros. | Mês 7–8 |
| **Audit frontend** | Modal de visualização de audit_logs para admins — exportação CSV. Backend já implementado. | Mês 7 |

### 🔮 Futuro (Fase D)

| Item | Descrição |
|---|---|
| **LLM Soberano** | Fine-tuning com dados MSEF · air-gapped para defesa · ativo de PI para exit Big Tech |
| **Sabiá-3 / LLM soberano BR** | Provider Factory já permite troca sem reescrever o motor |

---

## 13. RISCOS IDENTIFICADOS (Avaliação v2.1 — Abril 2026)

### 13.1 Riscos Técnicos

| Risco | Contexto | Mitigação |
|---|---|---|
| **Esgotamento Tavily gratuito** | Plano free: 1.000 req/mês. KLIO + KRATOS consomem buscas por análise. 2 clientes ativos em monitoramento diário esgotam o limite. | Migrar para Tavily Starter (~USD 29/mês) após primeiro contrato. Incluir R$ 150/mês no modelo de custo. Alternar com Brave Search API como fallback. |
| **Race condition DB→API no Railway** | Retry 10×3s funciona em Docker local. No Railway cold start, comportamento pode diferir. | Configurar health check no Railway. Documentar logs esperados no startup. |
| **Context bloat em análises longas** | `.slice(-12)` é arbitrário. Análises de 20+ turnos podem ter qualidade degradada. | Implementar sliding window baseada em token count (tiktoken) em vez de contagem de mensagens. |
| **Dependência Voyage AI (RAG)** | Plano gratuito pode ser descontinuado. Não estava no orçamento original. | Mapear alternativa: embeddings locais com `nomic-embed` via Ollama. Provider Factory facilita migração. |

### 13.2 Riscos Operacionais e Estratégicos

| Risco | Contexto | Mitigação |
|---|---|---|
| **Deploy ausente bloqueia KRATOS** | Cron jobs do KRONOS dependem de servidor 24/7. Em localhost, monitoramento para quando o computador é desligado. | Deploy Railway é a ação mais crítica. Sem isso, produto de monitoramento recorrente não pode ser ofertado. |
| **Ausência de executável desktop** | PoCs em ambiente governamental sem acesso externo exigem solução offline. | Testar `docker save` → USB + script de instalação Windows. Fallback: `server.js` legado como modo standalone. |
| **Complexidade operacional crescente** | Stack evoluiu de 2 arquivos para monorepo TypeScript com 4 pacotes, Docker, pgvector, 5+ APIs externas. Operação solo tem limite. | `HISTORICO_MIGRACAO.md` é o principal ativo operacional — manter atualizado a cada sprint. Contratar CIO técnico a partir do segundo contrato. |
| **Dependências externas não mapeadas** | Voyage AI + INLABS + ITU DataHub adicionados sem revisão de custos. Risco de surpresas ao escalar. | Revisar modelo de custos a cada sprint (ver seção 14). |

---

## 14. ATIVOS NÃO PLANEJADOS (Gerados na v4.0 — Valor para Exit)

| Ativo | O que é | Impacto no Exit / Valuation |
|---|---|---|
| **Motor Dinâmico de Metodologias** | Agentes e metodologias 100% via banco. Nova metodologia = upload de JSON, sem deploy. | Cria marketplace de metodologias. Parceiros publicam engines — modelo de receita adicional. |
| **RAG com pgvector + Voyage AI** | Documentos do cliente indexados semanticamente por projectId. Busca por similaridade vetorial. | Principal diferencial técnico para defesa. Dados proprietários "dentro" da plataforma — dado de lock-in e alto valor de retenção. |
| **Token Streaming SSE Real** | `streamText` no Agent.ts com propagação via `AnalysisCallbacks.onToken`. Cursor piscante em tempo real na UI. | Experiência enterprise em demonstrações ao vivo. Acelera fechamento de contratos. |
| **Provider Factory (Agent.ts)** | `getModel()` lê `LLM_PROVIDER` do env. Trocar Anthropic por Ollama/Sabiá-3 sem alterar código dos agentes. | Prepara Fase D sem reescrita. Demonstrável para acquirers como "agnóstico de modelo" — maior múltiplo de valuation. |
| **Backup Corporativo pg_dump** | Rota admin-only que gera `.sql.gz` via pg_dump. BackupModal na UI. | Requisito de compliance ISO 27001 cumprido antecipadamente. Elimina objeção de segurança em clientes de defesa. |
| **Painel Admin (Engine Manager)** | Interface para instalar novos Motores (JSON + agentes) sem deploy. Gerenciamento de usuários e roles na UI. | Permite operação por pessoal não-técnico. Requisito para escalar além da operação solo. |
| **GRUMBACH + GODET operacionais** | Orquestradores dedicados para metodologias militares e francesas. Prompts MSEF v2 completos. | Diferencial direto para clientes de defesa e governo. Amplia o mercado endereçável além do setor privado. |

---

## 15. MODELO DE CUSTOS ATUALIZADO (Abril 2026)

| Ferramenta / Serviço | Plano Atual | Custo/mês pré-contrato | Custo/mês pós-contrato | Status |
|---|---|---|---|---|
| Claude API (Anthropic) | Pay-per-use | ~R$ 100 | ~R$ 400 (2 clientes) | ✅ Planejado |
| Tavily Search API | Free (1k req) | R$ 0 | ~R$ 150 (Starter) | ⚠️ Ampliar após contrato |
| Voyage AI (RAG embeddings) | Free tier | R$ 0 | ~R$ 50 (se escalar) | ⚠️ Monitorar |
| Railway (deploy 24/7 + PostgreSQL) | — (não contratado) | R$ 30 (a contratar) | ~R$ 80 (Pro) | 🔲 AÇÃO IMEDIATA |
| Google Workspace | Business Starter | R$ 35 | R$ 35 | ✅ Planejado |
| Contador terceirizado | Mensalidade | R$ 500 | R$ 500 | ✅ Planejado |
| Demais (Notion, Canva, n8n) | Free/Pro | R$ 93 | R$ 93 | ✅ Planejado |
| **TOTAL** | — | **R$ 758/mês** | **~R$ 1.308/mês** | ✅ < R$ 1.500 |

Custo pós-contrato estimado em R$ 1.308/mês — dentro da diretriz de R$ 1.500/mês. Margem de R$ 192/mês absorve variações de uso da API Anthropic.

---

*OLYMPUS v4.0 · StratSight Brasil · Maio 2026 · Confidencial*
