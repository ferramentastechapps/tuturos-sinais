#!/bin/bash

# ═══════════════════════════════════════════════════════════
# Script de Análise de VETOs - Diagnóstico de Filtros
# Execute na VPS: bash analyze_vetos.sh
# ═══════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════"
echo "ANÁLISE DE VETOs E FILTROS - SIGNAL ENGINE"
echo "═══════════════════════════════════════════════════════"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Contar VETOs por tipo
echo -e "${BLUE}1. VETOs por Tipo (últimas 2000 linhas):${NC}"
echo "─────────────────────────────────────────────────────"
pm2 logs signal-engine --lines 2000 --nostream 2>/dev/null | \
  grep "VETO" | \
  sed -E 's/.*VETO ([A-Z]+).*/\1/' | \
  sort | uniq -c | sort -rn | \
  awk '{printf "  %3d × VETO %-15s\n", $1, $2}'

echo ""

# 2. Sinais gerados hoje
echo -e "${BLUE}2. Sinais Gerados Hoje:${NC}"
echo "─────────────────────────────────────────────────────"
TODAY=$(date +%Y-%m-%d)
SIGNALS_TODAY=$(pm2 logs signal-engine --lines 5000 --nostream 2>/dev/null | \
  grep "Signal generated" | \
  grep "$TODAY" | \
  wc -l)

echo -e "  ${GREEN}$SIGNALS_TODAY sinais${NC} gerados em $(date +%d/%m/%Y)"

# Mostrar os sinais
if [ "$SIGNALS_TODAY" -gt 0 ]; then
  echo ""
  echo "  Detalhes:"
  pm2 logs signal-engine --lines 5000 --nostream 2>/dev/null | \
    grep "Signal generated" | \
    grep "$TODAY" | \
    tail -10 | \
    sed 's/.*Signal generated: /  → /'
fi

echo ""

# 3. Símbolos bloqueados por liquidez
echo -e "${BLUE}3. Símbolos Bloqueados por Liquidez (Top 20):${NC}"
echo "─────────────────────────────────────────────────────"
pm2 logs signal-engine --lines 2000 --nostream 2>/dev/null | \
  grep "baixa liquidez" | \
  grep -oP '\[\w+\] \K\w+' | \
  sort | uniq -c | sort -rn | head -20 | \
  awk '{printf "  %3d × %-10s\n", $1, $2}'

echo ""

# 4. Score médio dos sinais bloqueados
echo -e "${BLUE}4. Análise de Score dos Sinais Bloqueados:${NC}"
echo "─────────────────────────────────────────────────────"
SCORE_STATS=$(pm2 logs signal-engine --lines 2000 --nostream 2>/dev/null | \
  grep "VETO SCORE" | \
  grep -oP 'Pontuação \K[0-9]+' | \
  awk '{sum+=$1; count++; if($1>max) max=$1; if(min=="" || $1<min) min=$1} 
       END {if(count>0) printf "  Média: %.1f/10 | Min: %d | Max: %d | Total: %d sinais\n", sum/count, min, max, count; 
            else print "  Nenhum sinal bloqueado por score"}')

echo "$SCORE_STATS"

echo ""

# 5. Tendência 4H - Bloqueios
echo -e "${BLUE}5. Bloqueios por Tendência 4H:${NC}"
echo "─────────────────────────────────────────────────────"
LONG_BLOCKED=$(pm2 logs signal-engine --lines 2000 --nostream 2>/dev/null | \
  grep "LONG bloqueado - tendência 4H bearish" | wc -l)
SHORT_BLOCKED=$(pm2 logs signal-engine --lines 2000 --nostream 2>/dev/null | \
  grep "SHORT bloqueado - tendência 4H bullish" | wc -l)

echo "  LONGs bloqueados:  $LONG_BLOCKED"
echo "  SHORTs bloqueados: $SHORT_BLOCKED"
echo "  Total:             $((LONG_BLOCKED + SHORT_BLOCKED))"

echo ""

# 6. ATR - Volatilidade morta
echo -e "${BLUE}6. Bloqueios por ATR (Volatilidade Morta):${NC}"
echo "─────────────────────────────────────────────────────"
ATR_BLOCKED=$(pm2 logs signal-engine --lines 2000 --nostream 2>/dev/null | \
  grep "VETO ATR" | wc -l)
echo "  $ATR_BLOCKED sinais bloqueados por ATR < 0.4%"

# Mostrar exemplos
if [ "$ATR_BLOCKED" -gt 0 ]; then
  echo ""
  echo "  Exemplos (últimos 5):"
  pm2 logs signal-engine --lines 2000 --nostream 2>/dev/null | \
    grep "VETO ATR" | \
    tail -5 | \
    sed -E 's/.*\[SIGNAL-VETO\] ([A-Z]+) .* ATR: ([0-9.]+)%.*/  → \1: ATR = \2%/'
fi

echo ""

# 7. ADX - Mercado lateral
echo -e "${BLUE}7. Bloqueios por ADX (Mercado Lateral):${NC}"
echo "─────────────────────────────────────────────────────"
ADX_BLOCKED=$(pm2 logs signal-engine --lines 2000 --nostream 2>/dev/null | \
  grep "VETO ADX" | wc -l)
echo "  $ADX_BLOCKED sinais bloqueados por ADX < 15"

echo ""

# 8. Resumo geral
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}RESUMO GERAL${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"

TOTAL_VETOS=$((LONG_BLOCKED + SHORT_BLOCKED + ATR_BLOCKED + ADX_BLOCKED))
SCORE_VETOS=$(pm2 logs signal-engine --lines 2000 --nostream 2>/dev/null | grep "VETO SCORE" | wc -l)
TOTAL_VETOS=$((TOTAL_VETOS + SCORE_VETOS))

echo ""
echo "  Sinais gerados hoje:        ${GREEN}$SIGNALS_TODAY${NC}"
echo "  VETOs identificados:        ${RED}$TOTAL_VETOS${NC}"
echo ""
echo "  Breakdown:"
echo "    - Tendência 4H:           $((LONG_BLOCKED + SHORT_BLOCKED))"
echo "    - ATR < 0.4%:             $ATR_BLOCKED"
echo "    - ADX < 15:               $ADX_BLOCKED"
echo "    - Score < 60:             $SCORE_VETOS"
echo ""

# Taxa de aprovação estimada
if [ "$TOTAL_VETOS" -gt 0 ]; then
  APPROVAL_RATE=$(awk "BEGIN {printf \"%.1f\", ($SIGNALS_TODAY / ($SIGNALS_TODAY + $TOTAL_VETOS)) * 100}")
  echo -e "  Taxa de aprovação:          ${YELLOW}~$APPROVAL_RATE%${NC}"
fi

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo ""

# 9. Recomendações
echo -e "${BLUE}RECOMENDAÇÕES:${NC}"
echo ""

if [ "$SIGNALS_TODAY" -lt 1 ]; then
  echo -e "  ${RED}⚠ ATENÇÃO:${NC} Menos de 1 sinal/dia"
  echo "  → Considerar relaxar filtros (ver ANALISE_PRODUCAO.md)"
  echo ""
fi

if [ "$ATR_BLOCKED" -gt 50 ]; then
  echo -e "  ${YELLOW}⚠ ATR:${NC} Muitos bloqueios por volatilidade"
  echo "  → Considerar reduzir limite de 0.4% para 0.3%"
  echo ""
fi

if [ "$((LONG_BLOCKED + SHORT_BLOCKED))" -gt 100 ]; then
  echo -e "  ${YELLOW}⚠ Tendência 4H:${NC} Muitos bloqueios por contra-tendência"
  echo "  → Considerar permitir contra-tendência com penalidade de score"
  echo ""
fi

if [ "$SIGNALS_TODAY" -ge 1 ]; then
  echo -e "  ${GREEN}✓ Geração de sinais ativa${NC}"
  echo "  → Monitorar win rate por 7 dias antes de ajustar"
  echo ""
fi

echo "Para mais detalhes, ver: ANALISE_PRODUCAO.md"
echo ""
