import dotenv from 'dotenv';
import path from 'path';

process.env.DATABASE_URL = 'file:c:/Users/jotas/tuturos-sinais/tuturos-sinais/backend/dev.db';

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function run() {
  console.log('--- RECENT SIGNALS IN DB (backend/dev.db) ---');
  
  const totalSignals = await db.tradeSignal.count();
  console.log(`Total tradeSignal records: ${totalSignals}`);
  
  const recentSignals = await db.tradeSignal.findMany({
    take: 10,
    orderBy: { created_at: 'desc' }
  });
  
  for (const s of recentSignals) {
    console.log(`- ID: ${s.id}, Symbol: ${s.pair}, Type: ${s.trade_type}, Status: ${s.status}, CreatedAt: ${s.created_at.toISOString()}`);
  }

  const totalTraining = await db.mLTrainingData.count();
  console.log(`Total mLTrainingData records: ${totalTraining}`);
  
  const recentTraining = await db.mLTrainingData.findMany({
    take: 10,
    orderBy: { created_at: 'desc' }
  });
  
  for (const t of recentTraining) {
    console.log(`- ID: ${t.id}, Symbol: ${t.symbol}, Type: ${t.trade_type}, CreatedAt: ${t.created_at.toISOString()}`);
  }

  await db.$disconnect();
}

run();
