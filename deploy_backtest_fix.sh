#!/bin/bash
# Deploy da correção de datas do backtest para VPS

echo "═══════════════════════════════════════════════════════"
echo "DEPLOY: Correção de Datas do Backtest (2026 → 2024)"
echo "═══════════════════════════════════════════════════════"
echo ""

ssh root@srv1009880.webtitans.host << 'ENDSSH'
cd /var/www/signal-dashboard

echo "1. Pulling latest changes..."
git pull origin main

echo ""
echo "2. Building backend..."
cd backend
npm run build

echo ""
echo "3. Running backtest validation..."
npx tsx scripts/validate-corrections.ts

echo ""
echo "✅ Deploy completo!"
ENDSSH
