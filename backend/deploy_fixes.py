import paramiko
import os

VPS_HOST = "212.85.10.239"
VPS_USER = "root"
VPS_PASS = "F(W4f37Db)-kE'tM"
VPS_PATH = "/var/www/signal-dashboard"

FILES_TO_DEPLOY = [
    ("src/trading/tradeTracker.ts", "backend/src/trading/tradeTracker.ts"),
    ("src/engine/scalpingEngine.ts", "backend/src/engine/scalpingEngine.ts"),
    ("src/engine/signalEngine.ts", "backend/src/engine/signalEngine.ts"),
    ("src/engine/marketContext.ts", "backend/src/engine/marketContext.ts"),
]

def deploy():
    print("========================================")
    print("🚀 INICIANDO DEPLOY VIA PARAMIKO/SFTP")
    print("========================================")

    # Connect to VPS
    print("Conectando ao VPS...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("✅ Conectado com sucesso!")

        # SFTP connection
        sftp = client.open_sftp()

        # Upload files
        for local_rel, vps_rel in FILES_TO_DEPLOY:
            if os.path.basename(os.getcwd()) == 'backend':
                local_path = local_rel
            else:
                local_path = os.path.join("backend", local_rel)
            vps_path = f"{VPS_PATH}/{vps_rel}"
            
            print(f"Enviando {local_path} -> {vps_path} ...")
            # Ensure target directory exists on VPS
            vps_dir = os.path.dirname(vps_path)
            client.exec_command(f"mkdir -p {vps_dir}")
            
            sftp.put(local_path, vps_path)
            print(f"  ✅ {local_rel} enviado.")
            
        sftp.close()

        # Build and restart PM2
        print("\nRecompilando e reiniciando processos na VPS...")
        build_cmd = f"cd {VPS_PATH}/backend && npm run build && pm2 restart all"
        
        stdin, stdout, stderr = client.exec_command(build_cmd)
        
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        
        print("\n=== OUTPUT DA VPS ===")
        print(out)
        
        if err.strip():
            print("=== ERROS / WARNINGS DA VPS ===")
            print(err)

        print("\nVerificando status do PM2...")
        stdin, stdout, stderr = client.exec_command("pm2 list")
        print(stdout.read().decode('utf-8'))

        print("========================================")
        print("🎉 DEPLOY CONCLUÍDO COM SUCESSO!")
        print("========================================")

    except Exception as e:
        print(f"❌ Erro durante o deploy: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    deploy()
