// Application Performance Monitoring Setup for WishCraft
// Comprehensive APM with multiple providers and custom metrics

import { StatsD } from 'node-statsd';
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { logger } from './logger';

// APM Configuration
export interface APMConfig {
  datadogEnabled: boolean;
  sentryEnabled: boolean;
  newRelicEnabled: boolean;
  customMetricsEnabled: boolean;
  samplingRate: number;
  environment: string;
}

// Performance Metrics Interface
export interface PerformanceMetrics {
  // Response Time Metrics
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
  };
  
  // Throughput Metrics
  throughput: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    peakRPS: number;
  };
  
  // Error Metrics
  errors: {
    errorRate: number;
    totalErrors: number;
    errorsByType: Record<string, number>;
  };
  
  // Resource Utilization
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkIO: number;
  };
  
  // Business Metrics
  business: {
    activeUsers: number;
    registriesCreated: number;
    ordersProcessed: number;
    revenue: number;
  };
}

// APM Manager Class
export class APMManager {
  private config: APMConfig;
  private statsD: StatsD;
  private metrics: Map<string, any> = new Map();
  private timers: Map<string, number> = new Map();

  constructor(config: APMConfig) {
    this.config = config;
    this.initializeAPM();
    this.setupMetricsCollection();
  }

  private initializeAPM(): void {
    // Sentry APM Setup
    if (this.config.sentryEnabled) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: this.config.environment,
        tracesSampleRate: this.config.samplingRate,
        profilesSampleRate: this.config.samplingRate,
        integrations: [
          new ProfilingIntegration(),
          new Sentry.Integrations.Http({ tracing: true }),
          new Sentry.Integrations.Express({ app: true }),
          new Sentry.Integrations.Prisma({ client: this.getPrismaClient() })
        ],
        beforeSend: (event) => {
          // Filter out noise and sensitive data
          return this.filterSentryEvent(event);
        }
      });
    }

    // Datadog StatsD Setup
    if (this.config.datadogEnabled) {
      this.statsD = new StatsD({
        host: process.env.DD_AGENT_HOST || 'localhost',
        port: parseInt(process.env.DD_AGENT_PORT || '8125'),
        prefix: 'wishcraft.',
        suffix: '',
        globalize: false,
        cacheDns: true,
        mock: false
      });
    }

    // New Relic Setup
    if (this.config.newRelicEnabled) {
      require('newrelic');
    }

    logger.info('APM initialized', {
      sentry: this.config.sentryEnabled,
      datadog: this.config.datadogEnabled,
      newRelic: this.config.newRelicEnabled
    });
  }

  private setupMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Collect business metrics every minute
    setInterval(() => {
      this.collectBusinessMetrics();
    }, 60000);

    // Send custom metrics every 10 seconds
    setInterval(() => {
      this.sendCustomMetrics();
    }, 10000);
  }

  // Request Timing
  public startTimer(operation: string): string {
    const timerId = `${operation}-${Date.now()}-${Math.random()}`;
    this.timers.set(timerId, performance.now());
    return timerId;
  }

  public endTimer(timerId: string, metadata?: Record<string, any>): number {
    const startTime = this.timers.get(timerId);
    if (!startTime) return 0;

    const duration = performance.now() - startTime;
    this.timers.delete(timerId);

    // Extract operation name from timer ID
    const operation = timerId.split('-')[0];

    // Send to APM services
    this.recordTiming(operation, duration, metadata);

    return duration;
  }

  // Metric Recording
  public recordTiming(operation: string, duration: number, metadata?: Record<string, any>): void {
    // Sentry performance
    if (this.config.sentryEnabled) {
      Sentry.addBreadcrumb({
        category: 'performance',
        message: `${operation} completed`,
        level: 'info',
        data: { duration, ...metadata }
      });
    }

    // Datadog metrics
    if (this.config.datadogEnabled) {
      this.statsD.histogram(`operation.duration`, duration, [`operation:${operation}`]);
      this.statsD.increment(`operation.count`, 1, [`operation:${operation}`]);
    }

    // Custom metrics storage
    this.updateCustomMetrics(operation, duration, metadata);

    // Log slow operations
    if (duration > 5000) { // 5 seconds threshold
      logger.warn('Slow operation detected', {
        operation,
        duration,
        metadata
      });
    }
  }

  public recordError(error: Error, context?: Record<string, any>): void {
    // Sentry error tracking
    if (this.config.sentryEnabled) {
      Sentry.withScope((scope) => {
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setContext(key, value);
          });
        }
        Sentry.captureException(error);
      });
    }

    // Datadog error metrics
    if (this.config.datadogEnabled) {
      this.statsD.increment('errors.total', 1, [`error_type:${error.name}`]);
    }

    // Enhanced logging
    logger.error('Application error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context
    });
  }

  public recordBusinessMetric(metric: string, value: number, tags?: string[]): void {
    // Datadog business metrics
    if (this.config.datadogEnabled) {
      this.statsD.gauge(`business.${metric}`, value, tags);
    }

    // Custom analytics
    this.metrics.set(`business.${metric}`, {
      value,
      timestamp: Date.now(),
      tags
    });

    logger.info('Business metric recorded', { metric, value, tags });
  }

  // System Metrics Collection
  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metrics = {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length
    };

    // Send to Datadog
    if (this.config.datadogEnabled) {
      this.statsD.gauge('system.memory.heap_used', metrics.memory.heapUsed);
      this.statsD.gauge('system.memory.heap_total', metrics.memory.heapTotal);
      this.statsD.gauge('system.memory.external', metrics.memory.external);
      this.statsD.gauge('system.memory.rss', metrics.memory.rss);
      this.statsD.gauge('system.uptime', metrics.uptime);
      this.statsD.gauge('system.active_handles', metrics.activeHandles);
      this.statsD.gauge('system.active_requests', metrics.activeRequests);
    }

    // Store custom metrics
    this.metrics.set('system', { ...metrics, timestamp: Date.now() });
  }

  private async collectBusinessMetrics(): Promise<void> {
    try {
      // These would typically query your database
      const businessMetrics = await this.getBusinessMetrics();

      // Record business KPIs
      this.recordBusinessMetric('active_users', businessMetrics.activeUsers);
      this.recordBusinessMetric('registries_created_today', businessMetrics.registriesToday);
      this.recordBusinessMetric('orders_processed_today', businessMetrics.ordersToday);
      this.recordBusinessMetric('revenue_today', businessMetrics.revenueToday);
      this.recordBusinessMetric('conversion_rate', businessMetrics.conversionRate);

    } catch (error) {
      this.recordError(error as Error, { context: 'business_metrics_collection' });
    }
  }

  private async getBusinessMetrics(): Promise<any> {
    // This would integrate with your database
    // For now, returning mock data structure
    return {
      activeUsers: 150,
      registriesToday: 25,
      ordersToday: 45,
      revenueToday: 1250.00,
      conversionRate: 0.18
    };
  }

  private updateCustomMetrics(operation: string, duration: number, metadata?: Record<string, any>): void {
    const key = `timing.${operation}`;
    const existing = this.metrics.get(key) || { durations: [], count: 0 };
    
    existing.durations.push(duration);
    existing.count++;
    existing.lastUpdated = Date.now();
    
    // Keep only last 1000 measurements
    if (existing.durations.length > 1000) {
      existing.durations = existing.durations.slice(-1000);
    }
    
    this.metrics.set(key, existing);
  }

  private sendCustomMetrics(): void {
    // Calculate and send derived metrics
    for (const [key, data] of this.metrics.entries()) {
      if (key.startsWith('timing.') && data.durations && data.durations.length > 0) {
        const durations = data.durations;
        const sorted = [...durations].sort((a, b) => a - b);
        
        const metrics = {
          p50: this.percentile(sorted, 0.5),
          p95: this.percentile(sorted, 0.95),
          p99: this.percentile(sorted, 0.99),
          average: durations.reduce((a, b) => a + b, 0) / durations.length,
          count: data.count
        };

        if (this.config.datadogEnabled) {
          const operation = key.replace('timing.', '');
          this.statsD.histogram(`${operation}.p50`, metrics.p50);
          this.statsD.histogram(`${operation}.p95`, metrics.p95);
          this.statsD.histogram(`${operation}.p99`, metrics.p99);
          this.statsD.histogram(`${operation}.average`, metrics.average);
        }
      }
    }
  }

  private percentile(sortedArray: number[], p: number): number {
    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[index] || 0;
  }

  private filterSentryEvent(event: any): any {
    // Remove sensitive data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers?.authorization;
    }

    // Filter out noisy errors
    const ignoredErrors = [
      'NetworkError',
      'ChunkLoadError',
      'Non-Error promise rejection captured'
    ];

    if (event.exception?.values?.[0]?.type && 
        ignoredErrors.includes(event.exception.values[0].type)) {
      return null;
    }

    return event;
  }

  private getPrismaClient(): any {
    // Return your Prisma client instance
    // This would be imported from your database setup
    return null;
  }

  // Health Check
  public getHealth(): { status: string; metrics: any } {
    const systemMetrics = this.metrics.get('system');
    const isHealthy = systemMetrics && 
      systemMetrics.memory.heapUsed < systemMetrics.memory.heapTotal * 0.9;

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      metrics: {
        uptime: process.uptime(),
        memoryUsage: systemMetrics?.memory || {},
        errors: this.metrics.get('errors') || {},
        activeConnections: this.metrics.get('activeConnections') || 0
      }
    };
  }

  // Cleanup
  public shutdown(): void {
    if (this.config.sentryEnabled) {
      Sentry.close(2000);
    }

    if (this.config.datadogEnabled) {
      this.statsD.close();
    }

    logger.info('APM shutdown completed');
  }
}

// Express Middleware for APM
export function createAPMMiddleware(apmManager: APMManager) {
  return (req: any, res: any, next: any) => {
    const timerId = apmManager.startTimer('http_request');
    
    // Add metadata
    const metadata = {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };

    res.on('finish', () => {
      const duration = apmManager.endTimer(timerId, {
        ...metadata,
        statusCode: res.statusCode,
        contentLength: res.get('Content-Length')
      });

      // Record error if status code indicates an error
      if (res.statusCode >= 400) {
        apmManager.recordBusinessMetric('http_errors', 1, [
          `status:${res.statusCode}`,
          `method:${req.method}`
        ]);
      }
    });

    next();
  };
}

// Configuration Factory
export function createAPMConfig(): APMConfig {
  return {
    datadogEnabled: !!process.env.DD_API_KEY,
    sentryEnabled: !!process.env.SENTRY_DSN,
    newRelicEnabled: !!process.env.NEW_RELIC_LICENSE_KEY,
    customMetricsEnabled: true,
    samplingRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    environment: process.env.NODE_ENV || 'development'
  };
}

// Export singleton instance
export const apmConfig = createAPMConfig();
export const apmManager = new APMManager(apmConfig);