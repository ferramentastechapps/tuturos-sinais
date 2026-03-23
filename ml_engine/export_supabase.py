import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key or "YOUR_SERVICE" in key:
    print("Error: Missing SUPABASE_URL or SUPABASE_KEY in .env")
    exit(1)

supabase: Client = create_client(url, key)

def export_data():
    print("Exportando dados históricos do Supabase...")
    
    # Busca da tabela ml_training_data
    response = supabase.table("ml_training_data").select("*").limit(10000).execute()
    data = response.data
    
    if not data:
        print("Nenhum dado encontrado na tabela ml_training_data.")
        return
        
    print(f"Foram encontrados {len(data)} registros hist\u00f3ricos.")
    
    # Criar pasta data se n\u00e3o existir
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    out_file = os.path.join(data_dir, 'historical_ml_data.jsonl')
    
    count = 0
    with open(out_file, 'w', encoding='utf-8') as f:
        for row in data:
            # Manter a estrutura compat\u00edvel com o JSONL que o bot gerar\u00e1
            json_line = json.dumps(row)
            f.write(json_line + '\n')
            count += 1
            
    print(f"Exporta\u00e7\u00e3o conclu\u00edda! Salvo em: {out_file}")

if __name__ == "__main__":
    export_data()
