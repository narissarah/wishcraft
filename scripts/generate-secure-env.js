#!/usr/bin/env node

/**
 * Generate secure environment variables for production
 * Run this script to create secure random secrets
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function generateSecureSecret(length = 32) {
  return crypto.randomBytes(length).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, length * 2);
}

function generateStrongPassword(length = 32) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  
  return password;
}

function generateSecureWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function validateExistingEnv() {
  const envPath = path.join(process.cwd(), '.env.production');
  if (!fs.existsSync(envPath)) {
    console.log(`${colors.yellow}⚠️  No .env.production file found. Creating from template...${colors.reset}`);
    
    const templatePath = path.join(process.cwd(), '.env.production.example');
    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, envPath);
    } else {
      console.log(`${colors.red}❌ No .env.production.example file found!${colors.reset}`);
      return false;
    }
  }
  return true;
}

function updateEnvFile() {
  const envPath = path.join(process.cwd(), '.env.production');
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  const secrets = {
    SESSION_SECRET: generateSecureSecret(32),
    ENCRYPTION_KEY: generateSecureSecret(32),
    JWT_SECRET: generateSecureSecret(32),
    WEBHOOK_SECRET: generateSecureWebhookSecret(),
    DB_PASSWORD: generateStrongPassword(24),
    REDIS_PASSWORD: generateStrongPassword(20),
    BACKUP_ENCRYPTION_KEY: generateSecureSecret(32)
  };
  
  console.log(`\n${colors.cyan}🔐 Generating secure secrets...${colors.reset}\n`);
  
  // Update each secret in the env file
  Object.entries(secrets).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, 'gm');
    const newLine = `${key}=${value}`;
    
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, newLine);
      console.log(`${colors.green}✅ Updated ${key}${colors.reset}`);
    } else {
      envContent += `\n${newLine}`;
      console.log(`${colors.green}✅ Added ${key}${colors.reset}`);
    }
  });
  
  // Add additional security configurations
  const securityConfigs = [
    'FORCE_HTTPS=true',
    'SECURE_COOKIES=true',
    'ENABLE_SECURITY_HEADERS=true',
    'ENABLE_CSRF_PROTECTION=true',
    'ENABLE_RATE_LIMITING=true',
    'HSTS_MAX_AGE=31536000',
    'SESSION_TIMEOUT=3600000',
    'MAX_REQUEST_SIZE=10485760',
    'ENABLE_AUDIT_LOGGING=true'
  ];
  
  console.log(`\n${colors.cyan}🛡️  Adding security configurations...${colors.reset}\n`);
  
  securityConfigs.forEach(config => {
    const [key] = config.split('=');
    const regex = new RegExp(`^${key}=.*$`, 'gm');
    
    if (!envContent.match(regex)) {
      envContent += `\n${config}`;
      console.log(`${colors.green}✅ Added ${key}${colors.reset}`);
    }
  });
  
  // Save the updated file
  fs.writeFileSync(envPath, envContent);
  
  // Create a secure backup
  const backupPath = path.join(process.cwd(), `.env.production.backup.${Date.now()}`);
  fs.writeFileSync(backupPath, envContent);
  
  console.log(`\n${colors.bright}${colors.green}✅ Environment file updated successfully!${colors.reset}`);
  console.log(`${colors.yellow}📁 Backup saved to: ${backupPath}${colors.reset}`);
  
  // Display important notes
  console.log(`\n${colors.bright}${colors.yellow}⚠️  IMPORTANT SECURITY NOTES:${colors.reset}`);
  console.log(`${colors.yellow}1. Store these secrets securely in your deployment platform${colors.reset}`);
  console.log(`${colors.yellow}2. Never commit .env.production to version control${colors.reset}`);
  console.log(`${colors.yellow}3. Rotate secrets regularly (recommended: every 90 days)${colors.reset}`);
  console.log(`${colors.yellow}4. Use different secrets for each environment${colors.reset}`);
  console.log(`${colors.yellow}5. Enable audit logging for secret access${colors.reset}`);
  
  // Generate secret storage recommendations
  console.log(`\n${colors.bright}${colors.cyan}🔑 Secret Storage Recommendations:${colors.reset}`);
  console.log(`${colors.cyan}• AWS Secrets Manager${colors.reset}`);
  console.log(`${colors.cyan}• HashiCorp Vault${colors.reset}`);
  console.log(`${colors.cyan}• Azure Key Vault${colors.reset}`);
  console.log(`${colors.cyan}• Google Secret Manager${colors.reset}`);
  console.log(`${colors.cyan}• Railway/Render environment variables${colors.reset}`);
  
  return secrets;
}

function generateSecretReport(secrets) {
  const reportPath = path.join(process.cwd(), 'secrets-report.json');
  const report = {
    generated_at: new Date().toISOString(),
    environment: 'production',
    secrets_generated: Object.keys(secrets).length,
    strength_analysis: {
      session_secret: {
        length: secrets.SESSION_SECRET.length,
        entropy_bits: Math.log2(Math.pow(62, secrets.SESSION_SECRET.length)),
        strength: 'Very Strong'
      },
      encryption_key: {
        length: secrets.ENCRYPTION_KEY.length,
        entropy_bits: Math.log2(Math.pow(62, secrets.ENCRYPTION_KEY.length)),
        strength: 'Very Strong'
      },
      webhook_secret: {
        length: secrets.WEBHOOK_SECRET.length,
        format: 'hex',
        strength: 'Very Strong'
      }
    },
    recommendations: [
      'Rotate secrets every 90 days',
      'Use hardware security modules (HSM) for key storage in production',
      'Implement secret versioning',
      'Enable audit logging for all secret access',
      'Use separate secrets for each deployment environment'
    ]
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n${colors.blue}📊 Security report saved to: ${reportPath}${colors.reset}`);
}

// Main execution
console.log(`${colors.bright}${colors.blue}🔐 WishCraft Secure Environment Generator${colors.reset}`);
console.log(`${colors.blue}========================================${colors.reset}`);

if (validateExistingEnv()) {
  const secrets = updateEnvFile();
  generateSecretReport(secrets);
  
  console.log(`\n${colors.bright}${colors.green}✅ All secure secrets have been generated!${colors.reset}`);
  console.log(`${colors.green}Your application now has production-grade security configurations.${colors.reset}\n`);
} else {
  console.log(`${colors.red}❌ Failed to generate secure environment. Please ensure .env.production.example exists.${colors.reset}`);
  process.exit(1);
}