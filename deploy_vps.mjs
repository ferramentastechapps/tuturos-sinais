// Deploy ML Analytics fix to VPS using node-ssh
import { execSync, exec } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const VPS_HOST = '212.85.10.239';
const VPS_USER = 'root';
const VPS_PASS = "F(W4f37Db)-kE'tM";
const VPS_BACKEND = '/root/tuturos-sinais/backend';
const VPS_FRONTEND = '/var/www/signal-dashboard';

// Install node-ssh if needed
try {
    await import('node-ssh');
} catch {
    console.log('Instalando node-ssh...');
    execSync('npm install node-ssh', { stdio: 'inherit' });
}

const { NodeSSH } = await import('node-ssh');

console.log('🚀 Deploy ML Analytics Fix');
console.log('='.repeat(40));

// 1. Build backend
console.log('\n📦 [1/4] Build do backend...');
try {
    execSync('npm run build', { cwd: 'backend', stdio: 'inherit' });
    console.log('✅ Backend build OK');
} catch (e) {
    console.error('❌ Erro no build do backend!');
    process.exit(1);
}

// 2. Conectar na VPS
console.log('\n🔌 [2/4] Conectando na VPS...');
const ssh = new NodeSSH();
await ssh.connect({
    host: VPS_HOST,
    username: VPS_USER,
    password: VPS_PASS,
    readyTimeout: 30000,
});
console.log('✅ Conectado!');

// 3. Enviar backend dist
console.log('\n📤 [3/4] Enviando backend compilado...');
await ssh.putDirectory('backend/dist', `${VPS_BACKEND}/dist`, {
    recursive: true,
    concurrency: 5,
    tick(localPath, remotePath, error) {
        if (error) console.error(`  ❌ ${localPath}`);
    }
});
console.log('✅ Backend enviado');

// 4. Restart
console.log('\n♻️  Reiniciando backend na VPS...');
const result = await ssh.execCommand('pm2 restart signal-engine && sleep 2 && pm2 logs signal-engine --lines 8 --nostream', {
    cwd: VPS_BACKEND
});
if (result.stdout) console.log(result.stdout);
if (result.stderr) console.error(result.stderr);
console.log('✅ Backend reiniciado!');

// 5. Verificar onde fica o frontend
console.log('\n🌐 [4/4] Enviando frontend...');
const lsResult = await ssh.execCommand(`ls ${VPS_FRONTEND} 2>/dev/null && echo EXISTS || echo NOTFOUND`);
const frontendPath = lsResult.stdout.includes('EXISTS') ? VPS_FRONTEND : '/var/www/html';

await ssh.putDirectory('dist', frontendPath, {
    recursive: true,
    concurrency: 10,
    tick(localPath, remotePath, error) {
        if (error) console.error(`  ❌ ${localPath}`);
    }
});
console.log(`✅ Frontend enviado para ${frontendPath}`);

ssh.dispose();

console.log('\n✅ Deploy concluído!');
console.log('🔗 https://sinaiscripto.ftech-apps.com.br/ml-analytics');
