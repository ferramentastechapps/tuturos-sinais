import paramiko
import sys

VPS_HOST = "212.85.10.239"
VPS_USER = "root"
VPS_PASS = "F(W4f37Db)-kE'tM"

def ssh_exec(cmd):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=10)
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        with open('tmp_logs_output.txt', 'w', encoding='utf-8') as f:
            if out: f.write("STDOUT:\n" + out + "\n")
            if err: f.write("STDERR:\n" + err + "\n")
    except Exception as e:
        with open('tmp_logs_output.txt', 'w', encoding='utf-8') as f:
            f.write(f"Error: {e}\n")
    finally:
        client.close()

if __name__ == "__main__":
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=10)
        sftp = client.open_sftp()
        sftp.put(r"c:\\Users\\jotas\\tuturos-sinais\\src\\pages\\MLAnalytics.tsx", "/var/www/signal-dashboard/src/pages/MLAnalytics.tsx")
        sftp.put(r"c:\\Users\\jotas\\tuturos-sinais\\backend\\src\\server\\api.ts", "/var/www/signal-dashboard/backend/src/server/api.ts")
        sftp.close()
        client.close()
        print("Files uploaded successfully.")
        
        diagnostic_cmd = """
cd /var/www/signal-dashboard
npm run build
cd backend
npx tsc
pm2 restart signal-engine
"""
        ssh_exec(diagnostic_cmd)
        print("Deployed and restarted.")
    except Exception as e:
        print(f"Error deploying: {e}")


