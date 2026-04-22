# Script para limpar memória do VPS quando necessário
# Uso: .\Clean-VPSMemory.ps1

$VPS = "root@212.85.10.239"

Write-Host "🧹 LIMPEZA DE MEMÓRIA - VPS" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📊 Memória ANTES da limpeza:" -ForegroundColor Yellow
ssh $VPS "free -h"
Write-Host ""

Write-Host "🗑️  Limpando cache npm..." -ForegroundColor Yellow
ssh $VPS "npm cache clean --force 2>/dev/null"

Write-Host "🗑️  Limpando logs PM2..." -ForegroundColor Yellow
ssh $VPS "pm2 flush"

Write-Host "🗑️  Limpando arquivos temporários..." -ForegroundColor Yellow
ssh $VPS "rm -rf /tmp/* 2>/dev/null; find /var/tmp -type f -mtime +7 -delete 2>/dev/null"

Write-Host "🗑️  Limpando logs antigos..." -ForegroundColor Yellow
ssh $VPS "journalctl --vacuum-time=3d 2>/dev/null"

Write-Host "🗑️  Limpando cache apt..." -ForegroundColor Yellow
ssh $VPS "apt-get clean 2>/dev/null; apt-get autoclean 2>/dev/null"

Write-Host "🗑️  Limpando logs de aplicação..." -ForegroundColor Yellow
ssh $VPS "find /root/.pm2/logs -type f -name '*.log' -mtime +7 -delete 2>/dev/null"

Write-Host ""
Write-Host "♻️  Reiniciando processos PM2..." -ForegroundColor Yellow
ssh $VPS "pm2 restart all"

Write-Host ""
Write-Host "📊 Memória DEPOIS da limpeza:" -ForegroundColor Green
ssh $VPS "free -h"

Write-Host ""
Write-Host "✅ Limpeza concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Dicas:" -ForegroundColor Cyan
Write-Host "   - Monitore: .\Quick-VPSCheck.ps1" -ForegroundColor Gray
Write-Host "   - Logs: ssh $VPS 'pm2 logs --lines 50'" -ForegroundColor Gray
