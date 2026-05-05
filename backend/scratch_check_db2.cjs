const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const signals = await prisma.tradeSignal.findMany({
        orderBy: { exit_time: 'desc' },
        take: 5,
        select: { id: true, pair: true, ml_data: true, indicators: true }
    });
    console.log(JSON.stringify(signals, null, 2));
}

main()
    .then(() => prisma.$disconnect())
    .catch(e => { console.error(e); prisma.$disconnect(); });
