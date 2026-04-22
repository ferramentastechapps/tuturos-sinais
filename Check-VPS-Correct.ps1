# Script para verificar status da VPS correta
$vpsHost = "212.85.10.239"
$vpsUser = "root"

Write-Host "🔍 VERIFICANDO STATUS NA VPS CORRETA" -ForegroundColor Cyan
Write-Host "VPS: $vpsHost" -ForegroundColor Yellow
Write-Host "============================================================"
Write-Host ""

# Verificar PM2
Write-Host "📊 Verificando processos PM2..." -ForegroundColor Yellow
ssh ${vpsUser}@${vpsHost} "pm2 list"

Write-Host ""
Write-Host "============================================================"
Write-Host ""

# Verificar logs recentes
Write-Host "📝 Últimos logs (100 linhas)..." -ForegroundColor Yellow
ssh ${vpsUser}@${vpsHost} "pm2 logs --lines 100 --nostream"

Write-Host ""
Write-Host "============================================================"
Write-Host ""

# Verificar memória
Write-Host "💾 Uso de memória:" -ForegroundColor Yellow
ssh ${vpsUser}@${vpsHost} "free -h"

Write-Host ""
Write-Host "============================================================"
Write-Host ""

# Verificar processos Node
Write-Host "🔄 Processos Node rodando:" -ForegroundColor Yellow
ssh ${vpsUser}@${vpsHost} "ps aux | grep node | grep -v grep"

Write-Host ""
Write-Host "✅ Verificação concluída!" -ForegroundColor Green
