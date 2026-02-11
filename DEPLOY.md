# Deploy do Sistema de Sinais (Signal Engine)

Guia completo para colocar o sistema em produção na VPS.

## 1. Acesso à VPS

Acesse seu servidor via SSH:
```bash
ssh root@IP_DA_VPS
```

## 2. Configuração Inicial (Setup)

Você pode clonar o repositório ou subir os arquivos manualmente.

### Opção A: Clonar Repositório
```bash
git clone https://github.com/seu-usuario/seu-repo.git /var/www/signal-dashboard
cd /var/www/signal-dashboard
```

### Opção B: Subir Arquivos (SCP/SFTP)
Suba o conteúdo do projeto para `/var/www/signal-dashboard`.

### Rodar Script de Instalação
Este script instala Node.js, PM2, Nginx e configura o firewall.

```bash
cd /var/www/signal-dashboard
chmod +x infrastructure/setup.sh
bash infrastructure/setup.sh
```

## 3. Configuração de Variáveis

Crie o arquivo `.env` definitivo na pasta backend:

```bash
cd backend
cp .env.production .env
nano .env
```
Preencha todas as variáveis (API Keys, Supabase, Telegram).

## 4. Deploy da Aplicação

O script de deploy vai:
- Baixar código atualizado
- Instalar dependências
- Compilar backend (TypeScript)
- Compilar frontend (Vite build)
- Configurar Nginx
- Reiniciar serviços PM2

```bash
cd /var/www/signal-dashboard
chmod +x infrastructure/deploy.sh
bash infrastructure/deploy.sh
```

## 5. Verificação

Verifique se os serviços estão rodando:

```bash
pm2 status
```
Deve mostrar: `signal-engine` e `telegram-bot` como "online".

Verifique os logs em tempo real:
```bash
pm2 logs signal-engine
```

Teste o health check:
```bash
curl http://localhost:3001/api/health
```

## 6. Configurar SSL (Recomendado)

O Nginx já está pré-configurado. Para ativar HTTPS gratuito:

```bash
certbot --nginx -d seu-dominio.com
```

## 7. Monitoramento

- **Logs de Erro:** `cat backend/logs/signal-engine-error.log`
- **Monitoramento Telegram:** O sistema enviará alertas automaticamente se configurado.

---
**Estrutura de Pastas na VPS:**
- `/var/www/signal-dashboard/backend` (API e Engine)
- `/var/www/signal-dashboard/dist` (Frontend estático)
