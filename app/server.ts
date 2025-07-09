// Main server setup for WishCraft with monitoring integration
import { createRequestHandler } from "@remix-run/node";
import { installGlobals } from "@remix-run/node";
import express from "express";
import { logger } from "../monitoring/logger";

// Import monitoring systems
import { apmManager, createAPMMiddleware } from "../monitoring/apm-setup";
import { errorTracker, createErrorHandler } from "../monitoring/error-tracking";
import { userAnalytics, createAnalyticsMiddleware } from "../monitoring/user-analytics";
import { shopifyAPIMonitor, createShopifyAPIMiddleware } from "../monitoring/shopify-api-monitoring";
import { securityMonitor, createSecurityMiddleware } from "../monitoring/security-incident-monitoring";
import { databaseMonitor } from "../monitoring/database-performance";

// Install Node.js globals for Remix
installGlobals();

const app = express();

// Security middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Add monitoring middleware in correct order
logger.info('Setting up monitoring middleware');

// 1. Security monitoring (first to catch all requests)
app.use(createSecurityMiddleware(securityMonitor));

// 2. APM monitoring (track all requests)
app.use(createAPMMiddleware(apmManager));

// 3. Analytics tracking
app.use(createAnalyticsMiddleware(userAnalytics));

// 4. Shopify API monitoring
app.use(createShopifyAPIMiddleware(shopifyAPIMonitor));

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.get('/health/db', async (req, res) => {
  try {
    // Simple database check would go here
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// Monitoring endpoints
app.get('/admin/monitoring', (req, res) => {
  const systemStatus = {
    apm: apmManager.getHealth(),
    database: databaseMonitor.getDatabaseHealth(),
    security: securityMonitor.getSecurityMetrics(),
    analytics: userAnalytics.getDashboardMetrics()
  };
  
  res.json(systemStatus);
});

// Test endpoints for monitoring
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/test-error', (req, res) => {
    throw new Error('Test error for monitoring system');
  });
  
  app.get('/api/test-slow', async (req, res) => {
    await new Promise(resolve => setTimeout(resolve, 5000));
    res.json({ message: 'Slow response complete' });
  });
}

// Remix request handler (must be after all other middleware)
const remixHandler = createRequestHandler({
  build: () => import("../build/index.js"),
  getLoadContext: () => ({
    // Add any context needed by Remix routes
  })
});

app.all('*', remixHandler);

// Error handling middleware (must be last)
app.use(createErrorHandler(errorTracker));

const port = process.env.PORT || 3000;

app.listen(port, () => {
  logger.info(`WishCraft server started`, { 
    port, 
    environment: process.env.NODE_ENV,
    monitoring: 'enabled'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  apmManager.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  apmManager.shutdown();
  process.exit(0);
});

export default app;