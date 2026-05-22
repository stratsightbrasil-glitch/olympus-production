# setup-ollama.ps1 — Inicializa o OLYMPUS com Ollama local (CPU-only, sem API Anthropic)
#
# USO:
#   .\scripts\setup-ollama.ps1                        # modelo padrão: llama3.1:8b
#   .\scripts\setup-ollama.ps1 -Model qwen2.5:7b      # modelo alternativo
#   .\scripts\setup-ollama.ps1 -Model llama3.3:70b    # requer GPU + 48 GB VRAM
#
# MODELOS RECOMENDADOS (CPU, 16 GB RAM):
#   llama3.1:8b    — 4.7 GB — melhor equilíbrio qualidade/velocidade, bom tool calling
#   qwen2.5:7b     — 4.4 GB — excelente em português, bom tool calling
#   llama3.2:3b    — 2.0 GB — rápido, tool calling limitado, para demo rápida
#
# REQUISITOS:
#   - Docker Desktop em execução
#   - .env com LLM_PROVIDER=ollama (script cria/atualiza automaticamente)

param(
    [string]$Model = "llama3.1:8b"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OLYMPUS — Setup Ollama Local" -ForegroundColor Cyan
Write-Host "  Modelo: $Model" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar Docker
Write-Host "[1/5] Verificando Docker..." -ForegroundColor Green
$dockerRunning = $false
try {
    $null = docker info 2>$null
    $dockerRunning = $?
} catch {}
if (-not $dockerRunning) {
    Write-Host "ERRO: Docker Desktop nao esta em execucao." -ForegroundColor Red
    Write-Host "      Inicie o Docker Desktop e tente novamente."
    exit 1
}
Write-Host "      Docker OK." -ForegroundColor Gray

# 2. Configurar .env
Write-Host "[2/5] Configurando .env..." -ForegroundColor Green
$envPath = Join-Path $PSScriptRoot ".." ".env"
$envPath = Resolve-Path $envPath

$envContent = Get-Content $envPath -Raw -ErrorAction SilentlyContinue

# Adiciona ou atualiza LLM_PROVIDER, OLLAMA_MODEL, OLLAMA_BASE_URL
function Set-EnvVar {
    param($Content, $Key, $Value)
    if ($Content -match "(?m)^${Key}=") {
        return $Content -replace "(?m)^${Key}=.*", "${Key}=${Value}"
    } else {
        return $Content.TrimEnd() + "`n${Key}=${Value}`n"
    }
}

$envContent = Set-EnvVar $envContent "LLM_PROVIDER"   "ollama"
$envContent = Set-EnvVar $envContent "OLLAMA_MODEL"    $Model
$envContent = Set-EnvVar $envContent "OLLAMA_BASE_URL" "http://ollama:11434/v1"

Set-Content $envPath $envContent -Encoding utf8
Write-Host "      LLM_PROVIDER=ollama, OLLAMA_MODEL=$Model" -ForegroundColor Gray

# 3. Subir stack com profile ollama
Write-Host "[3/5] Iniciando containers (--profile ollama)..." -ForegroundColor Green
Set-Location (Split-Path $envPath)
docker compose --profile ollama up -d 2>&1 | Write-Host
Write-Host "      Containers iniciados." -ForegroundColor Gray

# 4. Aguardar Ollama ficar pronto
Write-Host "[4/5] Aguardando Ollama..." -ForegroundColor Green
$attempts = 0
$maxAttempts = 30
do {
    Start-Sleep -Seconds 3
    $attempts++
    try {
        $response = Invoke-RestMethod "http://localhost:11434/api/version" -TimeoutSec 2 -ErrorAction Stop
        Write-Host "      Ollama pronto (v$($response.version))." -ForegroundColor Gray
        break
    } catch {
        Write-Host "      Aguardando... ($attempts/$maxAttempts)" -ForegroundColor DarkGray
    }
} while ($attempts -lt $maxAttempts)

if ($attempts -ge $maxAttempts) {
    Write-Host "ERRO: Ollama nao respondeu em 90 segundos." -ForegroundColor Red
    Write-Host "      Verifique: docker compose logs ollama"
    exit 1
}

# 5. Pull do modelo
Write-Host "[5/5] Baixando modelo $Model (pode levar varios minutos)..." -ForegroundColor Green
docker exec olympus_ollama ollama pull $Model
if (-not $?) {
    Write-Host "ERRO: Falha ao baixar o modelo $Model." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Ollama configurado com sucesso!" -ForegroundColor Green
Write-Host "  Modelo: $Model" -ForegroundColor Yellow
Write-Host "  Acesse: http://localhost" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Para voltar ao Anthropic:" -ForegroundColor Cyan
Write-Host "  Edite .env: LLM_PROVIDER=anthropic"
Write-Host "  docker compose down && docker compose up -d"
Write-Host ""
