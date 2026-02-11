
import os
import json
import base64
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key or "YOUR_SERVICE" in key:
    print("Error: Missing credentials in .env")
    exit(1)

supabase: Client = create_client(url, key)

def upload_model():
    print("Uploading model to Supabase...")
    
    # 1. Read ONNX Model
    try:
        with open("current_model.onnx", "rb") as f:
            model_bytes = f.read()
            model_base64 = base64.b64encode(model_bytes).decode('utf-8')
    except FileNotFoundError:
        print("Error: 'current_model.onnx' not found. Run train_model.py first.")
        return

    # 2. Read Metrics
    try:
        with open("model_metrics.json", "r") as f:
            metrics = json.load(f)
    except FileNotFoundError:
        print("Warning: Metrics file not found, using empty metrics.")
        metrics = {}
        
    # Fetch a valid user ID (required)
    try:
        users = supabase.auth.admin.list_users()
        if not users:
            print("Error: No users found.")
            return
        # If users is a list, take the first item
        first_user = users[0]
        # Check if first_user has 'id' attribute or key
        if hasattr(first_user, 'id'):
            user_id = first_user.id
        elif isinstance(first_user, dict) and 'id' in first_user:
            user_id = first_user['id']
        else:
             print(f"Unexpected user structure: {type(first_user)}")
             return
    except Exception as e:
        print(f"Error fetching users: {e}")
        return

    # 3. Prepare Payload
    payload = {
        "user_id": user_id,
        "version": "v1_xgboost", # TODO: dynamic versioning
        "type": "xgboost_onnx",
        "data": { "format": "base64", "content": model_base64 },
        "metrics": metrics,
        "is_active": True
    }
    
    # 4. Insert into Supabase
    try:
        # First de-activate old models (optional, but good practice)
        # supabase.table("ml_models").update({"is_active": False}).eq("is_active", True).execute()
        
        response = supabase.table("ml_models").insert(payload).execute()
        if response.data:
            print(f"Model uploaded successfully! ID: {response.data[0]['id']}")
        else:
            print("Model uploaded but no data returned.")
        
    except Exception as e:
        print(f"Upload failed: {e}")

if __name__ == "__main__":
    upload_model()
