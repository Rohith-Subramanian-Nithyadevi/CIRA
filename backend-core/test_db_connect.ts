import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
  console.log('Testing connection to DATABASE_URL...');
  try {
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    console.log('Database connection SUCCESS:', result);
  } catch (error: any) {
    console.error('Database connection FAILED:');
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
