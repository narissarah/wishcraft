import { RemixBrowser } from "@remix-run/react";
import { hydrateRoot } from "react-dom/client";
import { initWebVitals } from "~/lib/web-vitals.client";

// Initialize performance monitoring as early as possible
if (typeof window !== "undefined") {
  // Mark when hydration starts
  performance.mark("hydration-start");
  
  // Initialize Core Web Vitals monitoring
  initWebVitals();
  
  // Monitor hydration completion
  requestIdleCallback(() => {
    performance.mark("hydration-end");
    performance.measure("hydration", "hydration-start", "hydration-end");
  });
}

hydrateRoot(document, <RemixBrowser />);