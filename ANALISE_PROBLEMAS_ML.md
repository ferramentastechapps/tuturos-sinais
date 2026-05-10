# 🔧 ANÁLISE COMPLETA DOS PROBLEMAS ML - ROBÔS DE TRADING

## 📊 CONTEXTO DOS DADOS ANALISADOS
- **53.800 sinais** processados
- **81 moedas** diferentes
- **2 robôs**: Swing Trade e Scalping
- **Período**: até 09/05/2026

---

## ❌ PROBLEMA 1 — CRÍTICO: "Confidence Invertido"

### 🔍 DIAGNÓSTICO REAL

**O QUE VOCÊ ESTÁ VENDO NOS DADOS:**
- Sinais perdedores: confidence médio = 67,6
- Sinais vencedores: confidence médio = 32,5

**O QUE REALMENTE ESTÁ ACONTECENDO:**

O campo `confidence` **NÃO é um sistema de aprendizado**. É apenas o **score de confluências técnicas** calculado no momento da geração do sinal (0-100 pontos).

**Localização no código:**
- `backend/src/engine/signalEngine.ts` linha 848
- `backend/src/engine/scalpingEngine.ts` linha 437

```typescript
// O "confidence" é apenas o score final do sinal
confidence: finalScore, // 0-100 baseado em confluências
```

**POR QUE OS SINAIS COM SCORE ALTO PERDEM MAIS:**

1. **Overfitting de indicadores**: Quando muitos indicadores alinham (score alto), geralmente é porque o mercado já se moveu demais
2. **Late entries**: Score 80+ significa "tudo perfeito", mas o movimento já aconteceu
3. **Falta de isolamento por moeda**: O score não considera que cada moeda tem padrões únicos

**CONCLUSÃO**: Não existe "confidence invertido" — o problema é que o **score de confluências não é um bom preditor de sucesso**. O verdadeiro problema é o **PROBLEMA 3** (falta de aprendizado por moeda).

---

## ❌ PROBLEMA 2 — CRÍTICO: Swing Perdeu Aprendizado Após 20/04/2026

### 🔍 DIAGNÓSTICO

**O QUE ACONTECEU:**
- Confidence médio do Swing: ~100 → 0,66 (queda de 99,3%)
- Data: semana de 20/04/2026
- Scalping manteve valores normais (~58)

**CAUSA RAIZ:**

O modelo ML foi **retreinado automaticamente** (job diário às 23:55 UTC) e o novo modelo é **muito pior** que o anterior, mas **não há rollback automático**.

**Localização do problema:**

1. **Job de retreinamento** (`backend/src/jobs/mlRetrainJob.ts`):
```typescript
// Linha 35-40: Sobrescreve o modelo sem backup
const outputPath = path.join(backendDir, 'current_model.onnx');
const cmd = `"${pythonCmd}" "${trainScript}" --min-samples 30 --output "${outputPath}"`;
```

2. **Script Python** (`ml_engine/train_model.py`):
```python
# Linha 75: Salva direto sem versionamento
onnx.save_model(onnx_model, "current_model.onnx")
```

**POR QUE O NOVO MODELO É PIOR:**

1. **Dados desbalanceados**: Se na semana de 20/04 houve muitos losses consecutivos, o modelo aprendeu padrões ruins
2. **Overfitting**: Com apenas 30 samples mínimos, o modelo pode ter decorado ruído
3. **Sem validação de qualidade**: O modelo é carregado mesmo se a acurácia for < 50%

---

## ❌ PROBLEMA 3 — CRÍTICO: Sem Isolamento de Aprendizado por Moeda

### 🔍 DIAGNÓSTICO

**O QUE OS DADOS MOSTRAM:**
- Correlação win_rate vs confidence por moeda: **-0,21** (negativa!)
- STXUSDT (3.500+ sinais): confidence < 1
- Moedas com 1-3 sinais: confidence = 100

**CAUSA RAIZ:**

O sistema usa **UM ÚNICO MODELO ML** para todas as 81 moedas. Isso significa:

1. **BTC influencia SHIB**: O aprendizado de Bitcoin contamina shitcoins
2. **Moedas com poucos dados dominam**: Uma moeda com 3 sinais (todos wins) puxa o modelo para cima
3. **Moedas com muitos dados são penalizadas**: STXUSDT com 3.500 sinais tem confidence baixo porque o modelo "aprendeu" que ela perde

**Localização do problema:**

1. **Treinamento global** (`ml_engine/train_model.py`):
```python
# Linha 54-75: Treina UM modelo com TODAS as moedas misturadas
X = df[FEATURE_COLUMNS]  # Todas as moedas juntas
y = df['label']
model.fit(X_train.values, y_train.values)  # Modelo único
```

2. **Predição global** (`backend/src/ml/mlPredictionService.ts`):
```typescript
// Linha 80-95: UM inferenceSession para todas as moedas
const results = await inferenceSession!.run(feeds);
```

**O QUE DEVERIA SER:**

Cada moeda deveria ter seu próprio modelo:
```
models/
  ├── BTCUSDT_swing.onnx
  ├── BTCUSDT_scalping.onnx
  ├── ETHUSDT_swing.onnx
  ├── ETHUSDT_scalping.onnx
  └── ...
```

---

## ❌ PROBLEMA 4 — MODERADO: Quality Score Caiu nos Últimos 7 Dias

### 🔍 DIAGNÓSTICO

**DADOS:**
- Antes de 02/05: quality_score médio = 0,89
- Últimos 7 dias: quality_score médio = 0,63
- Queda de 29%

**CAUSA RAIZ:**

O `quality_score` é calculado da mesma forma que o `confidence` (score de confluências). A queda indica que:

1. **Filtros estão mais permissivos**: O threshold mínimo pode ter sido reduzido
2. **Mercado mudou**: Menos confluências técnicas estão alinhando
3. **Sem floor dinâmico**: Não há limite inferior para o quality_score aceito

**Localização:**

1. **Geração de sinal** (`backend/src/engine/signalEngine.ts` linha 342):
```typescript
// Linha 342: Veto de score mínimo
if (rawScore < scoreThreshold) {
    logger.debug(`[SIGNAL-DIAG] ${symbol} ❌ VETO SCORE: ${rawScore}/10 < ${scoreThreshold}`);
    return null;
}
```

2. **Config** (`.env`):
```bash
MIN_SIGNAL_SCORE=60  # Pode ter sido reduzido
```

---

## ❌ PROBLEMA 5 — MODERADO: Alta Volatilidade Não Está Sendo Filtrada

### 🔍 DIAGNÓSTICO

**DADOS:**
- Sinais perdedores: ATR 48% maior que vencedores
- Sinais perdedores: volatility_24h 39% maior que vencedores

**CAUSA RAIZ:**

Existe um veto de volatilidade **absoluto** (ATR < 0.3%), mas **não existe veto relativo** (ATR > média do símbolo * 1.3x).

**Localização:**

1. **Swing** (`backend/src/engine/signalEngine.ts` linha 619-625):
```typescript
// Linha 619-625: Veto de volatilidade MORTA, mas não de volatilidade ALTA
const atrPercentForVeto = currentPriceForVeto > 0 ? (atr / currentPriceForVeto) * 100 : 0;
if (atrPercentForVeto < 0.4) {
    logger.debug(`[SIGNAL-VETO] ${symbol} ❌ VETO ATR: ${atrPercentForVeto.toFixed(2)}% < 0.4%`);
    return null;
}
// ❌ FALTA: Veto de ATR > média * 1.3x
```

2. **Scalping** (`backend/src/engine/scalpingEngine.ts` linha 193-199):
```typescript
// Linha 193-199: Mesmo problema
const atrPct = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;
if (atrPct < 0.3) {
    logger.debug(`[SCALPING-DIAG] ${symbol} ❌ VETO: Volatilidade morta (ATR < 0.3%)`);
    return null;
}
// ❌ FALTA: Veto de ATR alto
```

---

## 📋 RESUMO DOS PROBLEMAS

| # | Problema | Severidade | Impacto | Arquivo Principal |
|---|----------|------------|---------|-------------------|
| 1 | "Confidence invertido" | ⚠️ Falso | Score ≠ Aprendizado | `signalEngine.ts` |
| 2 | Modelo perdeu aprendizado | 🔴 Crítico | -99,3% confidence | `mlRetrainJob.ts` |
| 3 | Sem isolamento por moeda | 🔴 Crítico | Correlação -0,21 | `train_model.py` |
| 4 | Quality score caiu | 🟡 Moderado | -29% qualidade | `signalEngine.ts` |
| 5 | Volatilidade alta não filtrada | 🟡 Moderado | +48% ATR em losses | `signalEngine.ts` |

---

## 🎯 PRÓXIMOS PASSOS

Vou criar arquivos separados com as correções detalhadas para cada problema:

1. `FIX_PROBLEMA_2_VERSIONAMENTO.md` - Backup e rollback de modelos
2. `FIX_PROBLEMA_3_ISOLAMENTO_MOEDA.md` - Modelo por símbolo
3. `FIX_PROBLEMA_4_QUALITY_FLOOR.md` - Limite mínimo de quality_score
4. `FIX_PROBLEMA_5_FILTRO_VOLATILIDADE.md` - Veto de ATR alto

Deseja que eu crie as correções agora?
