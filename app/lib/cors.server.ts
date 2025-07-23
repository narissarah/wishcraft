/**
 * CORS configuration for WishCraft
 * Simple CORS handling for Shopify apps
 */

/**
 * Get CORS headers for Shopify origins
 */
export function getCORSHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};

  // Check if origin is from Shopify
  const isShopifyOrigin = 
    origin.endsWith('.myshopify.com') ||
    origin === 'https://admin.shopify.com' ||
    origin === 'https://partners.shopify.com' ||
    origin === process.env.SHOPIFY_APP_URL;

  // Allow localhost in development
  const isLocalDev = process.env.NODE_ENV !== 'production' && 
    (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:'));

  if (isShopifyOrigin || isLocalDev) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Access-Token",
      "Access-Control-Max-Age": "3600",
    };
  }

  return {};
}