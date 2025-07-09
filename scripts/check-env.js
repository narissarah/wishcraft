#!/usr/bin/env node
// Environment variable checker for WishCraft

const requiredEnvVars = [
  'DATABASE_URL',
  'SHOPIFY_API_KEY', 
  'SHOPIFY_API_SECRET',
  'SCOPES',
  'HOST'
];

const optionalEnvVars = [
  'PORT',
  'NODE_ENV',
  'SHOPIFY_APP_URL',
  'ENCRYPTION_KEY',
  'SESSION_SECRET'
];

console.log('🔍 Checking environment variables for WishCraft...\n');

// Check required variables
console.log('Required Environment Variables:');
let missingRequired = false;
requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`✅ ${varName}: Set`);
  } else {
    console.log(`❌ ${varName}: Missing`);
    missingRequired = true;
  }
});

console.log('\nOptional Environment Variables:');
optionalEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`✅ ${varName}: Set`);
  } else {
    console.log(`⚠️  ${varName}: Not set (using defaults)`);
  }
});

// Special checks
console.log('\nSpecial Checks:');

// Check DATABASE_URL format
if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    console.log('✅ DATABASE_URL format: Valid PostgreSQL URL');
  } else {
    console.log('❌ DATABASE_URL format: Invalid (must be postgresql:// or postgres://)');
    missingRequired = true;
  }
}

// Check PORT
const port = process.env.PORT || '3000';
console.log(`ℹ️  PORT: ${port}`);

// Check NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'development';
console.log(`ℹ️  NODE_ENV: ${nodeEnv}`);

if (missingRequired) {
  console.log('\n❌ Missing required environment variables!');
  console.log('Please set all required variables before deploying.');
  process.exit(1);
} else {
  console.log('\n✅ All required environment variables are set!');
  process.exit(0);
}