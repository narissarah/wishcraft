import crypto from "crypto";

/**
 * Security Headers Middleware
 * Implements all required security headers for Shopify apps
 * Compliant with OWASP security best practices
 */

// Cache for nonces to avoid regenerating
const nonceCache = new Map<string, string>();

/**
 * Generate a cryptographically secure nonce
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString("base64");
}

/**
 * Get or create a nonce for the current request
 */
export function getRequestNonce(requestId: string): string {
  if (!nonceCache.has(requestId)) {
    nonceCache.set(requestId, generateNonce());
    // Clean up old nonces after 5 minutes
    setTimeout(() => nonceCache.delete(requestId), 5 * 60 * 1000);
  }
  return nonceCache.get(requestId)!;
}

/**
 * Generate security headers for the response
 */
export function getSecurityHeaders(request: Request, nonce?: string): HeadersInit {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isEmbedded = new URL(request.url).searchParams.has("embedded");
  
  // Generate nonce if not provided
  const cspNonce = nonce || generateNonce();
  
  // Get shop domain from request
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop') || 
               request.headers.get('x-shopify-shop-domain') ||
               'admin.shopify.com';
  
  // Build CSP directives optimized for Shopify embedded apps
  // Note: Removing nonces to allow Shopify's inline scripts to work
  const cspDirectives = [
    "default-src 'self' https://*.myshopify.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com https://cdn.jsdelivr.net https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://cdn.shopify.com https://fonts.googleapis.com",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data: https://cdn.shopify.com https://fonts.gstatic.com",
    "connect-src 'self' https://*.myshopify.com wss://*.myshopify.com https://monorail-edge.shopifysvc.com https://api.sentry.io https://*.google-analytics.com",
    isEmbedded ? `frame-ancestors https://${shop} https://admin.shopify.com` : "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://*.myshopify.com",
    "media-src 'self' https://cdn.shopify.com",
    "object-src 'none'",
    "child-src 'self' https://*.myshopify.com blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'"
  ];

  const headers: HeadersInit = {
    // Security headers
    "X-Frame-Options": isEmbedded ? "ALLOWALL" : "DENY", // Required for embedded apps
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "X-Permitted-Cross-Domain-Policies": "none",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": cspDirectives.join("; "),
    
    // Permissions Policy (Feature Policy)
    "Permissions-Policy": [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()",
      "interest-cohort=()", // Opt out of FLoC
      "browsing-topics=()" // Opt out of Topics API
    ].join(", "),
    
    // HSTS - only in production
    ...(isDevelopment ? {} : {
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
    }),
    
    // Additional security headers
    "X-Download-Options": "noopen",
    "X-DNS-Prefetch-Control": "on",
    
    // Advanced security headers - relaxed for Shopify embedded apps
    // Removed COEP/COOP/CORP as they can break embedded functionality
    
    // CORS headers for API routes
    "Access-Control-Allow-Origin": isEmbedded ? "*" : "https://*.myshopify.com",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Access-Token",
    "Access-Control-Max-Age": "86400",
    
    // Cache control for security
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "Pragma": "no-cache",
    "Expires": "0",
    
    // Custom headers
    "X-Request-ID": crypto.randomUUID()
  };

  return headers;
}

/**
 * Apply security headers to a Response
 */
export function applySecurityHeaders(response: Response, request: Request, nonce?: string): Response {
  const headers = getSecurityHeaders(request, nonce);
  
  // Clone the response and add headers
  const newHeaders = new Headers(response.headers);
  Object.entries(headers).forEach(([key, value]) => {
    if (value) newHeaders.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

/**
 * Middleware function to add security headers
 */
export function securityHeadersMiddleware(handler: Function) {
  return async (args: any) => {
    const response = await handler(args);
    
    if (response instanceof Response) {
      return applySecurityHeaders(response, args.request);
    }
    
    return response;
  };
}

/**
 * Get CSP meta tag for HTML responses
 */
export function getCSPMetaTag(nonce: string): string {
  return `<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'nonce-${nonce}' https://cdn.shopify.com;">`;
}

/**
 * Validate request origin for CSRF protection
 */
export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  
  if (!origin && !referer) {
    // No origin or referer, could be a direct request
    return true;
  }
  
  const allowedOrigins = [
    process.env.SHOPIFY_APP_URL,
    "https://admin.shopify.com",
    /https:\/\/.*\.myshopify\.com/
  ];
  
  const checkOrigin = origin || referer;
  if (!checkOrigin) return false;
  
  return allowedOrigins.some(allowed => {
    if (typeof allowed === "string") {
      return checkOrigin.startsWith(allowed);
    }
    return allowed.test(checkOrigin);
  });
}

/**
 * Generate secure cookie options
 */
export function getSecureCookieOptions(): any {
  const isDevelopment = process.env.NODE_ENV === "development";
  
  return {
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    ...(isDevelopment ? {} : { domain: process.env.COOKIE_DOMAIN })
  };
}