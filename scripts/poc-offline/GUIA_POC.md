# OLYMPUS v4 — Guia de PoC Presencial

**StratSight Brasil · Confidencial**

---

## O que está neste pendrive

| Arquivo | Descrição |
|---|---|
| `olympus-poc.tar` | Imagens Docker pré-compiladas (API + Web + Banco) |
| `docker-compose.yml` | Configuração dos containers |
| `instalar.ps1` | Script de instalação automática (Windows) |
| `.env.example` | Modelo de configuração |
| `GUIA_POC.md` | Este guia |

---

## Pré-requisito único: Docker Desktop

1. Acesse: https://www.docker.com/products/docker-desktop/
2. Baixe e instale o **Docker Desktop para Windows**
3. Reinicie o computador se solicitado
4. Abra o Docker Desktop e aguarde o ícone da baleia ficar estável

> **Tamanho:** ~500 MB de download para o Docker Desktop.
> Se o ambiente não tem internet, providencie a instalação do Docker Desktop antecipadamente.

---

## Instalação (3 passos)

### Passo 1 — Preparar o .env

Antes de instalar, edite o arquivo `.env` com as credenciais:

```
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
JWT_SECRET=qualquer-texto-longo-e-aleatorio
ALLOWED_ORIGIN=http://localhost
```

Se não tiver `.env`, o instalador abrirá o `.env.example` automaticamente para edição.

### Passo 2 — Executar o instalador

1. Clique com o **botão direito** em `instalar.ps1`
2. Selecione **"Executar com PowerShell"**
3. Se perguntar sobre política de execução, responda **S** (Sim)
4. Aguarde — o processo leva 3 a 8 minutos

### Passo 3 — Acessar o sistema

Após a instalação, o navegador abre automaticamente em:

```
http://localhost
```

---

## Primeiro acesso

1. **Criar conta:** Na tela inicial, clique em "Criar conta" e registre o analista
2. **Fazer login:** Use as credenciais criadas
3. **Nova sessão:** Clique em "Nova Sessão", preencha o escopo e inicie a análise

---

## Comandos úteis (terminal PowerShell)

```powershell
# Verificar se está rodando:
docker compose ps

# Ver logs em tempo real:
docker compose logs -f api

# Parar o sistema:
docker compose down

# Reiniciar após reinício do PC:
docker compose up -d

# Fazer backup dos dados:
# (no sistema: menu lateral → Backup)
```

---

## Solução de problemas

| Problema | Solução |
|---|---|
| "Docker não está rodando" | Abra o Docker Desktop e aguarde o ícone estabilizar |
| "Porta 80 em uso" | Encerre o IIS ou outro servidor web antes |
| "Porta 5432 em uso" | Encerre o PostgreSQL local (se houver) |
| API não responde após 60s | Execute: `docker compose logs api --tail=50` |
| Tela branca no navegador | Aguarde 30s e atualize; o container web pode ainda estar iniciando |
| "permission denied" no PowerShell | Execute como Administrador |

---

## Dados e privacidade

- Todos os dados ficam **localmente** nesta máquina (volume Docker `pgdata`)
- Nenhuma informação é enviada ao exterior, exceto as chamadas à API Anthropic (Claude) e Tavily (busca web)
- Para operação **completamente offline**, substitua `ANTHROPIC_API_KEY` por credenciais de um LLM local (ex: Ollama)

---

*OLYMPUS v4.0 · StratSight Brasil · Confidencial*
