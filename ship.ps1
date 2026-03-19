#!/usr/bin/env pwsh
# ship.ps1 - Um comando para tudo: commit + push + deploy VPS
# Uso: .\ship.ps1 "mensagem do commit"
# Exemplo: .\ship.ps1 "feat: novo indicador RSI"

param(
    [Parameter(Position=0)]
    [string]$msg = ""
)

$VPS = "root@212.85.10.239"

# ── Mensagem de commit ──────────────────────────────────────────
if (-not $msg) {
    $date = Get-Date -Format "yyyy-MM-dd HH:mm"
    $msg  = "chore: update $date"
}

Write-Host "`n📦 SHIP: $msg" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

# ── 1. Git local ────────────────────────────────────────────────
Write-Host "`n[1/3] 🔀 Git commit + push..." -ForegroundColor Yellow

git add -A
git commit -m $msg
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Nada novo para commitar, continuando..." -ForegroundColor DarkGray
}

git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Falha no git push. Abortando." -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Código enviado ao GitHub" -ForegroundColor Green

# ── 2. Deploy VPS ───────────────────────────────────────────────
Write-Host "`n[2/3] 🚀 Deploying na VPS $VPS..." -ForegroundColor Yellow
Write-Host "  (Digite a senha SSH se solicitado)`n" -ForegroundColor DarkGray

$scriptBody = @"
set -e
cd /var/www/signal-dashboard
echo '  📥 git pull...'
git stash -q 2>/dev/null || true
git pull origin main -q

echo '  🎨 build frontend...'
npm install -q
npm run build

echo '  ⚙️  build backend...'
cd backend
npm install -q
npm run build
cd ..

echo '  ♻️  pm2 cleanup & restart...'
pm2 delete telegram-bot --silent 2>/dev/null || true
pm2 restart all --silent
pm2 save --force
pm2 status
"@

# Fix Windows CRLF to Linux LF to prevent bash "\r: command not found" errors
$scriptBody = $scriptBody -replace "`r`n", "`n"

ssh $VPS $scriptBody

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Deploy falhou na VPS." -ForegroundColor Red
    Write-Host "   Verifique: ssh $VPS 'pm2 logs --lines 30'" -ForegroundColor DarkGray
    exit 1
}

# ── 3. Done ─────────────────────────────────────────────────────
Write-Host "`n[3/3] ✅ Tudo pronto!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "  Commit : $msg" -ForegroundColor White
Write-Host "  VPS    : $VPS" -ForegroundColor White
Write-Host "  pm2    : signal-engine online`n" -ForegroundColor White
