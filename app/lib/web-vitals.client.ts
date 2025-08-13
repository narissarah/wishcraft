import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

interface VitalMetric {
  name: 'CLS' | 'INP' | 'LCP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

// Built for Shopify thresholds
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // 2.5s for good, 4s for poor
  CLS: { good: 0.1, poor: 0.25 },   // 0.1 for good, 0.25 for poor
  INP: { good: 200, poor: 500 },    // 200ms for good, 500ms for poor
} as const;

function getRating(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[metric as keyof typeof THRESHOLDS];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

class WebVitalsMonitor {
  private metrics: VitalMetric[] = [];
  private reportUrl: string = '/api/performance-metrics';

  constructor() {
    if (typeof window !== 'undefined' && 'performance' in window) {
      this.initializeMonitoring();
    }
  }

  private initializeMonitoring() {
    // Monitor Largest Contentful Paint
    onLCP((metric) => this.recordMetric('LCP', metric));
    
    // Monitor Cumulative Layout Shift
    onCLS((metric) => this.recordMetric('CLS', metric));
    
    // Monitor Interaction to Next Paint
    onINP((metric) => this.recordMetric('INP', metric));
  }

  private recordMetric(name: 'CLS' | 'INP' | 'LCP', metric: Metric) {
    const vitalMetric: VitalMetric = {
      name,
      value: metric.value,
      rating: getRating(name, metric.value),
      timestamp: Date.now(),
    };

    this.metrics.push(vitalMetric);
    
    // Log warning if metric doesn't meet Built for Shopify requirements
    if (vitalMetric.rating !== 'good') {
      console.warn(`[Web Vitals] ${name} is ${vitalMetric.rating}: ${metric.value}`, {
        threshold: THRESHOLDS[name].good,
        entries: metric.entries,
      });
    }

    // Report metrics in batches
    if (this.metrics.length >= 3) {
      this.reportMetrics();
    }
  }

  private async reportMetrics() {
    if (this.metrics.length === 0) return;

    const metricsToReport = [...this.metrics];
    this.metrics = [];

    try {
      const response = await fetch(this.reportUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics: metricsToReport,
          url: window.location.href,
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
          connection: (navigator as any).connection?.effectiveType || 'unknown',
        }),
      });

      if (!response.ok) {
        console.error('[Web Vitals] Failed to report metrics:', response.statusText);
      }
    } catch (error) {
      console.error('[Web Vitals] Error reporting metrics:', error);
    }
  }

  // Get current metrics for debugging
  getCurrentMetrics() {
    return this.metrics;
  }

  // Force report metrics (useful for page unload)
  flush() {
    this.reportMetrics();
  }
}

// Initialize monitoring
let monitor: WebVitalsMonitor | null = null;

export function initializeWebVitals() {
  if (typeof window !== 'undefined' && !monitor) {
    monitor = new WebVitalsMonitor();
    
    // Report any remaining metrics before page unload
    window.addEventListener('beforeunload', () => {
      monitor?.flush();
    });
  }
}

// Export for debugging purposes
export function getWebVitalsMonitor() {
  return monitor;
}