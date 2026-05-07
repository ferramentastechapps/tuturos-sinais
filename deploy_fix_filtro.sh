#!/bin/bash

echo "🚀 Deploy: Fix Filtro ML Analytics"
echo "=================================="

# 1. Atualizar Prisma
echo ""
echo "📦 1. Atualizando Prisma Schema..."
cd backend
npx prisma db pull
npx prisma generate

# 2. Rebuild Backend
echo ""
echo "🔨 2. Rebuilding Backend..."
npm run build

# 3. Restart Backend (VPS)
echo ""
echo "🔄 3. Restarting Backend..."
pm2 restart backend

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "🧪 Teste agora:"
echo "   1. Abra ML Analytics"
echo "   2. Clique em 'Swing Trading'"
echo "   3. Clique em 'Scalping'"
echo "   4. Os números devem mudar!"
echo ""
