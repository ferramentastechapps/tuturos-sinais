#!/bin/bash

echo "🔍 VERIFICANDO STATUS NO VPS"
echo "============================================================"
echo ""

# Conectar ao VPS e verificar status
ssh root@185.211.6.46 << 'ENDSSH'

echo "📊 STATUS DOS PROCESSOS PM2:"
echo ""
pm2 list

echo ""
echo "============================================================"
echo ""
echo "📝 ÚLTIMAS 100 LINHAS DE LOG:"
echo ""
pm2 logs --lines 100 --nostream

echo ""
echo "============================================================"
echo ""
echo "💾 USO DE MEMÓRIA:"
echo ""
free -h

echo ""
echo "============================================================"
echo ""
echo "💿 USO DE DISCO:"
echo ""
df -h /

echo ""
echo "============================================================"
echo ""
echo "🔄 PROCESSOS NODE RODANDO:"
echo ""
ps aux | grep node | grep -v grep

ENDSSH

echo ""
echo "✅ Verificação concluída!"
