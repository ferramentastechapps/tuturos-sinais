#!/usr/bin/env pwsh
# Deploy All Fixes - Source Only
# Data: 10/05/2026

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  DEPLOY: 5 CORRECOES CRITICAS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$VPS = "root@212.85.10.239"
$VPS_PATH = "/var/www/signal-dashboard"

Write-Host "Correcoes que serao aplicadas:" -ForegroundColor Yellow
Write-Host "  1. Confidence invertido" -ForegroundColor Green
Write-Host "  2. Retreinamento com backup" -ForegroundColor Green
Write-Host "  3. Isolamento por moeda" -ForegroundColor Green
Write-Host "  4. Filtro volatilidade alta" -ForegroundColor Green
Write-Host "  5. Trailing stop progressivo`n" -ForegroundColor Green

# Criar diretorio services na VPS primeiro
Write-Host "Preparando VPS..." -ForegroundColor Cyan
ssh $VPS "cd $VPS_PATH && mkdir -p backend/src/services backend/src/ml backend/src/jobs backend/src/types backend/src/engine backend/src/trading ml_engine"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO ao conectar no VPS" -ForegroundColor Red
    exit 1
}

# Enviar arquivos TypeScript
Write-Host "`nEnviando arquivos TypeScript..." -ForegroundColor Cyan
scp backend/src/ml/mlPredictionService.ts ${VPS}:${VPS_PATH}/backend/src/ml/
scp backend/src/jobs/mlRetrainJob.ts ${VPS}:${VPS_PATH}/backend/src/jobs/
scp backend/src/types/mlTypes.ts ${VPS}:${VPS_PATH}/backend/src/types/
scp backend/src/engine/signalEngine.ts ${VPS}:${VPS_PATH}/backend/src/engine/
scp backend/src/engine/scalpingEngine.ts ${VPS}:${VPS_PATH}/backend/src/engine/
scp backend/src/services/volatilityTracker.ts ${VPS}:${VPS_PATH}/backend/src/services/
scp backend/src/trading/tradeTracker.ts ${VPS}:${VPS_PATH}/backend/src/trading/

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO ao enviar arquivos TypeScript" -ForegroundColor Red
    exit 1
}

# Enviar Python
Write-Host "Enviando train_model.py..." -ForegroundColor Cyan
scp ml_engine/train_model.py ${VPS}:${VPS_PATH}/ml_engine/

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO ao enviar train_model.py" -ForegroundColor Red
    exit 1
}

# Compilar e reiniciar na VPS
Write-Host "`nCompilando e reiniciando na VPS..." -ForegroundColor Cyan
ssh $VPS "cd $VPS_PATH/backend && npm run build && pm2 restart backend && sleep 2 && pm2 logs backend --lines 20 --nostream"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  DEPLOY CONCLUIDO!" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    Write-Host "Monitore os logs:" -ForegroundColor Yellow
    Write-Host "  ssh $VPS 'pm2 logs backend --lines 50'`n" -ForegroundColor Gray
    
    Write-Host "Logs esperados:" -ForegroundColor Yellow
    Write-Host "  - [ML-CONFIDENCE] prob=X, predictedClass=Y" -ForegroundColor Gray
    Write-Host "  - [MLRetrain] Backup criado" -ForegroundColor Gray
    Write-Host "  - [VETO VOLATILIDADE ALTA] BTCUSDT" -ForegroundColor Gray
    Write-Host "  - [TradeTracker] Stop atualizado`n" -ForegroundColor Gray
} else {
    Write-Host "`nERRO no deploy" -ForegroundColor Red
    Write-Host "Verifique: ssh $VPS 'pm2 logs backend --lines 50'" -ForegroundColor Yellow
}
