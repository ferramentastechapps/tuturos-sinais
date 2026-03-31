#!/bin/bash

echo "🚀 Deploy: Fix Scalping Engine + Cancelamento de Sinais Duplicados"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}1. Compilando backend...${NC}"
cd backend
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Erro na compilação!"
    exit 1
fi
cd ..

echo -e "${GREEN}✅ Compilação concluída${NC}"
echo ""

echo -e "${YELLOW}2. Enviando arquivos para VPS...${NC}"
rsync -avz --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    backend/ root@212.85.10.239:/root/tuturos-sinais/backend/

echo -e "${GREEN}✅ Arquivos enviados${NC}"
echo ""

echo -e "${YELLOW}3. Compilando no VPS...${NC}"
ssh root@212.85.10.239 << 'EOF'
cd /root/tuturos-sinais/backend
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Erro na compilação no VPS!"
    exit 1
fi
EOF

echo -e "${GREEN}✅ Compilação no VPS concluída${NC}"
echo ""

echo -e "${YELLOW}4. Reiniciando PM2...${NC}"
ssh root@212.85.10.239 'cd /root/tuturos-sinais/backend && pm2 restart all'

echo -e "${GREEN}✅ PM2 reiniciado${NC}"
echo ""

echo -e "${YELLOW}5. Verificando logs...${NC}"
ssh root@212.85.10.239 'pm2 logs --lines 30'

echo ""
echo -e "${GREEN}🎉 Deploy concluído!${NC}"
echo ""
echo "Alterações aplicadas:"
echo "  ✅ Cancelamento automático de sinais duplicados"
echo "  ✅ Stop Loss dinâmico no scalping (0.8-0.9x ATR)"
echo "  ✅ Take Profits contextuais (ICT, Sweep, Squeeze)"
echo "  ✅ Alavancagem inteligente (3x-25x)"
echo ""
echo "Documentação:"
echo "  - docs/FIX_SINAIS_DUPLICADOS.md"
echo "  - docs/FIX_SCALPING_DINAMICO.md"
echo "  - RESUMO_ML_APRENDIZADO.md"
