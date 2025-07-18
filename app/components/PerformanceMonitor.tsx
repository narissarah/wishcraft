import { useEffect } from "react";

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
      
      // Performance monitoring removed for production deployment
      
    } catch (error) {
      // Silent failure - monitoring should never break the app
    }
  }, []);

  // This component renders nothing - it's just for monitoring setup
  return null;
}