#!/usr/bin/env node

import crypto from 'crypto';

console.log('🔐 WishCraft Security Keys Generator');
console.log('=====================================\n');

console.log('Copy these generated secrets to your Vercel Environment Variables:\n');

console.log('# Security Keys');
console.log(`SESSION_SECRET=${crypto.randomBytes(32).toString('base64')}`);
console.log(`ENCRYPTION_KEY=${crypto.randomBytes(32).toString('base64')}`); 
console.log(`ENCRYPTION_SALT=${crypto.randomBytes(32).toString('hex')}`);
console.log(`DATA_ENCRYPTION_KEY=${crypto.randomBytes(32).toString('base64')}`);
console.log(`DATA_ENCRYPTION_SALT=${crypto.randomBytes(32).toString('hex')}`);
console.log(`SEARCH_HASH_KEY=${crypto.randomBytes(32).toString('base64')}`);
console.log(`COLLABORATION_TOKEN_SECRET=${crypto.randomBytes(32).toString('base64')}`);
console.log(`SHOPIFY_WEBHOOK_SECRET=${crypto.randomBytes(32).toString('base64')}`);

console.log('\n# Environment');
console.log('NODE_ENV=production');
console.log('NODE_NO_WARNINGS=1');

console.log('\n✅ All secrets generated successfully!');
console.log('📋 Add these to Vercel → Settings → Environment Variables');
console.log('🚀 Then redeploy your app');