import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeDuplicates() {
  try {
    console.log('🧹 Iniciando limpeza de registros duplicados em MLTrainingData...');
    
    // Buscar todos os registros ordenados pelo mais recente
    const allRecords = await prisma.mLTrainingData.findMany({
      orderBy: { created_at: 'desc' }
    });
    
    console.log(`📊 Total de registros no banco: ${allRecords.length}`);
    
    const seenSignalIds = new Set();
    const idsToDelete = [];
    
    for (const record of allRecords) {
      if (record.signal_id) {
        if (seenSignalIds.has(record.signal_id)) {
          // Já vimos este signal_id (o mais recente foi mantido), então este é duplicado
          idsToDelete.push(record.id);
        } else {
          seenSignalIds.add(record.signal_id);
        }
      }
    }
    
    console.log(`🔍 Encontrados ${idsToDelete.length} registros duplicados para remoção.`);
    
    if (idsToDelete.length > 0) {
      // Deletar os duplicados em lotes para evitar problemas de limite com SQLite/Postgres
      const batchSize = 100;
      let deletedCount = 0;
      
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        const result = await prisma.mLTrainingData.deleteMany({
          where: {
            id: { in: batch }
          }
        });
        deletedCount += result.count;
      }
      
      console.log(`✅ Removidos com sucesso ${deletedCount} registros duplicados.`);
    } else {
      console.log('✨ Nenhum registro duplicado encontrado.');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

removeDuplicates();
