# 🔴 RESUMO: Robô Sem Sinais Hoje

## 📊 SITUAÇÃO ATUAL

**Status PM2**: ✅ Online (rodando)
**Memória**: ✅ 210.5mb (OK)
**Ciclos**: ✅ Executando a cada 5min

**Sinais hoje**: ❌ 0
**Erro**: ❌ ETIMEDOUT (timeout na API Bybit)

## 🎯 PROBLEMA

```
Error: write ETIMEDOUT
_currentUrl: 'https://api.bybit.com/v5/market/tickers?category=linear&symbol=LTCUSDT'
```

O robô está tentando buscar dados da Bybit, mas a conexão está falhando com timeout.

## ✅ SOLUÇÃO RÁPIDA

**Copie e cole este comando no SSH do VPS**:

```bash
cat > /tmp/fix_robo.sh << 'EOF'
#!/bin/bash
echo "🔧 Corrigindo timeout..."
cd /var/www/signal-dashboard/backend
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
grep -q "BYBIT_API_TIMEOUT" .env && sed -i 's/BYBIT_API_TIMEOUT=.*/BYBIT_API_TIMEOUT=30000/' .env || echo "BYBIT_API_TIMEOUT=30000" >> .env
pm2 restart signal-engine
sleep 8
pm2 logs signal-engine --lines 20
echo "✅ Feito! Aguarde 5-10 minutos e verifique os logs."
EOF
chmod +x /tmp/fix_robo.sh && bash /tmp/fix_robo.sh
```

## 📋 O QUE O FIX FAZ

1. ✅ Aumenta timeout da API Bybit de padrão → 30 segundos
2. ✅ Faz backup do `.env` antes de modificar
3. ✅ Reinicia o signal-engine
4. ✅ Mostra logs para verificação

## 🔍 VERIFICAÇÃO PÓS-FIX

Após 5-10 minutos, execute:

```bash
# Ver logs em tempo real
pm2 logs signal-engine

# Ou últimos 50 logs
pm2 logs signal-engine --lines 50 --nostream

# Verificar se há erros ETIMEDOUT
pm2 logs signal-engine --lines 100 --nostream --err | grep "ETIMEDOUT"
```

**O que esperar**:
- ✅ Sem erros "ETIMEDOUT"
- ✅ "Signal cycle complete" a cada 5 minutos
- ✅ "Signal generated" quando houver oportunidades

## ⚠️ IMPORTANTE

**0 sinais NEM SEMPRE é problema!**

Se após o fix os logs mostram:
```
Signal cycle complete: 0 new signals
```

**SEM erros ETIMEDOUT** = Robô OK, mas sem oportunidades no momento.

Isso é **NORMAL** quando:
- Mercado lateral (baixa volatilidade)
- Todos os símbolos com score < 60
- Vetos ativos (ADX < 15, ATR < 0.4%, contra tendência 4H)

## 📞 SE O PROBLEMA PERSISTIR

Se após o fix continuar com ETIMEDOUT:

1. **Testar API manualmente**:
```bash
curl -s "https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT" | head -20
```

2. **Verificar firewall do VPS**:
```bash
sudo ufw status
```

3. **Rebuild completo**:
```bash
cd /var/www/signal-dashboard
git pull origin main
cd backend
npm run build
pm2 restart signal-engine
```

## 📁 DOCUMENTAÇÃO COMPLETA

- `DIAGNOSTICO_ROBO_PARADO.md` - Diagnóstico detalhado
- `COMANDO_FIX_RAPIDO.txt` - Comando único para copiar/colar
- `fix_bybit_timeout.sh` - Script completo de diagnóstico
