// App Bridge React 4.1.6 Provider for WishCraft - 2025 Shopify Compliant
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
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
  // For 2025 compliance, App Bridge React 4.1.6 uses automatic initialization
  // through the Shopify admin context - no manual configuration needed
  
  return (
    <PolarisProvider i18n={enTranslations}>
      {children}
    </PolarisProvider>
  );
}

// Export for backward compatibility
export { AppBridgeWrapper as AppBridgeProvider };