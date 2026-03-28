#!/usr/bin/env python3
import json
import os

data_file = 'ml_engine/data/historical_ml_data.jsonl'

if not os.path.exists(data_file):
    print(f"Arquivo não encontrado: {data_file}")
    exit(1)

wins = 0
losses = 0
total = 0

with open(data_file, 'r', encoding='utf-8') as f:
    for line in f:
        if line.strip():
            try:
                data = json.loads(line)
                total += 1
                label = data.get('outcome_label')
                if label == 1:
                    wins += 1
                elif label == 0:
                    losses += 1
            except:
                pass

print(f"Total de sinais: {total}")
print(f"Wins (TP): {wins}")
print(f"Losses (SL): {losses}")

if total > 0:
    win_rate = (wins / total) * 100
    print(f"Win Rate: {win_rate:.2f}%")
else:
    print("Nenhum dado encontrado.")
