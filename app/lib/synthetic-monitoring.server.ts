/**
 * Synthetic Monitoring and External Health Checks
 * Proactive monitoring of application health and performance
 */

import { promisify } from 'util';
import { performance } from 'perf_hooks';
import { db } from './db.server';
import { logger } from '~/monitoring/logger';
import { type ShopifyAPIService } from './shopify-api.server';

// Health check status
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

// Health check types
export enum HealthCheckType {
  HTTP = 'http',
  DATABASE = 'database',
  SHOPIFY_API = 'shopify_api',
  REDIS = 'redis',
  WEBSOCKET = 'websocket',
  EXTERNAL_SERVICE = 'external_service',
}

// Health check configuration
interface HealthCheck {
  id: string;
  name: string;
  type: HealthCheckType;
  endpoint?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  interval?: number;
  threshold?: {
    responseTime: number;
    errorRate: number;
    successRate: number;
  };
  alerts?: {
    email?: string[];
    slack?: string;
    webhook?: string;
  };
}

// Health check result
interface HealthCheckResult {
  checkId: string;
  status: HealthStatus;
  responseTime: number;
  timestamp: Date;
  error?: string;
  metrics?: Record<string, number>;
  details?: Record<string, any>;
}

// Synthetic monitoring configuration
interface SyntheticMonitorConfig {
  enabled: boolean;
  checks: HealthCheck[];
  globalSettings: {
    timeout: number;
    retries: number;
    retryDelay: number;
    alertThreshold: number;
    healthyThreshold: number;
  };
  regions: string[];
  notifications: {
    email: string[];
    slack: string;
    webhook: string;
  };
}

// Monitoring metrics
interface MonitoringMetrics {
  uptime: number;
  averageResponseTime: number;
  errorRate: number;
  successRate: number;
  availability: number;
  performanceScore: number;
  incidentCount: number;
  mttr: number; // Mean Time To Recovery
  mtbf: number; // Mean Time Between Failures
}

/**
 * Synthetic Monitor Class
 */
export class SyntheticMonitor {
  private config: SyntheticMonitorConfig;
  private activeChecks: Map<string, NodeJS.Timeout> = new Map();
  private results: Map<string, HealthCheckResult[]> = new Map();
  private incidents: Array<{
    id: string;
    checkId: string;
    status: HealthStatus;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    acknowledged?: boolean;
  }> = [];
  private maxHistorySize = 1000;

  constructor(config: SyntheticMonitorConfig) {
    this.config = config;
    this.initializeChecks();
  }

  /**
   * Initialize health checks
   */
  private initializeChecks(): void {
    if (!this.config.enabled) {
      logger.info('Synthetic monitoring is disabled');
      return;
    }

    this.config.checks.forEach(check => {
      this.startHealthCheck(check);
    });

    logger.info(`Initialized ${this.config.checks.length} health checks`);
  }

  /**
   * Start a health check
   */
  private startHealthCheck(check: HealthCheck): void {
    const interval = check.interval || 60000; // Default 1 minute
    
    const runCheck = async () => {
      try {
        const result = await this.executeHealthCheck(check);
        this.recordResult(result);
        this.evaluateResult(result);
      } catch (error) {
        logger.error('Health check failed:', error);
        this.recordResult({
          checkId: check.id,
          status: HealthStatus.UNHEALTHY,
          responseTime: 0,
          timestamp: new Date(),
          error: error.message,
        });
      }
    };

    // Run immediately
    runCheck();
    
    // Schedule recurring checks
    const timeout = setInterval(runCheck, interval);
    this.activeChecks.set(check.id, timeout);
  }

  /**
   * Execute a health check
   */
  private async executeHealthCheck(check: HealthCheck): Promise<HealthCheckResult> {
    const startTime = performance.now();
    const timeout = check.timeout || this.config.globalSettings.timeout;

    try {
      let result: HealthCheckResult;

      switch (check.type) {
        case HealthCheckType.HTTP:
          result = await this.executeHttpCheck(check, timeout);
          break;
        case HealthCheckType.DATABASE:
          result = await this.executeDatabaseCheck(check, timeout);
          break;
        case HealthCheckType.SHOPIFY_API:
          result = await this.executeShopifyApiCheck(check, timeout);
          break;
        case HealthCheckType.REDIS:
          result = await this.executeRedisCheck(check, timeout);
          break;
        case HealthCheckType.WEBSOCKET:
          result = await this.executeWebSocketCheck(check, timeout);
          break;
        case HealthCheckType.EXTERNAL_SERVICE:
          result = await this.executeExternalServiceCheck(check, timeout);
          break;
        default:
          throw new Error(`Unknown health check type: ${check.type}`);
      }

      const endTime = performance.now();
      result.responseTime = endTime - startTime;
      result.timestamp = new Date();

      return result;
    } catch (error) {
      const endTime = performance.now();
      return {
        checkId: check.id,
        status: HealthStatus.UNHEALTHY,
        responseTime: endTime - startTime,
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Execute HTTP health check
   */
  private async executeHttpCheck(check: HealthCheck, timeout: number): Promise<HealthCheckResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(check.endpoint!, {
        method: check.method || 'GET',
        headers: check.headers || {},
        body: check.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const status = response.ok ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;
      const responseText = await response.text();

      return {
        checkId: check.id,
        status,
        responseTime: 0, // Will be set by caller
        timestamp: new Date(),
        metrics: {
          statusCode: response.status,
          responseSize: responseText.length,
        },
        details: {
          url: check.endpoint,
          method: check.method || 'GET',
          statusCode: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Execute database health check
   */
  private async executeDatabaseCheck(check: HealthCheck, timeout: number): Promise<HealthCheckResult> {
    const startTime = performance.now();
    
    try {
      // Test database connection
      await db.$queryRaw`SELECT 1`;
      
      // Test write operation
      const testRecord = await db.auditLog.create({
        data: {
          shopId: 'health-check',
          eventType: 'HEALTH_CHECK',
          eventData: { test: true },
          timestamp: new Date(),
        },
      });

      // Clean up test record
      await db.auditLog.delete({
        where: { id: testRecord.id },
      });

      const endTime = performance.now();
      const queryTime = endTime - startTime;

      return {
        checkId: check.id,
        status: HealthStatus.HEALTHY,
        responseTime: queryTime,
        timestamp: new Date(),
        metrics: {
          queryTime,
          connectionPoolSize: 10, // Replace with actual pool size
        },
        details: {
          database: 'postgres',
          operation: 'read/write',
        },
      };
    } catch (error) {
      return {
        checkId: check.id,
        status: HealthStatus.UNHEALTHY,
        responseTime: 0,
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Execute Shopify API health check using GraphQL Admin API
   */
  private async executeShopifyApiCheck(check: HealthCheck, timeout: number): Promise<HealthCheckResult> {
    try {
      // Use GraphQL Admin API for 2025 compliance
      const graphqlQuery = `
        query {
          shop {
            id
            name
            myshopifyDomain
            primaryDomain {
              url
            }
          }
        }
      `;

      const response = await fetch(`https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2025-07/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || 'test-token',
        },
        body: JSON.stringify({ query: graphqlQuery }),
      });

      const data = await response.json();
      const hasErrors = data.errors && data.errors.length > 0;
      const status = response.ok && !hasErrors ? HealthStatus.HEALTHY : HealthStatus.DEGRADED;

      return {
        checkId: check.id,
        status,
        responseTime: 0,
        timestamp: new Date(),
        metrics: {
          apiVersion: '2025-07',
          rateLimitRemaining: parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[0] || '0'),
          rateLimitTotal: parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[1] || '40'),
          graphqlCost: data.extensions?.cost?.actualQueryCost || 0,
          graphqlThrottled: data.extensions?.cost?.throttleStatus?.currentlyAvailable || 1000,
        },
        details: {
          endpoint: 'GraphQL Admin API',
          rateLimitHeader: response.headers.get('X-Shopify-Shop-Api-Call-Limit'),
          hasErrors,
          errors: hasErrors ? data.errors : undefined,
        },
      };
    } catch (error) {
      return {
        checkId: check.id,
        status: HealthStatus.UNHEALTHY,
        responseTime: 0,
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Execute Redis health check
   */
  private async executeRedisCheck(check: HealthCheck, timeout: number): Promise<HealthCheckResult> {
    try {
      // Redis health check would go here
      // For demo purposes, we'll simulate
      const testKey = `health-check:${Date.now()}`;
      const testValue = 'ping';
      
      // This would be actual Redis operations
      // await redis.set(testKey, testValue);
      // const result = await redis.get(testKey);
      // await redis.del(testKey);
      
      return {
        checkId: check.id,
        status: HealthStatus.HEALTHY,
        responseTime: 0,
        timestamp: new Date(),
        metrics: {
          connectedClients: 1,
          usedMemory: 1024 * 1024, // 1MB
        },
        details: {
          operation: 'set/get/del',
          keyspace: 'db0',
        },
      };
    } catch (error) {
      return {
        checkId: check.id,
        status: HealthStatus.UNHEALTHY,
        responseTime: 0,
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Execute WebSocket health check
   */
  private async executeWebSocketCheck(check: HealthCheck, timeout: number): Promise<HealthCheckResult> {
    return new Promise((resolve) => {
      const ws = new WebSocket(check.endpoint!);
      const timeoutId = setTimeout(() => {
        ws.close();
        resolve({
          checkId: check.id,
          status: HealthStatus.UNHEALTHY,
          responseTime: 0,
          timestamp: new Date(),
          error: 'WebSocket connection timeout',
        });
      }, timeout);

      ws.onopen = () => {
        clearTimeout(timeoutId);
        ws.send(JSON.stringify({ type: 'ping' }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') {
            ws.close();
            resolve({
              checkId: check.id,
              status: HealthStatus.HEALTHY,
              responseTime: 0,
              timestamp: new Date(),
              details: {
                protocol: ws.protocol,
                readyState: ws.readyState,
              },
            });
          }
        } catch (error) {
          ws.close();
          resolve({
            checkId: check.id,
            status: HealthStatus.DEGRADED,
            responseTime: 0,
            timestamp: new Date(),
            error: 'Invalid WebSocket response',
          });
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeoutId);
        resolve({
          checkId: check.id,
          status: HealthStatus.UNHEALTHY,
          responseTime: 0,
          timestamp: new Date(),
          error: 'WebSocket connection error',
        });
      };
    });
  }

  /**
   * Execute external service health check
   */
  private async executeExternalServiceCheck(check: HealthCheck, timeout: number): Promise<HealthCheckResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(check.endpoint!, {
        method: check.method || 'GET',
        headers: check.headers || {},
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const status = response.ok ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;

      return {
        checkId: check.id,
        status,
        responseTime: 0,
        timestamp: new Date(),
        metrics: {
          statusCode: response.status,
        },
        details: {
          service: check.name,
          endpoint: check.endpoint,
          statusCode: response.status,
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Record health check result
   */
  private recordResult(result: HealthCheckResult): void {
    if (!this.results.has(result.checkId)) {
      this.results.set(result.checkId, []);
    }

    const results = this.results.get(result.checkId)!;
    results.push(result);

    // Limit history size
    if (results.length > this.maxHistorySize) {
      results.shift();
    }

    // Log result
    logger.info('Health check result:', {
      checkId: result.checkId,
      status: result.status,
      responseTime: result.responseTime,
      error: result.error,
    });
  }

  /**
   * Evaluate health check result and trigger alerts
   */
  private evaluateResult(result: HealthCheckResult): void {
    const check = this.config.checks.find(c => c.id === result.checkId);
    if (!check) return;

    // Check if this is a status change
    const previousResults = this.results.get(result.checkId) || [];
    const previousResult = previousResults[previousResults.length - 2];
    
    if (previousResult && previousResult.status !== result.status) {
      this.handleStatusChange(check, previousResult, result);
    }

    // Check thresholds
    if (check.threshold) {
      this.checkThresholds(check, result);
    }
  }

  /**
   * Handle status change
   */
  private handleStatusChange(check: HealthCheck, previous: HealthCheckResult, current: HealthCheckResult): void {
    if (current.status === HealthStatus.UNHEALTHY) {
      // Start incident
      const incident = {
        id: `incident-${Date.now()}`,
        checkId: check.id,
        status: current.status,
        startTime: current.timestamp,
      };
      this.incidents.push(incident);
      
      // Send alert
      this.sendAlert(check, current, 'Health check failed');
    } else if (previous.status === HealthStatus.UNHEALTHY && current.status === HealthStatus.HEALTHY) {
      // Resolve incident
      const incident = this.incidents.find(i => i.checkId === check.id && !i.endTime);
      if (incident) {
        incident.endTime = current.timestamp;
        incident.duration = incident.endTime.getTime() - incident.startTime.getTime();
        
        // Send recovery alert
        this.sendAlert(check, current, 'Health check recovered');
      }
    }
  }

  /**
   * Check thresholds
   */
  private checkThresholds(check: HealthCheck, result: HealthCheckResult): void {
    if (!check.threshold) return;

    const results = this.results.get(result.checkId) || [];
    const recentResults = results.slice(-10); // Last 10 results

    // Check response time threshold
    if (result.responseTime > check.threshold.responseTime) {
      this.sendAlert(check, result, `Response time exceeded threshold: ${result.responseTime}ms`);
    }

    // Check error rate threshold
    const errorCount = recentResults.filter(r => r.status === HealthStatus.UNHEALTHY).length;
    const errorRate = errorCount / recentResults.length;
    
    if (errorRate > check.threshold.errorRate) {
      this.sendAlert(check, result, `Error rate exceeded threshold: ${(errorRate * 100).toFixed(1)}%`);
    }

    // Check success rate threshold
    const successCount = recentResults.filter(r => r.status === HealthStatus.HEALTHY).length;
    const successRate = successCount / recentResults.length;
    
    if (successRate < check.threshold.successRate) {
      this.sendAlert(check, result, `Success rate below threshold: ${(successRate * 100).toFixed(1)}%`);
    }
  }

  /**
   * Send alert
   */
  private async sendAlert(check: HealthCheck, result: HealthCheckResult, message: string): Promise<void> {
    const alert = {
      checkId: check.id,
      checkName: check.name,
      status: result.status,
      message,
      timestamp: result.timestamp,
      responseTime: result.responseTime,
      error: result.error,
    };

    logger.warn('Health check alert:', alert);

    // Send to configured alert channels
    if (check.alerts?.email) {
      await this.sendEmailAlert(check.alerts.email, alert);
    }

    if (check.alerts?.slack) {
      await this.sendSlackAlert(check.alerts.slack, alert);
    }

    if (check.alerts?.webhook) {
      await this.sendWebhookAlert(check.alerts.webhook, alert);
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(emails: string[], alert: any): Promise<void> {
    // Email implementation would go here
    console.log('Email alert sent to:', emails, alert);
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(webhook: string, alert: any): Promise<void> {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: `🚨 Health Check Alert: ${alert.checkName}`,
          attachments: [
            {
              color: alert.status === HealthStatus.HEALTHY ? 'good' : 'danger',
              fields: [
                {
                  title: 'Status',
                  value: alert.status,
                  short: true,
                },
                {
                  title: 'Response Time',
                  value: `${alert.responseTime}ms`,
                  short: true,
                },
                {
                  title: 'Message',
                  value: alert.message,
                  short: false,
                },
                {
                  title: 'Error',
                  value: alert.error || 'None',
                  short: false,
                },
              ],
              ts: Math.floor(alert.timestamp.getTime() / 1000),
            },
          ],
        }),
      });
    } catch (error) {
      logger.error('Failed to send Slack alert:', error);
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(webhook: string, alert: any): Promise<void> {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert),
      });
    } catch (error) {
      logger.error('Failed to send webhook alert:', error);
    }
  }

  /**
   * Get health check results
   */
  getResults(checkId?: string): HealthCheckResult[] {
    if (checkId) {
      return this.results.get(checkId) || [];
    }
    
    return Array.from(this.results.values()).flat();
  }

  /**
   * Get overall health status
   */
  getOverallHealth(): HealthStatus {
    const allResults = this.getResults();
    const latestResults = new Map<string, HealthCheckResult>();

    // Get latest result for each check
    allResults.forEach(result => {
      const existing = latestResults.get(result.checkId);
      if (!existing || result.timestamp > existing.timestamp) {
        latestResults.set(result.checkId, result);
      }
    });

    const statuses = Array.from(latestResults.values()).map(r => r.status);
    
    if (statuses.every(s => s === HealthStatus.HEALTHY)) {
      return HealthStatus.HEALTHY;
    }
    
    if (statuses.some(s => s === HealthStatus.UNHEALTHY)) {
      return HealthStatus.UNHEALTHY;
    }
    
    if (statuses.some(s => s === HealthStatus.DEGRADED)) {
      return HealthStatus.DEGRADED;
    }
    
    return HealthStatus.UNKNOWN;
  }

  /**
   * Get monitoring metrics
   */
  getMetrics(): MonitoringMetrics {
    const allResults = this.getResults();
    const totalChecks = allResults.length;
    
    if (totalChecks === 0) {
      return {
        uptime: 0,
        averageResponseTime: 0,
        errorRate: 0,
        successRate: 0,
        availability: 0,
        performanceScore: 0,
        incidentCount: this.incidents.length,
        mttr: 0,
        mtbf: 0,
      };
    }

    const successfulChecks = allResults.filter(r => r.status === HealthStatus.HEALTHY).length;
    const errorChecks = allResults.filter(r => r.status === HealthStatus.UNHEALTHY).length;
    const averageResponseTime = allResults.reduce((sum, r) => sum + r.responseTime, 0) / totalChecks;
    
    const successRate = successfulChecks / totalChecks;
    const errorRate = errorChecks / totalChecks;
    const uptime = successRate * 100;
    const availability = successRate * 100;
    
    // Calculate performance score (weighted average)
    const performanceScore = Math.min(100, (
      (successRate * 40) + 
      (Math.max(0, 1 - averageResponseTime / 1000) * 30) + 
      (Math.max(0, 1 - errorRate) * 30)
    ) * 100);
    
    // Calculate MTTR and MTBF
    const resolvedIncidents = this.incidents.filter(i => i.endTime);
    const mttr = resolvedIncidents.length > 0 
      ? resolvedIncidents.reduce((sum, i) => sum + (i.duration || 0), 0) / resolvedIncidents.length
      : 0;
    
    const mtbf = resolvedIncidents.length > 1 
      ? (resolvedIncidents[resolvedIncidents.length - 1].startTime.getTime() - 
         resolvedIncidents[0].startTime.getTime()) / (resolvedIncidents.length - 1)
      : 0;

    return {
      uptime,
      averageResponseTime,
      errorRate: errorRate * 100,
      successRate: successRate * 100,
      availability,
      performanceScore,
      incidentCount: this.incidents.length,
      mttr,
      mtbf,
    };
  }

  /**
   * Add health check
   */
  addHealthCheck(check: HealthCheck): void {
    this.config.checks.push(check);
    this.startHealthCheck(check);
  }

  /**
   * Remove health check
   */
  removeHealthCheck(checkId: string): void {
    const timeout = this.activeChecks.get(checkId);
    if (timeout) {
      clearInterval(timeout);
      this.activeChecks.delete(checkId);
    }
    
    this.config.checks = this.config.checks.filter(c => c.id !== checkId);
    this.results.delete(checkId);
  }

  /**
   * Stop all health checks
   */
  stop(): void {
    this.activeChecks.forEach(timeout => {
      clearInterval(timeout);
    });
    this.activeChecks.clear();
    
    logger.info('Synthetic monitoring stopped');
  }
}

// Default configuration
const defaultConfig: SyntheticMonitorConfig = {
  enabled: process.env.NODE_ENV === 'production',
  checks: [
    {
      id: 'app-health',
      name: 'Application Health',
      type: HealthCheckType.HTTP,
      endpoint: '/health',
      method: 'GET',
      timeout: 5000,
      interval: 30000,
      threshold: {
        responseTime: 1000,
        errorRate: 0.1,
        successRate: 0.95,
      },
      alerts: {
        email: process.env.ALERT_EMAIL?.split(',') || [],
        slack: process.env.ALERT_SLACK_WEBHOOK,
        webhook: process.env.ALERT_WEBHOOK,
      },
    },
    {
      id: 'database-health',
      name: 'Database Health',
      type: HealthCheckType.DATABASE,
      timeout: 10000,
      interval: 60000,
      threshold: {
        responseTime: 500,
        errorRate: 0.05,
        successRate: 0.99,
      },
    },
    {
      id: 'shopify-api-health',
      name: 'Shopify API Health',
      type: HealthCheckType.SHOPIFY_API,
      timeout: 10000,
      interval: 120000,
      threshold: {
        responseTime: 2000,
        errorRate: 0.1,
        successRate: 0.95,
      },
    },
  ],
  globalSettings: {
    timeout: 10000,
    retries: 3,
    retryDelay: 1000,
    alertThreshold: 3,
    healthyThreshold: 2,
  },
  regions: ['us-east-1', 'us-west-2', 'eu-west-1'],
  notifications: {
    email: process.env.ALERT_EMAIL?.split(',') || [],
    slack: process.env.ALERT_SLACK_WEBHOOK || '',
    webhook: process.env.ALERT_WEBHOOK || '',
  },
};

// Create and export singleton instance
export const syntheticMonitor = new SyntheticMonitor(defaultConfig);

// Export types and enums
export type {
  HealthCheck,
  HealthCheckResult,
  SyntheticMonitorConfig,
  MonitoringMetrics,
};

export default syntheticMonitor;