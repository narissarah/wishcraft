#!/usr/bin/env node

/**
 * Railway Environment Verification Script
 * Checks all required environment variables and database connection
 */

const chalk = require('chalk') || { 
  green: (str) => str, 
  red: (str) => str, 
  yellow: (str) => str,
  blue: (str) => str
};

console.log('🔍 Railway Environment Verification\n');

// Required environment variables
const requiredVars = {
  DATABASE_URL: {
    check: (val) => val && val.includes('postgresql://'),
    fix: 'Set a valid PostgreSQL connection string with ?sslmode=require'
  },
  SHOPIFY_API_KEY: {
    check: (val) => val && val.length > 10,
    fix: 'Get from Shopify Partner Dashboard'
  },
  SHOPIFY_API_SECRET: {
    check: (val) => val && val.length > 10,
    fix: 'Get from Shopify Partner Dashboard'
  },
  SHOPIFY_APP_URL: {
    check: (val) => val && val.startsWith('https://'),
    fix: 'Use your Railway domain: https://wishcraft-production.up.railway.app'
  },
  SESSION_SECRET: {
    check: (val) => val && val.length >= 32,
    fix: 'Generate with: openssl rand -base64 32'
  },
  NODE_ENV: {
    check: (val) => val === 'production',
    fix: 'Should be set to "production"'
  }
};

let hasErrors = false;

// Check each variable
console.log('Environment Variables:');
console.log('=====================\n');

for (const [varName, config] of Object.entries(requiredVars)) {
  const value = process.env[varName];
  const isValid = config.check(value);
  
  if (isValid) {
    console.log(`✅ ${varName}`);
    if (varName === 'DATABASE_URL' && !value.includes('sslmode=require')) {
      console.log(`   ⚠️  Warning: Add ?sslmode=require for Railway SSL`);
    }
  } else {
    hasErrors = true;
    console.log(`❌ ${varName}`);
    console.log(`   Fix: ${config.fix}`);
  }
}

// Check DATABASE_URL format
if (process.env.DATABASE_URL) {
  console.log('\n\nDatabase URL Analysis:');
  console.log('=====================\n');
  
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log(`✅ Protocol: ${url.protocol}`);
    console.log(`✅ Host: ${url.hostname}`);
    console.log(`✅ Port: ${url.port || '5432'}`);
    console.log(`✅ Database: ${url.pathname.slice(1)}`);
    console.log(`✅ SSL Mode: ${url.searchParams.get('sslmode') || '❌ Not set (required for Railway)'}`);
    
    if (url.hostname === 'postgres.railway.internal') {
      console.log('\n🚂 Railway internal database detected');
      console.log('   This is correct for Railway deployments');
    }
  } catch (err) {
    console.log('❌ Invalid DATABASE_URL format');
    hasErrors = true;
  }
}

// Test database connection
if (process.env.DATABASE_URL && !hasErrors) {
  console.log('\n\nDatabase Connection Test:');
  console.log('========================\n');
  
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  prisma.$connect()
    .then(() => {
      console.log('✅ Database connection successful!');
      return prisma.$disconnect();
    })
    .catch((err) => {
      console.log('❌ Database connection failed:');
      console.log(`   ${err.message}`);
      hasErrors = true;
    })
    .finally(() => {
      // Summary
      console.log('\n\nSummary:');
      console.log('========\n');
      
      if (hasErrors) {
        console.log('❌ Environment validation failed');
        console.log('\nFix the issues above and run this script again');
        process.exit(1);
      } else {
        console.log('✅ All environment variables are properly configured');
        console.log('✅ Ready for Railway deployment!');
        console.log('\nRun: railway up');
        process.exit(0);
      }
    });
} else {
  // Summary without DB test
  console.log('\n\nSummary:');
  console.log('========\n');
  
  if (hasErrors) {
    console.log('❌ Environment validation failed');
    console.log('\nFix the issues above and run this script again');
    process.exit(1);
  }
}