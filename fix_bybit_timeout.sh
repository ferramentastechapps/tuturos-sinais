#!/bin/bash
# Fix: Bybit API Timeout

echo "═══════════════════════════════════════════════════════"
echo "FIX: Bybit API Timeout"
echo "═══════════════════════════════════════════════════════"
echo ""

echo "1. Testando conectividade com Bybit API..."
curl -s -w "\nStatus: %{http_code}\nTime: %{time_total}s\n" \
  "https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT" | head -30

echo ""
echo "2. Verificando DNS..."
nslookup api.bybit.com

echo ""
echo "3. Verificando logs de erro detalhados..."
pm2 logs signal-engine --lines 100 --nostream --err | grep -A 5 "ETIMEDOUT"

echo ""
echo "4. Verificando sinais gerados hoje..."
TODAY=$(date +%Y-%m-%d)
SIGNALS=$(pm2 logs signal-engine --lines 2000 --nostream | grep "Signal generated" | grep "$TODAY" | wc -l)
echo "Sinais hoje: $SIGNALS"

echo ""
echo "5. Últimos 10 sinais (qualquer dia)..."
pm2 logs signal-engine --lines 3000 --nostream | grep "Signal generated" | tail -10

echo ""
echo "6. Verificando vetos hoje..."
VETOS=$(pm2 logs signal-engine --lines 1000 --nostream | grep "$TODAY" | grep -iE "VETO|bloqueado|blocked" | wc -l)
echo "Vetos hoje: $VETOS"

if [ $VETOS -gt 0 ]; then
    echo "Últimos vetos:"
    pm2 logs signal-engine --lines 1000 --nostream | grep "$TODAY" | grep -iE "VETO|bloqueado|blocked" | tail -10
fi

echo ""
echo "7. Verificando configuração de timeout..."
cd /var/www/signal-dashboard/backend
grep -E "TIMEOUT|timeout" .env || echo "Nenhuma config de timeout no .env"

echo ""
echo "8. Reiniciando signal-engine..."
pm2 restart signal-engine

echo ""
echo "9. Aguardando 10 segundos..."
sleep 10

echo ""
echo "10. Verificando se voltou a funcionar..."
pm2 logs signal-engine --lines 20 --nostream

echo ""
echo "✅ Diagnóstico completo!"
