# Sistema de Aprendizado Diário do Robô

## Resumo

O robô agora treina o modelo de Machine Learning **todo dia às 23:55 UTC** (final do dia), aprendendo com todos os trades que fecharam durante o dia.

## Como Funciona

### 1. Durante o Dia (Coleta de Dados)
- Cada sinal gerado contém 25 features (RSI, MACD, EMAs, volume, funding rate, etc.)
- Quando um trade fecha (TP ou SL), o sistema salva:
  - Features originais do sinal
  - Resultado real: `1 = Win` (TP) ou `0 = Loss` (SL)
  - PnL percentual
- Dados salvos em:
  - Tabela `ml_training_data` (Supabase)
  - Arquivo `ml_engine/data/historical_ml_data.jsonl` (backup local)

### 2. Final do Dia (Retreinamento Automático)
**Horário:** 23:55 UTC todos os dias

O job `mlRetrainJob.ts` executa automaticamente:
1. Busca todos os dados históricos acumulados
2. Treina um novo modelo Random Forest (200 árvores)
3. Valida contra 20% dos dados de teste
4. **Só substitui** o modelo atual se a acurácia melhorar
5. Recarrega o backend sem downtime (hot reload)

### 3. Próximo Dia (Modelo Melhorado)
- O novo modelo entra em produção automaticamente
- Sinais com probabilidade < 65% são vetados
- O robô fica progressivamente mais preciso

## Configuração do Cron

```typescript
// Diariamente às 23:55 UTC
cron.schedule('55 23 * * *', async () => {
    logger.info('🎓 Iniciando o Job de Retreinamento Diário de Machine Learning...');
    await executeRetrain();
}, {
    timezone: 'UTC'
});
```

## Métricas Monitoradas

O modelo avalia:
- **Accuracy**: Taxa de acerto geral
- **Precision**: Dos sinais que o modelo aprova, quantos realmente ganham
- **Recall**: Dos trades vencedores, quantos o modelo consegue identificar
- **F1-Score**: Balanço entre precisão e recall
- **AUC-ROC**: Capacidade de discriminação entre wins e losses

## Requisitos Mínimos

- Mínimo de 50 trades fechados para treinar
- Pelo menos 5% de cada classe (wins e losses)
- Se não houver dados suficientes, o job aguarda até o próximo dia

## Vantagens do Aprendizado Diário

✅ Adaptação rápida às mudanças de mercado
✅ Aprende com os trades do dia anterior
✅ Não precisa esperar 50 trades para melhorar
✅ Modelo sempre atualizado com dados recentes
✅ Zero intervenção manual necessária
