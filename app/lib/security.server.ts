import type { HeadersFunction } from "@remix-run/node";

/**
 * Production Security Headers Configuration
 * Implements comprehensive security headers for 100/100 Shopify score
 */

export const securityHeaders: HeadersFunction = () => {
  const isDevelopment = process.env.NODE_ENV !== "production";
  
  return {
    // Strict Transport Security
    "Strict-Transport-Security": isDevelopment 
      ? "max-age=0" 
      : "max-age=31536000; includeSubDomains; preload",
    
    // Content Security Policy - Shopify compliant
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com https://*.myshopify.com",
      "style-src 'self' 'unsafe-inline' https://cdn.shopify.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://cdn.shopify.com",
      "connect-src 'self' https://*.myshopify.com wss://*.myshopify.com https://cdn.shopify.com",
      "frame-src 'self' https://*.myshopify.com",
      "frame-ancestors https://admin.shopify.com https://*.myshopify.com",
      "base-uri 'self'",
      "form-action 'self' https://*.myshopify.com",
      "object-src 'none'",
      "upgrade-insecure-requests"
    ].join("; "),
    
    // Prevent XSS attacks
    "X-XSS-Protection": "1; mode=block",
    
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",
    
    // Control referrer information
    "Referrer-Policy": "strict-origin-when-cross-origin",
    
    // Permissions Policy (formerly Feature Policy)
    "Permissions-Policy": [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=(self)",
      "picture-in-picture=()",
      "sync-xhr=()",
      "usb=()",
      "xr-spatial-tracking=()"
    ].join(", "),
    
    // Prevent clickjacking
    "X-Frame-Options": "ALLOW-FROM https://admin.shopify.com",
    
    // Cache control for security
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    
    // Additional security headers
    "X-Permitted-Cross-Domain-Policies": "none",
    "X-DNS-Prefetch-Control": "off",
    "X-Download-Options": "noopen",
  };
};

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
      : ["http://localhost:3000"],
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
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, "") // Remove event handlers
    .trim();
}

/**
 * Generate secure random tokens
 */
export function generateSecureToken(length: number = 32): string {
  const crypto = require("crypto");
  return crypto.randomBytes(length).toString("base64url");
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