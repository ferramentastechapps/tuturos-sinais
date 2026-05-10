#!/bin/bash
# Deploy All Fixes - 4 Correcoes ML + Trailing Stop Progressivo
# Data: 10/05/2026

echo "========================================"
echo "  DEPLOY: 5 CORRECOES CRITICAS"
echo "========================================"
echo ""

# Configuracao do VPS
VPS_HOST="root@165.227.200.87"
VPS_PATH="/root/tuturos-sinais"

echo "Correcoes que serao aplicadas:"
echo "  1. Confidence invertido (mlPredictionService.ts)"
echo "  2. Retreinamento com backup (mlRetrainJob.ts)"
echo "  3. Isolamento por moeda (train_model.py + engines)"
echo "  4. Filtro volatilidade alta (volatilityTracker.ts)"
echo "  5. Trailing stop progressivo (tradeTracker.ts)"
echo ""

# Passo 1: Compilar backend localmente
echo "Compilando backend TypeScript..."
cd backend
npm run build
if [ $? -ne 0 ]; then
    echo "ERRO na compilacao do backend"
    exit 1
fi
cd ..
echo "Backend compilado com sucesso"
echo ""

# Passo 2: Fazer backup no VPS
echo "Criando backup no VPS..."
ssh $VPS_HOST << 'EOF'
cd /root/tuturos-sinais
timestamp=$(date +%Y%m%d_%H%M%S)
mkdir -p backups
tar -czf backups/backup_$timestamp.tar.gz backend/dist backend/src ml_engine 2>/dev/null || true
echo "Backup criado: backups/backup_$timestamp.tar.gz"
EOF
echo "Backup criado"
echo ""

# Passo 3: Enviar arquivos TypeScript compilados
echo "Enviando backend compilado..."
scp -r backend/dist/* ${VPS_HOST}:${VPS_PATH}/backend/dist/
if [ $? -ne 0 ]; then
    echo "ERRO ao enviar backend compilado"
    exit 1
fi
echo "Backend enviado"
echo ""

# Passo 4: Enviar arquivos TypeScript fonte
echo "Enviando arquivos fonte TypeScript..."
for file in \
    "backend/src/ml/mlPredictionService.ts" \
    "backend/src/jobs/mlRetrainJob.ts" \
    "backend/src/types/mlTypes.ts" \
    "backend/src/engine/signalEngine.ts" \
    "backend/src/engine/scalpingEngine.ts" \
    "backend/src/services/volatilityTracker.ts" \
    "backend/src/trading/tradeTracker.ts"
do
    remoteDir=$(dirname $file)
    ssh $VPS_HOST "mkdir -p $VPS_PATH/$remoteDir"
    scp $file ${VPS_HOST}:${VPS_PATH}/${file}
    if [ $? -eq 0 ]; then
        echo "  OK: $file"
    else
        echo "  ERRO: $file"
    fi
done
echo "Arquivos TypeScript enviados"
echo ""

# Passo 5: Enviar arquivo Python
echo "Enviando train_model.py..."
scp ml_engine/train_model.py ${VPS_HOST}:${VPS_PATH}/ml_engine/train_model.py
if [ $? -eq 0 ]; then
    echo "train_model.py enviado"
else
    echo "ERRO ao enviar train_model.py"
fi
echo ""

# Passo 6: Reiniciar backend no VPS
echo "Reiniciando backend no VPS..."
ssh $VPS_HOST << 'EOF'
cd /root/tuturos-sinais/backend
pm2 restart backend
sleep 3
pm2 logs backend --lines 20 --nostream
EOF
echo "Backend reiniciado"
echo ""

# Passo 7: Verificar se esta rodando
echo "Verificando status..."
ssh $VPS_HOST "pm2 status backend"
echo ""

# Resumo
echo "========================================"
echo "  DEPLOY CONCLUIDO COM SUCESSO!"
echo "========================================"
echo ""
echo "Proximos passos:"
echo "  1. Monitore os logs:"
echo "     ssh root@165.227.200.87 'pm2 logs backend --lines 50'"
echo ""
echo "  2. Verifique as correcoes:"
echo "     - [ML-CONFIDENCE] - confidence correto"
echo "     - [MLRetrain] - backup e validacao"
echo "     - [VETO VOLATILIDADE ALTA] - filtro funcionando"
echo "     - [TradeTracker] Stop atualizado - trailing progressivo"
echo ""
echo "  3. Proximo retreinamento: 23:55 UTC (hoje)"
echo "     Modelos especificos por moeda serao criados"
echo ""
echo "Documentacao:"
echo "  - CORRECOES_CIRURGICAS_ML.md"
echo "  - FIX_TRAILING_STOP_PROGRESSIVO.md"
echo ""
