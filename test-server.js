import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting test server...');
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: !!process.env.DATABASE_URL,
  cwd: process.cwd()
});

// Simple health check
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'WishCraft Test Server Running',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Test server listening on port ${PORT}`);
  console.log(`✅ Health check available at http://localhost:${PORT}/health`);
});

// Keep process alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  process.exit(0);
});