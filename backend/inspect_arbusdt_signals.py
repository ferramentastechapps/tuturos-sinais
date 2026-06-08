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
    node_cmd = (
        "cd /var/www/signal-dashboard/backend && "
        "node --input-type=module -e \""
        "import { createClient } from '@supabase/supabase-js';"
        "const s = createClient('https://owchjtzucnhsvlkwdapn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Y2hqdHp1Y25oc3Zsa3dkYXBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODgyNzI0NCwiZXhwIjoyMDg0NDAzMjQ0fQ.rPk-VmP35j-7BiFQgkTkG99yVgVExWc3xF3G-yPUbVg');"
        "s.from('ml_training_data').select('*').limit(1).then(r => console.log(JSON.stringify(r.data)));"
        "\""
    )
    out, err = run_ssh_cmd(node_cmd)
    print("OUT:")
    print(out)
    if err:
        print("ERR:")
        print(err)
