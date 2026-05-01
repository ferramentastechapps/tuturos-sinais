# 🔧 FIX: Tamanho da Janela de Candles no Backtest

## ❌ PROBLEMA IDENTIFICADO

### Linha 148 do `backtestEngine.ts`:
```typescript
const window = history.slice(Math.max(0, i - 1000), i + 1);
```

**Problema**: Limite hardcoded de 1000 candles

### Impacto:
- **Timeframe 30min**: 1000 candles = apenas **20 dias** de histórico
- **Período testado**: 31/01/2026 → 01/05/2026 = **90 dias**
- **Candles necessários**: ~4320 candles (30min × 24h × 90 dias)

**Resultado**: Indicadores calculados com dados insuficientes, especialmente EMA200 4H.

---

## ✅ CORREÇÕES APLICADAS

### 1. `backtestEngine.ts` - Janela Dinâmica (Linha 148)

**Antes**:
```typescript
const window = history.slice(Math.max(0, i - 1000), i + 1);
```

**Depois**:
```typescript
// Calculate dynamic window size based on timeframe and period
const timeframeMinutes = this.getTimeframeMinutes(this.config.timeframe);
const startMs = new Date(this.config.startDate).getTime();
const endMs = new Date(this.config.endDate).getTime();
const periodDays = Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24));
const candlesNeeded = Math.ceil(periodDays * 24 * 60 / timeframeMinutes) + 200; // +200 for indicator warmup
const window = history.slice(Math.max(0, i - candlesNeeded), i + 1);
```

### 2. Método Helper Adicionado:

```typescript
private getTimeframeMinutes(timeframe: string): number {
    switch (timeframe) {
        case '1m': return 1;
        case '5m': return 5;
        case '15m': return 15;
        case '30m': return 30;
        case '1h': return 60;
        case '4h': return 240;
        case '1d': return 1440;
        default: return 60; // default to 1h
    }
}
```

### 3. `validate-corrections.ts` - Paginação da Bybit

**Antes**:
```typescript
async function fetchOHLC(symbol: string, interval: string, startMs: number, endMs: number): Promise<OHLCPoint[]> {
    const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&start=${startMs}&end=${endMs}&limit=1000`;
    // ... busca apenas 1000 candles
}
```

**Depois**:
```typescript
async function fetchOHLC(symbol: string, interval: string, startMs: number, endMs: number): Promise<OHLCPoint[]> {
    const allCandles: OHLCPoint[] = [];
    let currentStart = startMs;
    const maxCandlesPerRequest = 1000;
    
    // Loop para buscar todos os candles do período
    while (currentStart < endMs) {
        // Busca batch de 1000
        // Move para próximo batch
        // Continua até cobrir todo o período
    }
    
    return allCandles; // Retorna TODOS os candles do período
}
```

---

## 📊 IMPACTO DAS CORREÇÕES

### Antes (1000 candles hardcoded):

| Timeframe | Candles | Período Coberto | EMA200 4H Válida? |
|-----------|---------|-----------------|-------------------|
| 1m        | 1000    | 16.7 horas      | ❌ Não            |
| 5m        | 1000    | 3.5 dias        | ❌ Não            |
| 15m       | 1000    | 10.4 dias       | ❌ Não            |
| 30m       | 1000    | 20.8 dias       | ❌ Não            |
| 1h        | 1000    | 41.7 dias       | ⚠️ Parcial        |
| 4h        | 1000    | 166.7 dias      | ✅ Sim            |

### Depois (dinâmico baseado no período):

| Timeframe | Período | Candles Necessários | EMA200 4H Válida? |
|-----------|---------|---------------------|-------------------|
| 1m        | 90 dias | 129,600 + 200       | ✅ Sim            |
| 5m        | 90 dias | 25,920 + 200        | ✅ Sim            |
| 15m       | 90 dias | 8,640 + 200         | ✅ Sim            |
| 30m       | 90 dias | 4,320 + 200         | ✅ Sim            |
| 1h        | 90 dias | 2,160 + 200         | ✅ Sim            |
| 4h        | 90 dias | 540 + 200           | ✅ Sim            |

**+200 candles** = Warmup para indicadores (EMA200 precisa de 200 períodos)

---

## 🎯 RESULTADO ESPERADO

### Antes da correção:
- EMA200 4H calculada com dados insuficientes
- Filtro de tendência 4H não funcionando corretamente
- Sinais gerados com base em indicadores inválidos

### Depois da correção:
- EMA200 4H calculada com período completo
- Filtro de tendência 4H funcionando corretamente
- Sinais gerados com indicadores válidos
- **Mais trades gerados** (filtros com dados corretos)

---

## 🚀 COMO TESTAR

### 1. Compilar:
```bash
cd backend
npm run build
```

### 2. Executar validação:
```bash
npx tsx scripts/validate-corrections.ts
```

### 3. Verificar output:
```
📊 Buscando dados históricos da Bybit...
Período: 2026-01-31 → 2026-05-01
Timeframe: 1h

  Buscando BTCUSDT (60)...
    → 1000 candles...
    → 2000 candles...
    → 2160 candles...
    ✓ Total: 2160 candles

  Buscando ETHUSDT (60)...
    → 1000 candles...
    → 2000 candles...
    → 2160 candles...
    ✓ Total: 2160 candles

✓ Todos os dados carregados

▶ Rodando BASELINE...
  ✓ 45 trades | WR: 35.6% | SL: 55.6% | PnL: $1,234.56

▶ Rodando COM_CORRECOES...
  ✓ 52 trades | WR: 42.3% | SL: 48.1% | PnL: $2,345.67
```

**Esperado**: 
- ✅ Mais de 2000 candles por símbolo (vs 1000 anterior)
- ✅ Mais trades gerados (40-60 vs 17 anterior)
- ✅ Distribuição mais balanceada LONG/SHORT

---

## 📝 ARQUIVOS MODIFICADOS

1. ✅ `backend/src/engine/backtest/backtestEngine.ts`
   - Linha 148: Janela dinâmica
   - Método `getTimeframeMinutes()` adicionado

2. ✅ `backend/scripts/validate-corrections.ts`
   - Função `fetchOHLC()` com paginação
   - Busca todos os candles do período

---

## ⚠️ NOTAS IMPORTANTES

### Rate Limiting:
A função `fetchOHLC()` inclui delay de 200ms entre requests para respeitar rate limits da Bybit.

### Memória:
Para períodos muito longos (>1 ano) com timeframes curtos (1m, 5m), o número de candles pode ser muito grande. Considerar:
- Limitar período máximo
- Usar timeframes maiores
- Implementar cache de dados

### Performance:
O cálculo dinâmico adiciona overhead mínimo (algumas operações matemáticas simples por iteração).

---

## ✅ CHECKLIST

- [x] Janela dinâmica implementada
- [x] Método helper `getTimeframeMinutes()` adicionado
- [x] Paginação da Bybit implementada
- [x] Rate limiting adicionado
- [x] Logs informativos adicionados
- [x] Documentação criada
- [ ] Testar com `npm run build && npx tsx scripts/validate-corrections.ts`
- [ ] Verificar se trades aumentaram
- [ ] Verificar se distribuição LONG/SHORT melhorou

---

**Data**: 01/05/2026
**Status**: ✅ Correções aplicadas, aguardando teste
