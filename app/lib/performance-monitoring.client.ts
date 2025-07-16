/**
 * Core Web Vitals Monitoring for Built for Shopify 2025 Compliance
 * 
 * Requirements:
 * - CLS < 0.1 (mandatory for 2025)
 * - LCP < 2.5s (good)
 * - FID < 100ms (good)
 * - INP < 200ms (good)
 */

import { onCLS, onFCP, onFID, onLCP, onTTFB, onINP, type Metric } from 'web-vitals';

export interface WebVitalsMetrics {
  cls?: number;
  fcp?: number;
  fid?: number;
  lcp?: number;
  ttfb?: number;
  inp?: number;
  timestamp: number;
  url: string;
  userAgent: string;
  connection?: string;
  viewport: {
    width: number;
    height: number;
  };
}

class PerformanceMonitor {
  private metrics: Partial<WebVitalsMetrics> = {};
  private metricsBuffer: WebVitalsMetrics[] = [];
  private flushTimer?: NodeJS.Timeout;
  private readonly endpoint: string;
  private readonly sampleRate: number;
  
  constructor() {
    this.endpoint = window.ENV?.WEB_VITALS_ENDPOINT || '/api/performance/vitals';
    this.sampleRate = parseFloat(window.ENV?.PERFORMANCE_SAMPLE_RATE || '0.1');
    
    // Only monitor if we're selected by sample rate
    if (Math.random() > this.sampleRate) {
      return;
    }
    
    this.initializeMonitoring();
  }

  private initializeMonitoring() {
    // Core Web Vitals
    onCLS(this.handleCLS.bind(this), { reportAllChanges: true });
    onFCP(this.handleMetric.bind(this));
    onFID(this.handleMetric.bind(this));
    onLCP(this.handleMetric.bind(this));
    onTTFB(this.handleMetric.bind(this));
    onINP(this.handleMetric.bind(this));
    
    // Monitor page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
    
    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });
  }

  private handleCLS(metric: Metric) {
    // CLS is critical for 2025 compliance
    this.metrics.cls = metric.value;
    
    // Alert if CLS exceeds 2025 requirement
    if (metric.value > 0.1) {
      // CLS violation detected - send immediate alert
      
      // Send immediate alert for CLS violations
      this.sendMetrics({
        ...this.getBaseMetrics(),
        cls: metric.value,
        alert: 'CLS_VIOLATION',
        alertDetails: {
          actual: metric.value,
          required: 0.1,
          elements: metric.entries.map(entry => ({
            name: (entry as any).name,
            value: (entry as any).value
          }))
        }
      });
    }
    
    this.handleMetric(metric);
  }

  private handleMetric(metric: Metric) {
    this.metrics[metric.name.toLowerCase() as keyof WebVitalsMetrics] = metric.value;
    
    // Schedule flush
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, 5000);
    }
  }

  private getBaseMetrics(): WebVitalsMetrics {
    return {
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      connection: (navigator as any).connection?.effectiveType,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  }

  private flush() {
    if (Object.keys(this.metrics).length === 0) return;
    
    const metricsData: WebVitalsMetrics = {
      ...this.getBaseMetrics(),
      ...this.metrics
    };
    
    this.metricsBuffer.push(metricsData);
    this.metrics = {};
    
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    // Send metrics if buffer is full or on page unload
    if (this.metricsBuffer.length >= 10 || document.visibilityState === 'hidden') {
      this.sendMetrics();
    }
  }

  private sendMetrics(immediateMetrics?: any) {
    const metricsToSend = immediateMetrics ? [immediateMetrics] : [...this.metricsBuffer];
    
    if (metricsToSend.length === 0) return;
    
    // Use sendBeacon for reliability
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ metrics: metricsToSend })], {
        type: 'application/json'
      });
      navigator.sendBeacon(this.endpoint, blob);
    } else {
      // Fallback to fetch
      fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics: metricsToSend }),
        keepalive: true
      }).catch(error => {
        // Failed to send metrics - monitoring should not break the app
      });
    }
    
    // Clear buffer after sending
    if (!immediateMetrics) {
      this.metricsBuffer = [];
    }
  }

  // Public API for manual performance marks
  mark(name: string) {
    performance.mark(name);
  }

  measure(name: string, startMark: string, endMark?: string) {
    try {
      const measure = performance.measure(name, startMark, endMark);
      
      // Send custom measure
      this.sendMetrics({
        ...this.getBaseMetrics(),
        customMeasure: {
          name,
          duration: measure.duration,
          startTime: measure.startTime
        }
      });
    } catch (error) {
      // Failed to measure - monitoring should not break the app
    }
  }
}

// Initialize performance monitoring
let performanceMonitor: PerformanceMonitor | null = null;

export function initializePerformanceMonitoring() {
  if (typeof window !== 'undefined' && !performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
  }
  return performanceMonitor;
}

export function getPerformanceMonitor() {
  return performanceMonitor;
}

// React hook for performance monitoring
export function usePerformanceMonitor() {
  if (typeof window !== 'undefined' && !performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
  }
  
  return {
    mark: (name: string) => performanceMonitor?.mark(name),
    measure: (name: string, startMark: string, endMark?: string) => 
      performanceMonitor?.measure(name, startMark, endMark)
  };
}

// Utility to check if CLS meets 2025 requirements
export function checkCLSCompliance(cls: number): {
  compliant: boolean;
  severity: 'good' | 'needs-improvement' | 'poor' | 'critical';
  message: string;
} {
  if (cls <= 0.1) {
    return {
      compliant: true,
      severity: 'good',
      message: 'CLS meets Built for Shopify 2025 requirements'
    };
  } else if (cls <= 0.25) {
    return {
      compliant: false,
      severity: 'needs-improvement',
      message: 'CLS needs improvement for 2025 compliance'
    };
  } else {
    return {
      compliant: false,
      severity: cls > 0.5 ? 'critical' : 'poor',
      message: 'CLS fails Built for Shopify 2025 requirements'
    };
  }
}

// Performance budget checking
export interface PerformanceBudget {
  cls: number;
  lcp: number;
  fid: number;
  inp: number;
  ttfb: number;
}

export const SHOPIFY_2025_BUDGET: PerformanceBudget = {
  cls: 0.1,     // Mandatory
  lcp: 2500,    // 2.5 seconds
  fid: 100,     // 100ms
  inp: 200,     // 200ms
  ttfb: 800     // 800ms
};

export function checkPerformanceBudget(
  metrics: Partial<WebVitalsMetrics>,
  budget: PerformanceBudget = SHOPIFY_2025_BUDGET
): { 
  passed: boolean; 
  violations: string[];
  critical: boolean;
} {
  const violations: string[] = [];
  let critical = false;
  
  if (metrics.cls !== undefined && metrics.cls > budget.cls) {
    violations.push(`CLS: ${metrics.cls.toFixed(3)} > ${budget.cls} (CRITICAL for 2025)`);
    critical = true;
  }
  
  if (metrics.lcp !== undefined && metrics.lcp > budget.lcp) {
    violations.push(`LCP: ${metrics.lcp}ms > ${budget.lcp}ms`);
  }
  
  if (metrics.fid !== undefined && metrics.fid > budget.fid) {
    violations.push(`FID: ${metrics.fid}ms > ${budget.fid}ms`);
  }
  
  if (metrics.inp !== undefined && metrics.inp > budget.inp) {
    violations.push(`INP: ${metrics.inp}ms > ${budget.inp}ms`);
  }
  
  if (metrics.ttfb !== undefined && metrics.ttfb > budget.ttfb) {
    violations.push(`TTFB: ${metrics.ttfb}ms > ${budget.ttfb}ms`);
  }
  
  return {
    passed: violations.length === 0,
    violations,
    critical
  };
}