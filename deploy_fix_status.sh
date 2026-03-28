#!/bin/bash

echo "🚀 Deploy: Correção de Status dos Sinais"
echo "========================================"
echo ""

# 1. Build local
echo "📦 [1/5] Build do backend..."
cd backend
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Erro no build!"
  exit 1
fi
cd ..
echo "✅ Build concluído"
echo ""

# 2. Enviar código para VPS
echo "📤 [2/5] Enviando código para VPS..."
rsync -avz --exclude 'node_modules' --exclude '.env' --exclude 'dist' \
  backend/ root@212.85.10.239:/root/tuturos-sinais/backend/
echo "✅ Código enviado"
echo ""

# 3. Build na VPS
echo "🔨 [3/5] Build na VPS..."
ssh root@212.85.10.239 << 'EOF'
cd /root/tuturos-sinais/backend
npm run build
EOF
echo "✅ Build na VPS concluído"
echo ""

# 4. Executar migração de status
echo "🔧 [4/5] Migrando status dos sinais..."
ssh root@212.85.10.239 << 'EOF'
cd /root/tuturos-sinais/backend
node scripts/fix_signal_status.mjs
EOF
echo "✅ Migração concluída"
echo ""

# 5. Reiniciar backend
echo "♻️  [5/5] Reiniciando backend..."
ssh root@212.85.10.239 << 'EOF'
pm2 restart signal-engine
pm2 logs signal-engine --lines 20
EOF
echo ""
echo "✅ Deploy concluído!"
echo ""
echo "📊 Verificar resultados em: https://sinaiscripto.ftech-apps.com.br"
