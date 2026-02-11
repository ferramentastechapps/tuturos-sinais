
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import onnx
import onnxmltools
from onnxmltools.convert.common.data_types import FloatTensorType
from fetch_data import fetch_training_data
import json

# Define the exact feature list order (MUST MATCH featureExtractor.ts)
FEATURE_COLUMNS = [
    'rsi', 'adx', 'atr_rel', 'dist_ema20', 'dist_ema50', 'dist_ema200', 'dist_vwap',
    'volatility_24h', 'volume_rel', 'funding_rate', 'open_interest_var', 'long_short_ratio',
    'is_long', 'confidence', 'quality_score', 'confluence_count', 'stop_loss_pct', 
    'take_profit_pct', 'risk_reward', 'hour_of_day', 'day_of_week', 
    'btc_trend', 'dominance_btc', 'fear_greed'
]

def train():
    print("Starting training pipeline...")
    
    # 1. Fetch Data
    df = fetch_training_data()
    if df.empty:
        print("No data available for training.")
        return

    X = df[FEATURE_COLUMNS]
    y = df['label']
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print(f"Dataset size: {len(df)} samples")
    print(f"Training set: {len(X_train)} samples")
    print(f"Test set: {len(X_test)} samples")

    # 3. Train XGBoost
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        objective='binary:logistic',
        n_jobs=-1
    )
    
    model.fit(X_train.values, y_train.values)
    
    # 4. Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    
    metrics = {
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1Score": float(f1),
        "sampleSize": len(df)
    }
    print(json.dumps(metrics, indent=2))
    
    # 5. Export to ONNX
    # We need to specify input types for ONNX conversion
    initial_type = [('float_input', FloatTensorType([None, len(FEATURE_COLUMNS)]))]
    
    # Convert using onnxmltools (supports XGBoost)
    onnx_model = onnxmltools.convert_xgboost(
        model, 
        initial_types=initial_type, 
        target_opset=12
    )
    
    # Save ONNX
    onnx.save_model(onnx_model, "current_model.onnx")
    print("\nSaved model to 'current_model.onnx'")
    
    # Save metrics for upload_model.py to use
    with open("model_metrics.json", "w") as f:
        json.dump(metrics, f)
        
    print("Training complete.")

if __name__ == "__main__":
    train()
