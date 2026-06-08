import paramiko
import json

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

if __name__ == "__main__":
    since_ms = 1780704000000 # 2026-06-05 21:00:00 Local time (UTC-3)
    query = f"SELECT id, pair, indicators FROM TradeSignal WHERE trade_type='Swing Trade' AND created_at >= {since_ms};"
    results = run_ssh_query(query)
    
    count_suporte = 0
    count_liquidez = 0
    print(f"Total Swing Signals desde o deploy: {len(results)}")
    for r in results:
        inds = r.get('indicators')
        if inds:
            if 'Suporte' in inds or 'suporte' in inds.lower():
                count_suporte += 1
            if 'Liquidez' in inds or 'liquidez' in inds.lower():
                count_liquidez += 1
            print(f"Signal: {r.get('id')} | Indicators: {inds}")
            
    print(f"Swing signals com Suporte: {count_suporte}")
    print(f"Swing signals com Liquidez: {count_liquidez}")
