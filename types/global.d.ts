// Global type declarations for WishCraft
declare global {
  interface Window {
    wishcraftConfig?: {
      apiKey: string;
      shop: string;
      host: string;
    };
    ENV?: {
      NODE_ENV: string;
      [key: string]: any;
    };
    Sentry?: {
      captureException: (error: Error, options?: any) => void;
      captureMessage: (message: string, options?: any) => void;
    };
    shopify?: {
      toast?: {
        show: (message: string, options?: {
          isError?: boolean;
          duration?: number;
        }) => void;
      };
      app?: {
        configure: (config: {
          features: {
            embeddedAuthStrategy?: boolean;
            sessionTokenStrategy?: boolean;
            performanceOptimizations?: boolean;
          };
        }) => void;
      };
    };
  }
}

export {};