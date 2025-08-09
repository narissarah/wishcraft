import express from "express";
import { createRequestHandler } from "@remix-run/express";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

// Initialize Prisma client
const prisma = new PrismaClient();

// Async function to handle top-level await and proper initialization
async function startServer() {
  console.log('🚀 Starting WishCraft Production Server');
  console.log('🔧 Environment:', process.env.NODE_ENV);
  console.log('🔧 Port:', process.env.PORT || 3000);
  
  // Validate critical environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'SHOPIFY_API_KEY', 
    'SHOPIFY_API_SECRET',
    'SHOPIFY_APP_URL',
    'SESSION_SECRET',
    'ENCRYPTION_KEY'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('⚠️  Missing required environment variables:', missingVars);
    console.log('⚠️  Continuing with deployment...');
  } else {
    console.log('✅ Environment variables validated successfully');
  }
  
  // Verify database connection
  let dbConnected = false;
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected successfully');
    dbConnected = true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    // Continue without DB connection - health checks will handle this
  }
  
  const app = express();

  // Trust proxy
  app.set('trust proxy', true);

  // Basic health check endpoints
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/health/db', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'healthy', db: 'connected' });
    } catch (error) {
      res.status(503).json({ status: 'unhealthy', db: 'disconnected', error: error.message });
    }
  });

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // CSP is handled in Remix
    crossOriginEmbedderPolicy: false
  }));

  // Compression
  app.use(compression());

  // Request logging
  if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined'));
  } else {
    app.use(morgan('dev'));
  }

  // Rate limiting
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ 
        error: 'Too many requests', 
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000) 
      });
    }
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ 
        error: 'Too many authentication attempts', 
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000) 
      });
    }
  });

  // Apply rate limiting
  app.use('/api/', generalLimiter);
  app.use('/auth/', authLimiter);

  // Serve static files
  app.use(express.static("public", { maxAge: "1h" }));
  app.use(express.static("build/client", { maxAge: "1h" }));

  // CSP nonce generation middleware
  app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
  });

  // Remix request handler
  const remixHandler = createRequestHandler({
    build: await import("./build/index.js"),
    mode: process.env.NODE_ENV,
    getLoadContext(req, res) {
      return {
        cspNonce: res.locals.cspNonce,
        db: prisma
      };
    }
  });

  // All other routes handled by Remix
  app.all("*", remixHandler);

  // Graceful shutdown
  const gracefulShutdown = async () => {
    console.log('📉 Received shutdown signal, closing gracefully...');
    
    try {
      await prisma.$disconnect();
      console.log('✅ Database disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting database:', error);
    }
    
    process.exit(0);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  // Start server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔒 HTTPS: ${process.env.NODE_ENV === 'production' ? 'Enabled via proxy' : 'Disabled (dev)'}`);
  });
}

// Start the server
startServer().catch(error => {
  console.error('💥 Server startup failed:', error);
  process.exit(1);
});