/**
 * CORS Configuration and Utilities
 * Handles Cross-Origin Resource Sharing for Shopify embedded apps
 */

/**
 * Get CORS headers based on request origin
 */
export function getCORSHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = [
    "https://admin.shopify.com",
    /https:\/\/.*\.myshopify\.com$/,
    process.env.SHOPIFY_APP_URL
  ].filter(Boolean);

  const isAllowed = origin && allowedOrigins.some(allowed => 
    typeof allowed === 'string' 
      ? allowed === origin 
      : allowed?.test?.(origin)
  );

  if (isAllowed) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Access-Token",
      "Access-Control-Max-Age": "86400"
    };
  }

  return {};
}

/**
 * CORS configuration for middleware
 */
export const corsConfig = {
  origin: process.env.NODE_ENV === "production"
    ? ["https://admin.shopify.com", /^https:\/\/.*\.myshopify\.com$/]
    : ["https://localhost:3000"],
  credentials: true,
  optionsSuccessStatus: 200,
};

/**
 * Handle preflight OPTIONS requests
 */
export function handleCORSPreflight(request: Request): Response | null {
  if (request.method !== "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");
  const corsHeaders = getCORSHeaders(origin);

  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}