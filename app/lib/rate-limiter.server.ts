import { log } from "~/lib/logger.server";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Rate limiter middleware for API endpoints
 * Built for Shopify compliance requirement
 */
export async function rateLimit(
  request: Request,
  config: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  }
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const identifier = getRateLimitIdentifier(request);
  const now = Date.now();
  
  let entry = rateLimitStore.get(identifier);
  
  if (!entry || entry.resetTime < now) {
    // Create new entry
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(identifier, entry);
  }
  
  entry.count++;
  
  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  
  if (!allowed) {
    log.warn('Rate limit exceeded', {
      identifier,
      count: entry.count,
      maxRequests: config.maxRequests,
      endpoint: new URL(request.url).pathname,
    });
  }
  
  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
  };
}

/**
 * Get rate limit identifier from request
 */
function getRateLimitIdentifier(request: Request): string {
  // Try to get shop domain first
  const shopDomain = request.headers.get('X-Shop-Domain');
  if (shopDomain) {
    return `shop:${shopDomain}`;
  }
  
  // Fall back to IP address
  const forwardedFor = request.headers.get('X-Forwarded-For');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
  
  return `ip:${ip}`;
}

/**
 * Create rate limit headers
 */
export function getRateLimitHeaders(result: { 
  allowed: boolean; 
  remaining: number; 
  resetTime: number;
}): HeadersInit {
  return {
    'X-RateLimit-Limit': '60',
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetTime.toString(),
    'Retry-After': result.allowed ? undefined : Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
  } as HeadersInit;
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMIT_CONFIGS = {
  // Strict limit for auth endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts',
  },
  
  // Standard API limit
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    message: 'Too many requests',
  },
  
  // Relaxed limit for read operations
  read: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120,
    message: 'Too many requests',
  },
  
  // Strict limit for write operations
  write: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    message: 'Too many write requests',
  },
  
  // Very strict limit for webhooks
  webhook: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Too many webhook requests',
  },
} as const;