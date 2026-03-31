# Comparação: Lógica Antiga vs Nova do Scalping

## Cenário 1: Sinal Padrão (Score 75, RVOL 1.2)

### ANTES:
- SL: 1.0x ATR = 0.8%
- TP1: 1.2:1 = 0.96%
- TP2: 2.0:1 = 1.6%
- TP3: 3.0:1 = 2.4%
- Alavancagem: 10x (fixo)

### DEPOIS:
- SL: 0.8x ATR = 0.64% (mais apertado)
- TP1: 1.3:1 = 0.83%
- TP2: 2.0:1 = 1.28%
- TP3: 3.0:1 = 1.92%
- Alavancagem: 12x (ajustado por score médio)

**Melhoria:** SL mais apertado, TPs proporcionais, alavancagem contextual

---

## Cenário 2: Sinal com Order Block (Score 88, RVOL 1.5)

### ANTES:
- SL: 1.0x ATR = 1.2%
- TP1: 1.2:1 = 1.44%
- TP2: 2.0:1 = 2.4%
- TP3: 3.0:1 = 3.6%
- Alavancagem: 8x (fixo)

### DEPOIS:
- SL: Estrutural (swing low) = 1.5%
- TP1: 1.5:1 Fibonacci = 2.25%
- TP2: 2.0:1 Fibonacci = 3.0%
- TP3: 3.0:1 Fibonacci = 4.5%
- Alavancagem: 10x (8x base * 1.2 por score alto)

**Melhoria:** SL estrutural ICT, TPs Fibonacci, alavancagem aumentada por qualidade

---

## Cenário 3: Liquidity Sweep (Score 92, RVOL 2.5)

### ANTES:
- SL: 1.05x wicks = 0.9%
- TP1: 1.2:1 = 1.08%
- TP2: 2.0:1 = 1.8%
- TP3: 3.0:1 = 2.7%
- Alavancagem: 11x (fixo)

### DEPOIS:
- SL: 1.05x wicks = 0.9%
- TP1: 1.8:1 = 1.62% (mais ambicioso)
- TP2: 2.5:1 = 2.25%
- TP3: 3.5:1 = 3.15%
- Alavancagem: 11x (13x base * 1.2 score * 0.85 RVOL alto)

**Melhoria:** TPs mais ambiciosos para Sweep, alavancagem reduzida por volatilidade extrema

---

## Cenário 4: BB Squeeze (Score 82, RVOL 1.8)

### ANTES:
- SL: 1.0x ATR = 0.7%
- TP1: 1.2:1 = 0.84%
- TP2: 2.0:1 = 1.4%
- TP3: 3.0:1 = 2.1%
- Alavancagem: 14x (fixo)

### DEPOIS:
- SL: 0.9x ATR = 0.63% (RVOL alto)
- TP1: 1.56:1 = 0.98% (1.3 * 1.2 squeeze)
- TP2: 2.4:1 = 1.51% (2.0 * 1.2 squeeze)
- TP3: 3.6:1 = 2.27% (3.0 * 1.2 squeeze)
- Alavancagem: 15x (14x base * 1.2 score * 0.9 RVOL)

**Melhoria:** TPs aumentados 20% por Squeeze, SL ajustado por volume, alavancagem otimizada

---

## Resumo das Melhorias

| Métrica | Antes | Depois |
|---------|-------|--------|
| Variação SL | Baixa (sempre 1x ATR) | Alta (0.8-1.5x baseado em contexto) |
| Variação TP | Nenhuma (fixo) | Alta (1.3-3.5x baseado em setup) |
| Variação Alavancagem | Baixa (2-20x) | Alta (3-25x com ajustes) |
| Contexto ICT | Parcial | Completo (OB, Sweep, FVG) |
| Ajuste Volatilidade | Não | Sim (RVOL) |
| Ajuste Qualidade | Não | Sim (Score) |

**Resultado:** Sinais mais inteligentes, adaptados e contextualizados!
