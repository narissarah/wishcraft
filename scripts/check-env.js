#!/usr/bin/env node

/**
 * Environment Variable Checker
 * Validates that all required environment variables are present
 */

const requiredVars = [
  'DATABASE_URL',
  'SHOPIFY_API_KEY', 
  'SHOPIFY_API_SECRET',
  'SHOPIFY_APP_URL',
  'SESSION_SECRET'
];

const optionalVars = [
  'SHOPIFY_WEBHOOK_SECRET',
  'SHOPIFY_API_VERSION',
  'SCOPES',
  'NODE_ENV'
];

console.log('🔍 Checking environment variables...\n');

let missingVars = [];
let warningVars = [];

// Check required variables
requiredVars.forEach(varName => {
  if (!process.env[varName]) {
    missingVars.push(varName);
  } else {
    console.log(`✅ ${varName}: Set`);
  }
});

// Check optional but recommended variables
optionalVars.forEach(varName => {
  if (!process.env[varName]) {
    warningVars.push(varName);
  } else {
    console.log(`✅ ${varName}: Set`);
  }
});

// Check DATABASE_URL format
if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl.includes('sslmode=require')) {
    console.log('⚠️  DATABASE_URL should include ?sslmode=require for Railway');
  }
}

// Check HOST format
if (process.env.HOST && process.env.HOST.startsWith('http')) {
  console.log('⚠️  HOST should not include protocol (http/https)');
}

// Report results
console.log('\n📋 Environment Check Results:');

if (missingVars.length > 0) {
  console.log(`❌ Missing required variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

if (warningVars.length > 0) {
  console.log(`⚠️  Optional variables not set: ${warningVars.join(', ')}`);
}

console.log('✅ All required environment variables are present\n');