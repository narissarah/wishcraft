import { LATEST_API_VERSION } from "@shopify/shopify-app-remix/server";
import { shopifyApp } from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
// import { restResources } from "@shopify/shopify-api/rest/admin/2024-10";
import { db } from "~/lib/db.server";

// Initialize Prisma session storage
const sessionStorage = new PrismaSessionStorage(db) as any;

// Shopify App Configuration following 2025 best practices
export const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: process.env.SHOPIFY_SCOPES?.split(",") || [
    // COMPLIANCE: Minimal required scopes for gift registry functionality
    "read_customers",
    "read_orders",
    "write_orders", 
    "read_products",
    "read_inventory",
    "write_metaobjects"
  ],
  appUrl: process.env.SHOPIFY_APP_URL!,
  authPathPrefix: "/auth",
  sessionStorage,
  // distribution: "app",
  apiVersion: LATEST_API_VERSION,
  // restResources,
  
  // 2025 security features
  future: {
    unstable_newEmbeddedAuthStrategy: true, // Enable modern auth strategy
  },
  
  // Enhanced session configuration
  useOnlineTokens: true,
  
  // Webhook configuration
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/app/uninstalled",
    },
    ORDERS_CREATE: {
      deliveryMethod: "http" as any, 
      callbackUrl: "/webhooks/orders/create",
    },
    CUSTOMERS_CREATE: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/customers/create",
    },
    PRODUCTS_UPDATE: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/products/update",
    },
    INVENTORY_LEVELS_UPDATE: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/inventory_levels/update",
    },
    PRODUCT_VARIANTS_UPDATE: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/product_variants/update",
    },
    CUSTOMERS_UPDATE: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/customers/update",
    },
    ORDERS_PAID: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/orders/paid",
    },
    ORDERS_FULFILLED: {
      deliveryMethod: "http" as any,
      callbackUrl: "/webhooks/orders/fulfilled",
    },
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
    }
  },
  
  // Post-auth hooks
  hooks: {
    afterAuth: async ({ session }) => {
      // Register webhooks after successful authentication
      await shopify.registerWebhooks({ session });
      
      // Initialize shop data in database
      await initializeShopData(session);
    },
  },
  
  // Error handling
  isEmbeddedApp: true,
});

// Initialize shop data after authentication
async function initializeShopData(session: any) {
  try {
    // Check if shop already exists in database
    const existingShop = await db.shop.findUnique({
      where: { id: session.shop }
    });
    
    if (!existingShop) {
      // Create new shop record with basic settings
      await db.shop.create({
        data: {
          id: session.shop,
          domain: session.shop,
          name: session.shop.replace('.myshopify.com', ''),
          email: '',
          currencyCode: 'USD',
          settings: {
            create: {
              enablePasswordProtection: true,
              enableGiftMessages: true,
              enableSocialSharing: true,
              enableGroupGifting: true,
              enableAnalytics: true,
              enableEmailNotifications: true,
              primaryColor: "#007ace",
              accentColor: "#f3f3f3",
              fontFamily: "Inter",
              defaultRegistryVisibility: "public",
              maxItemsPerRegistry: 100,
              enableInventoryTracking: true,
              enableMultipleAddresses: true
            }
          }
        }
      });
      
      console.log(`✅ Initialized shop data for ${session.shop}`);
    }
  } catch (error) {
    console.error(`❌ Failed to initialize shop data:`, error);
  }
}

// Export authentication utilities
export const authenticate = shopify.authenticate;