import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function run() {
  const count = await db.tradeSignal.count();
  console.log(`Total tradeSignal records: ${count}`);

  const withNumber = await db.tradeSignal.count({
    where: { signal_number: { not: null } }
  });
  console.log(`tradeSignal with signal_number: ${withNumber}`);

  const sample = await db.tradeSignal.findMany({
    take: 5,
    orderBy: { created_at: 'desc' }
  });
  console.log('Sample tradeSignal records:', sample.map(s => ({
    id: s.id,
    pair: s.pair,
    signal_number: s.signal_number,
    indicators: s.indicators,
    status: s.status
  })));

  const activeCount = await db.activeSignal.count();
  console.log(`Total activeSignal records: ${activeCount}`);

  const activeSample = await db.activeSignal.findMany({
    take: 5,
    orderBy: { created_at: 'desc' }
  });
  console.log('Sample activeSignal records:', activeSample.map(s => ({
    id: s.id,
    pair: s.pair,
    signal_number: s.signal_number,
    status: s.status
  })));

  await db.$disconnect();
}

run();
