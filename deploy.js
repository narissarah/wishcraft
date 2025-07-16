#!/usr/bin/env node

/**
 * WishCraft Deployment Script
 * Handles deployment to Railway, Render, or Fly.io
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, { stdio: 'inherit', ...options });
  } catch (error) {
    log(`Command failed: ${command}`, 'red');
    process.exit(1);
  }
}

function checkPrerequisites() {
  log('🔍 Checking prerequisites...', 'blue');
  
  // Check if build directory exists
  if (!fs.existsSync('build')) {
    log('❌ Build directory not found. Running build...', 'yellow');
    exec('npm run build');
  }
  
  // Check if package.json exists
  if (!fs.existsSync('package.json')) {
    log('❌ package.json not found', 'red');
    process.exit(1);
  }
  
  // Check if environment example exists
  if (!fs.existsSync('.env.production.example')) {
    log('❌ .env.production.example not found', 'red');
    process.exit(1);
  }
  
  log('✅ Prerequisites check passed', 'green');
}

function checkEnvironment() {
  log('🔍 Checking environment configuration...', 'blue');
  
  const requiredEnvVars = [
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SHOPIFY_APP_URL',
    'SESSION_SECRET',
    'ENCRYPTION_KEY',
    'DATABASE_URL'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    log(`❌ Missing environment variables: ${missingVars.join(', ')}`, 'red');
    log('Please set these variables in your deployment platform', 'yellow');
    return false;
  }
  
  log('✅ Environment configuration check passed', 'green');
  return true;
}

function deployToRailway() {
  log('🚀 Deploying to Railway...', 'blue');
  
  try {
    // Check if railway CLI is installed
    exec('railway --version', { stdio: 'ignore' });
  } catch {
    log('❌ Railway CLI not found. Installing...', 'yellow');
    exec('npm install -g @railway/cli');
  }
  
  // Check if project is linked
  if (!fs.existsSync('railway.json')) {
    log('❌ Railway project not initialized. Run "railway init" first', 'red');
    process.exit(1);
  }
  
  // Deploy
  exec('railway up');
  
  log('✅ Railway deployment initiated', 'green');
  log('🔗 Run "railway status" to check deployment status', 'blue');
}

function deployToRender() {
  log('🚀 Deploying to Render...', 'blue');
  
  if (!fs.existsSync('render.yaml')) {
    log('❌ render.yaml not found', 'red');
    process.exit(1);
  }
  
  log('📝 Render deployment is configured via render.yaml', 'yellow');
  log('1. Connect your repository to Render', 'blue');
  log('2. Render will automatically deploy on git push', 'blue');
  log('3. Set environment variables in Render dashboard', 'blue');
  
  log('✅ Render configuration ready', 'green');
}

function deployToFly() {
  log('🚀 Deploying to Fly.io...', 'blue');
  
  try {
    // Check if fly CLI is installed
    exec('fly version', { stdio: 'ignore' });
  } catch {
    log('❌ Fly CLI not found. Please install from https://fly.io/docs/hands-on/install-flyctl/', 'red');
    process.exit(1);
  }
  
  if (!fs.existsSync('fly.toml')) {
    log('❌ fly.toml not found', 'red');
    process.exit(1);
  }
  
  // Deploy
  exec('fly deploy');
  
  log('✅ Fly.io deployment initiated', 'green');
  log('🔗 Run "fly status" to check deployment status', 'blue');
}

function runDatabaseMigrations(platform) {
  log('🗄️  Running database migrations...', 'blue');
  
  switch (platform) {
    case 'railway':
      exec('railway run npx prisma migrate deploy');
      break;
    case 'fly':
      log('Run: fly ssh console -C "npx prisma migrate deploy"', 'yellow');
      break;
    case 'render':
      log('SSH into your Render service and run: npx prisma migrate deploy', 'yellow');
      break;
  }
}

function checkDeploymentHealth(url) {
  log('🔍 Checking deployment health...', 'blue');
  
  try {
    const https = require('https');
    const http = require('http');
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(`${url}/health`, (res) => {
      if (res.statusCode === 200) {
        log('✅ Health check passed', 'green');
      } else {
        log(`❌ Health check failed: ${res.statusCode}`, 'red');
      }
    });
    
    req.on('error', (err) => {
      log(`❌ Health check failed: ${err.message}`, 'red');
    });
    
    req.setTimeout(10000, () => {
      log('❌ Health check timeout', 'red');
      req.abort();
    });
    
  } catch (error) {
    log(`❌ Health check error: ${error.message}`, 'red');
  }
}

function main() {
  const platform = process.argv[2];
  const url = process.argv[3];
  
  log('🎯 WishCraft Deployment Script', 'green');
  log('===============================', 'green');
  
  if (!platform || !['railway', 'render', 'fly'].includes(platform)) {
    log('Usage: node deploy.js <platform> [url]', 'yellow');
    log('Platforms: railway, render, fly', 'yellow');
    log('Example: node deploy.js railway', 'yellow');
    log('Example: node deploy.js railway https://your-app.railway.app', 'yellow');
    process.exit(1);
  }
  
  // Run checks
  checkPrerequisites();
  
  // Deploy to selected platform
  switch (platform) {
    case 'railway':
      deployToRailway();
      break;
    case 'render':
      deployToRender();
      break;
    case 'fly':
      deployToFly();
      break;
  }
  
  // Run database migrations
  if (platform !== 'render') {
    runDatabaseMigrations(platform);
  }
  
  // Check deployment health if URL provided
  if (url) {
    setTimeout(() => {
      checkDeploymentHealth(url);
    }, 10000); // Wait 10 seconds for deployment to be ready
  }
  
  log('🎉 Deployment process completed!', 'green');
  log('📖 Check DEPLOYMENT.md for post-deployment steps', 'blue');
}

main();