# FAQ - Machine Learning do Sistema

## Perguntas Frequentes

### Q1: O robô aprende todo dia?
**R:** SIM. Todo dia às 23:55 UTC, o sistema automaticamente:
- Coleta todos os trades fechados
- Treina um novo modelo
- Valida a acurácia
- Substitui o modelo se melhorar

### Q2: O scalping e o principal aprendem juntos ou separado?
**R:** JUNTOS. Ambos alimentam o mesmo modelo de ML:
- Mesma tabela de dados (`ml_training_data`)
- Mesmas features (25 indicadores)
- Mesmo modelo (`current_model.onnx`)
- Mesmo job de retreinamento

### Q3: Por que não ter modelos separados?
**R:** Vantagens do modelo unificado:
- Mais dados = aprendizado mais rápido
- Padrões do 5M ajudam o 1H e vice-versa
- Manutenção mais simples
- Modelo mais robusto

### Q4: Quantos trades são necessários para treinar?
**R:** Mínimo de 50 trades fechados, com pelo menos 5% de cada classe (wins e losses).

### Q5: O que acontece se não houver dados suficientes?
**R:** O job aguarda até o próximo dia. O modelo atual continua ativo.

### Q6: Como o ML filtra sinais ruins?
**R:** Cada sinal recebe uma probabilidade de sucesso:
- Principal: Veta sinais com prob < 65%
- Scalping: Veta sinais com prob < 60%

### Q7: O modelo sempre melhora?
**R:** NÃO. O sistema só substitui o modelo se a acurácia melhorar. Se piorar, mantém o modelo anterior.

### Q8: Posso forçar um retreinamento manual?
**R:** SIM:
```bash
curl -X POST http://localhost:3001/api/ml/retrain
```

### Q9: Como ver as estatísticas do modelo?
**R:** 
```bash
curl http://localhost:3001/api/ml/stats
```

Retorna:
```json
{
  "isReady": true,
  "activeModelVersion": "v1.2.3",
  "lastTrainingDate": 1234567890,
  "accuracy": 0.72,
  "precision": 0.76,
  "recall": 0.69
}
```

### Q10: Como ver os dados de treinamento?
**R:**
```bash
node backend/scripts/check_ml_data.ts
```

Mostra:
```
📊 Estatísticas de Dados de Treinamento ML

Total de registros: 523
WINS: 356 (68.07%)
LOSSES: 167 (31.93%)
```

### Q11: O que são as "features" do ML?
**R:** São 25 indicadores técnicos que o modelo analisa:
- RSI, ADX, ATR
- Distâncias das EMAs (20, 50, 200)
- VWAP, Volume Relativo
- Volatilidade 24h
- Funding Rate
- Fear & Greed Index
- Dominância BTC
- E mais...

### Q12: O ML substitui a análise técnica?
**R:** NÃO. O ML é um FILTRO adicional:
1. Análise técnica gera sinal (score 75-100)
2. ML valida o sinal (prob 0-100%)
3. Só passa se ambos aprovarem

### Q13: Quanto tempo leva para o modelo melhorar?
**R:** Depende do volume de trades:
- Com 20-30 trades/dia: 1-2 semanas
- Com 50+ trades/dia: 3-5 dias
- Melhoria é gradual e contínua

### Q14: O modelo aprende com trades perdedores?
**R:** SIM! Trades perdedores são ESSENCIAIS:
- Ensina o modelo a evitar padrões ruins
- Melhora a precisão geral
- Balanceia o aprendizado

### Q15: Posso desabilitar o ML?
**R:** SIM. No arquivo de configuração:
```typescript
ml: {
    enabled: false
}
```

Mas NÃO é recomendado - o ML melhora significativamente os resultados.

### Q16: O retreinamento causa downtime?
**R:** NÃO. O sistema usa "hot reload":
- Treina em background
- Substitui modelo sem reiniciar
- Zero downtime

### Q17: Onde ficam salvos os dados?
**R:** Em dois lugares:
1. Banco de dados: tabela `ml_training_data`
2. Backup local: `ml_engine/data/historical_ml_data.jsonl`

### Q18: O modelo esquece dados antigos?
**R:** NÃO. O modelo treina com TODOS os dados históricos:
- Dados de ontem
- Dados de semana passada
- Dados de mês passado
- Tudo acumulado

### Q19: Posso ver o código do ML?
**R:** SIM. Principais arquivos:
- `backend/src/jobs/mlRetrainJob.ts` - Job de retreinamento
- `backend/src/ml/mlPredictionService.ts` - Predições
- `backend/src/trading/tradeTracker.ts` - Feedback loop
- `ml_engine/train_model.py` - Script Python de treino

### Q20: O ML funciona em produção?
**R:** SIM. Sistema completo e testado:
- ✅ Coleta de dados automática
- ✅ Retreinamento diário ativo
- ✅ Filtragem de sinais funcionando
- ✅ Hot reload sem downtime
- ✅ Backup local + banco de dados

## Problemas Comuns

### "ML model not loaded"
**Solução:** Execute o primeiro treino manual:
```bash
cd ml_engine
python3 train_model.py
```

### "Not enough training data"
**Solução:** Aguarde acumular pelo menos 50 trades fechados.

### "Python not found"
**Solução:** Instale Python 3.8+:
```bash
# Ubuntu/Debian
sudo apt install python3 python3-pip

# Windows
# Baixe de python.org
```

### "Module not found: sklearn"
**Solução:** Instale dependências:
```bash
cd ml_engine
pip3 install -r requirements.txt
```

## Suporte

Para mais informações, consulte:
- `docs/ML_APRENDIZADO_COMPLETO.md`
- `docs/ML_FLUXO_VISUAL.md`
- `RESUMO_ML_APRENDIZADO.md`
