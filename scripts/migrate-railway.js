#!/usr/bin/env node

// Script to migrate Railway database to latest schema
import { execSync } from 'child_process';

console.log('🚀 Starting Railway database migration...');
console.log('📊 This will update your database schema to match the latest changes');

try {
  // First, generate Prisma client
  console.log('\n1️⃣ Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // Show current migration status
  console.log('\n2️⃣ Checking migration status...');
  try {
    execSync('npx prisma migrate status', { stdio: 'inherit' });
  } catch (e) {
    console.log('⚠️  Migration status check failed (this is normal for first run)');
  }

  // Push schema changes to database
  console.log('\n3️⃣ Pushing schema changes to database...');
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });

  // Verify the update
  console.log('\n4️⃣ Verifying database schema...');
  execSync('npx prisma db pull', { stdio: 'inherit' });

  console.log('\n✅ Database migration completed successfully!');
  console.log('🎉 Your Railway PostgreSQL is now up to date with the latest schema');

} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error('\n💡 Make sure you have:');
  console.error('   - DATABASE_URL environment variable set');
  console.error('   - Valid connection to Railway PostgreSQL');
  console.error('   - Proper permissions to modify the database');
  process.exit(1);
}