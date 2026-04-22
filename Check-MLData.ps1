$VPS = "root@212.85.10.239"

Write-Host "Verificando dados de treinamento ML..." -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Processos PM2:" -ForegroundColor Yellow
ssh $VPS "pm2 list"
Write-Host ""

Write-Host "2. Scripts de treinamento:" -ForegroundColor Yellow
ssh $VPS "ls -lh /root/tuturos-sinais/backend/scripts/ | grep -E 'train|ml'"
Write-Host ""

Write-Host "3. Logs recentes do signal-engine:" -ForegroundColor Yellow
ssh $VPS "pm2 logs signal-engine --lines 30 --nostream"
Write-Host ""

Write-Host "4. Cron jobs:" -ForegroundColor Yellow
ssh $VPS "crontab -l 2>/dev/null"
Write-Host ""

Write-Host "Concluido!" -ForegroundColor Green
