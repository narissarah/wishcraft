import type { HeadersFunction } from "@remix-run/node";
import crypto from "crypto";
import { getSecurityHeaders, generateNonce } from "./security-headers.server";
import { sanitizeInput as unifiedSanitizeInput } from "./sanitization-unified.server";

/**
 * Enhanced Security Module for Shopify 2025 Compliance
 * Combines comprehensive security headers, utilities, and configurations
 * 
 * IMPORTANT: CSP implementation has been moved to security-headers.server.ts
 * This file now contains only non-CSP security utilities
 */

/**
 * @deprecated Use getSecurityHeaders from security-headers.server.ts instead
 */
export const securityHeaders: HeadersFunction = ({ request }: any) => {
  // Redirect to the unified implementation
  return getSecurityHeaders(request);
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
  const headers = getSecurityHeaders({} as any);
  
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
 * @deprecated Use generateNonce from security-headers.server.ts instead
 */
export function generateCSPNonce(): string {
  return generateNonce();
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