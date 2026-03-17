#!/usr/bin/env pwsh
# setup-ssh-and-deploy.ps1
# Instala a chave SSH na VPS e faz o deploy - rode no terminal do VS Code

$VPS_IP   = "212.85.10.239"
$VPS_USER = "root"
$VPS      = "$VPS_USER@$VPS_IP"
$PUB_KEY  = Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" -Raw

Write-Host "`n🔑 ETAPA 1: Instalando chave SSH na VPS" -ForegroundColor Cyan
Write-Host "   Digite a senha quando solicitado (última vez!)`n" -ForegroundColor Yellow

# Instala a chave no authorized_keys da VPS
$installCmd = "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '$PUB_KEY' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo '✅ Chave instalada!'"
ssh $VPS $installCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Falha ao instalar a chave. Verifique a senha e tente novamente." -ForegroundColor Red
    exit 1
}

Write-Host "`n🚀 ETAPA 2: Testando conexão sem senha..." -ForegroundColor Cyan
ssh -o BatchMode=yes $VPS "echo '✅ Conexão sem senha OK!'"

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Ainda requer senha. Algo deu errado." -ForegroundColor Red
    exit 1
}

Write-Host "`n📦 ETAPA 3: Fazendo deploy na VPS..." -ForegroundColor Cyan

ssh $VPS @"
set -e
cd /var/www/signal-dashboard
echo '📥 git pull...'
git pull origin main

echo '🔧 Build frontend...'
npm install --silent
npm run build

echo '⚙️  Build backend...'
cd backend
npm install --silent
npm run build
cd ..

echo '♻️  Reiniciando PM2...'
pm2 restart all

echo ''
pm2 status
echo ''
echo '✅ Deploy concluído!'
"@

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n🎉 Tudo pronto! VPS atualizada com sucesso." -ForegroundColor Green
    Write-Host "   Próxima vez use: ssh $VPS (sem senha)" -ForegroundColor Gray
} else {
    Write-Host "`n⚠️  Deploy falhou. Verifique os logs: ssh $VPS 'pm2 logs --lines 30'" -ForegroundColor Red
}
