import { shopifyApp, DeliveryMethod, ApiVersion } from "@shopify/shopify-app-remix/server";
import { sessionStorage } from "~/lib/session-storage.server";

export const shopify = shopifyApp({
  apiKey: process.env['SHOPIFY_API_KEY']!,
  apiSecretKey: process.env['SHOPIFY_API_SECRET']!,
  
  scopes: process.env['SHOPIFY_SCOPES']?.split(",") || [
    "read_customers",
    "read_products",
    "read_orders",
    "write_orders",
    "read_inventory"
  ],
  
  appUrl: process.env['SHOPIFY_APP_URL']!,
  authPathPrefix: "/auth",
  sessionStorage,
  apiVersion: ApiVersion.July25,
  
  isEmbeddedApp: true,
  useOnlineTokens: true,
  
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

export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;