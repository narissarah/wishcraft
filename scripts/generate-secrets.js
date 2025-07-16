#!/usr/bin/env node

/**
 * Secure Secret Generation Script for WishCraft
 * Generates cryptographically secure secrets for production deployment
 */

import crypto from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';

console.log('🔐 WishCraft Secret Generation Script');
console.log('===================================');

/**
 * Generate a secure random string
 */
function generateSecureSecret(length = 32, encoding = 'base64') {
  return crypto.randomBytes(length).toString(encoding);
}

/**
 * Generate a secure hex key
 */
function generateHexKey(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate all required secrets
 */
function generateAllSecrets() {
  console.log('Generating secure secrets...\n');

  const secrets = {
    // Session encryption (32 bytes base64)
    SESSION_SECRET: generateSecureSecret(32, 'base64'),
    
    // JWT signing (32 bytes base64)
    JWT_SECRET: generateSecureSecret(32, 'base64'),
    
    // Data encryption key (32 bytes hex)
    ENCRYPTION_KEY: generateHexKey(32),
    
    // Hash salt (32 bytes hex)
    HASH_SALT: generateHexKey(32),
    
    // Webhook secret (32 bytes base64)
    SHOPIFY_WEBHOOK_SECRET: generateSecureSecret(32, 'base64'),
    
    // CSRF secret (32 bytes base64)
    CSRF_SECRET: generateSecureSecret(32, 'base64'),
  };

  return secrets;
}

/**
 * Display secrets securely
 */
function displaySecrets(secrets) {
  console.log('🔑 Generated Secrets:');
  console.log('====================');
  
  Object.entries(secrets).forEach(([key, value]) => {
    console.log(`${key}=${value}`);
  });
  
  console.log('\n🚨 SECURITY WARNINGS:');
  console.log('- Store these secrets securely (use a password manager)');
  console.log('- Never commit these to version control');
  console.log('- Use environment variables or secure secret management');
  console.log('- Rotate secrets regularly in production');
}

/**
 * Create a secure .env file template
 */
function createSecureEnvFile(secrets) {
  const envContent = `# =============================================================================
# SECURE ENVIRONMENT VARIABLES FOR WISHCRAFT
# =============================================================================
# 
# ⚠️  CRITICAL: These secrets are for your environment only
# ⚠️  DO NOT commit this file to version control
# ⚠️  Use secure secret management in production
#
# Generated: ${new Date().toISOString()}
# =============================================================================

# SHOPIFY APP CONFIGURATION
SHOPIFY_API_KEY=your_shopify_api_key_here
SHOPIFY_API_SECRET=your_shopify_api_secret_here
SHOPIFY_APP_URL=https://localhost:3000

# SECURE GENERATED SECRETS
SESSION_SECRET=${secrets.SESSION_SECRET}
JWT_SECRET=${secrets.JWT_SECRET}
ENCRYPTION_KEY=${secrets.ENCRYPTION_KEY}
HASH_SALT=${secrets.HASH_SALT}
SHOPIFY_WEBHOOK_SECRET=${secrets.SHOPIFY_WEBHOOK_SECRET}
CSRF_SECRET=${secrets.CSRF_SECRET}

# DATABASE CONFIGURATION
DATABASE_URL=postgresql://username:password@localhost:5432/wishcraft_development

# ENVIRONMENT SETTINGS
NODE_ENV=development
PORT=3000

# OPTIONAL INTEGRATIONS
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@yourstore.com
GA_MEASUREMENT_ID=G-XXXXXXXXXX
SENTRY_DSN=your_sentry_dsn_here

# FEATURE FLAGS
FEATURE_ANALYTICS_ENABLED=true
FEATURE_EMAIL_SHARING_ENABLED=true
FEATURE_GROUP_GIFTING_ENABLED=true
FEATURE_SOCIAL_SHARING_ENABLED=true

# DEVELOPMENT SETTINGS
DEBUG=true
LOG_LEVEL=debug
REDIS_URL=redis://localhost:6379

# PRODUCTION SETTINGS
FORCE_HTTPS=true
ENABLE_AUDIT_LOGGING=true
RATE_LIMIT_REQUESTS_PER_MINUTE=100
RATE_LIMIT_REQUESTS_PER_HOUR=1000
`;

  const envPath = join(process.cwd(), '.env.secure');
  writeFileSync(envPath, envContent);
  
  console.log(`\n✅ Secure .env file created: ${envPath}`);
  console.log('📝 Copy this file to .env and update with your actual values');
}

/**
 * Main execution
 */
function main() {
  try {
    const secrets = generateAllSecrets();
    displaySecrets(secrets);
    createSecureEnvFile(secrets);
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Copy .env.secure to .env');
    console.log('2. Update SHOPIFY_API_KEY and SHOPIFY_API_SECRET');
    console.log('3. Update DATABASE_URL with your database credentials');
    console.log('4. Delete .env.secure after copying');
    console.log('5. Ensure .env is in .gitignore');
    
    console.log('\n🔒 PRODUCTION DEPLOYMENT:');
    console.log('- Use environment variables instead of .env files');
    console.log('- Consider AWS Secrets Manager, HashiCorp Vault, etc.');
    console.log('- Enable secret rotation policies');
    
  } catch (error) {
    console.error('❌ Error generating secrets:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateSecureSecret, generateHexKey, generateAllSecrets };