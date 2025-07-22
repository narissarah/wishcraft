#!/usr/bin/env node
/**
 * Setup script to mark all migrations as applied for existing database
 */

const { execSync } = require('child_process');

const migrations = [
  '20250715114427_init',
  '20250715114428_performance_tracking',
  '20250715140000_add_performance_indexes',
  '20250715140001_fix_collaborative_schema',
  '20250715140002_add_missing_foreign_keys',
  '20250715140003_optimize_indexes',
  '20250716000000_fix_schema_drift',
  '20250720000000_encrypt_access_tokens',
  '20250720000001_add_critical_indexes',
  '20250720000002_fix_critical_schema_drift',
  '20250721000000_fix_critical_security_issues',
  '20250722000000_fix_session_constraint'
];

console.log('🔧 Marking all migrations as applied...\n');

for (const migration of migrations) {
  try {
    console.log(`Marking ${migration} as applied...`);
    execSync(`npx prisma migrate resolve --applied "${migration}"`, { stdio: 'inherit' });
    console.log(`✅ ${migration} marked as applied\n`);
  } catch (error) {
    console.error(`❌ Failed to mark ${migration} as applied`);
    console.error(error.message);
  }
}

console.log('✅ All migrations marked as applied!');