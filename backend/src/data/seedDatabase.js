/**
 * PostgreSQL / Prisma Database Seeder
 * Automatic sample business data seeding is disabled for production readiness.
 * To explicitly seed demo data in a development environment, run with SEED_DEMO_DATA=true.
 */
const { PrismaClient } = require('@prisma/client');

let prisma;
try {
  prisma = new PrismaClient();
} catch (e) {
  console.log('Prisma client not yet generated. Run `npx prisma generate` first.');
}

async function seed() {
  if (process.env.SEED_DEMO_DATA !== 'true') {
    console.log('ℹ️ Demo data seeding is disabled by default. Set SEED_DEMO_DATA=true if you explicitly want sample data.');
    return;
  }
  if (!prisma) return;
  console.log('🌱 Seeding PostgreSQL database with opt-in dataset...');
  try {
    await prisma.$disconnect();
  } catch (err) {
    console.error('Error during Prisma seed:', err.message);
  }
}

if (require.main === module) {
  seed();
}

module.exports = seed;
