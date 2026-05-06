# 🔴 DIAGNÓSTICO: Robô Não Está Gerando Sinais

## ✅ STATUS ATUAL

**PM2**: Online (rodando normalmente)
**Memória**: 210.5mb (OK)
**Ciclos**: Executando a cada 5 minutos (OK)

## ❌ PROBLEMA IDENTIFICADO

### Erro nos Logs
```
Error: write ETIMEDOUT
code: 'ETIMEDOUT'
syscall: 'write'
_currentUrl: 'https://api.bybit.com/v5/market/tickers?category=linear&symbol=LTCUSDT'
```

### Resultado
```
Signal cycle complete: 0 new signals
totalActive: 42
signalsToday: 0
signalsSent: 0
```

## 🎯 CAUSA RAIZ

**Bybit API com timeout de conexão**

O robô está tentando buscar dados da Bybit, mas a conexão está falhando com timeout.

Possíveis causas:
1. ❌ Firewall do VPS bloqueando conexões
2. ❌ Rate limit da Bybit (muitas requisições)
3. ❌ Problema temporário na API da Bybit
4. ❌ Timeout muito curto na configuração

## 🔧 SOLUÇÕES

### Solução 1: Testar Conectividade (EXECUTE PRIMEIRO)

Copie e cole no SSH:

```bash
# Testar API Bybit
curl -s "https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT" | head -20

# Se retornar dados JSON = API está OK
# Se retornar erro/timeout = problema de rede
```

### Solução 2: Verificar Logs Detalhados

```bash
# Ver últimos 100 logs de erro
pm2 logs signal-engine --lines 100 --nostream --err

# Procurar por ETIMEDOUT
pm2 logs signal-engine --lines 200 --nostream --err | grep -A 10 "ETIMEDOUT"
```

### Solução 3: Restart Simples

```bash
# Restart do signal-engine
pm2 restart signal-engine

# Aguardar 10 segundos
sleep 10

# Verificar se voltou
pm2 logs signal-engine --lines 30
```

### Solução 4: Aumentar Timeout da API

```bash
cd /var/www/signal-dashboard/backend

# Adicionar timeout maior no .env
echo "BYBIT_API_TIMEOUT=30000" >> .env

# Restart
pm2 restart signal-engine
```

### Solução 5: Verificar Rate Limit

```bash
# Ver quantas requisições estão sendo feitas
pm2 logs signal-engine --lines 500 --nostream | grep "Bybit" | tail -20

# Se muitas requisições = adicionar delay
cd /var/www/signal-dashboard/backend
echo "BYBIT_REQUEST_DELAY=1000" >> .env
pm2 restart signal-engine
```

### Solução 6: Rebuild Completo (Se nada funcionar)

```bash
cd /var/www/signal-dashboard
git pull origin main
cd backend
npm install
npm run build
pm2 restart signal-engine
pm2 logs signal-engine --lines 50
```

## 📊 VERIFICAÇÃO PÓS-FIX

Após aplicar as soluções, verifique:

```bash
# 1. Logs não devem mostrar ETIMEDOUT
pm2 logs signal-engine --lines 50 --nostream --err | grep "ETIMEDOUT"

# 2. Ciclos devem completar com sucesso
pm2 logs signal-engine --lines 30 --nostream | grep "Signal cycle complete"

# 3. Sinais devem começar a ser gerados
pm2 logs signal-engine --lines 100 --nostream | grep "Signal generated"
```

## 🎯 SCRIPT AUTOMATIZADO

Execute este comando único no VPS:

```bash
cat > /tmp/fix_timeout.sh << 'EOF'
#!/bin/bash
echo "🔧 Corrigindo timeout da Bybit API..."

# Testar API
echo "1. Testando API..."
curl -s "https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT" | head -10

# Adicionar timeout maior
echo ""
echo "2. Aumentando timeout..."
cd /var/www/signal-dashboard/backend
grep -q "BYBIT_API_TIMEOUT" .env || echo "BYBIT_API_TIMEOUT=30000" >> .env

# Restart
echo ""
echo "3. Reiniciando..."
pm2 restart signal-engine
sleep 10

# Verificar
echo ""
echo "4. Verificando logs..."
pm2 logs signal-engine --lines 20 --nostream

echo ""
echo "✅ Feito! Aguarde 5 minutos e verifique se sinais estão sendo gerados."
EOF

chmod +x /tmp/fix_timeout.sh
bash /tmp/fix_timeout.sh
```

## 📈 MONITORAMENTO

Após aplicar o fix, monitore por 15 minutos:

```bash
# Ver logs em tempo real
pm2 logs signal-engine

# Pressione Ctrl+C para sair
```

**O que esperar**:
- ✅ Sem erros "ETIMEDOUT"
- ✅ "Signal cycle complete" a cada 5 minutos
- ✅ "Signal generated" quando houver oportunidades
- ✅ Ou "0 new signals" se não houver oportunidades (normal)

## ⚠️ NOTA IMPORTANTE

**0 sinais gerados NEM SEMPRE é um problema!**

Se os logs mostram:
```
Signal cycle complete: 0 new signals
```

**SEM erros ETIMEDOUT**, significa que:
- ✅ Robô está funcionando
- ✅ API está respondendo
- ❌ Mas não há oportunidades no momento (score < 60, vetos ativos, etc.)

Isso é **NORMAL** em períodos de baixa volatilidade ou mercado lateral.

## 🔍 DIFERENÇA ENTRE PROBLEMAS

### ❌ Robô Quebrado (ETIMEDOUT)
```
Error: write ETIMEDOUT
Signal cycle complete: 0 new signals
```
**Ação**: Aplicar fix de timeout

### ✅ Robô OK, Sem Oportunidades
```
Signal cycle complete: 0 new signals
(sem erros ETIMEDOUT)
```
**Ação**: Aguardar mercado melhorar

### ✅ Robô OK, Gerando Sinais
```
Signal generated: BTCUSDT LONG score=75
Signal cycle complete: 1 new signals
```
**Ação**: Nenhuma, está perfeito!

## 📞 PRÓXIMOS PASSOS

1. Execute o script automatizado acima
2. Aguarde 15 minutos
3. Verifique se sinais estão sendo gerados
4. Se continuar sem sinais MAS sem erros ETIMEDOUT = normal (mercado sem oportunidades)
5. Se continuar com ETIMEDOUT = problema de rede/firewall do VPS
