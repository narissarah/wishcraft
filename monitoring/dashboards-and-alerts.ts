// Monitoring Dashboards and Alerts System for WishCraft
// Centralized dashboard creation and alert management for all monitoring systems

import { logger } from './logger';
import { apmManager } from './apm-setup';
import { errorTracker } from './error-tracking';
import { userAnalytics } from './user-analytics';
import { shopifyAPIMonitor } from './shopify-api-monitoring';
import { databaseMonitor } from './database-performance';
import { securityMonitor } from './security-incident-monitoring';

// Dashboard Configuration Types
export interface DashboardWidget {
  id: string;
  title: string;
  type: 'metric' | 'chart' | 'table' | 'gauge' | 'heatmap' | 'alert_status';
  dataSource: string;
  query: string;
  refreshInterval: number; // seconds
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visualization: {
    chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
    thresholds?: Array<{
      value: number;
      color: string;
      label: string;
    }>;
    units?: string;
    decimals?: number;
  };
}

export interface Dashboard {
  id: string;
  title: string;
  description: string;
  category: 'system' | 'business' | 'security' | 'user';
  widgets: DashboardWidget[];
  tags: string[];
  shared: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

// Alert Configuration Types
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'performance' | 'error' | 'security' | 'business';
  dataSource: string;
  query: string;
  conditions: AlertCondition[];
  notifications: AlertNotification[];
  frequency: number; // minutes
  silenceAfter: number; // minutes
  tags: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface AlertCondition {
  type: 'threshold' | 'anomaly' | 'no_data' | 'rate_of_change';
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  value: number;
  timeWindow: number; // minutes
  aggregation: 'avg' | 'sum' | 'count' | 'min' | 'max' | 'p95' | 'p99';
}

export interface AlertNotification {
  channel: 'slack' | 'email' | 'webhook' | 'pagerduty' | 'sms';
  recipients: string[];
  template: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AlertInstance {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'firing' | 'resolved' | 'silenced';
  message: string;
  value: number;
  threshold: number;
  startTime: number;
  endTime?: number;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  notes?: string;
  tags: string[];
}

// Dashboard and Alert Manager
export class DashboardAndAlertManager {
  private dashboards: Map<string, Dashboard> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, AlertInstance> = new Map();
  private alertHistory: AlertInstance[] = [];
  private dataSources: Map<string, any> = new Map();

  constructor() {
    this.initializeDataSources();
    this.createDefaultDashboards();
    this.createDefaultAlerts();
    this.startAlertEvaluator();
  }

  private initializeDataSources(): void {
    this.dataSources.set('apm', apmManager);
    this.dataSources.set('errors', errorTracker);
    this.dataSources.set('analytics', userAnalytics);
    this.dataSources.set('shopify_api', shopifyAPIMonitor);
    this.dataSources.set('database', databaseMonitor);
    this.dataSources.set('security', securityMonitor);

    logger.info('Data sources initialized for dashboards and alerts');
  }

  private createDefaultDashboards(): void {
    // System Performance Dashboard
    const systemDashboard: Dashboard = {
      id: 'system_performance',
      title: 'System Performance Overview',
      description: 'Key system performance metrics and health indicators',
      category: 'system',
      widgets: [
        {
          id: 'response_time',
          title: 'Average Response Time',
          type: 'gauge',
          dataSource: 'apm',
          query: 'avg_response_time',
          refreshInterval: 30,
          position: { x: 0, y: 0, width: 4, height: 3 },
          visualization: {
            thresholds: [
              { value: 1000, color: 'green', label: 'Good' },
              { value: 3000, color: 'yellow', label: 'Warning' },
              { value: 5000, color: 'red', label: 'Critical' }
            ],
            units: 'ms'
          }
        },
        {
          id: 'error_rate',
          title: 'Error Rate',
          type: 'gauge',
          dataSource: 'errors',
          query: 'error_rate_percentage',
          refreshInterval: 30,
          position: { x: 4, y: 0, width: 4, height: 3 },
          visualization: {
            thresholds: [
              { value: 1, color: 'green', label: 'Good' },
              { value: 5, color: 'yellow', label: 'Warning' },
              { value: 10, color: 'red', label: 'Critical' }
            ],
            units: '%'
          }
        },
        {
          id: 'throughput',
          title: 'Requests per Minute',
          type: 'chart',
          dataSource: 'apm',
          query: 'requests_per_minute',
          refreshInterval: 60,
          position: { x: 8, y: 0, width: 4, height: 3 },
          visualization: {
            chartType: 'line',
            units: 'req/min'
          }
        },
        {
          id: 'database_performance',
          title: 'Database Query Time',
          type: 'chart',
          dataSource: 'database',
          query: 'avg_query_time',
          refreshInterval: 60,
          position: { x: 0, y: 3, width: 6, height: 4 },
          visualization: {
            chartType: 'area',
            units: 'ms'
          }
        },
        {
          id: 'api_health',
          title: 'Shopify API Health',
          type: 'gauge',
          dataSource: 'shopify_api',
          query: 'api_health_score',
          refreshInterval: 60,
          position: { x: 6, y: 3, width: 6, height: 4 },
          visualization: {
            thresholds: [
              { value: 80, color: 'red', label: 'Critical' },
              { value: 90, color: 'yellow', label: 'Warning' },
              { value: 100, color: 'green', label: 'Healthy' }
            ]
          }
        }
      ],
      tags: ['system', 'performance', 'health'],
      shared: true,
      createdBy: 'system',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Business Metrics Dashboard
    const businessDashboard: Dashboard = {
      id: 'business_metrics',
      title: 'Business Analytics',
      description: 'Key business metrics and user engagement data',
      category: 'business',
      widgets: [
        {
          id: 'active_users',
          title: 'Active Users (24h)',
          type: 'metric',
          dataSource: 'analytics',
          query: 'daily_active_users',
          refreshInterval: 300,
          position: { x: 0, y: 0, width: 3, height: 2 },
          visualization: { units: 'users' }
        },
        {
          id: 'registries_created',
          title: 'Registries Created Today',
          type: 'metric',
          dataSource: 'analytics',
          query: 'registries_created_today',
          refreshInterval: 300,
          position: { x: 3, y: 0, width: 3, height: 2 },
          visualization: { units: 'registries' }
        },
        {
          id: 'conversion_rate',
          title: 'Registry Conversion Rate',
          type: 'gauge',
          dataSource: 'analytics',
          query: 'registry_conversion_rate',
          refreshInterval: 600,
          position: { x: 6, y: 0, width: 3, height: 2 },
          visualization: {
            units: '%',
            thresholds: [
              { value: 10, color: 'red', label: 'Low' },
              { value: 20, color: 'yellow', label: 'Good' },
              { value: 30, color: 'green', label: 'Excellent' }
            ]
          }
        },
        {
          id: 'revenue_trend',
          title: 'Revenue Trend (7 days)',
          type: 'chart',
          dataSource: 'analytics',
          query: 'revenue_trend_7d',
          refreshInterval: 3600,
          position: { x: 0, y: 2, width: 9, height: 4 },
          visualization: {
            chartType: 'line',
            units: '$'
          }
        },
        {
          id: 'user_funnel',
          title: 'User Acquisition Funnel',
          type: 'chart',
          dataSource: 'analytics',
          query: 'user_funnel_data',
          refreshInterval: 1800,
          position: { x: 0, y: 6, width: 9, height: 3 },
          visualization: {
            chartType: 'bar'
          }
        }
      ],
      tags: ['business', 'analytics', 'revenue'],
      shared: true,
      createdBy: 'system',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Security Dashboard
    const securityDashboard: Dashboard = {
      id: 'security_overview',
      title: 'Security Overview',
      description: 'Security events, threats, and incident monitoring',
      category: 'security',
      widgets: [
        {
          id: 'security_events',
          title: 'Security Events (24h)',
          type: 'metric',
          dataSource: 'security',
          query: 'security_events_24h',
          refreshInterval: 300,
          position: { x: 0, y: 0, width: 3, height: 2 },
          visualization: { units: 'events' }
        },
        {
          id: 'blocked_ips',
          title: 'Blocked IPs',
          type: 'metric',
          dataSource: 'security',
          query: 'blocked_ips_count',
          refreshInterval: 300,
          position: { x: 3, y: 0, width: 3, height: 2 },
          visualization: { units: 'IPs' }
        },
        {
          id: 'threat_level',
          title: 'Current Threat Level',
          type: 'gauge',
          dataSource: 'security',
          query: 'current_threat_level',
          refreshInterval: 60,
          position: { x: 6, y: 0, width: 3, height: 2 },
          visualization: {
            thresholds: [
              { value: 30, color: 'green', label: 'Low' },
              { value: 60, color: 'yellow', label: 'Medium' },
              { value: 80, color: 'orange', label: 'High' },
              { value: 100, color: 'red', label: 'Critical' }
            ]
          }
        },
        {
          id: 'security_events_timeline',
          title: 'Security Events Timeline',
          type: 'chart',
          dataSource: 'security',
          query: 'security_events_timeline',
          refreshInterval: 300,
          position: { x: 0, y: 2, width: 9, height: 4 },
          visualization: {
            chartType: 'line'
          }
        },
        {
          id: 'top_threats',
          title: 'Top Threat Sources',
          type: 'table',
          dataSource: 'security',
          query: 'top_threat_sources',
          refreshInterval: 600,
          position: { x: 0, y: 6, width: 9, height: 3 },
          visualization: {}
        }
      ],
      tags: ['security', 'threats', 'incidents'],
      shared: true,
      createdBy: 'system',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.dashboards.set(systemDashboard.id, systemDashboard);
    this.dashboards.set(businessDashboard.id, businessDashboard);
    this.dashboards.set(securityDashboard.id, securityDashboard);

    logger.info('Default dashboards created', {
      count: this.dashboards.size,
      dashboards: Array.from(this.dashboards.keys())
    });
  }

  private createDefaultAlerts(): void {
    const defaultAlerts: AlertRule[] = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Alert when error rate exceeds 5% for 5 minutes',
        enabled: true,
        category: 'error',
        dataSource: 'errors',
        query: 'error_rate_percentage',
        conditions: [{
          type: 'threshold',
          operator: 'gt',
          value: 5,
          timeWindow: 5,
          aggregation: 'avg'
        }],
        notifications: [{
          channel: 'slack',
          recipients: ['#alerts'],
          template: 'error_rate_high',
          severity: 'high'
        }],
        frequency: 1,
        silenceAfter: 60,
        tags: ['errors', 'performance'],
        createdBy: 'system',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'slow_response_time',
        name: 'Slow Response Time',
        description: 'Alert when average response time exceeds 3 seconds',
        enabled: true,
        category: 'performance',
        dataSource: 'apm',
        query: 'avg_response_time',
        conditions: [{
          type: 'threshold',
          operator: 'gt',
          value: 3000,
          timeWindow: 5,
          aggregation: 'avg'
        }],
        notifications: [{
          channel: 'slack',
          recipients: ['#alerts'],
          template: 'response_time_slow',
          severity: 'medium'
        }],
        frequency: 2,
        silenceAfter: 30,
        tags: ['performance', 'response_time'],
        createdBy: 'system',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'database_slow_queries',
        name: 'Database Slow Queries',
        description: 'Alert when database queries are consistently slow',
        enabled: true,
        category: 'performance',
        dataSource: 'database',
        query: 'slow_query_count',
        conditions: [{
          type: 'threshold',
          operator: 'gt',
          value: 10,
          timeWindow: 10,
          aggregation: 'sum'
        }],
        notifications: [{
          channel: 'slack',
          recipients: ['#alerts'],
          template: 'database_slow_queries',
          severity: 'medium'
        }],
        frequency: 5,
        silenceAfter: 60,
        tags: ['database', 'performance'],
        createdBy: 'system',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'shopify_api_rate_limit',
        name: 'Shopify API Rate Limit Warning',
        description: 'Alert when approaching Shopify API rate limits',
        enabled: true,
        category: 'performance',
        dataSource: 'shopify_api',
        query: 'rate_limit_utilization',
        conditions: [{
          type: 'threshold',
          operator: 'gt',
          value: 80,
          timeWindow: 5,
          aggregation: 'avg'
        }],
        notifications: [{
          channel: 'slack',
          recipients: ['#alerts'],
          template: 'shopify_rate_limit',
          severity: 'medium'
        }],
        frequency: 1,
        silenceAfter: 30,
        tags: ['shopify', 'api', 'rate_limit'],
        createdBy: 'system',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'security_incident',
        name: 'Security Incident Detected',
        description: 'Alert on high-severity security events',
        enabled: true,
        category: 'security',
        dataSource: 'security',
        query: 'high_severity_events',
        conditions: [{
          type: 'threshold',
          operator: 'gt',
          value: 0,
          timeWindow: 1,
          aggregation: 'count'
        }],
        notifications: [
          {
            channel: 'slack',
            recipients: ['#security-alerts'],
            template: 'security_incident',
            severity: 'critical'
          },
          {
            channel: 'email',
            recipients: ['security@wishcraft.com'],
            template: 'security_incident_email',
            severity: 'critical'
          }
        ],
        frequency: 1,
        silenceAfter: 10,
        tags: ['security', 'incident'],
        createdBy: 'system',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'user_engagement_drop',
        name: 'User Engagement Drop',
        description: 'Alert when daily active users drop significantly',
        enabled: true,
        category: 'business',
        dataSource: 'analytics',
        query: 'daily_active_users',
        conditions: [{
          type: 'rate_of_change',
          operator: 'lt',
          value: -20,
          timeWindow: 60,
          aggregation: 'avg'
        }],
        notifications: [{
          channel: 'slack',
          recipients: ['#business-alerts'],
          template: 'user_engagement_drop',
          severity: 'medium'
        }],
        frequency: 60,
        silenceAfter: 240,
        tags: ['business', 'engagement'],
        createdBy: 'system',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'revenue_anomaly',
        name: 'Revenue Anomaly',
        description: 'Alert on unusual revenue patterns',
        enabled: true,
        category: 'business',
        dataSource: 'analytics',
        query: 'revenue_anomaly_score',
        conditions: [{
          type: 'anomaly',
          operator: 'gt',
          value: 2,
          timeWindow: 30,
          aggregation: 'avg'
        }],
        notifications: [{
          channel: 'email',
          recipients: ['finance@wishcraft.com'],
          template: 'revenue_anomaly',
          severity: 'high'
        }],
        frequency: 30,
        silenceAfter: 120,
        tags: ['business', 'revenue', 'anomaly'],
        createdBy: 'system',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    defaultAlerts.forEach(alert => {
      this.alertRules.set(alert.id, alert);
    });

    logger.info('Default alert rules created', {
      count: this.alertRules.size,
      rules: Array.from(this.alertRules.keys())
    });
  }

  private startAlertEvaluator(): void {
    // Evaluate alerts every minute
    setInterval(() => {
      this.evaluateAlerts();
    }, 60000);

    // Cleanup resolved alerts every hour
    setInterval(() => {
      this.cleanupResolvedAlerts();
    }, 3600000);

    logger.info('Alert evaluator started');
  }

  private async evaluateAlerts(): Promise<void> {
    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (!rule.enabled) continue;

      try {
        await this.evaluateAlertRule(rule);
      } catch (error) {
        logger.error('Failed to evaluate alert rule', {
          ruleId,
          error: (error as Error).message
        });
      }
    }
  }

  private async evaluateAlertRule(rule: AlertRule): Promise<void> {
    const dataSource = this.dataSources.get(rule.dataSource);
    if (!dataSource) {
      logger.warn('Data source not found for alert rule', {
        ruleId: rule.id,
        dataSource: rule.dataSource
      });
      return;
    }

    // Get current value from data source
    const currentValue = await this.queryDataSource(dataSource, rule.query);
    if (currentValue === null) return;

    // Check each condition
    for (const condition of rule.conditions) {
      const isTriggered = this.evaluateCondition(condition, currentValue);
      const existingAlert = this.getActiveAlert(rule.id);

      if (isTriggered && !existingAlert) {
        // Create new alert
        const alert: AlertInstance = {
          id: this.generateAlertId(),
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.notifications[0]?.severity || 'medium',
          status: 'firing',
          message: this.generateAlertMessage(rule, condition, currentValue),
          value: currentValue,
          threshold: condition.value,
          startTime: Date.now(),
          tags: rule.tags
        };

        this.activeAlerts.set(alert.id, alert);
        this.sendAlertNotifications(alert, rule);
        
        logger.warn('Alert triggered', {
          alertId: alert.id,
          ruleId: rule.id,
          ruleName: rule.name,
          value: currentValue,
          threshold: condition.value
        });

      } else if (!isTriggered && existingAlert) {
        // Resolve existing alert
        existingAlert.status = 'resolved';
        existingAlert.endTime = Date.now();
        
        this.alertHistory.push(existingAlert);
        this.activeAlerts.delete(existingAlert.id);
        
        this.sendAlertResolution(existingAlert, rule);

        logger.info('Alert resolved', {
          alertId: existingAlert.id,
          ruleId: rule.id,
          duration: existingAlert.endTime - existingAlert.startTime
        });
      }
    }
  }

  private evaluateCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case 'gt': return value > condition.value;
      case 'gte': return value >= condition.value;
      case 'lt': return value < condition.value;
      case 'lte': return value <= condition.value;
      case 'eq': return value === condition.value;
      case 'ne': return value !== condition.value;
      default: return false;
    }
  }

  private async queryDataSource(dataSource: any, query: string): Promise<number | null> {
    try {
      // This would implement the actual data source querying logic
      // For now, return mock data based on query type
      switch (query) {
        case 'error_rate_percentage':
          return Math.random() * 10; // 0-10%
        case 'avg_response_time':
          return Math.random() * 5000; // 0-5000ms
        case 'slow_query_count':
          return Math.floor(Math.random() * 20); // 0-20 queries
        case 'rate_limit_utilization':
          return Math.random() * 100; // 0-100%
        case 'high_severity_events':
          return Math.floor(Math.random() * 3); // 0-3 events
        case 'daily_active_users':
          return Math.floor(Math.random() * 1000) + 500; // 500-1500 users
        case 'revenue_anomaly_score':
          return Math.random() * 3; // 0-3 anomaly score
        default:
          return null;
      }
    } catch (error) {
      logger.error('Failed to query data source', { query, error });
      return null;
    }
  }

  private getActiveAlert(ruleId: string): AlertInstance | undefined {
    return Array.from(this.activeAlerts.values()).find(alert => alert.ruleId === ruleId);
  }

  private generateAlertMessage(rule: AlertRule, condition: AlertCondition, value: number): string {
    return `${rule.name}: ${rule.query} is ${value} (threshold: ${condition.operator} ${condition.value})`;
  }

  private async sendAlertNotifications(alert: AlertInstance, rule: AlertRule): Promise<void> {
    for (const notification of rule.notifications) {
      try {
        await this.sendNotification(notification, alert, rule);
      } catch (error) {
        logger.error('Failed to send alert notification', {
          alertId: alert.id,
          channel: notification.channel,
          error: (error as Error).message
        });
      }
    }
  }

  private async sendNotification(
    notification: AlertNotification, 
    alert: AlertInstance, 
    rule: AlertRule
  ): Promise<void> {
    const message = this.formatNotificationMessage(notification.template, alert, rule);

    switch (notification.channel) {
      case 'slack':
        await this.sendSlackNotification(notification.recipients, message, alert.severity);
        break;
      case 'email':
        await this.sendEmailNotification(notification.recipients, message, alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(notification.recipients[0], alert, rule);
        break;
      case 'pagerduty':
        await this.sendPagerDutyNotification(notification, alert);
        break;
      case 'sms':
        await this.sendSMSNotification(notification.recipients, message);
        break;
    }
  }

  private formatNotificationMessage(template: string, alert: AlertInstance, rule: AlertRule): string {
    // Simple template substitution - in production, use a proper template engine
    return `🚨 ALERT: ${alert.ruleName}
    
Value: ${alert.value}
Threshold: ${alert.threshold}
Severity: ${alert.severity}
Time: ${new Date(alert.startTime).toISOString()}

Description: ${rule.description}

Alert ID: ${alert.id}`;
  }

  private async sendSlackNotification(recipients: string[], message: string, severity: string): Promise<void> {
    // Implementation would integrate with Slack API
    logger.info('Slack notification sent', { recipients, severity });
  }

  private async sendEmailNotification(recipients: string[], message: string, alert: AlertInstance): Promise<void> {
    // Implementation would integrate with email service
    logger.info('Email notification sent', { recipients, alertId: alert.id });
  }

  private async sendWebhookNotification(url: string, alert: AlertInstance, rule: AlertRule): Promise<void> {
    // Implementation would send HTTP POST to webhook URL
    logger.info('Webhook notification sent', { url, alertId: alert.id });
  }

  private async sendPagerDutyNotification(notification: AlertNotification, alert: AlertInstance): Promise<void> {
    // Implementation would integrate with PagerDuty API
    logger.info('PagerDuty notification sent', { alertId: alert.id });
  }

  private async sendSMSNotification(recipients: string[], message: string): Promise<void> {
    // Implementation would integrate with SMS service
    logger.info('SMS notification sent', { recipients });
  }

  private async sendAlertResolution(alert: AlertInstance, rule: AlertRule): Promise<void> {
    const message = `✅ RESOLVED: ${alert.ruleName}

Alert resolved after ${this.formatDuration(alert.endTime! - alert.startTime)}

Alert ID: ${alert.id}`;

    // Send resolution notifications to the same channels as the original alert
    for (const notification of rule.notifications) {
      if (notification.channel === 'slack') {
        await this.sendSlackNotification(notification.recipients, message, 'resolved');
      }
    }
  }

  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }

  private cleanupResolvedAlerts(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    this.alertHistory = this.alertHistory.filter(alert => 
      alert.endTime! > cutoff
    );

    logger.info('Alert history cleaned up');
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API Methods

  // Dashboard Management
  public createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = `dash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullDashboard: Dashboard = {
      ...dashboard,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.dashboards.set(id, fullDashboard);
    
    logger.info('Dashboard created', { dashboardId: id, title: dashboard.title });
    return id;
  }

  public getDashboard(id: string): Dashboard | null {
    return this.dashboards.get(id) || null;
  }

  public listDashboards(category?: string): Dashboard[] {
    const dashboards = Array.from(this.dashboards.values());
    return category 
      ? dashboards.filter(d => d.category === category)
      : dashboards;
  }

  public updateDashboard(id: string, updates: Partial<Dashboard>): boolean {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) return false;

    const updatedDashboard = {
      ...dashboard,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: Date.now()
    };

    this.dashboards.set(id, updatedDashboard);
    
    logger.info('Dashboard updated', { dashboardId: id });
    return true;
  }

  public deleteDashboard(id: string): boolean {
    const deleted = this.dashboards.delete(id);
    if (deleted) {
      logger.info('Dashboard deleted', { dashboardId: id });
    }
    return deleted;
  }

  // Alert Management
  public createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullRule: AlertRule = {
      ...rule,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.alertRules.set(id, fullRule);
    
    logger.info('Alert rule created', { ruleId: id, name: rule.name });
    return id;
  }

  public getAlertRule(id: string): AlertRule | null {
    return this.alertRules.get(id) || null;
  }

  public listAlertRules(category?: string): AlertRule[] {
    const rules = Array.from(this.alertRules.values());
    return category 
      ? rules.filter(r => r.category === category)
      : rules;
  }

  public updateAlertRule(id: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.get(id);
    if (!rule) return false;

    const updatedRule = {
      ...rule,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: Date.now()
    };

    this.alertRules.set(id, updatedRule);
    
    logger.info('Alert rule updated', { ruleId: id });
    return true;
  }

  public deleteAlertRule(id: string): boolean {
    const deleted = this.alertRules.delete(id);
    if (deleted) {
      logger.info('Alert rule deleted', { ruleId: id });
    }
    return deleted;
  }

  // Alert Instance Management
  public getActiveAlerts(): AlertInstance[] {
    return Array.from(this.activeAlerts.values());
  }

  public getAlertHistory(limit: number = 100): AlertInstance[] {
    return this.alertHistory.slice(-limit);
  }

  public acknowledgeAlert(alertId: string, userId: string, notes?: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = Date.now();
    alert.notes = notes;

    logger.info('Alert acknowledged', { alertId, userId });
    return true;
  }

  public silenceAlert(alertId: string, duration: number): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.status = 'silenced';
    
    // Auto-unsilence after duration
    setTimeout(() => {
      if (alert.status === 'silenced') {
        alert.status = 'firing';
      }
    }, duration);

    logger.info('Alert silenced', { alertId, duration });
    return true;
  }

  // Widget Data
  public async getWidgetData(widget: DashboardWidget): Promise<any> {
    const dataSource = this.dataSources.get(widget.dataSource);
    if (!dataSource) return null;

    try {
      const value = await this.queryDataSource(dataSource, widget.query);
      return {
        value,
        timestamp: Date.now(),
        unit: widget.visualization.units || ''
      };
    } catch (error) {
      logger.error('Failed to get widget data', {
        widgetId: widget.id,
        error: (error as Error).message
      });
      return null;
    }
  }

  // System Status
  public getSystemStatus(): any {
    const activeAlertsCount = this.activeAlerts.size;
    const criticalAlerts = Array.from(this.activeAlerts.values())
      .filter(alert => alert.severity === 'critical').length;

    return {
      dashboards: {
        total: this.dashboards.size,
        categories: {
          system: this.listDashboards('system').length,
          business: this.listDashboards('business').length,
          security: this.listDashboards('security').length,
          user: this.listDashboards('user').length
        }
      },
      alerts: {
        rules: this.alertRules.size,
        active: activeAlertsCount,
        critical: criticalAlerts,
        resolved_24h: this.alertHistory.filter(alert => 
          alert.endTime && alert.endTime > Date.now() - 86400000
        ).length
      },
      dataSources: Array.from(this.dataSources.keys()),
      status: criticalAlerts > 0 ? 'critical' : activeAlertsCount > 0 ? 'warning' : 'healthy'
    };
  }
}

// Export singleton instance
export const dashboardManager = new DashboardAndAlertManager();