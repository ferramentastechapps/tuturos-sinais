#!/bin/bash

# Deploy Telegram Bot Critical Fixes
# Corrige: TypeError toFixed() e Stop Loss Repetidos

echo "🚀 Deploying Telegram Bot Critical Fixes..."

# 1. Build backend
echo "📦 Building backend..."
cd backend
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# 2. Restart PM2 process
echo "🔄 Restarting Signal Engine..."
pm2 restart signal-engine

# 3. Check logs
echo "📋 Checking logs..."
pm2 logs signal-engine --lines 20 --nostream

echo ""
echo "✅ Deploy completed!"
echo ""
echo "🔍 Monitoring:"
echo "   pm2 logs signal-engine"
echo "   pm2 monit"
echo ""
echo "📊 Fixes Applied:"
echo "   ✓ formatPrice() agora trata undefined/null"
echo "   ✓ Stop Loss remove sinal da memória ANTES de notificar"
echo "   ✓ Proteção contra múltiplos triggers no mesmo tick"
echo "   ✓ Iteração usa cópia do array para evitar race conditions"
