// Performance dashboard and analytics server utilities

export interface PerformanceDashboardData {
  overview: {
    totalPageViews: number;
    averageLoadTime: number;
    coreWebVitals: {
      LCP: { p50: number; p95: number; p99: number };
      FID: { p50: number; p95: number; p99: number };
      CLS: { p50: number; p95: number; p99: number };
    };
    performanceScore: number;
    budgetViolations: number;
  };
  trends: {
    daily: Array<{
      date: string;
      pageViews: number;
      averageLoadTime: number;
      performanceScore: number;
    }>;
    hourly: Array<{
      hour: number;
      pageViews: number;
      averageLoadTime: number;
    }>;
  };
  topPages: Array<{
    path: string;
    pageViews: number;
    averageLoadTime: number;
    performanceScore: number;
  }>;
  deviceBreakdown: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  connectionTypes: Array<{
    type: string;
    percentage: number;
    averageLoadTime: number;
  }>;
  errorAnalysis: {
    totalErrors: number;
    errorsByType: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
    criticalErrors: Array<{
      message: string;
      count: number;
      lastSeen: string;
    }>;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'performance' | 'error' | 'budget';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metric?: string;
  threshold?: number;
  currentValue?: number;
  timestamp: number;
  acknowledged: boolean;
}

// Performance analytics aggregator
export class PerformanceAnalytics {
  private db: any; // Prisma client would go here

  constructor(db: any) {
    this.db = db;
  }

  // Aggregate performance metrics
  async aggregateMetrics(
    startDate: Date,
    endDate: Date,
    filters?: {
      page?: string;
      deviceType?: string;
      connectionType?: string;
    }
  ): Promise<PerformanceDashboardData> {
    const whereClause = {
      timestamp: {
        gte: startDate,
        lte: endDate
      },
      ...(filters?.page && { page: filters.page }),
      ...(filters?.deviceType && { deviceType: filters.deviceType }),
      ...(filters?.connectionType && { connectionType: filters.connectionType })
    };

    // Get overview metrics
    const overview = await this.getOverviewMetrics(whereClause);
    
    // Get trends
    const trends = await this.getTrends(whereClause);
    
    // Get top pages
    const topPages = await this.getTopPages(whereClause);
    
    // Get device breakdown
    const deviceBreakdown = await this.getDeviceBreakdown(whereClause);
    
    // Get connection types
    const connectionTypes = await this.getConnectionTypes(whereClause);
    
    // Get error analysis
    const errorAnalysis = await this.getErrorAnalysis(whereClause);

    return {
      overview,
      trends,
      topPages,
      deviceBreakdown,
      connectionTypes,
      errorAnalysis
    };
  }

  private async getOverviewMetrics(whereClause: any) {
    // This would be actual database queries in a real implementation
    return {
      totalPageViews: 10000,
      averageLoadTime: 1850,
      coreWebVitals: {
        LCP: { p50: 2100, p95: 3200, p99: 4500 },
        FID: { p50: 85, p95: 180, p99: 280 },
        CLS: { p50: 0.05, p95: 0.12, p99: 0.18 }
      },
      performanceScore: 85,
      budgetViolations: 12
    };
  }

  private async getTrends(whereClause: any) {
    // Generate sample trend data
    const daily = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      pageViews: Math.floor(Math.random() * 1000) + 500,
      averageLoadTime: Math.floor(Math.random() * 500) + 1500,
      performanceScore: Math.floor(Math.random() * 20) + 80
    }));

    const hourly = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      pageViews: Math.floor(Math.random() * 100) + 50,
      averageLoadTime: Math.floor(Math.random() * 200) + 1700
    }));

    return { daily, hourly };
  }

  private async getTopPages(whereClause: any) {
    return [
      { path: '/registry/123', pageViews: 1500, averageLoadTime: 1650, performanceScore: 88 },
      { path: '/registries', pageViews: 1200, averageLoadTime: 1450, performanceScore: 92 },
      { path: '/admin/dashboard', pageViews: 800, averageLoadTime: 2100, performanceScore: 78 },
      { path: '/registry/456', pageViews: 600, averageLoadTime: 1750, performanceScore: 85 }
    ];
  }

  private async getDeviceBreakdown(whereClause: any) {
    return {
      mobile: 65,
      tablet: 15,
      desktop: 20
    };
  }

  private async getConnectionTypes(whereClause: any) {
    return [
      { type: '4g', percentage: 45, averageLoadTime: 1800 },
      { type: 'wifi', percentage: 40, averageLoadTime: 1200 },
      { type: '3g', percentage: 12, averageLoadTime: 3200 },
      { type: '2g', percentage: 3, averageLoadTime: 8500 }
    ];
  }

  private async getErrorAnalysis(whereClause: any) {
    return {
      totalErrors: 156,
      errorsByType: [
        { type: 'JavaScript', count: 89, percentage: 57 },
        { type: 'Network', count: 45, percentage: 29 },
        { type: 'Resource', count: 22, percentage: 14 }
      ],
      criticalErrors: [
        { message: 'GraphQL query timeout', count: 23, lastSeen: '2025-01-05T10:30:00Z' },
        { message: 'Image load failure', count: 18, lastSeen: '2025-01-05T11:15:00Z' },
        { message: 'Script execution error', count: 12, lastSeen: '2025-01-05T09:45:00Z' }
      ]
    };
  }

  // Store performance metrics
  async storeMetrics(metrics: any): Promise<void> {
    // Store in database
    console.log('Storing metrics:', metrics);
  }

  // Generate performance alerts
  async generateAlerts(): Promise<PerformanceAlert[]> {
    const alerts: PerformanceAlert[] = [];

    // Check current performance metrics
    const recentMetrics = await this.getRecentMetrics();
    
    // LCP alert
    if (recentMetrics.avgLCP > 2500) {
      alerts.push({
        id: `lcp-${Date.now()}`,
        type: 'performance',
        severity: recentMetrics.avgLCP > 4000 ? 'critical' : 'high',
        title: 'LCP Performance Degradation',
        message: `Largest Contentful Paint is ${recentMetrics.avgLCP}ms (threshold: 2500ms)`,
        metric: 'LCP',
        threshold: 2500,
        currentValue: recentMetrics.avgLCP,
        timestamp: Date.now(),
        acknowledged: false
      });
    }

    // FID alert
    if (recentMetrics.avgFID > 100) {
      alerts.push({
        id: `fid-${Date.now()}`,
        type: 'performance',
        severity: recentMetrics.avgFID > 300 ? 'critical' : 'high',
        title: 'FID Performance Degradation',
        message: `First Input Delay is ${recentMetrics.avgFID}ms (threshold: 100ms)`,
        metric: 'FID',
        threshold: 100,
        currentValue: recentMetrics.avgFID,
        timestamp: Date.now(),
        acknowledged: false
      });
    }

    // CLS alert
    if (recentMetrics.avgCLS > 0.1) {
      alerts.push({
        id: `cls-${Date.now()}`,
        type: 'performance',
        severity: recentMetrics.avgCLS > 0.25 ? 'critical' : 'high',
        title: 'CLS Performance Degradation',
        message: `Cumulative Layout Shift is ${recentMetrics.avgCLS} (threshold: 0.1)`,
        metric: 'CLS',
        threshold: 0.1,
        currentValue: recentMetrics.avgCLS,
        timestamp: Date.now(),
        acknowledged: false
      });
    }

    // Error rate alert
    if (recentMetrics.errorRate > 5) {
      alerts.push({
        id: `error-${Date.now()}`,
        type: 'error',
        severity: recentMetrics.errorRate > 10 ? 'critical' : 'high',
        title: 'High Error Rate',
        message: `Error rate is ${recentMetrics.errorRate}% (threshold: 5%)`,
        metric: 'errorRate',
        threshold: 5,
        currentValue: recentMetrics.errorRate,
        timestamp: Date.now(),
        acknowledged: false
      });
    }

    return alerts;
  }

  private async getRecentMetrics() {
    // This would fetch actual recent metrics from database
    return {
      avgLCP: 2200,
      avgFID: 85,
      avgCLS: 0.08,
      errorRate: 3.2
    };
  }

  // Performance recommendations
  async generateRecommendations(): Promise<Array<{
    type: 'optimization' | 'fix' | 'improvement';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
    resources?: string[];
  }>> {
    const recommendations = [
      {
        type: 'optimization' as const,
        priority: 'high' as const,
        title: 'Optimize Images',
        description: 'Convert images to WebP format and implement responsive images',
        impact: 'Reduce LCP by 20-30%',
        effort: 'medium' as const,
        resources: ['Image optimization guide', 'WebP conversion tool']
      },
      {
        type: 'optimization' as const,
        priority: 'high' as const,
        title: 'Reduce JavaScript Bundle Size',
        description: 'Implement code splitting and tree shaking',
        impact: 'Reduce FID by 15-25%',
        effort: 'high' as const,
        resources: ['Bundle analyzer', 'Code splitting guide']
      },
      {
        type: 'fix' as const,
        priority: 'medium' as const,
        title: 'Fix Layout Shifts',
        description: 'Add size attributes to images and reserve space for dynamic content',
        impact: 'Reduce CLS by 40-60%',
        effort: 'low' as const,
        resources: ['CLS debugging guide']
      },
      {
        type: 'improvement' as const,
        priority: 'medium' as const,
        title: 'Implement Service Worker',
        description: 'Add offline caching and background sync',
        impact: 'Improve repeat visit performance by 50%',
        effort: 'medium' as const,
        resources: ['Service worker guide', 'Caching strategies']
      }
    ];

    return recommendations;
  }
}

// Performance alerting system
export class PerformanceAlerting {
  private analytics: PerformanceAnalytics;
  private webhookUrl?: string;
  private slackToken?: string;

  constructor(analytics: PerformanceAnalytics, config?: {
    webhookUrl?: string;
    slackToken?: string;
  }) {
    this.analytics = analytics;
    this.webhookUrl = config?.webhookUrl;
    this.slackToken = config?.slackToken;
  }

  async checkAndSendAlerts(): Promise<void> {
    const alerts = await this.analytics.generateAlerts();
    
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
  }

  private async sendAlert(alert: PerformanceAlert): Promise<void> {
    // Send to webhook
    if (this.webhookUrl) {
      try {
        await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 *${alert.title}*\n${alert.message}`,
            attachments: [{
              color: this.getAlertColor(alert.severity),
              fields: [
                { title: 'Metric', value: alert.metric || 'N/A', short: true },
                { title: 'Threshold', value: alert.threshold?.toString() || 'N/A', short: true },
                { title: 'Current Value', value: alert.currentValue?.toString() || 'N/A', short: true },
                { title: 'Severity', value: alert.severity.toUpperCase(), short: true }
              ]
            }]
          })
        });
      } catch (error) {
        console.error('Failed to send webhook alert:', error);
      }
    }

    // Send to Slack
    if (this.slackToken) {
      try {
        await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.slackToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            channel: '#performance-alerts',
            text: `🚨 *${alert.title}*\n${alert.message}`,
            attachments: [{
              color: this.getAlertColor(alert.severity),
              fields: [
                { title: 'Metric', value: alert.metric || 'N/A', short: true },
                { title: 'Current Value', value: alert.currentValue?.toString() || 'N/A', short: true }
              ]
            }]
          })
        });
      } catch (error) {
        console.error('Failed to send Slack alert:', error);
      }
    }

    // Log alert
    console.warn(`Performance Alert: ${alert.title} - ${alert.message}`);
  }

  private getAlertColor(severity: PerformanceAlert['severity']): string {
    switch (severity) {
      case 'critical': return '#ff0000';
      case 'high': return '#ff6600';
      case 'medium': return '#ffcc00';
      case 'low': return '#00ff00';
      default: return '#cccccc';
    }
  }
}

// Performance report generator
export class PerformanceReporter {
  private analytics: PerformanceAnalytics;

  constructor(analytics: PerformanceAnalytics) {
    this.analytics = analytics;
  }

  async generateReport(
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' | 'html' = 'json'
  ): Promise<string> {
    const data = await this.analytics.aggregateMetrics(startDate, endDate);
    
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      
      case 'csv':
        return this.convertToCSV(data);
      
      case 'html':
        return this.generateHTMLReport(data);
      
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  private convertToCSV(data: PerformanceDashboardData): string {
    const rows = [
      ['Metric', 'Value'],
      ['Total Page Views', data.overview.totalPageViews.toString()],
      ['Average Load Time', data.overview.averageLoadTime.toString()],
      ['LCP P50', data.overview.coreWebVitals.LCP.p50.toString()],
      ['LCP P95', data.overview.coreWebVitals.LCP.p95.toString()],
      ['FID P50', data.overview.coreWebVitals.FID.p50.toString()],
      ['FID P95', data.overview.coreWebVitals.FID.p95.toString()],
      ['CLS P50', data.overview.coreWebVitals.CLS.p50.toString()],
      ['CLS P95', data.overview.coreWebVitals.CLS.p95.toString()],
      ['Performance Score', data.overview.performanceScore.toString()],
      ['Budget Violations', data.overview.budgetViolations.toString()]
    ];

    return rows.map(row => row.join(',')).join('\n');
  }

  private generateHTMLReport(data: PerformanceDashboardData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Performance Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .metric { margin: 10px 0; }
          .good { color: green; }
          .warning { color: orange; }
          .poor { color: red; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Performance Report</h1>
        <h2>Overview</h2>
        <div class="metric">Total Page Views: ${data.overview.totalPageViews}</div>
        <div class="metric">Average Load Time: ${data.overview.averageLoadTime}ms</div>
        <div class="metric">Performance Score: ${data.overview.performanceScore}/100</div>
        
        <h2>Core Web Vitals</h2>
        <table>
          <tr><th>Metric</th><th>P50</th><th>P95</th><th>P99</th></tr>
          <tr><td>LCP</td><td>${data.overview.coreWebVitals.LCP.p50}ms</td><td>${data.overview.coreWebVitals.LCP.p95}ms</td><td>${data.overview.coreWebVitals.LCP.p99}ms</td></tr>
          <tr><td>FID</td><td>${data.overview.coreWebVitals.FID.p50}ms</td><td>${data.overview.coreWebVitals.FID.p95}ms</td><td>${data.overview.coreWebVitals.FID.p99}ms</td></tr>
          <tr><td>CLS</td><td>${data.overview.coreWebVitals.CLS.p50}</td><td>${data.overview.coreWebVitals.CLS.p95}</td><td>${data.overview.coreWebVitals.CLS.p99}</td></tr>
        </table>
        
        <h2>Top Pages</h2>
        <table>
          <tr><th>Path</th><th>Page Views</th><th>Avg Load Time</th><th>Performance Score</th></tr>
          ${data.topPages.map(page => `
            <tr>
              <td>${page.path}</td>
              <td>${page.pageViews}</td>
              <td>${page.averageLoadTime}ms</td>
              <td>${page.performanceScore}/100</td>
            </tr>
          `).join('')}
        </table>
      </body>
      </html>
    `;
  }
}

// Export configured instances
export const performanceAnalytics = new PerformanceAnalytics(null); // Database would be injected
export const performanceAlerting = new PerformanceAlerting(performanceAnalytics);
export const performanceReporter = new PerformanceReporter(performanceAnalytics);