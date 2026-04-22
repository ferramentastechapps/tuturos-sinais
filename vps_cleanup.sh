#!/bin/bash

echo '📊 1. USO ATUAL DE MEMÓRIA'
echo '-------------------------'
free -h
echo ''

echo '📈 2. TOP 10 PROCESSOS (por memória)'
echo '------------------------------------'
ps aux --sort=-%mem | head -11
echo ''

echo '💾 3. USO DE DISCO'
echo '-----------------'
df -h /
echo ''

echo '🔄 4. PROCESSOS PM2'
echo '------------------'
pm2 list
echo ''

echo '🧹 INICIANDO LIMPEZA...'
echo '======================='
echo ''

# Limpar cache npm
echo '🗑️  Limpando cache do npm...'
npm cache clean --force 2>/dev/null || echo 'Sem cache npm'

# Limpar logs PM2
echo '🗑️  Limpando logs do PM2...'
pm2 flush

# Limpar arquivos temporários
echo '🗑️  Limpando arquivos temporários...'
rm -rf /tmp/* 2>/dev/null || true
find /var/tmp -type f -mtime +7 -delete 2>/dev/null || true

# Limpar logs antigos
echo '🗑️  Limpando logs antigos...'
journalctl --vacuum-time=3d 2>/dev/null || true

# Limpar cache apt
echo '🗑️  Limpando cache do apt...'
apt-get clean 2>/dev/null || true
apt-get autoclean 2>/dev/null || true

# Limpar logs de aplicação antigos
echo '🗑️  Limpando logs de aplicação...'
find /root/.pm2/logs -type f -name "*.log" -mtime +7 -delete 2>/dev/null || true

echo ''
echo '♻️  Reiniciando processos PM2...'
pm2 restart all

echo ''
echo '✅ LIMPEZA CONCLUÍDA'
echo ''

echo '📊 MEMÓRIA APÓS LIMPEZA'
echo '----------------------'
free -h
echo ''

echo '💡 RECOMENDAÇÕES:'
echo '- Se memória continuar alta, considere aumentar o plano do VPS'
echo '- Configure swap se necessário'
echo '- Monitore logs: pm2 logs --lines 100'
