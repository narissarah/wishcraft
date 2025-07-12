import Redis from 'ioredis';
import { log } from '~/lib/logger.server';

/**
 * Redis Cache Implementation for WishCraft
 * Provides caching layer for performance optimization
 */

let redis: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null;
  }
  
  if (!redis) {
    try {
      redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
        reconnectOnError: (err) => {
          const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'];
          if (targetErrors.some(e => err.message.includes(e))) {
            return true;
          }
          return false;
        },
        retryStrategy: (times) => {
          if (times > 3) {
            log.error('Redis connection failed after 3 retries');
            return null;
          }
          return Math.min(times * 200, 2000);
        }
      });
      
      redis.on('error', (err) => {
        log.error('Redis error:', err);
      });
      
      redis.on('connect', () => {
        log.info('Redis connected successfully');
      });
    } catch (error) {
      log.error('Failed to initialize Redis:', error);
      return null;
    }
  }
  
  return redis;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;
  
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    log.error(`Cache get error for key ${key}:`, error);
    return null;
  }
}

export async function cacheSet(
  key: string, 
  value: any, 
  ttlSeconds?: number
): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;
  
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
    return true;
  } catch (error) {
    log.error(`Cache set error for key ${key}:`, error);
    return false;
  }
}

export async function cacheDel(key: string): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;
  
  try {
    await client.del(key);
    return true;
  } catch (error) {
    log.error(`Cache delete error for key ${key}:`, error);
    return false;
  }
}

export async function cacheFlush(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;
  
  try {
    await client.flushdb();
    return true;
  } catch (error) {
    log.error('Cache flush error:', error);
    return false;
  }
}

// Cleanup on shutdown
export function closeRedisConnection(): void {
  if (redis) {
    redis.disconnect();
    redis = null;
  }
}