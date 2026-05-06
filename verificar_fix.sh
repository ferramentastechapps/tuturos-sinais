#!/bin/bash
# Verificação pós-fix do timeout

echo "═══════════════════════════════════════════════════════"
echo "VERIFICAÇÃO PÓS-FIX"
echo "═══════════════════════════════════════════════════════"
echo ""

TODAY=$(date +%Y-%m-%d)

echo "1️⃣ Status PM2"
echo "─────────────────────────────────────────────────────"
pm2 list | grep signal-engine
echo ""

echo "2️⃣ Erros ETIMEDOUT (deve ser 0)"
echo "─────────────────────────────────────────────────────"
TIMEOUTS=$(pm2 logs signal-engine --lines 100 --nostream --err | grep "ETIMEDOUT" | wc -l)
if [ $TIMEOUTS -eq 0 ]; then
    echo "✅ Nenhum erro ETIMEDOUT encontrado"
else
    echo "❌ Ainda há $TIMEOUTS erros ETIMEDOUT"
fi
echo ""

echo "3️⃣ Últimos 30 logs"
echo "─────────────────────────────────────────────────────"
pm2 logs signal-engine --lines 30 --nostream
echo ""

echo "4️⃣ Sinais gerados hoje"
echo "─────────────────────────────────────────────────────"
SIGNALS=$(pm2 logs signal-engine --lines 2000 --nostream | grep "Signal generated" | grep "$TODAY" | wc -l)
echo "Total de sinais hoje: $SIGNALS"

if [ $SIGNALS -gt 0 ]; then
    echo ""
    echo "Últimos sinais:"
    pm2 logs signal-engine --lines 2000 --nostream | grep "Signal generated" | grep "$TODAY" | tail -5
fi
echo ""

echo "5️⃣ Ciclos completados (últimos 5)"
echo "─────────────────────────────────────────────────────"
pm2 logs signal-engine --lines 500 --nostream | grep "Signal cycle complete" | tail -5
echo ""

echo "6️⃣ Config de timeout"
echo "─────────────────────────────────────────────────────"
cd /var/www/signal-dashboard/backend
grep "BYBIT_API_TIMEOUT" .env
echo ""

echo "═══════════════════════════════════════════════════════"
echo "RESULTADO"
echo "═══════════════════════════════════════════════════════"

if [ $TIMEOUTS -eq 0 ]; then
    echo "✅ FIX FUNCIONOU! Sem erros ETIMEDOUT"
    
    if [ $SIGNALS -gt 0 ]; then
        echo "✅ Sinais sendo gerados normalmente ($SIGNALS hoje)"
    else
        echo "⚠️  Sem sinais hoje, mas isso pode ser normal"
        echo "   (mercado sem oportunidades, vetos ativos, etc.)"
    fi
else
    echo "❌ FIX NÃO RESOLVEU - Ainda há erros ETIMEDOUT"
    echo "   Possíveis causas:"
    echo "   - Firewall do VPS bloqueando"
    echo "   - Problema de rede/DNS"
    echo "   - API Bybit fora do ar"
fi

echo ""
