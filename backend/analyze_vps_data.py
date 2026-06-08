import paramiko
import json
import re

VPS_HOST = "212.85.10.239"
VPS_USER = "root"
VPS_PASS = "F(W4f37Db)-kE'tM"
DB_PATH = "/var/www/signal-dashboard/backend/prisma/data/trading.db"

def run_ssh_query(sqlite_query):
    # Envelop the query safely for the shell
    cmd = f'sqlite3 -json {DB_PATH} "{sqlite_query}"'
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=10)
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        if err:
            print(f"QUERY ERROR: {err}")
        if not out.strip():
            return []
        try:
            return json.loads(out)
        except Exception as e:
            # Fallback if not JSON or empty
            return out
    except Exception as e:
        print(f"SSH Query Error: {e}")
        return []
    finally:
        client.close()

def run_ssh_cmd(cmd):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=10)
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        return out, err
    except Exception as e:
        return "", str(e)
    finally:
        client.close()

if __name__ == "__main__":
    print("==================================================")
    print("🔍 INICIANDO DIAGNÓSTICO E ANÁLISE COMPLETA NA VPS")
    print("==================================================")

    # 1. DATABASE QUERIES
    # Scalping signals since 2026-06-05
    # Let's count how many MLTrainingData records we have for ARBUSDT scalping since 2026-06-05
    # Wait, SQLite has datetime function or we can just compare text created_at
    # Let's inspect created_at format first
    format_check = run_ssh_query("SELECT created_at FROM TradeSignal ORDER BY created_at DESC LIMIT 1;")
    print("Formato do created_at na DB:", format_check)

    # Let's run robust SQL queries that handle date comparisons or retrieve the rows and we filter in Python
    # This is 100% safe against SQLite date function incompatibilities!
    all_trade_signals = run_ssh_query("SELECT id, pair, type, trade_type, status, confidence, indicators, ml_data, outcome, pnl, created_at FROM TradeSignal;")
    all_ml_training = run_ssh_query("SELECT id, signal_id, symbol, outcome_label, outcome_pnl, features, trade_type, created_at FROM MLTrainingData;")

    print(f"Total TradeSignal na VPS: {len(all_trade_signals)}")
    print(f"Total MLTrainingData na VPS: {len(all_ml_training)}")

    # Date target: 2026-06-05 21:00:00 (local time UTC-3)
    # 2026-06-05 21:00:00 UTC-3 corresponds to 2026-06-06 00:00:00 UTC
    # Epoch time for 2026-06-06 00:00:00 UTC is:
    # 1780704000000 milliseconds.
    # Let's calculate dynamically.
    import datetime
    since_dt = datetime.datetime(2026, 6, 5, 21, 0, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=-3)))
    since_ms = int(since_dt.timestamp() * 1000)
    print(f"Comparando timestamps maiores que: {since_ms} ({since_dt.isoformat()})")
    
    new_signals = []
    for s in all_trade_signals:
        created = s.get('created_at')
        if isinstance(created, str):
            try:
                created = int(datetime.datetime.fromisoformat(created.replace('Z', '+00:00')).timestamp() * 1000)
            except:
                pass
        if created and isinstance(created, (int, float)) and created >= since_ms:
            new_signals.append(s)
            
    new_training = []
    for t in all_ml_training:
        created = t.get('created_at')
        if isinstance(created, str):
            try:
                created = int(datetime.datetime.fromisoformat(created.replace('Z', '+00:00')).timestamp() * 1000)
            except:
                pass
        if created and isinstance(created, (int, float)) and created >= since_ms:
            new_training.append(t)

    print(f"Novos TradeSignal (desde {since_dt.isoformat()}): {len(new_signals)}")
    print(f"Novas MLTrainingData (desde {since_dt.isoformat()}): {len(new_training)}")

    # SCALPING
    scalping_signals = [s for s in new_signals if s.get('pair') == 'ARBUSDT' and 'Scalp' in s.get('trade_type', '')]
    scalping_training = [t for t in new_training if t.get('symbol') == 'ARBUSDT' and t.get('trade_type') == 'scalping']

    print("\n--- DETALHES SCALPING ARBUSDT ---")
    print(f"Novos TradeSignal de Scalping para ARBUSDT: {len(scalping_signals)}")
    print(f"Novos MLTrainingData de Scalping para ARBUSDT: {len(scalping_training)}")

    # Check critical fields
    filled_critical_count = 0
    null_counts = {"rsi": 0, "adx": 0, "btc_trend": 0, "fear_greed": 0}
    for t in scalping_training:
        feats_str = t.get('features', '{}')
        try:
            feats = json.loads(feats_str)
        except:
            feats = {}
        
        rsi = feats.get('rsi') if feats.get('rsi') is not None else feats.get('_rsi')
        adx = feats.get('adx') if feats.get('adx') is not None else feats.get('_adx')
        btc_trend = feats.get('btc_trend') if feats.get('btc_trend') is not None else feats.get('btcTrend')
        fear_greed = feats.get('fear_greed') if feats.get('fear_greed') is not None else feats.get('fearGreed')

        if rsi is None: null_counts["rsi"] += 1
        if adx is None: null_counts["adx"] += 1
        if btc_trend is None: null_counts["btc_trend"] += 1
        if fear_greed is None: null_counts["fear_greed"] += 1

        if rsi is not None and adx is not None and btc_trend is not None and fear_greed is not None:
            filled_critical_count += 1

    print(f"Novos trades com todos os campos críticos preenchidos: {filled_critical_count} / {len(scalping_training)}")
    print("Campos nulos encontrados por atributo:", null_counts)

    # Win rate Scalping
    wins_scalp = sum(1 for t in scalping_training if t.get('outcome_label') == 1)
    losses_scalp = sum(1 for t in scalping_training if t.get('outcome_label') == 0)
    total_scalp = len(scalping_training)
    wr_scalp = (wins_scalp / total_scalp * 100) if total_scalp > 0 else 0
    print(f"Resultado Scalping: Wins={wins_scalp}, Losses={losses_scalp}, WR={wr_scalp:.2f}% (Baseline anterior = 12.50%)")

    # NEEDS_REVIEW
    needs_review = [s for s in scalping_signals if s.get('outcome') == 'NEEDS_REVIEW']
    print(f"Outcome 'NEEDS_REVIEW' para Scalping: {len(needs_review)}")
    for nr in needs_review:
        print(f"  * ID: {nr.get('id')} | Indicators: {nr.get('indicators')} | PnL: {nr.get('pnl')}")

    # SWING
    swing_signals = [s for s in new_signals if s.get('pair') == 'ARBUSDT' and 'Swing' in s.get('trade_type', '')]
    swing_training = [t for t in new_training if t.get('symbol') == 'ARBUSDT' and t.get('trade_type') == 'swing']

    print("\n--- DETALHES SWING ARBUSDT ---")
    print(f"Novos TradeSignal de Swing para ARBUSDT: {len(swing_signals)}")
    print(f"Novos MLTrainingData de Swing para ARBUSDT: {len(swing_training)}")

    wins_swing = sum(1 for t in swing_training if t.get('outcome_label') == 1)
    losses_swing = sum(1 for t in swing_training if t.get('outcome_label') == 0)
    total_swing = len(swing_training)
    wr_swing = (wins_swing / total_swing * 100) if total_swing > 0 else 0
    print(f"Resultado Swing: Wins={wins_swing}, Losses={losses_swing}, WR={wr_swing:.2f}% (Baseline anterior = 25.00%)")

    # Check score bonuses
    support_bonus_count = 0
    liquidity_bonus_count = 0
    for s in swing_signals:
        inds_str = s.get('indicators', '[]')
        try:
            inds = json.loads(inds_str)
        except:
            inds = []
        if 'Suporte histórico forte +1.5' in inds:
            support_bonus_count += 1
        if 'Zona de liquidez extrema +1' in inds:
            liquidity_bonus_count += 1
    print(f"Swing signals com 'Suporte histórico forte +1.5': {support_bonus_count}")
    print(f"Swing signals com 'Zona de liquidez extrema +1': {liquidity_bonus_count}")


    # 2. LOGS ANALYSES
    print("\n==================================================")
    print("📊 ANALISANDO ARQUIVOS DE LOG DO BOT (ÚLTIMOS 48H)")
    print("==================================================")
    
    # Read PM2 logs
    print("Lendo logs do PM2 para signal-engine...")
    out_log, _ = run_ssh_cmd("tail -n 15000 /var/www/signal-dashboard/backend/logs/signal-engine-out.log")
    err_log, _ = run_ssh_cmd("tail -n 15000 /var/www/signal-dashboard/backend/logs/signal-engine-error.log")
    
    # Search for blocks
    # Keyword Vetoes
    veto_adx = len(re.findall(r"VETO ADX|ADX muito baixo", out_log, re.IGNORECASE))
    veto_rsi = len(re.findall(r"VETO RSI", out_log, re.IGNORECASE))
    veto_btc_trend = len(re.findall(r"VETO BTC TREND|btc_trend", out_log, re.IGNORECASE))
    veto_fear_greed = len(re.findall(r"VETO FEAR & GREED|Fear & Greed", out_log, re.IGNORECASE))
    veto_score = len(re.findall(r"VETO SCORE|Pontuação.*<", out_log, re.IGNORECASE))
    veto_volatility = len(re.findall(r"VETO VOLATILIDADE ALTA|volatilidade alta", out_log, re.IGNORECASE))
    veto_low_vol = len(re.findall(r"Veto volume baixo", out_log, re.IGNORECASE))
    veto_liquidity = len(re.findall(r"baixa liquidez", out_log, re.IGNORECASE))
    veto_trading_hours = len(re.findall(r"Horário bloqueado", out_log, re.IGNORECASE))
    
    # Count generated vs blocked
    total_blocked = veto_adx + veto_rsi + veto_btc_trend + veto_fear_greed + veto_score + veto_volatility + veto_low_vol + veto_liquidity + veto_trading_hours
    total_generated = len(re.findall(r"Signal generated:|Sinal enviado:", out_log, re.IGNORECASE))
    
    print(f"Sinais Gerados e Enviados/Logados: {total_generated}")
    print(f"Sinais Bloqueados identificados em log: {total_blocked}")
    print(f"  - ADX Vetoes: {veto_adx}")
    print(f"  - RSI Vetoes: {veto_rsi}")
    print(f"  - BTC Trend Vetoes: {veto_btc_trend}")
    print(f"  - Fear & Greed Vetoes: {veto_fear_greed}")
    print(f"  - Score Insuficiente: {veto_score}")
    print(f"  - Volatilidade Alta Vetoes: {veto_volatility}")
    print(f"  - Volume Baixo Vetoes: {veto_low_vol}")
    print(f"  - Baixa Liquidez: {veto_liquidity}")
    print(f"  - Horário Bloqueado: {veto_trading_hours}")

    # Check for runtime errors
    bybit_timeouts = len(re.findall(r"timeout|ETIMEDOUT|ESOCKETTIMEDOUT|Bybit API error", out_log + err_log, re.IGNORECASE))
    runtime_exceptions = len(re.findall(r"Exception|Error:|TypeError|ReferenceError|Uncaught", out_log + err_log, re.IGNORECASE))
    
    print(f"Erros de runtime (Exceptions/Erros de código): {runtime_exceptions}")
    print(f"Timeouts / Erros na API da Bybit: {bybit_timeouts}")
    if bybit_timeouts > 0:
        print("  Amostra de timeouts na Bybit:")
        lines = [line for line in (out_log + err_log).split('\n') if 'timeout' in line.lower() or 'etimedout' in line.lower() or 'bybit api error' in line.lower()][:3]
        for l in lines:
            print(f"    * {l}")
            
    if runtime_exceptions > 0:
        print("  Amostra de erros/exceptions:")
        lines = [line for line in (out_log + err_log).split('\n') if 'error' in line.lower() or 'exception' in line.lower()][:3]
        for l in lines:
            print(f"    * {l}")

    # Check globalCtx refetch
    refetches = len(re.findall(r"Contexto externo undefined — aguardando refetch", out_log, re.IGNORECASE))
    print(f"Refetch de globalCtx acionado: {refetches} vezes")

    print("\n--- TESTE DE CONTINGÊNCIA E AVALIAÇÃO DE FILTROS ---")
    print(f"Frequência de novos sinais para ARBUSDT no Scalping: {len(scalping_signals)} trades em 48h")
    print(f"Frequência de novos sinais para ARBUSDT no Swing: {len(swing_signals)} trades em 48h")
