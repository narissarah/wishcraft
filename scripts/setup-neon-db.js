#!/usr/bin/env node

/**
 * WishCraft Neon Database Setup Script
 * This script helps you set up a Neon PostgreSQL database for your WishCraft app
 */

import crypto from 'crypto';

console.log('🎁 WishCraft Database Setup Guide\n');
console.log('=' .repeat(60));

// Generate secure environment variables
console.log('\n📋 STEP 1: Generated Environment Variables');
console.log('Copy these to your Vercel dashboard (Settings > Environment Variables):\n');

const secrets = {
  SESSION_SECRET: crypto.randomBytes(32).toString('base64'),
  ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'),
  ENCRYPTION_SALT: crypto.randomBytes(32).toString('hex'),
  DATA_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'),
  DATA_ENCRYPTION_SALT: crypto.randomBytes(32).toString('hex'),
  SEARCH_HASH_KEY: crypto.randomBytes(32).toString('base64'),
  COLLABORATION_TOKEN_SECRET: crypto.randomBytes(32).toString('base64'),
};

// Display environment variables
Object.entries(secrets).forEach(([key, value]) => {
  console.log(`${key}=${value}`);
});

console.log(`\nSHOPIFY_API_KEY=ac161e228a6b078fcdd3fa14586ded14`);
console.log(`SHOPIFY_API_SECRET=f5e5f2bb3304ecacdf420e7b5ca68595`);
console.log(`SHOPIFY_APP_URL=https://wishcraft-jqqy1p5kz-narissarahs-projects.vercel.app`);
console.log(`NODE_ENV=production`);
console.log(`NODE_NO_WARNINGS=1`);

console.log('\n' + '=' .repeat(60));
console.log('\n🐘 STEP 2: Set up Neon Database');
console.log('\n1. Go to: https://console.neon.tech/');
console.log('2. Sign up with your GitHub account');
console.log('3. Create a new project named "wishcraft"');
console.log('4. Select PostgreSQL version 15+');
console.log('5. Choose the Free Tier (sufficient for development)');
console.log('6. Copy the connection string that looks like:');
console.log('   postgresql://username:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require');

console.log('\n' + '=' .repeat(60));
console.log('\n⚡ STEP 3: Configure Vercel Environment Variables');
console.log('\n1. Go to: https://vercel.com/dashboard');
console.log('2. Select your WishCraft project');
console.log('3. Go to Settings > Environment Variables');
console.log('4. Add these variables (copy from STEP 1 above):');
console.log('   - All the generated secrets');
console.log('   - SHOPIFY_* variables');
console.log('   - NODE_ENV and NODE_NO_WARNINGS');
console.log('\n5. Add your Neon database URL as:');
console.log('   DATABASE_URL=<your_neon_connection_string>');

console.log('\n' + '=' .repeat(60));
console.log('\n🚀 STEP 4: Deploy and Test');
console.log('\n1. After setting environment variables in Vercel:');
console.log('2. Trigger a new deployment (push to main branch)');
console.log('3. Test database connection at:');
console.log('   https://wishcraft-jqqy1p5kz-narissarahs-projects.vercel.app/api/test-db');
console.log('4. If successful, we\'ll switch from mock to real database!');

console.log('\n' + '=' .repeat(60));
console.log('\n✅ Quick Start Commands:');
console.log('\nAfter Neon setup, run these locally to test:');
console.log('export DATABASE_URL="<your_neon_url>"');
console.log('npm install');
console.log('npx prisma migrate deploy');
console.log('npx prisma generate');

console.log('\n🎯 Need Help?');
console.log('If you get stuck, I can help you with each step!');
console.log('The mock system works perfectly until the database is ready.');

console.log('\n' + '=' .repeat(60));