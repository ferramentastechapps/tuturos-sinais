# Lógica de Classificação Win/Loss

## Critérios Corretos

### ✅ WIN (Label = 1)
Um trade é classificado como **WIN** quando:

1. **Qualquer Take Profit é atingido** (TP1, TP2 ou TP3)
   - Mesmo que só bata TP1 e depois volte
   - Já garantiu lucro parcial

2. **Stop Loss com lucro** (Trailing Stop)
   - Após TP1, o stop sobe para breakeven ou acima
   - Se bater esse stop, ainda é WIN porque saiu com lucro
   - Exemplo: Entrou em $100, TP1 em $105, stop subiu para $102, bateu stop = WIN (+2%)

### ❌ LOSS (Label = 0)
Um trade é classificado como **LOSS** quando:

1. **Stop Loss com prejuízo**
   - Bateu o stop inicial antes de qualquer TP
   - PnL negativo

## Implementação no Código

### handleTakeProfit()
```typescript
// Qualquer TP batido = WIN imediatamente
const isFirstTP = !signal.take_profits.slice(0, signal.take_profits.indexOf(tp)).some(t => t.hit);

if (isFirstTP) {
  // Primeira vez que bate qualquer TP = WIN
  this.submitFeedbackToML(signal, 1, currentPrice);
}
```

### handleStopLoss()
```typescript
// Calcular PnL real
const entryAvg = (signal.entry_range_low + signal.entry_range_high) / 2;
const pnl = signal.type === 'LONG' 
  ? ((currentPrice - entryAvg) / entryAvg) * 100 
  : ((entryAvg - currentPrice) / entryAvg) * 100;

// WIN se PnL > 0 (trailing stop com lucro)
// LOSS se PnL <= 0 (stop com prejuízo)
const isWin = pnl > 0;
const outcomeLabel = isWin ? 1 : 0;

this.submitFeedbackToML(signal, outcomeLabel, currentPrice);
```

## Exemplos Práticos

### Exemplo 1: TP1 + Trailing Stop com Lucro
1. Entrada: $100
2. TP1: $105 ✅ (bateu)
3. Stop sobe para $102 (breakeven + lucro)
4. Preço volta e bate stop em $102
5. **Resultado: WIN** (saiu com +2% de lucro)

### Exemplo 2: TP1 + TP2 + Trailing Stop
1. Entrada: $100
2. TP1: $105 ✅ (bateu)
3. TP2: $110 ✅ (bateu)
4. Stop sobe para $107
5. Preço volta e bate stop em $107
6. **Resultado: WIN** (saiu com +7% de lucro)

### Exemplo 3: Stop Loss Direto
1. Entrada: $100
2. Stop: $98
3. Preço cai e bate stop em $98
4. **Resultado: LOSS** (saiu com -2% de prejuízo)

### Exemplo 4: TP1 Parcial
1. Entrada: $100
2. TP1: $105 ✅ (bateu)
3. Fechou 40% da posição
4. Stop sobe para $100 (breakeven)
5. Preço volta e bate stop em $100
6. **Resultado: WIN** (lucro parcial de TP1 já foi garantido)

## Impacto no ML

Com essa lógica correta:
- O modelo aprende que **trailing stops funcionam**
- Aprende a **proteger lucros** após TP1
- Não penaliza sinais que garantiram lucro parcial
- Melhora a taxa de win rate real do sistema

## Status no Banco de Dados

- `status: 'hit_tp'` = WIN (qualquer TP ou SL com lucro)
- `status: 'hit_sl'` = LOSS (SL com prejuízo)
- `outcome_label: 1` = WIN
- `outcome_label: 0` = LOSS
