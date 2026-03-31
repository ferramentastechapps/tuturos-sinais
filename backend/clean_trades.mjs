import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function run() {
    try {
        console.log('Fetching trades...');
        
        // Obter os 50 trades mais recentes
        const tradesKept = await db.tradeSignal.findMany({
            orderBy: { created_at: 'desc' },
            take: 45, // Deixar menos de 50
            select: { id: true }
        });
        
        const idsToKeep = tradesKept.map(t => t.id);
        console.log(`Keeping ${idsToKeep.length} signals...`);
        
        // Deletar o resto do histórico e do rank de Machine Learning
        const { count: delML } = await db.mLTrainingData.deleteMany({
            where: { NOT: { signal_id: { in: idsToKeep } } }
        });
        console.log(`Deleted ${delML} ML training datasets.`);
        
        const { count: delEvents } = await db.signalEvent.deleteMany({
            where: { NOT: { signal_id: { in: idsToKeep } } }
        });
        console.log(`Deleted ${delEvents} Signal Events.`);
        
        const { count: delTrade } = await db.tradeSignal.deleteMany({
            where: { NOT: { id: { in: idsToKeep } } }
        });
        console.log(`Deleted ${delTrade} old Trade Signals.`);
        
        const { count: delActive } = await db.activeSignal.deleteMany({
            where: { NOT: { id: { in: idsToKeep } } }
        });
        console.log(`Deleted ${delActive} active/pending signals.`);
        
        console.log('Cleanup complete!');
    } catch (e) {
        console.error('Error during cleanup:', e);
    } finally {
        await db.$disconnect();
    }
}

run();
