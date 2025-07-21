import { RemixBrowser } from "@remix-run/react";
import { hydrateRoot } from "react-dom/client";
import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB } from "web-vitals";

// Initialize performance monitoring as early as possible
if (typeof window !== "undefined") {
  // Mark when hydration starts
  performance.mark("hydration-start");
  
  // Web Vitals collection
  function sendToAnalytics(metric: any) {
    // Use sendBeacon for reliability (doesn't block page unload)
    const data = {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      url: window.location.href,
      timestamp: Date.now(),
    };

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/web-vitals', JSON.stringify(data));
    } else {
      // Fallback for older browsers
      fetch('/api/analytics/web-vitals', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
        keepalive: true,
      }).catch(() => {
        // Ignore errors in analytics
      });
    }
  }

  // Collect all Core Web Vitals
  onCLS(sendToAnalytics);
  onFCP(sendToAnalytics);
  onINP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
  
  // Also collect FID for older browsers that don't support INP
  onFID(sendToAnalytics);
  
  // Monitor hydration completion
  requestIdleCallback(() => {
    performance.mark("hydration-end");
    performance.measure("hydration", "hydration-start", "hydration-end");
    
    // Send hydration performance metric
    const hydrationMeasure = performance.getEntriesByName("hydration")[0];
    if (hydrationMeasure) {
      sendToAnalytics({
        name: 'hydration',
        value: hydrationMeasure.duration,
        rating: hydrationMeasure.duration < 1000 ? 'good' : hydrationMeasure.duration < 2500 ? 'needs-improvement' : 'poor',
        delta: hydrationMeasure.duration,
        id: `hydration-${Date.now()}`,
      });
    }
  });
}

hydrateRoot(document, <RemixBrowser />);