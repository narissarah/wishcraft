import { useEffect } from "react";

export function PerformanceMonitor() {
  useEffect(() => {
    // Performance monitoring for Core Web Vitals
    if (typeof window !== "undefined" && window.performance) {
      // Mark the app as interactive
      performance.mark("app-interactive");

      // Monitor long tasks
      if ("PerformanceObserver" in window) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === "longtask") {
              console.warn("Long task detected:", entry.duration);
            }
          });
        });

        try {
          observer.observe({ entryTypes: ["longtask"] });
        } catch (error) {
          // Longtask observer not supported
        }
      }
    }
  }, []);

  return null;
}