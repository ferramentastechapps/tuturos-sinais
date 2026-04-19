#!/bin/bash
# deploy_train_ml.sh — Envia scripts ML para a VPS e treina o modelo imediatamente

VPS="root@212.85.10.239"
VPS_DIR="/var/www/signal-dashboard/backend"

echo "🤖 Deploy + Treinamento ML"
echo "=========================="
echo ""

# 1. Enviar scripts
echo "📤 [1/3] Enviando scripts para VPS..."
rsync -avz \
  backend/scripts/migrate_historical_to_training.py \
  backend/scripts/train_super_robot.sh \
  "$VPS:$VPS_DIR/scripts/"
echo "✅ Scripts enviados"
echo ""

# 2. Permissão de execução
echo "🔑 [2/3] Ajustando permissões..."
ssh "$VPS" "chmod +x $VPS_DIR/scripts/train_super_robot.sh"
echo "✅ Permissões OK"
echo ""

# 3. Rodar treinamento
echo "🧠 [3/3] Iniciando treinamento na VPS..."
echo "   (isso pode levar 2-5 minutos)"
echo ""
ssh "$VPS" "cd $VPS_DIR && bash scripts/train_super_robot.sh"
