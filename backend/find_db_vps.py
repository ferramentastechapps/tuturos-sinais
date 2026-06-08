import paramiko

VPS_HOST = "212.85.10.239"
VPS_USER = "root"
VPS_PASS = "F(W4f37Db)-kE'tM"

def run_ssh_cmd(cmd):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=10)
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        print(f"COMMAND: {cmd}")
        print(f"STDOUT:\n{out}")
        if err:
            print(f"STDERR:\n{err}")
    except Exception as e:
        print(f"Error executing command: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    run_ssh_cmd('find /var/www/signal-dashboard -name "*.db"')
    run_ssh_cmd('find /root/tuturos-sinais -name "*.db"')
