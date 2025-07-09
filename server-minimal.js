/**
 * Minimal server for debugging Railway deployment issues
 * This server has extensive logging and error handling
 */

console.log('=== MINIMAL SERVER STARTUP ===');
console.log('Time:', new Date().toISOString());
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('Working directory:', process.cwd());

// Check critical environment variables
const envCheck = {
  NODE_ENV: process.env.NODE_ENV || 'not set',
  PORT: process.env.PORT || '3000',
  DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'NOT SET',
  SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL ? 'set' : 'NOT SET',
};

console.log('\nEnvironment check:');
Object.entries(envCheck).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

// Simple HTTP server without any dependencies first
const http = require('http');
const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

console.log(`\nStarting minimal HTTP server on ${host}:${port}...`);

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      server: 'minimal',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }));
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WishCraft Minimal Server Running');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(port, host, (error) => {
  if (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
  console.log(`✅ Minimal server running at http://${host}:${port}`);
  console.log('Server started successfully!');
});

server.on('error', (error) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use`);
  } else if (error.code === 'EACCES') {
    console.error(`No permission to use port ${port}`);
  }
  process.exit(1);
});

// Handle shutdown signals
const shutdown = (signal) => {
  console.log(`\n${signal} received, shutting down...`);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Log any uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('\n=== MINIMAL SERVER READY ===');