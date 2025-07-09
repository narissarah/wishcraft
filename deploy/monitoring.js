// Monitoring and logging configuration for WishCraft production
import winston from 'winston';
import { StatsD } from 'node-statsd';

// Structured logging configuration
export const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        environment: process.env.NODE_ENV,
        service: 'wishcraft',
        version: process.env.npm_package_version || '1.0.0',
        ...meta
      });
    })
  ),
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ],
  exitOnError: false
};

// Add additional transports for production
if (process.env.NODE_ENV === 'production') {
  // Datadog logs
  if (process.env.DATADOG_API_KEY) {
    loggerConfig.transports.push(
      new winston.transports.Http({
        host: 'http-intake.logs.datadoghq.com',
        path: `/v1/input/${process.env.DATADOG_API_KEY}`,
        ssl: true,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    );
  }

  // File logging for local debugging
  loggerConfig.transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
}

// Create logger instance
export const logger = winston.createLogger(loggerConfig);

// StatsD client for metrics
export const statsD = new StatsD({
  host: process.env.STATSD_HOST || 'localhost',
  port: process.env.STATSD_PORT || 8125,
  prefix: 'wishcraft.',
  suffix: '',
  globalize: false,
  cacheDns: true,
  mock: process.env.NODE_ENV !== 'production'
});

// Application Performance Monitoring configuration
export const apmConfig = {
  // Datadog APM
  datadog: {
    enabled: !!process.env.DD_API_KEY,
    serviceName: 'wishcraft',
    env: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    hostname: process.env.DD_AGENT_HOST || 'localhost',
    port: process.env.DD_TRACE_AGENT_PORT || 8126,
    logInjection: true,
    runtimeMetrics: true,
    plugins: false
  },

  // New Relic APM
  newRelic: {
    enabled: !!process.env.NEW_RELIC_LICENSE_KEY,
    appName: process.env.NEW_RELIC_APP_NAME || 'WishCraft',
    licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
    logging: {
      level: 'info',
      enabled: true
    }
  },

  // Sentry error tracking
  sentry: {
    enabled: !!process.env.SENTRY_DSN,
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release: process.env.npm_package_version || '1.0.0',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      // Prisma integration
      new Sentry.Integrations.Prisma({ client: prisma }),
      // HTTP integration
      new Sentry.Integrations.Http({ tracing: true }),
      // Express integration
      new Sentry.Integrations.Express({ app: true })
    ]
  }
};

// Health check metrics
export class HealthMetrics {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        error: 0,
        duration: []
      },
      database: {
        connections: 0,
        queries: 0,
        errors: 0
      },
      shopify: {
        apiCalls: 0,
        webhooks: 0,
        errors: 0
      },
      performance: {
        memoryUsage: 0,
        cpuUsage: 0,
        uptime: 0
      }
    };
  }

  recordRequest(duration, success = true) {
    this.metrics.requests.total++;
    if (success) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.error++;
    }
    this.metrics.requests.duration.push(duration);

    // Keep only last 1000 durations
    if (this.metrics.requests.duration.length > 1000) {
      this.metrics.requests.duration = this.metrics.requests.duration.slice(-1000);
    }

    // Send to StatsD
    statsD.increment('requests.total');
    statsD.increment(success ? 'requests.success' : 'requests.error');
    statsD.histogram('requests.duration', duration);
  }

  recordDatabaseQuery(duration, success = true) {
    this.metrics.database.queries++;
    if (!success) {
      this.metrics.database.errors++;
    }

    statsD.increment('database.queries');
    if (!success) {
      statsD.increment('database.errors');
    }
    statsD.histogram('database.query_duration', duration);
  }

  recordShopifyApiCall(endpoint, duration, success = true) {
    this.metrics.shopify.apiCalls++;
    if (!success) {
      this.metrics.shopify.errors++;
    }

    statsD.increment('shopify.api_calls');
    statsD.increment(`shopify.api_calls.${endpoint}`);
    if (!success) {
      statsD.increment('shopify.errors');
    }
    statsD.histogram('shopify.api_duration', duration);
  }

  recordWebhook(topic, success = true) {
    this.metrics.shopify.webhooks++;
    if (!success) {
      this.metrics.shopify.errors++;
    }

    statsD.increment('shopify.webhooks');
    statsD.increment(`shopify.webhooks.${topic}`);
    if (!success) {
      statsD.increment('shopify.webhook_errors');
    }
  }

  updateSystemMetrics() {
    const memUsage = process.memoryUsage();
    this.metrics.performance.memoryUsage = memUsage.heapUsed;
    this.metrics.performance.uptime = process.uptime();

    // Send system metrics to StatsD
    statsD.gauge('system.memory.heap_used', memUsage.heapUsed);
    statsD.gauge('system.memory.heap_total', memUsage.heapTotal);
    statsD.gauge('system.memory.external', memUsage.external);
    statsD.gauge('system.uptime', process.uptime());

    // CPU usage (approximation)
    const cpuUsage = process.cpuUsage();
    this.metrics.performance.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000;
    statsD.gauge('system.cpu_usage', this.metrics.performance.cpuUsage);
  }

  getMetrics() {
    this.updateSystemMetrics();
    return {
      ...this.metrics,
      timestamp: new Date().toISOString()
    };
  }

  getAverageResponseTime() {
    const durations = this.metrics.requests.duration;
    if (durations.length === 0) return 0;
    return durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  }

  getErrorRate() {
    const total = this.metrics.requests.total;
    if (total === 0) return 0;
    return (this.metrics.requests.error / total) * 100;
  }
}

// Global health metrics instance
export const healthMetrics = new HealthMetrics();

// Performance monitoring middleware
export function performanceMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const success = res.statusCode < 400;
    
    healthMetrics.recordRequest(duration, success);
    
    // Log slow requests
    if (duration > 2000) {
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }

    // Log errors
    if (!success) {
      logger.error('Request error', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }
  });

  next();
}

// Database monitoring wrapper
export function monitorDatabaseQuery(queryName, queryFunction) {
  return async (...args) => {
    const start = Date.now();
    let success = true;
    
    try {
      const result = await queryFunction(...args);
      return result;
    } catch (error) {
      success = false;
      logger.error('Database query error', {
        queryName,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      const duration = Date.now() - start;
      healthMetrics.recordDatabaseQuery(duration, success);
      
      if (duration > 1000) {
        logger.warn('Slow database query', {
          queryName,
          duration
        });
      }
    }
  };
}

// Shopify API monitoring wrapper
export function monitorShopifyApiCall(endpoint, apiFunction) {
  return async (...args) => {
    const start = Date.now();
    let success = true;
    
    try {
      const result = await apiFunction(...args);
      return result;
    } catch (error) {
      success = false;
      logger.error('Shopify API error', {
        endpoint,
        error: error.message,
        statusCode: error.response?.status
      });
      throw error;
    } finally {
      const duration = Date.now() - start;
      healthMetrics.recordShopifyApiCall(endpoint, duration, success);
    }
  };
}

// Alert thresholds
export const alertThresholds = {
  errorRate: 5, // 5%
  averageResponseTime: 2000, // 2 seconds
  databaseErrorRate: 1, // 1%
  memoryUsage: 80, // 80% of heap
  cpuUsage: 80, // 80%
  diskUsage: 85 // 85%
};

// Alert checker
export function checkAlerts() {
  const metrics = healthMetrics.getMetrics();
  const alerts = [];

  // Error rate alert
  const errorRate = healthMetrics.getErrorRate();
  if (errorRate > alertThresholds.errorRate) {
    alerts.push({
      type: 'error_rate',
      severity: errorRate > alertThresholds.errorRate * 2 ? 'critical' : 'warning',
      message: `Error rate ${errorRate.toFixed(2)}% exceeds threshold ${alertThresholds.errorRate}%`,
      value: errorRate,
      threshold: alertThresholds.errorRate
    });
  }

  // Response time alert
  const avgResponseTime = healthMetrics.getAverageResponseTime();
  if (avgResponseTime > alertThresholds.averageResponseTime) {
    alerts.push({
      type: 'response_time',
      severity: avgResponseTime > alertThresholds.averageResponseTime * 2 ? 'critical' : 'warning',
      message: `Average response time ${avgResponseTime.toFixed(0)}ms exceeds threshold ${alertThresholds.averageResponseTime}ms`,
      value: avgResponseTime,
      threshold: alertThresholds.averageResponseTime
    });
  }

  // Memory usage alert
  const memUsage = process.memoryUsage();
  const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  if (memUsagePercent > alertThresholds.memoryUsage) {
    alerts.push({
      type: 'memory_usage',
      severity: memUsagePercent > alertThresholds.memoryUsage * 1.2 ? 'critical' : 'warning',
      message: `Memory usage ${memUsagePercent.toFixed(1)}% exceeds threshold ${alertThresholds.memoryUsage}%`,
      value: memUsagePercent,
      threshold: alertThresholds.memoryUsage
    });
  }

  return alerts;
}

// Alert notification sender
export async function sendAlerts(alerts) {
  if (alerts.length === 0) return;

  for (const alert of alerts) {
    logger.error('Performance alert triggered', alert);

    // Send to Slack
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        const color = alert.severity === 'critical' ? 'danger' : 'warning';
        const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';
        
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `${emoji} WishCraft Alert: ${alert.type}`,
            attachments: [{
              color,
              fields: [
                { title: 'Message', value: alert.message, short: false },
                { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
                { title: 'Current Value', value: alert.value?.toString() || 'N/A', short: true },
                { title: 'Threshold', value: alert.threshold?.toString() || 'N/A', short: true }
              ]
            }]
          })
        });
      } catch (error) {
        logger.error('Failed to send Slack alert', { error: error.message });
      }
    }

    // Send to PagerDuty for critical alerts
    if (alert.severity === 'critical' && process.env.PAGERDUTY_INTEGRATION_KEY) {
      try {
        await fetch('https://events.pagerduty.com/v2/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routing_key: process.env.PAGERDUTY_INTEGRATION_KEY,
            event_action: 'trigger',
            payload: {
              summary: `WishCraft Critical Alert: ${alert.type}`,
              source: 'wishcraft-monitoring',
              severity: 'critical',
              custom_details: alert
            }
          })
        });
      } catch (error) {
        logger.error('Failed to send PagerDuty alert', { error: error.message });
      }
    }
  }
}

// Periodic monitoring job
export function startMonitoring() {
  // Update system metrics every 30 seconds
  setInterval(() => {
    healthMetrics.updateSystemMetrics();
  }, 30000);

  // Check alerts every 2 minutes
  setInterval(async () => {
    const alerts = checkAlerts();
    if (alerts.length > 0) {
      await sendAlerts(alerts);
    }
  }, 120000);

  logger.info('Monitoring started', {
    healthMetricsEnabled: true,
    alertsEnabled: true,
    datadogEnabled: apmConfig.datadog.enabled,
    sentryEnabled: apmConfig.sentry.enabled
  });
}

export default {
  logger,
  statsD,
  healthMetrics,
  performanceMiddleware,
  monitorDatabaseQuery,
  monitorShopifyApiCall,
  startMonitoring,
  checkAlerts,
  sendAlerts
};