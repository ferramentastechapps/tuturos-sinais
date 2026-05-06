# 🔍 Comandos para Diagnosticar Robô Parado

## Opção 1: Script PowerShell (Windows)

Execute no PowerShell local:

```powershell
.\Check-RoboStatus.ps1
```

## Opção 2: Comandos Diretos no SSH

Conecte ao VPS e execute:

```bash
ssh root@srv1009880.webtitans.host
```

Depois, copie e cole este bloco completo:

```bash
echo "═══ DIAGNÓSTICO RÁPIDO ═══"
echo ""
echo "1. PM2 Status:"
pm2 list
echo ""
echo "2. Uptime:"
pm2 info signal-engine | grep -E "uptime|restarts|status"
echo ""
echo "3. Últimos logs (50 linhas):"
pm2 logs signal-engine --lines 50 --nostream
echo ""
echo "4. Sinais hoje:"
TODAY=$(date +%Y-%m-%d)
echo "Data: $TODAY"
pm2 logs signal-engine --lines 1000 --nostream | grep "Signal generated" | grep "$TODAY" | wc -l
echo ""
echo "5. Últimos 5 sinais (qualquer dia):"
pm2 logs signal-engine --lines 2000 --nostream | grep "Signal generated" | tail -5
echo ""
echo "6. Erros recentes:"
pm2 logs signal-engine --lines 200 --nostream | grep -i "error" | tail -10
echo ""
echo "7. Config atual:"
cd /var/www/signal-dashboard/backend && grep -E "MAX_SIGNALS_PER_DAY|SIGNAL_INTERVAL_MS" .env
```

## Opção 3: Verificação Ultra-Rápida

```bash
# Status do PM2
pm2 list

# Últimos logs
pm2 logs signal-engine --lines 30

# Sinais hoje
pm2 logs signal-engine --lines 500 --nostream | grep "Signal generated" | grep "$(date +%Y-%m-%d)"

# Restart se necessário
pm2 restart signal-engine
```

## 🔴 Possíveis Causas

### 1. PM2 Parado
**Sintoma**: `pm2 list` mostra status "stopped" ou "errored"

**Solução**:
```bash
pm2 restart signal-engine
pm2 logs signal-engine --lines 50
```

### 2. Erro no Código
**Sintoma**: Logs mostram "Error", "Exception", "Crash"

**Solução**:
```bash
cd /var/www/signal-dashboard
git pull origin main
cd backend
npm run build
pm2 restart signal-engine
```

### 3. Limite Diário Atingido
**Sintoma**: Logs mostram "Daily signal limit reached"

**Verificar**:
```bash
cd /var/www/signal-dashboard/backend
grep MAX_SIGNALS_PER_DAY .env
```

**Ajustar** (se necessário):
```bash
# Aumentar limite
sed -i 's/MAX_SIGNALS_PER_DAY=.*/MAX_SIGNALS_PER_DAY=15/' .env
pm2 restart signal-engine
```

### 4. Todos os Sinais Vetados
**Sintoma**: Logs mostram muitos "VETO", "bloqueado", "blocked"

**Verificar**:
```bash
pm2 logs signal-engine --lines 500 --nostream | grep -i "VETO\|bloqueado" | tail -20
```

**Causas comuns**:
- Mercado sem volatilidade (ATR < 0.4%)
- Tendência fraca (ADX < 15)
- Todos os símbolos contra tendência 4H
- Score baixo (< 60)

### 5. Intervalo Muito Longo
**Sintoma**: Ciclos de análise muito espaçados

**Verificar**:
```bash
cd /var/www/signal-dashboard/backend
grep SIGNAL_INTERVAL_MS .env
```

**Valor atual**: 300000ms = 5 minutos (OK)

### 6. Banco de Dados Travado
**Sintoma**: Logs mostram "Database error", "Prisma error"

**Solução**:
```bash
cd /var/www/signal-dashboard/backend
npx prisma generate
pm2 restart signal-engine
```

### 7. API Bybit Fora
**Sintoma**: Logs mostram "Bybit API error", "Failed to fetch"

**Verificar**:
```bash
curl -s "https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT" | head -20
```

### 8. Memória Insuficiente
**Sintoma**: PM2 mostra muitos restarts, "out of memory"

**Verificar**:
```bash
free -h
pm2 info signal-engine | grep memory
```

**Solução**:
```bash
# Limpar memória
pm2 flush
pm2 restart signal-engine
```

## 📊 Interpretação dos Logs

### ✅ Funcionando Normal
```
Starting signal generation cycle...
Analyzing BTCUSDT...
Analyzing ETHUSDT...
Signal generated: BTCUSDT LONG score=75
Cycle completed in 2.3s
```

### ⚠️ Sem Oportunidades
```
Starting signal generation cycle...
Analyzing BTCUSDT... score=45 (below threshold)
Analyzing ETHUSDT... VETO: ADX too low
Analyzing SOLUSDT... VETO: Against 4H trend
Cycle completed in 1.8s - No signals generated
```

### ❌ Erro Crítico
```
Starting signal generation cycle...
Error: Cannot connect to database
Fatal: Uncaught exception
PM2: Process exited with code 1
```

## 🚀 Restart Completo (Se Nada Funcionar)

```bash
cd /var/www/signal-dashboard
git pull origin main
cd backend
npm install
npm run build
pm2 restart signal-engine
pm2 logs signal-engine --lines 50
```

## 📞 Suporte

Se após todos os diagnósticos o robô continuar sem gerar sinais:

1. Copie os últimos 100 logs: `pm2 logs signal-engine --lines 100 --nostream > /tmp/logs.txt`
2. Verifique o arquivo: `cat /tmp/logs.txt`
3. Compartilhe os logs para análise detalhada
