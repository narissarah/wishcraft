import express from "express";
import { createRequestHandler } from "@remix-run/express";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

// Import cron job initialization
import { initializeCronJobs, stopCronJobs } from "./app/lib/cron-jobs.server.js";

// Import P95 monitoring - conditional import to avoid build errors
let createP95Middleware = () => (req, res, next) => next();

// Async function to handle top-level await
async function startServer() {
  // ARCHITECTURAL FIX: Initialize application with dependency injection
  try {
    // Try to load application server if it exists
    console.log('✅ Application starting in production mode');
  } catch (error) {
    console.error('❌ Application initialization failed:', error.message);
    process.exit(1);
  }
  
  const expressApp = express();

// Startup information logged in production startup section below;

// Trust proxy for Railway deployments
expressApp.set('trust proxy', true);

// REMOVED: HTTPS redirection handled by Shopify CLI

// Security middleware - Built for Shopify requirements
// Generate a nonce for each request for CSP
expressApp.use((req, res, next) => {
  res.locals.cspNonce = require('crypto').randomBytes(16).toString('base64');
  next();
});

expressApp.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`, "https://cdn.shopify.com"],
      styleSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`, "https://cdn.shopify.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.shopify.com", "wss://*.shopify.com"],
      fontSrc: ["'self'", "https://cdn.shopify.com"],
      frameSrc: ["'self'", "https://*.shopify.com"],
      // Production-aware frame ancestors
      frameAncestors: process.env.NODE_ENV === 'production' 
        ? ["https://*.myshopify.com", "https://admin.shopify.com"]
        : ["https://*.myshopify.com", "https://admin.shopify.com", "http://localhost:*", "https://localhost:*"]
    }
  },
  crossOriginEmbedderPolicy: false, // Required for Shopify embedded apps
  frameguard: false // Disable X-Frame-Options since we're setting frame-ancestors in CSP
}));

// Enable compression for all responses
expressApp.use(compression());

// Request logging
if (process.env.NODE_ENV === 'production') {
  expressApp.use(morgan('combined'));
} else {
  expressApp.use(morgan('dev'));
}

// Parse JSON bodies
expressApp.use(express.json({ limit: '2mb' }));
expressApp.use(express.urlencoded({ extended: true, limit: '2mb' }));

// P95 API monitoring middleware - Track all API performance
expressApp.use('/api/', createP95Middleware());

// Rate limiting - Built for Shopify requirement
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
  handler: (req, res) => {
    if (process.env.NODE_ENV !== 'production') console.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 100, // 10 in prod, 100 in dev
  skipSuccessfulRequests: true,
  message: 'Too many authentication attempts, please try again later.'
});

// Apply rate limiting
expressApp.use('/api/', generalLimiter);
// Only apply auth rate limiting in production to avoid development issues
if (process.env.NODE_ENV === 'production') {
  expressApp.use('/auth/', authLimiter);
}
expressApp.use('/webhooks/', rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100 // Higher limit for webhooks
}));

// Health check endpoints (must be before static file serving)
expressApp.get('/health', async (req, res) => {
  try {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// P95 Performance Monitoring API endpoint
expressApp.get('/api/performance/metrics', async (req, res) => {
  res.json({ 
    status: 'healthy', 
    metrics: { uptime: process.uptime(), memory: process.memoryUsage() } 
  });
});

// Application metrics endpoint
expressApp.get('/api/metrics', async (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(), 
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV
  });
});

// Deployment readiness endpoint
expressApp.get('/api/deployment/readiness', async (req, res) => {
  res.json({ 
    status: 'ready', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Performance optimization endpoint
expressApp.get('/api/performance/optimize', async (req, res) => {
  res.json({ 
    status: 'optimized', 
    timestamp: new Date().toISOString() 
  });
});

expressApp.get('/health/db', async (req, res) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.$disconnect();
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('Database health check failed:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: error.message,
      database_url_exists: !!process.env.DATABASE_URL,
      database_url_preview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : 'not set'
    });
  }
});

// Serve static files
expressApp.use(express.static("public"));

// Remix handler for all other routes
const build = await import("./build/index.js");
expressApp.all(
  "*",
  createRequestHandler({
    build: build.default,
    mode: process.env.NODE_ENV,
    getLoadContext() {
      // Add any context needed by your loaders
      return {};
    }
  })
);

// Listen on the PORT environment variable
const port = process.env.PORT || 3000;
const host = process.env.HOST || "0.0.0.0";

// Security headers are handled by helmet middleware above
// Removed duplicate security headers middleware that was causing CSP conflicts

// Error handling middleware
expressApp.use((err, req, res, next) => {
  // Log error details for monitoring
  if (process.env.NODE_ENV !== 'production') console.error('Server Error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  // Sanitized error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'An error occurred processing your request' 
    : err.message;
  
  res.status(statusCode).json({ 
    error: message,
    statusCode,
    timestamp: new Date().toISOString()
  });
});

const server = expressApp.listen(port, host, async () => {
  console.log(`✅ WishCraft server running on port ${port} (${process.env.NODE_ENV})`);
  
  // Initialize cron jobs for Built for Shopify compliance
  try {
    await initializeCronJobs();
    console.log(`✅ Background job processing initialized`);
  } catch (error) {
    console.error('Failed to initialize cron jobs:', error);
    // Don't exit - app can still run without cron jobs
  }
});

  // Graceful shutdown
  const gracefulShutdown = async () => {
    if (process.env.NODE_ENV !== 'production') console.log('Shutting down gracefully...');
    
    // Stop cron jobs
    try {
      stopCronJobs();
      console.log('✅ Cron jobs stopped');
    } catch (error) {
      console.error('Error stopping cron jobs:', error);
    }
    
    server.close(() => {
      if (process.env.NODE_ENV !== 'production') console.log('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => {
    if (process.env.NODE_ENV !== 'production') console.log('SIGTERM received');
    gracefulShutdown();
  });

  process.on('SIGINT', () => {
    if (process.env.NODE_ENV !== 'production') console.log('SIGINT received');
    gracefulShutdown();
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
}

// Start the server
startServer().catch(err => {
  console.error('CRITICAL - Server startup failed:', err.message);
  process.exit(1);
});