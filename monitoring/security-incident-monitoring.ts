// Security Incident Monitoring System for WishCraft
// Comprehensive security event detection, analysis, and incident response

import { logger } from './logger';
import { apmManager } from './apm-setup';
import { errorTracker } from './error-tracking';
import crypto from 'crypto';

// Security Event Types
export enum SecurityEventType {
  // Authentication Events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET = 'password_reset',
  ACCOUNT_LOCKOUT = 'account_lockout',
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',
  
  // Authorization Events
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  PERMISSION_DENIED = 'permission_denied',
  ADMIN_ACCESS = 'admin_access',
  
  // API Security Events
  API_KEY_CREATED = 'api_key_created',
  API_KEY_DELETED = 'api_key_deleted',
  API_RATE_LIMIT_EXCEEDED = 'api_rate_limit_exceeded',
  INVALID_API_KEY = 'invalid_api_key',
  
  // Data Security Events
  DATA_EXPORT = 'data_export',
  DATA_DELETION = 'data_deletion',
  SENSITIVE_DATA_ACCESS = 'sensitive_data_access',
  PII_ACCESS = 'pii_access',
  
  // Attack Attempts
  SQL_INJECTION = 'sql_injection',
  XSS_ATTEMPT = 'xss_attempt',
  CSRF_ATTEMPT = 'csrf_attempt',
  BRUTE_FORCE = 'brute_force',
  BOT_DETECTION = 'bot_detection',
  SUSPICIOUS_PATTERN = 'suspicious_pattern',
  
  // System Security Events
  CONFIGURATION_CHANGE = 'configuration_change',
  SECURITY_POLICY_VIOLATION = 'security_policy_violation',
  FILE_INTEGRITY_VIOLATION = 'file_integrity_violation',
  MALWARE_DETECTED = 'malware_detected',
  
  // Network Security Events
  SUSPICIOUS_IP = 'suspicious_ip',
  GEOLOCATION_ANOMALY = 'geolocation_anomaly',
  TRAFFIC_ANOMALY = 'traffic_anomaly',
  DDoS_ATTEMPT = 'ddos_attempt'
}

// Security Severity Levels
export enum SecuritySeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Security Event Data
export interface SecurityEvent {
  eventId: string;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  timestamp: number;
  source: {
    ip: string;
    hashedIP: string;
    userAgent: string;
    country?: string;
    city?: string;
    isp?: string;
  };
  user: {
    id?: string;
    email?: string;
    hashedEmail?: string;
    role?: string;
  };
  shop: {
    id?: string;
    domain?: string;
  };
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: any;
    queryParams?: Record<string, string>;
  };
  response: {
    statusCode: number;
    contentType?: string;
    size?: number;
  };
  detection: {
    rule: string;
    confidence: number;
    riskScore: number;
    indicators: string[];
  };
  context: {
    sessionId?: string;
    requestId?: string;
    correlationId?: string;
    metadata: Record<string, any>;
  };
}

// Threat Intelligence Data
export interface ThreatIndicator {
  type: 'ip' | 'domain' | 'hash' | 'pattern';
  value: string;
  severity: SecuritySeverity;
  source: string;
  confidence: number;
  firstSeen: number;
  lastSeen: number;
  tags: string[];
}

// Security Rule Configuration
export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  eventTypes: SecurityEventType[];
  conditions: {
    timeWindow: number; // minutes
    threshold: number;
    pattern?: RegExp;
  };
  severity: SecuritySeverity;
  enabled: boolean;
  actions: SecurityAction[];
}

// Security Actions
export enum SecurityAction {
  LOG = 'log',
  ALERT = 'alert',
  BLOCK_IP = 'block_ip',
  BLOCK_USER = 'block_user',
  REQUIRE_MFA = 'require_mfa',
  ESCALATE = 'escalate',
  QUARANTINE = 'quarantine'
}

// Security Incident
export interface SecurityIncident {
  incidentId: string;
  title: string;
  description: string;
  severity: SecuritySeverity;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  assignee?: string;
  events: SecurityEvent[];
  timeline: {
    timestamp: number;
    action: string;
    user: string;
    notes?: string;
  }[];
  resolution?: {
    timestamp: number;
    summary: string;
    actions_taken: string[];
    lessons_learned: string[];
  };
  created: number;
  updated: number;
}

// Security Monitoring Configuration
export interface SecurityConfig {
  monitoring: {
    enabled: boolean;
    realTimeAnalysis: boolean;
    threatIntelligence: boolean;
    geoLocationTracking: boolean;
  };
  alerting: {
    channels: string[];
    severityThresholds: Record<SecuritySeverity, boolean>;
    escalationEnabled: boolean;
    escalationTimeMinutes: number;
  };
  retention: {
    eventRetentionDays: number;
    incidentRetentionDays: number;
    logRetentionDays: number;
  };
  rules: SecurityRule[];
}

// Security Incident Monitor
export class SecurityIncidentMonitor {
  private config: SecurityConfig;
  private events: SecurityEvent[] = [];
  private incidents: Map<string, SecurityIncident> = new Map();
  private threatIndicators: Map<string, ThreatIndicator> = new Map();
  private blockedIPs: Set<string> = new Set();
  private blockedUsers: Set<string> = new Set();
  private riskScores: Map<string, number> = new Map();

  constructor(config: SecurityConfig) {
    this.config = config;
    this.initializeRules();
    this.startMonitoring();
  }

  private initializeRules(): void {
    // Default security rules
    const defaultRules: SecurityRule[] = [
      {
        id: 'brute_force_detection',
        name: 'Brute Force Attack Detection',
        description: 'Detects multiple failed login attempts from same IP',
        eventTypes: [SecurityEventType.LOGIN_FAILURE],
        conditions: {
          timeWindow: 5,
          threshold: 5
        },
        severity: SecuritySeverity.HIGH,
        enabled: true,
        actions: [SecurityAction.ALERT, SecurityAction.BLOCK_IP]
      },
      {
        id: 'sql_injection_detection',
        name: 'SQL Injection Detection',
        description: 'Detects potential SQL injection patterns',
        eventTypes: [SecurityEventType.SQL_INJECTION],
        conditions: {
          timeWindow: 1,
          threshold: 1,
          pattern: /(union|select|insert|update|delete|drop|create|alter|exec|execute)/i
        },
        severity: SecuritySeverity.CRITICAL,
        enabled: true,
        actions: [SecurityAction.ALERT, SecurityAction.BLOCK_IP, SecurityAction.ESCALATE]
      },
      {
        id: 'admin_access_monitoring',
        name: 'Admin Access Monitoring',
        description: 'Monitors administrative access events',
        eventTypes: [SecurityEventType.ADMIN_ACCESS],
        conditions: {
          timeWindow: 60,
          threshold: 1
        },
        severity: SecuritySeverity.MEDIUM,
        enabled: true,
        actions: [SecurityAction.LOG, SecurityAction.ALERT]
      },
      {
        id: 'geolocation_anomaly',
        name: 'Geolocation Anomaly Detection',
        description: 'Detects access from unusual locations',
        eventTypes: [SecurityEventType.GEOLOCATION_ANOMALY],
        conditions: {
          timeWindow: 15,
          threshold: 1
        },
        severity: SecuritySeverity.MEDIUM,
        enabled: true,
        actions: [SecurityAction.ALERT, SecurityAction.REQUIRE_MFA]
      }
    ];

    this.config.rules = [...this.config.rules, ...defaultRules];
  }

  private startMonitoring(): void {
    // Process security events every 30 seconds
    setInterval(() => {
      this.processSecurityEvents();
    }, 30000);

    // Update threat intelligence every hour
    setInterval(() => {
      this.updateThreatIntelligence();
    }, 3600000);

    // Clean up old events every 6 hours
    setInterval(() => {
      this.cleanupOldData();
    }, 21600000);

    // Generate security reports every 24 hours
    setInterval(() => {
      this.generateSecurityReport();
    }, 86400000);

    logger.info('Security incident monitoring initialized');
  }

  // Record Security Event
  public recordSecurityEvent(
    eventType: SecurityEventType,
    source: Partial<SecurityEvent['source']>,
    user: Partial<SecurityEvent['user']> = {},
    request: Partial<SecurityEvent['request']> = {},
    response: Partial<SecurityEvent['response']> = {},
    context: Partial<SecurityEvent['context']> = {}
  ): string {
    const eventId = this.generateEventId();
    const timestamp = Date.now();

    const event: SecurityEvent = {
      eventId,
      eventType,
      severity: this.determineSeverity(eventType),
      timestamp,
      source: {
        ip: source.ip || 'unknown',
        hashedIP: this.hashIP(source.ip || 'unknown'),
        userAgent: source.userAgent || 'unknown',
        ...source
      },
      user: {
        ...user,
        hashedEmail: user.email ? this.hashEmail(user.email) : undefined
      },
      shop: context.metadata?.shopId ? { id: context.metadata.shopId } : {},
      request: {
        method: 'GET',
        path: '/',
        headers: {},
        ...request
      },
      response: {
        statusCode: 200,
        ...response
      },
      detection: {
        rule: 'manual',
        confidence: 1.0,
        riskScore: this.calculateRiskScore(eventType, source, user),
        indicators: this.extractIndicators(eventType, source, request)
      },
      context: {
        requestId: this.generateRequestId(),
        metadata: {},
        ...context
      }
    };

    // Store event
    this.events.push(event);

    // Update risk scores
    this.updateRiskScores(event);

    // Check against rules
    this.evaluateSecurityRules(event);

    // Send to APM
    this.sendToAPM(event);

    // Log security event
    logger.info('Security event recorded', {
      eventId,
      eventType,
      severity: event.severity,
      sourceIP: event.source.hashedIP,
      userId: event.user.id,
      riskScore: event.detection.riskScore
    });

    return eventId;
  }

  private determineSeverity(eventType: SecurityEventType): SecuritySeverity {
    const severityMap: Partial<Record<SecurityEventType, SecuritySeverity>> = {
      [SecurityEventType.SQL_INJECTION]: SecuritySeverity.CRITICAL,
      [SecurityEventType.BRUTE_FORCE]: SecuritySeverity.HIGH,
      [SecurityEventType.PRIVILEGE_ESCALATION]: SecuritySeverity.CRITICAL,
      [SecurityEventType.MALWARE_DETECTED]: SecuritySeverity.CRITICAL,
      [SecurityEventType.DDoS_ATTEMPT]: SecuritySeverity.HIGH,
      [SecurityEventType.XSS_ATTEMPT]: SecuritySeverity.HIGH,
      [SecurityEventType.CSRF_ATTEMPT]: SecuritySeverity.HIGH,
      [SecurityEventType.DATA_EXPORT]: SecuritySeverity.MEDIUM,
      [SecurityEventType.LOGIN_FAILURE]: SecuritySeverity.LOW,
      [SecurityEventType.LOGIN_SUCCESS]: SecuritySeverity.INFO
    };

    return severityMap[eventType] || SecuritySeverity.MEDIUM;
  }

  private calculateRiskScore(
    eventType: SecurityEventType,
    source: Partial<SecurityEvent['source']>,
    user: Partial<SecurityEvent['user']>
  ): number {
    let riskScore = 0;

    // Base risk by event type
    const baseRiskMap: Partial<Record<SecurityEventType, number>> = {
      [SecurityEventType.SQL_INJECTION]: 90,
      [SecurityEventType.BRUTE_FORCE]: 70,
      [SecurityEventType.XSS_ATTEMPT]: 60,
      [SecurityEventType.UNAUTHORIZED_ACCESS]: 50,
      [SecurityEventType.LOGIN_FAILURE]: 10,
      [SecurityEventType.LOGIN_SUCCESS]: 5
    };

    riskScore = baseRiskMap[eventType] || 30;

    // Adjust based on source
    if (source.ip && this.isKnownThreat(source.ip)) {
      riskScore += 30;
    }

    if (source.country && this.isHighRiskCountry(source.country)) {
      riskScore += 20;
    }

    // Adjust based on user
    if (user.role === 'admin') {
      riskScore += 15;
    }

    // Historical risk adjustment
    const historicalRisk = this.getHistoricalRisk(source.ip || '');
    riskScore += historicalRisk;

    return Math.min(100, Math.max(0, riskScore));
  }

  private extractIndicators(
    eventType: SecurityEventType,
    source: Partial<SecurityEvent['source']>,
    request: Partial<SecurityEvent['request']>
  ): string[] {
    const indicators: string[] = [];

    // IP-based indicators
    if (source.ip) {
      if (this.isKnownThreat(source.ip)) {
        indicators.push('known_threat_ip');
      }
      if (this.isPrivateIP(source.ip)) {
        indicators.push('private_ip');
      }
    }

    // Request-based indicators
    if (request.path) {
      if (this.containsSQLPatterns(request.path)) {
        indicators.push('sql_patterns');
      }
      if (this.containsXSSPatterns(request.path)) {
        indicators.push('xss_patterns');
      }
    }

    // User agent indicators
    if (source.userAgent) {
      if (this.isSuspiciousUserAgent(source.userAgent)) {
        indicators.push('suspicious_user_agent');
      }
    }

    return indicators;
  }

  private updateRiskScores(event: SecurityEvent): void {
    const key = event.source.hashedIP;
    const currentRisk = this.riskScores.get(key) || 0;
    const newRisk = Math.min(100, currentRisk + (event.detection.riskScore * 0.1));
    this.riskScores.set(key, newRisk);

    // Apply decay to other IPs
    for (const [ip, risk] of this.riskScores.entries()) {
      if (ip !== key) {
        this.riskScores.set(ip, Math.max(0, risk * 0.999));
      }
    }
  }

  private evaluateSecurityRules(event: SecurityEvent): void {
    for (const rule of this.config.rules) {
      if (!rule.enabled || !rule.eventTypes.includes(event.eventType)) {
        continue;
      }

      if (this.doesEventMatchRule(event, rule)) {
        this.triggerSecurityRule(event, rule);
      }
    }
  }

  private doesEventMatchRule(event: SecurityEvent, rule: SecurityRule): boolean {
    const timeWindow = rule.conditions.timeWindow * 60 * 1000; // Convert to milliseconds
    const cutoff = Date.now() - timeWindow;

    // Count matching events within time window
    const matchingEvents = this.events.filter(e => 
      e.timestamp > cutoff &&
      rule.eventTypes.includes(e.eventType) &&
      e.source.hashedIP === event.source.hashedIP
    );

    // Check threshold
    if (matchingEvents.length < rule.conditions.threshold) {
      return false;
    }

    // Check pattern if specified
    if (rule.conditions.pattern) {
      const testString = `${event.request.path} ${JSON.stringify(event.request.body)}`;
      return rule.conditions.pattern.test(testString);
    }

    return true;
  }

  private triggerSecurityRule(event: SecurityEvent, rule: SecurityRule): void {
    logger.warn('Security rule triggered', {
      ruleId: rule.id,
      ruleName: rule.name,
      eventId: event.eventId,
      severity: rule.severity,
      sourceIP: event.source.hashedIP
    });

    // Execute actions
    for (const action of rule.actions) {
      this.executeSecurityAction(action, event, rule);
    }

    // Create or update incident
    this.handleSecurityIncident(event, rule);
  }

  private executeSecurityAction(action: SecurityAction, event: SecurityEvent, rule: SecurityRule): void {
    switch (action) {
      case SecurityAction.LOG:
        logger.warn('Security action: log', { eventId: event.eventId, rule: rule.id });
        break;

      case SecurityAction.ALERT:
        this.sendSecurityAlert(event, rule);
        break;

      case SecurityAction.BLOCK_IP:
        this.blockIP(event.source.ip);
        break;

      case SecurityAction.BLOCK_USER:
        if (event.user.id) {
          this.blockUser(event.user.id);
        }
        break;

      case SecurityAction.REQUIRE_MFA:
        this.requireMFA(event.user.id);
        break;

      case SecurityAction.ESCALATE:
        this.escalateIncident(event, rule);
        break;

      case SecurityAction.QUARANTINE:
        this.quarantineResource(event);
        break;
    }
  }

  private handleSecurityIncident(event: SecurityEvent, rule: SecurityRule): void {
    const incidentKey = `${rule.id}_${event.source.hashedIP}`;
    let incident = this.incidents.get(incidentKey);

    if (!incident) {
      incident = this.createSecurityIncident(event, rule);
      this.incidents.set(incidentKey, incident);
    } else {
      incident.events.push(event);
      incident.updated = Date.now();
      incident.timeline.push({
        timestamp: Date.now(),
        action: 'event_added',
        user: 'system',
        notes: `New ${event.eventType} event added`
      });
    }
  }

  private createSecurityIncident(event: SecurityEvent, rule: SecurityRule): SecurityIncident {
    const incidentId = this.generateIncidentId();

    return {
      incidentId,
      title: `${rule.name} - ${event.source.hashedIP}`,
      description: `Security incident detected: ${rule.description}`,
      severity: rule.severity,
      status: 'open',
      events: [event],
      timeline: [{
        timestamp: Date.now(),
        action: 'incident_created',
        user: 'system',
        notes: 'Incident automatically created by security monitoring'
      }],
      created: Date.now(),
      updated: Date.now()
    };
  }

  private sendSecurityAlert(event: SecurityEvent, rule: SecurityRule): void {
    logger.error('Security alert triggered', {
      eventId: event.eventId,
      ruleId: rule.id,
      severity: rule.severity,
      sourceIP: event.source.hashedIP,
      eventType: event.eventType,
      riskScore: event.detection.riskScore
    });

    // Send to external alerting systems
    this.sendExternalAlert(event, rule);
  }

  private async sendExternalAlert(event: SecurityEvent, rule: SecurityRule): Promise<void> {
    // Implementation would integrate with alerting services
    // For now, just log the alert
    logger.info('External security alert sent', {
      eventId: event.eventId,
      rule: rule.id,
      channels: this.config.alerting.channels
    });
  }

  private blockIP(ip: string): void {
    this.blockedIPs.add(ip);
    logger.warn('IP address blocked', { ip: this.hashIP(ip) });
  }

  private blockUser(userId: string): void {
    this.blockedUsers.add(userId);
    logger.warn('User blocked', { userId });
  }

  private requireMFA(userId?: string): void {
    if (userId) {
      logger.info('MFA required for user', { userId });
      // Implementation would trigger MFA requirement
    }
  }

  private escalateIncident(event: SecurityEvent, rule: SecurityRule): void {
    logger.error('Security incident escalated', {
      eventId: event.eventId,
      rule: rule.id,
      severity: rule.severity
    });
    // Implementation would notify security team
  }

  private quarantineResource(event: SecurityEvent): void {
    logger.warn('Resource quarantined', {
      eventId: event.eventId,
      resource: event.request.path
    });
    // Implementation would isolate affected resources
  }

  private processSecurityEvents(): void {
    const recentEvents = this.events.filter(e => Date.now() - e.timestamp < 300000); // Last 5 minutes

    // Update metrics
    const eventsByType = recentEvents.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventsBySeverity = recentEvents.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Send metrics to APM
    for (const [eventType, count] of Object.entries(eventsByType)) {
      apmManager.recordBusinessMetric(`security.events.${eventType}`, count);
    }

    for (const [severity, count] of Object.entries(eventsBySeverity)) {
      apmManager.recordBusinessMetric(`security.events_by_severity.${severity}`, count);
    }

    apmManager.recordBusinessMetric('security.blocked_ips', this.blockedIPs.size);
    apmManager.recordBusinessMetric('security.blocked_users', this.blockedUsers.size);
    apmManager.recordBusinessMetric('security.active_incidents', this.incidents.size);
  }

  private sendToAPM(event: SecurityEvent): void {
    apmManager.recordBusinessMetric(
      `security.event.${event.eventType}`,
      1,
      [`severity:${event.severity}`, `risk_score:${Math.floor(event.detection.riskScore / 10) * 10}`]
    );

    if (event.detection.riskScore > 70) {
      apmManager.recordBusinessMetric('security.high_risk_events', 1);
    }
  }

  private updateThreatIntelligence(): void {
    // Implementation would fetch threat intelligence from external sources
    logger.info('Threat intelligence updated');
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - (this.config.retention.eventRetentionDays * 24 * 60 * 60 * 1000);

    // Clean up old events
    this.events = this.events.filter(event => event.timestamp > cutoff);

    // Clean up old incidents
    for (const [key, incident] of this.incidents.entries()) {
      if (incident.status === 'resolved' && incident.updated < cutoff) {
        this.incidents.delete(key);
      }
    }

    logger.info('Security data cleanup completed');
  }

  private generateSecurityReport(): void {
    const last24h = Date.now() - 86400000;
    const recentEvents = this.events.filter(e => e.timestamp > last24h);

    const report = {
      timestamp: Date.now(),
      period: '24h',
      summary: {
        totalEvents: recentEvents.length,
        criticalEvents: recentEvents.filter(e => e.severity === SecuritySeverity.CRITICAL).length,
        highRiskEvents: recentEvents.filter(e => e.detection.riskScore > 70).length,
        activeIncidents: Array.from(this.incidents.values()).filter(i => i.status !== 'resolved').length,
        blockedIPs: this.blockedIPs.size,
        topEventTypes: this.getTopEventTypes(recentEvents),
        topRiskIPs: this.getTopRiskIPs(recentEvents)
      }
    };

    logger.info('Daily security report generated', report);
  }

  private getTopEventTypes(events: SecurityEvent[]): Array<{type: string; count: number}> {
    const counts = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getTopRiskIPs(events: SecurityEvent[]): Array<{ip: string; riskScore: number; eventCount: number}> {
    const ipData = events.reduce((acc, event) => {
      const ip = event.source.hashedIP;
      if (!acc[ip]) {
        acc[ip] = { riskScore: 0, eventCount: 0 };
      }
      acc[ip].riskScore = Math.max(acc[ip].riskScore, event.detection.riskScore);
      acc[ip].eventCount++;
      return acc;
    }, {} as Record<string, {riskScore: number; eventCount: number}>);

    return Object.entries(ipData)
      .map(([ip, data]) => ({ ip, ...data }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);
  }

  // Utility Methods
  private isKnownThreat(ip: string): boolean {
    return this.threatIndicators.has(ip);
  }

  private isHighRiskCountry(country: string): boolean {
    const highRiskCountries = ['CN', 'RU', 'KP', 'IR']; // Example list
    return highRiskCountries.includes(country);
  }

  private isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./
    ];
    return privateRanges.some(range => range.test(ip));
  }

  private containsSQLPatterns(input: string): boolean {
    const sqlPatterns = [
      /(\bunion\b.*\bselect\b)|(\bselect\b.*\bunion\b)/i,
      /(\bdrop\b.*\btable\b)|(\btable\b.*\bdrop\b)/i,
      /(\binsert\b.*\binto\b)|(\binto\b.*\binsert\b)/i,
      /(\bupdate\b.*\bset\b)|(\bset\b.*\bupdate\b)/i,
      /(\bdelete\b.*\bfrom\b)|(\bfrom\b.*\bdelete\b)/i
    ];
    return sqlPatterns.some(pattern => pattern.test(input));
  }

  private containsXSSPatterns(input: string): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe[^>]*>/i,
      /<object[^>]*>/i
    ];
    return xssPatterns.some(pattern => pattern.test(input));
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /scanner/i,
      /curl/i,
      /wget/i
    ];
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  private getHistoricalRisk(ip: string): number {
    const hashedIP = this.hashIP(ip);
    return this.riskScores.get(hashedIP) || 0;
  }

  private hashIP(ip: string): string {
    return crypto.createHash('sha256').update(ip + process.env.HASH_SALT).digest('hex').substring(0, 12);
  }

  private hashEmail(email: string): string {
    return crypto.createHash('sha256').update(email.toLowerCase() + process.env.HASH_SALT).digest('hex').substring(0, 16);
  }

  private generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateIncidentId(): string {
    return `inc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API
  public isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  public isUserBlocked(userId: string): boolean {
    return this.blockedUsers.has(userId);
  }

  public getSecurityMetrics(): any {
    const last24h = Date.now() - 86400000;
    const recentEvents = this.events.filter(e => e.timestamp > last24h);

    return {
      totalEvents: recentEvents.length,
      eventsBySeverity: recentEvents.reduce((acc, e) => {
        acc[e.severity] = (acc[e.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      activeIncidents: Array.from(this.incidents.values()).filter(i => i.status !== 'resolved').length,
      blockedIPs: this.blockedIPs.size,
      blockedUsers: this.blockedUsers.size,
      averageRiskScore: recentEvents.length > 0 
        ? recentEvents.reduce((sum, e) => sum + e.detection.riskScore, 0) / recentEvents.length 
        : 0
    };
  }

  public getIncident(incidentId: string): SecurityIncident | null {
    return Array.from(this.incidents.values()).find(i => i.incidentId === incidentId) || null;
  }

  public getRecentEvents(limit: number = 100): SecurityEvent[] {
    return this.events.slice(-limit);
  }
}

// Express Middleware for Security Monitoring
export function createSecurityMiddleware(monitor: SecurityIncidentMonitor) {
  return (req: any, res: any, next: any) => {
    // Check if IP is blocked
    if (monitor.isIPBlocked(req.ip)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if user is blocked
    if (req.user?.id && monitor.isUserBlocked(req.user.id)) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    // Record security event based on request
    const eventType = req.url.includes('/admin') 
      ? SecurityEventType.ADMIN_ACCESS 
      : SecurityEventType.LOGIN_SUCCESS;

    monitor.recordSecurityEvent(
      eventType,
      {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        country: req.get('CF-IPCountry') // If using Cloudflare
      },
      {
        id: req.user?.id,
        email: req.user?.email,
        role: req.user?.role
      },
      {
        method: req.method,
        path: req.path,
        headers: req.headers,
        queryParams: req.query
      },
      {},
      {
        sessionId: req.sessionID,
        requestId: req.id,
        metadata: {
          shopId: req.shop?.id
        }
      }
    );

    next();
  };
}

// Configuration Factory
export function createSecurityConfig(): SecurityConfig {
  return {
    monitoring: {
      enabled: true,
      realTimeAnalysis: true,
      threatIntelligence: true,
      geoLocationTracking: true
    },
    alerting: {
      channels: ['slack', 'email'],
      severityThresholds: {
        [SecuritySeverity.INFO]: false,
        [SecuritySeverity.LOW]: false,
        [SecuritySeverity.MEDIUM]: true,
        [SecuritySeverity.HIGH]: true,
        [SecuritySeverity.CRITICAL]: true
      },
      escalationEnabled: true,
      escalationTimeMinutes: 30
    },
    retention: {
      eventRetentionDays: 90,
      incidentRetentionDays: 365,
      logRetentionDays: 30
    },
    rules: []
  };
}

// Export singleton instance
export const securityConfig = createSecurityConfig();
export const securityMonitor = new SecurityIncidentMonitor(securityConfig);