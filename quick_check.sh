#!/bin/bash
# Verificação rápida do robô

echo "🔍 VERIFICAÇÃO RÁPIDA DO ROBÔ"
echo ""

# Status PM2
echo "📊 Status:"
pm2 list | grep signal-engine

echo ""
echo "⏰ Últimos 20 logs:"
pm2 logs signal-engine --lines 20 --nostream

echo ""
echo "📈 Sinais hoje:"
TODAY=$(date +%Y-%m-%d)
COUNT=$(pm2 logs signal-engine --lines 1000 --nostream | grep "Signal generated" | grep "$TODAY" | wc -l)
echo "Total: $COUNT"

if [ $COUNT -eq 0 ]; then
    echo ""
    echo "⚠️ NENHUM SINAL HOJE!"
    echo ""
    echo "Últimos 5 sinais (qualquer dia):"
    pm2 logs signal-engine --lines 2000 --nostream | grep "Signal generated" | tail -5
    echo ""
    echo "Erros recentes:"
    pm2 logs signal-engine --lines 200 --nostream | grep -i "error" | tail -5
fi
