$VPS = "root@212.85.10.239"

Write-Host "🔍 Verificando memória no VPS..." -ForegroundColor Cyan
Write-Host ""

# Verificar memória
Write-Host "📊 MEMÓRIA:" -ForegroundColor Yellow
ssh $VPS "free -h"
Write-Host ""

# Top processos
Write-Host "📈 TOP 5 PROCESSOS:" -ForegroundColor Yellow
ssh $VPS "ps aux --sort=-%mem | head -6"
Write-Host ""

# PM2 status
Write-Host "🔄 PM2 STATUS:" -ForegroundColor Yellow
ssh $VPS "pm2 list"
Write-Host ""

# Disco
Write-Host "💾 DISCO:" -ForegroundColor Yellow
ssh $VPS "df -h /"
