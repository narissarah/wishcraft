/**
 * Health Check Utilities - Consistent health endpoint responses
 * Standardizes health check patterns across all health routes
 */

import { json } from '@remix-run/node';

/**
 * Standard health check response with consistent headers
 */
export function healthResponse(data: any, isHealthy: boolean) {
  return json(data, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}

/**
 * Create a standardized health check result
 */
export function createHealthResult(
  service: string,
  isHealthy: boolean,
  responseTime: number,
  error?: string,
  metadata?: Record<string, any>
): {
  service: string;
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  timestamp: string;
  error?: string;
  metadata?: Record<string, any>;
} {
  return {
    service,
    status: isHealthy ? 'healthy' : 'unhealthy',
    responseTime,
    timestamp: new Date().toISOString(),
    ...(error && { error }),
    ...(metadata && { metadata })
  };
}

/**
 * Aggregate multiple health check results
 */
export function aggregateHealthResults(results: Array<{
  service: string;
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  timestamp: string;
  error?: string;
  metadata?: Record<string, any>;
}>) {
  const overallHealth = results.every(result => result.status === 'healthy');
  const totalResponseTime = results.reduce((sum, result) => sum + result.responseTime, 0);
  
  return {
    status: overallHealth ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    totalResponseTime,
    services: results,
    summary: {
      total: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      unhealthy: results.filter(r => r.status === 'unhealthy').length
    }
  };
}

/**
 * Standard timeout for health checks
 */
export const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds

/**
 * Utility to run health check with timeout
 */
export async function runHealthCheck<T>(
  checkFn: () => Promise<T>,
  timeoutMs: number = HEALTH_CHECK_TIMEOUT
): Promise<{ success: boolean; result?: T; error?: string; responseTime: number }> {
  const startTime = Date.now();
  
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), timeoutMs);
    });
    
    const result = await Promise.race([checkFn(), timeoutPromise]);
    
    return {
      success: true,
      result,
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    };
  }
}