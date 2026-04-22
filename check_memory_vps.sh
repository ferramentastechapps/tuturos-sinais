#!/bin/bash

echo "🔍 Verificando memória no VPS principal (212.85.10.239)"
echo "========================================================"
echo ""

ssh root@212.85.10.239 << 'EOF'

echo "📊 MEMÓRIA ATUAL"
free -h
echo ""

echo "📈 TOP 10 PROCESSOS"
ps aux --sort=-%mem | head -11
echo ""

echo "🔄 STATUS PM2"
pm2 list
echo ""

echo "💾 DISCO"
df -h /
echo ""

EOF
