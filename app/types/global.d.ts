/// <reference types="@types/gtag.js" />

declare global {
  interface Window {
    ENV: {
      NODE_ENV: string;
      GA_MEASUREMENT_ID?: string;
      SHOPIFY_APP_URL?: string;
      WEB_VITALS_ENDPOINT: string;
      PERFORMANCE_SAMPLE_RATE: string;
    };
    Sentry?: {
      captureException: (error: Error, context?: any) => void;
    };
    dataLayer?: any[];
    __metricsQueue?: any[];
    __metricsTimeout?: NodeJS.Timeout;
  }

  interface PerformanceEntry {
    processingStart?: number;
  }
}

// Extend Remix types
declare module "@remix-run/node" {
  interface AppLoadContext {
    // Add any custom context properties here
  }
}

export {};