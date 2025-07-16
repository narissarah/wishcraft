/**
 * Webhook Rate Limiter - Security Fix
 * Prevents DoS attacks on webhook endpoints
 */

import { LRUCache } from 'lru-cache';
import { log } from './logger.server';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (shopId: string, endpoint: string) => string;
  onLimitReached?: (shopId: string, endpoint: string) => void;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class WebhookRateLimiter {
  private cache: LRUCache<string, RateLimitEntry>;
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 requests per minute
      keyGenerator: (shopId: string, endpoint: string) => `${shopId}:${endpoint}`,
      ...config
    };

    this.cache = new LRUCache<string, RateLimitEntry>({
      max: 10000, // Max 10k shops
      ttl: this.config.windowMs * 2, // Cache entries for 2x window
    });
  }

  /**
   * Check if request is within rate limit
   */
  checkRateLimit(shopId: string, endpoint: string): {
    allowed: boolean;
    remainingRequests: number;
    resetTime: number;
  } {
    const key = this.config.keyGenerator(shopId, endpoint);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let entry = this.cache.get(key);

    // Reset window if expired
    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs
      };
    }

    // Increment request count
    entry.count++;
    this.cache.set(key, entry);

    const allowed = entry.count <= this.config.maxRequests;
    const remainingRequests = Math.max(0, this.config.maxRequests - entry.count);

    if (!allowed) {
      log.warn('Webhook rate limit exceeded', {
        shopId,
        endpoint,
        requestCount: entry.count,
        maxRequests: this.config.maxRequests,
        resetTime: entry.resetTime
      });

      this.config.onLimitReached?.(shopId, endpoint);
    }

    return {
      allowed,
      remainingRequests,
      resetTime: entry.resetTime
    };
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(shopId: string, endpoint: string): {
    requestCount: number;
    remainingRequests: number;
    resetTime: number;
  } {
    const key = this.config.keyGenerator(shopId, endpoint);
    const entry = this.cache.get(key);

    if (!entry) {
      return {
        requestCount: 0,
        remainingRequests: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs
      };
    }

    return {
      requestCount: entry.count,
      remainingRequests: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime
    };
  }

  /**
   * Reset rate limit for specific shop/endpoint
   */
  resetRateLimit(shopId: string, endpoint: string): void {
    const key = this.config.keyGenerator(shopId, endpoint);
    this.cache.delete(key);
  }

  /**
   * Get all rate limit entries (for monitoring)
   */
  getAllRateLimits(): Array<{
    key: string;
    requestCount: number;
    resetTime: number;
  }> {
    const entries: Array<{
      key: string;
      requestCount: number;
      resetTime: number;
    }> = [];

    this.cache.forEach((entry, key) => {
      entries.push({
        key,
        requestCount: entry.count,
        resetTime: entry.resetTime
      });
    });

    return entries;
  }
}

// Global webhook rate limiter instance
export const webhookRateLimiter = new WebhookRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 webhooks per minute per shop
  onLimitReached: (shopId: string, endpoint: string) => {
    log.error('Webhook rate limit exceeded - potential DoS attack', {
      shopId,
      endpoint,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Middleware for webhook rate limiting
 */
export function webhookRateLimitMiddleware(
  shopId: string,
  endpoint: string
): {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
} {
  return webhookRateLimiter.checkRateLimit(shopId, endpoint);
}

/**
 * Express middleware for webhook rate limiting
 */
export function createWebhookRateLimitMiddleware() {
  return (req: any, res: any, next: any) => {
    const shopId = req.body?.shop_id || req.headers['x-shopify-shop-domain'] || 'unknown';
    const endpoint = req.path;

    const rateLimitResult = webhookRateLimiter.checkRateLimit(shopId, endpoint);

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': '10',
      'X-RateLimit-Remaining': rateLimitResult.remainingRequests.toString(),
      'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
    });

    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many webhook requests. Please try again later.',
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
      });
    }

    next();
  };
}

/**
 * Rate limiter for specific webhook types
 */
export const webhookRateLimiters = {
  // Orders webhook - higher limit due to potential bulk operations
  orders: new WebhookRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50, // 50 orders per minute
  }),

  // Products webhook - medium limit
  products: new WebhookRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 products per minute
  }),

  // Customers webhook - lower limit
  customers: new WebhookRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 customers per minute
  }),

  // App uninstall - very low limit
  appUninstall: new WebhookRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 2, // 2 uninstalls per minute
  }),

  // GDPR webhooks - very low limit
  gdpr: new WebhookRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 GDPR requests per minute
  })
};

/**
 * Get appropriate rate limiter for webhook topic
 */
export function getRateLimiterForWebhook(topic: string): WebhookRateLimiter {
  if (topic.includes('orders')) {
    return webhookRateLimiters.orders;
  }
  if (topic.includes('products')) {
    return webhookRateLimiters.products;
  }
  if (topic.includes('customers')) {
    return webhookRateLimiters.customers;
  }
  if (topic.includes('app/uninstalled')) {
    return webhookRateLimiters.appUninstall;
  }
  if (topic.includes('data_request') || topic.includes('redact')) {
    return webhookRateLimiters.gdpr;
  }
  
  // Default rate limiter
  return webhookRateLimiter;
}