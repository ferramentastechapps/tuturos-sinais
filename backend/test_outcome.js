const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const data = await prisma.tradeSignal.findMany({
        where: { outcome: { not: null } },
        select: { id: true, outcome: true, ml_data: true },
        take: 5
    });
    console.log("Outcome not null:", data.length);
    if (data.length > 0) {
        console.log(data);
    }
}

main().finally(() => prisma.$disconnect());
