# 🔧 PLANO DE CORREÇÕES DO BACKTEST

## 📊 Diagnóstico Confirmado (414 trades, jan-mai 2026)

### Problemas Identificados:
1. **83% das trades terminam em SL** (343/414) - SL muito apertado
2. **71% viés short** (295 shorts vs 119 longs) - Sem filtro de tendência macro
3. **Score alto = win rate menor** - Lógica invertida (alavancagem aumenta com score)
4. **$901 em fees** (34% do potencial) - Excesso de símbolos + trades curtas

### Arquivos a Modificar:
- `backend/src/engine/backtest/backtestEngine.ts`
- `backend/src/engine/signalEngine.ts`
- `backend/src/types/backtestTypes.ts`
- `.env` (novas variáveis de config)

---

## 🎯 CORREÇÕES A IMPLEMENTAR

### CORREÇÃO 1 — Stop Loss Dinâmico baseado em ATR [CRÍTICO]
**Arquivo:** `signalEngine.ts` + `backtestEngine.ts`

**Mudança:**
```typescript
// ANTES (linha 695):
stopLossDistance = Math.max(atrPercent * atrMultiplier, 0.5);

// DEPOIS:
const atr14 = calculateATR(ohlc, 14);
const atrMultiplier = parseFloat(process.env.ATR_SL_MULTIPLIER || '1.5');
stopLossDistance = (atr14 * atrMultiplier / currentPrice) * 100;

// Rejeitar trade se ATR não disponível
if (atr14 === 0 || stopLossDistance < 0.3) {
    logger.debug(`[SIGNAL-VETO] ${symbol} ATR insuficiente`);
    return null;
}
```

**Variáveis .env:**
```
ATR_SL_MULTIPLIER=1.5
ATR_TP_MULTIPLIER=3.0
```

---

### CORREÇÃO 2 — Filtro de Tendência Macro Obrigatório [CRÍTICO]
**Arquivo:** `signalEngine.ts`

**Mudança:**
```typescript
// ANTES (linha 620): Apenas análise, não bloqueia
if (trend4h === type) {
    rawScore += 2;
}

// DEPOIS: Bloquear trades contra tendência
const ema200_4h = calculateEMA(closes4h, 200).pop() || currentPrice;
const trend4h = currentPrice > ema200_4h ? 'long' : 'short';

// VETO ABSOLUTO
if (type === 'long' && trend4h !== 'long') {
    logger.debug(`[SIGNAL-VETO] ${symbol} LONG bloqueado - tendência 4H bearish`);
    return null;
}
if (type === 'short' && trend4h !== 'short') {
    logger.debug(`[SIGNAL-VETO] ${symbol} SHORT bloqueado - tendência 4H bullish`);
    return null;
}
```

**Logging:** Adicionar campo `trendFilterBlocked` nas métricas do backtest

---

### CORREÇÃO 3 — Tempo Mínimo de Trade (4h) [IMPORTANTE]
**Arquivo:** `backtestEngine.ts`

**Mudança:**
```typescript
// No método handleSignalFlip (linha 340):
private handleSignalFlip(symbol: string, signal: TradeSignal, timestamp: number): void {
    const existingPositionIndex = this.positions.findIndex(p => p.symbol === symbol);
    if (existingPositionIndex !== -1) {
        const existingPosition = this.positions[existingPositionIndex];
        const sigType = signal.type.toLowerCase() as 'long'|'short';
        
        // NOVO: Verificar tempo mínimo
        const ageHours = (timestamp - existingPosition.entryTime) / (60 * 60 * 1000);
        const minHours = parseFloat(process.env.MIN_TRADE_DURATION_HOURS || '4');
        
        if (existingPosition.type !== sigType) {
            if (ageHours < minHours) {
                logger.debug(`[Backtest] ${symbol} signal_flip ignorado - trade com ${ageHours.toFixed(1)}h < ${minHours}h`);
                return; // Não fecha a posição
            }
            this.closePosition(existingPositionIndex, signal.entry, 'signal_flip', timestamp);
        }
    }
}
```

**Variável .env:**
```
MIN_TRADE_DURATION_HOURS=4
```

---

### CORREÇÃO 4 — Trailing Stop após 1× RR [IMPORTANTE]
**Arquivo:** `backtestEngine.ts`

**Mudança:**
```typescript
// No método updatePositions, ANTES de verificar SL (linha 420):
private updatePositions(candle: OHLCPoint, _symbol: string): void {
    for (let idx = 0; idx < this.positions.length; idx++) {
        const pos = this.positions[idx];
        
        // NOVO: Trailing stop após 1× RR
        const initialRisk = Math.abs(pos.entryPrice - pos.stopLoss);
        
        if (pos.type === 'long') {
            const currentProfit = candle.close - pos.entryPrice;
            const rr1Reached = currentProfit >= initialRisk;
            
            if (rr1Reached && pos.stopLoss < pos.entryPrice) {
                pos.stopLoss = pos.entryPrice * 1.001; // Breakeven
                logger.debug(`[Trailing] ${pos.symbol} LONG SL → breakeven @ ${pos.stopLoss.toFixed(2)}`);
            }
        } else {
            const currentProfit = pos.entryPrice - candle.close;
            const rr1Reached = currentProfit >= initialRisk;
            
            if (rr1Reached && pos.stopLoss > pos.entryPrice) {
                pos.stopLoss = pos.entryPrice * 0.999; // Breakeven
                logger.debug(`[Trailing] ${pos.symbol} SHORT SL → breakeven @ ${pos.stopLoss.toFixed(2)}`);
            }
        }
        
        // ... resto do código (verificação de SL/TP)
    }
}
```

---

### CORREÇÃO 5 — Lista Filtrada de Símbolos [MODERADO]
**Arquivo:** Criar `backend/src/config/highLiquiditySymbols.ts`

**Conteúdo:**
```typescript
// Símbolos com volume médio diário > $100M na Bybit
export const HIGH_LIQUIDITY_SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'ADAUSDT', 'DOGEUSDT', 'LINKUSDT', 'AVAXUSDT', 'APTUSDT',
    'JUPUSDT', 'THETAUSDT', 'FILUSDT', 'ARBUSDT', 'OPUSDT',
    'UNIUSDT', 'AAVEUSDT', 'INJUSDT', 'SUIUSDT', 'NEARUSDT',
    'MATICUSDT', 'ATOMUSDT', 'LTCUSDT', 'DOTUSDT', 'TRXUSDT'
];

export function isHighLiquidity(symbol: string): boolean {
    return HIGH_LIQUIDITY_SYMBOLS.includes(symbol);
}
```

**Uso em `signalEngine.ts`:**
```typescript
import { isHighLiquidity } from '../config/highLiquiditySymbols.js';

// No loop de símbolos (linha 850):
for (const symbol of symbols) {
    if (!isHighLiquidity(symbol)) {
        logger.debug(`[Engine] ${symbol} ignorado - baixa liquidez`);
        continue;
    }
    // ... resto do código
}
```

---

### CORREÇÃO 6 — Revisar Fórmula de Score [MODERADO]
**Arquivo:** `signalEngine.ts`

**Auditoria:**
```typescript
// PROBLEMA IDENTIFICADO (linha 735):
if (finalScore >= 80) dynamicLeverage = Math.round(dynamicLeverage * 1.2);
else if (finalScore < 70) dynamicLeverage = Math.round(dynamicLeverage * 0.8);

// CORREÇÃO: Inverter lógica - score alto = alavancagem MENOR (mais conservador)
if (finalScore >= 80) dynamicLeverage = Math.round(dynamicLeverage * 0.8); // Reduz 20%
else if (finalScore < 70) dynamicLeverage = Math.round(dynamicLeverage * 1.0); // Mantém
```

**Adicionar logging de score por faixa:**
```typescript
// Após calcular finalScore (linha 650):
logger.debug(`[SCORE-DEBUG] ${symbol} ${type} - Score: ${finalScore}/100, Confluências: ${confluences.length}`);
```

---

## 📝 ORDEM DE IMPLEMENTAÇÃO

1. ✅ Criar arquivo de símbolos de alta liquidez
2. ✅ Adicionar variáveis ao .env
3. ✅ Implementar CORREÇÃO 1 (ATR dinâmico) em signalEngine.ts
4. ✅ Implementar CORREÇÃO 2 (filtro de tendência) em signalEngine.ts
5. ✅ Implementar CORREÇÃO 6 (score invertido) em signalEngine.ts
6. ✅ Implementar CORREÇÃO 5 (filtro de liquidez) em signalEngine.ts
7. ✅ Implementar CORREÇÃO 3 (tempo mínimo) em backtestEngine.ts
8. ✅ Implementar CORREÇÃO 4 (trailing stop) em backtestEngine.ts
9. ✅ Testar cada correção isoladamente no backtest
10. ✅ Commit individual para cada correção

---

## 🧪 VALIDAÇÃO

### Backtest de Validação:
```bash
# Rodar backtest com cada correção ativada/desativada
npm run backtest -- --symbols BTCUSDT,ETHUSDT --start 2026-01-01 --end 2026-05-01
```

### Métricas Esperadas:
- **SL hit rate:** De 83% → ~50-60%
- **Viés direcional:** De 71% short → ~50/50
- **Win rate por score:** Score 80+ deve ter win rate > score 70
- **Fees:** Redução de ~30% com menos símbolos

---

## 📦 COMMITS

```bash
git commit -m "feat(backtest): add ATR-based dynamic stop loss (CORREÇÃO 1)"
git commit -m "feat(signal): add mandatory 4H trend filter (CORREÇÃO 2)"
git commit -m "feat(backtest): add minimum trade duration 4h (CORREÇÃO 3)"
git commit -m "feat(backtest): add trailing stop at 1x RR (CORREÇÃO 4)"
git commit -m "feat(config): filter symbols by liquidity >$100M (CORREÇÃO 5)"
git commit -m "fix(signal): invert leverage logic - high score = lower leverage (CORREÇÃO 6)"
```
