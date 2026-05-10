# ✅ DEPLOY PRONTO - 5 Correções Críticas

**Data**: 10/05/2026  
**Status**: Pronto para deploy  
**VPS**: `root@212.85.10.239`  
**Path**: `/var/www/signal-dashboard`

---

## 📦 CORREÇÕES APLICADAS (Localmente)

### 1. ✅ Confidence Invertido
**Arquivo**: `backend/src/ml/mlPredictionService.ts`
- **ANTES**: `confidence: probability > 0.5 ? probability : 1 - probability`
- **DEPOIS**: `confidence: probability`
- **Log esperado**: `[ML-CONFIDENCE] prob=0.73, predictedClass=1, model=BTCUSDT`

### 2. ✅ Retreinamento com Backup
**Arquivo**: `backend/src/jobs/mlRetrainJob.ts`
- Backup automático antes de treinar
- Treina em arquivo temporário
- Valida accuracy >= 0.55 e samples >= 50
- Só substitui se passou na validação
- **Log esperado**: `[MLRetrain] Backup criado`, `[MLRetrain] Validacao OK`

### 3. ✅ Isolamento por Moeda
**Arquivos**: 
- `ml_engine/train_model.py` - Removido `symbol_id` das features
- `backend/src/ml/mlPredictionService.ts` - Cache por símbolo
- `backend/src/engine/signalEngine.ts` - Passa symbol para ML
- `backend/src/engine/scalpingEngine.ts` - Passa symbol para ML
- `backend/src/engine/backtest/backtestEngine.ts` - Corrigido import

**Mudanças**:
- Modelos salvos em `ml_models/{SYMBOL}/model.onnx`
- Removida função `getSymbolId()`
- Cache de modelos por símbolo (2h TTL)
- **Log esperado**: `[ML] Carregando modelo para BTCUSDT`

### 4. ✅ Filtro Volatilidade Alta
**Arquivo**: `backend/src/services/volatilityTracker.ts` (NOVO)
- Histórico de 20 snapshots por símbolo
- Veta se ATR E volatility_24h > média × multiplier
- Multiplier: 1.3x para swing, 1.4x para scalping
- Integrado em `signalEngine.ts` e `scalpingEngine.ts`
- **Log esperado**: `[VETO VOLATILIDADE ALTA] BTCUSDT - ATR=X, Vol24h=Y`

### 5. ✅ Trailing Stop Progressivo
**Arquivo**: `backend/src/trading/tradeTracker.ts`
- TP1 batido → stop move para ENTRADA (breakeven)
- TP2 batido → stop move para PREÇO DO TP1
- TP3 batido → stop move para PREÇO DO TP2
- Stop NUNCA piora (Math.max para LONG, Math.min para SHORT)
- **Log esperado**: `[TradeTracker] Stop atualizado: 50000 -> 51000`

---

## 🚀 COMO FAZER O DEPLOY

### Opção 1: Deploy com Compilação na VPS (RECOMENDADO)
```powershell
.\Deploy-SourceOnly.ps1
```

**O que faz**:
1. Conecta na VPS (pede senha)
2. Cria backup automático
3. Envia arquivos fonte (.ts e .py)
4. Compila na VPS
5. Reinicia o backend
6. Mostra logs

**Vantagens**:
- Não depende de compilação local
- Mais rápido
- Menos problemas de compatibilidade

### Opção 2: Deploy com Compilação Local
```powershell
.\Deploy-AllFixes.ps1
```

**O que faz**:
1. Compila localmente (pode travar se houver problemas)
2. Envia arquivos compilados + fonte
3. Reinicia na VPS

---

## 🔍 VERIFICAÇÃO PÓS-DEPLOY

### 1. Monitorar Logs
```bash
ssh root@212.85.10.239 'pm2 logs backend --lines 50'
```

### 2. Logs Esperados

#### Confidence Correto
```
[ML-CONFIDENCE] prob=0.73, predictedClass=1, model=BTCUSDT
```

#### Retreinamento com Backup
```
[MLRetrain] Backup criado: ml_models_backup/model_20260510_235500.onnx
[MLRetrain] Treinando modelo temporario...
[MLRetrain] Validacao OK: accuracy=0.67, samples=150
[MLRetrain] Modelo substituido com sucesso
```

#### Filtro Volatilidade
```
[VETO VOLATILIDADE ALTA] BTCUSDT - ATR=850 (media=600), Vol24h=0.045 (media=0.030)
```

#### Trailing Stop Progressivo
```
[TradeTracker] TP2 batido em BTCUSDT
[TradeTracker] Stop atualizado: 50000 -> 51000 (preco do TP1)
```

### 3. Verificar Status
```bash
ssh root@212.85.10.239 'pm2 status backend'
```

---

## 📊 PRÓXIMO RETREINAMENTO

**Horário**: 23:55 UTC (hoje)  
**O que vai acontecer**:
- Modelos específicos por moeda serão criados
- Backup automático antes de treinar
- Validação de accuracy e samples
- Só substitui se passar na validação

---

## 📝 DOCUMENTAÇÃO

- `CORRECOES_CIRURGICAS_ML.md` - Detalhes das 4 correções ML
- `FIX_TRAILING_STOP_PROGRESSIVO.md` - Detalhes do trailing stop

---

## ⚠️ PROBLEMAS CONHECIDOS

### Compilação Local Travando
Se `.\Deploy-AllFixes.ps1` travar na compilação:
1. Cancele com Ctrl+C
2. Use `.\Deploy-SourceOnly.ps1` (compila na VPS)

### Senha SSH
O script vai pedir senha SSH várias vezes:
- 1x para criar backup
- 1x para cada arquivo enviado (7 arquivos)
- 1x para compilar e reiniciar

**Total**: ~10 vezes

---

## ✅ CHECKLIST PRÉ-DEPLOY

- [x] Confidence invertido corrigido
- [x] Retreinamento com backup implementado
- [x] Isolamento por moeda implementado
- [x] Filtro volatilidade alta implementado
- [x] Trailing stop progressivo implementado
- [x] Import de `getSymbolId` removido
- [x] Variável `entryAvg` definida
- [x] Conflitos de merge resolvidos
- [x] IP da VPS correto (212.85.10.239)
- [x] Path da VPS correto (/var/www/signal-dashboard)
- [x] Scripts de deploy criados

---

## 🎯 EXECUTE AGORA

```powershell
.\Deploy-SourceOnly.ps1
```

Depois monitore:
```bash
ssh root@212.85.10.239 'pm2 logs backend --lines 50'
```
