#!/usr/bin/env node
/**
 * Deployment Readiness Check
 * Comprehensive validation before deploying to Railway
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  console.error(`${colors.red}❌ ${message}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function logInfo(message) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

// Check functions
const checks = {
  // 1. Environment check
  environmentVariables: () => {
    log('\n📋 Checking environment variables...', 'magenta');
    
    const requiredVars = [
      'SHOPIFY_APP_URL',
      'SHOPIFY_API_KEY', 
      'SHOPIFY_API_SECRET',
      'SESSION_SECRET',
      'ENCRYPTION_KEY',
      'ENCRYPTION_SALT',
      'DATABASE_URL'
    ];
    
    const envFile = path.join(__dirname, '..', '.env');
    const hasEnvFile = fs.existsSync(envFile);
    
    if (!hasEnvFile) {
      logError('.env file not found');
      logInfo('Create .env from .env.example and fill in your values');
      return false;
    }
    
    // Read .env file
    const envContent = fs.readFileSync(envFile, 'utf8');
    const missingVars = [];
    
    requiredVars.forEach(varName => {
      const regex = new RegExp(`^${varName}=.+`, 'm');
      if (!regex.test(envContent)) {
        missingVars.push(varName);
      }
    });
    
    if (missingVars.length > 0) {
      logError(`Missing environment variables: ${missingVars.join(', ')}`);
      return false;
    }
    
    logSuccess('All required environment variables found');
    return true;
  },

  // 2. Shopify configuration check
  shopifyConfig: () => {
    log('\n🛍️  Checking Shopify configuration...', 'magenta');
    
    const tomlPath = path.join(__dirname, '..', 'shopify.app.toml');
    if (!fs.existsSync(tomlPath)) {
      logError('shopify.app.toml not found');
      return false;
    }
    
    const tomlContent = fs.readFileSync(tomlPath, 'utf8');
    
    // Check API version
    if (!tomlContent.includes('api_version = "2024-10"')) {
      logError('API version is not set to 2024-10');
      return false;
    }
    
    // Check redirect URLs
    if (!tomlContent.includes('https://wishcraft-production.up.railway.app')) {
      logError('Production URL not found in shopify.app.toml');
      logInfo('Update application_url and redirect_urls to use Railway URL');
      return false;
    }
    
    logSuccess('Shopify configuration is correct');
    return true;
  },

  // 3. Database check
  databaseConnection: async () => {
    log('\n🗄️  Checking database connection...', 'magenta');
    
    try {
      // Test Prisma connection
      execSync('npx prisma db pull --print', { stdio: 'ignore' });
      logSuccess('Database connection successful');
      return true;
    } catch (error) {
      logError('Database connection failed');
      logInfo('Check your DATABASE_URL in .env');
      return false;
    }
  },

  // 4. Build check
  buildCheck: () => {
    log('\n🔨 Checking build...', 'magenta');
    
    const buildDir = path.join(__dirname, '..', 'build');
    if (!fs.existsSync(buildDir)) {
      logWarning('Build directory not found');
      logInfo('Run: npm run build');
      return false;
    }
    
    // Check if build is recent
    const buildStats = fs.statSync(buildDir);
    const hoursSinceBuild = (Date.now() - buildStats.mtimeMs) / (1000 * 60 * 60);
    
    if (hoursSinceBuild > 24) {
      logWarning(`Build is ${hoursSinceBuild.toFixed(1)} hours old`);
      logInfo('Consider rebuilding: npm run build');
    }
    
    logSuccess('Build directory exists');
    return true;
  },

  // 5. TypeScript check
  typeCheck: () => {
    log('\n📘 Checking TypeScript...', 'magenta');
    
    try {
      execSync('npm run typecheck', { stdio: 'ignore' });
      logSuccess('TypeScript check passed');
      return true;
    } catch (error) {
      logError('TypeScript errors found');
      logInfo('Run: npm run typecheck');
      return false;
    }
  },

  // 6. Security check
  securityCheck: () => {
    log('\n🔒 Checking security...', 'magenta');
    
    // Check for exposed secrets
    const filesToCheck = [
      'shopify.app.toml',
      'package.json',
      'server.js'
    ];
    
    const secretPatterns = [
      /SHOPIFY_API_SECRET\s*=\s*["'][^"']+["']/,
      /SESSION_SECRET\s*=\s*["'][^"']+["']/,
      /password\s*[:=]\s*["'][^"']+["']/i
    ];
    
    let hasExposedSecrets = false;
    
    filesToCheck.forEach(file => {
      const filePath = path.join(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        secretPatterns.forEach(pattern => {
          if (pattern.test(content)) {
            logError(`Exposed secret found in ${file}`);
            hasExposedSecrets = true;
          }
        });
      }
    });
    
    if (hasExposedSecrets) {
      return false;
    }
    
    logSuccess('No exposed secrets found');
    return true;
  },

  // 7. Railway CLI check
  railwayCheck: () => {
    log('\n🚂 Checking Railway CLI...', 'magenta');
    
    try {
      execSync('railway --version', { stdio: 'ignore' });
      logSuccess('Railway CLI is installed');
      
      // Check if linked to project
      try {
        execSync('railway status', { stdio: 'ignore' });
        logSuccess('Railway project is linked');
        return true;
      } catch {
        logWarning('Railway project not linked');
        logInfo('Run: railway link');
        return true; // Not critical
      }
    } catch (error) {
      logWarning('Railway CLI not installed');
      logInfo('Install with: npm install -g @railway/cli');
      return true; // Not critical
    }
  },

  // 8. CSP compliance check
  cspCheck: () => {
    log('\n🛡️  Checking CSP compliance...', 'magenta');
    
    // Check for inline styles
    const routesDir = path.join(__dirname, '..', 'app', 'routes');
    let hasInlineStyles = false;
    
    const checkFile = (filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('style=') && content.includes('{{')) {
        logWarning(`Inline styles found in ${path.basename(filePath)}`);
        hasInlineStyles = true;
      }
    };
    
    const walkDir = (dir) => {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          walkDir(filePath);
        } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
          checkFile(filePath);
        }
      });
    };
    
    walkDir(routesDir);
    
    if (hasInlineStyles) {
      logWarning('Some files have inline styles');
      logInfo('Consider moving styles to CSS files for CSP compliance');
    } else {
      logSuccess('No inline styles found');
    }
    
    return true;
  }
};

// Main execution
async function main() {
  log('🚀 WishCraft Deployment Readiness Check', 'blue');
  log('=====================================\n', 'blue');
  
  const results = {};
  let allPassed = true;
  
  // Run all checks
  for (const [name, check] of Object.entries(checks)) {
    try {
      const result = await check();
      results[name] = result;
      if (!result) {
        allPassed = false;
      }
    } catch (error) {
      logError(`Check ${name} failed: ${error.message}`);
      results[name] = false;
      allPassed = false;
    }
  }
  
  // Summary
  log('\n📊 Summary', 'blue');
  log('==========', 'blue');
  
  Object.entries(results).forEach(([name, passed]) => {
    const status = passed ? '✅' : '❌';
    const color = passed ? 'green' : 'red';
    log(`${status} ${name}`, color);
  });
  
  if (allPassed) {
    logSuccess('\n✨ All checks passed! Ready for deployment.');
    logInfo('\nNext steps:');
    logInfo('1. Commit your changes: git add -A && git commit -m "Your message"');
    logInfo('2. Push to GitHub: git push origin master');
    logInfo('3. Deploy to Railway: railway up');
  } else {
    logError('\n❌ Some checks failed. Fix the issues above before deploying.');
    
    // Provide Railway environment setup command
    if (!results.environmentVariables) {
      logInfo('\n📝 Set Railway environment variables:');
      logInfo('Run: node scripts/setup-railway-env.js');
    }
  }
  
  process.exit(allPassed ? 0 : 1);
}

// Run the checks
main().catch(error => {
  logError(`Deployment check failed: ${error.message}`);
  process.exit(1);
});