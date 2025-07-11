import { LATEST_API_VERSION } from "@shopify/shopify-app-remix/server";
import { shopifyApp } from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { db } from "~/lib/db.server";

// Initialize Prisma session storage
const sessionStorage = new PrismaSessionStorage(db);

// Shopify App Configuration (2025 Standards)
export const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  
  // Consistent scopes with shopify.app.toml (2025 compliant)
  scopes: process.env.SHOPIFY_SCOPES?.split(",") || [
    "read_customers",
    "write_customers",
    "read_products",
    "read_orders",
    "write_orders",
    "read_inventory",
    "write_content"
  ],
  
  appUrl: process.env.SHOPIFY_APP_URL!,
  authPathPrefix: "/auth",
  sessionStorage,
  apiVersion: LATEST_API_VERSION,
  
  // 2025 Embedded App Strategy (MANDATORY)
  isEmbeddedApp: true,
  useOnlineTokens: true,
  
  // Enable 2025 features
  future: {
    unstable_newEmbeddedAuthStrategy: true, // Required for 2025
  },
  
  // Enhanced webhook configuration
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/app/uninstalled",
    },
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
  },
});

export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;