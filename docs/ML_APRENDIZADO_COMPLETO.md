# Sistema de Aprendizado de Machine Learning - Completo

## Resumo Executivo

✅ **SIM**, o robô aprende TODO DIA às 23:55 UTC
✅ **SIM**, o scalping e o robô principal compartilham o MESMO sistema de aprendizado
✅ Ambos alimentam o mesmo modelo de ML com seus resultados

## Como Funciona o Aprendizado

### 1. Coleta de Dados (Durante o Dia)

#### Robô Principal (1H)
Quando um sinal é gerado:
```typescript
signal.mlData = {
    symbol_id: getSymbolId(symbol),
    rsi: 45.2,
    adx: 32.5,
    atr_rel: 0.015,
    dist_ema20: 0.02,
    dist_ema50: 0.05,
    dist_ema200: 0.08,
    dist_vwap: 0.01,
    volatility_24h: 3.5,
    volume_rel: 1.8,
    funding_rate: 0.0001,
    // ... 25 features no total
}
```

#### Robô de Scalping (5M)
Quando um sinal é gerado:
```typescript
signal.mlData = {
    symbol_id: getSymbolId(symbol),
    rsi: 38.5,
    adx: 25,
    atr_rel: 0.008,
    dist_ema20: 0.015,
    dist_ema50: 0.03,
    dist_ema200: 0,
    dist_vwap: 0.005,
    volume_rel: 2.1,
    // ... mesmas features
}
```

**IMPORTANTE:** Ambos usam as MESMAS features, apenas com valores diferentes baseados no timeframe.

### 2. Feedback Loop (Quando Trade Fecha)

Quando um trade fecha (TP ou SL), o `tradeTracker.ts` executa:

```typescript
// Para QUALQUER tipo de trade (Principal ou Scalping)
private async submitFeedbackToML(signal, outcomeLabel, finalPrice) {
    // 1. Busca as features originais do sinal
    const originalSignal = await db.tradeSignal.findUnique({
        where: { id: signal.id }
    });
    
    // 2. Calcula o resultado
    const outcome = outcomeLabel; // 1 = WIN, 0 = LOSS
    const pnl = calculatePnL(signal, finalPrice);
    
    // 3. Salva no banco de dados
    await db.mLTrainingData.create({
        signal_id: signal.id,
        symbol: signal.pair,
        outcome_label: outcome,
        outcome_pnl: pnl,
        features: originalSignal.ml_data // Features originais
    });
    
    // 4. Backup local (JSONL)
    fs.appendFileSync('ml_engine/data/historical_ml_data.jsonl', ...);
}
```

**Não há diferença** entre scalping e principal - ambos chamam a mesma função!

### 3. Retreinamento Diário (23:55 UTC)

O job `mlRetrainJob.ts` executa automaticamente:

```typescript
cron.schedule('55 23 * * *', async () => {
    logger.info('🎓 Iniciando Retreinamento Diário...');
    
    // 1. Busca TODOS os dados (Principal + Scalping)
    const allData = await db.mLTrainingData.findMany();
    
    // 2. Treina novo modelo Random Forest
    exec('python3 train_model.py', ...);
    
    // 3. Valida acurácia
    // 4. Substitui modelo se melhorar
    // 5. Recarrega backend (hot reload)
}, { timezone: 'UTC' });
```

## Diferenças Entre Principal e Scalping

| Aspecto | Robô Principal | Robô Scalping | Aprendizado ML |
|---------|----------------|---------------|----------------|
| Timeframe | 1H | 5M | **MESMO** |
| Features | 25 indicadores | 25 indicadores | **MESMO** |
| Feedback | submitFeedbackToML() | submitFeedbackToML() | **MESMO** |
| Tabela DB | ml_training_data | ml_training_data | **MESMO** |
| Modelo | current_model.onnx | current_model.onnx | **MESMO** |
| Retreinamento | 23:55 UTC | 23:55 UTC | **MESMO** |

**Conclusão:** O ML NÃO diferencia entre scalping e principal. Ele aprende com TODOS os trades.

## Vantagens do Sistema Unificado

✅ **Mais dados**: Scalping gera mais trades = mais dados para treinar
✅ **Aprendizado cruzado**: Padrões do 5M ajudam o 1H e vice-versa
✅ **Modelo único**: Mais simples de manter e melhorar
✅ **Adaptação rápida**: Aprende com ambos os timeframes simultaneamente

## Fluxo Completo

```
DIA 1 - 10:00 UTC
├─ Robô Principal gera sinal BTCUSDT LONG (1H)
│  └─ Salva features no signal.mlData
├─ Robô Scalping gera sinal ETHUSDT SHORT (5M)
│  └─ Salva features no signal.mlData

DIA 1 - 15:30 UTC
├─ BTCUSDT atinge TP1 → submitFeedbackToML(WIN)
│  └─ Salva em ml_training_data
├─ ETHUSDT atinge SL → submitFeedbackToML(LOSS)
│  └─ Salva em ml_training_data

DIA 1 - 23:55 UTC
└─ Job de Retreinamento executa
   ├─ Busca TODOS os dados (Principal + Scalping)
   ├─ Treina novo modelo
   ├─ Valida acurácia
   └─ Recarrega modelo se melhorar

DIA 2 - 00:00 UTC
└─ Novo modelo em produção
   ├─ Filtra sinais do Principal (prob < 65%)
   └─ Filtra sinais do Scalping (prob < 60%)
```

## Requisitos para Treinar

- Mínimo: 50 trades fechados
- Pelo menos 5% de cada classe (wins e losses)
- Se não houver dados suficientes, aguarda próximo dia

## Monitoramento

### Ver dados de treinamento:
```bash
node backend/scripts/check_ml_data.ts
```

### Forçar retreinamento manual:
```bash
curl -X POST http://localhost:3001/api/ml/retrain
```

### Ver estatísticas do modelo:
```bash
curl http://localhost:3001/api/ml/stats
```

## Perguntas Frequentes

**Q: O scalping aprende separado do principal?**
A: NÃO. Ambos alimentam o mesmo modelo.

**Q: O modelo diferencia entre 1H e 5M?**
A: NÃO diretamente. Ele aprende padrões de features, não timeframes.

**Q: Posso ter modelos separados?**
A: Sim, mas precisaria modificar o código. Atualmente é unificado.

**Q: Quantos trades por dia são necessários?**
A: Idealmente 10-20 trades fechados por dia para treinar bem.

**Q: O que acontece se não houver dados suficientes?**
A: O job aguarda até o próximo dia. O modelo atual continua ativo.
