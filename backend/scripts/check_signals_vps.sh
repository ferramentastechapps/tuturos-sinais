#!/bin/bash

echo "🔍 Verificando sinais no banco da VPS..."
echo ""

ssh root@212.85.10.239 << 'EOF'
cd /root/tuturos-sinais/backend

# Usar node para executar query no banco
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('📊 Contagem por Status:');
    
    const activeCount = await prisma.tradeSignal.count({ where: { status: 'ACTIVE' } });
    const tpCount = await prisma.tradeSignal.count({ where: { status: 'CLOSED_TP' } });
    const slCount = await prisma.tradeSignal.count({ where: { status: 'CLOSED_SL' } });
    const totalCount = await prisma.tradeSignal.count();
    
    console.log('   ACTIVE:', activeCount);
    console.log('   CLOSED_TP (Win):', tpCount);
    console.log('   CLOSED_SL (Stop):', slCount);
    console.log('   TOTAL:', totalCount);
    console.log('');
    
    // Últimos 10 sinais
    const recent = await prisma.tradeSignal.findMany({
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        id: true,
        pair: true,
        type: true,
        status: true,
        created_at: true
      }
    });
    
    console.log('📋 Últimos 10 sinais:');
    if (recent.length === 0) {
      console.log('   ⚠️  Nenhum sinal encontrado!');
    } else {
      recent.forEach(s => {
        console.log(\`   \${s.id.substring(0,8)}... | \${s.pair} | \${s.type} | \${s.status} | \${new Date(s.created_at).toLocaleString()}\`);
      });
    }
    
    await prisma.\$disconnect();
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
})();
"
EOF
