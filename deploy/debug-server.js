/**
 * Debug Server - Enhanced logging version of the main server
 * Use this to identify exactly where the server is crashing
 */

console.log('[DEBUG] Starting debug server initialization...');
console.log('[DEBUG] Current directory:', process.cwd());
console.log('[DEBUG] Node version:', process.version);
console.log('[DEBUG] Process PID:', process.pid);

// Log all environment variables (sanitized)
console.log('[DEBUG] Environment variables:');
Object.keys(process.env).forEach(key => {
  const value = process.env[key];
  if (key.includes('SECRET') || key.includes('KEY') || key.includes('PASSWORD') || key.includes('DATABASE_URL')) {
    console.log(`[DEBUG]   ${key}: [REDACTED - length: ${value ? value.length : 0}]`);
  } else {
    console.log(`[DEBUG]   ${key}: ${value}`);
  }
});

// Try to load modules with error handling
const modules = {};

try {
  console.log('[DEBUG] Loading express...');
  modules.express = require("express");
  console.log('[DEBUG] ✅ Express loaded successfully');
} catch (error) {
  console.error('[DEBUG] ❌ Failed to load express:', error.message);
  process.exit(1);
}

try {
  console.log('[DEBUG] Loading @remix-run/express...');
  modules.createRequestHandler = require("@remix-run/express").createRequestHandler;
  console.log('[DEBUG] ✅ @remix-run/express loaded successfully');
} catch (error) {
  console.error('[DEBUG] ❌ Failed to load @remix-run/express:', error.message);
  process.exit(1);
}

try {
  console.log('[DEBUG] Loading @prisma/client...');
  modules.PrismaClient = require("@prisma/client").PrismaClient;
  console.log('[DEBUG] ✅ @prisma/client loaded successfully');
} catch (error) {
  console.error('[DEBUG] ❌ Failed to load @prisma/client:', error.message);
  console.error('[DEBUG] This usually means Prisma client needs to be generated');
  console.error('[DEBUG] Run: npx prisma generate');
}

// Check if build exists
const fs = require('fs');
const path = require('path');
const buildPath = path.join(__dirname, '..', 'build', 'index.js');
console.log('[DEBUG] Checking for build at:', buildPath);
if (fs.existsSync(buildPath)) {
  console.log('[DEBUG] ✅ Build file exists');
  try {
    const buildStats = fs.statSync(buildPath);
    console.log('[DEBUG] Build file size:', buildStats.size, 'bytes');
    console.log('[DEBUG] Build file modified:', buildStats.mtime);
  } catch (error) {
    console.error('[DEBUG] Error reading build stats:', error.message);
  }
} else {
  console.error('[DEBUG] ❌ Build file not found!');
  console.error('[DEBUG] Run: npm run build');
}

// Initialize Express app
console.log('[DEBUG] Creating Express app...');
const app = modules.express();
console.log('[DEBUG] ✅ Express app created');

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[DEBUG] ${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Trust proxy
console.log('[DEBUG] Setting trust proxy...');
app.set('trust proxy', true);

// Health endpoints
console.log('[DEBUG] Setting up health endpoints...');
app.get('/health', (req, res) => {
  console.log('[DEBUG] Health check requested');
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    debug: true
  });
});

app.get('/health/db', async (req, res) => {
  console.log('[DEBUG] Database health check requested');
  if (!modules.PrismaClient) {
    console.error('[DEBUG] PrismaClient not available');
    return res.status(500).json({ status: 'unhealthy', error: 'Prisma client not loaded' });
  }
  
  try {
    const prisma = new modules.PrismaClient();
    console.log('[DEBUG] Connecting to database...');
    await prisma.$connect();
    console.log('[DEBUG] ✅ Database connected');
    await prisma.$disconnect();
    console.log('[DEBUG] ✅ Database disconnected');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    console.error('[DEBUG] Database health check failed:', error);
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Static files
console.log('[DEBUG] Setting up static file serving...');
const publicPath = path.join(__dirname, '..', 'public');
console.log('[DEBUG] Public path:', publicPath);
if (fs.existsSync(publicPath)) {
  app.use(modules.express.static(publicPath));
  console.log('[DEBUG] ✅ Static file serving configured');
} else {
  console.warn('[DEBUG] ⚠️  Public directory not found');
}

// Remix handler
console.log('[DEBUG] Setting up Remix handler...');
if (fs.existsSync(buildPath)) {
  try {
    console.log('[DEBUG] Loading build file...');
    const build = require(buildPath);
    console.log('[DEBUG] ✅ Build file loaded');
    console.log('[DEBUG] Build keys:', Object.keys(build));
    
    app.all("*", modules.createRequestHandler({
      build: build,
      mode: process.env.NODE_ENV,
      getLoadContext() {
        console.log('[DEBUG] getLoadContext called');
        return {};
      }
    }));
    console.log('[DEBUG] ✅ Remix handler configured');
  } catch (error) {
    console.error('[DEBUG] ❌ Failed to set up Remix handler:', error);
    console.error('[DEBUG] Stack trace:', error.stack);
  }
} else {
  console.error('[DEBUG] ❌ Cannot set up Remix handler - build not found');
}

// Error handling
app.use((err, req, res, next) => {
  console.error('[DEBUG] Express error handler:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
const port = process.env.PORT || 3000;
const host = process.env.HOST || "0.0.0.0";

console.log('[DEBUG] Starting server...');
console.log(`[DEBUG] Host: ${host}`);
console.log(`[DEBUG] Port: ${port}`);

try {
  const server = app.listen(port, host, (error) => {
    if (error) {
      console.error('[DEBUG] ❌ Server failed to start:', error);
      process.exit(1);
    }
    console.log(`[DEBUG] ✅ Server is running on http://${host}:${port}`);
    console.log('[DEBUG] Server initialization complete');
    
    // Log server address info
    const address = server.address();
    console.log('[DEBUG] Server address info:', address);
  });
  
  // Add error handler for server
  server.on('error', (error) => {
    console.error('[DEBUG] Server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`[DEBUG] Port ${port} is already in use`);
    }
    process.exit(1);
  });
  
  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`[DEBUG] ${signal} received, shutting down gracefully`);
    server.close(() => {
      console.log('[DEBUG] HTTP server closed');
      process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('[DEBUG] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
} catch (error) {
  console.error('[DEBUG] ❌ Failed to start server:', error);
  process.exit(1);
}

// Uncaught errors
process.on('uncaughtException', (err) => {
  console.error('[DEBUG] Uncaught Exception:', err);
  console.error('[DEBUG] Stack:', err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[DEBUG] Unhandled Rejection at:', promise);
  console.error('[DEBUG] Reason:', reason);
  process.exit(1);
});

console.log('[DEBUG] Debug server setup complete, waiting for requests...');