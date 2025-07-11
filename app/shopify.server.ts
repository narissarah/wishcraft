import { LATEST_API_VERSION } from "@shopify/shopify-app-remix/server";
import { shopifyApp } from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { db } from "~/lib/db.server";

// Initialize Prisma session storage
const sessionStorage = new PrismaSessionStorage(db);

// Minimal, stable Shopify App Configuration (2025)
export const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: process.env.SHOPIFY_SCOPES?.split(",") || [
    "read_customers",
    "write_customers", 
    "read_products",
    "read_orders",
    "write_orders",
    "read_inventory",
    "write_inventory"
  ],
  appUrl: process.env.SHOPIFY_APP_URL!,
  authPathPrefix: "/auth",
  sessionStorage,
  apiVersion: LATEST_API_VERSION,
  
  // Use only stable features - no experimental flags
  useOnlineTokens: true,
  isEmbeddedApp: true,
  
  // Webhook configuration
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/app/uninstalled",
    },
  },
});

export const authenticate = shopify.authenticate;