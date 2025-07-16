/**
 * P95 API Monitoring System - Critical Performance Monitoring
 * Built for Shopify 2025 Compliance - API Performance Requirements
 */

import { PrismaClient } from '@prisma/client';
import { log } from './logger.server';
import { getEnv } from './env-validation.server';

const prisma = new PrismaClient();

interface ApiMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  shopId: string;
  timestamp: Date;
}

interface P95Report {
  endpoint: string;
  method: string;
  p95ResponseTime: number;
  averageResponseTime: number;
  requestCount: number;
  errorRate: number;
  alertThreshold: number;
  isAlert: boolean;
  timeRange: {
    start: Date;
    end: Date;
  };
}

interface PerformanceAlert {
  endpoint: string;
  method: string;
  currentP95: number;
  threshold: number;
  shopId: string;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: Date;
}

/**
 * P95 API Monitoring Service
 * Tracks API performance and alerts on threshold violations
 */
export class P95Monitor {
  private readonly ALERT_THRESHOLDS = {
    // Built for Shopify 2025 requirements
    critical: 2000, // 2 seconds
    warning: 1500,  // 1.5 seconds
    target: 1000    // 1 second target
  };

  private readonly MONITORING_WINDOW = 60 * 60 * 1000; // 1 hour window
  private readonly ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown

  /**
   * Record API metrics for monitoring
   */
  async recordMetrics(metrics: ApiMetrics): Promise<void> {
    try {
      await prisma.apiResponseTime.create({
        data: {
          shopId: metrics.shopId,
          endpoint: metrics.endpoint,
          method: metrics.method,
          responseTime: metrics.responseTime,
          statusCode: metrics.statusCode,
          timestamp: metrics.timestamp,
          createdAt: new Date()
        }
      });

      // Check for immediate alerts if response time is critical
      if (metrics.responseTime > this.ALERT_THRESHOLDS.critical) {
        await this.triggerImmediateAlert(metrics);
      }

    } catch (error) {
      log.error('Failed to record API metrics', {
        error: error.message,
        metrics,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Calculate P95 response time for specific endpoint
   */
  async calculateP95(
    endpoint: string,
    method: string,
    shopId?: string,
    windowMinutes: number = 60
  ): Promise<number> {
    try {
      const startTime = new Date(Date.now() - windowMinutes * 60 * 1000);
      
      const whereClause: any = {
        endpoint,
        method,
        timestamp: {
          gte: startTime
        }
      };

      if (shopId) {
        whereClause.shopId = shopId;
      }

      const responseTimes = await prisma.apiResponseTime.findMany({
        where: whereClause,
        select: {
          responseTime: true
        },
        orderBy: {
          responseTime: 'asc'
        }
      });

      if (responseTimes.length === 0) {
        return 0;
      }

      // Calculate P95 (95th percentile)
      const p95Index = Math.ceil(responseTimes.length * 0.95) - 1;
      return responseTimes[p95Index].responseTime;

    } catch (error) {
      log.error('Failed to calculate P95', {
        error: error.message,
        endpoint,
        method,
        shopId,
        windowMinutes
      });
      return 0;
    }
  }

  /**
   * Generate comprehensive P95 report
   */
  async generateP95Report(
    shopId?: string,
    windowMinutes: number = 60
  ): Promise<P95Report[]> {
    try {
      const startTime = new Date(Date.now() - windowMinutes * 60 * 1000);
      const endTime = new Date();

      const whereClause: any = {
        timestamp: {
          gte: startTime,
          lte: endTime
        }
      };

      if (shopId) {
        whereClause.shopId = shopId;
      }

      // Get unique endpoint/method combinations
      const uniqueEndpoints = await prisma.apiResponseTime.findMany({
        where: whereClause,
        select: {
          endpoint: true,
          method: true
        },
        distinct: ['endpoint', 'method']
      });

      const reports: P95Report[] = [];

      for (const { endpoint, method } of uniqueEndpoints) {
        const metrics = await prisma.apiResponseTime.findMany({
          where: {
            ...whereClause,
            endpoint,
            method
          },
          select: {
            responseTime: true,
            statusCode: true
          },
          orderBy: {
            responseTime: 'asc'
          }
        });

        if (metrics.length === 0) continue;

        // Calculate P95
        const p95Index = Math.ceil(metrics.length * 0.95) - 1;
        const p95ResponseTime = metrics[p95Index].responseTime;

        // Calculate average
        const averageResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;

        // Calculate error rate
        const errorCount = metrics.filter(m => m.statusCode >= 400).length;
        const errorRate = (errorCount / metrics.length) * 100;

        // Determine alert threshold and status
        const alertThreshold = this.ALERT_THRESHOLDS.warning;
        const isAlert = p95ResponseTime > alertThreshold;

        reports.push({
          endpoint,
          method,
          p95ResponseTime,
          averageResponseTime,
          requestCount: metrics.length,
          errorRate,
          alertThreshold,
          isAlert,
          timeRange: {
            start: startTime,
            end: endTime
          }
        });
      }

      return reports.sort((a, b) => b.p95ResponseTime - a.p95ResponseTime);

    } catch (error) {
      log.error('Failed to generate P95 report', {
        error: error.message,
        shopId,
        windowMinutes
      });
      return [];
    }
  }

  /**
   * Check all endpoints for P95 threshold violations
   */
  async checkP95Alerts(shopId?: string): Promise<PerformanceAlert[]> {
    try {
      const reports = await this.generateP95Report(shopId, 60);
      const alerts: PerformanceAlert[] = [];

      for (const report of reports) {
        if (report.isAlert) {
          const severity = report.p95ResponseTime > this.ALERT_THRESHOLDS.critical ? 'critical' : 'warning';
          
          const alert: PerformanceAlert = {
            endpoint: report.endpoint,
            method: report.method,
            currentP95: report.p95ResponseTime,
            threshold: report.alertThreshold,
            shopId: shopId || 'global',
            severity,
            message: `P95 response time (${report.p95ResponseTime}ms) exceeds ${severity} threshold (${report.alertThreshold}ms)`,
            timestamp: new Date()
          };

          alerts.push(alert);
        }
      }

      return alerts;

    } catch (error) {
      log.error('Failed to check P95 alerts', {
        error: error.message,
        shopId
      });
      return [];
    }
  }

  /**
   * Trigger immediate alert for critical response times
   */
  private async triggerImmediateAlert(metrics: ApiMetrics): Promise<void> {
    try {
      const alert: PerformanceAlert = {
        endpoint: metrics.endpoint,
        method: metrics.method,
        currentP95: metrics.responseTime,
        threshold: this.ALERT_THRESHOLDS.critical,
        shopId: metrics.shopId,
        severity: 'critical',
        message: `CRITICAL: API response time (${metrics.responseTime}ms) exceeds critical threshold (${this.ALERT_THRESHOLDS.critical}ms)`,
        timestamp: new Date()
      };

      await this.sendAlert(alert);

    } catch (error) {
      log.error('Failed to trigger immediate alert', {
        error: error.message,
        metrics
      });
    }
  }

  /**
   * Send alert notifications
   */
  private async sendAlert(alert: PerformanceAlert): Promise<void> {
    try {
      // Log the alert
      log.warn('P95 Performance Alert', {
        alert,
        timestamp: new Date().toISOString()
      });

      // Send webhook notification if configured
      const webhookUrl = getEnv('PERFORMANCE_WEBHOOK_URL');
      if (webhookUrl) {
        await this.sendWebhookAlert(webhookUrl, alert);
      }

      // Send Slack notification if configured
      const slackWebhook = getEnv('SLACK_WEBHOOK_URL');
      if (slackWebhook) {
        await this.sendSlackAlert(slackWebhook, alert);
      }

      // Send Discord notification if configured
      const discordWebhook = getEnv('DISCORD_WEBHOOK_URL');
      if (discordWebhook) {
        await this.sendDiscordAlert(discordWebhook, alert);
      }

    } catch (error) {
      log.error('Failed to send performance alert', {
        error: error.message,
        alert
      });
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(url: string, alert: PerformanceAlert): Promise<void> {
    try {
      const payload = {
        type: 'performance_alert',
        severity: alert.severity,
        endpoint: alert.endpoint,
        method: alert.method,
        currentP95: alert.currentP95,
        threshold: alert.threshold,
        shopId: alert.shopId,
        message: alert.message,
        timestamp: alert.timestamp.toISOString()
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WishCraft-P95Monitor/1.0'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }

    } catch (error) {
      log.error('Failed to send webhook alert', {
        error: error.message,
        url,
        alert
      });
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(webhookUrl: string, alert: PerformanceAlert): Promise<void> {
    try {
      const color = alert.severity === 'critical' ? 'danger' : 'warning';
      const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';

      const payload = {
        text: `${emoji} P95 Performance Alert - ${alert.severity.toUpperCase()}`,
        attachments: [
          {
            color,
            fields: [
              {
                title: 'Endpoint',
                value: `${alert.method} ${alert.endpoint}`,
                short: true
              },
              {
                title: 'Shop ID',
                value: alert.shopId,
                short: true
              },
              {
                title: 'Current P95',
                value: `${alert.currentP95}ms`,
                short: true
              },
              {
                title: 'Threshold',
                value: `${alert.threshold}ms`,
                short: true
              },
              {
                title: 'Message',
                value: alert.message,
                short: false
              }
            ],
            footer: 'WishCraft P95 Monitor',
            ts: Math.floor(alert.timestamp.getTime() / 1000)
          }
        ]
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
      }

    } catch (error) {
      log.error('Failed to send Slack alert', {
        error: error.message,
        webhookUrl,
        alert
      });
    }
  }

  /**
   * Send Discord alert
   */
  private async sendDiscordAlert(webhookUrl: string, alert: PerformanceAlert): Promise<void> {
    try {
      const color = alert.severity === 'critical' ? 0xff0000 : 0xffa500; // Red for critical, orange for warning
      const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';

      const payload = {
        embeds: [
          {
            title: `${emoji} P95 Performance Alert - ${alert.severity.toUpperCase()}`,
            description: alert.message,
            color,
            fields: [
              {
                name: 'Endpoint',
                value: `${alert.method} ${alert.endpoint}`,
                inline: true
              },
              {
                name: 'Shop ID',
                value: alert.shopId,
                inline: true
              },
              {
                name: 'Current P95',
                value: `${alert.currentP95}ms`,
                inline: true
              },
              {
                name: 'Threshold',
                value: `${alert.threshold}ms`,
                inline: true
              }
            ],
            footer: {
              text: 'WishCraft P95 Monitor'
            },
            timestamp: alert.timestamp.toISOString()
          }
        ]
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
      }

    } catch (error) {
      log.error('Failed to send Discord alert', {
        error: error.message,
        webhookUrl,
        alert
      });
    }
  }

  /**
   * Get performance summary for dashboard
   */
  async getPerformanceSummary(shopId?: string): Promise<{
    overallP95: number;
    averageResponseTime: number;
    totalRequests: number;
    errorRate: number;
    alertCount: number;
    topSlowEndpoints: Array<{
      endpoint: string;
      method: string;
      p95: number;
      requestCount: number;
    }>;
  }> {
    try {
      const reports = await this.generateP95Report(shopId, 60);
      
      if (reports.length === 0) {
        return {
          overallP95: 0,
          averageResponseTime: 0,
          totalRequests: 0,
          errorRate: 0,
          alertCount: 0,
          topSlowEndpoints: []
        };
      }

      const totalRequests = reports.reduce((sum, r) => sum + r.requestCount, 0);
      const weightedAverageP95 = reports.reduce((sum, r) => sum + (r.p95ResponseTime * r.requestCount), 0) / totalRequests;
      const weightedAverageResponseTime = reports.reduce((sum, r) => sum + (r.averageResponseTime * r.requestCount), 0) / totalRequests;
      const weightedErrorRate = reports.reduce((sum, r) => sum + (r.errorRate * r.requestCount), 0) / totalRequests;
      const alertCount = reports.filter(r => r.isAlert).length;

      const topSlowEndpoints = reports
        .slice(0, 10)
        .map(r => ({
          endpoint: r.endpoint,
          method: r.method,
          p95: r.p95ResponseTime,
          requestCount: r.requestCount
        }));

      return {
        overallP95: Math.round(weightedAverageP95),
        averageResponseTime: Math.round(weightedAverageResponseTime),
        totalRequests,
        errorRate: Math.round(weightedErrorRate * 100) / 100,
        alertCount,
        topSlowEndpoints
      };

    } catch (error) {
      log.error('Failed to get performance summary', {
        error: error.message,
        shopId
      });
      
      return {
        overallP95: 0,
        averageResponseTime: 0,
        totalRequests: 0,
        errorRate: 0,
        alertCount: 0,
        topSlowEndpoints: []
      };
    }
  }

  /**
   * Clean up old metrics data
   */
  async cleanupOldMetrics(retentionDays: number = 7): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      const deletedCount = await prisma.apiResponseTime.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });

      log.info('Cleaned up old P95 metrics', {
        deletedCount: deletedCount.count,
        cutoffDate: cutoffDate.toISOString(),
        retentionDays
      });

    } catch (error) {
      log.error('Failed to cleanup old metrics', {
        error: error.message,
        retentionDays
      });
    }
  }
}

// Global P95 monitor instance
export const p95Monitor = new P95Monitor();

/**
 * Middleware to automatically record API metrics
 */
export function createP95Middleware() {
  return async (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    // Track the original end method
    const originalEnd = res.end;
    
    res.end = function(chunk: any, encoding: any) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Record metrics
      const shopId = req.body?.shop_id || req.headers['x-shopify-shop-domain'] || req.query?.shop || 'unknown';
      
      p95Monitor.recordMetrics({
        endpoint: req.path,
        method: req.method,
        responseTime,
        statusCode: res.statusCode,
        shopId,
        timestamp: new Date()
      }).catch(error => {
        log.error('Failed to record P95 metrics in middleware', {
          error: error.message,
          path: req.path,
          method: req.method,
          statusCode: res.statusCode
        });
      });
      
      // Call the original end method
      originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
}

/**
 * Express route handler for P95 metrics API
 */
export async function handleP95MetricsRequest(req: any, res: any) {
  try {
    const { shopId, window } = req.query;
    const windowMinutes = parseInt(window) || 60;
    
    const reports = await p95Monitor.generateP95Report(shopId, windowMinutes);
    const summary = await p95Monitor.getPerformanceSummary(shopId);
    
    res.json({
      success: true,
      data: {
        summary,
        reports,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    log.error('Failed to handle P95 metrics request', {
      error: error.message,
      query: req.query
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve P95 metrics'
    });
  }
}