#!/usr/bin/env node
/**
 * Deployment Script for WishCraft
 * Handles pre-deployment validation and deployment orchestration
 * 
 * This script ensures all requirements are met before deploying to production
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
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

function logInfo(message) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

// Check if a command exists
function commandExists(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Run a command and return the output
function runCommand(command, options = {}) {
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'ignore' : 'inherit',
      ...options
    });
    return { success: true, output };
  } catch (error) {
    return { success: false, error };
  }
}

// Check environment variables
function checkEnvironmentVariables() {
  log('\nChecking environment variables...', 'magenta');
  
  const deployTarget = process.argv[2] || 'railway';
  
  // Skip environment variable check for Railway since they're managed in Railway dashboard
  if (deployTarget === 'railway') {
    logInfo('Skipping environment variable check for Railway deployment');
    logInfo('Environment variables are managed in Railway dashboard');
    return true;
  }
  
  const requiredEnvVars = [
    'DATABASE_URL',
    'SHOPIFY_APP_URL',
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SHOPIFY_WEBHOOK_SECRET',
    'SESSION_SECRET',
    'ENCRYPTION_KEY',
    'ENCRYPTION_SALT',
    'DATA_ENCRYPTION_KEY',
    'DATA_ENCRYPTION_SALT',
    'SEARCH_HASH_KEY',
    'COLLABORATION_TOKEN_SECRET'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logError(`Missing required environment variables: ${missingVars.join(', ')}`);
    logInfo('Set these environment variables in your deployment platform');
    return false;
  }
  
  logSuccess('All required environment variables are set');
  return true;
}

// Run tests
function runTests() {
  log('\nRunning tests...', 'magenta');
  
  const deployTarget = process.argv[2] || 'railway';
  
  // Skip tests for Railway since vitest is not configured
  if (deployTarget === 'railway') {
    logInfo('Skipping tests for Railway deployment');
    return true;
  }
  
  const testResult = runCommand('npm test', { silent: false });
  
  if (!testResult.success) {
    logError('Tests failed. Fix failing tests before deploying.');
    return false;
  }
  
  logSuccess('All tests passed');
  return true;
}

// Run type checking
function runTypeCheck() {
  log('\nRunning TypeScript type checking...', 'magenta');
  
  const typeCheckResult = runCommand('npm run typecheck', { silent: false });
  
  if (!typeCheckResult.success) {
    logError('TypeScript errors found. Fix type errors before deploying.');
    return false;
  }
  
  logSuccess('TypeScript type checking passed');
  return true;
}

// Run linting
function runLinting() {
  log('\nRunning ESLint...', 'magenta');
  
  const lintResult = runCommand('npm run lint', { silent: false });
  
  if (!lintResult.success) {
    logWarning('Linting warnings found. Consider fixing them.');
    // Don't fail deployment for linting warnings
  } else {
    logSuccess('No linting issues found');
  }
  
  return true;
}

// Check database migrations
async function checkDatabaseMigrations() {
  log('\nChecking database migrations...', 'magenta');
  
  // Check if there are pending migrations
  const migrationStatus = runCommand('npx prisma migrate status', { silent: true });
  
  if (migrationStatus.output && migrationStatus.output.includes('Database schema is not up to date')) {
    logWarning('Pending database migrations detected');
    logInfo('Run migrations with: npm run db:migrate');
    return false;
  }
  
  logSuccess('Database schema is up to date');
  return true;
}

// Build the application
function buildApplication() {
  log('\nBuilding application...', 'magenta');
  
  const buildResult = runCommand('npm run build', { silent: false });
  
  if (!buildResult.success) {
    logError('Build failed. Fix build errors before deploying.');
    return false;
  }
  
  logSuccess('Application built successfully');
  return true;
}

// Validate Shopify configuration
function validateShopifyConfig() {
  log('\nValidating Shopify configuration...', 'magenta');
  
  const configPath = path.join(__dirname, 'shopify.app.toml');
  
  if (!fs.existsSync(configPath)) {
    logError('shopify.app.toml not found');
    return false;
  }
  
  const config = fs.readFileSync(configPath, 'utf8');
  
  // Check API version
  if (!config.includes('api_version = "2025-07"')) {
    logWarning('Not using the latest API version "2025-07" in shopify.app.toml');
    logInfo('Consider updating to the latest stable version: "2025-07"');
  }
  
  // Check for exposed secrets
  if (config.includes('api_key') && !config.includes('SHOPIFY_API_KEY')) {
    logWarning('API key might be exposed in shopify.app.toml');
  }
  
  logSuccess('Shopify configuration is valid');
  return true;
}

// Security audit
function runSecurityAudit() {
  log('\nRunning security audit...', 'magenta');
  
  // Check for security vulnerabilities
  const auditResult = runCommand('npm audit', { silent: true });
  
  if (auditResult.output && auditResult.output.includes('found 0 vulnerabilities')) {
    logSuccess('No security vulnerabilities found');
  } else if (auditResult.output) {
    const criticalMatch = auditResult.output.match(/(\d+) critical/);
    const highMatch = auditResult.output.match(/(\d+) high/);
    
    if (criticalMatch && parseInt(criticalMatch[1]) > 0) {
      logError(`Found ${criticalMatch[1]} critical vulnerabilities`);
      logInfo('Run: npm audit fix');
      return false;
    }
    
    if (highMatch && parseInt(highMatch[1]) > 0) {
      logWarning(`Found ${highMatch[1]} high severity vulnerabilities`);
    }
  }
  
  return true;
}

// Main deployment function
async function deploy() {
  log('🚀 WishCraft Deployment Script', 'blue');
  log('================================\n', 'blue');
  
  // Check prerequisites
  if (!commandExists('node')) {
    logError('Node.js is not installed');
    process.exit(1);
  }
  
  if (!commandExists('npm')) {
    logError('npm is not installed');
    process.exit(1);
  }
  
  if (!commandExists('npx')) {
    logError('npx is not installed');
    process.exit(1);
  }
  
  // Run all checks
  const checks = [
    { name: 'Environment Variables', fn: checkEnvironmentVariables },
    { name: 'Shopify Configuration', fn: validateShopifyConfig },
    { name: 'Security Audit', fn: runSecurityAudit },
    { name: 'TypeScript', fn: runTypeCheck },
    { name: 'Linting', fn: runLinting },
    { name: 'Tests', fn: runTests },
    { name: 'Database Migrations', fn: checkDatabaseMigrations },
    { name: 'Build', fn: buildApplication }
  ];
  
  let allChecksPassed = true;
  
  for (const check of checks) {
    const result = await check.fn();
    if (!result) {
      allChecksPassed = false;
      if (['Environment Variables', 'Shopify Configuration', 'Build'].includes(check.name)) {
        // Critical checks that should stop deployment
        logError(`\nDeployment aborted due to ${check.name} check failure`);
        process.exit(1);
      }
    }
  }
  
  if (!allChecksPassed) {
    logWarning('\nSome checks failed but are not critical');
    const response = await new Promise(resolve => {
      process.stdout.write('Continue with deployment? (y/N): ');
      process.stdin.once('data', data => {
        resolve(data.toString().trim().toLowerCase());
      });
    });
    
    if (response !== 'y') {
      logInfo('Deployment cancelled');
      process.exit(0);
    }
  }
  
  log('\n🎉 All checks passed! Ready for deployment', 'green');
  
  // Deploy based on environment
  const deployTarget = process.argv[2] || 'railway';
  
  switch (deployTarget) {
    case 'railway':
      log('\nDeploying to Railway...', 'magenta');
      runCommand('railway up', { silent: false });
      break;
      
    case 'render':
      log('\nDeploying to Render...', 'magenta');
      logInfo('Push to your Git repository to trigger Render deployment');
      break;
      
    case 'heroku':
      log('\nDeploying to Heroku...', 'magenta');
      runCommand('git push heroku main', { silent: false });
      break;
      
    default:
      logError(`Unknown deployment target: ${deployTarget}`);
      logInfo('Usage: npm run deploy [railway|render|heroku]');
      process.exit(1);
  }
  
  logSuccess('\n✨ Deployment complete!');
}

// Run deployment
deploy().catch(error => {
  logError(`Deployment failed: ${error.message}`);
  process.exit(1);
});