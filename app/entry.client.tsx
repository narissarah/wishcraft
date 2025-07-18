import { RemixBrowser } from "@remix-run/react";
import { hydrateRoot } from "react-dom/client";

// Initialize performance monitoring as early as possible
if (typeof window !== "undefined") {
  // Mark when hydration starts
  performance.mark("hydration-start");
  
  // Performance monitoring removed for production deployment
  
  // Monitor hydration completion
  requestIdleCallback(() => {
    performance.mark("hydration-end");
    performance.measure("hydration", "hydration-start", "hydration-end");
  });
}

hydrateRoot(document, <RemixBrowser />);