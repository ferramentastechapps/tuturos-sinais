#!/usr/bin/env python3
"""
Deploy do fix de sinais travados na memoria:
- signalEngine.ts: usa tradeTracker.getAllActiveSignals() em vez de array local
- scalpingEngine.ts: idem para scalping
"""
import subprocess
import sys
import os

VPS_HOST = "212.85.10.239"
VPS_USER = "root"
VPS_PASS = "F(W4f37Db)-kE'tM"
VPS_PATH = "/var/www/signal-dashboard"

try:
    import paramiko
    from scp import SCPClient
except ImportError:
    print("Instalando dependencias paramiko e scp...")
    subprocess.run([sys.executable, "-m", "pip", "install", "paramiko", "scp"], check=True)
    import paramiko
    from scp import SCPClient

def ssh_connect():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=30)
    return client

def ssh_exec(client, cmd, timeout=180):
    print(f"  [VPS] {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    rc  = stdout.channel.recv_exit_status()
    if out.strip(): print(out)
    if err.strip(): print(err, file=sys.stderr)
    return rc

print("=" * 50)
print("  DEPLOY: Fix Sinais Travados na Memoria")
print("=" * 50)

# ── 1. Build local do backend ──
print("\n[1/5] Build local do backend TypeScript...")
r = subprocess.run("npm run build", shell=True, cwd="backend")
if r.returncode != 0:
    print("ERRO no build do backend!")
    sys.exit(1)
print("✅ Build OK")

# ── 2. Conectar na VPS ──
print("\n[2/5] Conectando na VPS...")
client = ssh_connect()
scp    = SCPClient(client.get_transport())
print("✅ Conectado!")

# ── 3. Enviar backend compilado (dist) ──
print("\n[3/5] Enviando backend/dist para VPS...")
scp.put("backend/dist", recursive=True, remote_path=VPS_PATH + "/backend/")
print("✅ dist enviado")

# ── 4. Enviar arquivos TypeScript fonte alterados ──
print("\n[4/5] Enviando arquivos TypeScript fonte alterados...")
files_to_send = [
    ("backend/src/engine/signalEngine.ts",   f"{VPS_PATH}/backend/src/engine/signalEngine.ts"),
    ("backend/src/engine/scalpingEngine.ts", f"{VPS_PATH}/backend/src/engine/scalpingEngine.ts"),
]
for local, remote in files_to_send:
    remote_dir = os.path.dirname(remote)
    ssh_exec(client, f"mkdir -p {remote_dir}")
    scp.put(local, remote_path=remote)
    print(f"  ✅ {local}")

# ── 5. Reiniciar processos PM2 na VPS ──
print("\n[5/5] Reiniciando processos PM2 na VPS...")
restart_cmd = (
    f"cd {VPS_PATH}/backend && "
    "pm2 restart signal-engine --update-env 2>/dev/null || "
    "pm2 restart all --update-env; "
    "sleep 3; "
    "pm2 status"
)
rc = ssh_exec(client, restart_cmd)
if rc == 0:
    print("✅ PM2 reiniciado com sucesso!")
else:
    print("⚠️  Verifique os logs do PM2")

# ── Mostrar últimas linhas do log do signal-engine ──
print("\n── Últimas 20 linhas do log do signal-engine ──")
ssh_exec(client, "pm2 logs signal-engine --lines 20 --nostream 2>/dev/null || pm2 logs --lines 20 --nostream")

scp.close()
client.close()

print("\n" + "=" * 50)
print("  DEPLOY CONCLUIDO!")
print("=" * 50)
print("\nMonitore com:")
print(f"  ssh {VPS_USER}@{VPS_HOST} 'pm2 logs signal-engine --lines 50'")
