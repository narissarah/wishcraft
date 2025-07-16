import { log } from "~/lib/logger.server";

/**
 * Unified Monitoring System for WishCraft
 * Consolidates performance monitoring, budget tracking, and alerting
 * 
 * This replaces the previous separate files:
 * - performance.server.ts
 * - performance-budget.server.ts  
 * - monitoring.server.ts
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertChannel = 'email' | 'slack' | 'webhook' | 'sms';
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer';

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
  type: MetricType;
  unit?: string;
}

export interface WebVitals {
  lcp?: number; // Largest Contentful Paint
  inp?: number; // Interaction to Next Paint
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
  fid?: number; // First Input Delay (legacy)
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  source: string;
  timestamp: number;
  metadata: Record<string, any>;
  channels: AlertChannel[];
  resolved?: boolean;
  resolvedAt?: number;
}

export interface BudgetViolation {
  metric: string;
  actual: number;
  budget: number;
  severity: 'warning' | 'error';
  impact: string;
  recommendations: string[];
}

// ============================================================================
// CONFIGURATION AND BUDGETS
// ============================================================================

export const PERFORMANCE_BUDGETS = {
  // Core Web Vitals (Shopify 2025 requirements)
  CORE_WEB_VITALS: {
    LCP: {
      good: 2500,    // Less than 2.5s
      needs_improvement: 4000,  // 2.5s to 4s
      poor: Infinity  // Greater than 4s
    },
    INP: {
      good: 200,     // Less than 200ms
      needs_improvement: 500,   // 200ms to 500ms
      poor: Infinity  // Greater than 500ms
    },
    CLS: {
      good: 0.1,     // Less than 0.1
      needs_improvement: 0.25,  // 0.1 to 0.25
      poor: Infinity  // Greater than 0.25
    },
    FCP: {
      good: 1800,    // 1.8 seconds
      needs_improvement: 3000,  // 3 seconds
      poor: Infinity
    },
    TTFB: {
      good: 800,     // 800ms
      needs_improvement: 1800,  // 1.8s
      poor: Infinity
    }
  },
  
  // Bundle size budgets (Shopify limits)
  BUNDLE_SIZE: {
    javascript: 16 * 1024,    // 16KB (Shopify limit)
    css: 50 * 1024,          // 50KB (Shopify limit)
    images: 100 * 1024,      // 100KB per image
    fonts: 100 * 1024        // 100KB total fonts
  },
  
  // API performance budgets
  API_RESPONSE_TIME: {
    graphql: 500,             // 500ms (p95)
    webhook: 1000,            // 1s
    database: 100             // 100ms
  },
  
  // Resource budgets
  MEMORY_USAGE: {
    heap_used: 200 * 1024 * 1024,  // 200MB
    external: 50 * 1024 * 1024     // 50MB
  }
};

export const MONITORING_CONFIG = {
  // Performance thresholds
  PERFORMANCE: {
    RESPONSE_TIME_WARNING: 1000,    // 1s
    RESPONSE_TIME_ERROR: 2000,      // 2s
    ERROR_RATE_WARNING: 0.01,       // 1%
    ERROR_RATE_CRITICAL: 0.05,      // 5%
    MEMORY_WARNING: 200 * 1024 * 1024,  // 200MB
    MEMORY_CRITICAL: 400 * 1024 * 1024, // 400MB
  },
  
  // Business metrics thresholds
  BUSINESS: {
    REGISTRY_CREATION_RATE_DROP: 0.2,    // 20% drop
    ORDER_FAILURE_RATE: 0.02,            // 2%
    USER_SESSION_TIMEOUT_RATE: 0.1,      // 10%
  },
  
  // Security thresholds
  SECURITY: {
    FAILED_AUTH_RATE: 0.05,              // 5%
    SUSPICIOUS_REQUEST_RATE: 0.1,        // 10%
    WEBHOOK_VERIFICATION_FAILURES: 5,    // per minute
  },
  
  // Alert frequency limits
  ALERT_COOLDOWN: {
    WARNING: 5 * 60 * 1000,              // 5 minutes
    ERROR: 2 * 60 * 1000,                // 2 minutes
    CRITICAL: 30 * 1000,                 // 30 seconds
  }
};

// ============================================================================
// UNIFIED MONITORING CLASS
// ============================================================================

export class UnifiedMonitoringSystem {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private alertCooldowns: Map<string, number> = new Map();
  private violations: BudgetViolation[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  // ========================================================================
  // PERFORMANCE TRACKING
  // ========================================================================

  /**
   * Track a performance metric
   */
  async track(
    name: string, 
    value: number, 
    unit = 'ms', 
    tags: Record<string, string> = {},
    type: MetricType = 'gauge'
  ): Promise<void> {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags,
      type,
      unit
    };

    const key = `${name}:${JSON.stringify(tags)}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    this.metrics.get(key)!.push(metric);
    
    // Keep only last 1000 metrics per key
    const metricsArray = this.metrics.get(key)!;
    if (metricsArray.length > 1000) {
      this.metrics.set(key, metricsArray.slice(-1000));
    }

    // Check for threshold violations
    await this.checkThresholds(metric);
    
    await log.debug('Metric tracked', metric);
  }

  /**
   * Track Core Web Vitals
   */
  async trackWebVitals(vitals: WebVitals, url: string): Promise<BudgetViolation[]> {
    const violations: BudgetViolation[] = [];

    // Track each vital as a metric
    if (vitals.lcp !== undefined) {
      await this.track('web_vitals.lcp', vitals.lcp, 'ms', { url }, 'gauge');
      if (vitals.lcp > PERFORMANCE_BUDGETS.CORE_WEB_VITALS.LCP.good) {
        violations.push(this.createViolation('LCP', vitals.lcp, PERFORMANCE_BUDGETS.CORE_WEB_VITALS.LCP.good));
      }
    }

    if (vitals.inp !== undefined) {
      await this.track('web_vitals.inp', vitals.inp, 'ms', { url }, 'gauge');
      if (vitals.inp > PERFORMANCE_BUDGETS.CORE_WEB_VITALS.INP.good) {
        violations.push(this.createViolation('INP', vitals.inp, PERFORMANCE_BUDGETS.CORE_WEB_VITALS.INP.good));
      }
    }

    if (vitals.cls !== undefined) {
      await this.track('web_vitals.cls', vitals.cls, 'score', { url }, 'gauge');
      if (vitals.cls > PERFORMANCE_BUDGETS.CORE_WEB_VITALS.CLS.good) {
        violations.push(this.createViolation('CLS', vitals.cls, PERFORMANCE_BUDGETS.CORE_WEB_VITALS.CLS.good));
      }
    }

    this.violations.push(...violations);
    return violations;
  }

  /**
   * Track bundle size metrics
   */
  async trackBundleSize(bundles: {
    javascript: number;
    css: number;
    totalSize: number;
  }): Promise<BudgetViolation[]> {
    const violations: BudgetViolation[] = [];

    await this.track('bundle.javascript', bundles.javascript, 'bytes', {}, 'gauge');
    await this.track('bundle.css', bundles.css, 'bytes', {}, 'gauge');
    await this.track('bundle.total', bundles.totalSize, 'bytes', {}, 'gauge');

    // Check JavaScript bundle size
    if (bundles.javascript > PERFORMANCE_BUDGETS.BUNDLE_SIZE.javascript) {
      violations.push({
        metric: 'JavaScript Bundle Size',
        actual: bundles.javascript,
        budget: PERFORMANCE_BUDGETS.BUNDLE_SIZE.javascript,
        severity: 'error',
        impact: 'Exceeds Shopify app bundle size limit, will fail app review',
        recommendations: [
          'Implement code splitting',
          'Remove unused dependencies',
          'Use tree shaking',
          'Compress with Brotli/Gzip',
          'Lazy load non-critical modules'
        ]
      });
    }

    // Check CSS bundle size
    if (bundles.css > PERFORMANCE_BUDGETS.BUNDLE_SIZE.css) {
      violations.push({
        metric: 'CSS Bundle Size',
        actual: bundles.css,
        budget: PERFORMANCE_BUDGETS.BUNDLE_SIZE.css,
        severity: 'error',
        impact: 'Exceeds Shopify app CSS size limit, will fail app review',
        recommendations: [
          'Remove unused CSS',
          'Use critical CSS extraction',
          'Minimize CSS with cssnano',
          'Use CSS-in-JS for component styles',
          'Implement CSS code splitting'
        ]
      });
    }

    this.violations.push(...violations);
    return violations;
  }

  // ========================================================================
  // ALERTING SYSTEM
  // ========================================================================

  /**
   * Create an alert
   */
  async createAlert(alert: Omit<Alert, 'id' | 'timestamp'>): Promise<void> {
    const alertId = this.generateAlertId(alert);
    
    // Check cooldown period
    if (this.isInCooldown(alertId, alert.severity)) {
      return;
    }

    const fullAlert: Alert = {
      ...alert,
      id: alertId,
      timestamp: Date.now()
    };

    this.alerts.set(alertId, fullAlert);
    this.alertCooldowns.set(alertId, Date.now());

    // Send alert through configured channels
    await this.sendAlert(fullAlert);
    
    await log[alert.severity === 'critical' || alert.severity === 'error' ? 'error' : 'warn'](
      'Alert created', 
      fullAlert
    );
  }

  /**
   * Check metric thresholds and create alerts
   */
  private async checkThresholds(metric: PerformanceMetric): Promise<void> {
    // Response time monitoring
    if (metric.name === 'http.response_time') {
      if (metric.value > MONITORING_CONFIG.PERFORMANCE.RESPONSE_TIME_ERROR) {
        await this.createAlert({
          severity: 'error',
          title: 'High Response Time',
          message: `Response time ${metric.value}ms exceeds threshold`,
          source: 'performance_monitor',
          metadata: { metric, threshold: MONITORING_CONFIG.PERFORMANCE.RESPONSE_TIME_ERROR },
          channels: ['email', 'slack']
        });
      } else if (metric.value > MONITORING_CONFIG.PERFORMANCE.RESPONSE_TIME_WARNING) {
        await this.createAlert({
          severity: 'warning',
          title: 'Elevated Response Time',
          message: `Response time ${metric.value}ms approaching threshold`,
          source: 'performance_monitor',
          metadata: { metric, threshold: MONITORING_CONFIG.PERFORMANCE.RESPONSE_TIME_WARNING },
          channels: ['slack']
        });
      }
    }

    // Memory usage monitoring
    if (metric.name === 'system.memory.heap_used') {
      if (metric.value > MONITORING_CONFIG.PERFORMANCE.MEMORY_CRITICAL) {
        await this.createAlert({
          severity: 'critical',
          title: 'Critical Memory Usage',
          message: `Memory usage ${Math.round(metric.value / 1024 / 1024)}MB exceeds critical threshold`,
          source: 'system_monitor',
          metadata: { metric, threshold: MONITORING_CONFIG.PERFORMANCE.MEMORY_CRITICAL },
          channels: ['email', 'slack', 'sms']
        });
      } else if (metric.value > MONITORING_CONFIG.PERFORMANCE.MEMORY_WARNING) {
        await this.createAlert({
          severity: 'warning',
          title: 'High Memory Usage',
          message: `Memory usage ${Math.round(metric.value / 1024 / 1024)}MB approaching threshold`,
          source: 'system_monitor',
          metadata: { metric, threshold: MONITORING_CONFIG.PERFORMANCE.MEMORY_WARNING },
          channels: ['slack']
        });
      }
    }
  }

  // ========================================================================
  // SYSTEM MONITORING
  // ========================================================================

  /**
   * Monitor system health
   */
  async monitorSystemHealth(): Promise<void> {
    const healthMetrics = await this.collectSystemMetrics();
    
    for (const metric of healthMetrics) {
      await this.track(metric.name, metric.value, metric.unit, metric.tags, metric.type);
    }
  }

  /**
   * Collect system performance metrics
   */
  private async collectSystemMetrics(): Promise<PerformanceMetric[]> {
    const metrics: PerformanceMetric[] = [];
    const now = Date.now();
    
    // Memory usage
    const memoryUsage = process.memoryUsage();
    metrics.push({
      name: 'system.memory.heap_used',
      value: memoryUsage.heapUsed,
      timestamp: now,
      tags: { unit: 'bytes' },
      type: 'gauge',
      unit: 'bytes'
    });

    metrics.push({
      name: 'system.memory.heap_total',
      value: memoryUsage.heapTotal,
      timestamp: now,
      tags: { unit: 'bytes' },
      type: 'gauge',
      unit: 'bytes'
    });

    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    metrics.push({
      name: 'system.cpu.user',
      value: cpuUsage.user,
      timestamp: now,
      tags: { unit: 'microseconds' },
      type: 'gauge',
      unit: 'microseconds'
    });

    // Event loop lag (simplified)
    const eventLoopStart = Date.now();
    await new Promise(resolve => setImmediate(resolve));
    const eventLoopLag = Date.now() - eventLoopStart;
    
    metrics.push({
      name: 'system.event_loop.lag',
      value: eventLoopLag,
      timestamp: now,
      tags: { unit: 'milliseconds' },
      type: 'gauge',
      unit: 'ms'
    });

    return metrics;
  }

  // ========================================================================
  // REPORTING AND ANALYSIS
  // ========================================================================

  /**
   * Get performance score (0-100)
   */
  getPerformanceScore(): number {
    if (this.violations.length === 0) return 100;

    const errorViolations = this.violations.filter(v => v.severity === 'error').length;
    const warningViolations = this.violations.filter(v => v.severity === 'warning').length;

    // Each error reduces score by 15, each warning by 5
    const scoreReduction = (errorViolations * 15) + (warningViolations * 5);
    return Math.max(0, 100 - scoreReduction);
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(): {
    score: number;
    violations: BudgetViolation[];
    alerts: Alert[];
    summary: {
      errors: number;
      warnings: number;
      totalIssues: number;
    };
    recommendations: string[];
  } {
    const score = this.getPerformanceScore();
    const activeAlerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved);
    const errors = this.violations.filter(v => v.severity === 'error').length;
    const warnings = this.violations.filter(v => v.severity === 'warning').length;

    // Get top recommendations
    const allRecommendations = this.violations.flatMap(v => v.recommendations);
    const uniqueRecommendations = [...new Set(allRecommendations)].slice(0, 10);

    return {
      score,
      violations: this.violations,
      alerts: activeAlerts,
      summary: {
        errors,
        warnings,
        totalIssues: this.violations.length
      },
      recommendations: uniqueRecommendations
    };
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private createViolation(metric: string, actual: number, budget: number): BudgetViolation {
    const severity = actual > budget * 2 ? 'error' : 'warning';
    return {
      metric,
      actual,
      budget,
      severity,
      impact: `${metric} performance affects user experience and Shopify compliance`,
      recommendations: this.getOptimizationRecommendations(metric)
    };
  }

  private getOptimizationRecommendations(metric: string): string[] {
    switch (metric) {
      case 'LCP':
        return [
          'Optimize critical rendering path',
          'Compress and optimize images',
          'Use progressive loading techniques',
          'Implement server-side rendering'
        ];
      case 'INP':
        return [
          'Debounce frequent interactions',
          'Use Web Workers for heavy computations',
          'Optimize JavaScript execution',
          'Reduce main thread blocking time'
        ];
      case 'CLS':
        return [
          'Set explicit dimensions for images and videos',
          'Reserve space for dynamic content',
          'Use CSS contain property',
          'Preload critical fonts'
        ];
      default:
        return ['General performance optimization needed'];
    }
  }

  private generateAlertId(alert: Omit<Alert, 'id' | 'timestamp'>): string {
    const source = `${alert.source}:${alert.title}:${alert.severity}`;
    return Buffer.from(source).toString('base64').substring(0, 16);
  }

  private isInCooldown(alertId: string, severity: AlertSeverity): boolean {
    const lastAlert = this.alertCooldowns.get(alertId);
    if (!lastAlert) return false;

    const cooldownPeriod = MONITORING_CONFIG.ALERT_COOLDOWN[severity.toUpperCase() as keyof typeof MONITORING_CONFIG.ALERT_COOLDOWN] || MONITORING_CONFIG.ALERT_COOLDOWN.WARNING;
    return Date.now() - lastAlert < cooldownPeriod;
  }

  private async sendAlert(alert: Alert): Promise<void> {
    // Implementation would integrate with actual alerting services
    await log.info('Alert would be sent to channels', { 
      alertId: alert.id, 
      channels: alert.channels 
    });
  }

  /**
   * Clear violations (for new monitoring session)
   */
  clearViolations(): void {
    this.violations = [];
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get system status summary
   */
  getSystemStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    activeAlerts: number;
    criticalAlerts: number;
    lastChecked: number;
  } {
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'unhealthy';
    } else if (activeAlerts.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      lastChecked: Date.now()
    };
  }
}

// ============================================================================
// GLOBAL MONITORING INSTANCE
// ============================================================================

export const monitoring = new UnifiedMonitoringSystem();

/**
 * Express/Remix middleware for request monitoring
 */
export function requestMonitoringMiddleware() {
  return async (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    // Monitor request
    await monitoring.track(
      'http.requests',
      1,
      'count',
      { 
        method: req.method, 
        route: req.route?.path || req.path,
        status: 'started'
      },
      'counter'
    );

    // Override res.end to capture response metrics
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const responseTime = Date.now() - startTime;
      
      // Record response time
      monitoring.track(
        'http.response_time',
        responseTime,
        'ms',
        { 
          method: req.method, 
          route: req.route?.path || req.path,
          status_code: res.statusCode.toString()
        },
        'timer'
      );

      // Record response status
      monitoring.track(
        'http.responses',
        1,
        'count',
        { 
          method: req.method, 
          route: req.route?.path || req.path,
          status_code: res.statusCode.toString(),
          status_class: `${Math.floor(res.statusCode / 100)}xx`
        },
        'counter'
      );

      originalEnd.apply(res, args);
    };

    next();
  };
}

/**
 * Initialize monitoring system
 */
export async function initializeMonitoring(): Promise<void> {
  // Start periodic system health monitoring
  setInterval(async () => {
    await monitoring.monitorSystemHealth();
  }, 60000); // Every minute

  await log.info('Unified monitoring system initialized');
}

// ============================================================================
// PERFORMANCE OPTIMIZATION UTILITIES (from old performance.server.ts)
// ============================================================================

/**
 * Generate resource hints for critical resource preloading
 */
export function generateResourceHints(): string[] {
  return [
    '/build/entry.client.js',
    '/build/root.js', 
    '/api/user',
    '/api/settings',
    'https://cdn.shopify.com/shopifycloud/polaris',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
  ];
}

/**
 * Generate critical CSS for above-the-fold content
 */
export function generateCriticalCSS(pathname: string): string {
  let criticalCSS = `
    /* Base critical CSS for immediate rendering */
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f6f6f7;
    }
    
    .Polaris-Page {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .Polaris-Card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      padding: 1.5rem;
      margin-bottom: 1rem;
    }
    
    /* Loading state prevention for layout shift */
    .Polaris-Spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
    }
  `;

  // Add page-specific critical CSS
  if (pathname.includes('/dashboard')) {
    criticalCSS += `
      .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1rem;
      }
    `;
  }

  if (pathname.includes('/registries')) {
    criticalCSS += `
      .registry-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
    `;
  }

  return criticalCSS.trim();
}