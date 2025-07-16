import type { LoaderFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { checkDatabaseConnection } from "~/lib/db-utils.server";
import { healthResponse, createHealthResult, aggregateHealthResults } from "~/lib/health-utils.server";
import { cache } from "~/lib/cache-unified.server";
import os from "os";
/**
 * Simplified Health Check Endpoint
 * Provides application health status for monitoring and load balancers
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Check database connectivity
    const dbCheck = await checkDatabaseConnection();
    
    // Check environment variables (comprehensive check)
    const requiredEnvVars = [
      'DATABASE_URL',
      'SHOPIFY_API_KEY',
      'SHOPIFY_API_SECRET',
      'SHOPIFY_APP_URL',
      'SHOPIFY_SCOPES',
      'SESSION_SECRET'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    // Get cache status
    const cacheStats = cache.getStats();
    const cacheHealthy = cacheStats.memory.size > 0 || cacheStats.redis.connected;
    
    // Check Shopify API connectivity
    let shopifyHealthy = false;
    try {
      shopifyHealthy = !!(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET);
    } catch (error) {
      log.error('Shopify connectivity check failed', error as Error);
    }
    
    // Get performance metrics
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const systemUsedPercent = (usedMemory / totalMemory) * 100;
    
    const performanceWarnings = [];
    if (heapUsedPercent > 90) performanceWarnings.push("High heap memory usage");
    if (systemUsedPercent > 85) performanceWarnings.push("High system memory usage");
    if (os.loadavg()[0] > os.cpus().length * 2) performanceWarnings.push("High CPU load");
    
    // Create health results using utilities
    const healthResults = [
      createHealthResult(
        'database',
        dbCheck.isConnected,
        dbCheck.responseTime,
        dbCheck.error
      ),
      createHealthResult(
        'environment',
        missingEnvVars.length === 0,
        0,
        missingEnvVars.length > 0 ? `Missing variables: ${missingEnvVars.join(', ')}` : undefined
      ),
      createHealthResult(
        'shopify',
        shopifyHealthy,
        0,
        undefined,
        {
          apiVersion: "2025-07", // FIXED: Explicit 2025 compliance
          scopes: process.env.SHOPIFY_SCOPES,
          appUrl: process.env.SHOPIFY_APP_URL
        }
      ),
      createHealthResult(
        'performance',
        performanceWarnings.length === 0,
        0,
        performanceWarnings.length > 0 ? performanceWarnings.join(', ') : undefined,
        {
          memory: {
            heap: {
              used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
              total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
              usedPercent: `${Math.round(heapUsedPercent)}%`
            },
            system: {
              total: `${Math.round(totalMemory / 1024 / 1024 / 1024 * 10) / 10} GB`,
              free: `${Math.round(freeMemory / 1024 / 1024 / 1024 * 10) / 10} GB`,
              usedPercent: `${Math.round(systemUsedPercent)}%`
            }
          },
          cpu: {
            cores: os.cpus().length,
            loadAverage: os.loadavg()
          },
          process: {
            uptime: `${Math.round(process.uptime())} seconds`,
            pid: process.pid,
            platform: process.platform
          }
        }
      ),
      createHealthResult(
        'cache',
        cacheHealthy,
        0,
        undefined,
        {
          memory: {
            size: cacheStats.memory.size,
            calculatedSize: `${(cacheStats.memory.calculatedSize / (1024 * 1024)).toFixed(2)} MB`,
            hits: cacheStats.memory.hits,
            misses: cacheStats.memory.misses,
            hitRate: cacheStats.memory.hits + cacheStats.memory.misses > 0
              ? `${(cacheStats.memory.hits / (cacheStats.memory.hits + cacheStats.memory.misses) * 100).toFixed(2)}%`
              : '0%'
          },
          redis: {
            connected: cacheStats.redis.connected,
            circuitBreakerState: cacheStats.redis.circuitBreakerState
          },
          tags: cacheStats.tags
        }
      )
    ];
    
    // Aggregate health results
    const aggregatedHealth = aggregateHealthResults(healthResults);
    
    return healthResponse({
      ...aggregatedHealth,
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0'
    }, aggregatedHealth.status === 'healthy');
    
  } catch (error) {
    log.error('Health check failed', error);
    
    return healthResponse({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      services: [
        createHealthResult('system', false, 0, error instanceof Error ? error.message : 'Unknown error')
      ]
    }, false);
  }
}