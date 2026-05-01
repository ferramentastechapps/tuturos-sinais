#!/bin/bash

# ═══════════════════════════════════════════════════════════
# DIAGNÓSTICO COMPLETO DE VETOS - SIGNAL ENGINE
# Execute na VPS: bash diagnostico_vetos_completo.sh
# ═══════════════════════════════════════════════════════════

cd /var/www/signal-dashboard/backend

echo "═══════════════════════════════════════════════════════"
echo "DIAGNÓSTICO COMPLETO - ANÁLISE DE VETOS"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Coletando logs (últimas 5000 linhas)..."

# Capturar logs
pm2 logs signal-engine --lines 5000 --nostream > /tmp/logs.txt 2>&1

echo "Logs capturados. Analisando..."
echo ""

# ═══════════════════════════════════════════════════════════
# PASSO 1: VETOS POR TIPO
# ═══════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════"
echo "1. VETOS POR TIPO"
echo "═══════════════════════════════════════════════════════"

# Contar cada tipo de VETO
VETO_ADX=$(grep -i "VETO ADX" /tmp/logs.txt | wc -l)
VETO_ATR=$(grep -i "VETO ATR" /tmp/logs.txt | wc -l)
VETO_SCORE=$(grep -i "VETO SCORE" /tmp/logs.txt | wc -l)
VETO_RR=$(grep -i "VETO R:R" /tmp/logs.txt | wc -l)
VETO_MTF=$(grep -i "VETO MTF" /tmp/logs.txt | wc -l)
LONG_BLOCKED=$(grep -i "LONG bloqueado - tendência 4H bearish" /tmp/logs.txt | wc -l)
SHORT_BLOCKED=$(grep -i "SHORT bloqueado - tendência 4H bullish" /tmp/logs.txt | wc -l)
TREND_BLOCKED=$((LONG_BLOCKED + SHORT_BLOCKED))
LIQUIDEZ_BLOCKED=$(grep -i "baixa liquidez" /tmp/logs.txt | wc -l)
DADOS_4H=$(grep -i "Dados 4H insuficientes" /tmp/logs.txt | wc -l)

TOTAL_VETOS=$((VETO_ADX + VETO_ATR + VETO_SCORE + VETO_RR + VETO_MTF + TREND_BLOCKED + DADOS_4H))

echo ""
echo "Tipo de VETO                    | Quantidade | % do Total"
echo "────────────────────────────────┼────────────┼───────────"

if [ $TOTAL_VETOS -gt 0 ]; then
  printf "%-32s| %10d | %6.1f%%\n" "Tendência 4H (EMA200)" $TREND_BLOCKED $(awk "BEGIN {printf \"%.1f\", ($TREND_BLOCKED/$TOTAL_VETOS)*100}")
  printf "%-32s| %10d | %6.1f%%\n" "ADX < 15 (mercado lateral)" $VETO_ADX $(awk "BEGIN {printf \"%.1f\", ($VETO_ADX/$TOTAL_VETOS)*100}")
  printf "%-32s| %10d | %6.1f%%\n" "ATR < 0.4% (volatilidade)" $VETO_ATR $(awk "BEGIN {printf \"%.1f\", ($VETO_ATR/$TOTAL_VETOS)*100}")
  printf "%-32s| %10d | %6.1f%%\n" "Score < 60" $VETO_SCORE $(awk "BEGIN {printf \"%.1f\", ($VETO_SCORE/$TOTAL_VETOS)*100}")
  printf "%-32s| %10d | %6.1f%%\n" "R:R < 1.5" $VETO_RR $(awk "BEGIN {printf \"%.1f\", ($VETO_RR/$TOTAL_VETOS)*100}")
  printf "%-32s| %10d | %6.1f%%\n" "MTF (4H oposto forte)" $VETO_MTF $(awk "BEGIN {printf \"%.1f\", ($VETO_MTF/$TOTAL_VETOS)*100}")
  printf "%-32s| %10d | %6.1f%%\n" "Dados 4H insuficientes" $DADOS_4H $(awk "BEGIN {printf \"%.1f\", ($DADOS_4H/$TOTAL_VETOS)*100}")
  echo "────────────────────────────────┼────────────┼───────────"
  printf "%-32s| %10d | %6s\n" "TOTAL DE VETOS" $TOTAL_VETOS "100.0%"
else
  echo "Nenhum VETO encontrado nos logs"
fi

echo ""
echo "Símbolos ignorados (baixa liquidez): $LIQUIDEZ_BLOCKED"
echo ""

# ═══════════════════════════════════════════════════════════
# PASSO 2: SINAIS GERADOS
# ═══════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════"
echo "2. SINAIS GERADOS"
echo "═══════════════════════════════════════════════════════"

SIGNALS_TOTAL=$(grep "Signal generated" /tmp/logs.txt | wc -l)
TODAY=$(date +%Y-%m-%d)
SIGNALS_TODAY=$(grep "Signal generated" /tmp/logs.txt | grep "$TODAY" | wc -l)

echo ""
echo "Total de sinais (últimas 5000 linhas): $SIGNALS_TOTAL"
echo "Sinais gerados hoje ($TODAY):          $SIGNALS_TODAY"
echo ""

if [ $SIGNALS_TOTAL -gt 0 ]; then
  echo "Últimos 10 sinais gerados:"
  echo "────────────────────────────────────────────────────"
  grep "Signal generated" /tmp/logs.txt | tail -10 | sed 's/.*Signal generated: /  → /'
  echo ""
fi

# ═══════════════════════════════════════════════════════════
# PASSO 3: TAXA DE APROVAÇÃO
# ═══════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════"
echo "3. TAXA DE APROVAÇÃO"
echo "═══════════════════════════════════════════════════════"
echo ""

TOTAL_ANALISES=$((SIGNALS_TOTAL + TOTAL_VETOS))

if [ $TOTAL_ANALISES -gt 0 ]; then
  APPROVAL_RATE=$(awk "BEGIN {printf \"%.1f\", ($SIGNALS_TOTAL/$TOTAL_ANALISES)*100}")
  REJECTION_RATE=$(awk "BEGIN {printf \"%.1f\", ($TOTAL_VETOS/$TOTAL_ANALISES)*100}")
  
  echo "Total de análises:     $TOTAL_ANALISES"
  echo "Sinais aprovados:      $SIGNALS_TOTAL ($APPROVAL_RATE%)"
  echo "Sinais vetados:        $TOTAL_VETOS ($REJECTION_RATE%)"
  echo ""
  
  if (( $(echo "$APPROVAL_RATE < 5" | bc -l) )); then
    echo "⚠️  CRÍTICO: Taxa de aprovação < 5%"
    echo "   Filtros MUITO restritivos!"
  elif (( $(echo "$APPROVAL_RATE < 10" | bc -l) )); then
    echo "⚠️  ATENÇÃO: Taxa de aprovação < 10%"
    echo "   Considerar relaxar filtros"
  elif (( $(echo "$APPROVAL_RATE < 20" | bc -l) )); then
    echo "✓  Taxa de aprovação aceitável (10-20%)"
    echo "   Monitorar win rate por 7 dias"
  else
    echo "✓  Taxa de aprovação boa (>20%)"
  fi
else
  echo "Nenhuma análise encontrada nos logs"
fi

echo ""

# ═══════════════════════════════════════════════════════════
# PASSO 4: SÍMBOLOS MAIS BLOQUEADOS
# ═══════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════"
echo "4. SÍMBOLOS MAIS BLOQUEADOS (Top 15)"
echo "═══════════════════════════════════════════════════════"
echo ""

grep -i "baixa liquidez" /tmp/logs.txt | grep -oP '\[\w+\] \K\w+' | sort | uniq -c | sort -rn | head -15 | awk '{printf "  %3d × %-10s\n", $1, $2}'

echo ""

# ═══════════════════════════════════════════════════════════
# PASSO 5: TRADES ABERTAS
# ═══════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════"
echo "5. TRADES ABERTAS"
echo "═══════════════════════════════════════════════════════"
echo ""

TRADES_TODAY=$(grep -i "order.*placed\|trade.*opened\|position.*opened\|openPosition\|registerNewSignal" /tmp/logs.txt | grep "$TODAY" | wc -l)
TRADES_TOTAL=$(grep -i "order.*placed\|trade.*opened\|position.*opened\|openPosition\|registerNewSignal" /tmp/logs.txt | wc -l)

echo "Trades abertas hoje:           $TRADES_TODAY"
echo "Trades abertas (últimas 5000): $TRADES_TOTAL"
echo ""

# ═══════════════════════════════════════════════════════════
# PASSO 6: RECOMENDAÇÕES
# ═══════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════"
echo "6. RECOMENDAÇÕES DE AJUSTE"
echo "═══════════════════════════════════════════════════════"
echo ""

# Identificar o filtro mais impactante
MAX_VETO=0
MAX_VETO_NAME=""
MAX_VETO_ACTION=""

if [ $TREND_BLOCKED -gt $MAX_VETO ]; then
  MAX_VETO=$TREND_BLOCKED
  MAX_VETO_NAME="Tendência 4H (EMA200)"
  MAX_VETO_ACTION="Relaxar de EMA200 para EMA100 no 4H, ou permitir contra-tendência com penalidade de score"
fi

if [ $VETO_ADX -gt $MAX_VETO ]; then
  MAX_VETO=$VETO_ADX
  MAX_VETO_NAME="ADX < 15"
  MAX_VETO_ACTION="Reduzir limite de ADX de 15 para 12"
fi

if [ $VETO_ATR -gt $MAX_VETO ]; then
  MAX_VETO=$VETO_ATR
  MAX_VETO_NAME="ATR < 0.4%"
  MAX_VETO_ACTION="Reduzir limite de ATR de 0.4% para 0.3%"
fi

if [ $VETO_SCORE -gt $MAX_VETO ]; then
  MAX_VETO=$VETO_SCORE
  MAX_VETO_NAME="Score < 60"
  MAX_VETO_ACTION="Reduzir score mínimo de 60 para 55"
fi

if [ $TOTAL_VETOS -gt 0 ]; then
  IMPACT_PERCENT=$(awk "BEGIN {printf \"%.1f\", ($MAX_VETO/$TOTAL_VETOS)*100}")
  
  echo "🎯 FILTRO MAIS IMPACTANTE:"
  echo "   Nome:     $MAX_VETO_NAME"
  echo "   Bloqueios: $MAX_VETO ($IMPACT_PERCENT% do total)"
  echo ""
  echo "💡 AÇÃO RECOMENDADA:"
  echo "   $MAX_VETO_ACTION"
  echo ""
  
  # Recomendações específicas
  if [ "$MAX_VETO_NAME" = "Tendência 4H (EMA200)" ]; then
    echo "📝 IMPLEMENTAÇÃO:"
    echo "   1. Editar: backend/src/engine/signalEngine.ts"
    echo "   2. Linha ~570-595: Trocar VETO por penalidade de score"
    echo "   3. Ou trocar EMA200 por EMA100 para tendência macro"
    echo ""
  elif [ "$MAX_VETO_NAME" = "ATR < 0.4%" ]; then
    echo "📝 IMPLEMENTAÇÃO:"
    echo "   1. Editar: .env"
    echo "   2. Adicionar: ATR_MIN_PERCENT=0.3"
    echo "   3. Editar: backend/src/engine/signalEngine.ts linha ~545"
    echo "   4. Trocar: if (atrPercentForVeto < 0.4) por < parseFloat(process.env.ATR_MIN_PERCENT || '0.4')"
    echo ""
  elif [ "$MAX_VETO_NAME" = "Score < 60" ]; then
    echo "📝 IMPLEMENTAÇÃO:"
    echo "   1. Editar: .env"
    echo "   2. Adicionar: MIN_SIGNAL_SCORE=55"
    echo "   3. Editar: backend/src/engine/signalEngine.ts linha ~680"
    echo "   4. Usar: parseFloat(process.env.MIN_SIGNAL_SCORE || '60')"
    echo ""
  elif [ "$MAX_VETO_NAME" = "ADX < 15" ]; then
    echo "📝 IMPLEMENTAÇÃO:"
    echo "   1. Editar: .env"
    echo "   2. Adicionar: ADX_MIN=12"
    echo "   3. Editar: backend/src/engine/signalEngine.ts linha ~540"
    echo "   4. Trocar: if (adx < 15) por < parseFloat(process.env.ADX_MIN || '15')"
    echo ""
  fi
fi

# Meta de frequência
echo "🎯 META DE FREQUÊNCIA:"
echo "   Ideal: 1-3 sinais/hora (24-72 sinais/dia)"
echo "   Atual: $SIGNALS_TODAY sinais hoje"
echo ""

if [ $SIGNALS_TODAY -lt 10 ]; then
  echo "   ⚠️  Muito baixo - ajuste necessário"
elif [ $SIGNALS_TODAY -lt 24 ]; then
  echo "   ⚠️  Abaixo do ideal - considerar ajuste"
elif [ $SIGNALS_TODAY -lt 72 ]; then
  echo "   ✓  Dentro da meta"
else
  echo "   ⚠️  Acima da meta - pode estar gerando sinais ruins"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "FIM DO DIAGNÓSTICO"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Logs salvos em: /tmp/logs.txt"
echo "Para ver logs completos: cat /tmp/logs.txt | less"
echo ""
