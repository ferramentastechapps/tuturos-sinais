# 🔧 CORREÇÕES CIRÚRGICAS ML — 4 FIXES CRÍTICOS

**Data:** 09/05/2026  
**Status:** ✅ APLICADO — Pronto para deploy

---

## 📋 RESUMO EXECUTIVO

Aplicadas 4 correções cirúrgicas nos robôs de trading para resolver problemas críticos de ML:

1. **Confidence invertido** → Correlação negativa -0.21 entre confidence e win_rate
2. **Retreinamento sem backup** → Modelos ruins sobrescreviam modelos bons
3. **Sem isolamento por moeda** → Um modelo global para 81 moedas diferentes
4. **Sem filtro de volatilidade alta** → Sinais perdedores tinham ATR 48% maior

---

## ✅ CORREÇÃO 1 — CRÍTICO: confidence invertido

### Problema
```typescript
// ANTES (ERRADO)
confidence: probability > 0.5 ? probability : 1 - probability
```
- probability=0.35 (modelo acha que vai PERDER) virava confidence=0.65
- Sistema ficava mais confiante nos trades perdedores
- Correlação negativa -0.21 entre confidence e win_rate

### Solução
```typescript
// DEPOIS (CORRETO)
confidence: probability,  // probabilidade direta de win — não inverter
```

### Arquivos modificados
- `backend/src/ml/mlPredictionService.ts`

### Log esperado
```
[ML-CONFIDENCE] BTCUSDT: prob=0.7234, predictedClass=1, model=symbol_specific
```

---

## ✅ CORREÇÃO 2 — CRÍTICO: retreinamento com backup e validação

### Problema
- Salvava direto em `current_model.onnx` sem validação
- Modelo ruim sobrescrevia modelo bom para sempre
- Queda de confidence de ~100 para 0.66 a partir de 20/abr

### Solução
1. **Backup automático** antes de treinar
2. **Treina em temp_model.onnx** (não sobrescreve)
3. **Valida métricas**: accuracy >= 0.55 e samples >= 50
4. **Só substitui se passou** na validação
5. **Mantém 10 backups** mais recentes

### Arquivos modificados
- `backend/src/jobs/mlRetrainJob.ts`

### Logs esperados
```
[MLRetrain] ✅ Backup criado: ml_models_backup/model_backup_2026-05-09T12-30-45-123Z.onnx
[MLRetrain] ⚠️ Modelo rejeitado: accuracy=0.523, samples=45
[MLRetrain] ✅ Novo modelo ativado: accuracy=0.672
```

---

## ✅ CORREÇÃO 3 — CRÍTICO: isolamento de aprendizado por moeda

### Problema
- Um único modelo global para 81 moedas
- `symbol_id` (hash) calculado diferente em Python vs TypeScript
- Correlação win_rate vs confidence por moeda = -0.21 (negativa)

### Solução

#### Python (train_model.py)
1. Removido `symbol_id` das features
2. Treina modelo global (fallback)
3. Treina modelos específicos por símbolo (>= 30 amostras)
4. Salva em `ml_models/{SYMBOL}/model.onnx`
5. Valida accuracy >= 0.55 antes de salvar

#### TypeScript (mlPredictionService.ts)
1. Removido `getSymbolId()` e `symbol_id`
2. Cache de modelos por símbolo (2h TTL)
3. `predictSignal(features, symbol?, tradeType?)` — retrocompatível
4. Tenta carregar modelo específico, fallback para global
5. Retorna `modelSource: 'symbol_specific' | 'global_fallback'`

#### Engines (signalEngine.ts, scalpingEngine.ts)
1. Removido `symbol_id` do objeto features
2. Passa `symbol` e `tradeType` para `predictSignal()`
3. Limpa cache após retreinamento

### Arquivos modificados
- `ml_engine/train_model.py`
- `backend/src/ml/mlPredictionService.ts`
- `backend/src/types/mlTypes.ts`
- `backend/src/engine/signalEngine.ts`
- `backend/src/engine/scalpingEngine.ts`
- `backend/src/jobs/mlRetrainJob.ts`

### Logs esperados
```
=== Treinando modelos por símbolo ===
✅ BTCUSDT: accuracy=0.682, samples=156
✅ ETHUSDT: accuracy=0.591, samples=89
⚠️ DOGEUSDT: accuracy=0.512 < 0.55 (rejeitado)
Loaded symbol-specific model for BTCUSDT
[ML-CONFIDENCE] BTCUSDT: prob=0.7234, predictedClass=1, model=symbol_specific
Symbol model cache cleared
```

---

## ✅ CORREÇÃO 4 — MODERADO: filtro de volatilidade alta por símbolo

### Problema
- Robôs vetavam volatilidade MORTA (ATR < 0.3%/0.4%)
- Não vetavam volatilidade ALTA
- Sinais perdedores: ATR 48% maior, volatility_24h 39% maior
- Threshold global não funciona (cada moeda tem volatilidade normal diferente)

### Solução

#### Novo arquivo: volatilityTracker.ts
- Histórico de 20 snapshots por símbolo
- `record(symbol, atr_pct, volatility_24h)` — adiciona ao histórico
- `isHighVolatility(symbol, currentATR, currentVol24h, multiplier)`:
  - Calcula média dos últimos 20 snapshots
  - Veta se **AMBOS** > média × multiplier
  - Benefício da dúvida se histórico < 3

#### signalEngine.ts (Swing)
- Multiplier: **1.3x** (mais conservador)
- Registra após vetos de ADX e ATR morto
- Veta se volatilidade alta detectada

#### scalpingEngine.ts (Scalping)
- Multiplier: **1.4x** (aceita mais volatilidade)
- Registra após veto de ATR < 0.3%
- Veta se volatilidade alta detectada

### Arquivos modificados
- `backend/src/services/volatilityTracker.ts` (NOVO)
- `backend/src/engine/signalEngine.ts`
- `backend/src/engine/scalpingEngine.ts`

### Logs esperados
```
[SIGNAL-VETO] ETHUSDT ❌ VETO VOLATILIDADE ALTA: ATR 2.34% > 1.82% E Vol24h 8.45% > 6.12%
[SCALPING-DIAG] SOLUSDT ❌ VETO VOLATILIDADE ALTA: ATR 1.89% > 1.35% E Vol24h 7.23% > 5.16%
```

---

## 📦 ARQUIVOS MODIFICADOS

### Backend TypeScript (7 arquivos)
1. ✅ `backend/src/ml/mlPredictionService.ts` — Correções 1 e 3
2. ✅ `backend/src/jobs/mlRetrainJob.ts` — Correções 2 e 3
3. ✅ `backend/src/types/mlTypes.ts` — Correção 3
4. ✅ `backend/src/engine/signalEngine.ts` — Correções 3 e 4
5. ✅ `backend/src/engine/scalpingEngine.ts` — Correções 3 e 4
6. ✅ `backend/src/services/volatilityTracker.ts` — Correção 4 (NOVO)

### Python ML (1 arquivo)
7. ✅ `ml_engine/train_model.py` — Correção 3

---

## 🚀 DEPLOY

### Passo 1: Sync e Build
```powershell
.\sync.ps1
```

### Passo 2: Verificar logs no VPS
```bash
pm2 logs backend --lines 50 | grep -E "ML-CONFIDENCE|MLRetrain|VETO VOLATILIDADE"
```

### Passo 3: Forçar retreinamento (opcional)
```bash
cd /root/tuturos-sinais/backend
node -e "require('./dist/jobs/mlRetrainJob.js').executeRetrain()"
```

---

## 🎯 RESULTADOS ESPERADOS

### Imediato (após deploy)
- ✅ Confidence agora reflete probabilidade real de win
- ✅ Modelos ruins não sobrescrevem modelos bons
- ✅ Volatilidade anormal é vetada por símbolo

### Após primeiro retreinamento (23:55 UTC)
- ✅ Modelos específicos por moeda (se >= 30 amostras)
- ✅ Backup automático do modelo anterior
- ✅ Validação de accuracy antes de ativar

### Médio prazo (7-14 dias)
- 📈 Correlação confidence vs win_rate: -0.21 → +0.40 (esperado)
- 📈 Win rate geral: 42% → 55%+ (esperado)
- 📉 Drawdown máximo: redução de 30%+ (esperado)

---

## ⚠️ ATENÇÃO

### Não quebra retrocompatibilidade
- `predictSignal()` funciona sem parâmetros (fallback global)
- Modelos antigos continuam funcionando
- Transição gradual para modelos por símbolo

### Primeira execução
- Pode não ter modelos específicos ainda (usa global)
- Após 23:55 UTC, modelos específicos serão criados
- Símbolos com < 30 amostras usam modelo global

---

## 📊 MONITORAMENTO

### Logs críticos para acompanhar
```bash
# Confidence correto
grep "ML-CONFIDENCE" /root/.pm2/logs/backend-out.log | tail -20

# Retreinamento com validação
grep "MLRetrain" /root/.pm2/logs/backend-out.log | tail -30

# Modelos por símbolo
grep "symbol-specific\|global_fallback" /root/.pm2/logs/backend-out.log | tail -20

# Vetos de volatilidade alta
grep "VETO VOLATILIDADE ALTA" /root/.pm2/logs/backend-out.log | tail -20
```

### Métricas para validar sucesso
1. **Correlação confidence vs win_rate** (deve ficar positiva)
2. **Accuracy dos modelos** (deve manter >= 0.55)
3. **Taxa de vetos por volatilidade alta** (5-10% dos sinais)
4. **Número de modelos específicos criados** (moedas com >= 30 trades)

---

**FIM DO DOCUMENTO**
