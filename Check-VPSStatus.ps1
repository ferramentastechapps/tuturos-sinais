# Script para verificar status do VPS
Write-Host "🔍 VERIFICANDO STATUS NO VPS" -ForegroundColor Cyan
Write-Host "============================================================"
Write-Host ""

$vpsHost = "root@185.211.6.46"

# Verificar PM2
Write-Host "📊 Verificando processos PM2..." -ForegroundColor Yellow
ssh $vpsHost "pm2 list"

Write-Host ""
Write-Host "============================================================"
Write-Host ""

# Verificar logs recentes
Write-Host "📝 Últimos logs (50 linhas)..." -ForegroundColor Yellow
ssh $vpsHost "pm2 logs --lines 50 --nostream"

Write-Host ""
Write-Host "============================================================"
Write-Host ""

# Verificar memória
Write-Host "💾 Uso de memória:" -ForegroundColor Yellow
ssh $vpsHost "free -h"

Write-Host ""
Write-Host "============================================================"
Write-Host ""

# Verificar disco
Write-Host "💿 Uso de disco:" -ForegroundColor Yellow
ssh $vpsHost "df -h /"

Write-Host ""
Write-Host "✅ Verificação concluída!" -ForegroundColor Green
