/**
 * Redis-based Distributed Rate Limiter
 * Scalable rate limiting across multiple server instances
 */

import { createClient, RedisClientType } from 'redis';
import { LRUCache } from 'lru-cache';
import crypto from 'crypto';
import { logger } from '~/monitoring/logger';

// Rate limit algorithm types
export enum RateLimitAlgorithm {
  SLIDING_WINDOW = 'sliding_window',
  FIXED_WINDOW = 'fixed_window',
  TOKEN_BUCKET = 'token_bucket',
  LEAKY_BUCKET = 'leaky_bucket',
}

// Rate limit configuration
export interface DistributedRateLimitConfig {
  algorithm: RateLimitAlgorithm;
  windowMs: number;
  limit: number;
  keyPrefix?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (request: Request) => string;
  onLimitReached?: (key: string, info: RateLimitInfo) => void;
  whitelistIps?: string[];
  blacklistIps?: string[];
  customHeaders?: boolean;
}

// Rate limit info
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
  algorithm: RateLimitAlgorithm;
  key: string;
}

// Rate limit result
export interface RateLimitResult {
  allowed: boolean;
  info: RateLimitInfo;
  error?: string;
}

// Redis connection status
enum RedisStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  ERROR = 'error',
}

/**
 * Distributed Rate Limiter Class
 */
export class DistributedRateLimiter {
  private redis: RedisClientType | null = null;
  private redisStatus: RedisStatus = RedisStatus.DISCONNECTED;
  private fallbackCache: LRUCache<string, any>;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 5;
  private reconnectDelay = 1000;
  private config: DistributedRateLimitConfig;

  constructor(config: DistributedRateLimitConfig) {
    this.config = {
      keyPrefix: 'rate_limit:',
      customHeaders: true,
      ...config,
    };

    // Initialize fallback cache
    this.fallbackCache = new LRUCache<string, any>({
      max: 10000,
      ttl: this.config.windowMs,
    });

    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    if (this.redisStatus === RedisStatus.CONNECTING) {
      return;
    }

    this.redisStatus = RedisStatus.CONNECTING;

    try {
      this.redis = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD,
        database: parseInt(process.env.REDIS_DB || '0'),
        socket: {
          connectTimeout: 5000,
          lazyConnect: true,
        },
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis connection refused');
            return new Error('Redis connection refused');
          }
          
          if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          
          if (options.attempt > this.maxConnectionAttempts) {
            logger.error('Max Redis connection attempts exceeded');
            return new Error('Max connection attempts exceeded');
          }
          
          // Exponential backoff
          return Math.min(options.attempt * 100, 3000);
        },
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected');
        this.redisStatus = RedisStatus.CONNECTED;
        this.connectionAttempts = 0;
      });

      this.redis.on('error', (error) => {
        logger.error('Redis error:', error);
        this.redisStatus = RedisStatus.ERROR;
        this.scheduleReconnect();
      });

      this.redis.on('end', () => {
        logger.warn('Redis connection ended');
        this.redisStatus = RedisStatus.DISCONNECTED;
        this.scheduleReconnect();
      });

      await this.redis.connect();
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      this.redisStatus = RedisStatus.ERROR;
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule Redis reconnection
   */
  private scheduleReconnect(): void {
    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      logger.error('Max Redis reconnection attempts exceeded, using fallback cache');
      return;
    }

    this.connectionAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.connectionAttempts - 1);

    setTimeout(() => {
      logger.info(`Attempting Redis reconnection (attempt ${this.connectionAttempts})`);
      this.initializeRedis();
    }, delay);
  }

  /**
   * Generate rate limit key
   */
  private generateKey(request: Request): string {
    let key: string;

    if (this.config.keyGenerator) {
      key = this.config.keyGenerator(request);
    } else {
      const ip = this.getClientIp(request);
      const url = new URL(request.url);
      const route = url.pathname;
      
      key = crypto
        .createHash('sha256')
        .update(`${ip}:${route}`)
        .digest('hex');
    }

    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * Get client IP address
   */
  private getClientIp(request: Request): string {
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip');

    return (
      cfConnectingIp ||
      (forwardedFor ? forwardedFor.split(',')[0].trim() : null) ||
      realIp ||
      'unknown'
    );
  }

  /**
   * Check IP whitelist/blacklist
   */
  private checkIpList(request: Request): { allowed: boolean; reason?: string } {
    const ip = this.getClientIp(request);

    if (this.config.blacklistIps?.includes(ip)) {
      return { allowed: false, reason: 'IP blacklisted' };
    }

    if (this.config.whitelistIps?.includes(ip)) {
      return { allowed: true, reason: 'IP whitelisted' };
    }

    return { allowed: true };
  }

  /**
   * Check rate limit using sliding window algorithm
   */
  private async checkSlidingWindow(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      if (this.redis && this.redisStatus === RedisStatus.CONNECTED) {
        // Use Redis for distributed rate limiting
        const pipeline = this.redis.multi();
        
        // Remove old entries
        pipeline.zRemRangeByScore(key, 0, windowStart);
        
        // Count current requests
        pipeline.zCard(key);
        
        // Add current request
        pipeline.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
        
        // Set expiration
        pipeline.expire(key, Math.ceil(this.config.windowMs / 1000));
        
        const results = await pipeline.exec();
        
        if (results && results[1] && results[1][1] !== null) {
          const count = results[1][1] as number;
          const remaining = Math.max(0, this.config.limit - count - 1);
          const reset = new Date(now + this.config.windowMs);
          
          return {
            allowed: count < this.config.limit,
            info: {
              limit: this.config.limit,
              remaining,
              reset,
              retryAfter: count >= this.config.limit ? Math.ceil(this.config.windowMs / 1000) : undefined,
              algorithm: this.config.algorithm,
              key,
            },
          };
        }
      }
    } catch (error) {
      logger.error('Redis sliding window check failed:', error);
    }

    // Fallback to local cache
    return this.checkSlidingWindowFallback(key);
  }

  /**
   * Fallback sliding window implementation
   */
  private checkSlidingWindowFallback(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    let timestamps = this.fallbackCache.get(key) || [];
    timestamps = timestamps.filter((ts: number) => ts > windowStart);
    
    const remaining = Math.max(0, this.config.limit - timestamps.length);
    const reset = new Date(now + this.config.windowMs);
    
    if (timestamps.length < this.config.limit) {
      timestamps.push(now);
      this.fallbackCache.set(key, timestamps);
      
      return {
        allowed: true,
        info: {
          limit: this.config.limit,
          remaining: remaining - 1,
          reset,
          algorithm: this.config.algorithm,
          key,
        },
      };
    } else {
      return {
        allowed: false,
        info: {
          limit: this.config.limit,
          remaining: 0,
          reset,
          retryAfter: Math.ceil(this.config.windowMs / 1000),
          algorithm: this.config.algorithm,
          key,
        },
      };
    }
  }

  /**
   * Check rate limit using fixed window algorithm
   */
  private async checkFixedWindow(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
    const windowKey = `${key}:${windowStart}`;

    try {
      if (this.redis && this.redisStatus === RedisStatus.CONNECTED) {
        const pipeline = this.redis.multi();
        
        // Increment counter
        pipeline.incr(windowKey);
        
        // Set expiration
        pipeline.expire(windowKey, Math.ceil(this.config.windowMs / 1000));
        
        const results = await pipeline.exec();
        
        if (results && results[0] && results[0][1] !== null) {
          const count = results[0][1] as number;
          const remaining = Math.max(0, this.config.limit - count);
          const reset = new Date(windowStart + this.config.windowMs);
          
          return {
            allowed: count <= this.config.limit,
            info: {
              limit: this.config.limit,
              remaining,
              reset,
              retryAfter: count > this.config.limit ? Math.ceil((windowStart + this.config.windowMs - now) / 1000) : undefined,
              algorithm: this.config.algorithm,
              key: windowKey,
            },
          };
        }
      }
    } catch (error) {
      logger.error('Redis fixed window check failed:', error);
    }

    // Fallback to local cache
    return this.checkFixedWindowFallback(windowKey);
  }

  /**
   * Fallback fixed window implementation
   */
  private checkFixedWindowFallback(windowKey: string): RateLimitResult {
    const now = Date.now();
    const count = (this.fallbackCache.get(windowKey) || 0) + 1;
    
    this.fallbackCache.set(windowKey, count);
    
    const remaining = Math.max(0, this.config.limit - count);
    const windowStart = parseInt(windowKey.split(':').pop()!);
    const reset = new Date(windowStart + this.config.windowMs);
    
    return {
      allowed: count <= this.config.limit,
      info: {
        limit: this.config.limit,
        remaining,
        reset,
        retryAfter: count > this.config.limit ? Math.ceil((windowStart + this.config.windowMs - now) / 1000) : undefined,
        algorithm: this.config.algorithm,
        key: windowKey,
      },
    };
  }

  /**
   * Check rate limit using token bucket algorithm
   */
  private async checkTokenBucket(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const refillRate = this.config.limit / (this.config.windowMs / 1000); // tokens per second
    
    try {
      if (this.redis && this.redisStatus === RedisStatus.CONNECTED) {
        const bucketKey = `${key}:bucket`;
        const lastRefillKey = `${key}:last_refill`;
        
        const pipeline = this.redis.multi();
        pipeline.get(bucketKey);
        pipeline.get(lastRefillKey);
        
        const results = await pipeline.exec();
        
        if (results && results[0] && results[1]) {
          const tokens = parseFloat(results[0][1] as string) || this.config.limit;
          const lastRefill = parseInt(results[1][1] as string) || now;
          
          const timePassed = (now - lastRefill) / 1000;
          const tokensToAdd = timePassed * refillRate;
          const newTokens = Math.min(this.config.limit, tokens + tokensToAdd);
          
          if (newTokens >= 1) {
            const remainingTokens = newTokens - 1;
            
            const updatePipeline = this.redis.multi();
            updatePipeline.set(bucketKey, remainingTokens.toString());
            updatePipeline.set(lastRefillKey, now.toString());
            updatePipeline.expire(bucketKey, Math.ceil(this.config.windowMs / 1000));
            updatePipeline.expire(lastRefillKey, Math.ceil(this.config.windowMs / 1000));
            
            await updatePipeline.exec();
            
            return {
              allowed: true,
              info: {
                limit: this.config.limit,
                remaining: Math.floor(remainingTokens),
                reset: new Date(now + (this.config.limit - remainingTokens) / refillRate * 1000),
                algorithm: this.config.algorithm,
                key,
              },
            };
          } else {
            return {
              allowed: false,
              info: {
                limit: this.config.limit,
                remaining: 0,
                reset: new Date(now + (1 - newTokens) / refillRate * 1000),
                retryAfter: Math.ceil((1 - newTokens) / refillRate),
                algorithm: this.config.algorithm,
                key,
              },
            };
          }
        }
      }
    } catch (error) {
      logger.error('Redis token bucket check failed:', error);
    }

    // Fallback to local cache (simplified)
    return this.checkSlidingWindowFallback(key);
  }

  /**
   * Main rate limit check method
   */
  async checkRateLimit(request: Request): Promise<RateLimitResult> {
    // Check IP whitelist/blacklist
    const ipCheck = this.checkIpList(request);
    if (!ipCheck.allowed) {
      return {
        allowed: false,
        info: {
          limit: 0,
          remaining: 0,
          reset: new Date(Date.now() + this.config.windowMs),
          algorithm: this.config.algorithm,
          key: 'blocked',
        },
        error: ipCheck.reason,
      };
    }

    // Skip if IP is whitelisted
    if (ipCheck.reason === 'IP whitelisted') {
      return {
        allowed: true,
        info: {
          limit: this.config.limit,
          remaining: this.config.limit,
          reset: new Date(Date.now() + this.config.windowMs),
          algorithm: this.config.algorithm,
          key: 'whitelisted',
        },
      };
    }

    const key = this.generateKey(request);

    try {
      switch (this.config.algorithm) {
        case RateLimitAlgorithm.SLIDING_WINDOW:
          return await this.checkSlidingWindow(key);
        case RateLimitAlgorithm.FIXED_WINDOW:
          return await this.checkFixedWindow(key);
        case RateLimitAlgorithm.TOKEN_BUCKET:
          return await this.checkTokenBucket(key);
        case RateLimitAlgorithm.LEAKY_BUCKET:
          // For now, use sliding window as leaky bucket fallback
          return await this.checkSlidingWindow(key);
        default:
          throw new Error(`Unknown algorithm: ${this.config.algorithm}`);
      }
    } catch (error) {
      logger.error('Rate limit check failed:', error);
      
      // Return a safe fallback
      return {
        allowed: true,
        info: {
          limit: this.config.limit,
          remaining: this.config.limit,
          reset: new Date(Date.now() + this.config.windowMs),
          algorithm: this.config.algorithm,
          key,
        },
        error: 'Rate limit check failed',
      };
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  async resetRateLimit(request: Request): Promise<boolean> {
    const key = this.generateKey(request);
    
    try {
      if (this.redis && this.redisStatus === RedisStatus.CONNECTED) {
        await this.redis.del(key);
        return true;
      } else {
        this.fallbackCache.delete(key);
        return true;
      }
    } catch (error) {
      logger.error('Failed to reset rate limit:', error);
      return false;
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(request: Request): Promise<RateLimitInfo | null> {
    const key = this.generateKey(request);
    
    try {
      if (this.redis && this.redisStatus === RedisStatus.CONNECTED) {
        const count = await this.redis.zCard(key);
        const remaining = Math.max(0, this.config.limit - count);
        
        return {
          limit: this.config.limit,
          remaining,
          reset: new Date(Date.now() + this.config.windowMs),
          algorithm: this.config.algorithm,
          key,
        };
      } else {
        const timestamps = this.fallbackCache.get(key) || [];
        const remaining = Math.max(0, this.config.limit - timestamps.length);
        
        return {
          limit: this.config.limit,
          remaining,
          reset: new Date(Date.now() + this.config.windowMs),
          algorithm: this.config.algorithm,
          key,
        };
      }
    } catch (error) {
      logger.error('Failed to get rate limit status:', error);
      return null;
    }
  }

  /**
   * Get Redis connection status
   */
  getRedisStatus(): RedisStatus {
    return this.redisStatus;
  }

  /**
   * Get rate limiter statistics
   */
  async getStatistics(): Promise<{
    redisStatus: RedisStatus;
    cacheSize: number;
    connectionAttempts: number;
    algorithm: RateLimitAlgorithm;
    config: Partial<DistributedRateLimitConfig>;
  }> {
    return {
      redisStatus: this.redisStatus,
      cacheSize: this.fallbackCache.size,
      connectionAttempts: this.connectionAttempts,
      algorithm: this.config.algorithm,
      config: {
        windowMs: this.config.windowMs,
        limit: this.config.limit,
        algorithm: this.config.algorithm,
      },
    };
  }

  /**
   * Shutdown the rate limiter
   */
  async shutdown(): Promise<void> {
    if (this.redis && this.redisStatus === RedisStatus.CONNECTED) {
      await this.redis.quit();
    }
    
    this.fallbackCache.clear();
    logger.info('Distributed rate limiter shutdown');
  }
}

/**
 * Rate limit middleware factory
 */
export function createRateLimitMiddleware(config: DistributedRateLimitConfig) {
  const rateLimiter = new DistributedRateLimiter(config);
  
  return async (request: Request): Promise<Response | null> => {
    const result = await rateLimiter.checkRateLimit(request);
    
    if (!result.allowed) {
      const headers = new Headers({
        'X-RateLimit-Limit': result.info.limit.toString(),
        'X-RateLimit-Remaining': result.info.remaining.toString(),
        'X-RateLimit-Reset': result.info.reset.toISOString(),
        'X-RateLimit-Algorithm': result.info.algorithm,
      });
      
      if (result.info.retryAfter) {
        headers.set('Retry-After', result.info.retryAfter.toString());
      }
      
      // Call onLimitReached callback
      if (config.onLimitReached) {
        config.onLimitReached(result.info.key, result.info);
      }
      
      return new Response(
        JSON.stringify({
          error: 'Too Many Requests',
          message: result.error || 'Rate limit exceeded',
          limit: result.info.limit,
          remaining: result.info.remaining,
          reset: result.info.reset,
          retryAfter: result.info.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(headers.entries()),
          },
        }
      );
    }
    
    // Add rate limit headers to successful responses
    if (config.customHeaders) {
      const headers = new Headers({
        'X-RateLimit-Limit': result.info.limit.toString(),
        'X-RateLimit-Remaining': result.info.remaining.toString(),
        'X-RateLimit-Reset': result.info.reset.toISOString(),
        'X-RateLimit-Algorithm': result.info.algorithm,
      });
      
      // This would be handled by the calling middleware
      (request as any).rateLimitHeaders = headers;
    }
    
    return null; // Allow request to continue
  };
}

// Default configurations for different endpoints
export const DISTRIBUTED_RATE_LIMITS = {
  api: {
    algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
    windowMs: 60 * 1000,
    limit: 100,
    keyPrefix: 'api:',
  },
  auth: {
    algorithm: RateLimitAlgorithm.FIXED_WINDOW,
    windowMs: 15 * 60 * 1000,
    limit: 5,
    keyPrefix: 'auth:',
  },
  graphql: {
    algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
    windowMs: 60 * 1000,
    limit: 1000,
    keyPrefix: 'graphql:',
  },
  admin: {
    algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
    windowMs: 60 * 1000,
    limit: 200,
    keyPrefix: 'admin:',
  },
  webhook: {
    algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
    windowMs: 1000,
    limit: 10,
    keyPrefix: 'webhook:',
  },
} as const;

// Export default rate limiters
export const apiRateLimiter = new DistributedRateLimiter(DISTRIBUTED_RATE_LIMITS.api);
export const authRateLimiter = new DistributedRateLimiter(DISTRIBUTED_RATE_LIMITS.auth);
export const graphqlRateLimiter = new DistributedRateLimiter(DISTRIBUTED_RATE_LIMITS.graphql);
export const adminRateLimiter = new DistributedRateLimiter(DISTRIBUTED_RATE_LIMITS.admin);
export const webhookRateLimiter = new DistributedRateLimiter(DISTRIBUTED_RATE_LIMITS.webhook);

export default DistributedRateLimiter;