interface Window {
  ENV: {
    NODE_ENV: string;
    GA_MEASUREMENT_ID?: string;
    SHOPIFY_APP_URL?: string;
  };
  Sentry?: {
    captureException: (error: Error, context?: any) => void;
  };
  dataLayer?: any[];
}