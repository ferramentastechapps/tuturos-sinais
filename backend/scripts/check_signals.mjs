import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSignals() {
  try {
    console.log('🔍 Verificando sinais no banco...\n');

    // Contar sinais por status
    const activeCount = await prisma.tradeSignal.count({ where: { status: 'ACTIVE' } });
    const tpCount = await prisma.tradeSignal.count({ where: { status: 'CLOSED_TP' } });
    const slCount = await prisma.tradeSignal.count({ where: { status: 'CLOSED_SL' } });
    const totalCount = await prisma.tradeSignal.count();

    console.log('📊 Contagem por Status:');
    console.log(`   ACTIVE: ${activeCount}`);
    console.log(`   CLOSED_TP (Win): ${tpCount}`);
    console.log(`   CLOSED_SL (Stop): ${slCount}`);
    console.log(`   TOTAL: ${totalCount}\n`);

    // Buscar últimos 5 sinais
    const recentSignals = await prisma.tradeSignal.findMany({
      orderBy: { created_at: 'desc' },
      take: 5,
      select: {
        id: true,
        pair: true,
        type: true,
        status: true,
        entry: true,
        created_at: true,
      }
    });

    console.log('📋 Últimos 5 sinais:');
    if (recentSignals.length === 0) {
      console.log('   ⚠️  Nenhum sinal encontrado no banco!');
    } else {
      recentSignals.forEach(s => {
        console.log(`   ${s.id} | ${s.pair} | ${s.type} | ${s.status} | ${s.created_at}`);
      });
    }

    // Verificar se há sinais com status diferente dos esperados
    const allStatuses = await prisma.$queryRaw`
      SELECT DISTINCT status FROM trade_signals ORDER BY status
    `;
    console.log('\n🏷️  Status únicos encontrados:', allStatuses);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSignals();
