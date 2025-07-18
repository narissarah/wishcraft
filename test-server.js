// Simple test server to verify deployment readiness
const http = require('http');
const { PrismaClient } = require('@prisma/client');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

console.log('🧪 Testing server configuration...');
console.log(`📍 Host: ${HOST}`);
console.log(`🔌 Port: ${PORT}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

// Test Prisma client initialization
let prisma;
try {
  prisma = new PrismaClient();
  console.log('✅ Prisma client initialized successfully');
} catch (error) {
  console.error('❌ Prisma client initialization failed:', error.message);
}

// Simple HTTP server
const server = http.createServer(async (req, res) => {
  // Set CORS headers for Shopify embedded apps
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  switch (url.pathname) {
    case '/health':
    case '/':
      // Health check endpoint
      let dbStatus = 'unknown';
      if (prisma) {
        try {
          await prisma.$queryRaw`SELECT 1`;
          dbStatus = 'connected';
        } catch (error) {
          dbStatus = 'disconnected';
        }
      }
      
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: dbStatus,
        version: '1.0.0',
        uptime: process.uptime()
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health, null, 2));
      break;
      
    case '/test':
      // Test endpoint
      const testResult = {
        message: 'WishCraft test server is running!',
        timestamp: new Date().toISOString(),
        headers: req.headers,
        method: req.method,
        url: req.url
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(testResult, null, 2));
      break;
      
    default:
      // 404 for other routes
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Start server
server.listen(PORT, HOST, () => {
  console.log(`🚀 Test server running on ${HOST}:${PORT}`);
  console.log(`🔗 Health check: http://${HOST}:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://${HOST}:${PORT}/test`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📥 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    if (prisma) {
      prisma.$disconnect();
    }
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📥 Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    if (prisma) {
      prisma.$disconnect();
    }
    process.exit(0);
  });
});