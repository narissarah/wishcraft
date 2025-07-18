/**
 * Unified Cache System for WishCraft
 * Consolidates all cache implementations into a single, comprehensive system
 * Based on the advanced caching.server.ts with enhancements from other implementations
 */

import { LRUCache } from 'lru-cache';
import Redis from 'ioredis';
import { log } from '~/lib/logger.server';
import { CircuitBreaker } from './circuit-breaker.server';
import crypto from 'crypto';

// Redis client singleton
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    log.warn('Redis URL not configured, using memory-only cache');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    redisClient.on('error', (error) => {
      log.error('Redis connection error', { error });
    });

    redisClient.on('connect', () => {
      log.info('Redis connected successfully');
    });

    return redisClient;
  } catch (error) {
    log.error('Failed to initialize Redis client', { error });
    return null;
  }
}

export interface CacheOptions {
  ttl?: number;          // Time to live in milliseconds
  staleWhileRevalidate?: number; // Serve stale content while revalidating
  tags?: string[];       // Cache tags for invalidation
  compress?: boolean;    // Compress large values
  priority?: 'low' | 'medium' | 'high'; // Cache priority
}

export interface CacheEntry<T> {
  value: T;
  expires: number;
  staleUntil?: number;
  tags?: string[];
  compressed?: boolean;
  etag?: string;
  lastModified?: number;
}

// Unified cache key patterns with versioning
export const cacheKeys = {
  // Versioned keys for easy cache busting
  registry: (id: string, version = 1) => `v${version}:registry:${id}`,
  registryList: (shopId: string, page: number, version = 1) => `v${version}:registry_list:${shopId}:${page}`,
  product: (productId: string, version = 1) => `v${version}:product:${productId}`,
  customer: (customerId: string, version = 1) => `v${version}:customer:${customerId}`,
  
  // GraphQL query cache
  graphqlQuery: (queryHash: string) => `graphql:${queryHash}`,
  
  // Session-based caches
  session: (sessionId: string) => `session:${sessionId}`,
  userPreferences: (userId: string) => `user_prefs:${userId}`,
  
  // Shop-specific caches
  shopSettings: (shopId: string) => `shop_settings:${shopId}`,
  shopAnalytics: (shopId: string, period: string) => `analytics:${shopId}:${period}`,
  
  // Feature-specific caches
  webhook: (shopId: string, topic: string) => `webhook:${shopId}:${topic}`,
  rateLimit: (identifier: string) => `rate_limit:${identifier}`,
  auditLog: (shopId: string) => `audit:${shopId}`,
  notification: (userId: string) => `notifications:${userId}`,
  
  // Performance caches
  dbQuery: (queryHash: string) => `db:${queryHash}`,
  apiResponse: (endpoint: string, params: string) => `api:${endpoint}:${params}`,
  
  // Collaboration caches
  collaboration: (registryId: string) => `collab:${registryId}`,
  collaborators: (registryId: string) => `collaborators:${registryId}`,
  activity: (registryId: string) => `activity:${registryId}`,
};

// Cache TTL values in seconds (converted from all implementations)
export const CacheTTL = {
  INSTANT: 5,       // 5 seconds for real-time data
  SHORT: 60,        // 1 minute for frequently changing data
  MEDIUM: 300,      // 5 minutes for normal data
  LONG: 3600,       // 1 hour for stable data
  EXTENDED: 86400,  // 24 hours for rarely changing data
  PERMANENT: 0,     // No expiration
} as const;

// Cache configuration (merged from all implementations)
const CACHE_CONFIG = {
  maxSize: 100 * 1024 * 1024, // 100MB max memory
  maxItems: 10000,
  ttl: CacheTTL.MEDIUM * 1000, // Default 5 minutes in milliseconds
  updateAgeOnGet: true,
  updateAgeOnHas: true,
  allowStale: true,
  noDeleteOnStaleGet: true,
};

/**
 * Unified Cache Manager - Consolidates all cache implementations
 */
class UnifiedCacheManager {
  private static instance: UnifiedCacheManager;
  private redis: Awaited<ReturnType<typeof getRedisClient>> | null = null;
  private memoryCache: LRUCache<string, CacheEntry<any>>;
  private circuitBreaker: CircuitBreaker;
  private tagIndex = new Map<string, Set<string>>();
  private compressionThreshold = 1024; // Compress values > 1KB
  
  constructor() {
    this.memoryCache = new LRUCache({
      max: CACHE_CONFIG.maxItems,
      maxSize: CACHE_CONFIG.maxSize,
      ttl: CACHE_CONFIG.ttl,
      allowStale: CACHE_CONFIG.allowStale,
      updateAgeOnGet: CACHE_CONFIG.updateAgeOnGet,
      updateAgeOnHas: CACHE_CONFIG.updateAgeOnHas,
      noDeleteOnStaleGet: CACHE_CONFIG.noDeleteOnStaleGet,
      dispose: (value, key) => {
        this.cleanupTags(key);
      },
    });
    
    this.circuitBreaker = new CircuitBreaker('redis-cache', {
      failureThreshold: 3,
      recoveryTime: 30000,
    });
    
    this.initializeRedis();
  }
  
  static getInstance(): UnifiedCacheManager {
    if (!UnifiedCacheManager.instance) {
      UnifiedCacheManager.instance = new UnifiedCacheManager();
    }
    return UnifiedCacheManager.instance;
  }
  
  private async initializeRedis() {
    try {
      this.redis = await getRedisClient();
      log.info('Unified cache manager initialized with Redis');
    } catch (error) {
      log.warn('Redis not available, using memory cache only', error as Error);
    }
  }
  
  /**
   * Get value from cache with stale-while-revalidate support
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Try memory cache first
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && !this.isExpired(memoryEntry)) {
        return memoryEntry.value;
      }
      
      // Try Redis if available
      if (this.redis) {
        const redisValue = await this.circuitBreaker.execute(
          () => this.redis!.get(key),
          () => null
        );
        
        if (redisValue) {
          const entry: CacheEntry<T> = JSON.parse(redisValue);
          if (!this.isExpired(entry)) {
            // Backfill memory cache
            this.memoryCache.set(key, entry);
            return entry.value;
          }
        }
      }
      
      // Check if we can serve stale content
      if (memoryEntry && memoryEntry.staleUntil && Date.now() < memoryEntry.staleUntil) {
        return memoryEntry.value;
      }
      
      return null;
    } catch (error) {
      log.error('Cache get error', error as Error);
      return null;
    }
  }
  
  /**
   * Set value in cache with advanced options
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const now = Date.now();
      const ttl = options.ttl || CacheTTL.MEDIUM * 1000;
      const entry: CacheEntry<T> = {
        value,
        expires: now + ttl,
        staleUntil: options.staleWhileRevalidate ? now + ttl + options.staleWhileRevalidate : undefined,
        tags: options.tags,
        etag: this.generateETag(value),
        lastModified: now,
      };
      
      // Compress large values
      if (options.compress || this.shouldCompress(value)) {
        entry.compressed = true;
        // In a real implementation, you'd compress the value here
      }
      
      // Set in memory cache
      this.memoryCache.set(key, entry);
      
      // Index tags for invalidation
      if (options.tags) {
        this.indexTags(key, options.tags);
      }
      
      // Set in Redis if available
      if (this.redis) {
        await this.circuitBreaker.execute(
          () => this.redis!.setex(key, Math.ceil(ttl / 1000), JSON.stringify(entry)),
          () => Promise.resolve()
        );
      }
      
    } catch (error) {
      log.error('Cache set error', error as Error);
    }
  }
  
  /**
   * Delete from all cache layers
   */
  async delete(key: string): Promise<void> {
    try {
      this.memoryCache.delete(key);
      
      if (this.redis) {
        await this.circuitBreaker.execute(
          () => this.redis!.del(key),
          () => Promise.resolve(0)
        );
      }
      
      this.cleanupTags(key);
    } catch (error) {
      log.error('Cache delete error', error as Error);
    }
  }
  
  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      const keysToDelete = new Set<string>();
      
      for (const tag of tags) {
        const taggedKeys = this.tagIndex.get(tag);
        if (taggedKeys) {
          taggedKeys.forEach(key => keysToDelete.add(key));
        }
      }
      
      // Delete all tagged keys
      await Promise.all(Array.from(keysToDelete).map(key => this.delete(key)));
      
      // Clean up tag index
      tags.forEach(tag => this.tagIndex.delete(tag));
      
    } catch (error) {
      log.error('Cache invalidateByTags error', error as Error);
    }
  }
  
  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    try {
      this.memoryCache.clear();
      this.tagIndex.clear();
      
      if (this.redis) {
        await this.circuitBreaker.execute(
          () => this.redis!.flushdb(),
          () => Promise.resolve('OK')
        );
      }
    } catch (error) {
      log.error('Cache clear error', error as Error);
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      memory: {
        size: this.memoryCache.size,
        calculatedSize: this.memoryCache.calculatedSize,
        hits: 0, // LRUCache doesn't track hits
        misses: 0,
      },
      redis: {
        connected: !!this.redis,
        circuitBreakerState: this.circuitBreaker.getState(),
      },
      tags: this.tagIndex.size,
    };
  }
  
  // Helper methods
  private isExpired<T>(entry: CacheEntry<T>): boolean {
    return Date.now() > entry.expires;
  }
  
  private shouldCompress<T>(value: T): boolean {
    const serialized = JSON.stringify(value);
    return serialized.length > this.compressionThreshold;
  }
  
  private generateETag<T>(value: T): string {
    const serialized = JSON.stringify(value);
    return crypto.createHash('md5').update(serialized).digest('hex');
  }
  
  private indexTags(key: string, tags: string[]): void {
    tags.forEach(tag => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    });
  }
  
  private cleanupTags(key: string): void {
    this.tagIndex.forEach((keys, tag) => {
      keys.delete(key);
      if (keys.size === 0) {
        this.tagIndex.delete(tag);
      }
    });
  }
}

// Export singleton instance and convenience functions
export const cache = UnifiedCacheManager.getInstance();

// Convenience wrapper functions for backwards compatibility
export async function withCache<T>(
  key: string,
  factory: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const cached = await cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }
  
  const value = await factory();
  await cache.set(key, value, options);
  return value;
}

// Legacy aliases for migration compatibility
export const cacheManager = cache;
export const CacheKeys = cacheKeys;

/**
 * Registry-specific cache operations (migrated from cache-decorators)
 */
export class RegistryCache {
  static async get(shopId: string, registryId: string) {
    return await cache.get(cacheKeys.registry(registryId));
  }
  
  static async set(shopId: string, registryId: string, registry: any) {
    return await cache.set(cacheKeys.registry(registryId), registry, {
      ttl: CacheTTL.MEDIUM * 1000,
      tags: [`shop:${shopId}`, `registry:${registryId}`]
    });
  }
  
  static async getList(shopId: string, listKey: string) {
    return await cache.get(cacheKeys.registryList(shopId, 1));
  }
  
  static async setList(shopId: string, listKey: string, data: any) {
    return await cache.set(cacheKeys.registryList(shopId, 1), data, {
      ttl: CacheTTL.SHORT * 1000,
      tags: [`shop:${shopId}`, 'registry-list']
    });
  }
  
  static async invalidate(shopId: string) {
    return await cache.invalidateByTags([`shop:${shopId}`]);
  }
  
  static async delete(registryId: string) {
    return await cache.delete(cacheKeys.registry(registryId));
  }
}