#!/bin/bash

echo "🚀 Fix Filtro ML Analytics - VPS"
echo "=================================="
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}IMPORTANTE: Execute este script NA VPS!${NC}"
echo ""
echo "Este script vai:"
echo "  1. Adicionar coluna trade_type no Supabase"
echo "  2. Atualizar registros existentes"
echo "  3. Rebuild do backend"
echo "  4. Restart do PM2"
echo ""
read -p "Pressione ENTER para continuar ou CTRL+C para cancelar..."

# 1. Adicionar coluna no Supabase via SQL
echo ""
echo "📊 1. Adicionando coluna trade_type no Supabase..."
echo ""
echo "Execute este SQL no Supabase Dashboard:"
echo "========================================"
echo ""
echo "ALTER TABLE ml_training_data ADD COLUMN IF NOT EXISTS trade_type TEXT;"
echo "UPDATE ml_training_data SET trade_type = 'swing' WHERE trade_type IS NULL;"
echo "SELECT trade_type, COUNT(*) FROM ml_training_data GROUP BY trade_type;"
echo ""
echo "========================================"
echo ""
read -p "Executou o SQL no Supabase? (s/n): " executou

if [ "$executou" != "s" ]; then
    echo "❌ Cancelado. Execute o SQL primeiro!"
    exit 1
fi

# 2. Atualizar Prisma
echo ""
echo "📦 2. Atualizando Prisma..."
cd ~/tuturos-sinais/backend || exit 1
npx prisma db pull
npx prisma generate

# 3. Rebuild
echo ""
echo "🔨 3. Rebuilding backend..."
npm run build

# 4. Restart PM2
echo ""
echo "🔄 4. Restarting PM2..."
pm2 restart backend

echo ""
echo -e "${GREEN}✅ Deploy concluído!${NC}"
echo ""
echo "🧪 Teste agora:"
echo "   1. Abra: https://sinaiscripto.ftech-apps.com.br/ml-analytics"
echo "   2. Clique em 'Swing Trading'"
echo "   3. Clique em 'Scalping'"
echo "   4. Os números devem mudar!"
echo ""
