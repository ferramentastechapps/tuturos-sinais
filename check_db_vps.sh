#!/bin/bash

echo "🔍 Verificando banco de dados na VPS..."
echo "════════════════════════════════════════"

ssh root@212.85.10.239 << 'EOF'
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
echo "5️⃣ Status do PM2:"
pm2 list

echo ""
echo "6️⃣ Últimas 20 linhas do log signal-engine:"
pm2 logs signal-engine --lines 20 --nostream

EOF

echo ""
echo "════════════════════════════════════════"
echo "✅ Verificação completa"
