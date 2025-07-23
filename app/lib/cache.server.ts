/**
 * Ultra-simple in-memory cache for WishCraft
 * Direct Map implementation without unnecessary abstractions
 */

interface CacheEntry {
  data: any;
  expiry: number;
}

// Simple cache map
const cacheStore = new Map<string, CacheEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cacheStore.entries()) {
    if (now > entry.expiry) {
      cacheStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Get cached value
 */
export function get(key: string): any {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  
  if (Date.now() > entry.expiry) {
    cacheStore.delete(key);
    return null;
  }
  
  return entry.data;
}

/**
 * Set cached value
 */
export function set(key: string, data: any, ttl: number = 5 * 60 * 1000): void {
  const expiry = Date.now() + ttl;
  cacheStore.set(key, { data, expiry });
  
  // Prevent memory leak - keep max 1000 entries
  if (cacheStore.size > 1000) {
    const entries = Array.from(cacheStore.entries());
    entries
      .sort((a, b) => a[1].expiry - b[1].expiry)
      .slice(0, 500)
      .forEach(([key]) => cacheStore.delete(key));
  }
}

/**
 * Delete cached value
 */
export function del(key: string): void {
  cacheStore.delete(key);
}

/**
 * Clear all cache
 */
export function clear(): void {
  cacheStore.clear();
}

// Export as cache object for compatibility
export const cache = { get, set, delete: del };

// Registry-specific helpers
export const RegistryCache = {
  registries: {
    get: (key: string) => get(`registry:${key}`),
    set: (key: string, data: any, ttl?: number) => set(`registry:${key}`, data, ttl),
    delete: (key: string) => del(`registry:${key}`),
    size: 0 // Dummy for compatibility
  },
  
  getList(shopId: string, queryParams: any): any {
    const cacheKey = `registries:${shopId}:${JSON.stringify(queryParams)}`;
    return get(cacheKey);
  },
  
  setList(shopId: string, queryParams: any, data: any, ttl?: number): void {
    const cacheKey = `registries:${shopId}:${JSON.stringify(queryParams)}`;
    set(cacheKey, data, ttl);
  },
  
  invalidate(shopId: string): void {
    // Clear all cache entries for this shop
    const keys = Array.from(cacheStore.keys());
    keys.forEach(key => {
      if (key.includes(shopId)) {
        cacheStore.delete(key);
      }
    });
  }
};