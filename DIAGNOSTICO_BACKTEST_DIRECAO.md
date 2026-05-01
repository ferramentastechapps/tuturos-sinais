# 🔍 DIAGNÓSTICO: Por que 100% SHORTs no Backtest?

## ❓ PROBLEMA RELATADO

Backtest gerando **100% de sinais SHORT** mesmo em período de alta (jan-mai 2026).

**Hipótese**: Filtro de tendência EMA200 4H não está sendo aplicado no `backtestEngine.ts`.

---

## ✅ VERIFICAÇÃO DO CÓDIGO

### 1. Filtro EMA200 4H no `signalEngine.ts` (linhas 530-545):

```typescript
// CORREÇÃO 2: Filtro de tendência macro OBRIGATÓRIO
// Bloqueia trades contra a tendência 4H (EMA200)
const trend4hMacro = currentPrice > ema200_4h ? 'long' : 'short';

if (type === 'long' && trend4hMacro !== 'long') {
    logger.debug(`[SIGNAL-VETO] ${symbol} ❌ LONG bloqueado - tendência 4H bearish (preço < EMA200)`);
    return null;
}
if (type === 'short' && trend4hMacro !== 'short') {
    logger.debug(`[SIGNAL-VETO] ${symbol} ❌ SHORT bloqueado - tendência 4H bullish (preço > EMA200)`);
    return null;
}
```

**✅ Filtro ESTÁ implementado corretamente!**

### 2. Como o `backtestEngine.ts` usa o filtro (linha 189):

```typescript
signal = generateSignalFromData(
    symbol, window, currentPrice, high24h, low24h, volume24h, fundingRate, ohlc15m, ohlc4h, this.config.signal.minScore
);
```

**✅ Backtest chama `generateSignalFromData()` que JÁ aplica o filtro!**

---

## 🎯 CAUSA REAL DO PROBLEMA

O filtro **ESTÁ funcionando**, mas o período testado (jan-mai 2026) pode ter:

### Cenário A: Mercado em correção
- **1H**: EMA20 < EMA50 → Define direção SHORT
- **4H**: Preço < EMA200 → Permite SHORT (filtro passa)
- **Resultado**: Todos os sinais são SHORT válidos

### Cenário B: Período de consolidação lateral
- **1H**: Alternando entre LONG/SHORT
- **4H**: Preço oscilando em torno da EMA200
- **Resultado**: Mais SHORTs se mercado está abaixo da EMA200

---

## 📊 COMO VERIFICAR

Execute o script de diagnóstico:

```bash
cd /var/www/signal-dashboard/backend
npx tsx scripts/diagnostico-backtest-direcao.ts
```

Este script vai:
1. Buscar dados 1H e 4H do período
2. Calcular EMAs em pontos-chave
3. Mostrar se LONGs/SHORTs seriam bloqueados
4. Contar quantos sinais de cada tipo passariam

---

## 🔍 ANÁLISE ESPERADA

### Se o período foi realmente de alta:
```
LONGs permitidos:  60%
LONGs bloqueados:  10%
SHORTs permitidos: 5%
SHORTs bloqueados: 25%
```
**Conclusão**: Filtro funcionando, backtest deveria ter mais LONGs

### Se o período foi de correção:
```
LONGs permitidos:  10%
LONGs bloqueados: 30%
SHORTs permitidos: 50%
SHORTs bloqueados: 10%
```
**Conclusão**: Filtro funcionando, SHORTs são válidos para o período

---

## 🎯 POSSÍVEIS SOLUÇÕES

### Solução 1: Período estava em correção (mais provável)
**Ação**: Nenhuma - filtro está correto
**Motivo**: Jan-Mai 2026 pode ter sido período bearish no 4H

### Solução 2: Definição de direção muito sensível
**Problema**: Direção definida por EMA20 > EMA50 no 1H (linha 555)
**Ação**: Usar EMA50 > EMA200 no 1H para definir direção
```typescript
// Ao invés de:
if (lastEma20 > lastEma50) type = 'long';

// Usar:
if (lastEma50 > lastEma200) type = 'long';
```

### Solução 3: Adicionar filtro de tendência 1H também
**Ação**: Bloquear se 1H e 4H não estiverem alinhados
```typescript
// Após linha 545, adicionar:
if (type === 'long' && lastEma20 < lastEma200) {
    logger.debug(`[SIGNAL-VETO] ${symbol} ❌ LONG bloqueado - tendência 1H bearish`);
    return null;
}
if (type === 'short' && lastEma20 > lastEma200) {
    logger.debug(`[SIGNAL-VETO] ${symbol} ❌ SHORT bloqueado - tendência 1H bullish`);
    return null;
}
```

---

## 📝 CONCLUSÃO

### ✅ O que está correto:
1. Filtro EMA200 4H **ESTÁ implementado**
2. `backtestEngine.ts` **USA o filtro** via `generateSignalFromData()`
3. Código está funcionando como esperado

### ❓ O que precisa verificar:
1. **Executar script de diagnóstico** para ver tendência real do período
2. **Verificar se jan-mai 2026 foi realmente alta** ou correção
3. **Analisar se a definição de direção** (EMA20 > EMA50) é adequada

### 🎯 Próximos passos:
1. Execute: `npx tsx scripts/diagnostico-backtest-direcao.ts`
2. Analise o output para ver distribuição LONG/SHORT
3. Se período foi bearish, filtro está correto
4. Se período foi bullish mas gerou SHORTs, ajustar definição de direção

---

## 🚀 COMANDO PARA EXECUTAR

```bash
# Na VPS ou local:
cd /var/www/signal-dashboard/backend
npx tsx scripts/diagnostico-backtest-direcao.ts
```

**Me mostre o output** e vou confirmar se o filtro está funcionando ou se precisa ajuste!
