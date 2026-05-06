#!/bin/bash
# Deploy das melhorias de Backtesting

echo "═══════════════════════════════════════════════════════"
echo "DEPLOY: Melhorias de Backtesting"
echo "═══════════════════════════════════════════════════════"
echo ""

echo "📋 Funcionalidades:"
echo "  1. Seletor de Robô (Swing vs Scalping)"
echo "  2. Estratégias Dinâmicas"
echo "  3. Adicionar Novas Estratégias"
echo ""

# Deploy no VPS
ssh root@srv1009880.webtitans.host << 'ENDSSH'

echo "1️⃣ Navegando para o diretório..."
cd /var/www/signal-dashboard

echo ""
echo "2️⃣ Pulling latest changes..."
git pull origin main

echo ""
echo "3️⃣ Criando tabela no Supabase..."
echo "⚠️  ATENÇÃO: Execute manualmente no Supabase SQL Editor:"
echo "   backend/sql/create_backtest_strategies_table.sql"
echo ""
read -p "Pressione ENTER após executar o SQL no Supabase..."

echo ""
echo "4️⃣ Rebuilding backend..."
cd backend
npm run build

echo ""
echo "5️⃣ Restarting PM2..."
pm2 restart signal-engine

echo ""
echo "6️⃣ Verificando logs..."
pm2 logs signal-engine --lines 20 --nostream

echo ""
echo "7️⃣ Testando endpoints..."
echo "GET /api/backtest/strategies"
curl -s http://localhost:3001/api/backtest/strategies | head -20

echo ""
echo "GET /api/backtest/robot-config/swing"
curl -s http://localhost:3001/api/backtest/robot-config/swing | head -20

echo ""
echo "GET /api/backtest/robot-config/scalping"
curl -s http://localhost:3001/api/backtest/robot-config/scalping | head -20

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ DEPLOY BACKEND COMPLETO!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📋 Próximos passos:"
echo "  1. Rebuild do frontend: npm run build"
echo "  2. Deploy do frontend para hosting"
echo "  3. Testar no browser: /backtesting"
echo ""

ENDSSH

echo ""
echo "✅ Deploy completo!"
