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
        with open('tmp_logs_telegram.txt', 'w', encoding='utf-8') as f:
            if out: f.write("STDOUT:\n" + out + "\n")
            if err: f.write("STDERR:\n" + err + "\n")
    except Exception as e:
        with open('tmp_logs_telegram.txt', 'w', encoding='utf-8') as f:
            f.write(f"Error: {e}\n")
    finally:
        client.close()

if __name__ == "__main__":
    ssh_exec("pm2 show telegram-bot && cat /var/www/signal-dashboard/backend/logs/telegram-bot-error.log /var/www/signal-dashboard/backend/logs/telegram-bot-out.log | tail -n 100")
