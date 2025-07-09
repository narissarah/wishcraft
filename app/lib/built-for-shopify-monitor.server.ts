import { LRUCache } from "lru-cache";

/**
 * Built for Shopify Certification Monitoring
 * Ensures compliance with Built for Shopify performance requirements
 */

export interface BuiltForShopifyMetrics {
  lcp: number; // Largest Contentful Paint
  cls: number; // Cumulative Layout Shift  
  inp: number; // Interaction to Next Paint (replaces FID in 2025)
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte
  overallScore: number;
  timestamp: Date;
  certified: boolean;
}

export interface PerformanceBudget {
  lcp: { target: number; budget: number }; // 2.5s target, 3.0s budget
  cls: { target: number; budget: number }; // 0.1 target, 0.15 budget
  inp: { target: number; budget: number }; // 200ms target, 300ms budget
  fcp: { target: number; budget: number }; // 1.8s target, 2.5s budget
  ttfb: { target: number; budget: number }; // 800ms target, 1.2s budget
}

// Built for Shopify 2025 Requirements
const PERFORMANCE_BUDGET: PerformanceBudget = {
  lcp: { target: 2500, budget: 3000 }, // Largest Contentful Paint
  cls: { target: 0.1, budget: 0.15 },   // Cumulative Layout Shift
  inp: { target: 200, budget: 300 },    // Interaction to Next Paint (new 2025)
  fcp: { target: 1800, budget: 2500 },  // First Contentful Paint
  ttfb: { target: 800, budget: 1200 }   // Time to First Byte
};

// Certification Requirements (75th percentile)
const CERTIFICATION_THRESHOLDS = {
  lcp: 2500,  // Under 2.5 seconds
  cls: 0.1,   // Below 0.1
  inp: 200,   // Under 200ms
  minScore: 90, // Minimum score for certification
  measurementPeriod: 30 // Days of measurement required
};

class BuiltForShopifyMonitor {
  private metrics: LRUCache<string, BuiltForShopifyMetrics>;
  private alertThresholds: PerformanceBudget;

  constructor() {
    this.metrics = new LRUCache<string, BuiltForShopifyMetrics>({
      max: 10000, // Store 10k measurements
      ttl: 30 * 24 * 60 * 60 * 1000 // 30 days for certification tracking
    });

    this.alertThresholds = PERFORMANCE_BUDGET;
  }

  /**
   * Record performance metrics for Built for Shopify monitoring
   */
  async recordMetrics(metrics: Omit<BuiltForShopifyMetrics, 'overallScore' | 'certified' | 'timestamp'>): Promise<void> {
    const timestamp = new Date();
    const overallScore = this.calculateScore(metrics);
    const certified = this.checkCertificationEligibility(metrics);

    const record: BuiltForShopifyMetrics = {
      ...metrics,
      overallScore,
      certified,
      timestamp
    };

    // Store with timestamp key for historical tracking
    const key = `${timestamp.getTime()}-${Math.random()}`;
    this.metrics.set(key, record);

    // Check for performance budget violations
    await this.checkBudgetViolations(record);

    // Log certification status changes
    if (!certified) {
      console.warn('🚨 Built for Shopify: Performance below certification thresholds', {
        lcp: metrics.lcp,
        cls: metrics.cls,
        inp: metrics.inp,
        score: overallScore
      });
    }
  }

  /**
   * Calculate overall performance score (0-100)
   */
  private calculateScore(metrics: Omit<BuiltForShopifyMetrics, 'overallScore' | 'certified' | 'timestamp'>): number {
    const scores = {
      lcp: this.getMetricScore(metrics.lcp, 'lcp'),
      cls: this.getMetricScore(metrics.cls, 'cls'),
      inp: this.getMetricScore(metrics.inp, 'inp'),
      fcp: this.getMetricScore(metrics.fcp, 'fcp'),
      ttfb: this.getMetricScore(metrics.ttfb, 'ttfb')
    };

    // Weighted average (Core Web Vitals have higher weight)
    const weightedScore = (
      scores.lcp * 0.25 +      // 25% weight
      scores.cls * 0.25 +      // 25% weight  
      scores.inp * 0.25 +      // 25% weight (replaces FID)
      scores.fcp * 0.15 +      // 15% weight
      scores.ttfb * 0.10       // 10% weight
    );

    return Math.round(weightedScore);
  }

  /**
   * Get individual metric score (0-100)
   */
  private getMetricScore(value: number, metric: keyof PerformanceBudget): number {
    const budget = this.alertThresholds[metric];
    const target = budget.target;
    const max = budget.budget;

    if (value <= target) return 100;
    if (value >= max) return 0;

    // Linear interpolation between target and budget
    return Math.round(100 * (1 - (value - target) / (max - target)));
  }

  /**
   * Check Built for Shopify certification eligibility
   */
  private checkCertificationEligibility(metrics: Omit<BuiltForShopifyMetrics, 'overallScore' | 'certified' | 'timestamp'>): boolean {
    return (
      metrics.lcp <= CERTIFICATION_THRESHOLDS.lcp &&
      metrics.cls <= CERTIFICATION_THRESHOLDS.cls &&
      metrics.inp <= CERTIFICATION_THRESHOLDS.inp
    );
  }

  /**
   * Check for performance budget violations
   */
  private async checkBudgetViolations(metrics: BuiltForShopifyMetrics): Promise<void> {
    const violations: Array<{
      metric: string;
      value: number;
      budget: number;
      severity: 'critical' | 'warning';
    }> = [];

    Object.entries(this.alertThresholds).forEach(([metric, budget]) => {
      const value = metrics[metric as keyof BuiltForShopifyMetrics] as number;
      if (value > budget.budget) {
        violations.push({
          metric,
          value,
          budget: budget.budget,
          severity: value > budget.budget * 1.5 ? 'critical' : 'warning'
        });
      }
    });

    if (violations.length > 0) {
      await this.sendPerformanceAlert(violations, metrics);
    }
  }

  /**
   * Send performance alert (webhook, email, etc.)
   */
  private async sendPerformanceAlert(violations: Array<{
    metric: string;
    value: number;
    budget: number;
    severity: 'critical' | 'warning';
  }>, metrics: BuiltForShopifyMetrics): Promise<void> {
    const alertData = {
      type: 'performance_budget_violation',
      severity: violations.some(v => v.severity === 'critical') ? 'critical' : 'warning',
      violations,
      currentMetrics: metrics,
      timestamp: new Date().toISOString(),
      certificationAtRisk: !metrics.certified
    };

    console.error('🚨 Performance Budget Violation:', alertData);

    // Send to webhook if configured
    if (process.env.PERFORMANCE_WEBHOOK_URL) {
      try {
        await fetch(process.env.PERFORMANCE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertData)
        });
      } catch (error) {
        console.error('Failed to send performance alert:', error);
      }
    }
  }

  /**
   * Get certification status summary
   */
  getCertificationStatus(): {
    eligible: boolean;
    score: number;
    recentMetrics: BuiltForShopifyMetrics | null;
    measurementCount: number;
    daysTracked: number;
  } {
    const allMetrics = Array.from(this.metrics.values());
    const recentMetrics = allMetrics
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0] || null;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentCount = allMetrics.filter(m => m.timestamp >= thirtyDaysAgo).length;

    const oldestMetric = allMetrics
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
    const daysTracked = oldestMetric 
      ? Math.floor((now.getTime() - oldestMetric.timestamp.getTime()) / (24 * 60 * 60 * 1000))
      : 0;

    return {
      eligible: recentMetrics?.certified || false,
      score: recentMetrics?.overallScore || 0,
      recentMetrics,
      measurementCount: recentCount,
      daysTracked
    };
  }

  /**
   * Get performance trends for dashboard
   */
  getPerformanceTrends(days: number = 7): {
    dates: string[];
    lcp: number[];
    cls: number[];
    inp: number[];
    scores: number[];
  } {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    const filteredMetrics = Array.from(this.metrics.values())
      .filter(m => m.timestamp >= startDate)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Group by day and calculate averages
    const dailyData = new Map<string, BuiltForShopifyMetrics[]>();
    
    filteredMetrics.forEach(metric => {
      const day = metric.timestamp.toISOString().split('T')[0];
      if (!dailyData.has(day)) {
        dailyData.set(day, []);
      }
      dailyData.get(day)!.push(metric);
    });

    const dates: string[] = [];
    const lcp: number[] = [];
    const cls: number[] = [];
    const inp: number[] = [];
    const scores: number[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayKey = date.toISOString().split('T')[0];
      const dayMetrics = dailyData.get(dayKey) || [];

      dates.push(dayKey);
      
      if (dayMetrics.length > 0) {
        lcp.push(Math.round(dayMetrics.reduce((sum, m) => sum + m.lcp, 0) / dayMetrics.length));
        cls.push(Math.round(dayMetrics.reduce((sum, m) => sum + m.cls, 0) / dayMetrics.length * 1000) / 1000);
        inp.push(Math.round(dayMetrics.reduce((sum, m) => sum + m.inp, 0) / dayMetrics.length));
        scores.push(Math.round(dayMetrics.reduce((sum, m) => sum + m.overallScore, 0) / dayMetrics.length));
      } else {
        lcp.push(0);
        cls.push(0);
        inp.push(0);
        scores.push(0);
      }
    }

    return { dates, lcp, cls, inp, scores };
  }
}

// Singleton instance
export const builtForShopifyMonitor = new BuiltForShopifyMonitor();

/**
 * Middleware to automatically track performance metrics
 */
export function builtForShopifyMiddleware() {
  return async (request: Request, context: any, next: () => Promise<Response>) => {
    const startTime = Date.now();
    
    try {
      const response = await next();
      
      // Track response time as TTFB
      const ttfb = Date.now() - startTime;
      
      // For now, we'll record server-side metrics
      // Client-side metrics (LCP, CLS, INP) will come from web-vitals.client.ts
      if (ttfb > 0) {
        // Record basic server metrics
        await builtForShopifyMonitor.recordMetrics({
          lcp: 0, // Will be updated by client
          cls: 0, // Will be updated by client
          inp: 0, // Will be updated by client
          fcp: 0, // Will be updated by client
          ttfb
        });
      }
      
      return response;
    } catch (error) {
      // Track error response times
      const ttfb = Date.now() - startTime;
      console.error('Performance tracking error:', error);
      throw error;
    }
  };
}

/**
 * Integration with existing web-vitals monitoring
 */
export async function updateBuiltForShopifyMetrics(webVitalsData: {
  lcp?: number;
  cls?: number;
  inp?: number;
  fcp?: number;
  ttfb?: number;
}): Promise<void> {
  await builtForShopifyMonitor.recordMetrics({
    lcp: webVitalsData.lcp || 0,
    cls: webVitalsData.cls || 0,
    inp: webVitalsData.inp || 0,
    fcp: webVitalsData.fcp || 0,
    ttfb: webVitalsData.ttfb || 0
  });
}

// ============================================================================
// STANDALONE FUNCTION EXPORTS (for test compatibility)
// ============================================================================

/**
 * Track Core Web Vital metric
 */
export async function trackCoreWebVital(metric: {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: 'navigate' | 'reload' | 'back_forward' | 'prerender';
  entries: any[];
}): Promise<{
  pass: boolean;
  value: number;
  threshold: number;
}> {
  // Define thresholds based on Built for Shopify requirements
  const thresholds = {
    LCP: 2500,  // 2.5 seconds
    CLS: 0.1,   // 0.1 cumulative layout shift
    INP: 200,   // 200ms interaction to next paint
    FCP: 1800,  // 1.8 seconds first contentful paint
    FID: 100,   // 100ms first input delay (legacy)
    TTFB: 800   // 800ms time to first byte
  };

  const threshold = thresholds[metric.name as keyof typeof thresholds] || 0;
  const pass = metric.value <= threshold;

  // Record the metric
  await builtForShopifyMonitor.recordMetrics({
    lcp: metric.name === 'LCP' ? metric.value : 0,
    cls: metric.name === 'CLS' ? metric.value : 0,
    inp: metric.name === 'INP' ? metric.value : 0,
    fcp: metric.name === 'FCP' ? metric.value : 0,
    ttfb: metric.name === 'TTFB' ? metric.value : 0
  });

  return {
    pass,
    value: metric.value,
    threshold
  };
}

/**
 * Check performance budget against current metrics
 */
export async function checkPerformanceBudget(metrics: {
  lcp: number;
  cls: number;
  inp: number;
  ttfb: number;
}): Promise<{
  pass: boolean;
  failures: string[];
}> {
  const failures: string[] = [];

  // Check each metric against thresholds
  if (metrics.lcp > 2500) {
    failures.push('LCP');
  }
  if (metrics.cls > 0.1) {
    failures.push('CLS');
  }
  if (metrics.inp > 200) {
    failures.push('INP');
  }
  if (metrics.ttfb > 800) {
    failures.push('TTFB');
  }

  // Record metrics
  await builtForShopifyMonitor.recordMetrics({
    lcp: metrics.lcp,
    cls: metrics.cls,
    inp: metrics.inp,
    fcp: 0, // Not provided in this check
    ttfb: metrics.ttfb
  });

  return {
    pass: failures.length === 0,
    failures
  };
}

/**
 * Get comprehensive performance report
 */
export async function getPerformanceReport(startDate: string, endDate: string): Promise<{
  summary: {
    totalMeasurements: number;
    avgScore: number;
    certificationEligible: boolean;
  };
  metrics: {
    lcp: { avg: number; p75: number; p95: number };
    cls: { avg: number; p75: number; p95: number };
    inp: { avg: number; p75: number; p95: number };
  };
  recommendations: string[];
}> {
  // Get certification status
  const certificationStatus = builtForShopifyMonitor.getCertificationStatus();
  
  // Get performance trends for the date range
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  const trends = builtForShopifyMonitor.getPerformanceTrends(daysDiff);
  
  // Calculate metrics statistics
  const calculateStats = (values: number[]) => {
    const sorted = values.filter(v => v > 0).sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length || 0;
    const p75 = sorted[Math.floor(sorted.length * 0.75)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    return { avg: Math.round(avg), p75, p95 };
  };

  // Generate recommendations
  const recommendations: string[] = [];
  if (!certificationStatus.eligible) {
    recommendations.push('Improve Core Web Vitals to meet Built for Shopify certification requirements');
  }
  if (certificationStatus.score < 90) {
    recommendations.push('Focus on optimizing largest contentful paint (LCP) and cumulative layout shift (CLS)');
  }
  if (certificationStatus.measurementCount < 100) {
    recommendations.push('Continue monitoring to gather more performance data');
  }

  return {
    summary: {
      totalMeasurements: certificationStatus.measurementCount,
      avgScore: certificationStatus.score,
      certificationEligible: certificationStatus.eligible
    },
    metrics: {
      lcp: calculateStats(trends.lcp),
      cls: calculateStats(trends.cls),
      inp: calculateStats(trends.inp)
    },
    recommendations
  };
}