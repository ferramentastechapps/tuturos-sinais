# Configura limpeza automática de memória no VPS
# Executa limpeza toda segunda-feira às 3h da manhã

$VPS = "root@212.85.10.239"

Write-Host "⚙️  CONFIGURANDO LIMPEZA AUTOMÁTICA" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Criando script de limpeza no VPS..." -ForegroundColor Yellow

ssh $VPS @"
cat > /root/cleanup_memory.sh << 'SCRIPT'
#!/bin/bash
# Script de limpeza automática de memória
# Executado via cron toda segunda-feira às 3h

echo "[$(date)] Iniciando limpeza automática..."

# Limpar cache npm
npm cache clean --force 2>/dev/null

# Limpar logs PM2
pm2 flush

# Limpar arquivos temporários
rm -rf /tmp/* 2>/dev/null
find /var/tmp -type f -mtime +7 -delete 2>/dev/null

# Limpar logs antigos
journalctl --vacuum-time=7d 2>/dev/null

# Limpar cache apt
apt-get clean 2>/dev/null
apt-get autoclean 2>/dev/null

# Limpar logs de aplicação antigos (>7 dias)
find /root/.pm2/logs -type f -name '*.log' -mtime +7 -delete 2>/dev/null

# Reiniciar processos PM2
pm2 restart all

echo "[$(date)] Limpeza concluída!"
echo "Memória após limpeza:"
free -h
SCRIPT

chmod +x /root/cleanup_memory.sh
echo "✅ Script criado em /root/cleanup_memory.sh"
"@

Write-Host ""
Write-Host "Configurando cron job..." -ForegroundColor Yellow

ssh $VPS @"
# Adicionar ao crontab (toda segunda-feira às 3h)
(crontab -l 2>/dev/null | grep -v cleanup_memory.sh; echo '0 3 * * 1 /root/cleanup_memory.sh >> /var/log/cleanup_memory.log 2>&1') | crontab -
echo "✅ Cron job configurado"
"@

Write-Host ""
Write-Host "Verificando configuração..." -ForegroundColor Yellow
ssh $VPS "crontab -l | grep cleanup_memory"

Write-Host ""
Write-Host "✅ Configuração concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "📅 Limpeza automática configurada para:" -ForegroundColor Cyan
Write-Host "   - Toda segunda-feira às 3h da manhã" -ForegroundColor Gray
Write-Host "   - Logs salvos em: /var/log/cleanup_memory.log" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Para testar agora:" -ForegroundColor Cyan
Write-Host "   ssh $VPS '/root/cleanup_memory.sh'" -ForegroundColor Gray
