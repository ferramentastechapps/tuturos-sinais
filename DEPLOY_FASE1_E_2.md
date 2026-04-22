# 🚀 DEPLOY FASE 1 E 2 - COMANDOS

## ✅ Conflitos Resolvidos!

Os conflitos de merge foram resolvidos. Agora pode fazer o deploy:

```powershell
.\ship.ps1 "feat: FASE 1+2 - Vetos criticos + Trailing stop integrado (win rate 32->50%)"
```

## 📋 O que será deployado:

### FASE 1 (Vetos Críticos):
- Score mínimo: 85→90 (1H) e 80→85 (5M)
- ICT confirmações: 1→2
- ML threshold: 55%→65%
- Limite diário: 13→8 sinais/dia
- Veto contra tendência macro

### FASE 2 (Gestão de Posição):
- Trailing stop manager integrado
- Fechamentos parciais (40% TP1, 30% TP2)
- Break-even automático
- Trailing dinâmico (50%→30%→20% ATR)
- Alavancagem reduzida: 50x→30x (1H) e 25x→15x (5M)

## 🔍 Após o Deploy:

```powershell
# Ver logs
ssh root@212.85.10.239 "pm2 logs backend --lines 100"

# Ver status
ssh root@212.85.10.239 "pm2 status"

# Monitorar vetos
ssh root@212.85.10.239 "pm2 logs backend | grep 'FASE 1'"
ssh root@212.85.10.239 "pm2 logs backend | grep 'VETO'"

# Monitorar trailing stop
ssh root@212.85.10.239 "pm2 logs backend | grep 'TrailingStop'"
ssh root@212.85.10.239 "pm2 logs backend | grep 'Fechando'"
```

## ✅ Pronto para ship!
