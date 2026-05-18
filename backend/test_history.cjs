const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const history = await prisma.tradeSignal.findMany({
        where: { outcome: { not: null } },
        orderBy: { exit_time: 'desc' },
        take: 5,
        select: { id: true, pair: true, status: true, exit_time: true, ml_data: true }
    });
    console.log(JSON.stringify(history, null, 2));
}

main().finally(() => prisma.$disconnect());
