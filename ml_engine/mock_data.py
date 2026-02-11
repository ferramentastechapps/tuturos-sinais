import os
import random
import json
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("Error: Missing credentials")
    exit(1)

supabase: Client = create_client(url, key)

def generate_mock_data():
    print("Generating mock data...")
    
    # Fetch a valid user ID (required by foreign key)
    # Using Service Role Key allows admin access
    try:
        users = supabase.auth.admin.list_users()
        if not users:
            print("Error: No users found in auth.users. Cannot create mock data.")
            return
        # If users is a list, take the first item
        first_user = users[0]
        # Check if first_user has 'id' attribute or key
        if hasattr(first_user, 'id'):
            user_id = first_user.id
        elif isinstance(first_user, dict) and 'id' in first_user:
            user_id = first_user['id']
        else:
             # Fallback if structure is unexpected (maybe it's a User object)
             print(f"Unexpected user structure: {type(first_user)}")
             return
             
        print(f"Using User ID: {user_id}")
    except Exception as e:
        print(f"Error fetching users: {e}")
        return

    cols = [
        'rsi', 'adx', 'atr_rel', 'dist_ema20', 'dist_ema50', 'dist_ema200', 'dist_vwap',
        'volatility_24h', 'volume_rel', 'funding_rate', 'open_interest_var', 'long_short_ratio',
        'is_long', 'confidence', 'quality_score', 'confluence_count', 'stop_loss_pct', 
        'take_profit_pct', 'risk_reward', 'hour_of_day', 'day_of_week', 
        'btc_trend', 'dominance_btc', 'fear_greed'
    ]
    
    rows = []
    for i in range(20):
        features = {col: random.random() for col in cols}
        # Fake logic: if rsi > 0.5, label = 1
        label = 1 if features['rsi'] > 0.5 else 0
        pnl = random.uniform(-10, 20)
        
        row = {
            "user_id": user_id,
            "signal_id": f"mock_signal_{i}",
            "symbol": "BTCUSDT" if i % 2 == 0 else "ETHUSDT",
            # ... rest of fields
            "entry_time": "2024-01-01T12:00:00Z",
            "features": json.dumps(features),
            "outcome_label": label,
            "outcome_pnl": pnl
        }
        rows.append(row)
        
    try:
        response = supabase.table("ml_training_data").insert(rows).execute()
        print(f"Inserted {len(rows)} mock rows.")
    except Exception as e:
        print(f"Error inserting mock data: {e}")

if __name__ == "__main__":
    generate_mock_data()
