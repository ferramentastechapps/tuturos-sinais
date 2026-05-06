# Deploy simples - sem perguntas
# Uso: .\deploy-backtest-simple.ps1

Write-Host "Deploy: Melhorias de Backtesting" -ForegroundColor Cyan
Write-Host ""

# 1. Commit e Push
Write-Host "[1/2] Commit e Push..." -ForegroundColor Yellow
git add .
git commit -m "feat: melhorias backtesting - seletor robo e estrategias dinamicas"
git push origin main
Write-Host "Pushed para GitHub" -ForegroundColor Green

# 2. Deploy Backend no VPS
Write-Host ""
Write-Host "[2/2] Deploy Backend no VPS..." -ForegroundColor Yellow

$commands = @"
cd /var/www/signal-dashboard && \
git pull origin main && \
cd backend && \
npm run build && \
pm2 restart signal-engine && \
echo 'Backend atualizado!' && \
pm2 logs signal-engine --lines 10 --nostream
"@

ssh root@srv1009880.webtitans.host $commands

Write-Host ""
Write-Host "DEPLOY COMPLETO!" -ForegroundColor Green
Write-Host ""
Write-Host "Funcionalidades disponiveis:" -ForegroundColor Yellow
Write-Host "  - Seletor de Robo (Swing vs Scalping)" -ForegroundColor Green
Write-Host "  - Estrategias Dinamicas" -ForegroundColor Green
Write-Host "  - Adicionar Novas Estrategias" -ForegroundColor Green
Write-Host ""
Write-Host "Acesse: https://sinaiscripto.ftech-apps.com.br/backtesting" -ForegroundColor Cyan
