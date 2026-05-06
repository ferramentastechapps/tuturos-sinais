#!/bin/bash
# Limpar logs antigos e monitorar apenas logs novos

echo "═══════════════════════════════════════════════════════"
echo "MONITORAMENTO DE LOGS NOVOS"
echo "═══════════════════════════════════════════════════════"
echo ""

echo "1️⃣ Limpando logs antigos do PM2..."
pm2 flush signal-engine
echo "✅ Logs antigos removidos"
echo ""

echo "2️⃣ Aguardando 30 segundos para coletar logs novos..."
sleep 30
echo ""

echo "3️⃣ Verificando NOVOS erros ETIMEDOUT..."
echo "─────────────────────────────────────────────────────"
TIMEOUTS=$(pm2 logs signal-engine --lines 100 --nostream --err | grep "ETIMEDOUT" | wc -l)

if [ $TIMEOUTS -eq 0 ]; then
    echo "✅ NENHUM erro ETIMEDOUT nos últimos 30 segundos!"
    echo "   O fix funcionou!"
else
    echo "❌ Ainda há $TIMEOUTS erros ETIMEDOUT"
    echo ""
    echo "Últimos erros:"
    pm2 logs signal-engine --lines 50 --nostream --err | grep -A 3 "ETIMEDOUT" | tail -20
fi
echo ""

echo "4️⃣ Logs de saída (últimos 30 segundos)..."
echo "─────────────────────────────────────────────────────"
pm2 logs signal-engine --lines 50 --nostream
echo ""

echo "5️⃣ Verificando ciclos completados..."
echo "─────────────────────────────────────────────────────"
CYCLES=$(pm2 logs signal-engine --lines 50 --nostream | grep "Signal cycle complete" | wc -l)
echo "Ciclos completados: $CYCLES"

if [ $CYCLES -gt 0 ]; then
    echo ""
    echo "Últimos ciclos:"
    pm2 logs signal-engine --lines 50 --nostream | grep "Signal cycle complete" | tail -3
fi
echo ""

echo "6️⃣ Verificando sinais gerados..."
echo "─────────────────────────────────────────────────────"
SIGNALS=$(pm2 logs signal-engine --lines 50 --nostream | grep "Signal generated" | wc -l)

if [ $SIGNALS -gt 0 ]; then
    echo "✅ $SIGNALS sinais gerados!"
    pm2 logs signal-engine --lines 50 --nostream | grep "Signal generated"
else
    echo "⚠️  Nenhum sinal gerado ainda"
    echo "   Isso pode ser normal se:"
    echo "   - Mercado sem volatilidade"
    echo "   - Todos os símbolos com score < 60"
    echo "   - Vetos ativos (ADX, ATR, tendência)"
fi
echo ""

echo "═══════════════════════════════════════════════════════"
echo "RESULTADO FINAL"
echo "═══════════════════════════════════════════════════════"

if [ $TIMEOUTS -eq 0 ] && [ $CYCLES -gt 0 ]; then
    echo "✅ ROBÔ FUNCIONANDO PERFEITAMENTE!"
    echo ""
    echo "   - Sem erros ETIMEDOUT"
    echo "   - Ciclos executando normalmente"
    echo "   - API Bybit respondendo"
    echo ""
    if [ $SIGNALS -eq 0 ]; then
        echo "   ⚠️  Sem sinais = mercado sem oportunidades (NORMAL)"
    else
        echo "   ✅ Sinais sendo gerados!"
    fi
elif [ $TIMEOUTS -eq 0 ] && [ $CYCLES -eq 0 ]; then
    echo "⚠️  Aguarde mais tempo..."
    echo "   Sem erros, mas ainda não completou nenhum ciclo"
    echo "   Execute novamente em 2-3 minutos"
else
    echo "❌ PROBLEMA PERSISTE"
    echo ""
    echo "   Ainda há erros ETIMEDOUT"
    echo "   Possíveis causas:"
    echo "   - Firewall do VPS"
    echo "   - Problema de DNS"
    echo "   - API Bybit instável"
    echo ""
    echo "   Próximo passo: Testar API manualmente"
    echo "   curl -s 'https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT'"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo ""
echo "💡 Para monitorar em tempo real:"
echo "   pm2 logs signal-engine"
echo ""
echo "💡 Para executar este script novamente:"
echo "   bash /tmp/monitorar_logs_novos.sh"
echo ""
