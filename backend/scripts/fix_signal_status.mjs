import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixStatuses() {
  try {
    console.log('🔧 Corrigindo status dos sinais...\n');

    // Mapear status antigos para novos
    const statusMap = {
      'pending': 'PENDING',
      'active': 'ACTIVE',
      'hit_tp': 'CLOSED_TP',
      'hit_sl': 'CLOSED_SL',
      'cancelled': 'CANCELLED'
    };

    // Atualizar active_signals
    console.log('📝 Atualizando active_signals...');
    for (const [oldStatus, newStatus] of Object.entries(statusMap)) {
      const result = await prisma.$executeRaw`
        UPDATE active_signals 
        SET status = ${newStatus}
        WHERE status = ${oldStatus}
      `;
      if (result > 0) {
        console.log(`   ${oldStatus} → ${newStatus}: ${result} sinais`);
      }
    }

    // Atualizar trade_signals
    console.log('\n📝 Atualizando trade_signals...');
    for (const [oldStatus, newStatus] of Object.entries(statusMap)) {
      const result = await prisma.$executeRaw`
        UPDATE trade_signals 
        SET status = ${newStatus}
        WHERE status = ${oldStatus}
      `;
      if (result > 0) {
        console.log(`   ${oldStatus} → ${newStatus}: ${result} sinais`);
      }
    }

    // Verificar resultado
    console.log('\n✅ Verificando resultado...');
    const activeCount = await prisma.activeSignal.count({ where: { status: 'ACTIVE' } });
    const pendingCount = await prisma.activeSignal.count({ where: { status: 'PENDING' } });
    const tpCount = await prisma.tradeSignal.count({ where: { status: 'CLOSED_TP' } });
    const slCount = await prisma.tradeSignal.count({ where: { status: 'CLOSED_SL' } });

    console.log(`   ACTIVE: ${activeCount}`);
    console.log(`   PENDING: ${pendingCount}`);
    console.log(`   CLOSED_TP: ${tpCount}`);
    console.log(`   CLOSED_SL: ${slCount}`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixStatuses();
