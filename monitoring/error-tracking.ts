// Comprehensive Error Tracking and Alerting System for WishCraft
// Multi-provider error tracking with intelligent alerting and escalation

import * as Sentry from '@sentry/node';
import { logger } from './logger';
import { apmManager } from './apm-setup';

// Error Severity Levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error Categories
export enum ErrorCategory {
  DATABASE = 'database',
  SHOPIFY_API = 'shopify_api',
  AUTHENTICATION = 'authentication',
  PAYMENT = 'payment',
  VALIDATION = 'validation',
  NETWORK = 'network',
  BUSINESS_LOGIC = 'business_logic',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  UNKNOWN = 'unknown'
}

// Error Context Interface
export interface ErrorContext {
  userId?: string;
  shopId?: string;
  registryId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  url?: string;
  method?: string;
  timestamp: number;
  environment: string;
  version: string;
}

// Alert Configuration
export interface AlertConfig {
  enabled: boolean;
  channels: AlertChannel[];
  thresholds: {
    errorRate: number; // errors per minute
    criticalErrors: number; // critical errors in 5 minutes
    newErrorType: boolean; // alert on new error types
  };
  escalation: {
    enabled: boolean;
    timeoutMinutes: number;
    levels: string[]; // email addresses or webhook URLs
  };
}

export interface AlertChannel {
  type: 'slack' | 'email' | 'pagerduty' | 'webhook';
  config: Record<string, any>;
  severityFilter: ErrorSeverity[];
}

// Enhanced Error Class
export class WishCraftError extends Error {
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly context: ErrorContext;
  public readonly fingerprint: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    context: Partial<ErrorContext> = {},
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'WishCraftError';
    this.severity = severity;
    this.category = category;
    this.retryable = retryable;
    
    this.context = {
      timestamp: Date.now(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      ...context
    };

    this.fingerprint = this.generateFingerprint();
  }

  private generateFingerprint(): string {
    // Create unique fingerprint for error grouping
    const components = [
      this.name,
      this.category,
      this.message.replace(/\d+/g, 'X'), // Replace numbers for grouping
      this.stack?.split('\n')[1]?.trim() // First stack frame
    ];
    
    return Buffer.from(components.join('|')).toString('base64').slice(0, 16);
  }
}

// Error Tracking Manager
export class ErrorTrackingManager {
  private alertConfig: AlertConfig;
  private errorCounts: Map<string, number> = new Map();
  private recentErrors: WishCraftError[] = [];
  private alertHistory: Map<string, number> = new Map();

  constructor(alertConfig: AlertConfig) {
    this.alertConfig = alertConfig;
    this.setupErrorHandlers();
    this.startCleanupJobs();
  }

  private setupErrorHandlers(): void {
    // Unhandled exceptions
    process.on('uncaughtException', (error) => {
      this.captureError(new WishCraftError(
        error.message,
        ErrorSeverity.CRITICAL,
        ErrorCategory.UNKNOWN,
        { stack: error.stack }
      ));
      
      // Give time for error to be sent before exiting
      setTimeout(() => process.exit(1), 1000);
    });

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.captureError(new WishCraftError(
        `Unhandled Promise Rejection: ${reason}`,
        ErrorSeverity.HIGH,
        ErrorCategory.UNKNOWN,
        { promise: promise.toString() }
      ));
    });

    // Express error handler would be set up separately
    logger.info('Error handlers initialized');
  }

  private startCleanupJobs(): void {
    // Clean up old error counts every hour
    setInterval(() => {
      this.cleanupErrorCounts();
    }, 3600000); // 1 hour

    // Clean up recent errors every 10 minutes
    setInterval(() => {
      this.cleanupRecentErrors();
    }, 600000); // 10 minutes
  }

  // Main error capture method
  public captureError(error: WishCraftError | Error, context?: Partial<ErrorContext>): void {
    const enhancedError = error instanceof WishCraftError 
      ? error 
      : this.enhanceError(error, context);

    // Track error counts for alerting
    this.trackErrorCount(enhancedError);

    // Store recent errors
    this.recentErrors.push(enhancedError);

    // Send to APM
    apmManager.recordError(enhancedError, enhancedError.context);

    // Send to Sentry with enhanced context
    this.sendToSentry(enhancedError);

    // Check if alerts should be triggered
    this.checkAlertThresholds(enhancedError);

    // Log error
    logger.error('Error captured', {
      fingerprint: enhancedError.fingerprint,
      severity: enhancedError.severity,
      category: enhancedError.category,
      message: enhancedError.message,
      context: enhancedError.context
    });
  }

  private enhanceError(error: Error, context?: Partial<ErrorContext>): WishCraftError {
    // Determine category based on error characteristics
    const category = this.categorizeError(error);
    
    // Determine severity based on error type and context
    const severity = this.determineSeverity(error, category);

    return new WishCraftError(
      error.message,
      severity,
      category,
      {
        ...context,
        originalName: error.name,
        stack: error.stack
      }
    );
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('database') || message.includes('prisma') || stack.includes('prisma')) {
      return ErrorCategory.DATABASE;
    }
    
    if (message.includes('shopify') || message.includes('graphql') || stack.includes('shopify')) {
      return ErrorCategory.SHOPIFY_API;
    }
    
    if (message.includes('auth') || message.includes('token') || message.includes('unauthorized')) {
      return ErrorCategory.AUTHENTICATION;
    }
    
    if (message.includes('payment') || message.includes('billing') || message.includes('stripe')) {
      return ErrorCategory.PAYMENT;
    }
    
    if (message.includes('validation') || message.includes('invalid') || error.name === 'ValidationError') {
      return ErrorCategory.VALIDATION;
    }
    
    if (message.includes('network') || message.includes('timeout') || message.includes('econnreset')) {
      return ErrorCategory.NETWORK;
    }
    
    if (message.includes('security') || message.includes('csrf') || message.includes('xss')) {
      return ErrorCategory.SECURITY;
    }
    
    if (message.includes('slow') || message.includes('timeout') || message.includes('performance')) {
      return ErrorCategory.PERFORMANCE;
    }

    return ErrorCategory.UNKNOWN;
  }

  private determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    // Critical severity conditions
    if (category === ErrorCategory.SECURITY || 
        category === ErrorCategory.DATABASE ||
        error.message.includes('crash') ||
        error.message.includes('memory')) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity conditions
    if (category === ErrorCategory.PAYMENT ||
        category === ErrorCategory.SHOPIFY_API ||
        error.message.includes('500') ||
        error.message.includes('internal server error')) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity conditions
    if (category === ErrorCategory.AUTHENTICATION ||
        category === ErrorCategory.NETWORK ||
        error.message.includes('400') ||
        error.message.includes('404')) {
      return ErrorSeverity.MEDIUM;
    }

    // Default to low severity
    return ErrorSeverity.LOW;
  }

  private trackErrorCount(error: WishCraftError): void {
    const minute = Math.floor(Date.now() / 60000); // Current minute
    const key = `${minute}:${error.fingerprint}`;
    
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
  }

  private sendToSentry(error: WishCraftError): void {
    Sentry.withScope((scope) => {
      // Set error context
      scope.setTag('severity', error.severity);
      scope.setTag('category', error.category);
      scope.setTag('fingerprint', error.fingerprint);
      scope.setTag('retryable', error.retryable);

      // Set user context if available
      if (error.context.userId) {
        scope.setUser({ id: error.context.userId });
      }

      // Set additional context
      scope.setContext('error_context', error.context);
      scope.setLevel(this.mapSeverityToSentryLevel(error.severity));

      // Set fingerprint for grouping
      scope.setFingerprint([error.fingerprint]);

      Sentry.captureException(error);
    });
  }

  private mapSeverityToSentryLevel(severity: ErrorSeverity): any {
    switch (severity) {
      case ErrorSeverity.CRITICAL: return 'fatal';
      case ErrorSeverity.HIGH: return 'error';
      case ErrorSeverity.MEDIUM: return 'warning';
      case ErrorSeverity.LOW: return 'info';
      default: return 'error';
    }
  }

  private checkAlertThresholds(error: WishCraftError): void {
    if (!this.alertConfig.enabled) return;

    // Check for critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.sendAlert(error, 'Critical error detected');
      return;
    }

    // Check error rate threshold
    const currentMinute = Math.floor(Date.now() / 60000);
    let totalErrors = 0;
    
    for (let i = 0; i < 5; i++) { // Last 5 minutes
      const minute = currentMinute - i;
      for (const [key, count] of this.errorCounts.entries()) {
        if (key.startsWith(`${minute}:`)) {
          totalErrors += count;
        }
      }
    }

    if (totalErrors >= this.alertConfig.thresholds.errorRate) {
      this.sendAlert(error, `High error rate: ${totalErrors} errors in 5 minutes`);
    }

    // Check for new error types
    if (this.alertConfig.thresholds.newErrorType && this.isNewErrorType(error)) {
      this.sendAlert(error, `New error type detected: ${error.category}`);
    }
  }

  private isNewErrorType(error: WishCraftError): boolean {
    const key = `${error.category}:${error.fingerprint}`;
    const lastSeen = this.alertHistory.get(key);
    const now = Date.now();
    
    // Consider it new if not seen in last 24 hours
    if (!lastSeen || (now - lastSeen) > 86400000) {
      this.alertHistory.set(key, now);
      return true;
    }
    
    return false;
  }

  private async sendAlert(error: WishCraftError, message: string): Promise<void> {
    for (const channel of this.alertConfig.channels) {
      if (channel.severityFilter.includes(error.severity)) {
        try {
          await this.sendToChannel(channel, error, message);
        } catch (alertError) {
          logger.error('Failed to send alert', { 
            channel: channel.type, 
            error: alertError 
          });
        }
      }
    }
  }

  private async sendToChannel(channel: AlertChannel, error: WishCraftError, message: string): Promise<void> {
    switch (channel.type) {
      case 'slack':
        await this.sendSlackAlert(channel.config, error, message);
        break;
      case 'email':
        await this.sendEmailAlert(channel.config, error, message);
        break;
      case 'pagerduty':
        await this.sendPagerDutyAlert(channel.config, error, message);
        break;
      case 'webhook':
        await this.sendWebhookAlert(channel.config, error, message);
        break;
    }
  }

  private async sendSlackAlert(config: any, error: WishCraftError, message: string): Promise<void> {
    const color = this.getSeverityColor(error.severity);
    
    const payload = {
      text: `🚨 WishCraft Alert: ${message}`,
      attachments: [{
        color,
        fields: [
          { title: 'Severity', value: error.severity.toUpperCase(), short: true },
          { title: 'Category', value: error.category, short: true },
          { title: 'Error', value: error.message, short: false },
          { title: 'Fingerprint', value: error.fingerprint, short: true },
          { title: 'Shop ID', value: error.context.shopId || 'N/A', short: true }
        ],
        footer: 'WishCraft Error Tracking',
        ts: Math.floor(error.context.timestamp / 1000)
      }]
    };

    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  private async sendEmailAlert(config: any, error: WishCraftError, message: string): Promise<void> {
    // Email sending implementation would go here
    // Using SendGrid, Mailgun, or similar service
    logger.info('Email alert would be sent', { config, error: error.fingerprint, message });
  }

  private async sendPagerDutyAlert(config: any, error: WishCraftError, message: string): Promise<void> {
    const payload = {
      routing_key: config.integrationKey,
      event_action: 'trigger',
      payload: {
        summary: message,
        source: 'wishcraft',
        severity: error.severity,
        custom_details: {
          category: error.category,
          fingerprint: error.fingerprint,
          context: error.context
        }
      }
    };

    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  private async sendWebhookAlert(config: any, error: WishCraftError, message: string): Promise<void> {
    const payload = {
      alert: message,
      error: {
        severity: error.severity,
        category: error.category,
        message: error.message,
        fingerprint: error.fingerprint,
        context: error.context
      },
      timestamp: error.context.timestamp
    };

    await fetch(config.url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...config.headers 
      },
      body: JSON.stringify(payload)
    });
  }

  private getSeverityColor(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL: return '#ff0000';
      case ErrorSeverity.HIGH: return '#ff6600';
      case ErrorSeverity.MEDIUM: return '#ffcc00';
      case ErrorSeverity.LOW: return '#00ff00';
      default: return '#cccccc';
    }
  }

  private cleanupErrorCounts(): void {
    const cutoff = Math.floor(Date.now() / 60000) - 60; // 1 hour ago
    
    for (const [key] of this.errorCounts.entries()) {
      const minute = parseInt(key.split(':')[0]);
      if (minute < cutoff) {
        this.errorCounts.delete(key);
      }
    }
  }

  private cleanupRecentErrors(): void {
    const cutoff = Date.now() - 3600000; // 1 hour ago
    this.recentErrors = this.recentErrors.filter(error => error.context.timestamp > cutoff);
  }

  // Error Analytics
  public getErrorAnalytics(): any {
    const now = Date.now();
    const last24h = now - 86400000;
    
    const recentErrors = this.recentErrors.filter(error => error.context.timestamp > last24h);
    
    return {
      totalErrors: recentErrors.length,
      errorsByCategory: this.groupBy(recentErrors, 'category'),
      errorsBySeverity: this.groupBy(recentErrors, 'severity'),
      topErrors: this.getTopErrors(recentErrors),
      errorRate: this.calculateErrorRate(recentErrors),
      trends: this.calculateTrends(recentErrors)
    };
  }

  private groupBy(errors: WishCraftError[], field: keyof WishCraftError): Record<string, number> {
    return errors.reduce((acc, error) => {
      const key = String(error[field]);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getTopErrors(errors: WishCraftError[]): Array<{ fingerprint: string; count: number; message: string }> {
    const counts = errors.reduce((acc, error) => {
      acc[error.fingerprint] = {
        count: (acc[error.fingerprint]?.count || 0) + 1,
        message: error.message
      };
      return acc;
    }, {} as Record<string, { count: number; message: string }>);

    return Object.entries(counts)
      .map(([fingerprint, data]) => ({ fingerprint, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private calculateErrorRate(errors: WishCraftError[]): number {
    // Calculate errors per hour
    const hours = 24;
    return errors.length / hours;
  }

  private calculateTrends(errors: WishCraftError[]): any {
    // Calculate hourly error trends
    const hourlyBuckets: Record<string, number> = {};
    
    errors.forEach(error => {
      const hour = Math.floor(error.context.timestamp / 3600000);
      hourlyBuckets[hour] = (hourlyBuckets[hour] || 0) + 1;
    });

    return Object.entries(hourlyBuckets)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => a.hour - b.hour);
  }
}

// Express Error Handler Middleware
export function createErrorHandler(errorTracker: ErrorTrackingManager) {
  return (error: Error, req: any, res: any, next: any) => {
    const context: Partial<ErrorContext> = {
      userId: req.user?.id,
      shopId: req.shop?.id,
      requestId: req.id,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      url: req.originalUrl,
      method: req.method
    };

    errorTracker.captureError(error, context);

    // Send appropriate response
    if (res.headersSent) {
      return next(error);
    }

    const statusCode = error instanceof WishCraftError && error.severity === ErrorSeverity.LOW ? 400 : 500;
    
    res.status(statusCode).json({
      error: {
        message: process.env.NODE_ENV === 'production' 
          ? 'An error occurred' 
          : error.message,
        code: error instanceof WishCraftError ? error.fingerprint : undefined
      }
    });
  };
}

// Configuration Factory
export function createAlertConfig(): AlertConfig {
  return {
    enabled: process.env.NODE_ENV === 'production',
    channels: [
      {
        type: 'slack',
        config: {
          webhookUrl: process.env.SLACK_ERROR_WEBHOOK_URL
        },
        severityFilter: [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]
      },
      {
        type: 'email',
        config: {
          recipients: process.env.ERROR_EMAIL_RECIPIENTS?.split(',') || []
        },
        severityFilter: [ErrorSeverity.CRITICAL]
      }
    ],
    thresholds: {
      errorRate: 50, // 50 errors in 5 minutes
      criticalErrors: 1, // Any critical error
      newErrorType: true
    },
    escalation: {
      enabled: true,
      timeoutMinutes: 30,
      levels: process.env.ESCALATION_CONTACTS?.split(',') || []
    }
  };
}

// Export singleton instance
export const alertConfig = createAlertConfig();
export const errorTracker = new ErrorTrackingManager(alertConfig);