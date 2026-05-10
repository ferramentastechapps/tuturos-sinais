# 📋 PLANO DE IMPLEMENTAÇÃO COMPLETO - CORREÇÕES ML

## 🎯 RESUMO EXECUTIVO

Análise de **53.800 sinais** revelou 5 problemas críticos no sistema ML dos robôs de trading. Este documento apresenta o plano completo de correção.

### Problemas Identificados

| # | Problema | Severidade | Impacto | Status |
|---|----------|------------|---------|--------|
| 1 | "Confidence invertido" | ⚠️ Falso Positivo | Score ≠ Aprendizado | ✅ Explicado |
| 2 | Modelo perdeu aprendizado | 🔴 Crítico | -99,3% confidence | 🔧 Correção pronta |
| 3 | Sem isolamento por moeda | 🔴 Crítico | Correlação -0,21 | 🔧 Correção pronta |
| 4 | Quality score caiu 29% | 🟡 Moderado | Filtros permissivos | 🔧 Correção pronta |
| 5 | Volatilidade alta não filtrada | 🟡 Moderado | +48% ATR em losses | 🔧 Correção pronta |

---

## 📂 ARQUIVOS DE CORREÇÃO CRIADOS

1. **ANALISE_PROBLEMAS_ML.md** - Diagnóstico completo dos 5 problemas
2. **FIX_PROBLEMA_2_VERSIONAMENTO_MODELOS.md** - Backup e rollback automático
3. **FIX_PROBLEMA_3_ISOLAMENTO_POR_MOEDA.md** - Modelo por símbolo
4. **FIX_PROBLEMAS_4_E_5_FILTROS.md** - Quality score e volatilidade

---

## 🚀 ORDEM DE IMPLEMENTAÇÃO RECOMENDADA

### FASE 1: Correções Críticas (Prioridade Máxima)

#### 1.1 Versionamento de Modelos (Problema 2)
**Tempo estimado**: 2-3 horas  
**Risco**: Baixo  
**Impacto**: Alto (evita perda de aprendizado)

**Arquivos a modificar**:
- `backend/src/jobs/mlRetrainJob.ts`
- `ml_engine/train_model.py`
- Criar: `backend/scripts/rollback_model.sh`

**Passos**:
1. Implementar backup automático antes de retreinamento
2. Adicionar validação de qualidade (accuracy > 55%, samples > 50)
3. Implementar rollback automático se novo modelo for pior
4. Criar script de rollback manual
5. Testar com retreinamento forçado

**Validação**:
```bash
# Forçar retreinamento
curl -X POST http://localhost:3001/api/ml/retrain

# Verificar backups criados
ls -lht backend/ml_models/

# Testar rollback manual
cd backend/scripts && ./rollback_model.sh
```

---

#### 1.2 Isolamento por Moeda (Problema 3)
**Tempo estimado**: 4-6 horas  
**Risco**: Médio (mudança arquitetural)  
**Impacto**: Muito Alto (resolve correlação negativa)

**Arquivos a modificar**:
- `backend/src/ml/mlPredictionService.ts` (reescrita completa)
- `backend/src/engine/signalEngine.ts` (atualizar chamadas)
- `backend/src/engine/scalpingEngine.ts` (atualizar chamadas)
- `backend/src/jobs/mlRetrainJob.ts` (usar novo script)
- Criar: `ml_engine/train_per_symbol.py`

**Passos**:
1. Criar serviço de predição com cache de modelos por símbolo
2. Criar script Python de treinamento por símbolo
3. Atualizar chamadas de predição nos robôs (adicionar parâmetros symbol e tradeType)
4. Atualizar job de retreinamento para usar novo script
5. Criar estrutura de diretórios `ml_models/{SYMBOL}/`
6. Treinar modelos iniciais para top 10 moedas
7. Testar predição com modelo específico vs fallback

**Validação**:
```bash
# Treinar modelos para símbolos principais
cd ml_engine
python3 train_per_symbol.py --min-samples 20 --symbols BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT

# Verificar estrutura criada
ls -R backend/ml_models/

# Testar API de estatísticas
curl http://localhost:3001/api/ml/models
```

---

### FASE 2: Correções Moderadas (Prioridade Alta)

#### 2.1 Floor Dinâmico de Quality Score (Problema 4)
**Tempo estimado**: 1-2 horas  
**Risco**: Baixo  
**Impacto**: Médio (melhora qualidade dos sinais)

**Arquivos a modificar**:
- `backend/src/engine/signalEngine.ts`
- `backend/src/engine/scalpingEngine.ts`

**Passos**:
1. Criar função `calculateMinScore()` com lógica dinâmica
2. Aplicar no Swing Robot (base 7/10, +1 se contra-tendência)
3. Aplicar no Scalping Robot (base 5/10 fixo)
4. Adicionar logs de threshold calculado
5. Testar com diferentes cenários

**Validação**:
```bash
# Monitorar logs de threshold
pm2 logs tuturos-backend | grep "SCORE-THRESHOLD"

# Verificar que sinais com score < threshold são vetados
pm2 logs tuturos-backend | grep "VETO SCORE"
```

---

#### 2.2 Filtro de Volatilidade Alta (Problema 5)
**Tempo estimado**: 2-3 horas  
**Risco**: Baixo  
**Impacto**: Médio (reduz losses em volatilidade extrema)

**Arquivos a modificar**:
- Criar: `backend/src/services/volatilityTracker.ts`
- `backend/src/engine/signalEngine.ts`
- `backend/src/engine/scalpingEngine.ts`
- `backend/src/server/api.ts` (adicionar endpoint)
- Criar: `src/pages/VolatilityMonitor.tsx` (opcional)

**Passos**:
1. Criar serviço VolatilityTracker
2. Integrar no Swing Robot (threshold 1.3x)
3. Integrar no Scalping Robot (threshold 1.4x)
4. Adicionar endpoint de API para monitoramento
5. Criar dashboard de volatilidade (opcional)
6. Testar com dados históricos

**Validação**:
```bash
# Ver estatísticas de volatilidade
curl http://localhost:3001/api/volatility/stats

# Monitorar vetos de volatilidade
pm2 logs tuturos-backend | grep "VETO VOLATILIDADE ALTA"
```

---

### FASE 3: Monitoramento e Validação (Prioridade Média)

#### 3.1 Logs de Monitoramento
**Tempo estimado**: 1 hora  
**Risco**: Nenhum  
**Impacto**: Alto (visibilidade do sistema)

**Logs a adicionar**:

1. **Após retreinamento bem-sucedido**:
```typescript
logger.info('[MLRetrain] ✅ MODELO APROVADO', {
    accuracy: metrics.accuracy,
    samples: metrics.sampleSize,
    previous_backup: backupPath,
    new_model_active: true
});
```

2. **Após rollback automático**:
```typescript
logger.warn('[MLRetrain] ⚠️  MODELO REJEITADO - ROLLBACK AUTOMÁTICO', {
    accuracy: metrics.accuracy,
    min_required: MIN_ACCURACY,
    samples: metrics.sampleSize,
    keeping_previous_model: true
});
```

3. **Após predição com modelo específico**:
```typescript
logger.debug(`[ML-PREDICT] ${symbol} ${tradeType}: prob=${prediction.probability.toFixed(3)}, source=${prediction.modelSource}`);
```

4. **Após veto de volatilidade**:
```typescript
logger.debug(`[VOL-VETO] ${symbol}: ATR=${atr_pct.toFixed(2)}% (${volCheck.atrRatio?.toFixed(2)}x avg), Vol24h=${volatility_24h.toFixed(2)}% (${volCheck.volRatio?.toFixed(2)}x avg)`);
```

---

#### 3.2 Endpoints de API para Monitoramento
**Tempo estimado**: 1 hora  
**Risco**: Nenhum  
**Impacto**: Médio (facilita debugging)

**Endpoints a criar**:

1. **GET /api/ml/models** - Estatísticas dos modelos carregados
```json
{
  "loaded_models": {
    "BTCUSDT_swing": {
      "accuracy": 0.68,
      "sampleSize": 150,
      "trainedAt": "2026-05-09T..."
    }
  },
  "total_models": 12,
  "fallback_loaded": true
}
```

2. **GET /api/volatility/stats/:symbol?** - Estatísticas de volatilidade
```json
{
  "symbol": "BTCUSDT",
  "samples": 15,
  "avgATR": 1.8,
  "avgVol24h": 3.2,
  "oldestSnapshotAge": "120 min"
}
```

3. **POST /api/ml/retrain** - Forçar retreinamento (já existe)

4. **POST /api/ml/clear-cache** - Limpar cache de modelos
```typescript
router.post('/ml/clear-cache', async (_req: Request, res: Response) => {
    try {
        const { clearModelCache } = await import('../ml/mlPredictionService.js');
        clearModelCache();
        res.json({ success: true, message: 'Model cache cleared' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
```

---

## 🧪 PLANO DE TESTES

### Testes Unitários

#### 1. VolatilityTracker
```typescript
// backend/tests/volatilityTracker.test.ts
import { volatilityTracker } from '../src/services/volatilityTracker';

describe('VolatilityTracker', () => {
    beforeEach(() => {
        volatilityTracker.clear();
    });
    
    it('should record snapshots', () => {
        volatilityTracker.record('BTCUSDT', 1.5, 3.0, 50000);
        const stats = volatilityTracker.getStats('BTCUSDT');
        expect(stats.samples).toBe(1);
    });
    
    it('should detect high volatility', () => {
        // Registrar 5 snapshots normais
        for (let i = 0; i < 5; i++) {
            volatilityTracker.record('BTCUSDT', 1.5, 3.0, 50000);
        }
        
        // Testar volatilidade alta
        const check = volatilityTracker.isHighVolatility('BTCUSDT', 3.0, 6.0, 1.3);
        expect(check.isHigh).toBe(true);
    });
    
    it('should not veto without history', () => {
        const check = volatilityTracker.isHighVolatility('NEWCOIN', 5.0, 10.0, 1.3);
        expect(check.isHigh).toBe(false);
    });
});
```

#### 2. Model Versioning
```typescript
// backend/tests/mlRetrain.test.ts
import { executeRetrain } from '../src/jobs/mlRetrainJob';
import fs from 'fs';
import path from 'path';

describe('ML Retrain Job', () => {
    it('should create backup before retraining', async () => {
        const backendDir = path.resolve(__dirname, '../');
        const modelsDir = path.join(backendDir, 'ml_models');
        
        await executeRetrain();
        
        const backups = fs.readdirSync(modelsDir)
            .filter(f => f.startsWith('model_backup_'));
        
        expect(backups.length).toBeGreaterThan(0);
    });
    
    it('should reject model with low accuracy', async () => {
        // Simular métricas ruins
        const metricsPath = path.join(__dirname, '../model_metrics.json');
        fs.writeFileSync(metricsPath, JSON.stringify({
            accuracy: 0.45,
            sampleSize: 100
        }));
        
        const result = await executeRetrain();
        expect(result).toBe(false);
    });
});
```

---

### Testes de Integração

#### 1. Predição com Modelo por Símbolo
```bash
#!/bin/bash
# backend/tests/integration/test_symbol_models.sh

echo "🧪 Testando predição com modelos por símbolo..."

# 1. Treinar modelos para 3 símbolos
cd ml_engine
python3 train_per_symbol.py --min-samples 20 --symbols BTCUSDT,ETHUSDT,SOLUSDT

# 2. Verificar que modelos foram criados
if [ ! -f "../backend/ml_models/BTCUSDT/swing_model.onnx" ]; then
    echo "❌ Modelo BTCUSDT não foi criado"
    exit 1
fi

# 3. Reiniciar backend
pm2 restart tuturos-backend
sleep 5

# 4. Testar predição via API
RESPONSE=$(curl -s http://localhost:3001/api/ml/models)
BTCUSDT_LOADED=$(echo $RESPONSE | jq '.loaded_models | has("BTCUSDT_swing")')

if [ "$BTCUSDT_LOADED" = "true" ]; then
    echo "✅ Modelo BTCUSDT carregado com sucesso"
else
    echo "❌ Modelo BTCUSDT não foi carregado"
    exit 1
fi

echo "✅ Todos os testes passaram"
```

#### 2. Filtro de Volatilidade
```bash
#!/bin/bash
# backend/tests/integration/test_volatility_filter.sh

echo "🧪 Testando filtro de volatilidade..."

# 1. Gerar sinais em condições normais
echo "Gerando sinais em volatilidade normal..."
SIGNALS_NORMAL=$(pm2 logs tuturos-backend --lines 100 | grep "Signal generated" | wc -l)

# 2. Simular volatilidade alta (injetar dados via API de teste)
curl -X POST http://localhost:3001/api/test/inject-high-volatility \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["BTCUSDT", "ETHUSDT"], "multiplier": 2.0}'

# 3. Aguardar próximo ciclo
sleep 120

# 4. Verificar que sinais foram vetados
VETOS=$(pm2 logs tuturos-backend --lines 100 | grep "VETO VOLATILIDADE ALTA" | wc -l)

if [ $VETOS -gt 0 ]; then
    echo "✅ Filtro de volatilidade funcionando ($VETOS vetos detectados)"
else
    echo "❌ Filtro de volatilidade não vetou sinais"
    exit 1
fi

echo "✅ Teste de volatilidade passou"
```

---

## 📊 MÉTRICAS DE SUCESSO

### Antes das Correções (Baseline)

| Métrica | Valor Atual |
|---------|-------------|
| Win Rate Geral | ~45% |
| Confidence médio (vencedores) | 32,5 |
| Confidence médio (perdedores) | 67,6 |
| Correlação win_rate vs confidence | -0,21 |
| Quality score médio (últimos 7 dias) | 0,63 |
| ATR médio (sinais perdedores) | 48% maior |
| Volatility_24h média (perdedores) | 39% maior |

### Após Correções (Metas)

| Métrica | Meta | Como Medir |
|---------|------|------------|
| Win Rate Geral | 52-55% | Query SQL em ml_training_data |
| Correlação win_rate vs confidence | > 0 (positiva) | Análise estatística por moeda |
| Quality score médio | 0,75-0,80 | Média dos últimos 30 dias |
| Modelos por símbolo treinados | > 20 | Contar arquivos em ml_models/ |
| Backups de modelo criados | 100% dos retreinamentos | Verificar ml_models/backups/ |
| Rollbacks automáticos | > 0 (quando necessário) | Logs de MLRetrain |
| Vetos de volatilidade alta | 10-15% dos sinais | Logs de VOL-VETO |

---

## 🔄 CRONOGRAMA DE IMPLEMENTAÇÃO

### Semana 1: Correções Críticas
- **Dia 1-2**: Implementar versionamento de modelos (Problema 2)
- **Dia 3-5**: Implementar isolamento por moeda (Problema 3)
- **Dia 6-7**: Testes de integração e validação

### Semana 2: Correções Moderadas + Monitoramento
- **Dia 1-2**: Implementar floor dinâmico (Problema 4)
- **Dia 3-4**: Implementar filtro de volatilidade (Problema 5)
- **Dia 5**: Adicionar logs e endpoints de monitoramento
- **Dia 6-7**: Testes finais e documentação

### Semana 3: Observação e Ajustes
- **Dia 1-7**: Monitorar métricas em produção
- Ajustar thresholds se necessário
- Coletar feedback dos resultados

---

## 🚨 RISCOS E MITIGAÇÕES

### Risco 1: Modelos por símbolo com poucos dados
**Probabilidade**: Alta  
**Impacto**: Médio  
**Mitigação**: Usar modelo fallback global para símbolos com < 30 samples

### Risco 2: Retreinamento falhar em produção
**Probabilidade**: Média  
**Impacto**: Alto  
**Mitigação**: Backup automático + rollback automático + script manual

### Risco 3: Filtros muito restritivos reduzem sinais drasticamente
**Probabilidade**: Média  
**Impacto**: Médio  
**Mitigação**: Monitorar taxa de vetos, ajustar thresholds gradualmente

### Risco 4: Cache de modelos consumir muita memória
**Probabilidade**: Baixa  
**Impacto**: Médio  
**Mitigação**: Limitar cache a 50 modelos, recarregar a cada 24h

---

## 📞 SUPORTE PÓS-IMPLEMENTAÇÃO

### Comandos Úteis

```bash
# Ver logs de ML
pm2 logs tuturos-backend | grep "\[ML"

# Ver logs de retreinamento
pm2 logs tuturos-backend | grep "\[MLRetrain\]"

# Ver logs de vetos
pm2 logs tuturos-backend | grep "VETO"

# Forçar retreinamento
curl -X POST http://localhost:3001/api/ml/retrain

# Limpar cache de modelos
curl -X POST http://localhost:3001/api/ml/clear-cache

# Ver estatísticas de modelos
curl http://localhost:3001/api/ml/models | jq

# Ver estatísticas de volatilidade
curl http://localhost:3001/api/volatility/stats | jq

# Fazer rollback manual
cd backend/scripts && ./rollback_model.sh
```

### Queries SQL Úteis

```sql
-- Win rate geral
SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN outcome_label = 1 THEN 1 ELSE 0 END) as wins,
    AVG(CASE WHEN outcome_label = 1 THEN 1.0 ELSE 0.0 END) * 100 as win_rate
FROM ml_training_data
WHERE created_at > datetime('now', '-30 days');

-- Win rate por símbolo
SELECT 
    symbol,
    COUNT(*) as total,
    AVG(CASE WHEN outcome_label = 1 THEN 1.0 ELSE 0.0 END) * 100 as win_rate,
    AVG(outcome_pnl) as avg_pnl
FROM ml_training_data
WHERE created_at > datetime('now', '-30 days')
GROUP BY symbol
HAVING total >= 10
ORDER BY win_rate DESC;

-- Correlação confidence vs outcome por símbolo
SELECT 
    symbol,
    COUNT(*) as total,
    AVG(CASE WHEN outcome_label = 1 THEN json_extract(features, '$.confidence') ELSE NULL END) as avg_conf_wins,
    AVG(CASE WHEN outcome_label = 0 THEN json_extract(features, '$.confidence') ELSE NULL END) as avg_conf_losses
FROM ml_training_data
WHERE created_at > datetime('now', '-30 days')
GROUP BY symbol
HAVING total >= 20;
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Versionamento de Modelos
- [ ] Modificar `mlRetrainJob.ts` com backup automático
- [ ] Adicionar validação de qualidade no Python
- [ ] Criar script `rollback_model.sh`
- [ ] Testar backup automático
- [ ] Testar rollback automático
- [ ] Testar rollback manual

### Fase 2: Isolamento por Moeda
- [ ] Reescrever `mlPredictionService.ts` com cache por símbolo
- [ ] Criar `train_per_symbol.py`
- [ ] Atualizar chamadas em `signalEngine.ts`
- [ ] Atualizar chamadas em `scalpingEngine.ts`
- [ ] Atualizar `mlRetrainJob.ts`
- [ ] Treinar modelos iniciais para top 10 moedas
- [ ] Testar predição com modelo específico
- [ ] Testar fallback para símbolos novos

### Fase 3: Floor Dinâmico
- [ ] Criar função `calculateMinScore()`
- [ ] Aplicar no Swing Robot
- [ ] Aplicar no Scalping Robot
- [ ] Adicionar logs de threshold
- [ ] Testar com diferentes cenários

### Fase 4: Filtro de Volatilidade
- [ ] Criar `volatilityTracker.ts`
- [ ] Integrar no Swing Robot
- [ ] Integrar no Scalping Robot
- [ ] Adicionar endpoint `/api/volatility/stats`
- [ ] Criar dashboard (opcional)
- [ ] Testar com dados históricos

### Fase 5: Monitoramento
- [ ] Adicionar logs de retreinamento
- [ ] Adicionar logs de predição
- [ ] Adicionar logs de vetos
- [ ] Criar endpoint `/api/ml/models`
- [ ] Criar endpoint `/api/ml/clear-cache`
- [ ] Documentar comandos úteis

### Fase 6: Testes
- [ ] Testes unitários de VolatilityTracker
- [ ] Testes unitários de versionamento
- [ ] Teste de integração de modelos por símbolo
- [ ] Teste de integração de filtro de volatilidade
- [ ] Validação de métricas em produção

---

## 📚 DOCUMENTAÇÃO ADICIONAL

- **ANALISE_PROBLEMAS_ML.md** - Diagnóstico detalhado dos 5 problemas
- **FIX_PROBLEMA_2_VERSIONAMENTO_MODELOS.md** - Implementação de backup/rollback
- **FIX_PROBLEMA_3_ISOLAMENTO_POR_MOEDA.md** - Implementação de modelos por símbolo
- **FIX_PROBLEMAS_4_E_5_FILTROS.md** - Implementação de filtros de qualidade e volatilidade

---

## 🎉 CONCLUSÃO

Este plano de implementação resolve os 5 problemas identificados na análise de 53.800 sinais:

1. ✅ **Problema 1** (Confidence invertido): Explicado - não é um bug, é design
2. 🔧 **Problema 2** (Perda de aprendizado): Resolvido com versionamento e rollback
3. 🔧 **Problema 3** (Sem isolamento): Resolvido com modelos por símbolo
4. 🔧 **Problema 4** (Quality score baixo): Resolvido com floor dinâmico
5. 🔧 **Problema 5** (Volatilidade alta): Resolvido com filtro adaptativo

**Impacto esperado**:
- Win rate: 45% → 52-55% (+7-10 pontos)
- Correlação confidence vs win_rate: -0,21 → positiva
- Quality score: 0,63 → 0,75-0,80
- Robustez: Modelos não perdem aprendizado após retreinamento

**Tempo total estimado**: 2-3 semanas (incluindo testes e validação)
