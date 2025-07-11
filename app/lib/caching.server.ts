import { LRUCache } from 'lru-cache';
import type { Registry } from '@prisma/client';

// Multi-level caching strategy for optimal performance

export interface CacheConfig {
  maxItems: number;
  ttl: number; // Time to live in milliseconds
  updateAgeOnGet: boolean;
  stale: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
  evictions: number;
}

// Cache levels enum
export enum CacheLevel {
  MEMORY = 'memory',
  REDIS = 'redis',
  CDN = 'cdn',
  BROWSER = 'browser'
}

// Cache key patterns
export const CacheKeys = {
  REGISTRY: (id: string) => `registry:${id}`,
  REGISTRY_WITH_ITEMS: (id: string) => `registry_items:${id}`,
  REGISTRY_LIST: (shopId: string, page: number) => `registry_list:${shopId}:${page}`,
  PRODUCT_DATA: (productId: string) => `product:${productId}`,
  INVENTORY: (productId: string) => `inventory:${productId}`,
  CUSTOMER: (customerId: string) => `customer:${customerId}`,
  ANALYTICS: (registryId: string, period: string) => `analytics:${registryId}:${period}`,
  GROUP_GIFT: (giftId: string) => `group_gift:${giftId}`,
  SEARCH_RESULTS: (query: string, filters: string) => `search:${query}:${filters}`,
  WEBHOOK_PROCESSED: (webhookId: string) => `webhook:${webhookId}`,
} as const;

// Cache configurations for different data types
const cacheConfigs: Record<string, CacheConfig> = {
  // Fast-changing data
  inventory: {
    maxItems: 10000,
    ttl: 60000, // 1 minute
    updateAgeOnGet: true,
    stale: true
  },
  
  // Medium-changing data
  registries: {
    maxItems: 5000,
    ttl: 300000, // 5 minutes
    updateAgeOnGet: true,
    stale: true
  },
  
  // Slow-changing data
  products: {
    maxItems: 15000,
    ttl: 1800000, // 30 minutes
    updateAgeOnGet: true,
    stale: true
  },
  
  // Static-like data
  customers: {
    maxItems: 8000,
    ttl: 3600000, // 1 hour
    updateAgeOnGet: true,
    stale: true
  },
  
  // Analytics data
  analytics: {
    maxItems: 2000,
    ttl: 600000, // 10 minutes
    updateAgeOnGet: false,
    stale: true
  },
  
  // Search results
  search: {
    maxItems: 1000,
    ttl: 300000, // 5 minutes
    updateAgeOnGet: true,
    stale: true
  }
};

// Multi-level cache manager
export class WishCraftCacheManager {
  private caches: Map<string, LRUCache<string, any>> = new Map();
  private stats: Map<string, CacheStats> = new Map();

  constructor() {
    this.initializeCaches();
  }

  private initializeCaches() {
    Object.entries(cacheConfigs).forEach(([name, config]) => {
      const cache = new LRUCache<string, any>({
        max: config.maxItems,
        ttl: config.ttl,
        updateAgeOnGet: config.updateAgeOnGet,
        allowStale: config.stale,
        // Callback for cache events
        dispose: (_value, _key) => {
          this.updateStats(name, 'eviction');
        }
      });

      this.caches.set(name, cache);
      this.stats.set(name, {
        hits: 0,
        misses: 0,
        size: 0,
        hitRate: 0,
        evictions: 0
      });
    });
  }

  // Get from cache with fallback
  async get<T>(
    cacheType: string,
    key: string,
    fallback?: () => Promise<T>
  ): Promise<T | null> {
    const cache = this.caches.get(cacheType);
    if (!cache) {
      throw new Error(`Cache type '${cacheType}' not found`);
    }

    const cached = cache.get(key);
    
    if (cached !== undefined) {
      this.updateStats(cacheType, 'hit');
      return cached;
    }

    this.updateStats(cacheType, 'miss');

    if (fallback) {
      const value = await fallback();
      if (value !== null && value !== undefined) {
        this.set(cacheType, key, value);
      }
      return value;
    }

    return null;
  }

  // Set cache value
  set<T>(cacheType: string, key: string, value: T, ttl?: number): void {
    const cache = this.caches.get(cacheType);
    if (!cache) {
      throw new Error(`Cache type '${cacheType}' not found`);
    }

    if (ttl) {
      cache.set(key, value, { ttl });
    } else {
      cache.set(key, value);
    }

    this.updateStats(cacheType, 'set');
  }

  // Delete from cache
  delete(cacheType: string, key: string): boolean {
    const cache = this.caches.get(cacheType);
    if (!cache) return false;

    const deleted = cache.delete(key);
    if (deleted) {
      this.updateStats(cacheType, 'delete');
    }
    return deleted;
  }

  // Clear entire cache type
  clear(cacheType: string): void {
    const cache = this.caches.get(cacheType);
    if (cache) {
      cache.clear();
      this.resetStats(cacheType);
    }
  }

  // Cache warming for frequently accessed data
  async warmCache(shopId: string): Promise<void> {
    console.log(`Warming cache for shop: ${shopId}`);

    try {
      // Warm registry list cache
      // This would typically call your optimized database query
      // await this.get('registries', CacheKeys.REGISTRY_LIST(shopId, 1), () => getRegistriesByShop(shopId));

      // Warm popular product cache
      // const popularProducts = await getPopularProducts(shopId);
      // for (const product of popularProducts) {
      //   await this.get('products', CacheKeys.PRODUCT_DATA(product.id), () => getProductData(product.id));
      // }

      console.log(`Cache warmed for shop: ${shopId}`);
    } catch (error) {
      console.error(`Cache warming failed for shop ${shopId}:`, error);
    }
  }

  // Cache invalidation patterns
  invalidateRegistry(registryId: string): void {
    const patterns = [
      CacheKeys.REGISTRY(registryId),
      CacheKeys.REGISTRY_WITH_ITEMS(registryId),
      `analytics:${registryId}:*`
    ];

    patterns.forEach(pattern => {
      if (pattern.includes('*')) {
        this.invalidatePattern('analytics', pattern);
      } else {
        this.delete('registries', pattern);
      }
    });
  }

  invalidateProduct(productId: string): void {
    this.delete('products', CacheKeys.PRODUCT_DATA(productId));
    this.delete('inventory', CacheKeys.INVENTORY(productId));
    
    // Invalidate related registry caches
    this.invalidatePattern('registries', `*${productId}*`);
  }

  invalidateShop(shopId: string): void {
    this.invalidatePattern('registries', `registry_list:${shopId}:*`);
    this.clear('search'); // Clear all search results
  }

  private invalidatePattern(cacheType: string, pattern: string): void {
    const cache = this.caches.get(cacheType);
    if (!cache) return;

    const regex = new RegExp(pattern.replace('*', '.*'));
    const keysToDelete: string[] = [];

    // LRU cache doesn't have a keys() method, so we need to track this differently
    // In a real implementation, you'd maintain a key registry or use Redis
    cache.forEach((value, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => cache.delete(key));
  }

  // Cache statistics
  getStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    
    this.stats.forEach((stat, cacheType) => {
      const cache = this.caches.get(cacheType);
      stats[cacheType] = {
        ...stat,
        size: cache?.size || 0,
        hitRate: stat.hits + stat.misses > 0 ? stat.hits / (stat.hits + stat.misses) : 0
      };
    });

    return stats;
  }

  // Memory usage analysis
  getMemoryUsage(): Record<string, number> {
    const usage: Record<string, number> = {};
    
    this.caches.forEach((cache, cacheType) => {
      usage[cacheType] = cache.calculatedSize || 0;
    });

    return usage;
  }

  private updateStats(cacheType: string, operation: 'hit' | 'miss' | 'set' | 'delete' | 'eviction'): void {
    const stats = this.stats.get(cacheType);
    if (!stats) return;

    switch (operation) {
      case 'hit':
        stats.hits++;
        break;
      case 'miss':
        stats.misses++;
        break;
      case 'eviction':
        stats.evictions++;
        break;
    }

    this.stats.set(cacheType, stats);
  }

  private resetStats(cacheType: string): void {
    this.stats.set(cacheType, {
      hits: 0,
      misses: 0,
      size: 0,
      hitRate: 0,
      evictions: 0
    });
  }
}

// HTTP cache headers utility
export class HTTPCacheManager {
  static setCacheHeaders(
    response: Response,
    options: {
      maxAge?: number;
      sMaxAge?: number;
      staleWhileRevalidate?: number;
      mustRevalidate?: boolean;
      private?: boolean;
      noCache?: boolean;
      etag?: string;
      lastModified?: Date;
    }
  ): void {
    const headers = new Headers(response.headers);

    if (options.noCache) {
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');
      return;
    }

    const cacheDirectives: string[] = [];

    if (options.private) {
      cacheDirectives.push('private');
    } else {
      cacheDirectives.push('public');
    }

    if (options.maxAge !== undefined) {
      cacheDirectives.push(`max-age=${options.maxAge}`);
    }

    if (options.sMaxAge !== undefined) {
      cacheDirectives.push(`s-maxage=${options.sMaxAge}`);
    }

    if (options.staleWhileRevalidate !== undefined) {
      cacheDirectives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
    }

    if (options.mustRevalidate) {
      cacheDirectives.push('must-revalidate');
    }

    headers.set('Cache-Control', cacheDirectives.join(', '));

    if (options.etag) {
      headers.set('ETag', options.etag);
    }

    if (options.lastModified) {
      headers.set('Last-Modified', options.lastModified.toUTCString());
    }
  }

  static generateETag(content: string): string {
    // Simple hash-based ETag generation
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `"${Math.abs(hash).toString(36)}"`;
  }

  static isNotModified(request: Request, etag?: string, lastModified?: Date): boolean {
    const ifNoneMatch = request.headers.get('If-None-Match');
    const ifModifiedSince = request.headers.get('If-Modified-Since');

    if (etag && ifNoneMatch) {
      return ifNoneMatch === etag;
    }

    if (lastModified && ifModifiedSince) {
      const modifiedTime = new Date(ifModifiedSince);
      return lastModified <= modifiedTime;
    }

    return false;
  }
}

// Webhook deduplication cache
export class WebhookCache {
  private processedWebhooks = new LRUCache<string, boolean>({
    max: 10000,
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  });

  isProcessed(webhookId: string): boolean {
    return this.processedWebhooks.has(webhookId);
  }

  markProcessed(webhookId: string): void {
    this.processedWebhooks.set(webhookId, true);
  }

  generateWebhookId(headers: Record<string, string>, body: string): string {
    const timestamp = headers['x-shopify-webhook-timestamp'] || Date.now().toString();
    const topic = headers['x-shopify-topic'] || 'unknown';
    
    // Create a hash of the webhook content for deduplication
    let hash = 0;
    const content = `${timestamp}:${topic}:${body}`;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `webhook_${Math.abs(hash).toString(36)}`;
  }
}

// Cache warming scheduler
export class CacheWarmingScheduler {
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(private cacheManager: WishCraftCacheManager) {}

  scheduleWarming(shopId: string, intervalMs: number = 30 * 60 * 1000): void {
    // Clear existing interval
    this.clearWarming(shopId);

    // Schedule new warming
    const interval = setInterval(async () => {
      try {
        await this.cacheManager.warmCache(shopId);
      } catch (error) {
        console.error(`Scheduled cache warming failed for shop ${shopId}:`, error);
      }
    }, intervalMs);

    this.intervals.set(shopId, interval);
    console.log(`Cache warming scheduled for shop ${shopId} every ${intervalMs}ms`);
  }

  clearWarming(shopId: string): void {
    const interval = this.intervals.get(shopId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(shopId);
    }
  }

  clearAllWarming(): void {
    this.intervals.forEach((interval, _shopId) => {
      clearInterval(interval);
    });
    this.intervals.clear();
  }
}

// Export singleton instances
export const cacheManager = new WishCraftCacheManager();
export const webhookCache = new WebhookCache();
export const cacheWarmer = new CacheWarmingScheduler(cacheManager);

// Cache middleware for Remix loaders
export function withCache<T>(
  cacheType: string,
  keyGenerator: (...args: any[]) => string,
  _ttl?: number
) {
  return function cacheDecorator(
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const key = keyGenerator(...args);
      
      return cacheManager.get<T>(
        cacheType,
        key,
        () => method.apply(this, args)
      );
    };

    return descriptor;
  };
}

// Cache warming utilities
export const cacheUtils = {
  // Registry-specific cache operations
  registry: {
    get: (id: string) => cacheManager.get('registries', CacheKeys.REGISTRY(id)),
    set: (id: string, data: Registry) => cacheManager.set('registries', CacheKeys.REGISTRY(id), data),
    invalidate: (id: string) => cacheManager.invalidateRegistry(id),
  },

  // Product-specific cache operations
  product: {
    get: (id: string) => cacheManager.get('products', CacheKeys.PRODUCT_DATA(id)),
    set: (id: string, data: any) => cacheManager.set('products', CacheKeys.PRODUCT_DATA(id), data),
    invalidate: (id: string) => cacheManager.invalidateProduct(id),
  },

  // Inventory-specific cache operations
  inventory: {
    get: (id: string) => cacheManager.get('inventory', CacheKeys.INVENTORY(id)),
    set: (id: string, data: any) => cacheManager.set('inventory', CacheKeys.INVENTORY(id), data),
    invalidate: (id: string) => cacheManager.delete('inventory', CacheKeys.INVENTORY(id)),
  },

  // Analytics cache operations
  analytics: {
    get: (registryId: string, period: string) => 
      cacheManager.get('analytics', CacheKeys.ANALYTICS(registryId, period)),
    set: (registryId: string, period: string, data: any) => 
      cacheManager.set('analytics', CacheKeys.ANALYTICS(registryId, period), data),
  },
};