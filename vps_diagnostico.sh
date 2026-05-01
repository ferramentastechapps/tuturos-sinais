#!/bin/bash
# Execute este comando diretamente na VPS copiando e colando

echo "═══════════════════════════════════════════════════════"
echo "DIAGNÓSTICO RÁPIDO - SIGNAL ENGINE"
echo "═══════════════════════════════════════════════════════"
echo ""

# 1. Sinais gerados hoje
echo "1. SINAIS GERADOS HOJE:"
echo "─────────────────────────────────────────────────────"
TODAY=$(date +%Y-%m-%d)
SIGNALS_TODAY=$(pm2 logs signal-engine --lines 5000 --nostream 2>/dev/null | grep "Signal generated" | grep "$TODAY" | wc -l)
echo "  → $SIGNALS_TODAY sinais em $(date +%d/%m/%Y)"
echo ""

if [ "$SIGNALS_TODAY" -gt 0 ]; then
  echo "  Últimos sinais:"
  pm2 logs signal-engine --lines 5000 --nostream 2>/dev/null | grep "Signal generated" | grep "$TODAY" | tail -5 | sed 's/.*Signal generated: /  → /'
  echo ""
fi

# 2. VETOs por tipo
echo "2. VETOs POR TIPO (últimas 2000 linhas):"
echo "─────────────────────────────────────────────────────"
pm2 logs signal-engine --lines 2000 --nostream 2>/dev/null | grep "VETO" | sed -E 's/.*VETO ([A-Z]+).*/\1/' | sort | uniq -c | sort -rn | awk '{printf "  %3d × VETO %-15s\n", $1, $2}'
echo ""

# 3. Tendência 4H
echo "3. BLOQUEIOS POR TENDÊNCIA 4H:"
echo "─────────────────────────────────────────────────────"
LONG_BLOCKED=$(pm2 logs signal-engine --lines 2000 --nostream 2>/dev/null | grep "LONG bloqueado - tendência 4H bearish" | wc -l)
SHORT_BLOCKED=$(pm2 logs signal-engine --lines 2000 --nostream 2>/dev/null | grep "SHORT bloqueado - tendência 4H bullish" | wc -l)
echo "  LONGs bloqueados:  $LONG_BLOCKED"
echo "  SHORTs bloqueados: $SHORT_BLOCKED"
echo ""

# 4. ATR
echo "4. BLOQUEIOS POR ATR (Volatilidade < 0.4%):"
echo "─────────────────────────────────────────────────────"
ATR_BLOCKED=$(pm2 logs signal-engine --lines 2000 --nostream 2>/dev/null | grep "VETO ATR" | wc -l)
echo "  $ATR_BLOCKED sinais bloqueados"
echo ""

# 5. ADX
echo "5. BLOQUEIOS POR ADX (Mercado Lateral < 15):"
echo "─────────────────────────────────────────────────────"
ADX_BLOCKED=$(pm2 logs signal-engine --lines 2000 --nostream 2>/dev/null | grep "VETO ADX" | wc -l)
echo "  $ADX_BLOCKED sinais bloqueados"
echo ""

# 6. Score
echo "6. BLOQUEIOS POR SCORE (< 60):"
echo "─────────────────────────────────────────────────────"
SCORE_BLOCKED=$(pm2 logs signal-engine --lines 2000 --nostream 2>/dev/null | grep "VETO SCORE" | wc -l)
echo "  $SCORE_BLOCKED sinais bloqueados"
echo ""

# 7. Símbolos de baixa liquidez
echo "7. SÍMBOLOS BLOQUEADOS POR LIQUIDEZ (Top 10):"
echo "─────────────────────────────────────────────────────"
pm2 logs signal-engine --lines 2000 --nostream 2>/dev/null | grep "baixa liquidez" | grep -oP '\[\w+\] \K\w+' | sort | uniq -c | sort -rn | head -10 | awk '{printf "  %3d × %-10s\n", $1, $2}'
echo ""

# 8. Resumo
echo "═══════════════════════════════════════════════════════"
echo "RESUMO:"
echo "═══════════════════════════════════════════════════════"
TOTAL_VETOS=$((LONG_BLOCKED + SHORT_BLOCKED + ATR_BLOCKED + ADX_BLOCKED + SCORE_BLOCKED))
echo "  Sinais gerados hoje:  $SIGNALS_TODAY"
echo "  VETOs (últimas 2000): $TOTAL_VETOS"
echo ""
echo "  Breakdown:"
echo "    - Tendência 4H:     $((LONG_BLOCKED + SHORT_BLOCKED))"
echo "    - ATR < 0.4%:       $ATR_BLOCKED"
echo "    - ADX < 15:         $ADX_BLOCKED"
echo "    - Score < 60:       $SCORE_BLOCKED"
echo ""

if [ "$SIGNALS_TODAY" -lt 1 ] && [ "$TOTAL_VETOS" -gt 100 ]; then
  echo "  ⚠️  ATENÇÃO: Filtros muito restritivos!"
  echo "  → Considerar relaxar gradualmente"
elif [ "$SIGNALS_TODAY" -ge 1 ]; then
  echo "  ✓ Geração de sinais ativa"
  echo "  → Monitorar win rate por 7 dias"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
