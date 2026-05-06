# Deploy rápido das melhorias de Backtesting
# Uso: .\deploy-backtest.ps1

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🚀 DEPLOY: Melhorias de Backtesting" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# 1. Commit e Push
Write-Host "📝 [1/3] Commit e Push..." -ForegroundColor Yellow
git add .
git commit -m "feat: melhorias backtesting - seletor robô e estratégias dinâmicas"
git push origin main
Write-Host "✅ Pushed para GitHub" -ForegroundColor Green

# 2. Deploy Backend no VPS
Write-Host "`n🔧 [2/3] Deploy Backend no VPS..." -ForegroundColor Yellow

$commands = @"
cd /var/www/signal-dashboard && \
git pull origin main && \
cd backend && \
npm run build && \
pm2 restart signal-engine && \
echo '✅ Backend atualizado!' && \
pm2 logs signal-engine --lines 10 --nostream
"@

ssh root@srv1009880.webtitans.host $commands

Write-Host "✅ Backend deployado" -ForegroundColor Green

# 3. Lembrete SQL
Write-Host "`n⚠️  [3/3] AÇÃO NECESSÁRIA: SQL no Supabase" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Execute este SQL no Supabase Dashboard:" -ForegroundColor White
Write-Host ""
Write-Host "1. Abra: https://supabase.com/dashboard" -ForegroundColor Gray
Write-Host "2. Vá em: SQL Editor" -ForegroundColor Gray
Write-Host "3. Copie o conteúdo de: backend/sql/create_backtest_strategies_table.sql" -ForegroundColor Gray
Write-Host "4. Cole e execute (Run)" -ForegroundColor Gray
Write-Host ""
Write-Host "Ou via CLI:" -ForegroundColor Gray
Write-Host "psql `$DATABASE_URL -f backend/sql/create_backtest_strategies_table.sql" -ForegroundColor DarkGray
Write-Host ""

$sqlExecuted = Read-Host "Voce executou o SQL? (s/n)"

if (($sqlExecuted -eq "s") -or ($sqlExecuted -eq "S")) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "DEPLOY COMPLETO!" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "Funcionalidades disponiveis:" -ForegroundColor Yellow
    Write-Host "  - Seletor de Robo (Swing vs Scalping)" -ForegroundColor Green
    Write-Host "  - Estrategias Dinamicas" -ForegroundColor Green
    Write-Host "  - Adicionar Novas Estrategias" -ForegroundColor Green
    Write-Host ""
    Write-Host "Acesse: https://sinaiscripto.ftech-apps.com.br/backtesting" -ForegroundColor Cyan
    Write-Host ""
}
else {
    Write-Host ""
    Write-Host "Lembre-se de executar o SQL antes de testar!" -ForegroundColor Yellow
    Write-Host ""
}
