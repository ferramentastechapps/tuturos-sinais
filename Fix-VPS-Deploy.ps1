#!/usr/bin/env pwsh
# Fix VPS Deploy - Criar diretorios e fazer deploy limpo
# Data: 10/05/2026

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  FIX VPS + DEPLOY COMPLETO" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$VPS = "root@212.85.10.239"
$VPS_PATH = "/var/www/signal-dashboard"

# Passo 1: Criar todos os diretorios necessarios
Write-Host "1. Criando diretorios na VPS..." -ForegroundColor Yellow
ssh $VPS @"
cd $VPS_PATH
mkdir -p backend/src/ml
mkdir -p backend/src/jobs
mkdir -p backend/src/types
mkdir -p backend/src/engine
mkdir -p backend/src/services
mkdir -p backend/src/trading
mkdir -p ml_engine
mkdir -p backups
echo "Diretorios criados com sucesso"
"@

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO ao criar diretorios" -ForegroundColor Red
    exit 1
}

# Passo 2: Fazer backup
Write-Host "`n2. Criando backup..." -ForegroundColor Yellow
ssh $VPS "cd $VPS_PATH && tar -czf backups/backup_`$(date +%Y%m%d_%H%M%S).tar.gz backend/dist backend/src ml_engine 2>/dev/null || true"

# Passo 3: Enviar arquivos TypeScript
Write-Host "`n3. Enviando arquivos TypeScript..." -ForegroundColor Yellow
Write-Host "   - mlPredictionService.ts" -ForegroundColor Gray
scp backend/src/ml/mlPredictionService.ts ${VPS}:${VPS_PATH}/backend/src/ml/

Write-Host "   - mlRetrainJob.ts" -ForegroundColor Gray
scp backend/src/jobs/mlRetrainJob.ts ${VPS}:${VPS_PATH}/backend/src/jobs/

Write-Host "   - mlTypes.ts" -ForegroundColor Gray
scp backend/src/types/mlTypes.ts ${VPS}:${VPS_PATH}/backend/src/types/

Write-Host "   - signalEngine.ts" -ForegroundColor Gray
scp backend/src/engine/signalEngine.ts ${VPS}:${VPS_PATH}/backend/src/engine/

Write-Host "   - scalpingEngine.ts" -ForegroundColor Gray
scp backend/src/engine/scalpingEngine.ts ${VPS}:${VPS_PATH}/backend/src/engine/

Write-Host "   - volatilityTracker.ts" -ForegroundColor Gray
scp backend/src/services/volatilityTracker.ts ${VPS}:${VPS_PATH}/backend/src/services/

Write-Host "   - tradeTracker.ts" -ForegroundColor Gray
scp backend/src/trading/tradeTracker.ts ${VPS}:${VPS_PATH}/backend/src/trading/

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERRO ao enviar arquivos TypeScript" -ForegroundColor Red
    exit 1
}

# Passo 4: Enviar Python
Write-Host "`n4. Enviando train_model.py..." -ForegroundColor Yellow
scp ml_engine/train_model.py ${VPS}:${VPS_PATH}/ml_engine/

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO ao enviar train_model.py" -ForegroundColor Red
    exit 1
}

# Passo 5: Compilar na VPS
Write-Host "`n5. Compilando na VPS..." -ForegroundColor Yellow
ssh $VPS "cd $VPS_PATH/backend && npm run build"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO na compilacao" -ForegroundColor Red
    Write-Host "Verifique os logs: ssh $VPS 'cd $VPS_PATH/backend && npm run build'" -ForegroundColor Yellow
    exit 1
}

# Passo 6: Reiniciar backend
Write-Host "`n6. Reiniciando backend..." -ForegroundColor Yellow
ssh $VPS "cd $VPS_PATH/backend && pm2 restart backend"

Start-Sleep -Seconds 3

# Passo 7: Verificar status
Write-Host "`n7. Verificando status..." -ForegroundColor Yellow
ssh $VPS "pm2 status backend"

# Passo 8: Mostrar logs
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ULTIMAS 30 LINHAS DO LOG" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
ssh $VPS "pm2 logs backend --lines 30 --nostream"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  DEPLOY CONCLUIDO!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Monitore continuamente:" -ForegroundColor Yellow
Write-Host "  ssh $VPS 'pm2 logs backend --lines 50'`n" -ForegroundColor Gray

Write-Host "Logs esperados:" -ForegroundColor Yellow
Write-Host "  - [ML-CONFIDENCE] prob=X, predictedClass=Y, model=SYMBOL" -ForegroundColor Gray
Write-Host "  - [MLRetrain] Backup criado" -ForegroundColor Gray
Write-Host "  - [VETO VOLATILIDADE ALTA] SYMBOL - ATR=X" -ForegroundColor Gray
Write-Host "  - [TradeTracker] Stop atualizado: X -> Y`n" -ForegroundColor Gray
