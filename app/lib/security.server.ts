import type { HeadersFunction } from "@remix-run/node";
import crypto from "crypto";

/**
 * Enhanced Security Module for Shopify 2025 Compliance
 * Combines comprehensive security headers, utilities, and configurations
 */

/**
 * Enhanced Security Headers for Shopify 2025 Compliance
 * Implements comprehensive security measures for 100/100 Shopify score
 */
export const securityHeaders: HeadersFunction = ({ request }: any) => {
  const isDevelopment = process.env.NODE_ENV !== "production";
  
  // Get the shop domain from the request for dynamic CSP
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop") || "";
  
  // Base security headers
  const headers: Record<string, string> = {
    // Strict Transport Security (HSTS)
    "Strict-Transport-Security": isDevelopment 
      ? "max-age=0" 
      : "max-age=31536000; includeSubDomains; preload",
    
    // Prevent XSS attacks
    "X-XSS-Protection": "1; mode=block",
    
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",
    
    // Control referrer information
    "Referrer-Policy": "strict-origin-when-cross-origin",
    
    // DNS prefetch control
    "X-DNS-Prefetch-Control": "on",
    
    // Prevent clickjacking for non-embedded contexts
    "X-Frame-Options": "SAMEORIGIN",
    
    // Additional security headers
    "X-Permitted-Cross-Domain-Policies": "none",
    "X-Download-Options": "noopen",
    
    // Report API endpoints for security monitoring
    "Report-To": JSON.stringify({
      group: "default",
      max_age: 86400,
      endpoints: [{ url: "/api/security-reports" }],
      include_subdomains: true
    }),
    
    // Network Error Logging
    "NEL": JSON.stringify({
      report_to: "default",
      max_age: 86400,
      include_subdomains: true
    })
  };

  // Content Security Policy - Dynamic for Shopify 2025
  const cspDirectives = [
    "default-src 'self'",
    
    // Script sources - Secure CSP for Shopify App Bridge and embedded apps
    // SECURITY FIX: Removed 'unsafe-eval' and 'unsafe-inline' to prevent code injection attacks
    "script-src 'self' " +
      "https://cdn.shopify.com https://*.shopifycdn.com " +
      "https://admin.shopify.com https://*.myshopify.com " +
      `'nonce-${crypto.randomBytes(16).toString('base64')}' ` +
      (shopDomain ? `https://${shopDomain}` : ""),
    
    // Style sources - Required for Polaris and Shopify styles
    "style-src 'self' 'unsafe-inline' " +
      "https://cdn.shopify.com https://*.shopifycdn.com " +
      "https://fonts.googleapis.com",
    
    // Image sources
    "img-src 'self' data: blob: https: " +
      "https://cdn.shopify.com https://*.shopifycdn.com " +
      "https://*.shopify.com https://*.myshopify.com",
    
    // Font sources
    "font-src 'self' data: " +
      "https://cdn.shopify.com https://*.shopifycdn.com " +
      "https://fonts.gstatic.com",
    
    // Connection sources - WebSocket support for real-time features
    "connect-src 'self' " +
      "https://*.myshopify.com wss://*.myshopify.com " +
      "https://cdn.shopify.com https://*.shopifycdn.com " +
      "https://admin.shopify.com " +
      (process.env.SENTRY_DSN ? "https://sentry.io https://*.ingest.sentry.io" : ""),
    
    // Frame sources - Required for Shopify embedded apps
    "frame-src 'self' " +
      "https://admin.shopify.com https://*.myshopify.com " +
      (shopDomain ? `https://${shopDomain}` : ""),
    
    // Frame ancestors - Critical for embedded app functionality
    "frame-ancestors " +
      "https://admin.shopify.com https://*.myshopify.com " +
      (shopDomain ? `https://${shopDomain}` : "'none'"),
    
    // Form action
    "form-action 'self' https://*.myshopify.com",
    
    // Base URI
    "base-uri 'self'",
    
    // Object sources
    "object-src 'none'",
    
    // Media sources
    "media-src 'self' blob: data:",
    
    // Worker sources
    "worker-src 'self' blob:",
    
    // Manifest source
    "manifest-src 'self'",
    
    // Upgrade insecure requests in production
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
    
    // Report violations
    "report-uri /api/csp-reports",
    "report-to default"
  ];

  headers["Content-Security-Policy"] = cspDirectives.join("; ");

  // Permissions Policy (Enhanced for 2025)
  const permissionsPolicy = [
    "accelerometer=()",
    "ambient-light-sensor=()",
    "autoplay=()",
    "battery=()",
    "camera=()",
    "cross-origin-isolated=()",
    "display-capture=()",
    "document-domain=()",
    "encrypted-media=()",
    "execution-while-not-rendered=()",
    "execution-while-out-of-viewport=()",
    "fullscreen=(self)",
    "geolocation=()",
    "gyroscope=()",
    "keyboard-map=()",
    "magnetometer=()",
    "microphone=()",
    "midi=()",
    "navigation-override=()",
    "payment=(self)",
    "picture-in-picture=()",
    "publickey-credentials-get=()",
    "screen-wake-lock=()",
    "sync-xhr=()",
    "usb=()",
    "web-share=()",
    "xr-spatial-tracking=()",
    "clipboard-read=(self)",
    "clipboard-write=(self)",
    "gamepad=()",
    "speaker-selection=()",
    "conversion-measurement=()",
    "focus-without-user-activation=()",
    "hid=()",
    "idle-detection=()",
    "interest-cohort=()",
    "serial=()",
    "sync-script=()",
    "trust-token-redemption=()",
    "window-placement=()",
    "vertical-scroll=(self)"
  ];

  headers["Permissions-Policy"] = permissionsPolicy.join(", ");

  // Additional security headers for 2025
  headers["Cross-Origin-Embedder-Policy"] = "unsafe-none"; // Required for Shopify embedded apps
  headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"; // Allow OAuth popups
  headers["Cross-Origin-Resource-Policy"] = "cross-origin"; // Allow Shopify to load resources
  
  // Cache control for security
  headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
  headers["Pragma"] = "no-cache";
  headers["Expires"] = "0";

  return headers;
};

/**
 * Security headers for API routes
 */
export const apiSecurityHeaders: HeadersFunction = () => ({
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "Pragma": "no-cache",
  "Expires": "0"
});

/**
 * Apply security headers to a Response
 */
export function applySecurityHeaders(response: Response): Response {
  const headers = securityHeaders({} as any);
  
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * CORS headers for API routes
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
 * Security middleware configuration
 */
export const securityConfig = {
  // Session configuration
  session: {
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
  },
  
  // CORS configuration
  cors: {
    origin: process.env.NODE_ENV === "production"
      ? ["https://admin.shopify.com", /^https:\/\/.*\.myshopify\.com$/]
      : ["https://localhost:3000"],
    credentials: true,
    optionsSuccessStatus: 200,
  },
  
  // Rate limiting defaults
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // File upload limits
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
    ],
  },
};

/**
 * Get CSP nonce for inline scripts (if needed)
 */
export function generateCSPNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Generate secure random tokens
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("base64url");
}

/**
 * Validate request origin for CSRF protection
 */
export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  
  if (!origin && !referer) {
    return false;
  }
  
  const allowedOrigins = [
    process.env.SHOPIFY_APP_URL,
    "https://admin.shopify.com",
    /^https:\/\/.*\.myshopify\.com$/,
  ].filter(Boolean) as (string | RegExp)[];
  
  const requestOrigin = origin || new URL(referer!).origin;
  
  return allowedOrigins.some(allowed => {
    if (typeof allowed === "string") {
      return requestOrigin === allowed;
    }
    return allowed.test(requestOrigin);
  });
}

/**
 * Sanitize user input to prevent XSS
 * DEPRECATED: Use sanitizeInput from sanitization-unified.server.ts instead
 */
export function sanitizeInput(input: string): string {
  const { sanitizeInput: unifiedSanitizeInput } = require('./sanitization-unified.server');
  return unifiedSanitizeInput(input);
}

/**
 * Validate Shopify domain
 */
export function isValidShopDomain(shop: string): boolean {
  const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  return shopRegex.test(shop);
}

/**
 * Security audit log helper
 */
export async function logSecurityEvent(
  event: string,
  details: Record<string, any>,
  request: Request
) {
  const { log } = await import("~/lib/logger.server");
  
  log.security(event, {
    ...details,
    ip: request.headers.get("x-forwarded-for") || "unknown",
    userAgent: request.headers.get("user-agent"),
    timestamp: new Date().toISOString(),
  });
}