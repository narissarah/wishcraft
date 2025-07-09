// Shopify API Usage Monitoring System for WishCraft
// Comprehensive tracking of API calls, rate limits, and performance metrics

import { logger } from './logger';
import { apmManager } from './apm-setup';
import { errorTracker } from './error-tracking';

// Shopify API Types
export enum ShopifyAPIType {
  ADMIN_API = 'admin_api',
  STOREFRONT_API = 'storefront_api',
  PARTNER_API = 'partner_api',
  BILLING_API = 'billing_api',
  WEBHOOK = 'webhook',
  GRAPHQL = 'graphql',
  REST = 'rest'
}

// API Operation Types
export enum APIOperation {
  // Product Operations
  PRODUCTS_QUERY = 'products_query',
  PRODUCT_CREATE = 'product_create',
  PRODUCT_UPDATE = 'product_update',
  PRODUCT_DELETE = 'product_delete',
  
  // Order Operations
  ORDERS_QUERY = 'orders_query',
  ORDER_CREATE = 'order_create',
  ORDER_UPDATE = 'order_update',
  ORDER_FULFILL = 'order_fulfill',
  
  // Customer Operations
  CUSTOMERS_QUERY = 'customers_query',
  CUSTOMER_CREATE = 'customer_create',
  CUSTOMER_UPDATE = 'customer_update',
  
  // Registry Operations
  REGISTRY_CREATE = 'registry_create',
  REGISTRY_UPDATE = 'registry_update',
  REGISTRY_QUERY = 'registry_query',
  REGISTRY_DELETE = 'registry_delete',
  
  // Billing Operations
  SUBSCRIPTION_CREATE = 'subscription_create',
  SUBSCRIPTION_UPDATE = 'subscription_update',
  USAGE_RECORD = 'usage_record',
  
  // Webhook Operations
  WEBHOOK_REGISTER = 'webhook_register',
  WEBHOOK_UPDATE = 'webhook_update',
  WEBHOOK_DELETE = 'webhook_delete'
}

// Rate Limit Information
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  cost: number;
  actualQueryCost?: number;
  throttledCallCredit?: number;
  bucketSize?: number;
  currentlyAvailable?: number;
}

// API Call Metrics
export interface APICallMetrics {
  operation: APIOperation;
  apiType: ShopifyAPIType;
  shopId: string;
  requestId: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  statusCode: number;
  responseSize: number;
  rateLimitInfo: RateLimitInfo;
  error?: {
    type: string;
    message: string;
    code?: string;
  };
  metadata: {
    endpoint: string;
    method: string;
    userAgent: string;
    queryComplexity?: number;
    requestSize: number;
  };
}

// API Health Status
export enum APIHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  CRITICAL = 'critical',
  MAINTENANCE = 'maintenance'
}

// Shopify API Monitor Configuration
export interface ShopifyAPIConfig {
  rateLimitThresholds: {
    warning: number; // 80% of limit
    critical: number; // 95% of limit
  };
  performanceThresholds: {
    slowRequest: number; // 5000ms
    verySlowRequest: number; // 10000ms
  };
  errorThresholds: {
    errorRate: number; // 5% error rate
    consecutiveErrors: number; // 10 consecutive errors
  };
  alerting: {
    enabled: boolean;
    channels: string[];
  };
}

// Shopify API Monitoring Manager
export class ShopifyAPIMonitor {
  private config: ShopifyAPIConfig;
  private apiCalls: Map<string, APICallMetrics> = new Map();
  private rateLimitStatus: Map<string, RateLimitInfo> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();
  private consecutiveErrors: Map<string, number> = new Map();

  constructor(config: ShopifyAPIConfig) {
    this.config = config;
    this.startMonitoring();
  }

  private startMonitoring(): void {
    // Clean up old metrics every 10 minutes
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 600000);

    // Send performance metrics every 30 seconds
    setInterval(() => {
      this.sendPerformanceMetrics();
    }, 30000);

    // Check health status every minute
    setInterval(() => {
      this.checkAPIHealth();
    }, 60000);

    logger.info('Shopify API monitoring initialized');
  }

  // Track API Call
  public trackAPICall(
    operation: APIOperation,
    apiType: ShopifyAPIType,
    shopId: string,
    endpoint: string,
    method: string = 'POST'
  ): string {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    const metrics: APICallMetrics = {
      operation,
      apiType,
      shopId,
      requestId,
      startTime,
      endTime: 0,
      duration: 0,
      success: false,
      statusCode: 0,
      responseSize: 0,
      rateLimitInfo: {
        limit: 0,
        remaining: 0,
        resetTime: 0,
        cost: 0
      },
      metadata: {
        endpoint,
        method,
        userAgent: 'WishCraft/1.0',
        requestSize: 0
      }
    };

    this.apiCalls.set(requestId, metrics);
    return requestId;
  }

  // Complete API Call Tracking
  public completeAPICall(
    requestId: string,
    response: {
      statusCode: number;
      headers: Record<string, string>;
      body?: any;
      error?: Error;
    }
  ): void {
    const metrics = this.apiCalls.get(requestId);
    if (!metrics) return;

    const endTime = Date.now();
    metrics.endTime = endTime;
    metrics.duration = endTime - metrics.startTime;
    metrics.statusCode = response.statusCode;
    metrics.success = response.statusCode >= 200 && response.statusCode < 300;

    // Extract rate limit information
    metrics.rateLimitInfo = this.extractRateLimitInfo(response.headers);

    // Calculate response size
    metrics.responseSize = this.calculateResponseSize(response.body);

    // Handle errors
    if (response.error) {
      metrics.error = {
        type: response.error.name,
        message: response.error.message,
        code: (response.error as any).code
      };
    }

    // Update monitoring data
    this.updateRateLimitStatus(metrics.shopId, metrics.rateLimitInfo);
    this.updatePerformanceMetrics(metrics);
    this.updateErrorTracking(metrics);

    // Send to APM
    this.sendToAPM(metrics);

    // Check for alerts
    this.checkAlertConditions(metrics);

    // Log significant events
    if (!metrics.success || metrics.duration > this.config.performanceThresholds.slowRequest) {
      logger.warn('Shopify API call issue', {
        operation: metrics.operation,
        shopId: metrics.shopId,
        duration: metrics.duration,
        success: metrics.success,
        statusCode: metrics.statusCode,
        rateLimitRemaining: metrics.rateLimitInfo.remaining
      });
    }

    // Clean up completed call
    setTimeout(() => this.apiCalls.delete(requestId), 300000); // Keep for 5 minutes
  }

  private extractRateLimitInfo(headers: Record<string, string>): RateLimitInfo {
    // GraphQL API rate limit headers
    if (headers['x-shopify-shop-api-call-limit']) {
      const [used, limit] = headers['x-shopify-shop-api-call-limit'].split('/').map(Number);
      return {
        limit,
        remaining: limit - used,
        resetTime: Date.now() + 60000, // Resets every minute
        cost: 1
      };
    }

    // REST API rate limit headers
    if (headers['x-shopify-api-version']) {
      return {
        limit: parseInt(headers['x-shopify-shop-api-call-limit']?.split('/')[1] || '40'),
        remaining: parseInt(headers['x-shopify-shop-api-call-limit']?.split('/')[1] || '40') - 
                  parseInt(headers['x-shopify-shop-api-call-limit']?.split('/')[0] || '0'),
        resetTime: Date.now() + 60000,
        cost: 1
      };
    }

    // GraphQL cost-based rate limiting
    if (headers['x-graphql-cost-include-fields']) {
      return {
        limit: parseInt(headers['x-shopify-shop-api-call-limit-cost-available'] || '1000'),
        remaining: parseInt(headers['x-shopify-shop-api-call-limit-cost-remaining'] || '1000'),
        resetTime: Date.now() + parseInt(headers['x-shopify-shop-api-call-limit-cost-reset-at'] || '60') * 1000,
        cost: parseInt(headers['x-graphql-cost-include-fields'] || '1'),
        actualQueryCost: parseInt(headers['x-graphql-cost-include-fields'] || '1'),
        throttledCallCredit: parseInt(headers['x-shopify-shop-api-call-limit-cost-throttled-call-credit'] || '0'),
        bucketSize: parseInt(headers['x-shopify-shop-api-call-limit-cost-bucket-size'] || '1000'),
        currentlyAvailable: parseInt(headers['x-shopify-shop-api-call-limit-cost-currently-available'] || '1000')
      };
    }

    // Default rate limit info
    return {
      limit: 40,
      remaining: 40,
      resetTime: Date.now() + 60000,
      cost: 1
    };
  }

  private calculateResponseSize(body: any): number {
    if (!body) return 0;
    if (typeof body === 'string') return Buffer.byteLength(body, 'utf8');
    return Buffer.byteLength(JSON.stringify(body), 'utf8');
  }

  private updateRateLimitStatus(shopId: string, rateLimitInfo: RateLimitInfo): void {
    this.rateLimitStatus.set(shopId, rateLimitInfo);

    // Check rate limit thresholds
    const utilizationPercent = ((rateLimitInfo.limit - rateLimitInfo.remaining) / rateLimitInfo.limit) * 100;

    if (utilizationPercent >= this.config.rateLimitThresholds.critical) {
      this.sendRateLimitAlert(shopId, 'critical', utilizationPercent, rateLimitInfo);
    } else if (utilizationPercent >= this.config.rateLimitThresholds.warning) {
      this.sendRateLimitAlert(shopId, 'warning', utilizationPercent, rateLimitInfo);
    }
  }

  private updatePerformanceMetrics(metrics: APICallMetrics): void {
    const key = `${metrics.operation}_${metrics.apiType}`;
    const durations = this.performanceMetrics.get(key) || [];
    durations.push(metrics.duration);

    // Keep only last 1000 measurements
    if (durations.length > 1000) {
      durations.splice(0, durations.length - 1000);
    }

    this.performanceMetrics.set(key, durations);
  }

  private updateErrorTracking(metrics: APICallMetrics): void {
    const key = `${metrics.shopId}_${metrics.operation}`;

    if (!metrics.success) {
      // Increment error count
      this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
      
      // Track consecutive errors
      this.consecutiveErrors.set(key, (this.consecutiveErrors.get(key) || 0) + 1);

      // Check consecutive error threshold
      const consecutiveErrorCount = this.consecutiveErrors.get(key) || 0;
      if (consecutiveErrorCount >= this.config.errorThresholds.consecutiveErrors) {
        this.sendConsecutiveErrorAlert(metrics, consecutiveErrorCount);
      }

      // Track error in error tracking system
      if (metrics.error) {
        errorTracker.captureError(new Error(metrics.error.message), {
          shopId: metrics.shopId,
          operation: metrics.operation,
          apiType: metrics.apiType,
          statusCode: metrics.statusCode,
          endpoint: metrics.metadata.endpoint
        });
      }
    } else {
      // Reset consecutive error count on success
      this.consecutiveErrors.set(key, 0);
    }
  }

  private sendToAPM(metrics: APICallMetrics): void {
    // Record timing metrics
    apmManager.recordTiming(
      `shopify_api.${metrics.operation}`,
      metrics.duration,
      {
        apiType: metrics.apiType,
        shopId: metrics.shopId,
        success: metrics.success,
        statusCode: metrics.statusCode
      }
    );

    // Record business metrics
    apmManager.recordBusinessMetric(
      `shopify_api.calls_total`,
      1,
      [`operation:${metrics.operation}`, `api_type:${metrics.apiType}`, `success:${metrics.success}`]
    );

    apmManager.recordBusinessMetric(
      `shopify_api.rate_limit_remaining`,
      metrics.rateLimitInfo.remaining,
      [`shop_id:${metrics.shopId}`]
    );

    apmManager.recordBusinessMetric(
      `shopify_api.response_size`,
      metrics.responseSize,
      [`operation:${metrics.operation}`]
    );
  }

  private checkAlertConditions(metrics: APICallMetrics): void {
    if (!this.config.alerting.enabled) return;

    // Check performance thresholds
    if (metrics.duration > this.config.performanceThresholds.verySlowRequest) {
      this.sendPerformanceAlert(metrics, 'very_slow');
    } else if (metrics.duration > this.config.performanceThresholds.slowRequest) {
      this.sendPerformanceAlert(metrics, 'slow');
    }

    // Check error rate
    this.checkErrorRate(metrics);
  }

  private checkErrorRate(metrics: APICallMetrics): void {
    const key = `${metrics.shopId}_${metrics.operation}`;
    const errorCount = this.errorCounts.get(key) || 0;
    const totalCalls = Array.from(this.apiCalls.values())
      .filter(call => call.shopId === metrics.shopId && call.operation === metrics.operation)
      .length;

    if (totalCalls >= 10) { // Only check after at least 10 calls
      const errorRate = (errorCount / totalCalls) * 100;
      if (errorRate >= this.config.errorThresholds.errorRate) {
        this.sendErrorRateAlert(metrics, errorRate);
      }
    }
  }

  private sendRateLimitAlert(shopId: string, severity: string, utilization: number, rateLimitInfo: RateLimitInfo): void {
    logger.warn('Shopify API rate limit alert', {
      shopId,
      severity,
      utilization,
      remaining: rateLimitInfo.remaining,
      limit: rateLimitInfo.limit,
      resetTime: rateLimitInfo.resetTime
    });

    // Additional alerting logic would go here (Slack, email, etc.)
  }

  private sendPerformanceAlert(metrics: APICallMetrics, severity: string): void {
    logger.warn('Shopify API performance alert', {
      severity,
      operation: metrics.operation,
      shopId: metrics.shopId,
      duration: metrics.duration,
      endpoint: metrics.metadata.endpoint
    });
  }

  private sendConsecutiveErrorAlert(metrics: APICallMetrics, errorCount: number): void {
    logger.error('Shopify API consecutive errors alert', {
      operation: metrics.operation,
      shopId: metrics.shopId,
      consecutiveErrors: errorCount,
      lastError: metrics.error?.message
    });
  }

  private sendErrorRateAlert(metrics: APICallMetrics, errorRate: number): void {
    logger.error('Shopify API high error rate alert', {
      operation: metrics.operation,
      shopId: metrics.shopId,
      errorRate,
      threshold: this.config.errorThresholds.errorRate
    });
  }

  private checkAPIHealth(): void {
    const now = Date.now();
    const last5Minutes = now - 300000;
    
    const recentCalls = Array.from(this.apiCalls.values())
      .filter(call => call.startTime > last5Minutes && call.endTime > 0);

    if (recentCalls.length === 0) return;

    const errorRate = (recentCalls.filter(call => !call.success).length / recentCalls.length) * 100;
    const avgDuration = recentCalls.reduce((sum, call) => sum + call.duration, 0) / recentCalls.length;
    const rateLimitUtilization = this.calculateAverageRateLimitUtilization();

    let healthStatus = APIHealthStatus.HEALTHY;

    if (errorRate > 20 || avgDuration > 10000 || rateLimitUtilization > 95) {
      healthStatus = APIHealthStatus.CRITICAL;
    } else if (errorRate > 10 || avgDuration > 5000 || rateLimitUtilization > 80) {
      healthStatus = APIHealthStatus.DEGRADED;
    }

    // Record health metrics
    apmManager.recordBusinessMetric('shopify_api.health_score', this.getHealthScore(healthStatus));
    apmManager.recordBusinessMetric('shopify_api.error_rate', errorRate);
    apmManager.recordBusinessMetric('shopify_api.avg_duration', avgDuration);
    apmManager.recordBusinessMetric('shopify_api.rate_limit_utilization', rateLimitUtilization);

    if (healthStatus !== APIHealthStatus.HEALTHY) {
      logger.warn('Shopify API health degraded', {
        status: healthStatus,
        errorRate,
        avgDuration,
        rateLimitUtilization,
        recentCallsCount: recentCalls.length
      });
    }
  }

  private calculateAverageRateLimitUtilization(): number {
    const rateLimits = Array.from(this.rateLimitStatus.values());
    if (rateLimits.length === 0) return 0;

    const totalUtilization = rateLimits.reduce((sum, limit) => {
      return sum + ((limit.limit - limit.remaining) / limit.limit) * 100;
    }, 0);

    return totalUtilization / rateLimits.length;
  }

  private getHealthScore(status: APIHealthStatus): number {
    switch (status) {
      case APIHealthStatus.HEALTHY: return 100;
      case APIHealthStatus.DEGRADED: return 60;
      case APIHealthStatus.CRITICAL: return 20;
      case APIHealthStatus.MAINTENANCE: return 0;
      default: return 50;
    }
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - 3600000; // 1 hour ago

    // Clean up API calls
    for (const [requestId, metrics] of this.apiCalls.entries()) {
      if (metrics.endTime > 0 && metrics.endTime < cutoff) {
        this.apiCalls.delete(requestId);
      }
    }

    // Clean up error counts (reset hourly)
    this.errorCounts.clear();

    logger.info('Shopify API metrics cleanup completed');
  }

  private sendPerformanceMetrics(): void {
    for (const [key, durations] of this.performanceMetrics.entries()) {
      if (durations.length === 0) continue;

      const sorted = [...durations].sort((a, b) => a - b);
      const p50 = this.percentile(sorted, 0.5);
      const p95 = this.percentile(sorted, 0.95);
      const p99 = this.percentile(sorted, 0.99);
      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;

      apmManager.recordBusinessMetric(`shopify_api.${key}.p50`, p50);
      apmManager.recordBusinessMetric(`shopify_api.${key}.p95`, p95);
      apmManager.recordBusinessMetric(`shopify_api.${key}.p99`, p99);
      apmManager.recordBusinessMetric(`shopify_api.${key}.avg`, avg);
    }
  }

  private percentile(sortedArray: number[], p: number): number {
    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[index] || 0;
  }

  private generateRequestId(): string {
    return `shopify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API for getting metrics
  public getAPIMetrics(shopId?: string): any {
    const now = Date.now();
    const last24h = now - 86400000;

    const recentCalls = Array.from(this.apiCalls.values())
      .filter(call => {
        const isRecent = call.startTime > last24h;
        const matchesShop = !shopId || call.shopId === shopId;
        return isRecent && matchesShop && call.endTime > 0;
      });

    const totalCalls = recentCalls.length;
    const successfulCalls = recentCalls.filter(call => call.success).length;
    const errorRate = totalCalls > 0 ? ((totalCalls - successfulCalls) / totalCalls) * 100 : 0;

    const avgDuration = totalCalls > 0 
      ? recentCalls.reduce((sum, call) => sum + call.duration, 0) / totalCalls 
      : 0;

    const callsByOperation = recentCalls.reduce((acc, call) => {
      acc[call.operation] = (acc[call.operation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const rateLimitStatus = shopId ? this.rateLimitStatus.get(shopId) : null;

    return {
      totalCalls,
      successfulCalls,
      errorRate,
      avgDuration,
      callsByOperation,
      rateLimitStatus,
      healthStatus: this.getAPIHealth()
    };
  }

  public getAPIHealth(): APIHealthStatus {
    const now = Date.now();
    const last5Minutes = now - 300000;
    
    const recentCalls = Array.from(this.apiCalls.values())
      .filter(call => call.startTime > last5Minutes && call.endTime > 0);

    if (recentCalls.length === 0) return APIHealthStatus.HEALTHY;

    const errorRate = (recentCalls.filter(call => !call.success).length / recentCalls.length) * 100;
    const avgDuration = recentCalls.reduce((sum, call) => sum + call.duration, 0) / recentCalls.length;
    const rateLimitUtilization = this.calculateAverageRateLimitUtilization();

    if (errorRate > 20 || avgDuration > 10000 || rateLimitUtilization > 95) {
      return APIHealthStatus.CRITICAL;
    } else if (errorRate > 10 || avgDuration > 5000 || rateLimitUtilization > 80) {
      return APIHealthStatus.DEGRADED;
    }

    return APIHealthStatus.HEALTHY;
  }

  public getRateLimitStatus(shopId: string): RateLimitInfo | null {
    return this.rateLimitStatus.get(shopId) || null;
  }
}

// Express Middleware for Shopify API Monitoring
export function createShopifyAPIMiddleware(monitor: ShopifyAPIMonitor) {
  return (req: any, res: any, next: any) => {
    // Skip non-Shopify API calls
    if (!req.url.includes('/shopify') && !req.url.includes('/api')) {
      return next();
    }

    const operation = req.body?.query ? APIOperation.REGISTRY_QUERY : APIOperation.REGISTRY_CREATE;
    const apiType = req.url.includes('/graphql') ? ShopifyAPIType.GRAPHQL : ShopifyAPIType.REST;
    const shopId = req.shop?.id || req.headers['x-shopify-shop-domain'] || 'unknown';

    const requestId = monitor.trackAPICall(operation, apiType, shopId, req.url, req.method);

    // Capture original end method
    const originalEnd = res.end;
    res.end = function(chunk: any, encoding: any) {
      monitor.completeAPICall(requestId, {
        statusCode: res.statusCode,
        headers: res.getHeaders() as Record<string, string>,
        body: chunk
      });

      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

// Configuration Factory
export function createShopifyAPIConfig(): ShopifyAPIConfig {
  return {
    rateLimitThresholds: {
      warning: 80, // 80% of rate limit
      critical: 95 // 95% of rate limit
    },
    performanceThresholds: {
      slowRequest: 5000, // 5 seconds
      verySlowRequest: 10000 // 10 seconds
    },
    errorThresholds: {
      errorRate: 5, // 5% error rate
      consecutiveErrors: 10 // 10 consecutive errors
    },
    alerting: {
      enabled: process.env.NODE_ENV === 'production',
      channels: ['slack', 'email']
    }
  };
}

// Export singleton instance
export const shopifyAPIConfig = createShopifyAPIConfig();
export const shopifyAPIMonitor = new ShopifyAPIMonitor(shopifyAPIConfig);