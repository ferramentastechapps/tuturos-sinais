#!/bin/bash

echo "═══════════════════════════════════════"
echo "🔍 DIAGNÓSTICO RÁPIDO - Dashboard Vazio"
echo "═══════════════════════════════════════"

echo ""
echo "1️⃣ Status PM2:"
pm2 list

echo ""
echo "2️⃣ Total de sinais no banco:"
cd /var/www/signal-dashboard/backend
sqlite3 prisma/data/trading.db "SELECT COUNT(*) FROM TradeSignal;"

echo ""
echo "3️⃣ Últimos 3 sinais:"
sqlite3 -header -column prisma/data/trading.db "SELECT pair, type, status, confidence, created_at FROM TradeSignal ORDER BY created_at DESC LIMIT 3;"

echo ""
echo "4️⃣ Contexto de mercado atual:"
pm2 logs signal-engine --lines 100 --nostream | grep "MarketContext" | tail -5

echo ""
echo "5️⃣ Vetos recentes (por que não gera sinais):"
pm2 logs signal-engine --lines 200 --nostream | grep -i "vetado\|veto\|blocked" | tail -15

echo ""
echo "6️⃣ Sinais gerados hoje:"
pm2 logs signal-engine --lines 100 --nostream | grep "Signal generated" | tail -5

echo ""
echo "═══════════════════════════════════════"
echo "✅ Diagnóstico completo!"
echo ""
echo "📝 INTERPRETAÇÃO:"
echo "- Se não há 'Signal generated': Filtros estão bloqueando tudo"
echo "- Veja os vetos para entender o motivo"
echo "- Contexto de mercado mostra BTC trend e Fear & Greed"
echo ""
