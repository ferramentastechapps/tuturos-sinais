#!/bin/bash

# ==========================================
# Configurações do Deploy
# ==========================================
VPS_HOST="212.85.10.239"
VPS_USER="root"
VPS_PATH="/var/www/signal-dashboard"

# ==========================================
# Cores e Emojis para Feedback Visual
# ==========================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CHECK_MARK="✅"
CROSS_MARK="❌"
INFO="ℹ️ "
ROCKET="🚀"
LOADING="⏳"
PACKAGE="📦"

# ==========================================
# Funções Auxiliares
# ==========================================
print_step() {
  echo -e "\n${BLUE}==========================================${NC}"
  echo -e "${BLUE}${1}${NC}"
  echo -e "${BLUE}==========================================${NC}"
}

print_success() {
  echo -e "${GREEN}${CHECK_MARK} ${1}${NC}"
}

print_error() {
  echo -e "${RED}${CROSS_MARK} Erro: ${1}${NC}"
  exit 1
}

print_warning() {
  echo -e "${YELLOW}${INFO} Aviso: ${1}${NC}"
}

# ==========================================
# 1. VALIDAÇÕES INICIAIS
# ==========================================
print_step "$LOADING ETAPA 1: Validações Iniciais"

# Verificar mensagem de commit
COMMIT_MSG="$1"
if [ -z "$COMMIT_MSG" ]; then
  print_error "Mensagem de commit não fornecida!\nUso: ./deploy-to-vps.sh \"sua mensagem de commit\""
fi

# Verificar conexão com o Git (checa se o remote responde)
echo -e "${INFO} Verificando conexão com o repositório remoto..."
git ls-remote origin > /dev/null 2>&1
if [ $? -ne 0 ]; then
  print_error "Sem conexão com o repositório remoto do Git (origin)."
fi

# Verificar se há alterações para commitar
if [ -z "$(git status --porcelain)" ]; then
  print_warning "Nenhuma alteração detectada no repositório."
  read -p "Deseja continuar com o deploy mesmo assim? (s/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo -e "${YELLOW}Deploy cancelado pelo usuário.${NC}"
    exit 0
  fi
else
  print_success "Alterações detectadas."
fi

print_success "Validações concluídas."

# ==========================================
# 2. GIT LOCAL
# ==========================================
print_step "$PACKAGE ETAPA 2: Sincronização com GitHub"

# Adicionar arquivos
echo -e "${LOADING} Adicionando arquivos (git add .)..."
git add .

# Commitar
echo -e "${LOADING} Criando commit: \"$COMMIT_MSG\"..."
git commit -m "$COMMIT_MSG" > /dev/null
if [ $? -eq 0 ]; then
  print_success "Commit criado com sucesso."
else
  print_warning "Nenhum arquivo novo para commitar, continuando..."
fi

# Push
echo -e "${LOADING} Enviando para origin main..."
git push origin main
if [ $? -ne 0 ]; then
  print_error "Falha ao enviar código para o GitHub (git push)."
fi

print_success "Código sincronizado com GitHub!"

# ==========================================
# 3. DEPLOY NA VPS
# ==========================================
print_step "$ROCKET ETAPA 3: Deploy na VPS"

echo -e "${LOADING} Conectando via SSH e atualizando código..."

# Comando SSH completo
ssh $VPS_USER@$VPS_HOST << EOF
  echo -e "Conectado na VPS com sucesso!"
  
  # Navegar até o diretório do projeto
  cd $VPS_PATH || { echo -e "ERRO: Diretório $VPS_PATH não encontrado na VPS!"; exit 1; }
  
  # Atualizar código
  echo -e "\nAtualizando código do Git..."
  git pull origin main || { echo -e "ERRO: Falha ao fazer pull do repositório remoto na VPS!"; exit 1; }
  
  # Executar script de deploy (se existir e for executável)
  if [ -f "infrastructure/deploy.sh" ] && [ -x "infrastructure/deploy.sh" ]; then
     echo -e "\nRodando script interno de deploy..."
     bash infrastructure/deploy.sh || { echo -e "ERRO: Falha durante a execução de infrastructure/deploy.sh!"; exit 1; }
  else
     echo -e "\nAviso: infrastructure/deploy.sh não encontrado ou sem permissão de execução, utilizando npm diretos..."
     npm install
     npm run build
  fi
  
  # Reiniciar processos do PM2
  echo -e "\nReiniciando a aplicação com PM2..."
  pm2 restart all || { echo -e "ERRO: Falha ao reiniciar a aplicação no PM2!"; exit 1; }
  
  echo -e "\n✅ Processos reiniciados com sucesso!"
EOF

if [ $? -ne 0 ]; then
  print_error "A conexão SSH ou a execução dos comandos na VPS falhou."
fi

# ==========================================
# 4. FEEDBACK VISUAL
# ==========================================
print_step "🎉 DEPLOY CONCLUÍDO COM SUCESSO!"
echo -e "${GREEN}Seu código foi atualizado e a aplicação foi reiniciada na VPS.${NC}"
echo -e "${GREEN}Acesse o dashboard para verificar as alterações.${NC}"
echo ""

# Dica de permissão de execução
# chmod +x deploy-to-vps.sh
