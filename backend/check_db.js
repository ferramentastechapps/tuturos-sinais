import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const activeSignals = await prisma.activeSignal.findMany({
        where: { status: { in: ['ACTIVE', 'PENDING'] } }
    });

    const counts = {};
    for (const sig of activeSignals) {
        counts[sig.pair] = (counts[sig.pair] || 0) + 1;
    }

    console.log('Active signals per pair:');
    for (const pair in counts) {
        console.log(`${pair}: ${counts[pair]}`);
    }

    const stxSignals = activeSignals.filter(s => s.pair === 'STXUSDT');
    if (stxSignals.length > 0) {
        console.log(`\nFound ${stxSignals.length} STXUSDT signals! IDs:`);
        stxSignals.forEach(s => console.log(s.id));
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
