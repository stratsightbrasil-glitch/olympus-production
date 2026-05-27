# ══════════════════════════════════════════════════════════════════════════════
# OLYMPUS v4 — Build de PoC Offline para Pendrive
# ══════════════════════════════════════════════════════════════════════════════
# Executa na máquina do ANALISTA (com internet + Docker Desktop).
# Gera um pacote autocontido que roda em qualquer Windows com Docker,
# sem precisar de internet ou acesso ao repositório.
#
# USO:
#   cd D:\Pessoais\DEV\Olympus
#   .\scripts\poc-offline\build-offline.ps1
#
# SAÍDA:
#   dist-poc\olympus-poc.tar   → copiar para pendrive
#   dist-poc\                  → copiar toda a pasta para o pendrive
# ══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $rootDir

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   OLYMPUS v4 — Build de PoC Offline                 ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# ── 1. Verificar Docker ────────────────────────────────────────────────────────
Write-Host "[1/5] Verificando Docker..." -ForegroundColor Cyan
try { docker info | Out-Null } catch {
    Write-Host "❌ Docker não está rodando. Inicie o Docker Desktop e tente novamente." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker OK"

# ── 2. Build das imagens ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/5] Construindo imagens Docker..." -ForegroundColor Cyan
Write-Host "  (isso pode levar 5-10 minutos na primeira vez)"
docker compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Falha no build. Verifique os erros acima." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build concluído"

# ── 3. Criar diretório de saída ────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/5] Preparando pacote offline..." -ForegroundColor Cyan
$distDir = Join-Path $rootDir "dist-poc"
if (Test-Path $distDir) { Remove-Item $distDir -Recurse -Force }
New-Item -ItemType Directory -Path $distDir | Out-Null

# ── 4. Salvar imagens Docker ───────────────────────────────────────────────────
Write-Host "  Salvando imagens (pode levar 2-5 minutos)..."

# Pull da imagem do Postgres caso não exista localmente
docker pull pgvector/pgvector:pg15

# Salva as 3 imagens em um único arquivo tar
docker save `
    "olympus/api:latest" `
    "olympus/web:latest" `
    "pgvector/pgvector:pg15" `
    -o "$distDir\olympus-poc.tar"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Falha ao salvar imagens." -ForegroundColor Red
    exit 1
}

$tarSize = [math]::Round((Get-Item "$distDir\olympus-poc.tar").Length / 1MB, 0)
Write-Host "✅ Imagens salvas ($tarSize MB)"

# ── 5. Copiar arquivos de suporte ──────────────────────────────────────────────
Write-Host ""
Write-Host "[4/5] Copiando arquivos de suporte..." -ForegroundColor Cyan

# docker-compose offline
Copy-Item "$PSScriptRoot\docker-compose.offline.yml" "$distDir\docker-compose.yml"

# Script de instalação para o cliente
Copy-Item "$PSScriptRoot\instalar.ps1" "$distDir\instalar.ps1"

# Guia de instalação
Copy-Item "$PSScriptRoot\GUIA_POC.md" "$distDir\GUIA_POC.md"

# .env template
Copy-Item "$rootDir\.env.railway.example" "$distDir\.env.example"

# Seed script
New-Item -ItemType Directory -Path "$distDir\scripts" | Out-Null
Copy-Item "$rootDir\apps\api\src\scripts\seed.ts" "$distDir\scripts\seed.ts"

Write-Host "✅ Arquivos copiados"

# ── Resumo ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[5/5] Resumo do pacote:" -ForegroundColor Cyan
Get-ChildItem $distDir | ForEach-Object {
    $size = if ($_.Length) { "$([math]::Round($_.Length/1MB,1)) MB" } else { "(dir)" }
    Write-Host "  $($_.Name)  [$size]"
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ Pacote pronto em: dist-poc\                     ║" -ForegroundColor Green
Write-Host "║                                                      ║" -ForegroundColor Green
Write-Host "║   Copie a pasta dist-poc\ inteira para o pendrive.   ║" -ForegroundColor Green
Write-Host "║   No cliente: execute instalar.ps1 como Admin.       ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
