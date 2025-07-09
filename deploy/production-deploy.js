#!/usr/bin/env node
// Production deployment orchestrator for WishCraft

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Colors for output
const colors = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[0;34m',
  nc: '\x1b[0m'
};

const log = (message, color = 'nc') => {
  console.log(`${colors[color]}${message}${colors.nc}`);
};

// Configuration
const config = {
  environment: process.argv[2] || 'production',
  platform: process.argv[3] || 'railway',
  dryRun: process.argv.includes('--dry-run'),
  skipTests: process.argv.includes('--skip-tests'),
  skipBackup: process.argv.includes('--skip-backup')
};

log('🚀 WishCraft Production Deployment Orchestrator', 'blue');
log(`Environment: ${config.environment}`, 'blue');
log(`Platform: ${config.platform}`, 'blue');
log(`Dry Run: ${config.dryRun}`, 'blue');
console.log('='.repeat(50));

async function runCommand(command, description, critical = true) {
  log(`📋 ${description}...`, 'yellow');
  
  if (config.dryRun) {
    log(`[DRY RUN] Would execute: ${command}`, 'blue');
    return true;
  }

  try {
    execSync(command, { stdio: 'inherit' });
    log(`✅ ${description} completed`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${description} failed: ${error.message}`, 'red');
    if (critical) {
      process.exit(1);
    }
    return false;
  }
}

async function checkPrerequisites() {
  log('🔍 Checking prerequisites...', 'yellow');

  // Check Node.js version
  const nodeVersion = process.version;
  const requiredVersion = 'v18.0.0';
  if (nodeVersion < requiredVersion) {
    log(`❌ Node.js version ${nodeVersion} is not supported. Minimum required: ${requiredVersion}`, 'red');
    return false;
  }

  // Check if package.json exists
  if (!existsSync('package.json')) {
    log('❌ package.json not found in current directory', 'red');
    return false;
  }

  // Check environment variables
  const requiredEnvVars = [
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'DATABASE_URL',
    'SESSION_SECRET'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    log(`❌ Missing required environment variables: ${missingVars.join(', ')}`, 'red');
    log('💡 Make sure to set them in your deployment platform or .env.production file', 'yellow');
    return false;
  }

  // Check platform CLI tools
  const platformCommands = {
    railway: 'railway',
    render: 'render',
    docker: 'docker'
  };

  if (platformCommands[config.platform]) {
    try {
      execSync(`${platformCommands[config.platform]} --version`, { stdio: 'pipe' });
    } catch (error) {
      log(`❌ ${config.platform} CLI not found. Please install it first.`, 'red');
      return false;
    }
  }

  log('✅ Prerequisites check passed', 'green');
  return true;
}

async function runTests() {
  if (config.skipTests) {
    log('⏭️ Skipping tests as requested', 'yellow');
    return true;
  }

  log('🧪 Running test suite...', 'yellow');
  
  // Type checking
  if (!await runCommand('npm run typecheck', 'TypeScript type checking')) {
    return false;
  }

  // Linting
  await runCommand('npm run lint', 'ESLint checking', false);

  // Unit tests
  if (!await runCommand('npm run test:unit', 'Unit tests')) {
    return false;
  }

  // Performance tests
  await runCommand('npm run test:performance', 'Performance tests', false);

  // Security audit
  await runCommand('npm audit --audit-level=high', 'Security audit', false);

  return true;
}

async function buildApplication() {
  log('🏗️ Building application...', 'yellow');

  // Clean previous build
  await runCommand('rm -rf build', 'Cleaning previous build', false);

  // Install dependencies
  if (!await runCommand('npm ci --production=false', 'Installing dependencies')) {
    return false;
  }

  // Generate Prisma client
  if (!await runCommand('npx prisma generate', 'Generating Prisma client')) {
    return false;
  }

  // Build application
  if (!await runCommand('NODE_ENV=production npm run build', 'Building application')) {
    return false;
  }

  // Check bundle size
  await runCommand('npm run size', 'Checking bundle size', false);

  return true;
}

async function createBackup() {
  if (config.skipBackup) {
    log('⏭️ Skipping backup as requested', 'yellow');
    return true;
  }

  log('💾 Creating pre-deployment backup...', 'yellow');
  
  try {
    if (existsSync('./deploy/backup.sh')) {
      await runCommand('./deploy/backup.sh full', 'Creating database backup', false);
    } else {
      log('⚠️ Backup script not found, skipping backup', 'yellow');
    }
  } catch (error) {
    log('⚠️ Backup failed, continuing with deployment', 'yellow');
  }

  return true;
}

async function deployToPlatform() {
  log(`🚀 Deploying to ${config.platform}...`, 'yellow');

  switch (config.platform) {
    case 'railway':
      return await runCommand(
        `railway deploy --environment=${config.environment}`,
        'Deploying to Railway'
      );

    case 'render':
      // Render uses Git-based deployment
      if (!await runCommand('git status --porcelain', 'Checking Git status', false)) {
        log('⚠️ Working directory has uncommitted changes', 'yellow');
      }
      
      return await runCommand(
        'git push render main',
        'Deploying to Render'
      );

    case 'docker':
      // Build and push Docker image
      const imageTag = `wishcraft:${config.environment}-${Date.now()}`;
      
      if (!await runCommand(`docker build -t ${imageTag} .`, 'Building Docker image')) {
        return false;
      }

      // Tag for registry
      const registryTag = `${process.env.DOCKER_REGISTRY || 'ghcr.io/wishcraft'}/wishcraft:${imageTag}`;
      if (!await runCommand(`docker tag ${imageTag} ${registryTag}`, 'Tagging Docker image')) {
        return false;
      }

      // Push to registry
      return await runCommand(`docker push ${registryTag}`, 'Pushing Docker image');

    default:
      log(`❌ Unsupported platform: ${config.platform}`, 'red');
      return false;
  }
}

async function runHealthChecks() {
  log('🏥 Running post-deployment health checks...', 'yellow');

  const host = process.env.HOST || 'localhost:3000';
  const healthEndpoints = [
    '/health',
    '/health/db',
    '/health/shopify',
    '/health/performance'
  ];

  // Wait for deployment to be ready
  if (!config.dryRun) {
    log('⏳ Waiting for deployment to be ready...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
  }

  for (const endpoint of healthEndpoints) {
    const url = `https://${host}${endpoint}`;
    
    if (config.dryRun) {
      log(`[DRY RUN] Would check: ${url}`, 'blue');
      continue;
    }

    try {
      const response = await fetch(url, { timeout: 10000 });
      if (response.ok) {
        log(`✅ Health check passed: ${endpoint}`, 'green');
      } else {
        log(`⚠️ Health check warning: ${endpoint} returned ${response.status}`, 'yellow');
      }
    } catch (error) {
      log(`❌ Health check failed: ${endpoint} - ${error.message}`, 'red');
    }
  }

  return true;
}

async function setupMonitoring() {
  log('📊 Setting up performance monitoring...', 'yellow');

  // Start performance monitoring
  await runCommand('npm run performance:alerts', 'Setting up performance alerts', false);

  // Send deployment event to monitoring services
  if (process.env.DATADOG_API_KEY && !config.dryRun) {
    try {
      const response = await fetch('https://api.datadoghq.com/api/v1/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': process.env.DATADOG_API_KEY
        },
        body: JSON.stringify({
          title: 'WishCraft Deployment',
          text: `Deployed to ${config.environment} on ${config.platform}`,
          tags: [
            `environment:${config.environment}`,
            `platform:${config.platform}`,
            'service:wishcraft'
          ]
        })
      });

      if (response.ok) {
        log('✅ Deployment event sent to Datadog', 'green');
      }
    } catch (error) {
      log('⚠️ Failed to send deployment event to Datadog', 'yellow');
    }
  }

  return true;
}

async function sendNotification() {
  log('📢 Sending deployment notification...', 'yellow');

  if (process.env.SLACK_WEBHOOK_URL && !config.dryRun) {
    try {
      const commitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      const commitMsg = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
      
      const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚀 WishCraft deployed to ${config.environment}`,
          attachments: [{
            color: 'good',
            fields: [
              { title: 'Environment', value: config.environment, short: true },
              { title: 'Platform', value: config.platform, short: true },
              { title: 'Commit', value: commitSha.substring(0, 7), short: true },
              { title: 'Message', value: commitMsg, short: false }
            ]
          }]
        })
      });

      if (response.ok) {
        log('✅ Slack notification sent', 'green');
      }
    } catch (error) {
      log('⚠️ Failed to send Slack notification', 'yellow');
    }
  }

  return true;
}

// Main deployment flow
async function main() {
  try {
    // Prerequisites
    if (!await checkPrerequisites()) {
      process.exit(1);
    }

    // Tests
    if (!await runTests()) {
      process.exit(1);
    }

    // Build
    if (!await buildApplication()) {
      process.exit(1);
    }

    // Backup
    await createBackup();

    // Deploy
    if (!await deployToPlatform()) {
      process.exit(1);
    }

    // Health checks
    await runHealthChecks();

    // Monitoring
    await setupMonitoring();

    // Notification
    await sendNotification();

    log('🎉 Deployment completed successfully!', 'green');
    log(`📊 Monitor your application at: https://${process.env.HOST}`, 'blue');
    log(`📈 Performance dashboard: https://${process.env.HOST}/admin/performance`, 'blue');

  } catch (error) {
    log(`❌ Deployment failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default main;