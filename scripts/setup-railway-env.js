#!/usr/bin/env node
/**
 * Railway Environment Setup Script
 * Helps configure Railway environment variables for WishCraft
 */

import { execSync } from 'child_process';
import { generateSecureSecret, generateHexKey } from './generate-secrets.js';

console.log('🚂 Railway Environment Setup for WishCraft\n');

// Generate secure secrets
const secrets = {
  SESSION_SECRET: generateSecureSecret(32, 'base64'),
  ENCRYPTION_KEY: generateSecureSecret(32, 'base64'),
  ENCRYPTION_SALT: generateHexKey(32),
  SHOPIFY_WEBHOOK_SECRET: generateSecureSecret(32, 'base64'),
  JWT_SECRET: generateSecureSecret(32, 'base64'),
  HASH_SALT: generateHexKey(32),
  CSRF_SECRET: generateSecureSecret(32, 'base64'),
};

console.log('📋 Required Environment Variables for Railway:\n');
console.log('Copy and paste these into your Railway project variables:\n');

// Required variables
console.log('# Required: Shopify App Configuration');
console.log(`SHOPIFY_APP_URL=https://wishcraft-production.up.railway.app`);
console.log(`SHOPIFY_API_KEY=[Get from Shopify Partners Dashboard]`);
console.log(`SHOPIFY_API_SECRET=[Get from Shopify Partners Dashboard]`);
console.log(`SHOPIFY_SCOPES=read_customers,write_customers,read_products,read_orders,write_orders,read_inventory,write_content`);
console.log('');

console.log('# Required: Security Secrets');
console.log(`SESSION_SECRET=${secrets.SESSION_SECRET}`);
console.log(`ENCRYPTION_KEY=${secrets.ENCRYPTION_KEY}`);
console.log(`ENCRYPTION_SALT=${secrets.ENCRYPTION_SALT}`);
console.log(`SHOPIFY_WEBHOOK_SECRET=${secrets.SHOPIFY_WEBHOOK_SECRET}`);
console.log('');

console.log('# Optional: Additional Security');
console.log(`JWT_SECRET=${secrets.JWT_SECRET}`);
console.log(`HASH_SALT=${secrets.HASH_SALT}`);
console.log(`CSRF_SECRET=${secrets.CSRF_SECRET}`);
console.log('');

console.log('# Environment Settings');
console.log('NODE_ENV=production');
console.log('');

console.log('🔧 Railway CLI Commands (if you have Railway CLI installed):\n');

// Generate Railway CLI commands
const commands = [
  `railway variables set SHOPIFY_APP_URL=https://wishcraft-production.up.railway.app`,
  `railway variables set SESSION_SECRET=${secrets.SESSION_SECRET}`,
  `railway variables set ENCRYPTION_KEY=${secrets.ENCRYPTION_KEY}`,
  `railway variables set ENCRYPTION_SALT=${secrets.ENCRYPTION_SALT}`,
  `railway variables set SHOPIFY_WEBHOOK_SECRET=${secrets.SHOPIFY_WEBHOOK_SECRET}`,
  `railway variables set JWT_SECRET=${secrets.JWT_SECRET}`,
  `railway variables set HASH_SALT=${secrets.HASH_SALT}`,
  `railway variables set CSRF_SECRET=${secrets.CSRF_SECRET}`,
  `railway variables set NODE_ENV=production`,
  `railway variables set SHOPIFY_SCOPES="read_customers,write_customers,read_products,read_orders,write_orders,read_inventory,write_content"`,
];

console.log('# Run these commands one by one:');
commands.forEach(cmd => console.log(cmd));

console.log('\n⚠️  IMPORTANT STEPS:');
console.log('1. Add SHOPIFY_API_KEY and SHOPIFY_API_SECRET from your Shopify Partners Dashboard');
console.log('2. DATABASE_URL is automatically provided by Railway PostgreSQL');
console.log('3. After setting all variables, redeploy your Railway app');
console.log('4. Update your Shopify app URLs in Partners Dashboard to use:');
console.log('   - App URL: https://wishcraft-production.up.railway.app');
console.log('   - Redirect URLs: https://wishcraft-production.up.railway.app/auth/callback');
console.log('\n✅ Once all variables are set, your app should work properly in Shopify admin!');