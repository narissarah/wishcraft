#!/usr/bin/env node
/**
 * Railway Deployment Debugging Script
 * This script helps identify common Railway deployment issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Railway Deployment Debugging Script');
console.log('=====================================\n');

// 1. Environment Variables Check
console.log('1. Environment Variables Check:');
console.log('-------------------------------');
const requiredEnvVars = [
  'DATABASE_URL',
  'SHOPIFY_APP_URL',
  'SHOPIFY_API_KEY',
  'SHOPIFY_API_SECRET',
  'SCOPES',
  'PORT',
  'NODE_ENV'
];

const missingEnvVars = [];
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    missingEnvVars.push(varName);
    console.log(`❌ ${varName}: NOT SET`);
  } else {
    const displayValue = varName.includes('SECRET') || varName.includes('DATABASE_URL') 
      ? value.substring(0, 10) + '...' 
      : value;
    console.log(`✅ ${varName}: ${displayValue}`);
  }
});

if (missingEnvVars.length > 0) {
  console.log('\n⚠️  Missing environment variables:', missingEnvVars.join(', '));
}

// 2. Database Connection Test
console.log('\n2. Database Connection Test:');
console.log('----------------------------');
async function testDatabase() {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
    
    console.log('🔄 Attempting to connect to database...');
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database query successful:', result);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Parse database URL for debugging (without exposing password)
    if (process.env.DATABASE_URL) {
      try {
        const url = new URL(process.env.DATABASE_URL);
        console.log('\nDatabase URL components:');
        console.log(`- Protocol: ${url.protocol}`);
        console.log(`- Host: ${url.hostname}`);
        console.log(`- Port: ${url.port || 'default'}`);
        console.log(`- Database: ${url.pathname.slice(1)}`);
        console.log(`- User: ${url.username}`);
        console.log(`- SSL: ${url.searchParams.get('sslmode') || 'not specified'}`);
      } catch (parseError) {
        console.error('❌ Could not parse DATABASE_URL');
      }
    }
  }
}

// 3. Prisma Client Check
console.log('\n3. Prisma Client Check:');
console.log('-----------------------');
const prismaClientPath = path.join(__dirname, '..', 'node_modules', '.prisma', 'client');
const prismaEngineFiles = [
  'index.js',
  'index.d.ts',
  'schema.prisma',
  'libquery_engine-linux-musl-openssl-3.0.x.so.node',
  'libquery_engine-darwin.dylib.node',
  'libquery_engine-debian-openssl-3.0.x.so.node'
];

if (fs.existsSync(prismaClientPath)) {
  console.log('✅ Prisma client directory exists');
  const files = fs.readdirSync(prismaClientPath);
  console.log('Files in .prisma/client:', files);
  
  prismaEngineFiles.forEach(file => {
    const filePath = path.join(prismaClientPath, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`✅ ${file} (${stats.size} bytes)`);
    } else {
      console.log(`❌ ${file} - NOT FOUND`);
    }
  });
} else {
  console.log('❌ Prisma client directory not found!');
  console.log('   Run: npx prisma generate');
}

// 4. Build Artifacts Check
console.log('\n4. Build Artifacts Check:');
console.log('------------------------');
const buildDir = path.join(__dirname, '..', 'build');
if (fs.existsSync(buildDir)) {
  console.log('✅ Build directory exists');
  const buildFiles = fs.readdirSync(buildDir);
  console.log(`   Contains ${buildFiles.length} files`);
  
  // Check for index.js
  const indexPath = path.join(buildDir, 'index.js');
  if (fs.existsSync(indexPath)) {
    const stats = fs.statSync(indexPath);
    console.log(`✅ build/index.js exists (${stats.size} bytes)`);
  } else {
    console.log('❌ build/index.js not found!');
  }
} else {
  console.log('❌ Build directory not found!');
  console.log('   Run: npm run build');
}

// 5. Node Modules Check
console.log('\n5. Node Modules Check:');
console.log('---------------------');
const criticalDeps = [
  '@prisma/client',
  '@remix-run/express',
  '@shopify/shopify-app-remix',
  'express',
  'dotenv'
];

criticalDeps.forEach(dep => {
  const depPath = path.join(__dirname, '..', 'node_modules', dep);
  if (fs.existsSync(depPath)) {
    console.log(`✅ ${dep} installed`);
  } else {
    console.log(`❌ ${dep} NOT FOUND`);
  }
});

// 6. Memory Usage
console.log('\n6. Memory Usage:');
console.log('----------------');
const used = process.memoryUsage();
for (let key in used) {
  console.log(`${key}: ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
}

// 7. Platform Information
console.log('\n7. Platform Information:');
console.log('-----------------------');
console.log(`Node.js: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`Architecture: ${process.arch}`);
console.log(`OS Release: ${require('os').release()}`);

// 8. Run async tests
(async () => {
  await testDatabase();
  
  // 9. Test server startup
  console.log('\n9. Server Startup Test:');
  console.log('----------------------');
  try {
    // Try to load the server file
    const serverPath = path.join(__dirname, '..', 'server.js');
    if (fs.existsSync(serverPath)) {
      console.log('✅ server.js exists');
      
      // Check if we can require it without errors
      try {
        require(serverPath);
        console.log('✅ server.js can be loaded');
      } catch (error) {
        console.error('❌ Error loading server.js:', error.message);
      }
    } else {
      console.log('❌ server.js not found!');
    }
  } catch (error) {
    console.error('❌ Server startup test failed:', error.message);
  }
  
  console.log('\n=====================================');
  console.log('Debugging complete. Check the output above for issues.');
})();