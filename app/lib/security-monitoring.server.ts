import { LRUCache } from "lru-cache";
import crypto from "crypto";
import { auditService } from "./audit-service.server";

/**
 * Security Monitoring Service
 * Real-time security event monitoring and alerting
 */

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  source: string;
  details: Record<string, any>;
  shop?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
}

export type SecurityEventType = 
  | 'failed_login'
  | 'rate_limit_exceeded'
  | 'csrf_token_mismatch'
  | 'invalid_hmac'
  | 'suspicious_activity'
  | 'unauthorized_access'
  | 'sql_injection_attempt'
  | 'xss_attempt'
  | 'file_upload_threat'
  | 'brute_force_attempt'
  | 'privilege_escalation'
  | 'data_breach_attempt';

export interface SecurityAlert {
  id: string;
  severity: 'medium' | 'high' | 'critical';
  type: string;
  message: string;
  timestamp: Date;
  events: SecurityEvent[];
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface SecurityMetrics {
  totalEvents: number;
  criticalEvents: number;
  activeAlerts: number;
  topThreats: Array<{ type: string; count: number }>;
  securityScore: number;
  lastUpdated: Date;
}

class SecurityMonitoringService {
  private events: LRUCache<string, SecurityEvent>;
  private alerts: LRUCache<string, SecurityAlert>;
  private metrics: SecurityMetrics;
  private threatPatterns: Map<string, RegExp>;
  private rateLimitTracking: Map<string, number[]>;

  constructor() {
    this.events = new LRUCache<string, SecurityEvent>({
      max: 10000, // Store up to 10k events
      ttl: 24 * 60 * 60 * 1000 // 24 hours
    });

    this.alerts = new LRUCache<string, SecurityAlert>({
      max: 1000, // Store up to 1k alerts
      ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    this.metrics = {
      totalEvents: 0,
      criticalEvents: 0,
      activeAlerts: 0,
      topThreats: [],
      securityScore: 100,
      lastUpdated: new Date()
    };

    this.threatPatterns = new Map([
      ['sql_injection', /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)|(\'\s*(OR|AND)\s*\d+\s*=\s*\d+)/i],
      ['xss', /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi],
      ['path_traversal', /\.\.[\/\\]/],
      ['command_injection', /(\b(exec|system|shell_exec|passthru|eval)\b)|(\||\&\&|\;)/i]
    ]);

    this.rateLimitTracking = new Map();
    
    // Start metrics update interval
    setInterval(() => this.updateMetrics(), 60000); // Update every minute
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(
    type: SecurityEventType,
    severity: SecurityEvent['severity'],
    source: string,
    details: Record<string, any>,
    context?: {
      shop?: string;
      userId?: string;
      ip?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      type,
      severity,
      timestamp: new Date(),
      source,
      details,
      ...context
    };

    this.events.set(event.id, event);
    
    // Check for alert conditions
    await this.checkAlertConditions(event);
    
    // Log to audit service
    await auditService.logEvent({
      event: 'security_event' as any,
      shopDomain: context?.shop || 'unknown',
      timestamp: event.timestamp.toISOString(),
      environment: (process.env.NODE_ENV || 'development') as any,
      metadata: {
        securityEventType: type,
        severity,
        source,
        details
      }
    });

    // Update metrics
    this.updateMetrics();
  }

  /**
   * Check if event should trigger an alert
   */
  private async checkAlertConditions(event: SecurityEvent): Promise<void> {
    const now = new Date();
    const oneHour = 60 * 60 * 1000;
    
    // Get recent events of same type
    const recentEvents = Array.from(this.events.values())
      .filter(e => 
        e.type === event.type && 
        e.timestamp.getTime() > now.getTime() - oneHour
      );

    // Alert conditions
    const alertConditions = [
      {
        condition: event.severity === 'critical',
        message: `Critical security event: ${event.type}`,
        severity: 'critical' as const
      },
      {
        condition: recentEvents.length >= 5 && event.severity === 'high',
        message: `High frequency security events: ${event.type} (${recentEvents.length} in last hour)`,
        severity: 'high' as const
      },
      {
        condition: recentEvents.length >= 10 && event.severity === 'medium',
        message: `Security event pattern detected: ${event.type} (${recentEvents.length} in last hour)`,
        severity: 'medium' as const
      }
    ];

    for (const { condition, message, severity } of alertConditions) {
      if (condition) {
        await this.createAlert(event.type, message, severity, recentEvents);
        break; // Only create one alert per event
      }
    }
  }

  /**
   * Create a security alert
   */
  private async createAlert(
    type: string,
    message: string,
    severity: SecurityAlert['severity'],
    events: SecurityEvent[]
  ): Promise<void> {
    const alert: SecurityAlert = {
      id: crypto.randomUUID(),
      severity,
      type,
      message,
      timestamp: new Date(),
      events,
      resolved: false
    };

    this.alerts.set(alert.id, alert);

    // Send notification (webhook, email, etc.)
    await this.sendAlertNotification(alert);
  }

  /**
   * Send alert notification
   */
  private async sendAlertNotification(alert: SecurityAlert): Promise<void> {
    // Implementation depends on notification system
    console.log(`🚨 SECURITY ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
    
    // Example: Send to webhook
    if (process.env.SECURITY_WEBHOOK_URL) {
      try {
        await fetch(process.env.SECURITY_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alert: {
              id: alert.id,
              severity: alert.severity,
              type: alert.type,
              message: alert.message,
              timestamp: alert.timestamp.toISOString(),
              eventCount: alert.events.length
            }
          })
        });
      } catch (error) {
        console.error('Failed to send security alert notification:', error);
      }
    }
  }

  /**
   * Analyze request for security threats
   */
  async analyzeRequest(
    request: Request,
    context: { shop?: string; userId?: string } = {}
  ): Promise<void> {
    const url = new URL(request.url);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Check for threat patterns in URL
    const fullUrl = url.toString();
    for (const [threatType, pattern] of this.threatPatterns) {
      if (pattern.test(fullUrl)) {
        await this.logSecurityEvent(
          threatType as SecurityEventType,
          'high',
          'url_analysis',
          { url: fullUrl, pattern: pattern.source },
          { ...context, ip, userAgent }
        );
      }
    }

    // Check for suspicious headers
    const suspiciousHeaders = [
      'x-forwarded-host',
      'x-originating-ip',
      'x-cluster-client-ip'
    ];

    for (const header of suspiciousHeaders) {
      const value = request.headers.get(header);
      if (value && value !== ip) {
        await this.logSecurityEvent(
          'suspicious_activity',
          'medium',
          'header_analysis',
          { header, value, actualIp: ip },
          { ...context, ip, userAgent }
        );
      }
    }

    // Check for rate limiting abuse
    const rateLimitKey = `${ip}:${url.pathname}`;
    const now = Date.now();
    const requests = this.rateLimitTracking.get(rateLimitKey) || [];
    
    // Keep only requests from last minute
    const recentRequests = requests.filter(time => now - time < 60000);
    recentRequests.push(now);
    this.rateLimitTracking.set(rateLimitKey, recentRequests);

    if (recentRequests.length > 30) { // More than 30 requests per minute
      await this.logSecurityEvent(
        'rate_limit_exceeded',
        'medium',
        'rate_limit_analysis',
        { requestsPerMinute: recentRequests.length, path: url.pathname },
        { ...context, ip, userAgent }
      );
    }
  }

  /**
   * Update security metrics
   */
  private updateMetrics(): void {
    const now = new Date();
    const events = Array.from(this.events.values());
    const alerts = Array.from(this.alerts.values());

    // Count events by type
    const eventTypes = new Map<string, number>();
    let criticalCount = 0;

    for (const event of events) {
      eventTypes.set(event.type, (eventTypes.get(event.type) || 0) + 1);
      if (event.severity === 'critical') {
        criticalCount++;
      }
    }

    // Top threats
    const topThreats = Array.from(eventTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    // Security score (simple calculation)
    const baseScore = 100;
    const criticalPenalty = criticalCount * 10;
    const alertPenalty = alerts.filter(a => !a.resolved).length * 5;
    const securityScore = Math.max(0, baseScore - criticalPenalty - alertPenalty);

    this.metrics = {
      totalEvents: events.length,
      criticalEvents: criticalCount,
      activeAlerts: alerts.filter(a => !a.resolved).length,
      topThreats,
      securityScore,
      lastUpdated: now
    };
  }

  /**
   * Get security metrics
   */
  getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent security events
   */
  getRecentEvents(limit: number = 100): SecurityEvent[] {
    return Array.from(this.events.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): SecurityAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    this.alerts.set(alertId, alert);
    this.updateMetrics();
    
    return true;
  }

  /**
   * Get security dashboard data
   */
  async getDashboardData(): Promise<{
    metrics: SecurityMetrics;
    recentEvents: SecurityEvent[];
    activeAlerts: SecurityAlert[];
    threatTrends: Array<{ date: string; count: number }>;
  }> {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentEvents = Array.from(this.events.values())
      .filter(event => event.timestamp >= last24Hours)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 50);

    // Calculate threat trends (hourly for last 24 hours)
    const threatTrends = [];
    for (let i = 0; i < 24; i++) {
      const hourStart = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000);
      const hourEnd = new Date(now.getTime() - i * 60 * 60 * 1000);
      
      const hourEvents = recentEvents.filter(
        event => event.timestamp >= hourStart && event.timestamp < hourEnd
      );
      
      threatTrends.unshift({
        date: hourStart.toISOString(),
        count: hourEvents.length
      });
    }

    return {
      metrics: this.getMetrics(),
      recentEvents: recentEvents.slice(0, 20),
      activeAlerts: this.getActiveAlerts(),
      threatTrends
    };
  }
}

// Singleton instance
export const securityMonitor = new SecurityMonitoringService();

// Middleware for automatic threat analysis
export function securityAnalysisMiddleware() {
  return async (request: Request, context: any, next: () => Promise<Response>) => {
    // Analyze request for threats
    await securityMonitor.analyzeRequest(request, {
      shop: context.shop,
      userId: context.userId
    });

    const response = await next();

    // Log suspicious response patterns
    if (response.status === 403 || response.status === 401) {
      await securityMonitor.logSecurityEvent(
        'unauthorized_access',
        'medium',
        'response_analysis',
        { statusCode: response.status, path: new URL(request.url).pathname },
        { shop: context.shop, userId: context.userId }
      );
    }

    return response;
  };
}

// Helper functions for common security logging
export const SecurityLogger = {
  logFailedLogin: (ip: string, userAgent: string, details: any) =>
    securityMonitor.logSecurityEvent(
      'failed_login',
      'medium',
      'auth_system',
      details,
      { ip, userAgent }
    ),

  logCSRFFailure: (ip: string, userAgent: string, details: any, shop?: string) =>
    securityMonitor.logSecurityEvent(
      'csrf_token_mismatch',
      'high',
      'csrf_protection',
      details,
      { ip, userAgent, shop }
    ),

  logHMACFailure: (ip: string, userAgent: string, details: any, shop?: string) =>
    securityMonitor.logSecurityEvent(
      'invalid_hmac',
      'high',
      'webhook_security',
      details,
      { ip, userAgent, shop }
    ),

  logBruteForce: (ip: string, userAgent: string, details: any) =>
    securityMonitor.logSecurityEvent(
      'brute_force_attempt',
      'high',
      'rate_limiter',
      details,
      { ip, userAgent }
    ),

  logDataBreach: (userId: string, shop: string, details: any) =>
    securityMonitor.logSecurityEvent(
      'data_breach_attempt',
      'critical',
      'data_access',
      details,
      { userId, shop }
    )
};