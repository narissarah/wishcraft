import { shopifyApp } from "@shopify/shopify-app-remix/server";
import { sessionStorage } from "~/lib/session-storage.server";
import { SHOPIFY_CONFIG } from "~/config/shopify.config";

// Shopify App Configuration (2025 Standards)
export const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  
  // Consistent scopes with shopify.app.toml (2025 compliant)
  scopes: process.env.SHOPIFY_SCOPES?.split(",") || [
    "read_customers",
    "read_products",
    "read_orders",
    "write_orders",
    "read_inventory"
  ],
  
  appUrl: process.env.SHOPIFY_APP_URL!,
  authPathPrefix: "/auth",
  sessionStorage,
  apiVersion: SHOPIFY_CONFIG.API_VERSION as any, // Using centralized config
  
  // 2025 Embedded App Strategy (MANDATORY)
  isEmbeddedApp: true,
  useOnlineTokens: true,
  
  // Enable 2025 features for session tokens
  future: {
    v3_authenticatePublic: true,
    v3_lineItemBilling: true,
  } as any,
  
  // Enhanced webhook configuration (2025 GDPR Compliant)
  webhooks: {
    // App lifecycle
    APP_UNINSTALLED: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/app/uninstalled",
    },
    
    // GDPR webhooks (MANDATORY for Built for Shopify)
    CUSTOMERS_DATA_REQUEST: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/customers/data_request",
    },
    CUSTOMERS_REDACT: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/customers/redact",
    },
    SHOP_REDACT: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/shop/redact",
    },
    
    // Business logic webhooks
    CUSTOMERS_CREATE: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/customers/create",
    },
    ORDERS_CREATE: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/orders/create",
    },
    PRODUCTS_UPDATE: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/products/update",
    },
    INVENTORY_LEVELS_UPDATE: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/inventory_levels/update",
    },
  },
});

export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;