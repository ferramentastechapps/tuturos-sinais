import paramiko

VPS_HOST = "212.85.10.239"
VPS_USER = "root"
VPS_PASS = "F(W4f37Db)-kE'tM"

def check_logs():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        
        with open("vps_logs_output.txt", "w", encoding="utf-8") as f:
            stdin, stdout, stderr = client.exec_command("pm2 logs signal-engine --lines 150 --nostream")
            f.write("\n--- SIGNAL ENGINE LOGS ---\n")
            f.write(stdout.read().decode('utf-8'))
            f.write(stderr.read().decode('utf-8'))

            stdin, stdout, stderr = client.exec_command("pm2 logs telegram-bot --lines 150 --nostream")
            f.write("\n--- TELEGRAM BOT LOGS ---\n")
            f.write(stdout.read().decode('utf-8'))
            f.write(stderr.read().decode('utf-8'))

            stdin, stdout, stderr = client.exec_command("pm2 status")
            f.write("\n--- PM2 STATUS ---\n")
            f.write(stdout.read().decode('utf-8'))

        print("Logs saved to vps_logs_output.txt")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    check_logs()
