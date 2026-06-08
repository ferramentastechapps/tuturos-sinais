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
    out, err = run_ssh_cmd("grep -i 'SWING-AVAXUSDT-1780720561555' /var/www/signal-dashboard/backend/logs/signal-engine-out.log")
    print("LOG FOR SWING-AVAXUSDT-1780720561555:")
    print(out)
    if err:
        print("ERR:", err)
