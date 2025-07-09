/// <reference types="@types/gtag.js" />

declare global {
  interface Window {
    ENV: {
      NODE_ENV: string;
      GA_MEASUREMENT_ID?: string;
      SHOPIFY_APP_URL?: string;
    };
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

// Fix for remix-utils if not installed
declare module "remix-utils/client-only" {
  export function ClientOnly({ children }: { children: () => React.ReactNode }): JSX.Element | null;
}

export {};