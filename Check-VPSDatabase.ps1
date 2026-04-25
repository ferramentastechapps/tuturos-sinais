Write-Host "🔍 Verificando banco de dados na VPS..." -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor DarkGray

$commands = @"
cd /var/www/signal-dashboard/backend

echo ""
echo "1️⃣ Total de sinais na tabela TradeSignal:"
sqlite3 prisma/data/trading.db "SELECT COUNT(*) FROM TradeSignal;"

echo ""
echo "2️⃣ Total de sinais ativos na tabela ActiveSignal:"
sqlite3 prisma/data/trading.db "SELECT COUNT(*) FROM ActiveSignal;"

echo ""
echo "3️⃣ Últimos 5 sinais criados:"
sqlite3 -header -column prisma/data/trading.db "SELECT pair, type, status, confidence, created_at FROM TradeSignal ORDER BY created_at DESC LIMIT 5;"

echo ""
echo "4️⃣ Sinais ativos:"
sqlite3 -header -column prisma/data/trading.db "SELECT pair, type, status, score, created_at FROM ActiveSignal ORDER BY created_at DESC LIMIT 5;"

echo ""
echo "5️⃣ Porta 3001 (API backend):"
netstat -tlnp | grep 3001 || echo "Porta 3001 não está escutando!"

echo ""
echo "6️⃣ Status do PM2:"
pm2 list

echo ""
echo "7️⃣ Últimas 30 linhas do log signal-engine:"
pm2 logs signal-engine --lines 30 --nostream
"@

ssh root@212.85.10.239 $commands

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "✅ Verificação completa" -ForegroundColor Green
