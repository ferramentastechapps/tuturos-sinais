#!/usr/bin/env pwsh
# Deploy da correcao de simbolos do backtest

$VPS = "root@212.85.10.239"

Write-Host ""
Write-Host "Deploy: Adicionar todas as moedas ao backtest" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor DarkGray
Write-Host ""

# 1. Push para GitHub
Write-Host "[1/2] Push para GitHub..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Erro no git push. Abortando." -ForegroundColor Red
    exit 1
}

Write-Host "  OK - Codigo no GitHub" -ForegroundColor Green

# 2. Deploy na VPS
Write-Host ""
Write-Host "[2/2] Deploy na VPS..." -ForegroundColor Yellow

$scriptBody = @"
set -e
cd /var/www/signal-dashboard

echo 'Removendo CSVs conflitantes...'
rm -f backend/backtest-results/*.csv

echo 'git pull...'
git pull origin main

echo 'Build backend...'
cd backend
npm install
npm run build

echo 'Restart PM2...'
pm2 restart signal-engine

echo 'Deploy concluido!'
"@

$scriptBody = $scriptBody -replace "`r`n", "`n"

ssh $VPS $scriptBody

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor DarkGray
    Write-Host "Deploy concluido com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Mudancas aplicadas:" -ForegroundColor White
    Write-Host "  - Swing: ~80 moedas (todas monitoradas)" -ForegroundColor Cyan
    Write-Host "  - Scalping: ~26 moedas (alta liquidez)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Teste no dashboard:" -ForegroundColor White
    Write-Host "  1. Va em Backtesting" -ForegroundColor Gray
    Write-Host "  2. Clique em 'Usar Config Swing (90d)'" -ForegroundColor Gray
    Write-Host "  3. Verifique a lista de simbolos" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "Deploy falhou na VPS" -ForegroundColor Red
    exit 1
}
