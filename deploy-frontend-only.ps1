#!/usr/bin/env pwsh
# deploy-frontend-only.ps1 - Deploy apenas do frontend

$VPS = "root@212.85.10.239"

Write-Host ""
Write-Host "Deploy Frontend - Backtest Features" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor DarkGray

$scriptBody = @"
set -e
cd /var/www/signal-dashboard

echo 'Removendo arquivos CSV conflitantes...'
rm -f backend/backtest-results/BASELINE.csv
rm -f backend/backtest-results/COM_CORRECOES.csv

echo 'git pull...'
git pull origin main

echo 'Instalando dependencias frontend...'
npm install

echo 'Build frontend...'
npm run build

echo 'Frontend atualizado!'
"@

$scriptBody = $scriptBody -replace "`r`n", "`n"

Write-Host ""
Write-Host "Conectando na VPS..." -ForegroundColor Yellow
ssh $VPS $scriptBody

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Frontend deployado com sucesso!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Agora voce deve ver no dashboard:" -ForegroundColor White
    Write-Host "  1. Toggle Swing/Scalping" -ForegroundColor Cyan
    Write-Host "  2. Grid de estrategias" -ForegroundColor Cyan
    Write-Host "  3. Botao Adicionar Estrategia" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Recarregue a pagina (Ctrl+F5) para ver as mudancas" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "Deploy falhou" -ForegroundColor Red
    Write-Host "Tente executar manualmente:" -ForegroundColor DarkGray
    Write-Host "ssh root@212.85.10.239" -ForegroundColor Gray
    exit 1
}
