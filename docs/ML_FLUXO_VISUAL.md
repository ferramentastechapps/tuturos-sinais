# Fluxo Visual do Sistema de ML

## Arquitetura Unificada

```
┌─────────────────────────────────────────────────────────────────┐
│                    SISTEMA DE MACHINE LEARNING                   │
│                         (UNIFICADO)                              │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│   ROBÔ PRINCIPAL     │         │   ROBÔ SCALPING      │
│   (Timeframe: 1H)    │         │   (Timeframe: 5M)    │
└──────────┬───────────┘         └──────────┬───────────┘
           │                                 │
           │ Gera Sinal                      │ Gera Sinal
           │ + 25 Features                   │ + 25 Features
           │                                 │
           ▼                                 ▼
    ┌──────────────────────────────────────────────┐
    │         tradeSignal (Database)               │
    │  - id: "BTCUSDT-123"                        │
    │  - trade_type: "Day Trade"                  │
    │  - ml_data: { rsi, adx, ema... }           │
    └──────────────────┬───────────────────────────┘
                       │
                       │ Trade Fecha (TP/SL)
                       │
                       ▼
    ┌──────────────────────────────────────────────┐
    │      tradeTracker.submitFeedbackToML()       │
    │  - Busca features originais                  │
    │  - Calcula outcome (WIN/LOSS)                │
    │  - Calcula PnL                               │
    └──────────────────┬───────────────────────────┘
                       │
                       │ Salva Resultado
                       │
                       ▼
    ┌──────────────────────────────────────────────┐
    │      ml_training_data (Database)             │
    │  ┌────────────────────────────────────────┐  │
    │  │ signal_id: "BTCUSDT-123"              │  │
    │  │ outcome_label: 1 (WIN)                │  │
    │  │ outcome_pnl: 2.5%                     │  │
    │  │ features: { rsi: 45, adx: 32... }     │  │
    │  └────────────────────────────────────────┘  │
    │  ┌────────────────────────────────────────┐  │
    │  │ signal_id: "SCALP-ETHUSDT-456"        │  │
    │  │ outcome_label: 0 (LOSS)               │  │
    │  │ outcome_pnl: -1.2%                    │  │
    │  │ features: { rsi: 72, adx: 28... }     │  │
    │  └────────────────────────────────────────┘  │
    │                    ...                        │
    └──────────────────┬───────────────────────────┘
                       │
                       │ 23:55 UTC (Diariamente)
                       │
                       ▼
    ┌──────────────────────────────────────────────┐
    │         mlRetrainJob (Cron)                  │
    │  1. Busca TODOS os dados                     │
    │  2. python3 train_model.py                   │
    │  3. Valida acurácia                          │
    │  4. Substitui se melhorar                    │
    └──────────────────┬───────────────────────────┘
                       │
                       │ Novo Modelo
                       │
                       ▼
    ┌──────────────────────────────────────────────┐
    │      current_model.onnx (Atualizado)         │
    │  - Accuracy: 68% → 72% ✅                    │
    │  - Precision: 0.75                           │
    │  - Recall: 0.70                              │
    └──────────────────┬───────────────────────────┘
                       │
                       │ Hot Reload
                       │
           ┌───────────┴───────────┐
           │                       │
           ▼                       ▼
    ┌─────────────┐         ┌─────────────┐
    │   ROBÔ      │         │   ROBÔ      │
    │ PRINCIPAL   │         │  SCALPING   │
    │             │         │             │
    │ Filtra      │         │ Filtra      │
    │ prob < 65%  │         │ prob < 60%  │
    └─────────────┘         └─────────────┘
```

## Timeline de um Dia Típico

```
00:00 UTC ─────────────────────────────────────────────────────
│ 🌅 Novo dia começa com modelo atualizado
│
├─ 02:15 UTC
│  ├─ Principal: BTCUSDT LONG gerado (score 85)
│  └─ Scalping: ETHUSDT SHORT gerado (score 78)
│
├─ 05:30 UTC
│  └─ ETHUSDT atinge SL → Feedback: LOSS
│
├─ 08:45 UTC
│  ├─ Scalping: SOLUSDT LONG gerado (score 82)
│  └─ Principal: ADAUSDT SHORT gerado (score 88)
│
├─ 12:20 UTC
│  └─ BTCUSDT atinge TP1 → Feedback: WIN
│
├─ 15:00 UTC
│  └─ SOLUSDT atinge TP2 → Feedback: WIN
│
├─ 18:30 UTC
│  ├─ Scalping: BNBUSDT SHORT gerado (score 75)
│  └─ ADAUSDT atinge TP1 → Feedback: WIN
│
├─ 21:45 UTC
│  └─ BNBUSDT atinge SL → Feedback: LOSS
│
23:55 UTC ─────────────────────────────────────────────────────
│ 🎓 JOB DE RETREINAMENTO EXECUTA
│
│ 1. Busca dados:
│    - 6 trades fechados hoje
│    - 4 WINS (67% win rate)
│    - 2 LOSSES (33% loss rate)
│    - Total acumulado: 523 trades
│
│ 2. Treina novo modelo:
│    - Random Forest (200 árvores)
│    - 80% treino / 20% teste
│    - Cross-validation 5-fold
│
│ 3. Valida:
│    - Accuracy: 71% (antes: 68%) ✅
│    - Precision: 0.76 (antes: 0.73) ✅
│    - Recall: 0.69 (antes: 0.67) ✅
│
│ 4. Substitui modelo:
│    - current_model.onnx atualizado
│    - Backend recarrega (hot reload)
│
23:59 UTC ─────────────────────────────────────────────────────
│ ✅ Modelo novo em produção
│
00:00 UTC (Próximo Dia) ───────────────────────────────────────
│ 🚀 Robôs usam modelo melhorado
│ 📈 Expectativa: mais sinais de qualidade
└───────────────────────────────────────────────────────────────
```

## Dados Compartilhados

```
┌─────────────────────────────────────────────────────────┐
│              ml_training_data (Exemplo)                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ID: 1                                                  │
│  Signal: BTCUSDT-1234567890                            │
│  Type: Day Trade (Principal)                           │
│  Outcome: WIN (1)                                      │
│  PnL: +2.5%                                            │
│  Features: { rsi: 45, adx: 32, ema20: 0.02... }       │
│                                                         │
│  ID: 2                                                  │
│  Signal: SCALP-ETHUSDT-1234567891                      │
│  Type: Scalping                                        │
│  Outcome: LOSS (0)                                     │
│  PnL: -1.2%                                            │
│  Features: { rsi: 72, adx: 28, ema20: -0.01... }      │
│                                                         │
│  ID: 3                                                  │
│  Signal: SOLUSDT-1234567892                            │
│  Type: Swing Trade (Principal)                         │
│  Outcome: WIN (1)                                      │
│  PnL: +4.8%                                            │
│  Features: { rsi: 38, adx: 45, ema20: 0.05... }       │
│                                                         │
│  ID: 4                                                  │
│  Signal: SCALP-BNBUSDT-1234567893                      │
│  Type: Scalping                                        │
│  Outcome: LOSS (0)                                     │
│  PnL: -0.8%                                            │
│  Features: { rsi: 68, adx: 22, ema20: -0.02... }      │
│                                                         │
│  ... (519 mais registros)                              │
│                                                         │
│  TOTAL: 523 trades                                     │
│  WINS: 356 (68%)                                       │
│  LOSSES: 167 (32%)                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Treina com TODOS
                         │
                         ▼
              ┌──────────────────┐
              │  Modelo Único    │
              │  Random Forest   │
              │  200 árvores     │
              └──────────────────┘
```

## Conclusão Visual

🔄 **CICLO CONTÍNUO:**
1. Robôs geram sinais (Principal + Scalping)
2. Trades fecham → Feedback automático
3. Dados acumulam em ml_training_data
4. 23:55 UTC → Retreinamento automático
5. Modelo melhora → Robôs ficam mais precisos
6. Volta ao passo 1

📊 **DADOS UNIFICADOS:**
- Mesma tabela (ml_training_data)
- Mesmas features (25 indicadores)
- Mesmo modelo (current_model.onnx)
- Mesmo job (mlRetrainJob)

🎯 **RESULTADO:**
- Aprendizado mais rápido (mais dados)
- Modelo mais robusto (múltiplos timeframes)
- Manutenção simplificada (sistema único)
