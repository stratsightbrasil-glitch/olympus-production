# ══════════════════════════════════════════════════════════════════════════════
# OLYMPUS v4 — Instalador de PoC Presencial
# ══════════════════════════════════════════════════════════════════════════════
# Executa na máquina do CLIENTE (sem internet necessária após Docker instalado).
#
# PRÉ-REQUISITO: Docker Desktop instalado e rodando.
# Download: https://www.docker.com/products/docker-desktop/
#
# USO (como Administrador):
#   Clique com botão direito em instalar.ps1 → "Executar com PowerShell"
#   OU no terminal Admin: .\instalar.ps1
# ══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$pocDir = $PSScriptRoot

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   OLYMPUS v4 — Instalação de PoC Presencial                 ║" -ForegroundColor Green
Write-Host "║   StratSight Brasil · Strategic Foresight Platform          ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# ── 1. Verificar Docker ────────────────────────────────────────────────────────
Write-Host "[1/6] Verificando Docker Desktop..." -ForegroundColor Cyan
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker não está rodando" }
} catch {
    Write-Host ""
    Write-Host "❌ Docker Desktop não está rodando!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor:" -ForegroundColor Yellow
    Write-Host "  1. Abra o Docker Desktop"
    Write-Host "  2. Aguarde aparecer 'Docker Desktop is running'"
    Write-Host "  3. Execute este script novamente"
    Write-Host ""
    Read-Host "Pressione ENTER para sair"
    exit 1
}
Write-Host "✅ Docker OK"

# ── 2. Verificar arquivo de imagens ───────────────────────────────────────────
Write-Host ""
Write-Host "[2/6] Verificando arquivo de imagens..." -ForegroundColor Cyan
$tarFile = Join-Path $pocDir "olympus-poc.tar"
if (-not (Test-Path $tarFile)) {
    Write-Host "❌ Arquivo olympus-poc.tar não encontrado!" -ForegroundColor Red
    Write-Host "   Certifique-se de que todos os arquivos do pendrive estão nesta pasta."
    Read-Host "Pressione ENTER para sair"
    exit 1
}
$tarSize = [math]::Round((Get-Item $tarFile).Length / 1MB, 0)
Write-Host "✅ Arquivo encontrado ($tarSize MB)"

# ── 3. Verificar .env ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/6] Verificando configuração (.env)..." -ForegroundColor Cyan
$envFile = Join-Path $pocDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "⚠️  Arquivo .env não encontrado." -ForegroundColor Yellow
    Write-Host "   Copiando .env.example como base..."
    $envExample = Join-Path $pocDir ".env.example"
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host ""
        Write-Host "   ATENÇÃO: Edite o arquivo .env antes de continuar!" -ForegroundColor Yellow
        Write-Host "   Abra com Notepad e preencha:" -ForegroundColor Yellow
        Write-Host "     ANTHROPIC_API_KEY=sk-ant-..." -ForegroundColor Yellow
        Write-Host "     TAVILY_API_KEY=tvly-..." -ForegroundColor Yellow
        Write-Host "     JWT_SECRET=(qualquer texto longo)" -ForegroundColor Yellow
        Write-Host ""
        notepad $envFile
        Read-Host "Pressione ENTER após salvar o .env para continuar"
    } else {
        Write-Host "❌ .env.example também não encontrado. Crie o arquivo .env manualmente." -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ .env encontrado"

# ── 4. Carregar imagens Docker ─────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/6] Carregando imagens Docker do pendrive..." -ForegroundColor Cyan
Write-Host "   (pode levar 2-5 minutos — aguarde)"
docker load -i $tarFile
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Falha ao carregar imagens." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Imagens carregadas"

# ── 5. Iniciar containers ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "[5/6] Iniciando OLYMPUS..." -ForegroundColor Cyan
$composeFile = Join-Path $pocDir "docker-compose.yml"
Set-Location $pocDir
docker compose -f $composeFile up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Falha ao iniciar containers." -ForegroundColor Red
    exit 1
}

# Aguarda a API ficar pronta
Write-Host "   Aguardando API iniciar (até 60 segundos)..."
$apiOk = $false
for ($i = 1; $i -le 20; $i++) {
    Start-Sleep 3
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3333/ping" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { $apiOk = $true; break }
    } catch {}
    Write-Host "   Tentativa $i/20..." -NoNewline
}

if (-not $apiOk) {
    Write-Host ""
    Write-Host "⚠️  API ainda não respondeu. Verificando logs..." -ForegroundColor Yellow
    docker compose -f $composeFile logs api --tail=20
} else {
    Write-Host "✅ API pronta"
}

# ── 6. Abrir navegador ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[6/6] Abrindo OLYMPUS no navegador..." -ForegroundColor Cyan
Start-Sleep 2
Start-Process "http://localhost"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ OLYMPUS instalado e rodando!                            ║" -ForegroundColor Green
Write-Host "║                                                              ║" -ForegroundColor Green
Write-Host "║   Acesso: http://localhost                                   ║" -ForegroundColor Green
Write-Host "║   API:    http://localhost:3333/ping                         ║" -ForegroundColor Green
Write-Host "║                                                              ║" -ForegroundColor Green
Write-Host "║   Para parar: docker compose down                           ║" -ForegroundColor Green
Write-Host "║   Para reiniciar: docker compose up -d                      ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Read-Host "Pressione ENTER para fechar"
