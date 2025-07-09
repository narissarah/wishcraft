const express = require("express");
const { createRequestHandler } = require("@remix-run/express");

const app = express();

// Trust proxy for Railway deployments
app.set('trust proxy', true);

// Health check endpoints (must be before static file serving)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.get('/health/db', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.$disconnect();
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// Serve static files
app.use(express.static("public"));

// Remix handler for all other routes
app.all(
  "*",
  createRequestHandler({
    build: require("./build/index.js"),
    mode: process.env.NODE_ENV,
  })
);

// Listen on the PORT environment variable
const port = process.env.PORT || 3000;
const host = process.env.HOST || "0.0.0.0";

app.listen(port, host, () => {
  console.log(`✅ WishCraft server is running on http://${host}:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});