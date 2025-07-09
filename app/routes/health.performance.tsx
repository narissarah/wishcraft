// Performance health check endpoint
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { performanceAnalytics } from '~/lib/performance-dashboard.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const start = Date.now();
  
  try {
    // Get recent performance metrics
    const metrics = await performanceAnalytics.getRecentMetrics();
    const responseTime = Date.now() - start;
    
    // Performance thresholds
    const thresholds = {
      avgLCP: 2500,  // 2.5s
      avgFID: 100,   // 100ms
      avgCLS: 0.1,   // 0.1
      errorRate: 5   // 5%
    };
    
    // Check if performance is within acceptable limits
    const isHealthy = 
      metrics.avgLCP <= thresholds.avgLCP &&
      metrics.avgFID <= thresholds.avgFID &&
      metrics.avgCLS <= thresholds.avgCLS &&
      metrics.errorRate <= thresholds.errorRate;
    
    const health = {
      status: isHealthy ? 'healthy' : 'degraded',
      service: 'performance',
      timestamp: new Date().toISOString(),
      responseTime,
      metrics: {
        avgLCP: metrics.avgLCP,
        avgFID: metrics.avgFID,
        avgCLS: metrics.avgCLS,
        errorRate: metrics.errorRate
      },
      thresholds,
      issues: []
    };
    
    // Add specific issues
    if (metrics.avgLCP > thresholds.avgLCP) {
      health.issues.push(`LCP ${metrics.avgLCP}ms exceeds threshold ${thresholds.avgLCP}ms`);
    }
    if (metrics.avgFID > thresholds.avgFID) {
      health.issues.push(`FID ${metrics.avgFID}ms exceeds threshold ${thresholds.avgFID}ms`);
    }
    if (metrics.avgCLS > thresholds.avgCLS) {
      health.issues.push(`CLS ${metrics.avgCLS} exceeds threshold ${thresholds.avgCLS}`);
    }
    if (metrics.errorRate > thresholds.errorRate) {
      health.issues.push(`Error rate ${metrics.errorRate}% exceeds threshold ${thresholds.errorRate}%`);
    }

    return json(health, { 
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - start;
    
    return json(
      {
        status: 'unhealthy',
        service: 'performance',
        timestamp: new Date().toISOString(),
        responseTime,
        error: error instanceof Error ? error.message : 'Performance monitoring unavailable'
      },
      { status: 503 }
    );
  }
}