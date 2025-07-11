import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
/**
 * Simplified Health Check Endpoint
 * Provides application health status for monitoring and load balancers
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const startTime = Date.now();
    
    // Check database connectivity
    await db.$queryRaw`SELECT 1`;
    
    const dbResponseTime = Date.now() - startTime;
    
    // Check environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'SHOPIFY_API_KEY',
      'SHOPIFY_API_SECRET'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    // Build health status
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: {
          status: 'healthy',
          responseTime: dbResponseTime,
          message: 'Database connection successful'
        },
        environment: {
          status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
          message: missingEnvVars.length === 0 
            ? 'All required environment variables are set'
            : `Missing environment variables: ${missingEnvVars.join(', ')}`
        },
        memory: {
          status: 'healthy',
          usage: process.memoryUsage(),
          freeMemory: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal
        }
      }
    };
    
    // Determine overall health
    const isHealthy = healthStatus.checks.database.status === 'healthy' &&
                     healthStatus.checks.environment.status === 'healthy';
    
    if (!isHealthy) {
      healthStatus.status = 'unhealthy';
    }
    
    return json(healthStatus, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    log.error('Health check failed', error);
    
    return json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: {
        database: {
          status: 'unhealthy',
          message: 'Database connection failed'
        }
      }
    }, {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
}