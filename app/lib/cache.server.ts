/**
 * Simple in-memory cache for WishCraft
 * Provides caching for frequently accessed data
 */

import { log } from "~/lib/logger.server";

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class SimpleCache<T> {
  public cache = new Map<string, CacheEntry<T>>();
  private name: string;
  private defaultTTL: number;
  
  get size(): number {
    return this.cache.size;
  }

  constructor(name: string, defaultTTL = 5 * 60 * 1000) { // 5 minutes default
    this.name = name;
    this.defaultTTL = defaultTTL;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: T, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data, expiry });
    
    // Prevent memory leak
    if (this.cache.size > 1000) {
      const entries = Array.from(this.cache.entries());
      const toRemove = entries
        .sort((a, b) => a[1].expiry - b[1].expiry)
        .slice(0, 500);
      
      toRemove.forEach(([key]) => this.cache.delete(key));
      log.warn(`Cache ${this.name} size limit reached, removed ${toRemove.length} entries`);
    }
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      log.debug(`Cleaned ${cleaned} expired entries from cache ${this.name}`);
    }
  }
}

// Registry-specific cache
export const RegistryCache = {
  registries: new SimpleCache<any>('registries', 5 * 60 * 1000), // 5 minutes
  registryItems: new SimpleCache<any>('registry-items', 10 * 60 * 1000), // 10 minutes
  products: new SimpleCache<any>('products', 30 * 60 * 1000), // 30 minutes
  
  // Utility methods
  generateKey(parts: string[]): string {
    return parts.join(':');
  },
  
  getList(shopId: string, queryParams: any): any {
    const cacheKey = `registries:${shopId}:${JSON.stringify(queryParams)}`;
    return this.registries.get(cacheKey);
  },
  
  setList(shopId: string, queryParams: any, data: any, ttl?: number): void {
    const cacheKey = `registries:${shopId}:${JSON.stringify(queryParams)}`;
    this.registries.set(cacheKey, data, ttl);
  },
  
  invalidateRegistry(registryId: string): void {
    // Clear all cache entries related to this registry
    const registryKey = `registry:${registryId}`;
    this.registries.delete(registryKey);
    
    // Also clear related items
    const itemsKey = `items:${registryId}`;
    this.registryItems.delete(itemsKey);
  },
  
  set(shopId: string, registryId: string, data: any, ttl?: number): void {
    const cacheKey = `registry:${shopId}:${registryId}`;
    this.registries.set(cacheKey, data, ttl);
  },
  
  get(shopId: string, registryId: string): any {
    const cacheKey = `registry:${shopId}:${registryId}`;
    return this.registries.get(cacheKey);
  },
  
  invalidate(shopId: string): void {
    // Clear all registries cache for this shop
    const keys = Array.from(this.registries.cache.keys());
    keys.forEach(key => {
      if (key.includes(shopId)) {
        this.registries.delete(key);
      }
    });
  }
};

// Main cache export for compatibility
export const cache = {
  // Cache operations
  get(key: string) {
    return RegistryCache.registries.get(key);
  },
  
  set(key: string, data: any, ttl?: number) {
    return RegistryCache.registries.set(key, data, ttl);
  },
  
  delete(key: string) {
    return RegistryCache.registries.delete(key);
  },
  
  async getStats() {
    const registrySize = RegistryCache.registries.size;
    const itemsSize = RegistryCache.registryItems.size;
    const productsSize = RegistryCache.products.size;
    
    return {
      hitRate: 0.75, // Placeholder - implement actual tracking
      size: registrySize + itemsSize + productsSize,
      memoryUsage: (registrySize + itemsSize + productsSize) * 1024 // Rough estimate
    };
  },
  
  async isHealthy() {
    try {
      // Simple health check
      const testKey = 'health-check';
      RegistryCache.registries.set(testKey, { test: true }, 1000);
      const result = RegistryCache.registries.get(testKey);
      RegistryCache.registries.delete(testKey);
      return result !== null;
    } catch {
      return false;
    }
  }
};

// Cleanup timer
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    RegistryCache.registries.cleanup();
    RegistryCache.registryItems.cleanup();
    RegistryCache.products.cleanup();
  }, 5 * 60 * 1000); // Every 5 minutes
}