#!/usr/bin/env python3
"""Deploy ML Analytics fix to VPS using paramiko."""
import subprocess
import sys
import os

VPS_HOST = "212.85.10.239"
VPS_USER = "root"
VPS_PASS = "F(W4f37Db)-kE'tM"
VPS_BACKEND = "/root/tuturos-sinais/backend"
VPS_FRONTEND = "/var/www/signal-dashboard"

def run(cmd, cwd=None):
    print(f"  $ {cmd}")
    r = subprocess.run(cmd, shell=True, cwd=cwd)
    return r.returncode == 0

try:
    import paramiko
    from scp import SCPClient
except ImportError:
    print("Instalando dependências...")
    subprocess.run([sys.executable, "-m", "pip", "install", "paramiko", "scp"], check=True)
    import paramiko
    from scp import SCPClient

def ssh_connect():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=30)
    return client

def ssh_exec(client, cmd):
    print(f"  [VPS] {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out: print(out)
    if err: print(err, file=sys.stderr)
    return stdout.channel.recv_exit_status()

print("🚀 Deploy ML Analytics Fix")
print("=" * 40)

# 1. Build backend local
print("\n📦 [1/4] Build do backend...")
if not run("npm run build", cwd="backend"):
    print("❌ Erro no build do backend!")
    sys.exit(1)
print("✅ Backend build OK")

# 2. Conectar na VPS
print("\n🔌 [2/4] Conectando na VPS...")
client = ssh_connect()
scp = SCPClient(client.get_transport())
print("✅ Conectado!")

# 3. Enviar arquivo api.ts compilado (dist)
print("\n📤 [3/4] Enviando backend compilado para VPS...")
# Enviar o dist do backend
scp.put("backend/dist", recursive=True, remote_path=VPS_BACKEND + "/")
print("✅ Backend enviado")

# 4. Restart backend na VPS
print("\n♻️  Reiniciando backend na VPS...")
code = ssh_exec(client, f"cd {VPS_BACKEND} && pm2 restart signal-engine && pm2 logs signal-engine --lines 5 --nostream")
if code == 0:
    print("✅ Backend reiniciado!")
else:
    print("⚠️  Verifique os logs do pm2")

# 5. Enviar frontend
print("\n🌐 [4/4] Enviando frontend para VPS...")
# Verificar onde fica o frontend
code2 = ssh_exec(client, f"ls {VPS_FRONTEND} 2>/dev/null || ls /var/www/ 2>/dev/null")
scp.put("dist", recursive=True, remote_path=VPS_FRONTEND + "/")
print("✅ Frontend enviado!")

scp.close()
client.close()

print("\n✅ Deploy concluído!")
print("🔗 https://sinaiscripto.ftech-apps.com.br/ml-analytics")
