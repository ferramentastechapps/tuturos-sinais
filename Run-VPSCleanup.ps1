Write-Host "🔍 LIMPEZA DE MEMÓRIA - VPS" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

$VPS = "root@212.85.10.239"

Write-Host "Conectando ao VPS e executando limpeza..." -ForegroundColor Yellow
Write-Host ""

Get-Content vps_cleanup.sh | ssh $VPS "bash -s"

Write-Host ""
Write-Host "✅ Concluído!" -ForegroundColor Green
