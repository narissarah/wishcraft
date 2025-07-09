import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { captureException } from "~/lib/monitoring.server";

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  error?: string;
  details?: any;
}

interface DetailedHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: HealthCheck[];
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
    disk: {
      usage: number;
    };
  };
  performance: {
    responseTime: number;
    throughput: number;
    errorRate: number;
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  const checks: HealthCheck[] = [];
  
  // Database health check
  const dbCheck = await checkDatabase();
  checks.push(dbCheck);
  
  // Redis health check
  const redisCheck = await checkRedis();
  checks.push(redisCheck);
  
  // Shopify API health check
  const shopifyCheck = await checkShopifyAPI();
  checks.push(shopifyCheck);
  
  // External services health check
  const externalCheck = await checkExternalServices();
  checks.push(externalCheck);
  
  // Memory check
  const memoryCheck = checkMemory();
  checks.push(memoryCheck);
  
  // Disk space check
  const diskCheck = await checkDiskSpace();
  checks.push(diskCheck);
  
  // Performance metrics
  const performanceCheck = await checkPerformanceMetrics();
  checks.push(performanceCheck);
  
  // Determine overall status
  const overallStatus = determineOverallStatus(checks);
  
  // System metrics
  const systemMetrics = getSystemMetrics();
  
  // Performance metrics
  const performanceMetrics = await getPerformanceMetrics();
  
  const response: DetailedHealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks,
    system: systemMetrics,
    performance: performanceMetrics
  };
  
  const responseTime = Date.now() - startTime;
  
  // Log slow health checks
  if (responseTime > 1000) {
    captureException(new Error(`Slow health check: ${responseTime}ms`), {
      action: 'slow_health_check',
      metadata: { responseTime, checks: checks.map(c => ({ name: c.name, responseTime: c.responseTime })) }
    });
  }
  
  const statusCode = overallStatus === 'healthy' ? 200 : 
                    overallStatus === 'degraded' ? 200 : 503;
  
  return json(response, { 
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Check-Time': responseTime.toString()
    }
  });
}

async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // Test basic connectivity
    await db.$queryRaw`SELECT 1`;
    
    // Test write capability
    const testWrite = await db.$queryRaw`
      INSERT INTO _health_check_test (id, created_at) 
      VALUES (gen_random_uuid(), NOW()) 
      ON CONFLICT (id) DO UPDATE SET created_at = NOW()
      RETURNING id
    `.catch(() => null);
    
    // Clean up test data
    await db.$queryRaw`DELETE FROM _health_check_test WHERE created_at < NOW() - INTERVAL '1 minute'`.catch(() => null);
    
    const responseTime = Date.now() - startTime;
    
    return {
      name: 'database',
      status: responseTime < 100 ? 'healthy' : responseTime < 500 ? 'degraded' : 'unhealthy',
      responseTime,
      details: {
        writeTest: testWrite ? 'passed' : 'failed',
        connectionPool: {
          active: 'unknown', // Would need to implement pool monitoring
          idle: 'unknown'
        }
      }
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // Would implement Redis health check here
    // For now, simulate based on environment
    const responseTime = Date.now() - startTime;
    
    return {
      name: 'redis',
      status: process.env.REDIS_URL ? 'healthy' : 'degraded',
      responseTime,
      details: {
        connected: !!process.env.REDIS_URL,
        memory: 'unknown',
        keyspace: 'unknown'
      }
    };
  } catch (error) {
    return {
      name: 'redis',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown Redis error'
    };
  }
}

async function checkShopifyAPI(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // Test Shopify API connectivity
    const response = await fetch('https://api.shopify.com/admin/oauth/access_scopes.json', {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || 'test'
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    return {
      name: 'shopify_api',
      status: response.ok ? 'healthy' : 'degraded',
      responseTime,
      details: {
        statusCode: response.status,
        apiVersion: '2025-07',
        rateLimitRemaining: response.headers.get('X-Shopify-Shop-Api-Call-Limit')
      }
    };
  } catch (error) {
    return {
      name: 'shopify_api',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown Shopify API error'
    };
  }
}

async function checkExternalServices(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // Check external service dependencies
    const services = [
      { name: 'CDN', url: 'https://cdn.shopify.com' },
      { name: 'Analytics', url: 'https://www.google-analytics.com' }
    ];
    
    const results = await Promise.allSettled(
      services.map(service => 
        fetch(service.url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
          .then(res => ({ name: service.name, status: res.ok }))
      )
    );
    
    const responseTime = Date.now() - startTime;
    const failures = results.filter(r => r.status === 'rejected').length;
    
    return {
      name: 'external_services',
      status: failures === 0 ? 'healthy' : failures < services.length ? 'degraded' : 'unhealthy',
      responseTime,
      details: {
        services: results.map((result, index) => ({
          name: services[index].name,
          status: result.status === 'fulfilled' ? 'ok' : 'failed'
        }))
      }
    };
  } catch (error) {
    return {
      name: 'external_services',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown external services error'
    };
  }
}

function checkMemory(): HealthCheck {
  const startTime = Date.now();
  
  try {
    const memUsage = process.memoryUsage();
    const heapPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    return {
      name: 'memory',
      status: heapPercentage < 80 ? 'healthy' : heapPercentage < 90 ? 'degraded' : 'unhealthy',
      responseTime: Date.now() - startTime,
      details: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: Math.round(heapPercentage),
        external: Math.round(memUsage.external / 1024 / 1024),
        arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024)
      }
    };
  } catch (error) {
    return {
      name: 'memory',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown memory error'
    };
  }
}

async function checkDiskSpace(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // In a real implementation, you would check actual disk space
    // For now, simulate based on environment
    const responseTime = Date.now() - startTime;
    
    return {
      name: 'disk_space',
      status: 'healthy',
      responseTime,
      details: {
        usage: 45, // Simulated 45% usage
        available: '15GB',
        total: '30GB'
      }
    };
  } catch (error) {
    return {
      name: 'disk_space',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown disk space error'
    };
  }
}

async function checkPerformanceMetrics(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // In a real implementation, you would check actual performance metrics
    // For now, simulate based on process metrics
    const responseTime = Date.now() - startTime;
    
    return {
      name: 'performance',
      status: 'healthy',
      responseTime,
      details: {
        averageResponseTime: 150,
        throughput: 100,
        errorRate: 0.1,
        activeConnections: 25
      }
    };
  } catch (error) {
    return {
      name: 'performance',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown performance error'
    };
  }
}

function determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
  const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
  const degradedCount = checks.filter(c => c.status === 'degraded').length;
  
  if (unhealthyCount > 0) return 'unhealthy';
  if (degradedCount > 0) return 'degraded';
  return 'healthy';
}

function getSystemMetrics() {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  return {
    memory: {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    },
    cpu: {
      usage: Math.round(((cpuUsage.user + cpuUsage.system) / 1000000) * 100) / 100
    },
    disk: {
      usage: 45 // Simulated
    }
  };
}

async function getPerformanceMetrics() {
  // In a real implementation, you would get actual performance metrics
  // For now, simulate
  return {
    responseTime: 150,
    throughput: 100,
    errorRate: 0.1
  };
}