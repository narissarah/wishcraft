#!/usr/bin/env node

console.log('🔍 DEBUG: Starting WishCraft Debug Mode');
console.log('=====================================');
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT || 3000);
console.log('Database URL exists:', !!process.env.DATABASE_URL);
console.log('Shopify API Key exists:', !!process.env.SHOPIFY_API_KEY);
console.log('Shopify API Secret exists:', !!process.env.SHOPIFY_API_SECRET);
console.log('Session Secret exists:', !!process.env.SESSION_SECRET);
console.log('Host:', process.env.HOST);
console.log('');

// Check if database URL has the right format
if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;
  console.log('Database URL format check:');
  console.log('- Starts with postgresql://:', dbUrl.startsWith('postgresql://'));
  console.log('- Contains @:', dbUrl.includes('@'));
  console.log('- Contains port:', /:\d+\//.test(dbUrl));
  console.log('- Has SSL mode:', dbUrl.includes('sslmode='));
  
  // If missing SSL mode, suggest adding it
  if (!dbUrl.includes('sslmode=')) {
    console.log('\n⚠️  WARNING: DATABASE_URL might need ?sslmode=require for Railway');
    console.log('   Try adding ?sslmode=require to the end of your DATABASE_URL');
  }
}

console.log('\n🚀 Attempting to start server...\n');

// Try to start the actual server
try {
  require('./server.js');
} catch (error) {
  console.error('💥 FATAL ERROR during startup:', error.message);
  console.error('Stack trace:', error.stack);
  
  // If database connection fails, try to start without database
  if (error.message.includes('database') || error.message.includes('P1001')) {
    console.log('🔄 Attempting to start in degraded mode (no database)...');
    process.env.SKIP_DATABASE_INIT = 'true';
    try {
      require('./server.js');
    } catch (fallbackError) {
      console.error('💥 FATAL ERROR in fallback mode:', fallbackError.message);
      process.exit(1);
    }
  } else {
    process.exit(1);
  }
}