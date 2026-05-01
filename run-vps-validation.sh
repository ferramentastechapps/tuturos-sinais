#!/bin/bash
# Script para executar validação do backtest na VPS

set -e

echo "═══════════════════════════════════════════════════════"
echo "VALIDAÇÃO DAS CORREÇÕES DO BACKTEST NA VPS"
echo "═══════════════════════════════════════════════════════"

# PASSO 2: Verificar deploy
echo -e "\n[PASSO 2] Verificando status do deploy..."
pm2 status

cd /var/www/signal-dashboard/backend

if [ ! -f "scripts/validate-corrections.ts" ]; then
    echo "⚠️  Script não encontrado, fazendo git pull..."
    cd /var/www/signal-dashboard
    git pull
    cd backend
fi

ls -lh scripts/validate-corrections.ts

# PASSO 3: Verificar Node e dependências
echo -e "\n[PASSO 3] Verificando ambiente..."
node --version

if [ ! -f "node_modules/.bin/tsx" ]; then
    echo "⚠️  tsx não encontrado, instalando..."
    npm install -D tsx
else
    echo "✅ tsx OK"
fi

# PASSO 4: Executar backtest
echo -e "\n[PASSO 4] Executando backtest de validação..."
echo "⏳ Isso pode levar 5-15 minutos..."
cd /var/www/signal-dashboard/backend
npx tsx scripts/validate-corrections.ts 2>&1 | tee /tmp/backtest-result.txt

# PASSO 5: Mostrar resultado
echo -e "\n[PASSO 5] Resultado do backtest:"
cat /tmp/backtest-result.txt | tail -60

echo -e "\n[PASSO 5] CSVs gerados:"
ls -lh backtest-results/ 2>/dev/null || ls -lh backtesting/results/ 2>/dev/null || echo "Nenhum CSV encontrado"

# PASSO 6: Logs do robô
echo -e "\n[PASSO 6] Logs recentes do robô em produção:"
pm2 logs signal-engine --lines 30 --nostream

echo -e "\n✅ Validação completa!"
