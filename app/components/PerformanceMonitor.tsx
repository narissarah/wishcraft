import { useEffect } from "react";
import { initWebVitals } from "~/lib/web-vitals.client";

/**
 * Performance Monitor Component for React Integration
 * Delegates to the comprehensive web-vitals monitoring system
 * Consolidated to avoid duplicate performance monitoring implementations
 */
export function PerformanceMonitor() {
  useEffect(() => {
    try {
      // Only run in browser environment
      if (typeof window === "undefined") return;
      
      // Mark app as interactive for performance tracking
      if (window.performance && window.performance.mark) {
        window.performance.mark("app-interactive");
      }
      
      // Initialize comprehensive Web Vitals monitoring
      // This handles Core Web Vitals, long tasks, and analytics reporting
      initWebVitals();
      
    } catch (error) {
      // Silent failure - monitoring should never break the app
    }
  }, []);

  // This component renders nothing - it's just for monitoring setup
  return null;
}