import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const results = {
    url: request.url,
    env: {
      SHOPIFY_API_KEY: !!process.env.SHOPIFY_API_KEY,
      SHOPIFY_API_SECRET: !!process.env.SHOPIFY_API_SECRET,
      SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL || 'NOT SET',
      NODE_ENV: process.env.NODE_ENV
    },
    initialization: {
      shopifyModule: null as any,
      error: null as any
    }
  };
  
  // Test Shopify module initialization
  try {
    const shopifyModule = await import("~/shopify.server");
    results.initialization.shopifyModule = {
      exports: Object.keys(shopifyModule),
      hasShopify: !!shopifyModule.shopify,
      hasAuthenticate: !!shopifyModule.authenticate,
      hasLogin: !!shopifyModule.login,
      hasGetShopify: !!shopifyModule.getShopify
    };
  } catch (error: any) {
    results.initialization.error = {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5)
    };
  }
  
  return json(results);
}