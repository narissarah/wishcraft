import { onCLS, onFID, onLCP, onFCP, onTTFB, onINP, type Metric } from "web-vitals";

/**
 * Production-Ready Web Vitals Monitoring (2025)
 * Built for Shopify Apps - Error-safe implementation
 */

// 2025 Core Web Vitals Thresholds for Built for Shopify - INP PRIMARY
const PERFORMANCE_THRESHOLDS = {
  INP: { good: 200, poor: 500 }, // PRIMARY 2025 METRIC (MANDATORY)
  CLS: { good: 0.1, poor: 0.25 }, // MANDATORY 2025
  LCP: { good: 2500, poor: 4000 }, // MANDATORY 2025
  FCP: { good: 1800, poor: 3000 }, // SUPPORTING METRIC
  TTFB: { good: 800, poor: 1800 }, // SUPPORTING METRIC
  FID: { good: 100, poor: 300 }, // DEPRECATED 2025 - INP REPLACES FID
};

interface PerformanceData {
  metric: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  path: string;
  timestamp: number;
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
 * Robust analytics sending with multiple fallbacks
 */
function sendAnalytics(data: PerformanceData): void {
  try {
    // Silent failure approach - never break the main app
    const payload = JSON.stringify(data);
    
    // Method 1: sendBeacon (most reliable for page unload)
    if (navigator && typeof navigator.sendBeacon === 'function') {
      // Use form-urlencoded for better CORS compatibility
      const formData = new FormData();
      formData.append('data', payload);
      
      const success = navigator.sendBeacon('/api/analytics', formData);
      if (success) return;
    }
    
    // Method 2: fetch with keepalive (good for modern browsers)
    if (typeof fetch === 'function') {
      fetch('/api/analytics', {
        method: 'POST',
        body: payload,
        headers: {
          'Content-Type': 'application/json',
        },
        keepalive: true,
      }).catch(() => {
        // Silent failure - analytics should never break the app
      });
      return;
    }
    
    // Method 3: Image beacon (most compatible fallback)
    const img = new Image();
    img.src = `/api/analytics?data=${encodeURIComponent(btoa(payload))}`;
    
  } catch (error) {
    // Silent failure - monitoring should never break the main application
  }
}

/**
 * Report metric with error isolation
 */
function reportMetric(metric: Metric): void {
  try {
    const data: PerformanceData = {
      metric: metric.name,
      value: Math.round(metric.value),
      rating: getRating(metric.name, metric.value),
      path: window.location.pathname,
      timestamp: Date.now(),
    };
    
    // Only log in development
    if (process.env.NODE_ENV === "development") {
      // Development logging for web vitals
    }
    
    // Send to analytics (with error isolation)
    sendAnalytics(data);
    
    // Check for performance violations (2025 compliance)
    if (data.rating === 'poor' || (data.rating === 'needs-improvement' && 
        ['INP', 'CLS', 'LCP'].includes(data.metric))) {
      // Send performance alert data to server for processing
      fetch('/api/performance/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: data.metric,
          value: data.value,
          rating: data.rating,
          path: data.path,
          timestamp: data.timestamp
        }),
        keepalive: true
      }).catch(() => {
        // Silent failure - alerts should not break app
      });
    }
    
  } catch (error) {
    // Silent failure - never break the main app for monitoring
  }
}

/**
 * Initialize Core Web Vitals monitoring with error boundaries
 */
export function initWebVitals(): void {
  try {
    // Only run in browser environment
    if (typeof window === 'undefined') return;
    
    // Register all metrics with error handling - INP PRIORITY ORDER (2025)
    const safeRegister = (fn: Function) => {
      try {
        fn(reportMetric);
      } catch (error) {
        // Silent failure for each metric
      }
    };
    
    // 2025 PRIORITY ORDER: INP -> CLS -> LCP -> Supporting Metrics
    safeRegister(onINP); // PRIMARY 2025 METRIC - MANDATORY
    safeRegister(onCLS); // MANDATORY 2025
    safeRegister(onLCP); // MANDATORY 2025
    safeRegister(onFCP); // SUPPORTING METRIC
    safeRegister(onTTFB); // SUPPORTING METRIC
    safeRegister(onFID); // DEPRECATED - KEEP FOR TRANSITION PERIOD
    
    // Handle page visibility changes safely
    try {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          // Force send any critical metrics on page hide
          performance.mark('page-hidden');
        }
      });
    } catch (error) {
      // Silent failure
    }
    
    // Performance observer for long tasks (optional)
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const observer = new PerformanceObserver((list) => {
          try {
            for (const entry of list.getEntries()) {
              if (entry.duration > 50) {
                // Long task detected - only log in development
                if (process.env.NODE_ENV === "development") {
                  // Development logging for long tasks
                }
              }
            }
          } catch (error) {
            // Silent failure
          }
        });
        
        observer.observe({ entryTypes: ["longtask"] });
      } catch (error) {
        // Silent failure - PerformanceObserver not supported
      }
    }
    
  } catch (error) {
    // Silent failure - entire monitoring system should never break the app
  }
}

