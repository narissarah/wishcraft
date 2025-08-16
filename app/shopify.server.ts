import { shopifyApp, DeliveryMethod, ApiVersion } from "@shopify/shopify-app-remix/server";
import { sessionStorage } from "~/lib/session-storage.server";

// Lazy initialization to prevent serverless crashes
let shopifyInstance: ReturnType<typeof shopifyApp> | null = null;

function getShopifyApp() {
  if (!shopifyInstance) {
    // Validate required environment variables
    const apiKey = process.env['SHOPIFY_API_KEY'];
    const apiSecretKey = process.env['SHOPIFY_API_SECRET'];
    const appUrl = process.env['SHOPIFY_APP_URL'];
    
    if (!apiKey) {
      throw new Error('SHOPIFY_API_KEY environment variable is required');
    }
    if (!apiSecretKey) {
      throw new Error('SHOPIFY_API_SECRET environment variable is required');
    }
    if (!appUrl) {
      throw new Error('SHOPIFY_APP_URL environment variable is required');
    }
    
    shopifyInstance = shopifyApp({
      apiKey,
      apiSecretKey,
      
      scopes: process.env['SHOPIFY_SCOPES']?.split(",") || [
        "read_customers",
        "read_products",
        "read_orders",
        "write_orders",
        "read_inventory"
      ],
      
      appUrl,
      authPathPrefix: "/auth",
      sessionStorage,
      apiVersion: ApiVersion.October24,
      
      isEmbeddedApp: true,
      useOnlineTokens: true,
      
      // Temporarily disable new auth strategy to fix login issues
      // future: {
      //   unstable_newEmbeddedAuthStrategy: true,
      // },
      
      webhooks: {
        APP_UNINSTALLED: {
          deliveryMethod: DeliveryMethod.Http,
          callbackUrl: "/webhooks/app/uninstalled",
        },
        CUSTOMERS_DATA_REQUEST: {
          deliveryMethod: DeliveryMethod.Http,
          callbackUrl: "/webhooks/customers/data_request",
        },
        CUSTOMERS_REDACT: {
          deliveryMethod: DeliveryMethod.Http,
          callbackUrl: "/webhooks/customers/redact",
        },
        SHOP_REDACT: {
          deliveryMethod: DeliveryMethod.Http,
          callbackUrl: "/webhooks/shop/redact",
        },
      },
    });
  }
  
  return shopifyInstance;
}

// Export getter functions that ensure lazy initialization
export function getShopify() {
  return getShopifyApp();
}

export const shopify = new Proxy({} as ReturnType<typeof shopifyApp>, {
  get(_target, prop) {
    try {
      const app = getShopify();
      return Reflect.get(app, prop);
    } catch (error) {
      // Note: Cannot use log here to avoid circular imports
      throw error;
    }
  }
});

export const authenticate = new Proxy({} as typeof shopify.authenticate, {
  get(_target, prop) {
    try {
      const app = getShopify();
      return Reflect.get(app.authenticate, prop);
    } catch (error) {
      // Note: Cannot use log here to avoid circular imports
      throw error;
    }
  }
});

export const unauthenticated = new Proxy({} as typeof shopify.unauthenticated, {
  get(_target, prop) {
    try {
      const app = getShopify();
      return Reflect.get(app.unauthenticated, prop);
    } catch (error) {
      // Note: Cannot use log here to avoid circular imports
      throw error;
    }
  }
});

export function login(request: Request) {
  try {
    const app = getShopify();
    return app.login(request);
  } catch (error) {
    // Note: Cannot use log here to avoid circular imports
    throw error;
  }
}