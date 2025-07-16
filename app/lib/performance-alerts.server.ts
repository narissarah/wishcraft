/**
 * Performance Monitoring Alerts for Built for Shopify 2025 Compliance
 * Real-time alerting for Core Web Vitals violations
 */

import { log } from "~/lib/logger.server";
import { cache } from "~/lib/cache-unified.server";

// 2025 Built for Shopify Alert Thresholds
export const ALERT_THRESHOLDS = {
  INP: {
    warning: 150, // 75% of good threshold
    critical: 200, // Good threshold limit
    urgent: 300, // Approaching poor threshold
  },
  CLS: {
    warning: 0.075, // 75% of good threshold
    critical: 0.1, // Good threshold limit
    urgent: 0.15, // Approaching poor threshold
  },
  LCP: {
    warning: 1875, // 75% of good threshold (ms)
    critical: 2500, // Good threshold limit
    urgent: 3000, // Approaching poor threshold
  },
  P95_API_RESPONSE: {
    warning: 375, // 75% of requirement (ms)
    critical: 500, // Built for Shopify requirement
    urgent: 750, // Degraded performance
  }
};

interface PerformanceAlert {
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical' | 'urgent';
  timestamp: number;
  shop?: string;
  path?: string;
}

interface AlertConfig {
  enabled: boolean;
  webhookUrl?: string;
  emailRecipients?: string[];
  slackChannel?: string;
  discordWebhook?: string;
}

/**
 * Check if metric value exceeds alert thresholds
 */
export function checkPerformanceThreshold(
  metric: string,
  value: number,
  shop?: string,
  path?: string
): PerformanceAlert | null {
  const thresholds = ALERT_THRESHOLDS[metric as keyof typeof ALERT_THRESHOLDS];
  if (!thresholds) return null;

  let severity: 'warning' | 'critical' | 'urgent' | null = null;
  let threshold = 0;

  if (value >= thresholds.urgent) {
    severity = 'urgent';
    threshold = thresholds.urgent;
  } else if (value >= thresholds.critical) {
    severity = 'critical';
    threshold = thresholds.critical;
  } else if (value >= thresholds.warning) {
    severity = 'warning';
    threshold = thresholds.warning;
  }

  if (!severity) return null;

  return {
    metric,
    value,
    threshold,
    severity,
    timestamp: Date.now(),
    shop,
    path,
  };
}

/**
 * Send performance alert through configured channels
 */
export async function sendPerformanceAlert(
  alert: PerformanceAlert,
  config: AlertConfig = { enabled: true }
): Promise<void> {
  if (!config.enabled) return;

  try {
    // Rate limit alerts to prevent spam
    const alertKey = `perf_alert:${alert.metric}:${alert.severity}:${alert.shop || 'global'}`;
    const recentAlert = await cache.get(alertKey);
    
    if (recentAlert) {
      // Alert already sent in last 5 minutes
      return;
    }

    // Cache alert to prevent duplicates
    await cache.set(alertKey, alert, 300); // 5 minutes

    const alertMessage = formatAlertMessage(alert);

    // Log alert
    log.error('Performance Alert Triggered', {
      alert,
      message: alertMessage,
    });

    // Send to configured channels
    const promises: Promise<any>[] = [];

    if (config.webhookUrl) {
      promises.push(sendWebhookAlert(config.webhookUrl, alert, alertMessage));
    }

    if (config.slackChannel) {
      promises.push(sendSlackAlert(config.slackChannel, alert, alertMessage));
    }

    if (config.discordWebhook) {
      promises.push(sendDiscordAlert(config.discordWebhook, alert, alertMessage));
    }

    if (config.emailRecipients?.length) {
      promises.push(sendEmailAlert(config.emailRecipients, alert, alertMessage));
    }

    // Execute all alert deliveries
    await Promise.allSettled(promises);

  } catch (error) {
    log.error('Failed to send performance alert', { error, alert });
  }
}

/**
 * Format alert message for human consumption
 */
function formatAlertMessage(alert: PerformanceAlert): string {
  const { metric, value, threshold, severity, shop, path } = alert;
  
  const metricDisplayNames = {
    INP: 'Interaction to Next Paint',
    CLS: 'Cumulative Layout Shift',
    LCP: 'Largest Contentful Paint',
    P95_API_RESPONSE: 'P95 API Response Time'
  };

  const metricName = metricDisplayNames[metric as keyof typeof metricDisplayNames] || metric;
  const unit = metric.includes('TIME') || metric === 'LCP' || metric === 'INP' ? 'ms' : '';
  
  let emoji = '⚠️';
  if (severity === 'critical') emoji = '🚨';
  if (severity === 'urgent') emoji = '🔥';

  let message = `${emoji} **${severity.toUpperCase()} Performance Alert**\n\n`;
  message += `**Metric:** ${metricName}\n`;
  message += `**Value:** ${value}${unit}\n`;
  message += `**Threshold:** ${threshold}${unit}\n`;
  message += `**Severity:** ${severity}\n`;
  message += `**Time:** ${new Date(alert.timestamp).toISOString()}\n`;

  if (shop) {
    message += `**Shop:** ${shop}\n`;
  }

  if (path) {
    message += `**Path:** ${path}\n`;
  }

  // Add context based on metric
  message += '\n**Impact:**\n';
  switch (metric) {
    case 'INP':
      message += '• User interactions feel sluggish\n';
      message += '• May impact Built for Shopify certification\n';
      message += '• Consider optimizing JavaScript execution\n';
      break;
    case 'CLS':
      message += '• Layout shifts disrupting user experience\n';
      message += '• Critical for Built for Shopify compliance\n';
      message += '• Check for unsized images/dynamic content\n';
      break;
    case 'LCP':
      message += '• Slow loading of main content\n';
      message += '• Users may abandon before page loads\n';
      message += '• Optimize largest content element\n';
      break;
    case 'P95_API_RESPONSE':
      message += '• API performance degraded\n';
      message += '• May fail Built for Shopify requirements\n';
      message += '• Check database/external API performance\n';
      break;
  }

  return message;
}

/**
 * Send alert via generic webhook
 */
async function sendWebhookAlert(
  webhookUrl: string,
  alert: PerformanceAlert,
  message: string
): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        alert_type: 'performance',
        severity: alert.severity,
        metric: alert.metric,
        value: alert.value,
        threshold: alert.threshold,
        message,
        timestamp: alert.timestamp,
        shop: alert.shop,
        path: alert.path,
      }),
    });
  } catch (error) {
    log.error('Failed to send webhook alert', { error, webhookUrl });
  }
}

/**
 * Send alert to Slack
 */
async function sendSlackAlert(
  slackWebhook: string,
  alert: PerformanceAlert,
  message: string
): Promise<void> {
  try {
    const color = alert.severity === 'urgent' ? 'danger' : 
                  alert.severity === 'critical' ? 'warning' : 'good';

    await fetch(slackWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: `Performance Alert: ${alert.metric}`,
        attachments: [{
          color,
          text: message,
          ts: Math.floor(alert.timestamp / 1000),
        }],
      }),
    });
  } catch (error) {
    log.error('Failed to send Slack alert', { error });
  }
}

/**
 * Send alert to Discord
 */
async function sendDiscordAlert(
  discordWebhook: string,
  alert: PerformanceAlert,
  message: string
): Promise<void> {
  try {
    const color = alert.severity === 'urgent' ? 0xFF0000 : 
                  alert.severity === 'critical' ? 0xFF8800 : 0xFFFF00;

    await fetch(discordWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [{
          title: `Performance Alert: ${alert.metric}`,
          description: message,
          color,
          timestamp: new Date(alert.timestamp).toISOString(),
        }],
      }),
    });
  } catch (error) {
    log.error('Failed to send Discord alert', { error });
  }
}

/**
 * Send alert via email (placeholder - implement with your email service)
 */
async function sendEmailAlert(
  recipients: string[],
  alert: PerformanceAlert,
  message: string
): Promise<void> {
  try {
    // This is a placeholder - implement with your email service
    // (SendGrid, Mailgun, AWS SES, etc.)
    
    log.info('Email alert would be sent to:', {
      recipients,
      subject: `Performance Alert: ${alert.metric} ${alert.severity}`,
      message,
    });

    // Example implementation with email service:
    // await emailService.send({
    //   to: recipients,
    //   subject: `Performance Alert: ${alert.metric} ${alert.severity}`,
    //   text: message,
    //   html: message.replace(/\n/g, '<br>'),
    // });
  } catch (error) {
    log.error('Failed to send email alert', { error });
  }
}

/**
 * Performance budget enforcement for Build pipeline
 */
export async function enforcePerformanceBudget(
  metrics: Record<string, number>
): Promise<{ passed: boolean; violations: PerformanceAlert[] }> {
  const violations: PerformanceAlert[] = [];

  for (const [metric, value] of Object.entries(metrics)) {
    const alert = checkPerformanceThreshold(metric, value);
    if (alert && alert.severity === 'critical') {
      violations.push(alert);
    }
  }

  const passed = violations.length === 0;

  if (!passed) {
    log.error('Performance budget violations detected', { violations });
  }

  return { passed, violations };
}

/**
 * Initialize performance monitoring with alerts
 */
export function initPerformanceMonitoring(config: AlertConfig = { enabled: true }): void {
  // This would integrate with your monitoring system
  // to automatically check metrics and send alerts
  
  log.info('Performance monitoring initialized', { config });

  // Example: Set up periodic checks
  if (config.enabled && typeof global !== 'undefined') {
    // Periodic performance health check
    setInterval(async () => {
      try {
        // Check if we have recent performance data
        const recentMetrics = await cache.get('recent_performance_metrics');
        if (recentMetrics) {
          // Analyze and alert if needed
          for (const [metric, value] of Object.entries(recentMetrics as Record<string, number>)) {
            const alert = checkPerformanceThreshold(metric, value);
            if (alert) {
              await sendPerformanceAlert(alert, config);
            }
          }
        }
      } catch (error) {
        log.error('Performance monitoring check failed', { error });
      }
    }, 60000); // Check every minute
  }
}