# Fix: Cálculo Dinâmico de Stop Loss, Take Profits e Alavancagem no Scalping

## Problema Identificado
O robô de scalping estava usando valores fixos e simplificados para:
- Stop Loss (sempre 1x ATR)
- Take Profits (sempre 1.2:1, 2:1, 3:1)
- Alavancagem (sempre entre 2x-20x sem considerar contexto)

Isso resultava em sinais menos precisos e menos adaptados às condições de mercado.

## Solução Implementada

### 1. Stop Loss Dinâmico

**ANTES:**
```typescript
stopLossDistance = Math.max(atrPercent * 1.0, 0.3); // Sempre 1x ATR
```

**DEPOIS:**
```typescript
// Ajuste baseado na volatilidade
const volatilityMultiplier = rvol > 1.5 ? 0.9 : 0.8;
stopLossDistance = Math.max(atrPercent * volatilityMultiplier, 0.3);
```

**Benefícios:**
- Volume alto (RVOL > 1.5) = SL um pouco mais largo (0.9x ATR)
- Volume normal = SL mais apertado (0.8x ATR)
- Mantém estruturas ICT (Order Blocks, Liquidity Sweeps)

### 2. Take Profits Dinâmicos

**ANTES:**
```typescript
const tp1Distance = stopLossDistance * 1.2;  // Fixo
const tp2Distance = stopLossDistance * 2.0;  // Fixo
const tp3Distance = stopLossDistance * 3.0;  // Fixo
```

**DEPOIS:**
```typescript
if (usingStructuralStop) {
    // ICT Fibonacci projections
    tp1Distance = stopLossDistance * 1.5;
    tp2Distance = stopLossDistance * 2.0;
    tp3Distance = stopLossDistance * 3.0;
} else if (isSweepLow || isSweepHigh) {
    // Liquidity Sweep = movimento forte
    tp1Distance = stopLossDistance * 1.8;
    tp2Distance = stopLossDistance * 2.5;
    tp3Distance = stopLossDistance * 3.5;
} else {
    // Scalping padrão com ajuste para BB Squeeze
    const tpScale = bb.isSqueeze ? 1.2 : 1.0;
    tp1Distance = stopLossDistance * 1.3 * tpScale;
    tp2Distance = stopLossDistance * 2.0 * tpScale;
    tp3Distance = stopLossDistance * 3.0 * tpScale;
}
```

**Benefícios:**
- Order Blocks = TPs Fibonacci (1.5:1, 2:1, 3:1)
- Liquidity Sweeps = TPs mais ambiciosos (1.8:1, 2.5:1, 3.5:1)
- BB Squeeze = TPs aumentados em 20% (explosão iminente)
- Padrão = TPs conservadores (1.3:1, 2:1, 3:1)

### 3. Alavancagem Dinâmica

**ANTES:**
```typescript
let dynamicLeverage = Math.round((riskPercent / stopLossDistance) / (marginPercent / 100));
if (dynamicLeverage < 2) dynamicLeverage = 2;
if (dynamicLeverage > 20) dynamicLeverage = 20;
```

**DEPOIS:**
```typescript
// Fórmula base
let dynamicLeverage = Math.round((accountRiskLevel / stopLossDistance) / (marginPercent / 100));

// Ajuste por qualidade do sinal
if (score >= 85) {
    dynamicLeverage = Math.round(dynamicLeverage * 1.2); // +20%
} else if (score < 70) {
    dynamicLeverage = Math.round(dynamicLeverage * 0.8); // -20%
}

// Ajuste por volatilidade
if (rvol > 2.0) {
    dynamicLeverage = Math.round(dynamicLeverage * 0.85); // -15%
}

// Limites: 3x - 25x
if (dynamicLeverage < 3) dynamicLeverage = 3;
if (dynamicLeverage > 25) dynamicLeverage = 25;
```

**Benefícios:**
- Sinais de alta qualidade (≥85) = +20% alavancagem
- Sinais mais fracos (<70) = -20% alavancagem
- Volume extremo (RVOL > 2.0) = -15% alavancagem (mais risco)
- Mínimo aumentado para 3x (scalping precisa de margem)
- Máximo aumentado para 25x (vs 20x anterior)

## Comparação com Robô Principal

| Aspecto | Robô Principal (1H) | Scalping (5M) |
|---------|---------------------|---------------|
| SL Base | 1.5x ATR | 0.8-0.9x ATR |
| TP1 Padrão | 1.5:1 | 1.3-1.8:1 |
| TP com ICT | Fibonacci | Fibonacci |
| Alavancagem | 2x - 50x | 3x - 25x |
| Ajuste Score | Sim | Sim (novo) |
| Ajuste RVOL | Não | Sim (novo) |

## Resultados Esperados

✅ Stops mais inteligentes baseados em volatilidade
✅ TPs adaptados ao tipo de setup (ICT, Sweep, Squeeze)
✅ Alavancagem ajustada por qualidade e risco
✅ Sinais mais variados e contextualizados
✅ Melhor gestão de risco em scalping

## Teste

Compile e reinicie o backend:
```bash
cd backend
npm run build
# Reinicie o servidor
```

Observe os próximos sinais de scalping - devem ter valores diferentes baseados no contexto.


## Exemplos Práticos

### Exemplo 1: BTCUSDT com BB Squeeze
```
Score: 82
RVOL: 1.8
ATR: 0.7%

ANTES:
- SL: 0.7% (1x ATR)
- TP1: 0.84% (1.2:1)
- Alavancagem: 14x

DEPOIS:
- SL: 0.63% (0.9x ATR por RVOL alto)
- TP1: 0.98% (1.56:1 com bonus Squeeze)
- Alavancagem: 15x (ajustado por score e RVOL)
```

### Exemplo 2: ETHUSDT com Order Block
```
Score: 88
RVOL: 1.5
Estrutura: Bullish OB

ANTES:
- SL: 1.2% (1x ATR)
- TP1: 1.44% (1.2:1)
- Alavancagem: 8x

DEPOIS:
- SL: 1.5% (estrutural - swing low)
- TP1: 2.25% (1.5:1 Fibonacci)
- Alavancagem: 10x (+20% por score alto)
```

### Exemplo 3: SOLUSDT com Liquidity Sweep
```
Score: 92
RVOL: 2.5
Estrutura: Sweep Low

ANTES:
- SL: 0.9% (1.05x wicks)
- TP1: 1.08% (1.2:1)
- Alavancagem: 11x

DEPOIS:
- SL: 0.9% (mantém wicks)
- TP1: 1.62% (1.8:1 por Sweep)
- Alavancagem: 11x (reduzido por RVOL extremo)
```

## Status

✅ **IMPLEMENTADO** - Lógica dinâmica aplicada ao robô de scalping

### Próximos Passos

1. Compile o backend: `npm run build`
2. Reinicie o servidor
3. Monitore os próximos sinais de scalping
4. Compare com sinais anteriores

### Logs Esperados

```
[SCALPING-DIAG] BTCUSDT | SL: 0.63% (0.9x ATR) | TP1: 1.56:1 (Squeeze bonus) | Lev: 15x
[Scalping] Sinal enviado: LONG BTCUSDT | score=82 | R:R=1.56:1
```
