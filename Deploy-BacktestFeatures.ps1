# Deploy das melhorias de Backtesting

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "DEPLOY: Melhorias de Backtesting" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Funcionalidades:" -ForegroundColor Yellow
Write-Host "  1. Seletor de Robô (Swing vs Scalping)"
Write-Host "  2. Estratégias Dinâmicas"
Write-Host "  3. Adicionar Novas Estratégias"
Write-Host ""

# Verificar se há mudanças para commitar
Write-Host "1️⃣ Verificando mudanças..." -ForegroundColor Yellow
git status --short

$hasChanges = git status --short
if ($hasChanges) {
    Write-Host ""
    Write-Host "📝 Commitando mudanças..." -ForegroundColor Yellow
    git add .
    git commit -m "feat: melhorias no backtesting - seletor de robô e estratégias dinâmicas"
    git push origin main
    Write-Host "✅ Mudanças commitadas e pushed" -ForegroundColor Green
} else {
    Write-Host "✅ Nenhuma mudança para commitar" -ForegroundColor Green
}

Write-Host ""
Write-Host "2️⃣ Conectando ao VPS..." -ForegroundColor Yellow

$commands = @"
echo '═══════════════════════════════════════════════════════'
echo 'DEPLOY NO VPS'
echo '═══════════════════════════════════════════════════════'
echo ''

echo '1. Navegando para o diretório...'
cd /var/www/signal-dashboard

echo ''
echo '2. Pulling latest changes...'
git pull origin main

echo ''
echo '3. Rebuilding backend...'
cd backend
npm run build

echo ''
echo '4. Restarting PM2...'
pm2 restart signal-engine

echo ''
echo '5. Verificando logs...'
pm2 logs signal-engine --lines 20 --nostream

echo ''
echo '6. Testando endpoints...'
echo 'GET /api/backtest/strategies'
curl -s http://localhost:3001/api/backtest/strategies | head -20

echo ''
echo 'GET /api/backtest/robot-config/swing'
curl -s http://localhost:3001/api/backtest/robot-config/swing | head -20

echo ''
echo 'GET /api/backtest/robot-config/scalping'
curl -s http://localhost:3001/api/backtest/robot-config/scalping | head -20

echo ''
echo '═══════════════════════════════════════════════════════'
echo '✅ DEPLOY BACKEND COMPLETO!'
echo '═══════════════════════════════════════════════════════'
"@

ssh root@srv1009880.webtitans.host $commands

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "⚠️  ATENÇÃO: EXECUTE O SQL NO SUPABASE" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Passos:" -ForegroundColor Yellow
Write-Host "  1. Abra o Supabase Dashboard"
Write-Host "  2. Vá em SQL Editor"
Write-Host "  3. Abra o arquivo: backend/sql/create_backtest_strategies_table.sql"
Write-Host "  4. Copie todo o conteúdo"
Write-Host "  5. Cole no SQL Editor do Supabase"
Write-Host "  6. Clique em 'Run'"
Write-Host ""
Write-Host "💡 Ou execute via CLI:" -ForegroundColor Cyan
Write-Host "   psql `$DATABASE_URL -f backend/sql/create_backtest_strategies_table.sql"
Write-Host ""

$response = Read-Host "Você executou o SQL no Supabase? (s/n)"

if ($response -eq "s" -or $response -eq "S") {
    Write-Host ""
    Write-Host "✅ Ótimo! Testando endpoints novamente..." -ForegroundColor Green
    
    $testCommands = @"
echo 'Testando /api/backtest/strategies...'
curl -s http://localhost:3001/api/backtest/strategies | jq '.strategies | length'
echo ''
echo 'Se retornou um número > 0, a tabela foi criada com sucesso!'
"@
    
    ssh root@srv1009880.webtitans.host $testCommands
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "✅ DEPLOY COMPLETO!" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Próximos passos:" -ForegroundColor Yellow
    Write-Host "  1. Acesse o dashboard: https://sinaiscripto.ftech-apps.com.br/backtesting"
    Write-Host "  2. Vá para aba 'Configuração'"
    Write-Host "  3. Teste o seletor Swing/Scalping"
    Write-Host "  4. Veja as estratégias disponíveis"
    Write-Host "  5. Teste criar uma nova estratégia"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "⚠️  Execute o SQL no Supabase antes de testar!" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "✅ Script finalizado!" -ForegroundColor Green
