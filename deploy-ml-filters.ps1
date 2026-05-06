#!/usr/bin/env pwsh
# Deploy dos filtros de ML Analytics

$VPS = "root@212.85.10.239"

Write-Host ""
Write-Host "Deploy: Filtros ML Analytics" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor DarkGray
Write-Host ""

Write-Host "IMPORTANTE: Execute o SQL no Supabase antes de continuar!" -ForegroundColor Yellow
Write-Host "Arquivo: backend/sql/add_trade_type_column.sql" -ForegroundColor Gray
Write-Host ""
$continue = Read-Host "SQL ja foi executado? (s/n)"

if ($continue -ne 's' -and $continue -ne 'S') {
    Write-Host ""
    Write-Host "Abortado. Execute o SQL primeiro." -ForegroundColor Red
    Write-Host ""
    Write-Host "Passos:" -ForegroundColor White
    Write-Host "1. Abra Supabase SQL Editor" -ForegroundColor Gray
    Write-Host "2. Copie o conteudo de: backend/sql/add_trade_type_column.sql" -ForegroundColor Gray
    Write-Host "3. Execute o SQL" -ForegroundColor Gray
    Write-Host "4. Execute este script novamente" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# 1. Push para GitHub
Write-Host ""
Write-Host "[1/3] Push para GitHub..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Erro no git push. Abortando." -ForegroundColor Red
    exit 1
}

Write-Host "  OK - Codigo no GitHub" -ForegroundColor Green

# 2. Deploy na VPS
Write-Host ""
Write-Host "[2/3] Deploy na VPS..." -ForegroundColor Yellow

$scriptBody = @"
set -e
cd /var/www/signal-dashboard

echo 'Removendo CSVs conflitantes...'
rm -f backend/backtest-results/*.csv

echo 'git pull...'
git pull origin main

echo 'Build frontend...'
npm install
npm run build

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

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Deploy falhou na VPS" -ForegroundColor Red
    exit 1
}

# 3. Resumo
Write-Host ""
Write-Host "==============================" -ForegroundColor DarkGray
Write-Host "Deploy concluido!" -ForegroundColor Green
Write-Host ""
Write-Host "Mudancas aplicadas:" -ForegroundColor White
Write-Host "  Frontend:" -ForegroundColor Cyan
Write-Host "    - Filtro de data (Hoje, Ontem, Semana, Mes)" -ForegroundColor Gray
Write-Host "    - Filtro de robo (Swing, Scalping)" -ForegroundColor Gray
Write-Host "    - Botao Limpar Filtros" -ForegroundColor Gray
Write-Host ""
Write-Host "  Backend:" -ForegroundColor Cyan
Write-Host "    - Todas as moedas no backtest (~80 swing, ~26 scalping)" -ForegroundColor Gray
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Yellow
Write-Host "  1. Implementar filtros no backend (ver FEATURE_ML_FILTROS.md)" -ForegroundColor Gray
Write-Host "  2. Adicionar coluna trade_type na tabela ml_training_data" -ForegroundColor Gray
Write-Host ""
Write-Host "Teste agora:" -ForegroundColor White
Write-Host "  - ML Analytics: filtros de data e robo" -ForegroundColor Gray
Write-Host "  - Backtesting: config Swing com todas as moedas" -ForegroundColor Gray
Write-Host ""
