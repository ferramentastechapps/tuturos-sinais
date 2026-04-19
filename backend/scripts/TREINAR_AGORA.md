# 🤖 Treinar o Super Robô Agora

## Comando único na VPS

```bash
cd /var/www/signal-dashboard
chmod +x backend/scripts/train_super_robot.sh
bash backend/scripts/train_super_robot.sh
```

## O que o script faz

1. **Cria venv Python** e instala dependências automaticamente
2. **Migra dados históricos** de 3 fontes:
   - `trade_signals` do Supabase (todos os CLOSED_TP / CLOSED_SL)
   - `MLTrainingData` do SQLite local (Prisma)
   - `ml_engine/data/historical_ml_data.jsonl` (arquivo local)
3. **Treina RandomForest** com os dados consolidados → exporta `current_model.onnx`
4. **Reinicia o PM2** para carregar o novo modelo

## Flags opcionais

```bash
# Ver quantos dados existem sem treinar
bash backend/scripts/train_super_robot.sh --dry-run

# Pular migração (se ml_training_data já está populado no Supabase)
bash backend/scripts/train_super_robot.sh --skip-migrate

# Exigir mínimo de 50 amostras (default: 30)
bash backend/scripts/train_super_robot.sh --min-samples=50
```

## Só migrar (sem treinar)

```bash
cd /var/www/signal-dashboard/backend
.venv_ml/bin/python scripts/migrate_historical_to_training.py --dry-run  # ver o que seria migrado
.venv_ml/bin/python scripts/migrate_historical_to_training.py             # migrar de verdade
```

## Só treinar (dados já migrados)

```bash
cd /var/www/signal-dashboard/backend
.venv_ml/bin/python scripts/retrain_model.py --min-samples 30
pm2 restart tuturos-backend
```

## Retreinamento automático (semanal)

O `auto_retrain.sh` já está configurado para rodar toda semana.
Para ativar, adicione ao crontab:

```bash
crontab -e
# Adicionar:
0 3 * * 0 /var/www/signal-dashboard/backend/scripts/auto_retrain.sh >> /var/www/signal-dashboard/backend/logs/retrain.log 2>&1
```
