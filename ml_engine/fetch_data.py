
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
    print("Fetching training data from Supabase...")
    
    # Fetch all data (handling pagination if needed, but for now 1000 is limit)
    # Supabase-py default limit is often 1000.
    response = supabase.table("ml_training_data").select("*").limit(10000).execute()
    
    data = response.data
    
    if not data:
        print("Warning: No data found in 'ml_training_data'.")
        print("Possible reasons:")
        print("1. Table is empty (Run 'Collect Dataset' in UI).")
        print("2. RLS is blocking access (Check if using Service Role Key).")
        return pd.DataFrame()
        
    print(f"Retrieved {len(data)} samples.")
    
    # Flatten JSON features
    structured_data = []
    
    for row in data:
        features = row.get('features', {})
        if isinstance(features, str):
            features = json.loads(features)
            
        # Create a flat dictionary
        sample = {
            'signal_id': row.get('signal_id'),
            'symbol': row.get('symbol'),
            'label': row.get('outcome_label'),
            'pnl': row.get('outcome_pnl'),
            'entry_time': row.get('entry_time'),
            **features # Unpack features as columns
        }
        structured_data.append(sample)
        
    df = pd.DataFrame(structured_data)
    
    # Drop non-numeric columns that won't be used for training directly if needed
    # But keeping them for reference is good.
    
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
