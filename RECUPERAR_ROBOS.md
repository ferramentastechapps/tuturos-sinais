# 🚨 RECUPERAÇÃO DOS ROBÔS - GUIA RÁPIDO

## ❌ PROBLEMA IDENTIFICADO

- **ROBÔS NÃO ESTÃO DEPLOYADOS NA VPS!**
- O projeto `tuturos-sinais` não existe em `/root/tuturos-sinais/`
- Apenas o projeto `affiliate-hub` está rodando
- **Nenhum sinal nas últimas 2 horas**
- **ML Training desatualizado** (69 dias atrás)

---

## 🔧 SOLUÇÃO: DEPLOY INICIAL COMPLETO

### Opção 1: Deploy Automático (RECOMENDADO)

### 1️⃣ Verificar Status no VPS

```bash
ssh root@185.211.6.46
pm2 list
pm2 logs --lines 50
```

### 2️⃣ Se os processos estiverem parados:

```bash
cd /root/tuturos-sinais/backend
pm2 restart all
pm2 logs
```

### 3️⃣ Se houver erro, reiniciar do zero:

```bash
cd /root/tuturos-sinais/backend
pm2 delete all
npm run build
pm2 start ecosystem.config.js
pm2 save
```

### 4️⃣ Verificar logs em tempo real:

```bash
pm2 logs --lines 100
```

---

## 🔍 COMANDOS DE DIAGNÓSTICO

### Verificar se o backend está respondendo:
```bash
curl https://sinaiscripto.ftech-apps.com.br/api/health
```

### Verificar memória:
```bash
ssh root@185.211.6.46 "free -h"
```

### Verificar disco:
```bash
ssh root@185.211.6.46 "df -h"
```

### Verificar processos Node:
```bash
ssh root@185.211.6.46 "ps aux | grep node"
```

---

## � VERIFICAR SE VOLTOU A FUNCIONAR

Execute localmente:
```bash
node check_robots_status.mjs
```

Deve mostrar sinais recentes se os robôs voltaram a funcionar.

---

## 🆘 SE NADA FUNCIONAR

1. **Verificar logs de erro:**
   ```bash
   ssh root@185.211.6.46 "pm2 logs --err --lines 200"
   ```

2. **Verificar se as APIs externas estão funcionando:**
   - Binance API
   - CoinGecko API
   - Fear & Greed Index

3. **Verificar credenciais no VPS:**
   ```bash
   ssh root@185.211.6.46 "cat /root/tuturos-sinais/backend/.env"
   ```

4. **Último recurso - Reboot do VPS:**
   ```bash
   ssh root@185.211.6.46 "reboot"
   ```
   Aguardar 2 minutos e reconectar para reiniciar os processos.

---

## ✅ CHECKLIST DE RECUPERAÇÃO

- [ ] Conectar no VPS
- [ ] Verificar status do PM2
- [ ] Verificar logs de erro
- [ ] Reiniciar processos se necessário
- [ ] Aguardar 5 minutos
- [ ] Executar `check_robots_status.mjs`
- [ ] Confirmar que sinais estão sendo gerados
- [ ] Verificar Telegram recebendo notificações

---

## 📝 PRÓXIMOS PASSOS APÓS RECUPERAÇÃO

1. Treinar o modelo ML novamente
2. Verificar win rate dos sinais
3. Ajustar parâmetros se necessário
4. Configurar monitoramento automático
