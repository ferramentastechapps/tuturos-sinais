
import os
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv
import json

# Load environment variables
# Load environment variables from the same directory as this script
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key or "YOUR_SERVICE" in key:
    print("Error: Missing SUPABASE_URL or SUPABASE_KEY in .env")
    print("Please add your Service Role Key to ml_engine/.env")
    exit(1)

supabase: Client = create_client(url, key)

def fetch_training_data():
    print("Buscando dados no arquivo local (historical_ml_data.jsonl)...")
    
    data_file = os.path.join(os.path.dirname(__file__), 'data', 'historical_ml_data.jsonl')
    
    if not os.path.exists(data_file):
        print("❌ Erro no Treinamento Semanal")
        print(f"Arquivo não encontrado: {data_file}")
        return pd.DataFrame()
        
    data = []
    with open(data_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                data.append(json.loads(line))
    
    if not data:
        print("❌ Erro no Treinamento Semanal")
        print("Nenhum dado encontrado no arquivo local.")
        return pd.DataFrame()
        
    print(f"Retrieved {len(data)} samples.")
    
    # Process features and labels
    structured_data = []
    
    for row in data:
        if 'outcome_label' in row:
            # Novo formato (tradeTracker append direto da VPS)
            label = row['outcome_label']
            features = row.get('features', {})
            if isinstance(features, str):
                features = json.loads(features)
            
            sample = {
                'signal_id': row.get('signal_id'),
                'symbol': row.get('symbol'),
                'label': label,
                'pnl': row.get('outcome_pnl'),
                'entry_time': row.get('entry_time'),
                **features
            }
        else:
            # Formato antigo exportado da tabela trade_signals
            if row.get('status') not in ['hit_tp', 'hit_sl']:
                continue  # ignorar pendentes/cancelados no set histórico

            ml_data = row.get('ml_data') or {}
            if isinstance(ml_data, str):
                ml_data = json.loads(ml_data)
                
            features = ml_data.get('features', {})
            if not features and 'rsi' in ml_data:
                features = ml_data
                
            label = 1 if row.get('status') == 'hit_tp' else 0
                
            sample = {
                'signal_id': row.get('id'),
                'symbol': row.get('pair'),
                'label': label,
                'pnl': row.get('take_profit') if label == 1 else row.get('stop_loss'),
                'entry_time': row.get('created_at'),
                **features
            }
            
        structured_data.append(sample)
        
    df = pd.DataFrame(structured_data)
    
    return df

if __name__ == "__main__":
    df = fetch_training_data()
    if not df.empty:
        print("Data Preview:")
        print(df.head())
        print("\nMissing Values:")
        print(df.isnull().sum().sum())
        
        # Save to CSV for inspection
        df.to_csv("training_data_dump.csv", index=False)
        print("Saved to training_data_dump.csv")
