#!/usr/bin/env node
/**
 * Database Connection Test Script
 * Tests various database connection scenarios
 */

const { PrismaClient } = require('@prisma/client');

console.log('🔍 Database Connection Test');
console.log('==========================\n');

// Test different connection configurations
async function testConnection(name, config = {}) {
  console.log(`\nTest: ${name}`);
  console.log('-'.repeat(name.length + 6));
  
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
    ...config
  });
  
  const startTime = Date.now();
  
  try {
    // Test connection
    await prisma.$connect();
    const connectTime = Date.now() - startTime;
    console.log(`✅ Connected in ${connectTime}ms`);
    
    // Test simple query
    const queryStart = Date.now();
    const result = await prisma.$queryRaw`SELECT NOW() as current_time, version() as version`;
    const queryTime = Date.now() - queryStart;
    console.log(`✅ Query executed in ${queryTime}ms`);
    console.log(`   Database time: ${result[0].current_time}`);
    console.log(`   Database version: ${result[0].version}`);
    
    // Test Prisma schema
    try {
      const tableCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
      console.log(`✅ Found ${tableCount[0].count} tables in public schema`);
    } catch (error) {
      console.log('⚠️  Could not query table count');
    }
    
    await prisma.$disconnect();
    console.log('✅ Disconnected successfully');
    
  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error(`❌ Failed after ${errorTime}ms`);
    console.error(`   Error: ${error.message}`);
    
    // Additional error diagnostics
    if (error.code) console.error(`   Error Code: ${error.code}`);
    if (error.meta) console.error(`   Meta:`, error.meta);
    
    // Check for common connection issues
    if (error.message.includes('P1001')) {
      console.error('   💡 This is a connection error. Check your DATABASE_URL');
    } else if (error.message.includes('P1002')) {
      console.error('   💡 The database server was reached but timed out');
    } else if (error.message.includes('P1003')) {
      console.error('   💡 Database does not exist');
    } else if (error.message.includes('P1009')) {
      console.error('   💡 Database already exists');
    } else if (error.message.includes('P1010')) {
      console.error('   💡 Access denied for user');
    }
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

// Parse and validate DATABASE_URL
console.log('DATABASE_URL Analysis:');
console.log('--------------------');
if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log(`✅ Valid URL format`);
    console.log(`   Protocol: ${url.protocol}`);
    console.log(`   Host: ${url.hostname}`);
    console.log(`   Port: ${url.port || 'default (5432)'}`);
    console.log(`   Database: ${url.pathname.slice(1)}`);
    console.log(`   User: ${url.username}`);
    
    // Check for SSL settings
    const sslMode = url.searchParams.get('sslmode');
    const sslAccept = url.searchParams.get('sslaccept');
    console.log(`   SSL Mode: ${sslMode || 'not specified'}`);
    if (sslAccept) console.log(`   SSL Accept: ${sslAccept}`);
    
    // Railway specific checks
    if (url.hostname.includes('railway.app') || url.hostname.includes('railway')) {
      console.log('🚂 Railway database detected');
      if (!sslMode) {
        console.log('⚠️  Railway databases might require SSL. Consider adding ?sslmode=require');
      }
    }
  } catch (error) {
    console.error('❌ Invalid DATABASE_URL format:', error.message);
  }
} else {
  console.error('❌ DATABASE_URL not set!');
  process.exit(1);
}

// Run tests
(async () => {
  // Test 1: Default connection
  await testConnection('Default Connection');
  
  // Test 2: Connection with timeout
  await testConnection('Connection with 5s timeout', {
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    // Reduced timeout for faster failure detection
    errorFormat: 'pretty'
  });
  
  // Test 3: Connection with SSL variations (if using PostgreSQL)
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql')) {
    const baseUrl = process.env.DATABASE_URL.split('?')[0];
    
    // Test without SSL
    process.env.DATABASE_URL = baseUrl;
    await testConnection('Without SSL parameters');
    
    // Test with sslmode=require
    process.env.DATABASE_URL = `${baseUrl}?sslmode=require`;
    await testConnection('With sslmode=require');
    
    // Test with sslmode=require&sslaccept=strict
    process.env.DATABASE_URL = `${baseUrl}?sslmode=require&sslaccept=strict`;
    await testConnection('With strict SSL');
    
    // Restore original
    process.env.DATABASE_URL = process.env.DATABASE_URL;
  }
  
  console.log('\n==========================');
  console.log('All tests completed');
})();