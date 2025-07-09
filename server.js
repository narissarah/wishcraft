const express = require("express");
const { createRequestHandler } = require("@remix-run/express");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

const app = express();

// Log startup information
console.log("🚀 WishCraft Server Starting...");
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`PORT: ${process.env.PORT || 3000}`);
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Not Set'}`);

// Trust proxy for Railway deployments
app.set('trust proxy', true);

// Security middleware - Built for Shopify requirements
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
      frameAncestors: ["https://*.myshopify.com", "https://admin.shopify.com"]
    }
  },
  crossOriginEmbedderPolicy: false, // Required for Shopify embedded apps
  frameguard: false // Disable X-Frame-Options since we're setting frame-ancestors in CSP
}));

// Enable compression for all responses
app.use(compression());

// Request logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Parse JSON bodies
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Rate limiting - Built for Shopify requirement
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  skipSuccessfulRequests: true
});

// Apply rate limiting
app.use('/api/', generalLimiter);
app.use('/auth/', authLimiter);
app.use('/webhooks/', rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100 // Higher limit for webhooks
}));

// Health check endpoints (must be before static file serving)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    database_url_set: !!process.env.DATABASE_URL,
    shopify_configured: !!(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET)
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
app.use(express.static("public"));

// Remix handler for all other routes
app.all(
  "*",
  createRequestHandler({
    build: require("./build/index.js"),
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

// Security headers for Built for Shopify
app.use((req, res, next) => {
  // Additional security headers
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove powered by header
  res.removeHeader('X-Powered-By');
  
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Log error details for monitoring
  console.error('Server Error:', {
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

const server = app.listen(port, host, () => {
  console.log(`✅ WishCraft server is running on http://${host}:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});