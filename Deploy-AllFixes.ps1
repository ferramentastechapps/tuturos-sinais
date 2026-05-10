#!/usr/bin/env pwsh
# Deploy All Fixes - 4 Correcoes ML + Trailing Stop Progressivo
# Data: 10/05/2026

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  DEPLOY: 5 CORRECOES CRITICAS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$VPS = "root@212.85.10.239"
$VPS_PATH = "/var/www/signal-dashboard"

Write-Host "Correcoes que serao aplicadas:" -ForegroundColor Yellow
Write-Host "  1. Confidence invertido (mlPredictionService.ts)" -ForegroundColor Green
Write-Host "  2. Retreinamento com backup (mlRetrainJob.ts)" -ForegroundColor Green
Write-Host "  3. Isolamento por moeda (train_model.py + engines)" -ForegroundColor Green
Write-Host "  4. Filtro volatilidade alta (volatilityTracker.ts)" -ForegroundColor Green
Write-Host "  5. Trailing stop progressivo (tradeTracker.ts)" -ForegroundColor Green
Write-Host ""

# Passo 1: Compilar backend localmente
Write-Host "Compilando backend TypeScript..." -ForegroundColor Cyan
Push-Location backend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO na compilacao do backend" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "Backend compilado com sucesso`n" -ForegroundColor Green

# Passo 2: Criar script de deploy remoto
$deployScript = @"
cd $VPS_PATH

# Backup
echo "Criando backup..."
timestamp=`$(date +%Y%m%d_%H%M%S)
mkdir -p backups
tar -czf backups/backup_`$timestamp.tar.gz backend/dist backend/src ml_engine 2>/dev/null || true
echo "Backup criado: backups/backup_`$timestamp.tar.gz"

# Criar diretorios
mkdir -p backend/dist
mkdir -p backend/src/ml
mkdir -p backend/src/jobs
mkdir -p backend/src/types
mkdir -p backend/src/engine
mkdir -p backend/src/services
mkdir -p backend/src/trading
mkdir -p ml_engine

echo "Diretorios criados. Aguardando arquivos..."
"@

Write-Host "Conectando na VPS $VPS..." -ForegroundColor Cyan
Write-Host "Digite a senha quando solicitado`n" -ForegroundColor Yellow

# Executar preparacao no VPS
ssh $VPS $deployScript

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERRO ao conectar no VPS" -ForegroundColor Red
    exit 1
}

# Passo 3: Enviar arquivos compilados
Write-Host "`nEnviando backend compilado..." -ForegroundColor Cyan
scp -r backend/dist/* ${VPS}:${VPS_PATH}/backend/dist/
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO ao enviar backend compilado" -ForegroundColor Red
    exit 1
}

# Passo 4: Enviar arquivos fonte TypeScript
Write-Host "Enviando arquivos fonte..." -ForegroundColor Cyan
scp backend/src/ml/mlPredictionService.ts ${VPS}:${VPS_PATH}/backend/src/ml/
scp backend/src/jobs/mlRetrainJob.ts ${VPS}:${VPS_PATH}/backend/src/jobs/
scp backend/src/types/mlTypes.ts ${VPS}:${VPS_PATH}/backend/src/types/
scp backend/src/engine/signalEngine.ts ${VPS}:${VPS_PATH}/backend/src/engine/
scp backend/src/engine/scalpingEngine.ts ${VPS}:${VPS_PATH}/backend/src/engine/
scp backend/src/services/volatilityTracker.ts ${VPS}:${VPS_PATH}/backend/src/services/
scp backend/src/trading/tradeTracker.ts ${VPS}:${VPS_PATH}/backend/src/trading/

# Passo 5: Enviar Python
Write-Host "Enviando train_model.py..." -ForegroundColor Cyan
scp ml_engine/train_model.py ${VPS}:${VPS_PATH}/ml_engine/

# Passo 6: Reiniciar backend
Write-Host "`nReiniciando backend..." -ForegroundColor Cyan
$restartCmd = @"
cd $VPS_PATH/backend
pm2 restart backend
sleep 3
echo ""
echo "========================================="
echo "Status do PM2:"
echo "========================================="
pm2 status backend
echo ""
echo "Ultimas 20 linhas do log:"
echo "========================================="
pm2 logs backend --lines 20 --nostream
"@

ssh $VPS $restartCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  DEPLOY CONCLUIDO COM SUCESSO!" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    Write-Host "Proximos passos:" -ForegroundColor Yellow
    Write-Host "  1. Monitore os logs:" -ForegroundColor White
    Write-Host "     ssh $VPS 'pm2 logs backend --lines 50'`n" -ForegroundColor Gray
    
    Write-Host "  2. Verifique as correcoes:" -ForegroundColor White
    Write-Host "     - [ML-CONFIDENCE] - confidence correto" -ForegroundColor Gray
    Write-Host "     - [MLRetrain] - backup e validacao" -ForegroundColor Gray
    Write-Host "     - [VETO VOLATILIDADE ALTA] - filtro funcionando" -ForegroundColor Gray
    Write-Host "     - [TradeTracker] Stop atualizado - trailing progressivo`n" -ForegroundColor Gray
    
    Write-Host "  3. Proximo retreinamento: 23:55 UTC (hoje)" -ForegroundColor White
    Write-Host "     Modelos especificos por moeda serao criados`n" -ForegroundColor Gray
    
    Write-Host "Documentacao:" -ForegroundColor Yellow
    Write-Host "  - CORRECOES_CIRURGICAS_ML.md" -ForegroundColor Gray
    Write-Host "  - FIX_TRAILING_STOP_PROGRESSIVO.md`n" -ForegroundColor Gray
} else {
    Write-Host "`nERRO no deploy (exit $LASTEXITCODE)" -ForegroundColor Red
}
