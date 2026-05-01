#!/bin/bash

echo "═══════════════════════════════════════════════════════"
echo "DIAGNÓSTICO - ANÁLISE DE SÍMBOLOS"
echo "═══════════════════════════════════════════════════════"
echo ""

cd /var/www/signal-dashboard/backend

# Ver quantos símbolos estão sendo ignorados
echo "1. SÍMBOLOS IGNORADOS POR LIQUIDEZ (últimas 5000 linhas):"
echo "─────────────────────────────────────────────────────"
pm2 logs signal-engine --lines 5000 --nostream 2>/dev/null | \
  grep "baixa liquidez" | \
  grep -oP '\] \K\w+' | \
  sort | uniq -c | sort -rn | head -30

echo ""
echo "2. TOTAL DE SÍMBOLOS IGNORADOS:"
echo "─────────────────────────────────────────────────────"
TOTAL_IGNORED=$(pm2 logs signal-engine --lines 5000 --nostream 2>/dev/null | \
  grep "baixa liquidez" | \
  grep -oP '\] \K\w+' | \
  sort -u | wc -l)
echo "  $TOTAL_IGNORED símbolos únicos ignorados"

echo ""
echo "3. SÍMBOLOS QUE GERARAM SINAIS:"
echo "─────────────────────────────────────────────────────"
pm2 logs signal-engine --lines 5000 --nostream 2>/dev/null | \
  grep "Signal generated" | \
  grep -oP 'Signal generated: \w+ \K\w+' | \
  sort | uniq -c | sort -rn

echo ""
echo "4. ANÁLISE DO CICLO DE GERAÇÃO:"
echo "─────────────────────────────────────────────────────"
CYCLES=$(pm2 logs signal-engine --lines 5000 --nostream 2>/dev/null | \
  grep "Running signal generation cycle" | wc -l)
echo "  Ciclos de geração executados: $CYCLES"

echo ""
echo "5. ÚLTIMAS 20 LINHAS DE LOG (contexto):"
echo "─────────────────────────────────────────────────────"
pm2 logs signal-engine --lines 20 --nostream 2>/dev/null

echo ""
echo "═══════════════════════════════════════════════════════"
echo "CONCLUSÃO:"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Se muitos símbolos estão sendo ignorados por liquidez,"
echo "a solução é EXPANDIR a lista de símbolos permitidos."
echo ""
echo "Arquivo: backend/src/config/highLiquiditySymbols.ts"
echo ""
