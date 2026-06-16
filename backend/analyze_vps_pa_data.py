import paramiko
import json
import re
import datetime

VPS_HOST = "212.85.10.239"
VPS_USER = "root"
VPS_PASS = "F(W4f37Db)-kE'tM"
DB_PATH = "/var/www/signal-dashboard/backend/prisma/data/trading.db"

def run_ssh_query(sqlite_query):
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
    print("Connecting to VPS to analyze real data...")
    
    # 48 hours ago
    now = datetime.datetime.utcnow()
    since_48h = now - datetime.timedelta(hours=48)
    since_48h_ms = int(since_48h.timestamp() * 1000)
    print(f"Current UTC time: {now.isoformat()}")
    print(f"Analyzing signals since: {since_48h.isoformat()} (Timestamp: {since_48h_ms})")

    # Fetch recent signals
    all_recent_signals = run_ssh_query(f"SELECT id, pair, type, trade_type, status, confidence, indicators, outcome, pnl, created_at FROM TradeSignal;")
    
    recent_signals = []
    for s in all_recent_signals:
        created = s.get('created_at')
        if isinstance(created, str):
            try:
                # ISO format parse
                created = int(datetime.datetime.fromisoformat(created.replace('Z', '+00:00')).timestamp() * 1000)
            except:
                pass
        if created and isinstance(created, (int, float)) and created >= since_48h_ms:
            recent_signals.append(s)
            
    print(f"Total TradeSignal in the last 48h: {len(recent_signals)}")
    print("\n--- RECENT SIGNALS DETAIL ---")
    for idx, s in enumerate(recent_signals):
        print(f"#{idx+1}: ID={s.get('id')}, Pair={s.get('pair')}, Type={s.get('type')}, TradeType={s.get('trade_type')}, Status={s.get('status')}, Confidence={s.get('confidence')}, Outcome={s.get('outcome')}, PnL={s.get('pnl')}, Created={s.get('created_at')}")
        print(f"     Indicators: {s.get('indicators')}")

    # Let's read the logs to check for PA detections, vetoes, and Bybit requests
    log_files_out, _ = run_ssh_cmd("ls -la /var/www/signal-dashboard/backend/logs/")
    print("\nLog files on VPS:\n", log_files_out)

    # Let's inspect the content of the winston logs for the last 2 days
    # (signal-engine-2026-06-16.log, signal-engine-2026-06-15.log etc)
    structure_logs, _ = run_ssh_cmd("grep -h 'STRUCTURE' /var/www/signal-dashboard/backend/logs/signal-engine-2026-06-15.log /var/www/signal-dashboard/backend/logs/signal-engine-2026-06-16.log | head -n 20")
    print("\n--- STRUCTURE LOGS SAMPLE ---")
    print(structure_logs if structure_logs.strip() else "Nenhum log com 'STRUCTURE' encontrado.")

    score_logs, _ = run_ssh_cmd("grep -h 'SCORE-DEBUG' /var/www/signal-dashboard/backend/logs/signal-engine-2026-06-15.log /var/www/signal-dashboard/backend/logs/signal-engine-2026-06-16.log | head -n 20")
    print("\n--- SCORE-DEBUG LOGS SAMPLE ---")
    print(score_logs if score_logs.strip() else "Nenhum log com 'SCORE-DEBUG' encontrado.")

    grep_cmd = "grep -h -o -E 'VETO TOPO DUPLO|VETO FUNDO DUPLO|VETO BREAKOUT|Pullback Zona Rompida|Fundo Duplo Macro|Topo Duplo Macro|Inside Bar 15m|Inside Bar em Order Block|Rejeição LTA Macro|Rejeição LTB Macro|Veto Breakout Sem Pullback' /var/www/signal-dashboard/backend/logs/signal-engine-*.log | sort | uniq -c"
    grep_out, _ = run_ssh_cmd(grep_cmd)
    print("\n--- PRICE ACTION DETECTIONS & VETOES IN WINSTON LOGS ---")
    print(grep_out if grep_out.strip() else "Nenhum log de detecção/veto encontrado nos arquivos signal-engine-*.log.")

    # Also search PM2 logs
    grep_pm2_cmd = "grep -o -E 'VETO TOPO DUPLO|VETO FUNDO DUPLO|VETO BREAKOUT|Pullback Zona Rompida|Fundo Duplo Macro|Topo Duplo Macro|Inside Bar 15m|Inside Bar em Order Block|Rejeição LTA Macro|Rejeição LTB Macro|Veto Breakout Sem Pullback' /var/www/signal-dashboard/backend/logs/signal-engine-out.log | sort | uniq -c"
    grep_pm2_out, _ = run_ssh_cmd(grep_pm2_cmd)
    print("\n--- PRICE ACTION DETECTIONS & VETOES IN PM2 signal-engine-out.log ---")
    print(grep_pm2_out if grep_pm2_out.strip() else "Nenhum log encontrado no signal-engine-out.log.")

    # Let's count Bybit API calls in Winston logs
    # We can check how many fetchKlines or getTicker or Bybit API logs are printed per cycle
    # Usually Winston prints cycle logs like "Running signal generation cycle..."
    cycles_count_cmd = "grep -c 'Running signal generation cycle' /var/www/signal-dashboard/backend/logs/signal-engine-*.log /var/www/signal-dashboard/backend/logs/signal-engine-out.log"
    cycles_out, _ = run_ssh_cmd(cycles_count_cmd)
    print("\n--- CYCLES COUNT ---")
    print(cycles_out)

    rate_limit_cmd = "grep -i -c 'rate limit|429|Too Many Requests' /var/www/signal-dashboard/backend/logs/signal-engine-*.log /var/www/signal-dashboard/backend/logs/signal-engine-out.log"
    rate_limit_out, _ = run_ssh_cmd(rate_limit_cmd)
    print("\n--- RATE LIMIT ERRORS ---")
    print(rate_limit_out)

    # Calculate average ADX
    # Let's search for ADX values printed in the logs to see the average
    adx_values_cmd = "grep -h -o -E 'ADX=[0-9.]+|ADX SWING: [0-9.]+' /var/www/signal-dashboard/backend/logs/signal-engine-*.log /var/www/signal-dashboard/backend/logs/signal-engine-out.log | grep -o -E '[0-9.]+'"
    adx_out, _ = run_ssh_cmd(adx_values_cmd)
    adx_list = []
    for x in adx_out.split('\n'):
        x = x.strip()
        if not x:
            continue
        try:
            val = float(x)
            # ADX is naturally between 0 and 100. Let's ignore matches that could be dates or filenames.
            if 0.0 <= val <= 100.0:
                adx_list.append(val)
        except ValueError:
            pass
            
    if adx_list:
        print(f"\n--- ADX ANALYSIS ---")
        print(f"Total ADX readings: {len(adx_list)}")
        print(f"Average ADX: {sum(adx_list)/len(adx_list):.2f}")
    else:
        print("\nNo ADX readings found in logs.")

    # Let's check the number of Vetoes by type in the logs
    vetoes_types_cmd = "grep -o -E 'VETO ADX|VETO ADX SWING|VETO RSI|VETO BTC TREND|VETO FEAR & GREED|VETO SCORE|VETO VOLATILIDADE ALTA' /var/www/signal-dashboard/backend/logs/signal-engine-*.log /var/www/signal-dashboard/backend/logs/signal-engine-out.log | sort | uniq -c"
    vetoes_out, _ = run_ssh_cmd(vetoes_types_cmd)
    print("\n--- VETO TYPES IN LOGS ---")
    print(vetoes_out if vetoes_out.strip() else "No vetoes logged.")
