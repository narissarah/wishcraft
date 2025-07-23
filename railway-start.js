#!/usr/bin/env node

// Railway startup wrapper to handle environment validation properly

console.log('🚀 Railway Startup Wrapper - WishCraft');

// Set Railway-specific defaults
process.env.HOST = process.env.HOST || '0.0.0.0';
process.env.PORT = process.env.PORT || '3000';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Comprehensive environment variable validation
const requiredEnvVars = [
  'DATABASE_URL',
  'SHOPIFY_API_KEY', 
  'SHOPIFY_API_SECRET',
  'SHOPIFY_APP_URL',
  'SESSION_SECRET',
  'ENCRYPTION_KEY'
];

const recommendedEnvVars = [
  'DATA_ENCRYPTION_KEY',
  'DATA_ENCRYPTION_SALT',
  'SEARCH_HASH_KEY',
  'COLLABORATION_TOKEN_SECRET'
];

const missing = requiredEnvVars.filter(v => !process.env[v]);
const missingRecommended = recommendedEnvVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error(`❌ CRITICAL: Missing required environment variables: ${missing.join(', ')}`);
  console.error('⚠️  This may cause runtime errors. Please set these variables.');
  if (process.env.NODE_ENV === 'production') {
    console.error('🛑 Exiting in production mode due to missing critical variables');
    process.exit(1);
  }
  console.log('⚠️  Continuing in development mode...');
}

if (missingRecommended.length > 0) {
  console.log(`⚠️  Missing recommended environment variables: ${missingRecommended.join(', ')}`);
  console.log('⚠️  Some security features may be degraded');
}

// Validate key lengths for security
const keyValidations = [
  { name: 'SESSION_SECRET', minLength: 32 },
  { name: 'ENCRYPTION_KEY', minLength: 32 },
  { name: 'DATA_ENCRYPTION_KEY', minLength: 32 },
  { name: 'SEARCH_HASH_KEY', minLength: 32 }
];

keyValidations.forEach(({ name, minLength }) => {
  const value = process.env[name];
  if (value && value.length < minLength) {
    console.error(`❌ SECURITY: ${name} is too short (${value.length} chars, need ${minLength}+)`);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
});

console.log('✅ Environment validation complete');

// Apply database migrations if needed
if (process.env.DATABASE_URL) {
  console.log('📦 Checking database migrations...');
  const { execSync } = require('child_process');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('✅ Database migrations applied');
  } catch (error) {
    console.error('⚠️  Migration failed, continuing anyway:', error.message);
  }
}

// Start the actual server
console.log('🚀 Starting main server...');
import('./server.js');