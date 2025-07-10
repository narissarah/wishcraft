import Redis from "ioredis";
import { log } from "~/lib/logger.server";

/**
 * Redis Cache Implementation
 * Provides high-performance caching for frequently accessed data
 */

// Redis client instance
let redis: Redis | null = null;

// Cache configuration
const CACHE_CONFIG = {
  // TTL values in seconds
  ttl: {
    default: 3600, // 1 hour
    short: 300, // 5 minutes
    medium: 1800, // 30 minutes
    long: 86400, // 24 hours
    session: 604800, // 7 days
  },
  
  // Key prefixes
  prefix: {
    registry: "registry:",
    product: "product:",
    customer: "customer:",
    session: "session:",
    rate_limit: "rate_limit:",
    api: "api:",
    webhook: "webhook:",
  },
};

/**
 * Initialize Redis connection
 */
export function initRedis(): Redis | null {
  if (redis) return redis;
  
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    log.warn("Redis URL not configured, caching disabled");
    return null;
  }
  
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
        return targetErrors.some(e => err.message.includes(e));
      },
      
      // Connection options
      connectTimeout: 10000,
      lazyConnect: true,
      
      // Performance options
      enableReadyCheck: true,
      enableOfflineQueue: true,
      
      // Security
      password: process.env.REDIS_PASSWORD,
      tls: process.env.NODE_ENV === "production" ? {} : undefined,
    });
    
    // Connection event handlers
    redis.on("connect", () => {
      log.info("Redis connected successfully");
    });
    
    redis.on("error", (error) => {
      log.error("Redis connection error", error);
    });
    
    redis.on("close", () => {
      log.warn("Redis connection closed");
    });
    
    // Connect to Redis
    redis.connect();
    
    return redis;
  } catch (error) {
    log.error("Failed to initialize Redis", error);
    return null;
  }
}

/**
 * Get cached value
 */
export async function getCached<T>(key: string): Promise<T | null> {
  const client = initRedis();
  if (!client) return null;
  
  try {
    const value = await client.get(key);
    if (!value) return null;
    
    return JSON.parse(value) as T;
  } catch (error) {
    log.error("Redis get error", error, { key });
    return null;
  }
}

/**
 * Set cached value with TTL
 */
export async function setCached<T>(
  key: string,
  value: T,
  ttl: number = CACHE_CONFIG.ttl.default
): Promise<boolean> {
  const client = initRedis();
  if (!client) return false;
  
  try {
    const serialized = JSON.stringify(value);
    await client.setex(key, ttl, serialized);
    return true;
  } catch (error) {
    log.error("Redis set error", error, { key });
    return false;
  }
}

/**
 * Delete cached value
 */
export async function deleteCached(key: string): Promise<boolean> {
  const client = initRedis();
  if (!client) return false;
  
  try {
    await client.del(key);
    return true;
  } catch (error) {
    log.error("Redis delete error", error, { key });
    return false;
  }
}

/**
 * Clear cache by pattern
 */
export async function clearCacheByPattern(pattern: string): Promise<number> {
  const client = initRedis();
  if (!client) return 0;
  
  try {
    const keys = await client.keys(pattern);
    if (keys.length === 0) return 0;
    
    const pipeline = client.pipeline();
    keys.forEach(key => pipeline.del(key));
    await pipeline.exec();
    
    return keys.length;
  } catch (error) {
    log.error("Redis clear pattern error", error, { pattern });
    return 0;
  }
}

/**
 * Cache decorator for functions
 */
export function cached<T extends (...args: any[]) => Promise<any>>(
  keyGenerator: (...args: Parameters<T>) => string,
  ttl: number = CACHE_CONFIG.ttl.default
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: Parameters<T>) {
      const cacheKey = keyGenerator(...args);
      
      // Try to get from cache
      const cachedValue = await getCached(cacheKey);
      if (cachedValue !== null) {
        return cachedValue;
      }
      
      // Execute original method
      const result = await originalMethod.apply(this, args);
      
      // Cache the result
      await setCached(cacheKey, result, ttl);
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Registry cache helpers
 */
export const registryCache = {
  async get(registryId: string) {
    const key = `${CACHE_CONFIG.prefix.registry}${registryId}`;
    return getCached(key);
  },
  
  async set(registryId: string, data: any) {
    const key = `${CACHE_CONFIG.prefix.registry}${registryId}`;
    return setCached(key, data, CACHE_CONFIG.ttl.medium);
  },
  
  async invalidate(registryId: string) {
    const key = `${CACHE_CONFIG.prefix.registry}${registryId}`;
    return deleteCached(key);
  },
  
  async invalidateAll(shopId: string) {
    const pattern = `${CACHE_CONFIG.prefix.registry}${shopId}:*`;
    return clearCacheByPattern(pattern);
  },
};

/**
 * Product cache helpers
 */
export const productCache = {
  async get(productId: string) {
    const key = `${CACHE_CONFIG.prefix.product}${productId}`;
    return getCached(key);
  },
  
  async set(productId: string, data: any) {
    const key = `${CACHE_CONFIG.prefix.product}${productId}`;
    return setCached(key, data, CACHE_CONFIG.ttl.long);
  },
  
  async invalidate(productId: string) {
    const key = `${CACHE_CONFIG.prefix.product}${productId}`;
    return deleteCached(key);
  },
};

/**
 * Session cache helpers
 */
export const sessionCache = {
  async get(sessionId: string) {
    const key = `${CACHE_CONFIG.prefix.session}${sessionId}`;
    return getCached(key);
  },
  
  async set(sessionId: string, data: any) {
    const key = `${CACHE_CONFIG.prefix.session}${sessionId}`;
    return setCached(key, data, CACHE_CONFIG.ttl.session);
  },
  
  async invalidate(sessionId: string) {
    const key = `${CACHE_CONFIG.prefix.session}${sessionId}`;
    return deleteCached(key);
  },
};

/**
 * API response cache helpers
 */
export const apiCache = {
  generateKey(endpoint: string, params: Record<string, any> = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join("&");
    return `${CACHE_CONFIG.prefix.api}${endpoint}:${sortedParams}`;
  },
  
  async get(endpoint: string, params?: Record<string, any>) {
    const key = this.generateKey(endpoint, params);
    return getCached(key);
  },
  
  async set(endpoint: string, data: any, params?: Record<string, any>, ttl?: number) {
    const key = this.generateKey(endpoint, params);
    return setCached(key, data, ttl || CACHE_CONFIG.ttl.short);
  },
  
  async invalidate(endpoint: string, params?: Record<string, any>) {
    const key = this.generateKey(endpoint, params);
    return deleteCached(key);
  },
};

/**
 * Cache warming utilities
 */
export async function warmCache(shopId: string) {
  const client = initRedis();
  if (!client) return;
  
  try {
    log.info("Starting cache warming", { shopId });
    
    // Warm frequently accessed data
    // This would be expanded based on actual usage patterns
    
    log.info("Cache warming completed", { shopId });
  } catch (error) {
    log.error("Cache warming failed", error, { shopId });
  }
}

/**
 * Health check for Redis
 */
export async function checkRedisHealth(): Promise<boolean> {
  const client = initRedis();
  if (!client) return false;
  
  try {
    await client.ping();
    return true;
  } catch (error) {
    log.error("Redis health check failed", error);
    return false;
  }
}

// Export configuration
export { CACHE_CONFIG };