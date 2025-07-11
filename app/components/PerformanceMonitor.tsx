import { useEffect } from "react";

/**
 * Simplified Performance Monitor for Shopify Apps
 * Error-safe implementation that won't break the main application
 */
export function PerformanceMonitor() {
  useEffect(() => {
    try {
      // Only run in browser environment
      if (typeof window === "undefined") return;
      
      // Mark app as interactive for basic performance tracking
      if (window.performance && window.performance.mark) {
        window.performance.mark("app-interactive");
      }
      
      // Optional: Monitor long tasks only in development
      if (process.env.NODE_ENV === "development" && "PerformanceObserver" in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            try {
              const entries = list.getEntries();
              entries.forEach((entry) => {
                if (entry.entryType === "longtask" && entry.duration > 50) {
                  console.warn(`[Performance] Long task: ${Math.round(entry.duration)}ms`);
                }
              });
            } catch (error) {
              // Silent failure
            }
          });

          observer.observe({ entryTypes: ["longtask"] });
          
          // Cleanup observer on unmount
          return () => {
            try {
              observer.disconnect();
            } catch (error) {
              // Silent failure
            }
          };
        } catch (error) {
          // PerformanceObserver not supported or failed - continue normally
        }
      }
    } catch (error) {
      // Silent failure - monitoring should never break the app
    }
  }, []);

  // This component renders nothing
  return null;
}