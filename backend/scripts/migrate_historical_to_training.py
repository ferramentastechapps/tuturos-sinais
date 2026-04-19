#!/usr/bin/env python3
"""
migrate_historical_to_training.py — Migra dados históricos do Supabase para ml_training_data.

Busca trade_signals finalizados (CLOSED_TP / CLOSED_SL) do Supabase,
extrai as features salvas em ml_data e insere na tabela ml_training_data
para que o retrain_model.py possa treinar o modelo imediatamente.

Usage:
    python migrate_historical_to_training.py [--dry-run] [--min-days N]

Environment variables:
    SUPABASE_URL         — URL do projeto Supabase
    SUPABASE_SERVICE_KEY — Service role key (ou SUPABASE_KEY / VITE_SUPABASE_ANON_KEY)
"""

import os
import sys
import json
import argparse
from datetime import datetime, timezone
from pathlib import Path

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

if MISSING:
    print(f"\n❌ Missing dependencies: {', '.join(MISSING)}")
    print(f"   pip install {' '.join(MISSING)}\n")
    sys.exit(1)

# ── Feature columns (deve bater com retrain_model.py e mlPredictionService.ts) ──
FEATURE_COLUMNS = [
    'symbol_id',
    'rsi', 'adx', 'atr_rel', 'dist_ema20', 'dist_ema50', 'dist_ema200', 'dist_vwap',
    'volatility_24h', 'volume_rel', 'funding_rate', 'open_interest_var', 'long_short_ratio',
    'is_long', 'confidence', 'quality_score', 'confluence_count', 'stop_loss_pct',
    'take_profit_pct', 'risk_reward', 'hour_of_day', 'day_of_week',
    'btc_trend', 'dominance_btc', 'fear_greed',
]

WIN_STATUSES  = {'CLOSED_TP', 'TP_HIT', 'WIN', 'TAKE_PROFIT'}
LOSS_STATUSES = {'CLOSED_SL', 'SL_HIT', 'LOSS', 'STOP_LOSS'}


def load_env(backend_dir: Path):
    for env_file in ['.env.production', '.env', '.env.local']:
        path = backend_dir / env_file
        if not path.exists():
            continue
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, _, value = line.partition('=')
                    os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    try:
        from dotenv import load_dotenv
        load_dotenv(backend_dir / '.env.production', override=False)
        load_dotenv(backend_dir / '.env', override=False)
    except ImportError:
        pass


def get_symbol_id(symbol: str) -> int:
    """Hash simples do símbolo — igual ao getSymbolId() do TypeScript."""
    h = 0
    for ch in symbol:
        h = ord(ch) + ((h << 5) - h)
        h = h & 0xFFFFFFFF  # 32-bit
    return h & 0x7FFFFFFF   # positivo


def extract_features(row: dict) -> dict | None:
    """
    Tenta extrair o vetor de features de um registro trade_signals.
    Prioridade: ml_data.features > ml_data direto > campos soltos do row.
    Retorna None se não houver dados suficientes.
    """
    ml_raw = row.get('ml_data') or row.get('mlData') or {}
    if isinstance(ml_raw, str):
        try:
            ml_raw = json.loads(ml_raw)
        except Exception:
            ml_raw = {}

    # Tentar pegar features aninhadas
    feats = ml_raw.get('features') or ml_raw.get('featureVector') or {}
    if isinstance(feats, str):
        try:
            feats = json.loads(feats)
        except Exception:
            feats = {}

    # Se não tem features aninhadas, usar ml_raw como features direto
    if not feats and isinstance(ml_raw, dict):
        feats = ml_raw

    # Fallback: construir features a partir dos campos do próprio row
    symbol = row.get('pair') or row.get('symbol') or ''
    feats.setdefault('symbol_id', get_symbol_id(symbol))
    feats.setdefault('rsi',            row.get('rsi') or 50.0)
    feats.setdefault('adx',            row.get('adx') or 20.0)
    feats.setdefault('confidence',     row.get('confidence') or 0.5)
    feats.setdefault('quality_score',  row.get('score') or row.get('quality_score') or 0.5)
    feats.setdefault('risk_reward',    row.get('risk_reward') or row.get('riskReward') or 1.5)
    feats.setdefault('is_long',        1 if str(row.get('type', '')).upper() in ('LONG', 'BUY') else 0)

    # Hora e dia da semana a partir de created_at
    created_at_str = row.get('created_at') or row.get('createdAt') or ''
    try:
        dt = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
        feats.setdefault('hour_of_day',  dt.hour)
        feats.setdefault('day_of_week',  dt.weekday())
    except Exception:
        feats.setdefault('hour_of_day',  12)
        feats.setdefault('day_of_week',  0)

    # Verificar se temos pelo menos algumas features reais (não só defaults)
    real_features = sum(1 for col in FEATURE_COLUMNS if feats.get(col, 0) != 0)
    if real_features < 3:
        return None  # Dados insuficientes

    return feats


def determine_outcome(row: dict) -> int | None:
    """Retorna 1 (WIN) ou 0 (LOSS) ou None se não determinável."""
    status = str(row.get('status') or '').upper()
    result = str(row.get('result') or '').upper()

    if status in WIN_STATUSES or result in WIN_STATUSES:
        return 1
    if status in LOSS_STATUSES or result in LOSS_STATUSES:
        return 0

    # Tentar pelo pnl
    pnl = row.get('profit_percent') or row.get('pnl') or row.get('outcome_pnl')
    if pnl is not None:
        try:
            return 1 if float(pnl) > 0 else 0
        except Exception:
            pass

    return None


def fetch_supabase_trades(client) -> list[dict]:
    """Busca todos os trades finalizados do Supabase."""
    print("📡 Buscando trade_signals do Supabase...")

    all_rows = []
    page_size = 1000
    offset = 0

    while True:
        resp = (
            client.table('trade_signals')
            .select('*')
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = resp.data or []
        all_rows.extend(batch)
        print(f"   Carregados {len(all_rows)} registros...", end='\r')
        if len(batch) < page_size:
            break
        offset += page_size

    print(f"\n   ✅ Total: {len(all_rows)} registros em trade_signals")
    return all_rows


def fetch_existing_signal_ids(client) -> set[str]:
    """Busca signal_ids já presentes em ml_training_data para evitar duplicatas."""
    resp = client.table('ml_training_data').select('signal_id').execute()
    return {r['signal_id'] for r in (resp.data or [])}


def fetch_sqlite_training_data(backend_dir: Path) -> list[dict]:
    """
    Lê ml_training_data do SQLite local (Prisma) via arquivo .db.
    Retorna lista de dicts prontos para inserir no Supabase.
    """
    db_path = backend_dir / 'prisma' / 'dev.db'
    if not db_path.exists():
        # Tentar DATABASE_URL
        db_url = os.environ.get('DATABASE_URL', '')
        if db_url.startswith('file:'):
            db_path = backend_dir / db_url.replace('file:', '').lstrip('.')
        if not db_path.exists():
            print(f"   ℹ️  SQLite não encontrado em {db_path} — pulando leitura local")
            return []

    try:
        import sqlite3
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM MLTrainingData ORDER BY created_at DESC")
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        print(f"   📂 SQLite local: {len(rows)} registros em MLTrainingData")
        return rows
    except Exception as e:
        print(f"   ⚠️  Erro ao ler SQLite: {e}")
        return []


def fetch_local_jsonl(backend_dir: Path) -> list[dict]:
    """Lê o arquivo JSONL local gerado pelo tradeTracker."""
    jsonl_path = backend_dir.parent / 'ml_engine' / 'data' / 'historical_ml_data.jsonl'
    if not jsonl_path.exists():
        return []
    rows = []
    with open(jsonl_path) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    rows.append(json.loads(line))
                except Exception:
                    pass
    print(f"   📂 JSONL local: {len(rows)} registros")
    return rows


def migrate(dry_run: bool = False):
    script_dir = Path(__file__).parent
    backend_dir = script_dir.parent
    load_env(backend_dir)

    supabase_url = os.environ.get('SUPABASE_URL') or os.environ.get('VITE_SUPABASE_URL')
    supabase_key = (
        os.environ.get('SUPABASE_SERVICE_KEY')
        or os.environ.get('SUPABASE_KEY')
        or os.environ.get('VITE_SUPABASE_ANON_KEY')
        or os.environ.get('VITE_SUPABASE_PUBLISHABLE_KEY')
    )

    if not supabase_url or not supabase_key:
        print("❌ SUPABASE_URL e SUPABASE_SERVICE_KEY não configurados.")
        sys.exit(1)

    client = create_client(supabase_url, supabase_key)

    # 1. Buscar trades históricos do Supabase (trade_signals)
    all_trades = fetch_supabase_trades(client)

    # 2. Buscar dados do SQLite local e JSONL
    sqlite_rows = fetch_sqlite_training_data(backend_dir)
    jsonl_rows  = fetch_local_jsonl(backend_dir)

    # 3. Buscar IDs já migrados
    existing_ids = fetch_existing_signal_ids(client)
    print(f"   ℹ️  {len(existing_ids)} registros já existem em ml_training_data")

    # 4. Processar trade_signals do Supabase
    to_insert = []
    skipped_no_outcome = 0
    skipped_no_features = 0
    skipped_duplicate = 0

    wins = 0
    losses = 0

    for row in all_trades:
        signal_id = str(row.get('id') or '')

        # Pular duplicatas
        if signal_id in existing_ids:
            skipped_duplicate += 1
            continue

        # Determinar outcome
        outcome = determine_outcome(row)
        if outcome is None:
            skipped_no_outcome += 1
            continue

        # Extrair features
        feats = extract_features(row)
        if feats is None:
            skipped_no_features += 1
            continue

        symbol = row.get('pair') or row.get('symbol') or 'UNKNOWN'
        pnl = float(row.get('profit_percent') or row.get('pnl') or (1.5 if outcome == 1 else -1.0))
        created_at = row.get('created_at') or datetime.now(timezone.utc).isoformat()

        to_insert.append({
            'signal_id':     signal_id,
            'symbol':        symbol,
            'outcome_label': outcome,
            'outcome_pnl':   pnl,
            'entry_time':    created_at,
            'features':      json.dumps(feats),
        })

        if outcome == 1:
            wins += 1
        else:
            losses += 1

    # 5. Processar dados do SQLite local (já têm outcome_label e features prontos)
    for row in sqlite_rows:
        signal_id = str(row.get('id') or row.get('signal_id') or '')
        if signal_id in existing_ids:
            skipped_duplicate += 1
            continue

        feats_raw = row.get('features') or '{}'
        if isinstance(feats_raw, str):
            try:
                feats_raw = json.loads(feats_raw)
            except Exception:
                feats_raw = {}

        to_insert.append({
            'signal_id':     row.get('signal_id') or signal_id,
            'symbol':        row.get('symbol') or 'UNKNOWN',
            'outcome_label': int(row.get('outcome_label') or 0),
            'outcome_pnl':   float(row.get('outcome_pnl') or 0),
            'entry_time':    row.get('entry_time') or datetime.now(timezone.utc).isoformat(),
            'features':      json.dumps(feats_raw) if isinstance(feats_raw, dict) else feats_raw,
        })
        if int(row.get('outcome_label') or 0) == 1:
            wins += 1
        else:
            losses += 1

    # 6. Processar JSONL local
    for row in jsonl_rows:
        signal_id = str(row.get('signal_id') or row.get('id') or '')
        if signal_id in existing_ids:
            skipped_duplicate += 1
            continue

        feats_raw = row.get('features') or {}
        to_insert.append({
            'signal_id':     signal_id,
            'symbol':        row.get('symbol') or 'UNKNOWN',
            'outcome_label': int(row.get('outcome_label') or 0),
            'outcome_pnl':   float(row.get('outcome_pnl') or 0),
            'entry_time':    row.get('entry_time') or datetime.now(timezone.utc).isoformat(),
            'features':      json.dumps(feats_raw) if isinstance(feats_raw, dict) else str(feats_raw),
        })
        if int(row.get('outcome_label') or 0) == 1:
            wins += 1
        else:
            losses += 1

    # 7. Relatório
    print(f"\n📊 RESULTADO DA ANÁLISE:")
    print(f"   Total trades analisados : {len(all_trades)}")
    print(f"   ✅ Prontos para migrar  : {len(to_insert)} ({wins} wins / {losses} losses)")
    print(f"   ⏭️  Duplicatas ignoradas : {skipped_duplicate}")
    print(f"   ⚠️  Sem outcome         : {skipped_no_outcome}")
    print(f"   ⚠️  Sem features        : {skipped_no_features}")

    if len(to_insert) == 0:
        print("\n⚠️  Nenhum registro novo para migrar.")
        print("   Verifique se os trades têm status CLOSED_TP / CLOSED_SL no Supabase.")
        return 0

    win_rate = wins / len(to_insert) * 100
    print(f"\n   Win Rate histórico: {win_rate:.1f}%")

    if dry_run:
        print("\n🔍 DRY RUN — nenhum dado foi inserido.")
        print("   Remova --dry-run para executar a migração real.")
        return len(to_insert)

    # 5. Inserir em lotes
    print(f"\n💾 Inserindo {len(to_insert)} registros em ml_training_data...")
    batch_size = 100
    inserted = 0

    for i in range(0, len(to_insert), batch_size):
        batch = to_insert[i:i + batch_size]
        resp = client.table('ml_training_data').insert(batch).execute()
        inserted += len(batch)
        print(f"   Inseridos {inserted}/{len(to_insert)}...", end='\r')

    print(f"\n   ✅ Migração concluída! {inserted} registros inseridos.")
    return inserted


def main():
    parser = argparse.ArgumentParser(description='Migra dados históricos para ml_training_data.')
    parser.add_argument('--dry-run', action='store_true',
                        help='Apenas analisa, não insere dados')
    args = parser.parse_args()

    print("=" * 60)
    print("  📦 Migração de Dados Históricos → ml_training_data")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60 + "\n")

    count = migrate(dry_run=args.dry_run)

    if count > 0 and not args.dry_run:
        print("\n🚀 Próximo passo: treinar o modelo com esses dados:")
        print("   python retrain_model.py --min-samples 30\n")


if __name__ == '__main__':
    main()
