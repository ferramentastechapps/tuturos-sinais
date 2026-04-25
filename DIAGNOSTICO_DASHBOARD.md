# 🔍 DIAGNÓSTICO: Dashboard Não Mostra Sinais

**Data**: 22 de Abril de 2026  
**Problema**: Dashboard vazio, sem sinais sendo exibidos

---

## 🎯 Possíveis Causas

### 1. Nenhum Sinal Novo Sendo Gerado (Mais Provável)

Com as FASES 1, 2 e 3 implementadas, os filtros estão **muito rigorosos**:

**FASE 1 - Vetos Críticos:**
- Score mínimo: 90 (era 85)
- ICT confirmações: 2 (era 1)
- ML threshold: 65% (era 55%)
- Limite diário: 8 sinais

**FASE 2 - Gestão:**
- Alavancagem reduzida
- Penalidade 40% para scores < 90

**FASE 3 - Contexto (NOVO):**
- ❌ BTC em STRONG_DOWN → Bloqueia LONGs
- ❌ BTC em STRONG_UP → Bloqueia SHORTs
- ❌ Fear & Greed < 20 → Bloqueia TODOS
- ❌ Fear & Greed > 80 → Bloqueia LONGs
- ❌ Preço < EMA200 Daily → Bloqueia LONGs
- ❌ Preço > EMA200 Daily → Bloqueia SHORTs

**Resultado**: É possível que NENHUM sinal passe por todos esses filtros!

---

## 🔧 Soluções

### Solução 1: Verificar Logs (Recomendado)

Execute na VPS para ver os vetos em ação:

```bash
ssh root@212.85.10.239
pm2 logs signal-engine --lines 100 | grep "vetado\|VETO\|blocked"
```

Você verá mensagens como:
```
[Engine] ETHUSDT LONG vetado por contexto: BTC em queda forte (STRONG_DOWN)
[Engine] SOLUSDT SHORT vetado por contexto: Fear & Greed 85 > 80
[SIGNAL-DIAG] ADAUSDT ❌ LONG vetado: Preço abaixo da EMA200 Daily
```

### Solução 2: Afrouxar Filtros Temporariamente

Se quiser ver sinais mais rapidamente para testar o dashboard:

#### Opção A: Reduzir Score Mínimo
```typescript
// backend/src/engine/signalEngine.ts linha ~785
const finalMinScore = customMinScore !== undefined ? customMinScore : 85; // era 90
```

#### Opção B: Desabilitar Filtro Fear & Greed Temporariamente
```typescript
// backend/src/engine/marketContext.ts linha ~280
// Comentar temporariamente:
// if (context.fearGreedIndex < 20) { return { allowed: false, ... }; }
// if (type === 'long' && context.fearGreedIndex > 80) { return { allowed: false, ... }; }
```

#### Opção C: Desabilitar Filtro BTC Temporariamente
```typescript
// backend/src/engine/marketContext.ts linha ~290
// Comentar temporariamente:
// if (type === 'long' && context.btcTrend === 'STRONG_DOWN') { return { allowed: false, ... }; }
// if (type === 'short' && context.btcTrend === 'STRONG_UP') { return { allowed: false, ... }; }
```

### Solução 3: Verificar Contexto Atual do Mercado

Execute para ver o contexto atual:

```bash
ssh root@212.85.10.239
pm2 logs signal-engine --lines 50 | grep "MarketContext"
```

Você verá:
```
[MarketContext] Contexto atualizado {
  btcTrend: 'STRONG_DOWN',  // ← Bloqueando LONGs!
  btcPrice: 65234,
  fearGreed: '85 (Extreme Greed)'  // ← Bloqueando LONGs!
}
```

---

## 📊 Verificação Rápida

### 1. Verificar se há sinais antigos no banco

```bash
ssh root@212.85.10.239
cd /var/www/signal-dashboard/backend
sqlite3 prisma/data/trading.db "SELECT COUNT(*) FROM TradeSignal;"
sqlite3 prisma/data/trading.db "SELECT pair, type, status, created_at FROM TradeSignal ORDER BY created_at DESC LIMIT 5;"
```

### 2. Verificar se API está rodando

```bash
ssh root@212.85.10.239
curl http://localhost:3001/api/signals/history | jq '.[0:3]'
```

### 3. Verificar se signal-engine está rodando

```bash
ssh root@212.85.10.239
pm2 list
pm2 logs signal-engine --lines 20
```

---

## 🎯 Recomendação

**NÃO afrouxe os filtros ainda!** 

Os filtros foram implementados para aumentar o win rate de 32.7% para 55-60%. É normal que:

1. **Primeiras horas**: Poucos ou nenhum sinal (mercado não está favorável)
2. **Após 24-48h**: Começam a aparecer sinais de alta qualidade
3. **Após 1 semana**: Padrão estabiliza com 4-6 sinais/dia de excelente qualidade

### O que fazer agora:

1. ✅ Verificar logs para entender os vetos
2. ✅ Aguardar 24-48h para o mercado se alinhar
3. ✅ Monitorar contexto (BTC, Fear & Greed)
4. ❌ NÃO afrouxar filtros prematuramente

---

## 🔍 Comandos de Diagnóstico Completo

Execute este bloco na VPS:

```bash
ssh root@212.85.10.239 << 'EOF'
echo "═══════════════════════════════════════"
echo "🔍 DIAGNÓSTICO COMPLETO"
echo "═══════════════════════════════════════"

echo ""
echo "1️⃣ Status PM2:"
pm2 list

echo ""
echo "2️⃣ Total de sinais no banco:"
cd /var/www/signal-dashboard/backend
sqlite3 prisma/data/trading.db "SELECT COUNT(*) FROM TradeSignal;"

echo ""
echo "3️⃣ Últimos 3 sinais:"
sqlite3 -header -column prisma/data/trading.db "SELECT pair, type, status, confidence, created_at FROM TradeSignal ORDER BY created_at DESC LIMIT 3;"

echo ""
echo "4️⃣ Contexto de mercado (últimas 10 linhas):"
pm2 logs signal-engine --lines 100 --nostream | grep "MarketContext" | tail -10

echo ""
echo "5️⃣ Vetos recentes (últimas 20 linhas):"
pm2 logs signal-engine --lines 200 --nostream | grep -i "vetado\|veto\|blocked" | tail -20

echo ""
echo "6️⃣ Sinais gerados hoje:"
pm2 logs signal-engine --lines 100 --nostream | grep "Signal generated" | tail -10

echo ""
echo "═══════════════════════════════════════"
EOF
```

---

## ✅ Próximos Passos

1. Execute o diagnóstico completo acima
2. Compartilhe a saída dos logs
3. Avaliaremos se precisa ajustar algum filtro
4. Ou apenas aguardar o mercado se alinhar

---

**Lembre-se**: Qualidade > Quantidade. É melhor 2 sinais excelentes por dia do que 10 sinais mediocres!
