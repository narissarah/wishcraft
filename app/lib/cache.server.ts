/**
 * Simple Cache for WishCraft
 * Simplified from 431-line cache-unified.server.ts
 */

import { LRUCache } from 'lru-cache';
import Redis from 'ioredis';
import { CACHE_TTL } from './constants.server';

// Simple in-memory cache
const memoryCache = new LRUCache<string, any>({
  max: 1000,
  ttl: CACHE_TTL.DEFAULT * 1000 // Convert to milliseconds
});

// Optional Redis client
let redis: Redis | null = null;

if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL);
    redis.on('error', () => {
      redis = null; // Fallback to memory cache
    });
  } catch {
    redis = null;
  }
}

// Simple get/set interface
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      if (redis) {
        const value = await redis.get(key);
        return value ? JSON.parse(value) : null;
      }
      return memoryCache.get(key) || null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: any, ttl: number = CACHE_TTL.DEFAULT): Promise<void> {
    try {
      if (redis) {
        await redis.setex(key, ttl, JSON.stringify(value));
      } else {
        memoryCache.set(key, value, { ttl: ttl * 1000 });
      }
    } catch {
      // Fail silently - cache is optional
    }
  },

  async del(key: string): Promise<void> {
    try {
      if (redis) {
        await redis.del(key);
      } else {
        memoryCache.delete(key);
      }
    } catch {
      // Fail silently
    }
  }
};