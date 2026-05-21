#!/usr/bin/env python3
"""
retrain_model.py — Retrains the trading bot's ML model using accumulated trade outcomes.

Usage:
    python retrain_model.py [--min-samples N] [--output path/to/model.onnx]

Environment variables required:
    SUPABASE_URL   — Your Supabase project URL
    SUPABASE_KEY   — Your Supabase service role key (or anon key with read access)

Output:
    Saves a new current_model.onnx in the backend/ directory (or --output path).
    Prints a full evaluation report to stdout.
"""

import os
import sys
import json
import argparse
import warnings
from datetime import datetime
from pathlib import Path

warnings.filterwarnings('ignore')

# ── Imports (with friendly error if not installed) ────────────────────────────
MISSING = []
try:
    import numpy as np
except ImportError:
    MISSING.append("numpy")
try:
    import pandas as pd
except ImportError:
    MISSING.append("pandas")
try:
    from supabase import create_client
except ImportError:
    MISSING.append("supabase")
try:
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
    from sklearn.model_selection import train_test_split, cross_val_score
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import Pipeline
    from sklearn.metrics import (
        classification_report, accuracy_score,
        precision_score, recall_score, f1_score, roc_auc_score
    )
except ImportError:
    MISSING.append("scikit-learn")
try:
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType
except ImportError:
    MISSING.append("skl2onnx")

if MISSING:
    print(f"\n❌ Missing dependencies: {', '.join(MISSING)}")
    print("\nInstall with:")
    print(f"  pip install {' '.join(MISSING)}\n")
    sys.exit(1)

# ── Feature columns (must match signalEngine.ts FEATURE_COLUMNS) ───────────
FEATURE_COLUMNS = [
    'rsi', 'adx', 'atr_rel', 'dist_ema20', 'dist_ema50', 'dist_ema200', 'dist_vwap',
    'volatility_24h', 'volume_rel', 'funding_rate', 'open_interest_var', 'long_short_ratio',
    'is_long', 'confidence', 'quality_score', 'confluence_count', 'stop_loss_pct',
    'take_profit_pct', 'risk_reward', 'hour_of_day', 'day_of_week',
    'btc_trend', 'dominance_btc', 'fear_greed',
]

# ── Helpers ───────────────────────────────────────────────────────────────────
def load_env_from_file(env_path: str):
    """Load .env file into os.environ (fallback if python-dotenv not installed)."""
    if not os.path.exists(env_path):
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, value = line.partition('=')
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

def fetch_training_data(supabase_url: str, supabase_key: str) -> pd.DataFrame:
    """Fetch all records from ml_training_data table."""
    client = create_client(supabase_url, supabase_key)

    print("📡 Fetching training data from Supabase...")
    response = client.table('ml_training_data').select('*').execute()

    if not response.data:
        raise ValueError("No training data found in ml_training_data table.")

    rows = response.data
    print(f"   ✅ Loaded {len(rows)} records")
    return pd.DataFrame(rows)

def build_feature_matrix(df: pd.DataFrame) -> tuple:
    """Extract feature matrix X and label vector y from raw training data."""
    records = []

    for _, row in df.iterrows():
        feats = row.get('features', {})
        if isinstance(feats, str):
            try:
                feats = json.loads(feats)
            except Exception:
                feats = {}

        if not isinstance(feats, dict):
            feats = {}

        vec = [float(feats.get(col, 0) or 0) for col in FEATURE_COLUMNS]
        records.append(vec)

    X = np.array(records, dtype=np.float32)
    y = np.array(df['outcome_label'].astype(int).tolist(), dtype=np.int64)
    return X, y

def validate_dataset(X: np.ndarray, y: np.ndarray, min_samples: int):
    """Ensure the dataset has enough data and class balance."""
    n = len(y)
    wins = int(y.sum())
    losses = n - wins
    win_ratio = wins / n if n > 0 else 0

    print(f"\n📊 Dataset Summary:")
    print(f"   Total samples : {n}")
    print(f"   Wins (label=1): {wins} ({win_ratio*100:.1f}%)")
    print(f"   Losses(label=0): {losses} ({(1-win_ratio)*100:.1f}%)")

    if n < min_samples:
        raise ValueError(
            f"Not enough data: {n} samples < minimum {min_samples}. "
            f"Keep running the bot until more trades close."
        )

    if win_ratio < 0.05 or win_ratio > 0.95:
        raise ValueError(
            f"Extreme class imbalance: {win_ratio*100:.1f}% wins. "
            f"Need at least 5% of each class to train effectively."
        )

def train_model(X: np.ndarray, y: np.ndarray) -> tuple:
    """Train a pipeline with scaler + Random Forest, then evaluate it."""
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('clf', RandomForestClassifier(
            n_estimators=200,
            max_depth=8,
            min_samples_leaf=5,
            class_weight='balanced',
            random_state=42,
            n_jobs=-1,
        ))
    ])

    print("\n🏋️  Training RandomForest model...")
    pipeline.fit(X_train, y_train)

    # ── Evaluation ─────────────────────────────────────────────────────────
    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    acc       = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall    = recall_score(y_test, y_pred, zero_division=0)
    f1        = f1_score(y_test, y_pred, zero_division=0)
    auc       = roc_auc_score(y_test, y_proba) if len(set(y_test)) > 1 else 0.5

    print(f"\n📈 Evaluation on Test Set ({len(y_test)} samples):")
    print(f"   Accuracy  : {acc*100:.2f}%")
    print(f"   Precision : {precision*100:.2f}%")
    print(f"   Recall    : {recall*100:.2f}%")
    print(f"   F1 Score  : {f1*100:.2f}%")
    print(f"   AUC-ROC   : {auc:.4f}")
    print()
    print(classification_report(y_test, y_pred, target_names=['Loss', 'Win']))

    # ── Feature Importance ─────────────────────────────────────────────────
    clf = pipeline.named_steps['clf']
    importances = clf.feature_importances_
    feat_importance = sorted(
        zip(FEATURE_COLUMNS, importances), key=lambda x: x[1], reverse=True
    )

    print("🔍 Top 10 Most Important Features:")
    for feat, imp in feat_importance[:10]:
        bar = '█' * int(imp * 50)
        print(f"   {feat:<25} {bar} {imp:.4f}")

    # Cross-validation for robustness check
    cv_scores = cross_val_score(pipeline, X, y, cv=5, scoring='roc_auc')
    print(f"\n🔄 5-Fold Cross-Validation AUC: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    return pipeline, {
        'accuracy': acc,
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'auc': auc,
        'cv_auc_mean': float(cv_scores.mean()),
    }

def export_to_onnx(pipeline, output_path: str, n_features: int):
    """Convert scikit-learn pipeline to ONNX format."""
    initial_type = [('float_input', FloatTensorType([None, n_features]))]

    onnx_model = convert_sklearn(
        pipeline,
        initial_types=initial_type,
        options={type(pipeline.named_steps['clf']): {'zipmap': False}},
        target_opset=17,
    )

    with open(output_path, 'wb') as f:
        f.write(onnx_model.SerializeToString())

    size_kb = os.path.getsize(output_path) / 1024
    print(f"\n✅ ONNX model saved to: {output_path} ({size_kb:.1f} KB)")

def save_report(metrics: dict, output_dir: str, n_samples: int):
    """Save a JSON report alongside the model for traceability."""
    report = {
        'trained_at': datetime.utcnow().isoformat() + 'Z',
        'n_training_samples': n_samples,
        'n_features': len(FEATURE_COLUMNS),
        'features': FEATURE_COLUMNS,
        'model': 'RandomForestClassifier (n_estimators=200, max_depth=8)',
        'metrics': metrics,
    }
    report_path = os.path.join(output_dir, 'model_report.json')
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"📄 Report saved to: {report_path}")

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='Retrain the trading bot ML model.')
    parser.add_argument('--min-samples', type=int, default=50,
                        help='Minimum number of training samples required (default: 50)')
    parser.add_argument('--output', type=str, default=None,
                        help='Output path for .onnx file (default: backend/current_model.onnx)')
    args = parser.parse_args()

    print("=" * 60)
    print("  🤖 Tuturos Sinais — ML Model Retrainer")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # ── Locate backend directory ────────────────────────────────────────────
    script_dir = Path(__file__).parent
    backend_dir = script_dir.parent  # backend/scripts/ -> backend/

    # ── Load environment variables ──────────────────────────────────────────
    for env_file in ['.env.production', '.env', '.env.local']:
        load_env_from_file(str(backend_dir / env_file))

    # Support python-dotenv if available
    try:
        from dotenv import load_dotenv
        load_dotenv(backend_dir / '.env.production', override=False)
        load_dotenv(backend_dir / '.env', override=False)
    except ImportError:
        pass

    supabase_url = os.environ.get('SUPABASE_URL') or os.environ.get('VITE_SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_KEY') or os.environ.get('VITE_SUPABASE_ANON_KEY')

    if not supabase_url or not supabase_key:
        print("\n❌ Missing environment variables: SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_KEY)")
        print("   Set them in backend/.env.production or export them before running this script.")
        sys.exit(1)

    # ── Output path ─────────────────────────────────────────────────────────
    output_path = args.output or str(backend_dir / 'current_model.onnx')
    output_dir = str(Path(output_path).parent)

    try:
        # 1. Fetch data
        df = fetch_training_data(supabase_url, supabase_key)

        # 2. Build feature matrix
        X, y = build_feature_matrix(df)

        # 3. Validate
        validate_dataset(X, y, args.min_samples)

        # 4. Train
        pipeline, metrics = train_model(X, y)

        # 5. Export to ONNX
        export_to_onnx(pipeline, output_path, len(FEATURE_COLUMNS))

        # 6. Save report
        save_report(metrics, output_dir, len(y))

        print("\n🚀 Done! Restart the backend to load the new model:")
        print("   pm2 restart tuturos-backend\n")

    except ValueError as e:
        print(f"\n⚠️  Validation error: {e}\n")
        sys.exit(2)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}\n")
        raise

if __name__ == '__main__':
    main()
