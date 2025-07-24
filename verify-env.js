#!/usr/bin/env node

// Environment Variable Verification Script for WishCraft
// Helps ensure all required variables are set before deployment

const requiredVars = [
  'DATABASE_URL',
  'SHOPIFY_API_KEY',
  'SHOPIFY_API_SECRET',
  'SHOPIFY_APP_URL',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
  'SHOPIFY_WEBHOOK_SECRET'
];

const recommendedVars = [
  'DATA_ENCRYPTION_KEY',
  'DATA_ENCRYPTION_SALT',
  'SEARCH_HASH_KEY',
  'COLLABORATION_TOKEN_SECRET',
  'REDIS_URL',
  'SENTRY_DSN'
];

console.log('🔍 WishCraft Environment Variable Verification\n');

// Check required variables
console.log('📋 Required Environment Variables:');
let hasAllRequired = true;
requiredVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`✅ ${varName}: Set (${process.env[varName].substring(0, 10)}...)`);
  } else {
    console.log(`❌ ${varName}: Missing`);
    hasAllRequired = false;
  }
});

console.log('\n📋 Recommended Environment Variables:');
recommendedVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`✅ ${varName}: Set`);
  } else {
    console.log(`⚠️  ${varName}: Missing (optional)`);
  }
});

// Check key lengths
console.log('\n🔒 Security Key Validation:');
const keyValidations = [
  { name: 'SESSION_SECRET', minLength: 32 },
  { name: 'ENCRYPTION_KEY', minLength: 32 },
  { name: 'DATA_ENCRYPTION_KEY', minLength: 32 },
  { name: 'SEARCH_HASH_KEY', minLength: 32 }
];

let hasSecurityIssues = false;
keyValidations.forEach(({ name, minLength }) => {
  const value = process.env[name];
  if (value) {
    if (value.length >= minLength) {
      console.log(`✅ ${name}: Valid length (${value.length} chars)`);
    } else {
      console.log(`❌ ${name}: Too short (${value.length} chars, need ${minLength}+)`);
      hasSecurityIssues = true;
    }
  }
});

// Railway-specific checks
console.log('\n🚂 Railway Environment:');
const railwayVars = ['RAILWAY_DEPLOYMENT_ID', 'RAILWAY_ENVIRONMENT', 'RAILWAY_PROJECT_NAME'];
const railwayDetected = railwayVars.some(v => process.env[v]);

if (railwayDetected) {
  console.log(`✅ Railway deployment detected`);
  console.log(`   Environment: ${process.env.RAILWAY_ENVIRONMENT || 'unknown'}`);
  console.log(`   Project: ${process.env.RAILWAY_PROJECT_NAME || 'unknown'}`);
} else {
  console.log('ℹ️  Not running on Railway (local environment)');
}

// Summary
console.log('\n📊 Summary:');
if (!hasAllRequired) {
  console.log('❌ Missing required environment variables!');
  console.log('   Please set all required variables before deployment.');
  process.exit(1);
} else if (hasSecurityIssues) {
  console.log('❌ Security key validation failed!');
  console.log('   Please ensure all keys meet minimum length requirements.');
  process.exit(1);
} else {
  console.log('✅ All required environment variables are set!');
  console.log('✅ Security keys are properly configured!');
  console.log('🚀 Ready for deployment!');
}

// Generate missing secrets helper
if (!hasAllRequired || hasSecurityIssues) {
  console.log('\n💡 To generate missing secrets, run:');
  console.log('node -e "');
  console.log('  const crypto = require(\'crypto\');');
  console.log('  console.log(\'# Add these to your Railway environment:\');');
  requiredVars.filter(v => !process.env[v] && v.includes('SECRET') || v.includes('KEY')).forEach(v => {
    console.log(`  console.log('${v}=' + crypto.randomBytes(32).toString('base64'));`);
  });
  console.log('"');
}