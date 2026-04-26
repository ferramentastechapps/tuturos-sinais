#!/usr/bin/env pwsh
# Deploy ML Analytics fix — backend + frontend

$VPS = "212.85.10.239"
$VPS_USER = "root"
$VPS_PASS = "F(W4f37Db)-kE'tM"
$VPS_BACKEND = "/root/tuturos-sinais/backend"
$VPS_FRONTEND = "/var/www/signal-dashboard"

Write-Host "🚀 Deploy ML Analytics Fix" -ForegroundColor Cyan
Write-Host "================================"

# 1. Build backend local
Write-Host "`n📦 [1/4] Build do backend..." -ForegroundColor Yellow
Set-Location backend
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Erro no build do backend!" -ForegroundColor Red; exit 1 }
Set-Location ..
Write-Host "✅ Backend build OK" -ForegroundColor Green

# 2. Enviar backend para VPS
Write-Host "`n📤 [2/4] Enviando backend para VPS..." -ForegroundColor Yellow
$env:SSHPASS = $VPS_PASS
sshpass -e rsync -avz --exclude 'node_modules' --exclude '.env' `
  backend/src/server/api.ts `
  "${VPS_USER}@${VPS}:${VPS_BACKEND}/src/server/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  sshpass não disponível, tentando pscp..." -ForegroundColor Yellow
    # Fallback: usar plink se disponível
    echo $VPS_PASS | plink -pw $VPS_PASS "${VPS_USER}@${VPS}" "echo connected" 2>&1
}
Write-Host "✅ Arquivos enviados" -ForegroundColor Green

# 3. Build + restart na VPS
Write-Host "`n🔨 [3/4] Build e restart na VPS..." -ForegroundColor Yellow
$sshCmd = @"
cd $VPS_BACKEND && npm run build && pm2 restart signal-engine && echo 'RESTART_OK'
"@
echo $VPS_PASS | plink -ssh -pw "$VPS_PASS" "${VPS_USER}@${VPS}" $sshCmd

Write-Host "✅ Backend reiniciado" -ForegroundColor Green

# 4. Deploy frontend
Write-Host "`n🌐 [4/4] Deploy do frontend..." -ForegroundColor Yellow
sshpass -e rsync -avz --delete dist/ "${VPS_USER}@${VPS}:${VPS_FRONTEND}/"
Write-Host "✅ Frontend atualizado" -ForegroundColor Green

Write-Host "`n✅ Deploy concluído!" -ForegroundColor Green
Write-Host "🔗 https://sinaiscripto.ftech-apps.com.br/ml-analytics" -ForegroundColor Cyan
