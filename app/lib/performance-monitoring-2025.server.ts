/**
 * Enhanced Performance Monitoring for Shopify 2025 Compliance
 * Implements comprehensive performance tracking and optimization
 */

import { log } from "./logger.server";
import { db } from "./db.server";
import { cache } from "./cache-unified.server";

interface PerformanceMetrics {
  timestamp: number;
  route: string;
  method: string;
  duration: number;
  statusCode: number;
  memoryUsage: NodeJS.MemoryUsage;
  responseSize?: number;
  userId?: string;
  shop?: string;
  apiCalls?: number;
  cacheHits?: number;
  cacheMisses?: number;
}

interface CoreWebVitals {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
}

export class PerformanceMonitoring2025 {
  private metrics: PerformanceMetrics[] = [];
  private readonly maxMetrics = 1000;
  private readonly flushInterval = 30000; // 30 seconds

  constructor() {
    // Auto-flush metrics periodically
    setInterval(() => this.flushMetrics(), this.flushInterval);
  }

  /**
   * Start performance monitoring for a request
   */
  startRequest(route: string, method: string, userId?: string, shop?: string) {
    return {
      startTime: Date.now(),
      route,
      method,
      userId,
      shop,
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * End performance monitoring and record metrics
   */
  endRequest(
    context: ReturnType<typeof this.startRequest>,
    statusCode: number,
    responseSize?: number
  ) {
    const endTime = Date.now();
    const duration = endTime - context.startTime;
    
    const metrics: PerformanceMetrics = {
      timestamp: endTime,
      route: context.route,
      method: context.method,
      duration,
      statusCode,
      memoryUsage: process.memoryUsage(),
      responseSize,
      userId: context.userId,
      shop: context.shop,
      apiCalls: context.apiCalls,
      cacheHits: context.cacheHits,
      cacheMisses: context.cacheMisses
    };

    this.recordMetrics(metrics);
    this.checkPerformanceThresholds(metrics);
  }

  /**
   * Record Core Web Vitals
   */
  async recordCoreWebVitals(
    vitals: CoreWebVitals,
    route: string,
    userId?: string,
    shop?: string
  ) {
    try {
      // Store in database for analysis
      await db.performanceMetrics.createMany({
        data: [
          vitals.lcp && {
            id: this.generateId(),
            metric: 'LCP',
            value: vitals.lcp,
            rating: this.getVitalsRating('LCP', vitals.lcp),
            path: route,
            userId,
            shop,
            createdAt: new Date()
          },
          vitals.fid && {
            id: this.generateId(),
            metric: 'FID',
            value: vitals.fid,
            rating: this.getVitalsRating('FID', vitals.fid),
            path: route,
            userId,
            shop,
            createdAt: new Date()
          },
          vitals.cls && {
            id: this.generateId(),
            metric: 'CLS',
            value: vitals.cls,
            rating: this.getVitalsRating('CLS', vitals.cls),
            path: route,
            userId,
            shop,
            createdAt: new Date()
          },
          vitals.fcp && {
            id: this.generateId(),
            metric: 'FCP',
            value: vitals.fcp,
            rating: this.getVitalsRating('FCP', vitals.fcp),
            path: route,
            userId,
            shop,
            createdAt: new Date()
          },
          vitals.ttfb && {
            id: this.generateId(),
            metric: 'TTFB',
            value: vitals.ttfb,
            rating: this.getVitalsRating('TTFB', vitals.ttfb),
            path: route,
            userId,
            shop,
            createdAt: new Date()
          }
        ].filter(Boolean)
      });

      log.info('Core Web Vitals recorded', { route, vitals });
    } catch (error) {
      log.error('Failed to record Core Web Vitals', error);
    }
  }

  /**
   * Record GraphQL query performance
   */
  async recordGraphQLMetrics(
    queryName: string,
    duration: number,
    complexity: number,
    cacheHit: boolean,
    shop?: string,
    error?: string
  ) {
    try {
      await db.graphqlQueries.create({
        data: {
          id: this.generateId(),
          queryName,
          duration,
          complexity,
          cacheHit,
          errorMessage: error || null,
          shop: shop || null,
          createdAt: new Date()
        }
      });

      // Alert on slow queries
      if (duration > 1000) {
        log.warn('Slow GraphQL query detected', {
          queryName,
          duration,
          complexity,
          shop
        });
      }
    } catch (error) {
      log.error('Failed to record GraphQL metrics', error);
    }
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary(timeRange: '1h' | '24h' | '7d' = '24h') {
    const hoursAgo = {
      '1h': 1,
      '24h': 24,
      '7d': 168
    }[timeRange];

    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    try {
      const [webVitals, slowQueries, errorRates] = await Promise.all([
        this.getWebVitalsSummary(since),
        this.getSlowQueriesSummary(since),
        this.getErrorRatesSummary(since)
      ]);

      return {
        webVitals,
        slowQueries,
        errorRates,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      log.error('Failed to get performance summary', error);
      return null;
    }
  }

  /**
   * Private helper methods
   */
  private recordMetrics(metrics: PerformanceMetrics) {
    this.metrics.push(metrics);
    
    // Keep only recent metrics in memory
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log performance data
    log.info('Request performance', {
      route: metrics.route,
      method: metrics.method,
      duration: metrics.duration,
      statusCode: metrics.statusCode,
      memoryHeap: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024) + 'MB'
    });
  }

  private checkPerformanceThresholds(metrics: PerformanceMetrics) {
    const thresholds = {
      responseTime: 500, // 500ms
      memoryUsage: 500 * 1024 * 1024, // 500MB
      errorRate: 0.05 // 5%
    };

    // Check response time
    if (metrics.duration > thresholds.responseTime) {
      log.warn('Slow response time detected', {
        route: metrics.route,
        duration: metrics.duration,
        threshold: thresholds.responseTime
      });
    }

    // Check memory usage
    if (metrics.memoryUsage.heapUsed > thresholds.memoryUsage) {
      log.warn('High memory usage detected', {
        route: metrics.route,
        heapUsed: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        threshold: Math.round(thresholds.memoryUsage / 1024 / 1024) + 'MB'
      });
    }

    // Check error rates
    if (metrics.statusCode >= 500) {
      log.error('Server error detected', {
        route: metrics.route,
        statusCode: metrics.statusCode
      });
    }
  }

  private async flushMetrics() {
    if (this.metrics.length === 0) return;

    try {
      // Store metrics in cache for dashboard
      await cache.set('performance:metrics', this.metrics, 3600); // 1 hour

      // Clear in-memory metrics
      this.metrics = [];

      log.debug('Performance metrics flushed to cache');
    } catch (error) {
      log.error('Failed to flush performance metrics', error);
    }
  }

  private getVitalsRating(metric: string, value: number): string {
    const thresholds = {
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      FCP: { good: 1800, poor: 3000 },
      TTFB: { good: 800, poor: 1800 }
    };

    const threshold = thresholds[metric as keyof typeof thresholds];
    if (!threshold) return 'unknown';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  private async getWebVitalsSummary(since: Date) {
    // Implementation would query the database for web vitals
    // This is a placeholder for the actual implementation
    return {
      lcp: { average: 2000, p95: 3000, rating: 'good' },
      fid: { average: 50, p95: 100, rating: 'good' },
      cls: { average: 0.05, p95: 0.1, rating: 'good' }
    };
  }

  private async getSlowQueriesSummary(since: Date) {
    // Implementation would query slow GraphQL queries
    return {
      count: 5,
      queries: [
        { name: 'GetProducts', averageDuration: 1200, executions: 50 },
        { name: 'GetCustomers', averageDuration: 800, executions: 30 }
      ]
    };
  }

  private async getErrorRatesSummary(since: Date) {
    // Implementation would calculate error rates
    return {
      overall: 0.02,
      byRoute: {
        '/api/products': 0.01,
        '/api/customers': 0.03
      }
    };
  }

  private generateId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitoring2025();

/**
 * Express middleware for automatic performance monitoring
 */
export function withPerformanceMonitoring(handler: any) {
  return async (request: Request, context: any) => {
    const url = new URL(request.url);
    const shop = url.searchParams.get('shop') || undefined;
    const userId = context?.userId;

    const perfContext = performanceMonitor.startRequest(
      url.pathname,
      request.method,
      userId,
      shop
    );

    try {
      const response = await handler(request, context);
      
      const responseSize = response.headers?.get('content-length') 
        ? parseInt(response.headers.get('content-length')!)
        : undefined;

      performanceMonitor.endRequest(
        perfContext,
        response.status || 200,
        responseSize
      );

      return response;
    } catch (error) {
      performanceMonitor.endRequest(perfContext, 500);
      throw error;
    }
  };
}