import { LRUCache } from "lru-cache";
import crypto from "crypto";

/**
 * Rate Limiting Implementation
 * Compliant with Shopify API rate limits and security best practices
 */

// Types
export interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds
  max?: number; // Max requests per window
  message?: string; // Error message
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (request: Request) => string;
  handler?: (request: Request, response: Response) => void | Promise<void>;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

// Default rate limit configurations
export const RATE_LIMITS = {
  // API endpoints
  api: { windowMs: 60 * 1000, max: 100 }, // 100 requests per minute
  graphql: { windowMs: 60 * 1000, max: 1000 }, // 1000 points per minute (Shopify limit)
  
  // Auth endpoints
  login: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 attempts per 15 minutes
  register: { windowMs: 60 * 60 * 1000, max: 3 }, // 3 attempts per hour
  
  // Public endpoints
  public: { windowMs: 60 * 1000, max: 60 }, // 60 requests per minute
  webhook: { windowMs: 1000, max: 10 }, // 10 requests per second
  
  // Admin endpoints
  admin: { windowMs: 60 * 1000, max: 200 }, // 200 requests per minute
  
  // Heavy operations
  export: { windowMs: 60 * 60 * 1000, max: 10 }, // 10 exports per hour
  import: { windowMs: 60 * 60 * 1000, max: 5 }, // 5 imports per hour
} as const;

// LRU cache for storing rate limit data
const rateLimitStore = new LRUCache<string, number[]>({
  max: 10000, // Store up to 10k unique keys
  ttl: 60 * 60 * 1000, // 1 hour TTL
});

/**
 * Generate a unique key for rate limiting
 */
function generateKey(request: Request, keyGenerator?: (req: Request) => string): string {
  if (keyGenerator) {
    return keyGenerator(request);
  }
  
  // Default key generation based on IP + route
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || 
             request.headers.get("x-real-ip") || 
             "unknown";
  const url = new URL(request.url);
  const route = url.pathname;
  
  return crypto
    .createHash("sha256")
    .update(`${ip}:${route}`)
    .digest("hex");
}

/**
 * Check if request should be rate limited
 */
export async function checkRateLimit(
  request: Request,
  options: RateLimitOptions = {}
): Promise<RateLimitInfo | null> {
  const {
    windowMs = 60 * 1000,
    max = 100,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator
  } = options;
  
  const key = generateKey(request, keyGenerator);
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Get existing timestamps for this key
  let timestamps = rateLimitStore.get(key) || [];
  
  // Remove old timestamps outside the window
  timestamps = timestamps.filter(timestamp => timestamp > windowStart);
  
  // Check if limit exceeded
  if (timestamps.length >= max) {
    const oldestTimestamp = Math.min(...timestamps);
    const resetTime = new Date(oldestTimestamp + windowMs);
    
    return {
      limit: max,
      remaining: 0,
      reset: resetTime,
      retryAfter: Math.ceil((resetTime.getTime() - now) / 1000)
    };
  }
  
  // Add current timestamp
  timestamps.push(now);
  rateLimitStore.set(key, timestamps);
  
  return {
    limit: max,
    remaining: max - timestamps.length,
    reset: new Date(now + windowMs)
  };
}

/**
 * Rate limit middleware
 */
export function rateLimitMiddleware(options: RateLimitOptions = {}) {
  return async function (request: Request): Promise<Response | null> {
    const rateLimitInfo = await checkRateLimit(request, options);
    
    if (rateLimitInfo && rateLimitInfo.remaining === 0) {
      // Rate limit exceeded
      const response = new Response(
        JSON.stringify({
          error: options.message || "Too many requests, please try again later.",
          retryAfter: rateLimitInfo.retryAfter
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": String(rateLimitInfo.limit),
            "X-RateLimit-Remaining": String(rateLimitInfo.remaining),
            "X-RateLimit-Reset": rateLimitInfo.reset.toISOString(),
            "Retry-After": String(rateLimitInfo.retryAfter || 60)
          }
        }
      );
      
      if (options.handler) {
        await options.handler(request, response);
      }
      
      return response;
    }
    
    // Add rate limit headers to response
    if (rateLimitInfo) {
      return new Response(null, {
        headers: {
          "X-RateLimit-Limit": String(rateLimitInfo.limit),
          "X-RateLimit-Remaining": String(rateLimitInfo.remaining),
          "X-RateLimit-Reset": rateLimitInfo.reset.toISOString()
        }
      });
    }
    
    return null;
  };
}

/**
 * Apply rate limiting to a handler function
 */
export function withRateLimit<T extends (...args: any[]) => any>(
  handler: T,
  options: RateLimitOptions = {}
): T {
  return (async (...args: Parameters<T>) => {
    const request = args[0]?.request as Request;
    if (!request) {
      return handler(...args);
    }
    
    const rateLimitResponse = await rateLimitMiddleware(options)(request);
    if (rateLimitResponse && rateLimitResponse.status === 429) {
      throw rateLimitResponse;
    }
    
    const response = await handler(...args);
    
    // Add rate limit headers to successful responses
    if (response instanceof Response && rateLimitResponse) {
      rateLimitResponse.headers.forEach((value, key) => {
        response.headers.set(key, value);
      });
    }
    
    return response;
  }) as T;
}

/**
 * Shopify API specific rate limiting
 */
export class ShopifyAPIRateLimiter {
  private buckets: Map<string, { points: number; resetAt: number }> = new Map();
  
  /**
   * Check Shopify GraphQL cost
   */
  async checkGraphQLCost(shop: string, cost: number): Promise<boolean> {
    const now = Date.now();
    const bucket = this.buckets.get(shop) || { points: 1000, resetAt: now + 60000 };
    
    // Reset bucket if needed
    if (now > bucket.resetAt) {
      bucket.points = 1000;
      bucket.resetAt = now + 60000;
    }
    
    // Check if we have enough points
    if (bucket.points < cost) {
      return false;
    }
    
    // Deduct points
    bucket.points -= cost;
    this.buckets.set(shop, bucket);
    
    return true;
  }
  
  /**
   * Get bucket info for a shop
   */
  getBucketInfo(shop: string): { available: number; resetAt: Date } {
    const now = Date.now();
    const bucket = this.buckets.get(shop) || { points: 1000, resetAt: now + 60000 };
    
    // Reset bucket if needed
    if (now > bucket.resetAt) {
      bucket.points = 1000;
      bucket.resetAt = now + 60000;
    }
    
    return {
      available: bucket.points,
      resetAt: new Date(bucket.resetAt)
    };
  }
}

// Global Shopify rate limiter instance
export const shopifyRateLimiter = new ShopifyAPIRateLimiter();

// Default rate limiter instance
export const rateLimiter = new RateLimiter();

// Export the class for type usage
export { RateLimiter };

/**
 * Rate limit by shop (for multi-tenant scenarios)
 */
export function rateLimitByShop(options: RateLimitOptions = {}) {
  return rateLimitMiddleware({
    ...options,
    keyGenerator: (request: Request) => {
      const url = new URL(request.url);
      const shop = url.searchParams.get("shop") || 
                  request.headers.get("x-shopify-shop-domain") || 
                  "unknown";
      return `shop:${shop}`;
    }
  });
}

/**
 * Distributed rate limiting with Redis (stub for future implementation)
 */
export interface DistributedRateLimiter {
  check(key: string, limit: number, window: number): Promise<RateLimitInfo>;
  reset(key: string): Promise<void>;
}

/**
 * Create Redis-based rate limiter
 * Note: Requires Redis connection setup
 */
export function createRedisRateLimiter(/* redisClient */): DistributedRateLimiter {
  // Implementation would use Redis for distributed rate limiting
  // This is a stub for future implementation
  return {
    async check(key: string, limit: number, window: number): Promise<RateLimitInfo> {
      // Redis implementation here
      return {
        limit,
        remaining: limit,
        reset: new Date(Date.now() + window)
      };
    },
    async reset(key: string): Promise<void> {
      // Redis implementation here
    }
  };
}