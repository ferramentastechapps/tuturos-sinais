#!/bin/bash

# Deploy FASE 1 - Vetos Críticos
# Implementa mudanças para melhorar win rate de 32.7% para 50%+

echo "🚀 DEPLOY FASE 1 - VETOS CRÍTICOS"
echo "=================================="
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Erro: Execute este script na raiz do projeto"
    exit 1
fi

echo "📋 Mudanças da Fase 1:"
echo "  1. Score mínimo 1H: 85 → 90"
echo "  2. ICT confirmações: 1 → 2"
echo "  3. ML threshold 1H: 55% → 65%"
echo "  4. Score mínimo 5M: 80 → 85"
echo "  5. ML threshold 5M: 62% → 65%"
echo "  6. Limite diário 1H: 5 → 3"
echo "  7. Limite diário 5M: 8 → 5"
echo "  8. Veto contra tendência macro"
echo ""

# Fazer backup dos arquivos modificados
echo "💾 Criando backup..."
mkdir -p backups/fase1_$(date +%Y%m%d_%H%M%S)
cp backend/src/lib/config.ts backups/fase1_$(date +%Y%m%d_%H%M%S)/
cp backend/src/engine/signalEngine.ts backups/fase1_$(date +%Y%m%d_%H%M%S)/
cp backend/src/engine/scalpingEngine.ts backups/fase1_$(date +%Y%m%d_%H%M%S)/
echo "✅ Backup criado em backups/fase1_$(date +%Y%m%d_%H%M%S)/"
echo ""

# Commit das mudanças
echo "📝 Fazendo commit..."
git add backend/src/lib/config.ts
git add backend/src/engine/signalEngine.ts
git add backend/src/engine/scalpingEngine.ts
git add FASE1_IMPLEMENTADA.md
git add ANALISE_DETALHADA_ROBOS.md
git commit -m "FASE 1: Vetos críticos implementados

- Score mínimo 1H: 85 → 90
- ICT confirmações: 1 → 2  
- ML threshold 1H: 55% → 65%
- Score mínimo 5M: 80 → 85
- ML threshold 5M: 62% → 65%
- Limite diário: 13 → 8 sinais/dia
- Veto contra tendência macro 4H

Objetivo: Melhorar win rate de 32.7% para 50%+
Redução esperada: 60-70% dos sinais (apenas os melhores)"

echo "✅ Commit realizado"
echo ""

# Push para o repositório
echo "🌐 Enviando para o repositório..."
git push
echo "✅ Push realizado"
echo ""

# Instruções para o VPS
echo "📡 PRÓXIMOS PASSOS NO VPS:"
echo "=================================="
echo ""
echo "1. Conectar no VPS:"
echo "   ssh root@212.85.10.239"
echo ""
echo "2. Atualizar código:"
echo "   cd /root/sinais-cripto"
echo "   git pull"
echo ""
echo "3. Reiniciar backend:"
echo "   pm2 restart backend"
echo ""
echo "4. Verificar logs:"
echo "   pm2 logs backend --lines 50"
echo ""
echo "5. Monitorar vetos:"
echo "   pm2 logs backend | grep 'FASE 1'"
echo "   pm2 logs backend | grep 'VETO'"
echo "   pm2 logs backend | grep 'score='"
echo ""
echo "=================================="
echo ""
echo "⚠️  IMPORTANTE:"
echo "  - Sinais vão diminuir drasticamente (esperado!)"
echo "  - Win rate pode demorar 3-5 dias para estabilizar"
echo "  - Monitorar Telegram para verificar qualidade"
echo ""
echo "✅ Deploy local concluído!"
echo "🎯 Objetivo: Win Rate 32.7% → 50%+"
