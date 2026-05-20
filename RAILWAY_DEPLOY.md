# OLYMPUS v4 — Deploy Railway

**Tempo estimado: 30–45 minutos · Uma vez configurado, deploys automáticos via GitHub.**

---

## Arquitetura no Railway

```
Railway Project: olympus-production
├── Service: olympus-api   ← Dockerfile.api  (Hono + Node.js)
├── Service: olympus-web   ← Dockerfile.web  (React + Nginx)
└── Plugin:  Postgres      ← pgvector/pg15   (banco + RAG)
```

O frontend (web) usa caminhos relativos `/api/v1/...`. O nginx do container web
faz proxy para a API usando a variável `RAILWAY_API_URL` — não é necessário
alterar nenhum código do frontend.

---

## Pré-requisitos

- [ ] Conta Railway: https://railway.app (plano Hobby USD 5/mês suficiente)
- [ ] Railway CLI: `npm install -g @railway/cli`
- [ ] Repositório Git com o código (GitHub/GitLab)
- [ ] `.env.railway.example` preenchido com suas credenciais

---

## Passo 1 — Criar o projeto Railway

```bash
railway login
railway init
# Nome do projeto: olympus-production
```

Ou via dashboard: **New Project → Empty Project → renomear para "olympus-production"**

---

## Passo 2 — Adicionar o banco de dados PostgreSQL

No dashboard Railway:

1. Clique em **"+ New"** dentro do projeto
2. Selecione **"Database → PostgreSQL"**
3. Aguarde o provisionamento (1-2 minutos)
4. Clique no serviço Postgres → **"Variables"** → copie o valor de `DATABASE_URL`
5. No terminal, ative o pgvector:

```bash
# Conectar ao banco Railway e criar extensão
railway run --service postgres psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

> **Nota:** O código já executa `CREATE EXTENSION IF NOT EXISTS vector` automaticamente
> no startup da API. O passo acima é apenas para garantir permissões.

---

## Passo 3 — Criar o serviço API

No dashboard Railway:

1. Clique em **"+ New → GitHub Repo"**
2. Selecione seu repositório
3. Railway detectará o `railway.toml` e usará o `Dockerfile.api`
4. Renomeie o serviço para **"olympus-api"**

### Configurar variáveis de ambiente da API

No serviço **olympus-api → Variables → Raw Editor**, cole e preencha:

```
ANTHROPIC_API_KEY=sk-ant-SUA_CHAVE_AQUI
ANTHROPIC_MODEL=claude-opus-4-7
TAVILY_API_KEY=tvly-SUA_CHAVE_AQUI
JWT_SECRET=gere-um-secret-aleatorio-longo-aqui
NODE_OPTIONS=--max-old-space-size=1024
VOYAGE_API_KEY=pa-SUA_CHAVE_AQUI
ALLOWED_ORIGIN=https://SEU-DOMINIO-WEB (preencher depois do Passo 4)
```

> `DATABASE_URL` e `PORT` são injetados automaticamente pelo Railway.
> NÃO defina `PORT` manualmente.

### Linkar o banco ao serviço API

Em **olympus-api → Variables**, clique em **"Add Reference"** e selecione
`DATABASE_URL` do serviço Postgres. Isso injeta a variável automaticamente.

### Aguardar o deploy

Railway iniciará o build automaticamente. Acompanhe em **"Deployments"**.
O health check em `/ping` confirma quando a API está pronta (~5 minutos).

Anote a URL gerada: `https://olympus-api-xxxx.up.railway.app`

---

## Passo 4 — Criar o serviço Web

No dashboard Railway:

1. Clique em **"+ New → GitHub Repo"** (mesmo repositório)
2. Renomeie para **"olympus-web"**
3. Em **Settings → Build → Dockerfile Path**, insira: `Dockerfile.web`

### Configurar variáveis de ambiente da Web

Em **olympus-web → Variables → Raw Editor**:

```
RAILWAY_API_URL=https://olympus-api-xxxx.up.railway.app
```

> Substitua pela URL real do serviço API do Passo 3.
> Esta variável é usada pelo nginx para proxy reverso — sem ela o frontend
> não consegue chamar a API.

### Aguardar o deploy da Web

URL gerada: `https://olympus-web-xxxx.up.railway.app`

---

## Passo 5 — Configurar ALLOWED_ORIGIN na API

Volte ao serviço **olympus-api → Variables** e atualize:

```
ALLOWED_ORIGIN=https://olympus-web-xxxx.up.railway.app
```

Isso é necessário para o CORS funcionar. O Railway fará redeploy automático.

---

## Passo 6 — Rodar o seed inicial

```bash
# Com Railway CLI, execute o seed no container da API:
railway run --service olympus-api \
  npx tsx apps/api/src/scripts/seed.ts
```

Ou via dashboard: **olympus-api → Shell → digitar o comando acima.**

---

## Passo 7 — Configurar domínio próprio (opcional)

### Para a API:
1. **olympus-api → Settings → Networking → Custom Domain**
2. Insira: `api.stratsight.com.br`
3. Configure o CNAME no seu DNS: `api.stratsight.com.br → olympus-api-xxxx.up.railway.app`

### Para o Web:
1. **olympus-web → Settings → Networking → Custom Domain**
2. Insira: `athena.stratsight.com.br`
3. Configure o CNAME: `athena.stratsight.com.br → olympus-web-xxxx.up.railway.app`

### Atualizar ALLOWED_ORIGIN após domínio próprio:
```
ALLOWED_ORIGIN=https://athena.stratsight.com.br
```

---

## Passo 8 — Testar

```bash
# Health check da API:
curl https://olympus-api-xxxx.up.railway.app/ping
# Esperado: {"status":"ok","message":"OLYMPUS API v4.0 rodando com Hono!"}

# Testar frontend:
# Abra https://olympus-web-xxxx.up.railway.app no navegador
```

---

## Deploys automáticos

Após a configuração inicial, qualquer `git push` para a branch main dispara
deploy automático de ambos os serviços. Railway detecta qual Dockerfile mudou.

---

## Variáveis de ambiente — referência completa

| Variável | Serviço | Obrigatória | Descrição |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | API | ✅ | Claude API key |
| `TAVILY_API_KEY` | API | ✅ | Web search |
| `JWT_SECRET` | API | ✅ | Signing secret (min 32 chars) |
| `DATABASE_URL` | API | ✅ | Injetado pelo Railway (addon Postgres) |
| `PORT` | API | ✅ | Injetado pelo Railway (não definir) |
| `ALLOWED_ORIGIN` | API | ✅ | URL do serviço Web (CORS) |
| `RAILWAY_API_URL` | Web | ✅ | URL do serviço API (nginx proxy) |
| `VOYAGE_API_KEY` | API | ⚠️ | RAG embeddings (free tier disponível) |
| `ANTHROPIC_MODEL` | API | — | Padrão: `claude-opus-4-7` |
| `NODE_OPTIONS` | API | — | `--max-old-space-size=1024` |
| `SMTP_*` | API | — | E-mail alerts KRATOS |
| `INLABS_*` | API | — | DOU Seção 1 |
| `ITU_*` | API | — | ITU DataHub |

---

## Solução de problemas

| Problema | Causa provável | Solução |
|---|---|---|
| Build falha no Railway | `Dockerfile.api` usa `apt-get` que pode demorar | Normal — aguardar até 10 min no primeiro build |
| API retorna 502 | Health check falhou | Verificar logs: `railway logs --service olympus-api` |
| Frontend mostra "Failed to fetch" | `RAILWAY_API_URL` incorreto ou `ALLOWED_ORIGIN` desatualizado | Atualizar ambas as variáveis |
| Banco não conecta | `DATABASE_URL` não linkado | Adicionar reference no serviço API |
| pgvector `type "vector" does not exist` | Extensão não criada | Rodar `CREATE EXTENSION IF NOT EXISTS vector;` manualmente |
| KRATOS não monitora após restart | Race condition no cold start do Railway | Verificar logs; retry automático (10×3s) deve resolver |

---

## Custos Railway estimados

| Serviço | Plano | Custo/mês |
|---|---|---|
| olympus-api | Hobby (1 vCPU, 512MB) | ~USD 5 |
| olympus-web | Hobby (Nginx estático) | ~USD 2 |
| Postgres | Hobby (1GB storage) | ~USD 5 |
| **Total** | | **~USD 12/mês (~R$ 70/mês)** |

> Plano Pro (~USD 20/mês por serviço) recomendado após o primeiro contrato
> para garantir uptime 99.9% e volumes maiores.

---

*OLYMPUS v4.0 · StratSight Brasil · Maio 2026 · Confidencial*
