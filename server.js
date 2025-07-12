import express from "express";
import { createRequestHandler } from "@remix-run/express";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

// Async function to handle top-level await
async function startServer() {
  const app = express();

// Startup information logged in production startup section below;

// Trust proxy for Railway deployments
app.set('trust proxy', true);

// REMOVED: HTTPS redirection handled by Shopify CLI

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
      // Allow both HTTP and HTTPS for local development
      frameAncestors: [
        "https://*.myshopify.com", 
        "https://admin.shopify.com",
        "http://localhost:*", // Allow HTTP localhost for development
        "https://localhost:*" // Allow HTTPS localhost for development
      ]
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
app.use('/api/', generalLimiter);
// Only apply auth rate limiting in production to avoid development issues
if (process.env.NODE_ENV === 'production') {
  app.use('/auth/', authLimiter);
}
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
app.use(express.static("public"));

// Remix handler for all other routes
const build = await import("./build/index.js");
app.all(
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
app.use((err, req, res, next) => {
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

const server = app.listen(port, host, async () => {
  console.log(`✅ WishCraft server running on port ${port} (${process.env.NODE_ENV})`);
  
  // Background job processor removed for production stability
});

  // Graceful shutdown
  const gracefulShutdown = async () => {
    if (process.env.NODE_ENV !== 'production') console.log('Shutting down gracefully...');
    
    // Background jobs removed for production stability
    
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