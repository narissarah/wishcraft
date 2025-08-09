declare global {
  interface Window {
    ENV: {
      NODE_ENV: string;
      SHOPIFY_APP_URL?: string;
    };
  }

}

// Extend Remix types
declare module "@remix-run/node" {
  interface AppLoadContext {
    // Add any custom context properties here
  }
}

export {};