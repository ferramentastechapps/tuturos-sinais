# 📊 PLANO DE MONITORAMENTO - 3 DIAS

## ✅ AJUSTE APLICADO - 01/05/2026 12:11 UTC

### Configuração Atual:
```bash
MAX_SIGNALS_PER_DAY=10  (era 3)
SIGNAL_INTERVAL_MS=300000  (5 minutos)
```

### Backup:
```bash
.env.backup.20260501_114625
```

---

## 🎯 OBJETIVOS DO TESTE (3 DIAS)

### Dia 1 (01/05/2026):
- ✅ Verificar se sinais aumentaram de 3 → 10
- ✅ Monitorar qualidade (score ≥60)
- ✅ Confirmar 0 VETOs (filtros não bloqueando)

### Dia 2 (02/05/2026):
- ✅ Avaliar win rate dos sinais gerados
- ✅ Verificar SL rate (meta: <60%)
- ✅ Analisar símbolos que geraram sinais

### Dia 3 (03/05/2026):
- ✅ Decisão: manter 10, aumentar para 15-25, ou voltar para 3
- ✅ Calcular métricas finais
- ✅ Ajustar se necessário

---

## 📋 COMANDOS DE MONITORAMENTO

### 1. Verificar sinais gerados hoje:
```bash
pm2 logs signal-engine --lines 5000 --nostream | \
  grep "Signal generated" | \
  grep "$(date +%Y-%m-%d)" | \
  wc -l
```

### 2. Ver últimos 10 sinais:
```bash
pm2 logs signal-engine --lines 5000 --nostream | \
  grep "Signal generated" | \
  tail -10
```

### 3. Verificar se há VETOs:
```bash
pm2 logs signal-engine --lines 2000 --nostream | \
  grep -i "VETO" | \
  wc -l
```

### 4. Monitorar em tempo real:
```bash
pm2 logs signal-engine --lines 50
```

### 5. Verificar contador diário:
```bash
pm2 logs signal-engine --lines 100 --nostream | \
  grep "Signal cycle complete" | \
  tail -5
```

---

## 📊 MÉTRICAS ESPERADAS

### Cenário Ideal (após 3 dias):

| Métrica | Baseline | Meta | Status |
|---------|----------|------|--------|
| Sinais/dia | 3 | 8-10 | ⏳ Monitorando |
| Win Rate | 17% | >35% | ⏳ Aguardando dados |
| SL Rate | 83% | <60% | ⏳ Aguardando dados |
| Score médio | 70 | ≥65 | ⏳ Aguardando dados |
| VETOs | 0 | 0 | ✅ Confirmado |

---

## 🔍 CHECKLIST DIÁRIO

### Dia 1 - 01/05/2026 ✅
- [x] Ajuste aplicado (12:11 UTC)
- [ ] Verificar às 18:00 UTC (6h depois)
- [ ] Verificar às 23:59 UTC (fim do dia)
- [ ] Contar sinais gerados no dia

**Comandos para executar às 18:00 UTC**:
```bash
cd /var/www/signal-dashboard/backend
echo "=== CHECKPOINT 18:00 UTC ==="
echo "Sinais hoje:"
pm2 logs signal-engine --lines 5000 --nostream | grep "Signal generated" | grep "2026-05-01" | wc -l
echo ""
echo "Últimos 5 sinais:"
pm2 logs signal-engine --lines 5000 --nostream | grep "Signal generated" | tail -5
```

### Dia 2 - 02/05/2026
- [ ] Verificar total de sinais do dia 1
- [ ] Analisar qualidade dos sinais
- [ ] Verificar se algum atingiu TP ou SL
- [ ] Decidir se mantém ou ajusta

**Comandos para executar**:
```bash
cd /var/www/signal-dashboard/backend
echo "=== RELATÓRIO DIA 1 ==="
echo "Sinais gerados ontem (01/05):"
pm2 logs signal-engine --lines 10000 --nostream | grep "Signal generated" | grep "2026-05-01" | wc -l
echo ""
echo "Sinais hoje (02/05):"
pm2 logs signal-engine --lines 5000 --nostream | grep "Signal generated" | grep "2026-05-02" | wc -l
```

### Dia 3 - 03/05/2026
- [ ] Análise final dos 3 dias
- [ ] Calcular win rate (se houver trades fechados)
- [ ] Decisão: manter, aumentar ou reduzir
- [ ] Documentar resultado

---

## 🎯 CRITÉRIOS DE DECISÃO (DIA 3)

### ✅ MANTER 10 sinais/dia SE:
- Sinais gerados: 8-10 por dia
- Win rate: >30% (se houver dados)
- SL rate: <70%
- Qualidade mantida (score ≥60)

### 📈 AUMENTAR PARA 15-25 SE:
- Sinais gerados: 10 por dia consistentemente
- Win rate: >35%
- SL rate: <60%
- Usuário quer mais oportunidades

### 📉 REDUZIR PARA 5-7 SE:
- Win rate: <25%
- SL rate: >75%
- Qualidade caiu (muitos sinais ruins)

### ⏪ VOLTAR PARA 3 SE:
- Win rate: <20%
- SL rate: >80%
- Filtros não melhoraram nada

---

## 📝 NOTAS IMPORTANTES

### O que NÃO mudou:
- ✅ Correções 1-6 permanecem ativas
- ✅ Filtros de qualidade (score ≥60)
- ✅ ATR dinâmico, tendência 4H, trailing stop
- ✅ Filtro de liquidez (30 símbolos)
- ✅ Cooldown de 12h por símbolo
- ✅ Rotação de símbolos (1 sinal/dia por par)

### O que mudou:
- ✅ Limite diário: 3 → 10 sinais
- ✅ Mais slots disponíveis para oportunidades

### Expectativa:
Com 86 símbolos monitorados e rotação ativa, esperamos:
- **8-10 sinais/dia** (vs 3 anterior)
- **Símbolos variados** (rotação funcionando)
- **Qualidade mantida** (filtros ativos)

---

## 🚨 ALERTAS

### Se após 24h (02/05 12:00 UTC):

#### Cenário A: Menos de 5 sinais gerados
**Problema**: Limite ainda muito baixo ou mercado lateral
**Ação**: Aumentar para 15 sinais/dia

#### Cenário B: Exatamente 10 sinais gerados
**Problema**: Limite sendo atingido (há mais oportunidades)
**Ação**: Aumentar para 15-20 sinais/dia

#### Cenário C: 8-10 sinais gerados
**Sucesso**: Limite adequado, filtros funcionando
**Ação**: Manter e monitorar win rate

#### Cenário D: Mais de 10 sinais (impossível)
**Erro**: Configuração não foi aplicada
**Ação**: Verificar .env e reiniciar PM2

---

## 📞 COMANDOS RÁPIDOS

### Ver status atual:
```bash
cd /var/www/signal-dashboard/backend && \
echo "Sinais hoje:" && \
pm2 logs signal-engine --lines 5000 --nostream | grep "Signal generated" | grep "$(date +%Y-%m-%d)" | wc -l && \
echo "" && \
echo "Últimos 3 sinais:" && \
pm2 logs signal-engine --lines 5000 --nostream | grep "Signal generated" | tail -3
```

### Ver configuração atual:
```bash
cd /var/www/signal-dashboard/backend && \
grep "MAX_SIGNALS_PER_DAY" .env
```

### Restaurar backup se necessário:
```bash
cd /var/www/signal-dashboard/backend && \
cp .env.backup.20260501_114625 .env && \
pm2 restart signal-engine
```

---

## 📊 TEMPLATE DE RELATÓRIO (DIA 3)

```
═══════════════════════════════════════════════════════
RELATÓRIO FINAL - 3 DIAS DE TESTE
═══════════════════════════════════════════════════════

Período: 01/05/2026 12:11 UTC - 04/05/2026 12:11 UTC
Configuração: MAX_SIGNALS_PER_DAY=10

RESULTADOS:
───────────────────────────────────────────────────────
Dia 1 (01/05): ___ sinais gerados
Dia 2 (02/05): ___ sinais gerados
Dia 3 (03/05): ___ sinais gerados

Total: ___ sinais (média: ___ por dia)

QUALIDADE:
───────────────────────────────────────────────────────
Score médio: ___
VETOs: ___
Win Rate: ___% (se disponível)
SL Rate: ___% (se disponível)

DECISÃO:
───────────────────────────────────────────────────────
[ ] Manter 10 sinais/dia
[ ] Aumentar para ___ sinais/dia
[ ] Reduzir para ___ sinais/dia
[ ] Voltar para 3 sinais/dia

JUSTIFICATIVA:
_______________________________________________
_______________________________________________
_______________________________________________
```

---

**Data de criação**: 01/05/2026 12:11 UTC
**Próxima revisão**: 02/05/2026 12:00 UTC
**Revisão final**: 04/05/2026 12:00 UTC
