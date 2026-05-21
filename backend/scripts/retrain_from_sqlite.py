#!/usr/bin/env python3
"""
retrain_from_sqlite.py — Treina o modelo ML lendo MLTrainingData do SQLite local.

Usage:
    python retrain_from_sqlite.py [--min-samples N] [--output path/to/model.onnx] [--db path/to/trading.db]
"""

import os
import sys
import json
import sqlite3
import argparse
import warnings
from datetime import datetime
from pathlib import Path

warnings.filterwarnings('ignore')

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
    from sklearn.ensemble import RandomForestClassifier
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
    print(f"\n❌ Missing: {', '.join(MISSING)}")
    print(f"   pip install {' '.join(MISSING)}\n")
    sys.exit(1)

FEATURE_COLUMNS = [
    'rsi', 'adx', 'atr_rel', 'dist_ema20', 'dist_ema50', 'dist_ema200', 'dist_vwap',
    'volatility_24h', 'volume_rel', 'funding_rate', 'open_interest_var', 'long_short_ratio',
    'is_long', 'confidence', 'quality_score', 'confluence_count', 'stop_loss_pct',
    'take_profit_pct', 'risk_reward', 'hour_of_day', 'day_of_week',
    'btc_trend', 'dominance_btc', 'fear_greed',
]


def find_db(script_dir: Path) -> Path:
    candidates = [
        script_dir.parent / 'prisma' / 'data' / 'trading.db',
        script_dir.parent / 'prisma' / 'dev.db',
        script_dir.parent / 'data' / 'trading.db',
    ]
    for p in candidates:
        if p.exists() and p.stat().st_size > 0:
            return p
    return None


def fetch_from_sqlite(db_path: str) -> pd.DataFrame:
    print(f"📂 Lendo MLTrainingData de: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM MLTrainingData")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    print(f"   ✅ {len(rows)} registros carregados")
    return pd.DataFrame(rows)


def build_feature_matrix(df: pd.DataFrame):
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


def validate(X, y, min_samples):
    n, wins = len(y), int(y.sum())
    losses = n - wins
    wr = wins / n if n > 0 else 0
    print(f"\n📊 Dataset:")
    print(f"   Total   : {n}")
    print(f"   Wins    : {wins} ({wr*100:.1f}%)")
    print(f"   Losses  : {losses} ({(1-wr)*100:.1f}%)")
    if n < min_samples:
        raise ValueError(f"Poucos dados: {n} < {min_samples}")
    if wr < 0.05 or wr > 0.95:
        raise ValueError(f"Desequilíbrio extremo: {wr*100:.1f}% wins")


def train(X, y):
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('clf', RandomForestClassifier(
            n_estimators=200, max_depth=8, min_samples_leaf=5,
            class_weight='balanced', random_state=42, n_jobs=-1,
        ))
    ])
    print("\n🏋️  Treinando RandomForest...")
    pipeline.fit(X_train, y_train)

    y_pred  = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    acc  = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec  = recall_score(y_test, y_pred, zero_division=0)
    f1   = f1_score(y_test, y_pred, zero_division=0)
    auc  = roc_auc_score(y_test, y_proba) if len(set(y_test)) > 1 else 0.5

    print(f"\n📈 Resultado no teste ({len(y_test)} amostras):")
    print(f"   Accuracy  : {acc*100:.2f}%")
    print(f"   Precision : {prec*100:.2f}%")
    print(f"   Recall    : {rec*100:.2f}%")
    print(f"   F1        : {f1*100:.2f}%")
    print(f"   AUC-ROC   : {auc:.4f}")
    print()
    print(classification_report(y_test, y_pred, target_names=['Loss', 'Win']))

    clf = pipeline.named_steps['clf']
    feat_imp = sorted(zip(FEATURE_COLUMNS, clf.feature_importances_), key=lambda x: x[1], reverse=True)
    print("🔍 Top 10 features mais importantes:")
    for feat, imp in feat_imp[:10]:
        print(f"   {feat:<25} {'█'*int(imp*50)} {imp:.4f}")

    cv = cross_val_score(pipeline, X, y, cv=5, scoring='roc_auc')
    print(f"\n🔄 Cross-validation AUC: {cv.mean():.4f} ± {cv.std():.4f}")

    return pipeline, {'accuracy': acc, 'precision': prec, 'recall': rec, 'f1': f1, 'auc': auc}


def export_onnx(pipeline, output_path, n_features):
    initial_type = [('float_input', FloatTensorType([None, n_features]))]
    onnx_model = convert_sklearn(
        pipeline, initial_types=initial_type,
        options={type(pipeline.named_steps['clf']): {'zipmap': False}},
        target_opset=17,
    )
    with open(output_path, 'wb') as f:
        f.write(onnx_model.SerializeToString())
    size_kb = os.path.getsize(output_path) / 1024
    print(f"\n✅ Modelo salvo: {output_path} ({size_kb:.1f} KB)")


def save_report(metrics, output_dir, n_samples):
    report = {
        'trained_at': datetime.utcnow().isoformat() + 'Z',
        'source': 'sqlite_local',
        'n_training_samples': n_samples,
        'n_features': len(FEATURE_COLUMNS),
        'features': FEATURE_COLUMNS,
        'metrics': metrics,
    }
    path = os.path.join(output_dir, 'model_report.json')
    with open(path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"📄 Relatório: {path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--min-samples', type=int, default=30)
    parser.add_argument('--output', type=str, default=None)
    parser.add_argument('--db', type=str, default=None)
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    backend_dir = script_dir.parent

    print("=" * 60)
    print("  🤖 Treinamento ML — SQLite Local")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    db_path = args.db or str(find_db(script_dir))
    if not db_path or not Path(db_path).exists():
        print(f"❌ Banco SQLite não encontrado.")
        sys.exit(1)

    output_path = args.output or str(backend_dir / 'current_model.onnx')

    try:
        df = fetch_from_sqlite(db_path)
        
        # 1. Treinar Modelo Global
        print("\n=== 🌍 TREINANDO MODELO GLOBAL FALLBACK ===")
        X, y = build_feature_matrix(df)
        validate(X, y, args.min_samples)
        pipeline, metrics = train(X, y)
        export_onnx(pipeline, output_path, len(FEATURE_COLUMNS))
        save_report(metrics, str(Path(output_path).parent), len(y))
        
        # 2. Treinar Modelos por Criptomoeda (Isolados)
        print("\n=== 🎯 TREINANDO MODELOS ISOLADOS POR MOEDA ===")
        
        # Garantir coluna symbol existe no DataFrame
        if 'symbol' not in df.columns:
            print("⚠️ Coluna 'symbol' não encontrada no banco. Modelos individuais por moeda pulados.")
        else:
            unique_symbols = df['symbol'].unique()
            trained_symbols = []
            
            # Pasta de modelos por moeda
            ml_models_dir = backend_dir / 'ml_models'
            ml_models_dir.mkdir(parents=True, exist_ok=True)
            
            for sym in unique_symbols:
                sym_df = df[df['symbol'] == sym]
                if len(sym_df) < 20: # Limiar de 20 trades
                    print(f"   ⚠️ {sym}: {len(sym_df)} trades (< 20). Ignorando, usará modelo global.")
                    continue
                    
                print(f"\n   💎 Treinando modelo individual para {sym} ({len(sym_df)} trades)...")
                try:
                    sym_X, sym_y = build_feature_matrix(sym_df)
                    validate(sym_X, sym_y, 20)
                    sym_pipeline, sym_metrics = train(sym_X, sym_y)
                    
                    # Salvar em ml_models/<SYMBOL>/model.onnx
                    sym_dir = ml_models_dir / sym
                    sym_dir.mkdir(parents=True, exist_ok=True)
                    
                    sym_output_path = sym_dir / 'model.onnx'
                    export_onnx(sym_pipeline, str(sym_output_path), len(FEATURE_COLUMNS))
                    save_report(sym_metrics, str(sym_dir), len(sym_y))
                    trained_symbols.append(sym)
                except Exception as e:
                    print(f"   ❌ Erro ao treinar modelo para {sym}: {e}")
                    
            print(f"\n✅ Treinamento concluído! Modelos isolados criados para: {', '.join(trained_symbols)}")
            
        print("\n🚀 Reinicie o backend: pm2 restart signal-engine\n")
    except ValueError as e:
        print(f"\n⚠️  {e}\n")
        sys.exit(2)
    except Exception as e:
        print(f"\n❌ Erro: {e}\n")
        raise


if __name__ == '__main__':
    main()
