#!/bin/bash

echo "🚀 DEPLOY INICIAL COMPLETO - ROBÔS DE TRADING"
echo "============================================================"
echo ""

VPS="root@212.85.10.239"
VPS_DIR="/root/tuturos-sinais"

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Build local
echo -e "${YELLOW}📦 [1/7] Build local do backend...${NC}"
cd backend
npm run build
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Erro no build local!${NC}"
  exit 1
fi
cd ..
echo -e "${GREEN}✅ Build local concluído${NC}"
echo ""

# 2. Criar estrutura na VPS
echo -e "${YELLOW}📁 [2/7] Criando estrutura de diretórios na VPS...${NC}"
ssh $VPS << 'EOF'
mkdir -p /root/tuturos-sinais/backend
mkdir -p /root/tuturos-sinais/backend/scripts
mkdir -p /root/tuturos-sinais/backend/logs
echo "✅ Diretórios criados"
EOF
echo ""

# 3. Enviar código do backend
echo -e "${YELLOW}📤 [3/7] Enviando código do backend para VPS...${NC}"
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude '.env' \
  backend/ $VPS:$VPS_DIR/backend/
echo -e "${GREEN}✅ Código enviado${NC}"
echo ""

# 4. Enviar .env
echo -e "${YELLOW}🔐 [4/7] Configurando variáveis de ambiente...${NC}"
scp .env $VPS:$VPS_DIR/backend/.env
echo -e "${GREEN}✅ .env configurado${NC}"
echo ""

# 5. Instalar dependências e build na VPS
echo -e "${YELLOW}📦 [5/7] Instalando dependências na VPS...${NC}"
ssh $VPS << 'EOF'
cd /root/tuturos-sinais/backend
npm install --production
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Erro no build na VPS!"
  exit 1
fi
echo "✅ Dependências instaladas e build concluído"
EOF
echo ""

# 6. Configurar PM2
echo -e "${YELLOW}⚙️  [6/7] Configurando PM2...${NC}"
ssh $VPS << 'EOF'
cd /root/tuturos-sinais/backend

# Criar ecosystem.config.js se não existir
cat > ecosystem.config.js << 'EOFPM2'
module.exports = {
  apps: [
    {
      name: 'signal-engine',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
EOFPM2

echo "✅ ecosystem.config.js criado"

# Iniciar com PM2
pm2 delete signal-engine 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "✅ PM2 configurado e iniciado"
EOF
echo ""

# 7. Verificar status
echo -e "${YELLOW}🔍 [7/7] Verificando status...${NC}"
echo ""
ssh $VPS << 'EOF'
echo "📊 Status do PM2:"
pm2 list

echo ""
echo "📝 Últimas 30 linhas de log:"
pm2 logs signal-engine --lines 30 --nostream

echo ""
echo "💾 Uso de memória:"
free -h | grep Mem

echo ""
echo "🌐 Testando API:"
sleep 3
curl -s http://localhost:3000/api/health || echo "⚠️  API ainda não respondeu"
EOF

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}✅ DEPLOY COMPLETO CONCLUÍDO!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "📊 Próximos passos:"
echo "  1. Verificar logs: ssh $VPS 'pm2 logs signal-engine'"
echo "  2. Testar API: curl https://sinaiscripto.ftech-apps.com.br/api/health"
echo "  3. Verificar sinais: node check_robots_status.mjs"
echo "  4. Treinar ML: bash deploy_train_ml.sh"
echo ""
