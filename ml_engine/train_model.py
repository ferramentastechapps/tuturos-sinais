
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import sys
import onnx
import onnx.helper

# --- ONNX VERSION FIX (Monkeypatch para onnxmltools + onnx modernos) ---
if 'pkg_resources' not in sys.modules:
    import types
    try:
        from packaging.version import parse as parse_version
    except ImportError:
        parse_version = lambda x: x
    _pkg = types.ModuleType('pkg_resources')
    class MockDist:
        version = '1.15.0'
        parsed_version = parse_version('1.15.0')
    _pkg.get_distribution = lambda x: MockDist()
    _pkg.parse_version = parse_version
    sys.modules['pkg_resources'] = _pkg

if not hasattr(onnx, 'mapping'):
    onnx.mapping = getattr(onnx, '_mapping', None)
if not hasattr(onnx.helper, 'split_complex_to_pairs'):
    onnx.helper.split_complex_to_pairs = lambda x: ([], [])
# --------------------------------------------------------------------

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

    # 1.5 Filtro de Qualidade de Dados
    original_size = len(df)
    
    # Remover operações que empataram (ruído)
    df = df[~((df['pnl'] >= -0.1) & (df['pnl'] <= 0.1))]
    
    if 'confluence_count' in df.columns:
        df = df[df['confluence_count'] >= 3]
        
    if 'confidence' in df.columns:
        df = df[df['confidence'] >= 0.5]
        
    filtered_size = len(df)
    print(f"Filtrados {original_size - filtered_size} de {original_size} registros ({((original_size - filtered_size) / original_size * 100):.1f}%)")
    
    if len(df) < 20:
        print("Dados insuficientes após o filtro de qualidade.")
        return

    X = df[FEATURE_COLUMNS]
    y = df['label']
    
    # Pesos temporais (Sinais recentes importam mais)
    df['entry_time'] = pd.to_datetime(df['entry_time'], errors='coerce', utc=True)
    now = pd.Timestamp.utcnow()
    age_days = (now - df['entry_time']).dt.days
    
    sample_weights = np.where(age_days <= 7, 1.0, 
                     np.where(age_days <= 30, 0.6, 0.3))
    
    # Balanceamento de classes (SMOTE simplificado com scale_pos_weight)
    win_rate = y.mean()
    scale_pos_weight = 1.0
    if 0 < win_rate < 0.4:
        scale_pos_weight = (1 - win_rate) / win_rate
    print(f"Class balance: WIN={win_rate*100:.1f}%, LOSS={(1-win_rate)*100:.1f}%, scale_pos_weight={scale_pos_weight:.2f}")

    # Split
    X_train, X_test, y_train, y_test, w_train, w_test = train_test_split(
        X, y, sample_weights, test_size=0.2, random_state=42
    )
    
    print(f"Dataset size: {len(df)} samples")
    print(f"Training set: {len(X_train)} samples")
    print(f"Test set: {len(X_test)} samples")

    # 3. Train XGBoost
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        objective='binary:logistic',
        scale_pos_weight=scale_pos_weight,
        n_jobs=-1
    )
    
    model.fit(X_train.values, y_train.values, sample_weight=w_train)
    
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
    
    # 6. Treinar modelos específicos por símbolo (se houver coluna 'symbol')
    if 'symbol' in df.columns:
        print("\n=== Treinando modelos por símbolo ===")
        import os
        os.makedirs('ml_models', exist_ok=True)
        
        for symbol in df['symbol'].unique():
            symbol_df = df[df['symbol'] == symbol]
            if len(symbol_df) < 30:
                continue  # Pular símbolos com poucos dados
            
            X_sym = symbol_df[FEATURE_COLUMNS]
            y_sym = symbol_df['label']
            
            # Balanceamento e pesos para o símbolo
            w_sym = sample_weights[symbol_df.index]
            wr_sym = y_sym.mean()
            spw_sym = 1.0
            if 0 < wr_sym < 0.4:
                spw_sym = (1 - wr_sym) / wr_sym
            
            # Treinar modelo específico
            model_sym = xgb.XGBClassifier(
                n_estimators=100,
                max_depth=5,
                learning_rate=0.1,
                objective='binary:logistic',
                scale_pos_weight=spw_sym,
                n_jobs=-1
            )
            model_sym.fit(X_sym.values, y_sym.values, sample_weight=w_sym)
            
            # Validar accuracy
            y_pred_sym = model_sym.predict(X_sym.values)
            acc_sym = accuracy_score(y_sym, y_pred_sym)
            
            if acc_sym >= 0.55:
                # Salvar modelo específico
                symbol_dir = os.path.join('ml_models', symbol)
                os.makedirs(symbol_dir, exist_ok=True)
                
                initial_type_sym = [('float_input', FloatTensorType([None, len(FEATURE_COLUMNS)]))]
                onnx_model_sym = onnxmltools.convert_xgboost(
                    model_sym,
                    initial_types=initial_type_sym,
                    target_opset=12
                )
                onnx.save_model(onnx_model_sym, os.path.join(symbol_dir, 'model.onnx'))
                print(f"✅ {symbol}: accuracy={acc_sym:.3f}, samples={len(symbol_df)}")
            else:
                print(f"⚠️ {symbol}: accuracy={acc_sym:.3f} < 0.55 (rejeitado)")
        
    print("Training complete.")

if __name__ == "__main__":
    train()
