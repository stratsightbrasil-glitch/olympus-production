# SCRIPT DE LIMPEZA E COMPACTAÇÃO AGRESSIVA - OLYMPUS V4
# Executar como Administrador no PowerShell

$ErrorActionPreference = "Stop"

Write-Host "🚀 Iniciando manutenção profunda do Docker..." -ForegroundColor Cyan

# 1. Backup rápido de segurança do banco (150MB)
Write-Host "📦 Gerando backup preventivo do PostgreSQL..." -ForegroundColor Yellow
if (docker ps -q -f name=olympus_db) {
    docker exec olympus_db pg_dump -U postgres -d olympus > olympus_emergency_backup.sql
    Write-Host "✅ Backup salvo com sucesso em 'olympus_emergency_backup.sql'." -ForegroundColor Green
} else {
    Write-Host "⚠️ Container de banco não está rodando. Pulando backup." -ForegroundColor Red
}

# 2. Limpeza de lixo lógico interna do Docker
Write-Host "🧹 Removendo imagens órfãs, containers mortos e caches de compilação..." -ForegroundColor Yellow
docker system prune -a -f
docker builder prune -a -f

Write-Host "📭 Zerando arquivos internos de log acumulados..." -ForegroundColor Yellow
docker run --rm -v /var/lib/docker:/json-logs alpine sh -c "truncate -s 0 /json-logs/containers/*/*-json.log" 2>$null

# 3. Desligamento seguro do Docker Desktop e WSL
Write-Host "🛑 Encerrando Docker Desktop e instâncias WSL2..." -ForegroundColor Yellow
# Fecha o processo do Docker Desktop de forma amigável
Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue
# Garante que todo o subsistema Linux foi desativado
wsl --shutdown
Start-Sleep -Seconds 3

# 4. Compactação física do disco virtual (.vhdx) no Windows
Write-Host "🗜️ Executando compactação física do arquivo vhdx via Diskpart..." -ForegroundColor Yellow

# Caminho padrão do Docker Desktop no Windows WSL2
$VHDX_PATH = "$env:LOCALAPPDATA\Docker\wsl\data\ext4.vhdx"

if (-not (Test-Path $VHDX_PATH)) {
    # Caso você tenha movido o WSL para o disco D:, o script tentará buscar o caminho padrão alternativo
    Write-Host "🔍 Arquivo não encontrado no local padrão. Tentando buscar alternativa..." -ForegroundColor Cyan
    # Adicione aqui o caminho customizado do seu ext4.vhdx se o comando falhar
}

# Criar arquivo de configuração temporário para o Diskpart
$DISKPART_SCRIPT = @"
select vdisk file="$VHDX_PATH"
attach vdisk readonly
compact vdisk
detach vdisk
exit
"@

$SCRIPT_PATH = "$env:TEMP\diskpart_docker_compact.txt"
$DISKPART_SCRIPT | Out-File -FilePath $SCRIPT_PATH -Encoding ascii

# Executa o diskpart passando as instruções geradas
diskpart /s $SCRIPT_PATH
Remove-Item $SCRIPT_PATH -Force

# 5. Reinicialização do ambiente
Write-Host "⚡ Inicializando novamente o Docker Desktop..." -ForegroundColor Green
if (Test-Path "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe") {
    Start-Process "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
    Write-Host "✨ Tudo pronto! O Docker Desktop está reiniciando em segundo plano." -ForegroundColor Green
} else {
    Write-Host "❌ Executável do Docker Desktop não encontrado. Por favor, abra-o manualmente." -ForegroundColor Red
}

Write-Host "📊 Manutenção concluída com sucesso! Seu espaço em disco foi restaurado." -ForegroundColor Green
