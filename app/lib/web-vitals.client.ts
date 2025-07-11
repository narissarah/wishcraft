import { onCLS, onFID, onLCP, onFCP, onTTFB, onINP, type Metric } from "web-vitals";

/**
 * Core Web Vitals Monitoring (2025 Updated)
 * Tracks performance metrics required for Built for Shopify certification
 * INP has replaced FID as the core interaction metric for 2025
 */

// Performance thresholds for Built for Shopify (2025 Requirements)
const PERFORMANCE_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  FID: { good: 100, poor: 300 }, // First Input Delay (deprecated but still tracked)
  CLS: { good: 0.1, poor: 0.25 }, // Cumulative Layout Shift
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  TTFB: { good: 800, poor: 1800 }, // Time to First Byte
  INP: { good: 200, poor: 500 }, // Interaction to Next Paint (PRIMARY 2025 METRIC)
};

// Built for Shopify 2025 Core Metrics (INP replaces FID)
const CORE_METRICS_2025 = ['LCP', 'CLS', 'INP'] as const;

// Types
export interface PerformanceData {
  metric: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  path: string;
  connection?: string;
  device?: string;
  timestamp: number;
}

export interface PerformanceReport {
  lcp?: number;
  fid?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
  inp?: number;
  overall: "good" | "needs-improvement" | "poor";
}

/**
 * Get performance rating based on thresholds
 */
function getRating(metric: string, value: number): "good" | "needs-improvement" | "poor" {
  const threshold = PERFORMANCE_THRESHOLDS[metric as keyof typeof PERFORMANCE_THRESHOLDS];
  if (!threshold) return "poor";
  
  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

/**
 * Get connection type
 */
function getConnectionType(): string {
  const connection = (navigator as any).connection || 
                    (navigator as any).mozConnection || 
                    (navigator as any).webkitConnection;
  
  if (!connection) return "unknown";
  
  return connection.effectiveType || connection.type || "unknown";
}

/**
 * Get device type
 */
function getDeviceType(): string {
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

/**
 * Send metrics to analytics endpoint
 */
async function sendToAnalytics(data: PerformanceData): Promise<void> {
  try {
    // Batch metrics to reduce requests
    const queue = (window as any).__metricsQueue || [];
    queue.push(data);
    (window as any).__metricsQueue = queue;
    
    // Send batch after delay
    clearTimeout((window as any).__metricsTimeout);
    (window as any).__metricsTimeout = setTimeout(async () => {
      const metrics = (window as any).__metricsQueue || [];
      if (metrics.length === 0) return;
      
      // Clear queue
      (window as any).__metricsQueue = [];
      
      // Send to analytics
      await fetch("/api/analytics/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics }),
      });
    }, 1000);
  } catch (error) {
    console.error("Failed to send performance metrics:", error);
  }
}

/**
 * Report metric with additional context
 */
function reportMetric(metric: Metric): void {
  const data: PerformanceData = {
    metric: metric.name,
    value: Math.round(metric.value),
    rating: getRating(metric.name, metric.value),
    path: window.location.pathname,
    connection: getConnectionType(),
    device: getDeviceType(),
    timestamp: Date.now(),
  };
  
  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log(`[Web Vitals] ${metric.name}:`, {
      value: metric.value,
      rating: data.rating,
      delta: metric.delta,
      id: metric.id,
    });
  }
  
  // Send to analytics
  sendToAnalytics(data);
  
  // Update page performance indicator
  updatePerformanceIndicator(metric.name, data.rating);
}

/**
 * Update visual performance indicator
 */
function updatePerformanceIndicator(metric: string, rating: string): void {
  // Only show in development or if enabled
  if (process.env.NODE_ENV !== "development" && !window.localStorage.getItem("showPerfIndicator")) {
    return;
  }
  
  let indicator = document.getElementById("perf-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "perf-indicator";
    indicator.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(indicator);
  }
  
  // Update metric value
  const existingMetrics = indicator.getAttribute("data-metrics") || "{}";
  const metrics = JSON.parse(existingMetrics);
  metrics[metric] = rating;
  indicator.setAttribute("data-metrics", JSON.stringify(metrics));
  
  // Update display
  const display = Object.entries(metrics)
    .map(([key, val]) => {
      const color = val === "good" ? "#0f0" : val === "needs-improvement" ? "#ff0" : "#f00";
      return `<div>${key}: <span style="color: ${color}">${val}</span></div>`;
    })
    .join("");
  
  indicator.innerHTML = `<strong>Performance</strong>${display}`;
}

/**
 * Initialize Core Web Vitals monitoring
 */
export function initWebVitals(): void {
  // Register all metrics
  onCLS(reportMetric);
  onFID(reportMetric);
  onLCP(reportMetric);
  onFCP(reportMetric);
  onTTFB(reportMetric);
  onINP(reportMetric);
  
  // Track page visibility changes
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      // Send any pending metrics
      const metrics = (window as any).__metricsQueue || [];
      if (metrics.length > 0) {
        navigator.sendBeacon("/api/analytics/performance", JSON.stringify({ metrics }));
        (window as any).__metricsQueue = [];
      }
    }
  });
  
  // Performance observer for long tasks
  if ("PerformanceObserver" in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            // Long task detected
            sendToAnalytics({
              metric: "long-task",
              value: Math.round(entry.duration),
              rating: entry.duration > 100 ? "poor" : "needs-improvement",
              path: window.location.pathname,
              connection: getConnectionType(),
              device: getDeviceType(),
              timestamp: Date.now(),
            });
          }
        }
      });
      
      observer.observe({ entryTypes: ["longtask"] });
    } catch (error) {
      console.error("Failed to setup PerformanceObserver:", error);
    }
  }
}

/**
 * Get current performance report
 */
export async function getPerformanceReport(): Promise<PerformanceReport> {
  return new Promise((resolve) => {
    const report: PerformanceReport = {
      overall: "good",
    };
    
    let metricsCollected = 0;
    const totalMetrics = 6;
    
    const checkComplete = () => {
      metricsCollected++;
      if (metricsCollected === totalMetrics) {
        // Calculate overall rating
        const ratings = Object.values(report)
          .filter((v) => typeof v === "object" && v !== null)
          .map((v: any) => getRating(v.name, v.value));
        
        if (ratings.some((r) => r === "poor")) {
          report.overall = "poor";
        } else if (ratings.some((r) => r === "needs-improvement")) {
          report.overall = "needs-improvement";
        }
        
        resolve(report);
      }
    };
    
    // Collect current metrics
    onCLS((metric) => {
      report.cls = metric.value;
      checkComplete();
    }, { reportAllChanges: false });
    
    onFID((metric) => {
      report.fid = metric.value;
      checkComplete();
    }, { reportAllChanges: false });
    
    onLCP((metric) => {
      report.lcp = metric.value;
      checkComplete();
    }, { reportAllChanges: false });
    
    onFCP((metric) => {
      report.fcp = metric.value;
      checkComplete();
    }, { reportAllChanges: false });
    
    onTTFB((metric) => {
      report.ttfb = metric.value;
      checkComplete();
    }, { reportAllChanges: false });
    
    onINP((metric) => {
      report.inp = metric.value;
      checkComplete();
    }, { reportAllChanges: false });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      resolve(report);
    }, 5000);
  });
}

/**
 * Performance monitoring utilities
 */
export const PerformanceMonitor = {
  /**
   * Mark the start of a custom timing
   */
  mark(name: string): void {
    if ("performance" in window) {
      performance.mark(name);
    }
  },
  
  /**
   * Measure between two marks
   */
  measure(name: string, startMark: string, endMark?: string): void {
    if ("performance" in window) {
      try {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name)[0];
        if (measure) {
          sendToAnalytics({
            metric: `custom-${name}`,
            value: Math.round(measure.duration),
            rating: measure.duration < 1000 ? "good" : measure.duration < 3000 ? "needs-improvement" : "poor",
            path: window.location.pathname,
            connection: getConnectionType(),
            device: getDeviceType(),
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error(`Failed to measure ${name}:`, error);
      }
    }
  },
  
  /**
   * Track a custom metric
   */
  trackMetric(name: string, value: number): void {
    sendToAnalytics({
      metric: `custom-${name}`,
      value: Math.round(value),
      rating: "good", // Custom metrics don't have thresholds
      path: window.location.pathname,
      connection: getConnectionType(),
      device: getDeviceType(),
      timestamp: Date.now(),
    });
  },
};