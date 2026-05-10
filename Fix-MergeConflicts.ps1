#!/usr/bin/env pwsh
# Fix-MergeConflicts.ps1 - Resolve conflitos de merge automaticamente

Write-Host "`nResolvendo conflitos de merge..." -ForegroundColor Cyan

$conflictFile = "backend\src\server\api.ts"

if (Test-Path $conflictFile) {
    Write-Host "Encontrado conflito em: $conflictFile" -ForegroundColor Yellow
    
    # Ler o arquivo
    $content = Get-Content $conflictFile -Raw
    
    # Verificar se tem conflitos
    if ($content -match '<<<<<<<|=======|>>>>>>>') {
        Write-Host "Resolvendo conflitos automaticamente (mantendo HEAD)..." -ForegroundColor Yellow
        
        # Remover marcadores de conflito mantendo a versão HEAD
        $content = $content -replace '(?ms)<<<<<<< HEAD\r?\n(.*?)\r?\n=======\r?\n.*?\r?\n>>>>>>> [^\r\n]+\r?\n', '$1'
        
        # Salvar arquivo corrigido
        $content | Set-Content $conflictFile -NoNewline
        
        Write-Host "Conflitos resolvidos!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Agora execute novamente:" -ForegroundColor Yellow
        Write-Host "  .\Deploy-AllFixes.ps1" -ForegroundColor White
    } else {
        Write-Host "Nenhum conflito encontrado no arquivo." -ForegroundColor Green
    }
} else {
    Write-Host "Arquivo nao encontrado: $conflictFile" -ForegroundColor Red
}

Write-Host ""
