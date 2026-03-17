#!/usr/bin/env pwsh
# deploy-vps.ps1 - Roda o deploy na VPS via SSH interativo

$VPS = "root@212.85.10.239"
$CMD = "cd /var/www/signal-dashboard && git stash && git pull origin main && npm install && npm run build && cd backend && npm install && npm run build && cd .. && pm2 restart all && pm2 status"

Write-Host "`n🚀 Conectando na VPS $VPS..." -ForegroundColor Cyan
Write-Host "💡 Digite a senha quando solicitado`n" -ForegroundColor Yellow

ssh $VPS $CMD

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Deploy concluído com sucesso!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Erro no deploy (exit $LASTEXITCODE)" -ForegroundColor Red
}
