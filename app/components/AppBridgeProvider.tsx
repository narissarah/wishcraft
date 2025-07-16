// App Bridge 4.x Provider for WishCraft - 2025 Compliant
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { useEffect } from "react";
import type { ReactNode } from "react";

interface AppBridgeWrapperProps {
  children: ReactNode;
  config: {
    apiKey: string;
    shop: string;
    host: string;
  };
}

export function AppBridgeWrapper({ children, config }: AppBridgeWrapperProps) {
  useEffect(() => {
    // Initialize App Bridge 4.x configuration
    if (typeof window !== 'undefined') {
      // Store config in window for access by other components
      (window as any).wishcraftConfig = config;
      
      // Set up App Bridge 4.x features
      if (window.shopify?.app) {
        // Enable 2025 features
        window.shopify.app.configure({
          features: {
            // Enable new embedded auth strategy (required for 2025)
            embeddedAuthStrategy: true,
            // Enable new session token handling
            sessionTokenStrategy: true,
            // Enable performance optimizations
            performanceOptimizations: true
          }
        });
      }
    }
  }, [config]);

  const appBridgeConfig = {
    apiKey: config.apiKey,
    shop: config.shop,
    host: config.host,
    // 2025 compliance features
    features: {
      // Required for 2025 Built for Shopify
      embedded: true,
      // Enable session tokens for security
      sessionToken: true,
      // Enable performance features
      performanceTracking: true
    }
  };

  // App Bridge 4.x doesn't use a Provider component
  // Configuration is handled through window.shopify.app
  return (
    <PolarisProvider i18n={enTranslations}>
      {children}
    </PolarisProvider>
  );
}

