/**
 * Performance Alerts System
 * Real-time monitoring and alerting for Built for Shopify compliance
 */

import { StatsdClient } from "node-statsd";
import { performance } from "perf_hooks";

// Alert thresholds based on Built for Shopify requirements
const ALERT_THRESHOLDS = {
  // Core Web Vitals thresholds
  webVitals: {
    lcp: 2500,           // Largest Contentful Paint (ms)
    fid: 100,            // First Input Delay (ms)
    cls: 0.1,            // Cumulative Layout Shift
    fcp: 1800,           // First Contentful Paint (ms)
    ttfb: 600,           // Time to First Byte (ms)
    inp: 200,            // Interaction to Next Paint (ms)
  },
  
  // Performance metrics thresholds
  performance: {
    responseTime: 500,   // API response time (ms)
    dbQueryTime: 100,    // Database query time (ms)
    memoryUsage: 0.8,    // Memory usage ratio
    cpuUsage: 0.7,       // CPU usage ratio
    errorRate: 0.01,     // Error rate threshold (1%)
  },
  
  // Bundle size thresholds
  bundleSize: {
    initial: 250000,     // 250KB initial bundle
    total: 1000000,      // 1MB total bundle
    css: 50000,          // 50KB CSS bundle
  },
  
  // Lighthouse score thresholds
  lighthouse: {
    performance: 90,     // Minimum performance score
    accessibility: 95,   // Minimum accessibility score
    bestPractices: 90,   // Minimum best practices score
    seo: 90,            // Minimum SEO score
  },
};

interface AlertConfig {
  enabled: boolean;
  webhookUrl?: string;
  emailRecipients?: string[];
  slackChannel?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

interface PerformanceMetric {
  name: string;
  value: number;
  threshold: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface Alert {
  id: string;
  type: 'performance' | 'web-vitals' | 'bundle-size' | 'lighthouse';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  metric: PerformanceMetric;
  timestamp: number;
  resolved?: boolean;
  resolvedAt?: number;
}

class PerformanceAlerts {
  private statsdClient: StatsdClient;
  private alerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private config: AlertConfig;

  constructor(config: AlertConfig = { enabled: true, severity: 'warning' }) {
    this.config = config;
    this.statsdClient = new StatsdClient({
      host: process.env.STATSD_HOST || 'localhost',
      port: parseInt(process.env.STATSD_PORT || '8125'),
      prefix: 'wishcraft.performance.',
    });
  }

  /**
   * Monitor Core Web Vitals and trigger alerts
   */
  async monitorWebVitals(vitals: Record<string, number>) {
    const timestamp = Date.now();
    
    for (const [metric, value] of Object.entries(vitals)) {
      const threshold = ALERT_THRESHOLDS.webVitals[metric as keyof typeof ALERT_THRESHOLDS.webVitals];
      
      if (threshold && value > threshold) {
        await this.triggerAlert({
          type: 'web-vitals',
          severity: this.getSeverityForWebVital(metric, value, threshold),
          metric: {
            name: metric,
            value,
            threshold,
            timestamp,
          },
        });
      }
      
      // Send metrics to StatsD
      this.statsdClient.gauge(`web_vitals.${metric}`, value);
    }
  }

  /**
   * Monitor API performance and trigger alerts
   */
  async monitorApiPerformance(endpoint: string, responseTime: number, statusCode: number) {
    const timestamp = Date.now();
    const threshold = ALERT_THRESHOLDS.performance.responseTime;
    
    // Monitor response time
    if (responseTime > threshold) {
      await this.triggerAlert({
        type: 'performance',
        severity: responseTime > threshold * 2 ? 'error' : 'warning',
        metric: {
          name: 'api_response_time',
          value: responseTime,
          threshold,
          timestamp,
          metadata: { endpoint, statusCode },
        },
      });
    }
    
    // Monitor error rate
    if (statusCode >= 500) {
      await this.triggerAlert({
        type: 'performance',
        severity: 'error',
        metric: {
          name: 'api_error',
          value: statusCode,
          threshold: 500,
          timestamp,
          metadata: { endpoint, responseTime },
        },
      });
    }
    
    // Send metrics to StatsD
    this.statsdClient.timing(`api.${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}.response_time`, responseTime);
    this.statsdClient.increment(`api.${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}.status_${statusCode}`);
  }

  /**
   * Monitor bundle size and trigger alerts
   */
  async monitorBundleSize(bundleStats: { initial: number; total: number; css: number }) {
    const timestamp = Date.now();
    
    for (const [type, size] of Object.entries(bundleStats)) {
      const threshold = ALERT_THRESHOLDS.bundleSize[type as keyof typeof ALERT_THRESHOLDS.bundleSize];
      
      if (threshold && size > threshold) {
        await this.triggerAlert({
          type: 'bundle-size',
          severity: size > threshold * 1.2 ? 'error' : 'warning',
          metric: {
            name: `bundle_size_${type}`,
            value: size,
            threshold,
            timestamp,
          },
        });
      }
      
      // Send metrics to StatsD
      this.statsdClient.gauge(`bundle_size.${type}`, size);
    }
  }

  /**
   * Monitor Lighthouse scores and trigger alerts
   */
  async monitorLighthouseScores(scores: Record<string, number>) {
    const timestamp = Date.now();
    
    for (const [metric, score] of Object.entries(scores)) {
      const threshold = ALERT_THRESHOLDS.lighthouse[metric as keyof typeof ALERT_THRESHOLDS.lighthouse];
      
      if (threshold && score < threshold) {
        await this.triggerAlert({
          type: 'lighthouse',
          severity: score < threshold * 0.8 ? 'error' : 'warning',
          metric: {
            name: `lighthouse_${metric}`,
            value: score,
            threshold,
            timestamp,
          },
        });
      }
      
      // Send metrics to StatsD
      this.statsdClient.gauge(`lighthouse.${metric}`, score);
    }
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(alertData: {
    type: Alert['type'];
    severity: Alert['severity'];
    metric: PerformanceMetric;
  }) {
    const alertId = `${alertData.type}_${alertData.metric.name}_${alertData.metric.timestamp}`;
    
    // Check if similar alert already exists
    const existingAlert = Array.from(this.alerts.values()).find(
      alert => alert.type === alertData.type && 
               alert.metric.name === alertData.metric.name &&
               !alert.resolved &&
               alertData.metric.timestamp - alert.timestamp < 300000 // 5 minutes
    );
    
    if (existingAlert) {
      // Update existing alert
      existingAlert.metric = alertData.metric;
      existingAlert.timestamp = alertData.metric.timestamp;
      return;
    }
    
    const alert: Alert = {
      id: alertId,
      type: alertData.type,
      severity: alertData.severity,
      message: this.generateAlertMessage(alertData),
      metric: alertData.metric,
      timestamp: alertData.metric.timestamp,
    };
    
    this.alerts.set(alertId, alert);
    this.alertHistory.push(alert);
    
    // Send alert notifications
    if (this.config.enabled) {
      await this.sendAlertNotifications(alert);
    }
    
    // Log alert
    console.error(`[PERFORMANCE ALERT] ${alert.message}`);
    
    // Send to StatsD
    this.statsdClient.increment(`alerts.${alert.type}.${alert.severity}`);
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(alertData: {
    type: Alert['type'];
    severity: Alert['severity'];
    metric: PerformanceMetric;
  }): string {
    const { type, metric } = alertData;
    const percentage = ((metric.value / metric.threshold - 1) * 100).toFixed(1);
    
    switch (type) {
      case 'web-vitals':
        return `Core Web Vital ${metric.name.toUpperCase()} exceeded threshold: ${metric.value}ms (${percentage}% over limit of ${metric.threshold}ms)`;
      
      case 'performance':
        if (metric.name === 'api_response_time') {
          return `API response time exceeded threshold: ${metric.value}ms (${percentage}% over limit of ${metric.threshold}ms) for ${metric.metadata?.endpoint}`;
        }
        return `Performance metric ${metric.name} exceeded threshold: ${metric.value} (${percentage}% over limit of ${metric.threshold})`;
      
      case 'bundle-size':
        return `Bundle size exceeded threshold: ${this.formatBytes(metric.value)} (${percentage}% over limit of ${this.formatBytes(metric.threshold)})`;
      
      case 'lighthouse':
        return `Lighthouse ${metric.name} score below threshold: ${metric.value} (${Math.abs(percentage)}% below minimum of ${metric.threshold})`;
      
      default:
        return `Performance alert: ${metric.name} = ${metric.value} (threshold: ${metric.threshold})`;
    }
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(alert: Alert) {
    const promises: Promise<void>[] = [];
    
    // Webhook notification
    if (this.config.webhookUrl) {
      promises.push(this.sendWebhookNotification(alert));
    }
    
    // Email notification
    if (this.config.emailRecipients?.length) {
      promises.push(this.sendEmailNotification(alert));
    }
    
    // Slack notification
    if (this.config.slackChannel) {
      promises.push(this.sendSlackNotification(alert));
    }
    
    await Promise.allSettled(promises);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(alert: Alert): Promise<void> {
    if (!this.config.webhookUrl) return;
    
    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alert,
          timestamp: new Date().toISOString(),
          service: 'wishcraft',
          environment: process.env.NODE_ENV,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Webhook notification failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send webhook notification:', error);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: Alert): Promise<void> {
    // Implementation depends on email service (SendGrid, AWS SES, etc.)
    console.log('Email notification would be sent to:', this.config.emailRecipients);
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(alert: Alert): Promise<void> {
    // Implementation depends on Slack webhook configuration
    console.log('Slack notification would be sent to:', this.config.slackChannel);
  }

  /**
   * Get severity for web vital metric
   */
  private getSeverityForWebVital(metric: string, value: number, threshold: number): Alert['severity'] {
    const ratio = value / threshold;
    
    if (ratio > 2) return 'critical';
    if (ratio > 1.5) return 'error';
    if (ratio > 1.2) return 'warning';
    return 'info';
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Get performance dashboard data
   */
  getDashboardData() {
    return {
      activeAlerts: this.getActiveAlerts().length,
      totalAlerts: this.alertHistory.length,
      alertsByType: this.getAlertsByType(),
      alertsBySeverity: this.getAlertsBySeverity(),
      recentAlerts: this.getAlertHistory(10),
    };
  }

  /**
   * Get alerts grouped by type
   */
  private getAlertsByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.alertHistory.forEach(alert => {
      counts[alert.type] = (counts[alert.type] || 0) + 1;
    });
    return counts;
  }

  /**
   * Get alerts grouped by severity
   */
  private getAlertsBySeverity(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.alertHistory.forEach(alert => {
      counts[alert.severity] = (counts[alert.severity] || 0) + 1;
    });
    return counts;
  }
}

// Export singleton instance
export const performanceAlerts = new PerformanceAlerts({
  enabled: process.env.PERFORMANCE_ALERTS_ENABLED === 'true',
  webhookUrl: process.env.PERFORMANCE_WEBHOOK_URL,
  emailRecipients: process.env.PERFORMANCE_EMAIL_RECIPIENTS?.split(','),
  slackChannel: process.env.PERFORMANCE_SLACK_CHANNEL,
  severity: 'warning',
});

export type { Alert, PerformanceMetric, AlertConfig };