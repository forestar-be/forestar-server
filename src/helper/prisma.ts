import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['query', 'info', 'warn', 'error'],
  errorFormat: 'pretty',
  transactionOptions: {
    maxWait: 60000,
    timeout: 120000,
  },
});

export default prisma;
