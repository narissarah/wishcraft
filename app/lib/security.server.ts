/**
 * Unified Security Module for WishCraft
 * Consolidates security headers, CORS, rate limiting, and security utilities
 * Implements comprehensive security for Shopify 2025 compliance
 */

import { json } from "@remix-run/node";
import { generateRandomBytes } from "~/lib/crypto.server";
import { log } from "~/lib/logger.server";
import { RATE_LIMITS as CENTRALIZED_RATE_LIMITS } from "~/lib/constants.server";

// ============================================
// Security Headers Configuration
// ============================================

export interface SecurityHeadersOptions {
  nonce?: string;
  shop?: string;
  development?: boolean;
}

/**
 * Generate security headers for responses
 */
export function getSecurityHeaders(requestOrOptions: Request | SecurityHeadersOptions = {}): Record<string, string> {
  let options: SecurityHeadersOptions = {};
  
  if (requestOrOptions instanceof Request) {
    // Extract options from Request
    const url = new URL(requestOrOptions.url);
    options = {
      shop: url.searchParams.get('shop') || undefined,
      development: process.env.NODE_ENV !== 'production'
    };
  } else {
    options = requestOrOptions;
  }
  const { nonce, shop, development = false } = options;
  
  const headers: Record<string, string> = {
    // Content Security Policy
    'Content-Security-Policy': generateCSP({ nonce, shop, development }),
    
    // Clickjacking protection - MANDATORY for Built for Shopify 2025
    'X-Frame-Options': shop ? `ALLOW-FROM https://${shop}.myshopify.com` : 'DENY',
    
    // Additional 2025 security headers
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=()',
    
    // Session token security headers (2025 requirement)
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Cross-Origin-Opener-Policy': 'same-origin',
    
    // Additional security headers
    'X-Permitted-Cross-Domain-Policies': 'none',
    'X-Download-Options': 'noopen',
    'Cache-Control': 'no-cache, no-store, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0',
    
    // HSTS (only in production)
    ...(development ? {} : {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    })
  };
  
  return headers;
}

function generateCSP({ nonce, shop, development }: SecurityHeadersOptions): string {
  // Enhanced CSP for 2025 compliance - removes 'unsafe-inline' and uses nonce-based approach
  const directives = [
    "default-src 'self'",
    // Script sources with nonce-based CSP (2025 compliant)
    `script-src 'self' ${nonce ? `'nonce-${nonce}'` : ''} https://cdn.shopify.com https://js.shopifycs.com 'strict-dynamic'`,
    // Style sources with nonce-based CSP (removes unsafe-inline)
    `style-src 'self' ${nonce ? `'nonce-${nonce}'` : ''} https://cdn.shopify.com https://fonts.googleapis.com`,
    // Font sources for Polaris and Google Fonts
    "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.shopify.com",
    // Image sources including Shopify CDN
    "img-src 'self' data: https: blob: https://*.shopifycdn.com",
    // Connect sources for GraphQL, API calls, and session tokens (2025 requirement)
    "connect-src 'self' https://*.myshopify.com https://*.shopifycs.com https://shopify.com wss://*.myshopify.com",
    // Frame sources for embedded app
    "frame-src 'self' https://*.myshopify.com https://admin.shopify.com",
    // Object and base restrictions
    "object-src 'none'",
    "base-uri 'self'",
    // Media sources
    "media-src 'self' https://*.shopifycdn.com",
    // Worker sources
    "worker-src 'self' blob:"
  ];
  
  // Frame ancestors for Shopify embedded apps
  if (shop) {
    // Frame ancestors for specific shop domain
    directives.push(`frame-ancestors 'self' https://${shop}.myshopify.com https://admin.shopify.com https://partners.shopify.com`);
  } else {
    // General frame ancestors for all Shopify domains
    directives.push("frame-ancestors 'self' https://*.myshopify.com https://admin.shopify.com https://partners.shopify.com");
  }
  
  if (development) {
    // Additional development sources
    directives[4] = "connect-src 'self' ws: wss: https://*.myshopify.com https://*.shopifycs.com wss://*.myshopify.com http://localhost:* https://localhost:*";
  }
  
  // Add CSP violation reporting
  directives.push("report-uri /api/csp-report");
  directives.push("report-to csp-endpoint");
  
  return directives.join('; ');
}

/**
 * Generate a cryptographic nonce for CSP
 */
export function generateNonce(): string {
  return generateRandomBytes(16).toString('base64');
}

// ============================================
// CORS Configuration
// ============================================

/**
 * Get CORS headers based on request origin - Strengthened for 2025 security
 */
export function getCORSHeaders(origin: string | null): Record<string, string> {
  // Enhanced security: Validate origin format and prevent bypass attempts
  if (!origin || typeof origin !== 'string') {
    return {};
  }

  // Prevent null origin bypass attacks
  if (origin === 'null') {
    return {};
  }

  // Stricter origin validation with explicit checks
  const allowedOrigins = [
    "https://admin.shopify.com",
    "https://partners.shopify.com",
    process.env.SHOPIFY_APP_URL
  ].filter(Boolean);

  // Enhanced myshopify.com validation to prevent subdomain takeover
  const myshopifyPattern = /^https:\/\/[a-zA-Z0-9-]+\.myshopify\.com$/;
  
  let isAllowed = false;

  // Check explicit allowed origins
  if (allowedOrigins.includes(origin)) {
    isAllowed = true;
  }

  // Check myshopify.com pattern with strict validation
  if (!isAllowed && myshopifyPattern.test(origin)) {
    // Additional validation: ensure no double dots or suspicious patterns
    const hostname = new URL(origin).hostname;
    if (!hostname.includes('..') && !hostname.startsWith('-') && !hostname.endsWith('-')) {
      isAllowed = true;
    }
  }

  // Development environment allowances
  if (!isAllowed && process.env.NODE_ENV !== 'production') {
    const devOrigins = [
      "http://localhost:3000",
      "https://localhost:3000",
      "http://127.0.0.1:3000",
      "https://127.0.0.1:3000"
    ];
    if (devOrigins.includes(origin)) {
      isAllowed = true;
    }
  }

  if (isAllowed) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      // Restricted methods - only allow necessary ones
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      // Restricted headers - explicitly list allowed headers
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Access-Token, X-Shopify-Shop-Domain, X-Requested-With",
      // Shorter cache time for better security
      "Access-Control-Max-Age": "3600", // 1 hour instead of 24 hours
      // Security headers
      "Vary": "Origin",
      "X-Content-Type-Options": "nosniff"
    };
  }

  // Log potentially malicious CORS attempts
  if (process.env.NODE_ENV === 'production') {
    log.warn('Blocked CORS request from unauthorized origin', { origin });
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
 * Handle preflight OPTIONS requests with enhanced validation
 */
export function handleCORSPreflight(request: Request): Response | null {
  if (request.method !== "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");
  const requestedMethod = request.headers.get("access-control-request-method");
  const requestedHeaders = request.headers.get("access-control-request-headers");

  // Enhanced preflight validation
  const corsHeaders = getCORSHeaders(origin);
  
  // If origin not allowed, return empty response
  if (Object.keys(corsHeaders).length === 0) {
    return new Response(null, {
      status: 403,
      statusText: "Forbidden"
    });
  }

  // Validate requested method
  const allowedMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"];
  if (requestedMethod && !allowedMethods.includes(requestedMethod)) {
    return new Response(null, {
      status: 405,
      statusText: "Method Not Allowed"
    });
  }

  // Validate requested headers
  const allowedHeaders = [
    "content-type",
    "authorization", 
    "x-shopify-access-token",
    "x-shopify-shop-domain",
    "x-requested-with"
  ];
  
  if (requestedHeaders) {
    const headers = requestedHeaders.toLowerCase().split(',').map(h => h.trim());
    const invalidHeaders = headers.filter(h => !allowedHeaders.includes(h));
    
    if (invalidHeaders.length > 0) {
      log.warn('Invalid preflight headers requested', { 
        origin, 
        invalidHeaders,
        requestedHeaders 
      });
      return new Response(null, {
        status: 400,
        statusText: "Bad Request"
      });
    }
  }

  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      // Additional security headers for preflight
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    }
  });
}

/**
 * Advanced CORS security validation - 2025 compliance
 */
export function validateCORSRequest(request: Request): {
  isValid: boolean;
  reason?: string;
  shouldBlock?: boolean;
} {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const userAgent = request.headers.get("user-agent");

  // Check for suspicious patterns
  if (origin) {
    // Block localhost origins in production (except from our dev setup)
    if (process.env.NODE_ENV === 'production' && 
        (origin.includes('localhost') || origin.includes('127.0.0.1')) &&
        !origin.includes('3000')) {
      return { isValid: false, reason: 'Localhost origin in production', shouldBlock: true };
    }

    // Check for suspicious TLDs or patterns that could indicate attacks
    const suspiciousPatterns = [
      /\.tk$/,     // Common in malicious domains
      /\.ml$/,     // Free domains often abused
      /\.cf$/,     // CloudFlare free domains sometimes abused
      /\.ga$/,     // Free domains
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // Raw IP addresses (suspicious for web origins)
      /[а-я]/,     // Cyrillic characters (potential IDN attack)
      /[\u4e00-\u9fff]/, // Chinese characters (potential IDN attack)
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(origin))) {
      return { isValid: false, reason: 'Suspicious origin pattern detected', shouldBlock: true };
    }

    // Validate URL structure
    try {
      const url = new URL(origin);
      
      // Must be HTTPS in production (security requirement)
      if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
        return { isValid: false, reason: 'Non-HTTPS origin in production', shouldBlock: true };
      }

      // Check for suspicious ports that might indicate proxy/tunnel
      const suspiciousPorts = ['8080', '8000', '9000', '1337', '31337', '4444', '5555'];
      if (url.port && suspiciousPorts.includes(url.port)) {
        return { isValid: false, reason: 'Suspicious port detected', shouldBlock: true };
      }

    } catch (error) {
      return { isValid: false, reason: 'Invalid origin URL format', shouldBlock: true };
    }
  }

  // Cross-check origin and referer for additional security validation
  if (origin && referer && process.env.NODE_ENV === 'production') {
    try {
      const originHost = new URL(origin).hostname;
      const refererHost = new URL(referer).hostname;
      
      // They should match or be closely related
      if (originHost !== refererHost && !refererHost.includes(originHost) && !originHost.includes('shopify')) {
        log.warn('Potential CORS attack: Origin/Referer mismatch', { origin, referer });
        // Log but don't block (could be legitimate iframe usage)
      }
    } catch (error) {
      log.debug('Could not validate origin/referer match due to URL parsing error', { origin, referer });
    }
  }

  // Check for bot/crawler user agents making CORS requests (often malicious)
  if (userAgent) {
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i, /curl/i, /wget/i, /python/i, /php/i
    ];
    
    if (botPatterns.some(pattern => pattern.test(userAgent)) && request.method !== 'GET') {
      log.warn('Suspicious bot making non-GET CORS request', { userAgent, method: request.method });
      return { isValid: false, reason: 'Bot making non-GET CORS request', shouldBlock: false };
    }
  }

  return { isValid: true };
}

// ============================================
// Combined Security Utilities
// ============================================

/**
 * Apply all security headers to a response
 */
export function applySecurityHeaders(response: Response, options?: SecurityHeadersOptions): Response {
  const headers = getSecurityHeaders(options);
  
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * Create a secure response with all headers applied
 */
export function createSecureResponse(
  body: any,
  init?: ResponseInit,
  options?: SecurityHeadersOptions
): Response {
  const response = new Response(body, init);
  return applySecurityHeaders(response, options);
}

/**
 * Comprehensive CORS middleware with enhanced security validation
 */
export function handleCORSRequest(request: Request): Response | null {
  // First validate the request for security threats
  const validation = validateCORSRequest(request);
  
  if (!validation.isValid && validation.shouldBlock) {
    log.warn('Blocked CORS request due to security validation', {
      reason: validation.reason,
      origin: request.headers.get("origin"),
      userAgent: request.headers.get("user-agent"),
      ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")
    });
    
    return new Response("Forbidden", {
      status: 403,
      statusText: "Forbidden",
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      }
    });
  }

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    return handleCORSPreflight(request);
  }

  // For actual requests, validate origin and add CORS headers if needed
  const origin = request.headers.get("origin");
  if (origin) {
    const corsHeaders = getCORSHeaders(origin);
    
    if (Object.keys(corsHeaders).length > 0) {
      // Origin is allowed, CORS headers will be added in the response
      return null; // Allow request to proceed
    } else {
      // Origin not allowed - enhanced logging for security monitoring
      log.warn('CORS request blocked: unauthorized origin', { 
        origin, 
        method: request.method,
        userAgent: request.headers.get("user-agent"),
        referer: request.headers.get("referer"),
        ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")
      });
      
      return new Response("Forbidden - Origin not allowed", {
        status: 403,
        statusText: "Forbidden",
        headers: {
          "Content-Type": "text/plain",
          "Cache-Control": "no-cache, no-store, must-revalidate"
        }
      });
    }
  }

  // No origin header, allow request (same-origin or non-CORS request)
  return null;
}

// ============================================
// Rate Limiting System
// ============================================

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
}

// Use centralized rate limits with legacy mapping for compatibility
export const RATE_LIMITS = {
  public: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: "Too many requests, please try again later"
  },
  api: CENTRALIZED_RATE_LIMITS.API_GENERAL,
  auth: CENTRALIZED_RATE_LIMITS.AUTH
};

// In-memory storage for rate limit tracking
const requestCounts = new Map<string, { count: number; resetAt: number }>();

// Cleanup old entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, data] of requestCounts.entries()) {
      if (now > data.resetAt) {
        requestCounts.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      log.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
    
    // Prevent memory leak
    const MAX_ENTRIES = 10000;
    if (requestCounts.size > MAX_ENTRIES) {
      const entries = Array.from(requestCounts.entries())
        .sort((a, b) => a[1].resetAt - b[1].resetAt);
      
      const toRemove = entries.slice(0, Math.floor(MAX_ENTRIES / 2));
      toRemove.forEach(([key]) => requestCounts.delete(key));
      
      log.warn(`Removed ${toRemove.length} oldest rate limit entries to prevent memory leak`);
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

export function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get("x-forwarded-for");
  const real = request.headers.get("x-real-ip");
  const ip = forwarded?.split(',')[0] || real || "unknown";
  
  // Add user agent to make it harder to bypass
  const userAgent = request.headers.get("user-agent") || "unknown";
  
  return `${ip}:${userAgent}`;
}

export function rateLimitMiddleware(config: RateLimitConfig) {
  return async function(request: Request) {
    const identifier = getClientIdentifier(request);
    const now = Date.now();
    
    let rateLimitData = requestCounts.get(identifier);
    
    if (!rateLimitData || now > rateLimitData.resetAt) {
      rateLimitData = {
        count: 0,
        resetAt: now + config.windowMs
      };
    }
    
    rateLimitData.count++;
    requestCounts.set(identifier, rateLimitData);
    
    if (rateLimitData.count > config.max) {
      const retryAfter = Math.ceil((rateLimitData.resetAt - now) / 1000);
      
      log.warn(`Rate limit exceeded for ${identifier}`, {
        count: rateLimitData.count,
        max: config.max,
        retryAfter
      });
      
      return json(
        { error: config.message || "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": config.max.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimitData.resetAt.toString()
          }
        }
      );
    }
    
    // Return null to indicate request should proceed
    return null;
  };
}

export async function checkRateLimit(
  request: Request,
  config: RateLimitConfig = RATE_LIMITS.api
): Promise<Response | null> {
  return rateLimitMiddleware(config)(request);
}

// Export rateLimiter object for compatibility
export const rateLimiter = {
  check: async (request: Request, config: RateLimitConfig = RATE_LIMITS.api) => {
    const response = await checkRateLimit(request, config);
    if (response) {
      return { allowed: false, response };
    }
    return { allowed: true };
  }
};