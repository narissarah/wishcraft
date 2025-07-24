#!/usr/bin/env node

// Railway startup wrapper to handle environment validation properly

console.log('🚀 Railway Startup Wrapper - WishCraft');

// Set Railway-specific defaults
process.env.HOST = process.env.HOST || '0.0.0.0';
process.env.PORT = process.env.PORT || '3000';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Enhanced environment variable validation for Railway deployment
const requiredEnvVars = [
  'DATABASE_URL',
  'SHOPIFY_API_KEY', 
  'SHOPIFY_API_SECRET',
  'SHOPIFY_APP_URL',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
  'SHOPIFY_WEBHOOK_SECRET'  // Added based on audit findings
];

// Check for SHOPIFY_SCOPES (optional but recommended)
if (!process.env.SHOPIFY_SCOPES) {
  console.log('⚠️  SHOPIFY_SCOPES not set, using default scopes from code');
}

const recommendedEnvVars = [
  'DATA_ENCRYPTION_KEY',
  'DATA_ENCRYPTION_SALT', 
  'SEARCH_HASH_KEY',
  'COLLABORATION_TOKEN_SECRET',
  'REDIS_URL',
  'SENTRY_DSN'
];

// Railway-specific environment checks
const railwayVars = ['RAILWAY_DEPLOYMENT_ID', 'RAILWAY_ENVIRONMENT', 'RAILWAY_PROJECT_NAME'];
const railwayDetected = railwayVars.some(v => process.env[v]);

if (railwayDetected) {
  console.log('🚂 Railway deployment detected');
  console.log(`📍 Environment: ${process.env.RAILWAY_ENVIRONMENT || 'unknown'}`); 
  console.log(`🆔 Deployment: ${process.env.RAILWAY_DEPLOYMENT_ID || 'unknown'}`);
}

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

// Use dynamic import to start server
(async () => {
  try {
    await import('./server.js');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})();