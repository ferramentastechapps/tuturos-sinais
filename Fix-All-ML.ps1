# Script completo para corrigir sistema de treinamento ML

$VPS = "root@212.85.10.239"

Write-Host "Corrigindo Sistema de Treinamento ML..." -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Corrigindo dependencias Python..." -ForegroundColor Yellow
ssh $VPS "pip3 install --upgrade onnx==1.15.0 skl2onnx==1.16.0 onnxruntime"
Write-Host ""

Write-Host "2. Corrigindo banco de dados Prisma..." -ForegroundColor Yellow
ssh $VPS "cd /var/www/signal-dashboard/backend && npx prisma generate && npx prisma migrate deploy"
Write-Host ""

Write-Host "3. Atualizando cron job..." -ForegroundColor Yellow
ssh $VPS @"
(crontab -l 2>/dev/null | grep -v 'train_model.py'; echo '0 3 * * 0 /var/www/signal-dashboard/backend/scripts/train_super_robot.sh >> /var/log/train_super_robot.log 2>&1') | crontab -
"@
Write-Host ""

Write-Host "4. Reiniciando signal-engine..." -ForegroundColor Yellow
ssh $VPS "pm2 restart signal-engine"
Write-Host ""

Write-Host "5. Verificando dados de treinamento..." -ForegroundColor Yellow
ssh $VPS "cd /var/www/signal-dashboard/backend/scripts && node check_ml_simple.mjs"
Write-Host ""

Write-Host "6. Testando migracao (dry-run)..." -ForegroundColor Yellow
ssh $VPS "cd /var/www/signal-dashboard/backend/scripts && python3 migrate_historical_to_training.py --dry-run"
Write-Host ""

Write-Host "Concluido!" -ForegroundColor Green
Write-Host ""
Write-Host "Proximo passo: Executar treinamento manual" -ForegroundColor Cyan
Write-Host "  ssh $VPS" -ForegroundColor Gray
Write-Host "  cd /var/www/signal-dashboard/backend/scripts" -ForegroundColor Gray
Write-Host "  bash train_super_robot.sh" -ForegroundColor Gray
