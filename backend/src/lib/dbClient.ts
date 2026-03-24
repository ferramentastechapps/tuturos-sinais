import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

logger.info('[Database] Conexão Prisma instanciada (SQLite).');
