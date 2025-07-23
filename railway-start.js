#!/usr/bin/env node

// Railway startup wrapper to handle environment validation properly

console.log('🚀 Railway Startup Wrapper - WishCraft');

// Set Railway-specific defaults
process.env.HOST = process.env.HOST || '0.0.0.0';
process.env.PORT = process.env.PORT || '3000';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Check for critical environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'SHOPIFY_API_KEY', 
  'SHOPIFY_API_SECRET',
  'SESSION_SECRET'
];

const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error(`⚠️  Warning: Missing environment variables: ${missing.join(', ')}`);
  console.log('⚠️  Continuing anyway for Railway deployment...');
}

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