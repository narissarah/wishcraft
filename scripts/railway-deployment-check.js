#!/usr/bin/env node

/**
 * Railway Deployment Health Check Script
 * Comprehensive pre-deployment validation for Railway
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class RailwayDeploymentChecker {
  constructor() {
    this.checks = [];
    this.results = [];
  }

  // Add check
  addCheck(name, checkFn) {
    this.checks.push({ name, checkFn });
  }

  // Run all checks
  async runChecks() {
    console.log('🚀 Railway Deployment Health Check\n');
    
    for (const check of this.checks) {
      try {
        console.log(`🔍 Checking ${check.name}...`);
        const result = await check.checkFn();
        
        if (result.success) {
          console.log(`✅ ${check.name}: ${result.message}`);
        } else {
          console.log(`❌ ${check.name}: ${result.message}`);
        }
        
        this.results.push({
          name: check.name,
          success: result.success,
          message: result.message,
          details: result.details
        });
      } catch (error) {
        console.log(`❌ ${check.name}: ${error.message}`);
        this.results.push({
          name: check.name,
          success: false,
          message: error.message,
          details: { error: error.stack }
        });
      }
    }
    
    this.printSummary();
  }

  // Print summary
  printSummary() {
    console.log('\n📊 Summary:');
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    
    console.log(`✅ Successful checks: ${successful}`);
    console.log(`❌ Failed checks: ${failed}`);
    
    if (failed > 0) {
      console.log('\n🔧 Recommendations:');
      this.results.filter(r => !r.success).forEach(result => {
        console.log(`- Fix ${result.name}: ${result.message}`);
      });
      process.exit(1);
    } else {
      console.log('\n🎉 All checks passed! Ready for deployment.');
    }
  }
}

// Initialize checker
const checker = new RailwayDeploymentChecker();

// Check 1: Environment Variables
checker.addCheck('Environment Variables', async () => {
  const required = [
    'DATABASE_URL',
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SHOPIFY_APP_URL',
    'SESSION_SECRET',
    'ENCRYPTION_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    return {
      success: false,
      message: `Missing variables: ${missing.join(', ')}`,
      details: { missing }
    };
  }
  
  return {
    success: true,
    message: `All ${required.length} required environment variables are set`,
    details: { required }
  };
});

// Check 2: Package.json Configuration
checker.addCheck('Package.json Configuration', async () => {
  const packagePath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packagePath)) {
    return {
      success: false,
      message: 'package.json not found',
      details: { path: packagePath }
    };
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  
  // Check scripts
  const requiredScripts = ['start', 'start:production', 'build'];
  const missingScripts = requiredScripts.filter(script => !packageJson.scripts[script]);
  
  if (missingScripts.length > 0) {
    return {
      success: false,
      message: `Missing scripts: ${missingScripts.join(', ')}`,
      details: { missing: missingScripts }
    };
  }
  
  return {
    success: true,
    message: 'Package.json configuration is valid',
    details: { scripts: packageJson.scripts }
  };
});

// Check 3: Build Files
checker.addCheck('Build Files', async () => {
  const buildPath = path.join(process.cwd(), 'build');
  
  if (!fs.existsSync(buildPath)) {
    return {
      success: false,
      message: 'Build directory not found. Run npm run build first.',
      details: { path: buildPath }
    };
  }
  
  const indexPath = path.join(buildPath, 'index.js');
  if (!fs.existsSync(indexPath)) {
    return {
      success: false,
      message: 'Build index.js not found',
      details: { path: indexPath }
    };
  }
  
  return {
    success: true,
    message: 'Build files are present',
    details: { buildPath, indexPath }
  };
});

// Check 4: Database Connection
checker.addCheck('Database Connection', async () => {
  if (!process.env.DATABASE_URL) {
    return {
      success: false,
      message: 'DATABASE_URL not configured',
      details: { env: 'DATABASE_URL' }
    };
  }
  
  // Simple URL validation
  try {
    const url = new URL(process.env.DATABASE_URL);
    if (!url.hostname || !url.port) {
      return {
        success: false,
        message: 'Invalid DATABASE_URL format',
        details: { url: process.env.DATABASE_URL }
      };
    }
    
    return {
      success: true,
      message: 'Database URL format is valid',
      details: { 
        host: url.hostname,
        port: url.port,
        database: url.pathname.slice(1)
      }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Invalid DATABASE_URL format',
      details: { error: error.message }
    };
  }
});

// Check 5: Server File
checker.addCheck('Server File', async () => {
  const serverPath = path.join(process.cwd(), 'server.js');
  
  if (!fs.existsSync(serverPath)) {
    return {
      success: false,
      message: 'server.js not found',
      details: { path: serverPath }
    };
  }
  
  const serverContent = fs.readFileSync(serverPath, 'utf-8');
  
  // Check for essential patterns
  const patterns = [
    { name: 'Express app', pattern: /express\(\)/ },
    { name: 'Health endpoint', pattern: /\/health/ },
    { name: 'Port binding', pattern: /process\.env\.PORT/ },
    { name: 'Host binding', pattern: /0\.0\.0\.0/ }
  ];
  
  const missing = patterns.filter(p => !p.pattern.test(serverContent));
  
  if (missing.length > 0) {
    return {
      success: false,
      message: `Missing patterns: ${missing.map(m => m.name).join(', ')}`,
      details: { missing: missing.map(m => m.name) }
    };
  }
  
  return {
    success: true,
    message: 'Server file contains all required patterns',
    details: { patterns: patterns.map(p => p.name) }
  };
});

// Check 6: Dockerfile
checker.addCheck('Dockerfile', async () => {
  const dockerfilePath = path.join(process.cwd(), 'Dockerfile');
  
  if (!fs.existsSync(dockerfilePath)) {
    return {
      success: false,
      message: 'Dockerfile not found',
      details: { path: dockerfilePath }
    };
  }
  
  const dockerContent = fs.readFileSync(dockerfilePath, 'utf-8');
  
  // Check for essential patterns
  const patterns = [
    { name: 'Node.js base image', pattern: /FROM node:/ },
    { name: 'Working directory', pattern: /WORKDIR/ },
    { name: 'Copy package.json', pattern: /COPY package.*json/ },
    { name: 'npm install', pattern: /npm ci/ },
    { name: 'Expose port', pattern: /EXPOSE/ },
    { name: 'Health check', pattern: /HEALTHCHECK/ }
  ];
  
  const missing = patterns.filter(p => !p.pattern.test(dockerContent));
  
  if (missing.length > 0) {
    return {
      success: false,
      message: `Missing patterns: ${missing.map(m => m.name).join(', ')}`,
      details: { missing: missing.map(m => m.name) }
    };
  }
  
  return {
    success: true,
    message: 'Dockerfile contains all required patterns',
    details: { patterns: patterns.map(p => p.name) }
  };
});

// Check 7: Railway Configuration
checker.addCheck('Railway Configuration', async () => {
  const railwayPath = path.join(process.cwd(), 'railway.json');
  
  if (!fs.existsSync(railwayPath)) {
    return {
      success: false,
      message: 'railway.json not found',
      details: { path: railwayPath }
    };
  }
  
  const railwayConfig = JSON.parse(fs.readFileSync(railwayPath, 'utf-8'));
  
  // Check configuration
  if (!railwayConfig.build) {
    return {
      success: false,
      message: 'Missing build configuration',
      details: { config: railwayConfig }
    };
  }
  
  if (!railwayConfig.deploy) {
    return {
      success: false,
      message: 'Missing deploy configuration',
      details: { config: railwayConfig }
    };
  }
  
  return {
    success: true,
    message: 'Railway configuration is valid',
    details: { config: railwayConfig }
  };
});

// Check 8: Shopify Configuration
checker.addCheck('Shopify Configuration', async () => {
  const shopifyPath = path.join(process.cwd(), 'shopify.app.toml');
  
  if (!fs.existsSync(shopifyPath)) {
    return {
      success: false,
      message: 'shopify.app.toml not found',
      details: { path: shopifyPath }
    };
  }
  
  const shopifyContent = fs.readFileSync(shopifyPath, 'utf-8');
  
  // Check for Railway URL
  if (!shopifyContent.includes('railway.app')) {
    return {
      success: false,
      message: 'Shopify app URL not configured for Railway',
      details: { content: shopifyContent }
    };
  }
  
  return {
    success: true,
    message: 'Shopify configuration is valid for Railway',
    details: { configured: true }
  };
});

// Run checks
checker.runChecks().catch(error => {
  console.error('❌ Health check failed:', error.message);
  process.exit(1);
});