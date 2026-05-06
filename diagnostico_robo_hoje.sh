#!/bin/bash
# Diagnóstico completo do robô - Por que não gerou sinais hoje?

echo "═══════════════════════════════════════════════════════"
echo "DIAGNÓSTICO: Robô sem sinais hoje (02/05/2026)"
echo "═══════════════════════════════════════════════════════"
echo ""

ssh root@srv1009880.webtitans.host << 'ENDSSH'

echo "1. STATUS DO PM2"
echo "─────────────────────────────────────────────────────"
pm2 list
echo ""

echo "2. UPTIME E RESTARTS"
echo "─────────────────────────────────────────────────────"
pm2 info signal-engine | grep -E "uptime|restarts|status"
echo ""

echo "3. ÚLTIMOS LOGS (50 linhas)"
echo "─────────────────────────────────────────────────────"
pm2 logs signal-engine --lines 50 --nostream
echo ""

echo "4. ERROS RECENTES"
echo "─────────────────────────────────────────────────────"
pm2 logs signal-engine --lines 200 --nostream | grep -i "error\|exception\|fatal\|crash" | tail -20
echo ""

echo "5. SINAIS GERADOS HOJE"
echo "─────────────────────────────────────────────────────"
TODAY=$(date +%Y-%m-%d)
pm2 logs signal-engine --lines 500 --nostream | grep "Signal generated" | grep "$TODAY" | wc -l
echo "Total de sinais hoje: $(pm2 logs signal-engine --lines 500 --nostream | grep 'Signal generated' | grep "$TODAY" | wc -l)"
echo ""

echo "6. ÚLTIMOS SINAIS GERADOS (qualquer dia)"
echo "─────────────────────────────────────────────────────"
pm2 logs signal-engine --lines 1000 --nostream | grep "Signal generated" | tail -5
echo ""

echo "7. CICLOS DE ANÁLISE HOJE"
echo "─────────────────────────────────────────────────────"
pm2 logs signal-engine --lines 500 --nostream | grep "$TODAY" | grep -E "Starting signal generation cycle|Cycle completed" | tail -10
echo ""

echo "8. VETOS HOJE"
echo "─────────────────────────────────────────────────────"
VETOS=$(pm2 logs signal-engine --lines 500 --nostream | grep "$TODAY" | grep -iE "VETO|bloqueado|blocked" | wc -l)
echo "Total de vetos hoje: $VETOS"
if [ $VETOS -gt 0 ]; then
    echo "Últimos vetos:"
    pm2 logs signal-engine --lines 500 --nostream | grep "$TODAY" | grep -iE "VETO|bloqueado|blocked" | tail -10
fi
echo ""

echo "9. VARIÁVEIS DE AMBIENTE"
echo "─────────────────────────────────────────────────────"
cd /var/www/signal-dashboard/backend
grep -E "MAX_SIGNALS_PER_DAY|SIGNAL_INTERVAL_MS|MIN_SCORE" .env
echo ""

echo "10. MEMÓRIA E CPU"
echo "─────────────────────────────────────────────────────"
pm2 info signal-engine | grep -E "memory|cpu"
echo ""

echo "11. ÚLTIMA ATUALIZAÇÃO DO CÓDIGO"
echo "─────────────────────────────────────────────────────"
cd /var/www/signal-dashboard
git log -1 --oneline
echo ""

echo "12. PROCESSO NODE RODANDO?"
echo "─────────────────────────────────────────────────────"
ps aux | grep "signal-engine" | grep -v grep
echo ""

ENDSSH

echo ""
echo "✅ Diagnóstico completo!"
