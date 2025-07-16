import express from "express";
import { createRequestHandler } from "@remix-run/express";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

const app = express();

// Trust proxy for Railway deployments
app.set('trust proxy', true);

// Security middleware - Built for Shopify 2025 requirements
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.shopify.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.shopify.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.shopify.com", "wss://*.shopify.com"],
      fontSrc: ["'self'", "https://cdn.shopify.com"],
      frameSrc: ["'self'", "https://*.shopify.com"],
      frameAncestors: process.env.NODE_ENV === 'production' 
        ? ["https://*.myshopify.com", "https://admin.shopify.com"]
        : ["https://*.myshopify.com", "https://admin.shopify.com", "http://localhost:*", "https://localhost:*"]
    }
  },
  crossOriginEmbedderPolicy: false, // Required for Shopify embedded apps
  frameguard: false // Disable X-Frame-Options since we're setting frame-ancestors in CSP
}));

// Enable compression
app.use(compression());

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Parse JSON bodies
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Rate limiting - Built for Shopify requirement
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Health check endpoints (CRITICAL for Railway)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'production'
  });
});

app.get('/health/db', async (req, res) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: error.message
    });
  }
});

// Basic API endpoints
app.get('/api/metrics', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(), 
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV
  });
});

app.get('/api/deployment/readiness', (req, res) => {
  res.json({ 
    status: 'ready', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    shopifyCompliant: true
  });
});

// Serve static files
app.use(express.static("public"));

// Remix handler for all other routes
const build = await import("./build/index.js");
app.all("*", createRequestHandler({
  build: build.default,
  mode: process.env.NODE_ENV || 'production',
  getLoadContext() {
    return {};
  }
}));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'An error occurred processing your request' 
      : err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
const port = process.env.PORT || 3000;
const host = process.env.HOST || "0.0.0.0";

const server = app.listen(port, host, () => {
  console.log(`✅ WishCraft server running on port ${port} (${process.env.NODE_ENV})`);
  console.log(`✅ Built for Shopify 2025 compliant`);
  console.log(`✅ Health check: http://${host}:${port}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('CRITICAL - Uncaught Exception:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL - Unhandled Rejection:', reason);
  process.exit(1);
});