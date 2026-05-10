# 🔧 FIX: Trailing Stop Progressivo por TP

**Data:** 10/05/2026  
**Status:** ✅ APLICADO — Pronto para deploy

---

## 📋 PROBLEMA

Quando a operação batia TP1, o sistema movia o stop para breakeven (entrada).  
Mas quando batia TP2 ou TP3, o stop **não era atualizado** — continuava no breakeven.

**Resultado:** A moeda batia TP3, depois recuava, o stop era atingido no breakeven e **perdíamos todo o lucro dos TPs 2 e 3**.

---

## ✅ SOLUÇÃO: Trailing Stop Progressivo

### Regra Nova
- **TP1 batido** → stop move para a **ENTRADA** (breakeven) — já existia, mantido
- **TP2 batido** → stop move para o **PREÇO DO TP1**
- **TP3 batido** → stop move para o **PREÇO DO TP2**

### Regra de Segurança
O stop **NUNCA pode piorar**:
- Para **LONG**: `novo_stop = Math.max(stop_atual, novo_nivel)`
- Para **SHORT**: `novo_stop = Math.min(stop_atual, novo_nivel)`

---

## 🔨 IMPLEMENTAÇÃO

### 1. Novo método: `calculateNewStopAfterTP()`

```typescript
private calculateNewStopAfterTP(signal: ActiveSignal, tpHit: TakeProfit): number {
  const isLong = signal.type.toUpperCase() === 'LONG';
  const entryAvg = (signal.entry_range_low + signal.entry_range_high) / 2;

  if (tpHit.level === 1) {
    // TP1 → breakeven
    return isLong
      ? Math.max(signal.stop_loss, entryAvg)
      : Math.min(signal.stop_loss, entryAvg);
  }

  if (tpHit.level === 2) {
    // TP2 → preço do TP1
    const tp1 = signal.take_profits.find(t => t.level === 1);
    if (tp1) {
      return isLong
        ? Math.max(signal.stop_loss, tp1.price)
        : Math.min(signal.stop_loss, tp1.price);
    }
  }

  if (tpHit.level === 3) {
    // TP3 → preço do TP2
    const tp2 = signal.take_profits.find(t => t.level === 2);
    if (tp2) {
      return isLong
        ? Math.max(signal.stop_loss, tp2.price)
        : Math.min(signal.stop_loss, tp2.price);
    }
  }

  return signal.stop_loss; // fallback: manter stop atual
}
```

### 2. Atualização do `handleTakeProfit()`

**ANTES:**
```typescript
// Determine Breakeven / New SL
let oldSl = signal.stop_loss;
const entryAvg = (signal.entry_range_low + signal.entry_range_high) / 2;

if (tp.level === 1) {
  // Move to breakeven após TP1
  signal.stop_loss = signal.type.toUpperCase() === 'LONG' 
    ? Math.max(signal.stop_loss, entryAvg)
    : Math.min(signal.stop_loss, entryAvg);
}
// TP2 e TP3 não fazem nada com o stop — BUG!
```

**DEPOIS:**
```typescript
// Atualizar stop loss progressivamente
const oldSL = signal.stop_loss;
const newSL = this.calculateNewStopAfterTP(signal, tp);

if (newSL !== oldSL) {
  signal.stop_loss = newSL;
  console.log(`[TradeTracker] ${signal.pair} Stop atualizado: ${oldSL.toFixed(4)} → ${newSL.toFixed(4)} (após TP${tp.level})`);
  
  // Notificar no Telegram
  sendTrailingStopUpdate(
    signal,
    currentPrice,
    oldSL,
    newSL,
    `🎯 TP${tp.level} atingido! Stop movido para ${tp.level === 1 ? 'entrada (breakeven)' : 'TP' + (tp.level - 1)}: ${newSL.toFixed(4)}`
  ).catch(e => console.error('[TradeTracker] TG error trailing notify', e));
}
```

### 3. Log de evento atualizado

**ANTES:**
```typescript
this.logEvent(signal.id, 'TP_HIT', `TP${tp.level} hit at ${currentPrice}`, currentPrice)
```

**DEPOIS:**
```typescript
this.logEvent(signal.id, 'TP_HIT', `TP${tp.level} hit at ${currentPrice} | novo SL: ${signal.stop_loss.toFixed(4)}`, currentPrice)
```

---

## 📊 EXEMPLO PRÁTICO

### Cenário: LONG BTCUSDT

**Setup inicial:**
- Entrada: $50,000
- TP1: $51,000
- TP2: $52,000
- TP3: $53,000
- Stop inicial: $49,500

**Evolução:**

1. **Preço bate TP1 ($51,000)**
   - Stop move para: **$50,000** (breakeven)
   - Log: `Stop atualizado: 49500.0000 → 50000.0000 (após TP1)`
   - Telegram: `🎯 TP1 atingido! Stop movido para entrada (breakeven): 50000.0000`

2. **Preço bate TP2 ($52,000)**
   - Stop move para: **$51,000** (preço do TP1)
   - Log: `Stop atualizado: 50000.0000 → 51000.0000 (após TP2)`
   - Telegram: `🎯 TP2 atingido! Stop movido para TP1: 51000.0000`

3. **Preço bate TP3 ($53,000)**
   - Stop move para: **$52,000** (preço do TP2)
   - Log: `Stop atualizado: 51000.0000 → 52000.0000 (após TP3)`
   - Telegram: `🎯 TP3 atingido! Stop movido para TP2: 52000.0000`

4. **Preço recua para $52,000**
   - Stop é atingido em **$52,000**
   - **Lucro garantido:** +4% (ao invés de 0% no breakeven)

---

## 🎯 BENEFÍCIOS

### Antes (BUG)
- TP1 batido → stop no breakeven ($50,000)
- TP2 batido → stop continua no breakeven ($50,000)
- TP3 batido → stop continua no breakeven ($50,000)
- Preço recua → **SL no breakeven = 0% de lucro**

### Depois (FIX)
- TP1 batido → stop no breakeven ($50,000)
- TP2 batido → stop no TP1 ($51,000) = **+2% garantido**
- TP3 batido → stop no TP2 ($52,000) = **+4% garantido**
- Preço recua → **SL no TP2 = +4% de lucro**

---

## 📦 ARQUIVO MODIFICADO

- ✅ `backend/src/trading/tradeTracker.ts`

---

## 🚀 DEPLOY

### Compilar e enviar para VPS
```bash
cd backend
npm run build
scp -r dist root@SEU_VPS:/root/tuturos-sinais/backend/
```

### Reiniciar no VPS
```bash
ssh root@SEU_VPS
pm2 restart backend
pm2 logs backend --lines 50
```

---

## 📝 LOGS ESPERADOS

### Quando TP1 é atingido
```
[TradeTracker] TP1 hit for BTCUSDT at 51000
[TradeTracker] BTCUSDT Stop atualizado: 49500.0000 → 50000.0000 (após TP1)
```

### Quando TP2 é atingido
```
[TradeTracker] TP2 hit for BTCUSDT at 52000
[TradeTracker] BTCUSDT Stop atualizado: 50000.0000 → 51000.0000 (após TP2)
```

### Quando TP3 é atingido
```
[TradeTracker] TP3 hit for BTCUSDT at 53000
[TradeTracker] BTCUSDT Stop atualizado: 51000.0000 → 52000.0000 (após TP3)
```

### No Telegram
```
🎯 TP1 atingido! Stop movido para entrada (breakeven): 50000.0000
🎯 TP2 atingido! Stop movido para TP1: 51000.0000
🎯 TP3 atingido! Stop movido para TP2: 52000.0000
```

---

## ⚠️ NOTAS IMPORTANTES

1. **Compatível com trailing stop existente**: O sistema de trailing stop dinâmico (baseado em ATR) continua funcionando após TP1. Esta correção apenas garante que TP2 e TP3 também movam o stop.

2. **Segurança garantida**: O stop NUNCA piora. A lógica `Math.max()` para LONG e `Math.min()` para SHORT garante isso.

3. **Notificações no Telegram**: Cada movimento de stop gera uma notificação clara no Telegram informando o novo nível.

4. **Persistência no banco**: O novo stop é salvo no banco de dados (`db.activeSignal.update`) e registrado no log de eventos.

---

**FIM DO DOCUMENTO**
