#!/bin/bash

echo "🔍 DIAGNÓSTICO DE MEMÓRIA - VPS"
echo "================================"
echo ""

ssh root@212.85.10.239 << 'EOF'

echo "📊 1. USO ATUAL DE MEMÓRIA"
echo "-------------------------"
free -h
echo ""

echo "📈 2. TOP 10 PROCESSOS (por memória)"
echo "------------------------------------"
ps aux --sort=-%mem | head -11
echo ""

echo "💾 3. USO DE DISCO"
echo "-----------------"
df -h
echo ""

echo "🔄 4. PROCESSOS PM2"
echo "------------------"
pm2 list
echo ""

echo "📝 5. LOGS PM2 (últimas 50 linhas)"
echo "----------------------------------"
pm2 logs --lines 50 --nostream
echo ""

echo "🧹 LIMPEZA AUTOMÁTICA"
echo "====================="
echo ""

echo "🗑️  Limpando cache do npm..."
npm cache clean --force 2>/dev/null || echo "Sem cache npm para limpar"

echo "🗑️  Limpando logs antigos do PM2..."
pm2 flush

echo "🗑️  Limpando arquivos temporários..."
rm -rf /tmp/* 2>/dev/null || true
rm -rf /var/tmp/* 2>/dev/null || true

echo "🗑️  Limpando logs do sistema..."
journalctl --vacuum-time=2d 2>/dev/null || true

echo "🗑️  Limpando cache do apt..."
apt-get clean 2>/dev/null || true

echo ""
echo "♻️  REINICIANDO PROCESSOS PM2"
echo "=============================="
pm2 restart all

echo ""
echo "✅ LIMPEZA CONCLUÍDA"
echo ""

echo "📊 MEMÓRIA APÓS LIMPEZA"
echo "----------------------"
free -h

EOF

echo ""
echo "✅ Script executado com sucesso!"
