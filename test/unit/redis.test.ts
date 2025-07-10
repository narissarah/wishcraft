import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCached, setCached, deleteCached, registryCache, productCache } from '~/lib/cache/redis.server';

/**
 * Unit tests for Redis Cache
 * Tests caching functionality with mocked Redis client
 */

// Mock Redis client
vi.mock('ioredis', () => {
  const mockRedis = {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    pipeline: vi.fn(() => ({ exec: vi.fn() })),
    ping: vi.fn(),
    connect: vi.fn(),
    on: vi.fn(),
  };
  
  return {
    default: vi.fn(() => mockRedis),
  };
});

describe('Redis Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCached', () => {
    it('should return cached value when present', async () => {
      const mockData = { id: 1, name: 'Test Registry' };
      const Redis = (await import('ioredis')).default;
      const mockRedis = new Redis();
      
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockData));
      
      const result = await getCached('test-key');
      
      expect(result).toEqual(mockData);
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when cache miss', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedis = new Redis();
      
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      
      const result = await getCached('missing-key');
      
      expect(result).toBeNull();
    });

    it('should handle JSON parse errors gracefully', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedis = new Redis();
      
      vi.mocked(mockRedis.get).mockResolvedValue('invalid-json');
      
      const result = await getCached('bad-json-key');
      
      expect(result).toBeNull();
    });
  });

  describe('setCached', () => {
    it('should store value with TTL', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedis = new Redis();
      
      const data = { id: 1, name: 'Test' };
      const ttl = 300;
      
      vi.mocked(mockRedis.setex).mockResolvedValue('OK');
      
      const result = await setCached('test-key', data, ttl);
      
      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        ttl,
        JSON.stringify(data)
      );
    });

    it('should use default TTL when not provided', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedis = new Redis();
      
      vi.mocked(mockRedis.setex).mockResolvedValue('OK');
      
      await setCached('test-key', { data: 'test' });
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        3600, // default TTL
        expect.any(String)
      );
    });
  });

  describe('deleteCached', () => {
    it('should delete cached value', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedis = new Redis();
      
      vi.mocked(mockRedis.del).mockResolvedValue(1);
      
      const result = await deleteCached('test-key');
      
      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });
  });

  describe('registryCache', () => {
    it('should get registry with prefixed key', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedis = new Redis();
      
      const mockRegistry = { id: 'reg-123', name: 'Wedding Registry' };
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockRegistry));
      
      const result = await registryCache.get('reg-123');
      
      expect(result).toEqual(mockRegistry);
      expect(mockRedis.get).toHaveBeenCalledWith('registry:reg-123');
    });

    it('should set registry with medium TTL', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedis = new Redis();
      
      vi.mocked(mockRedis.setex).mockResolvedValue('OK');
      
      const data = { id: 'reg-123', name: 'Registry' };
      await registryCache.set('reg-123', data);
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'registry:reg-123',
        1800, // medium TTL
        JSON.stringify(data)
      );
    });

    it('should invalidate registry cache', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedis = new Redis();
      
      vi.mocked(mockRedis.del).mockResolvedValue(1);
      
      await registryCache.invalidate('reg-123');
      
      expect(mockRedis.del).toHaveBeenCalledWith('registry:reg-123');
    });
  });

  describe('productCache', () => {
    it('should handle product caching with long TTL', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedis = new Redis();
      
      vi.mocked(mockRedis.setex).mockResolvedValue('OK');
      
      const product = { id: 'prod-456', title: 'Gift Item' };
      await productCache.set('prod-456', product);
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'product:prod-456',
        86400, // long TTL (24 hours)
        JSON.stringify(product)
      );
    });
  });

  describe('cache warming', () => {
    it('should handle cache warming without errors', async () => {
      // Test that warmCache doesn't throw
      const { warmCache } = await import('~/lib/cache/redis.server');
      
      await expect(warmCache('test-shop')).resolves.not.toThrow();
    });
  });

  describe('health check', () => {
    it('should return true when Redis is healthy', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedis = new Redis();
      
      vi.mocked(mockRedis.ping).mockResolvedValue('PONG');
      
      const { checkRedisHealth } = await import('~/lib/cache/redis.server');
      const result = await checkRedisHealth();
      
      expect(result).toBe(true);
    });

    it('should return false when Redis is unhealthy', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedis = new Redis();
      
      vi.mocked(mockRedis.ping).mockRejectedValue(new Error('Connection failed'));
      
      const { checkRedisHealth } = await import('~/lib/cache/redis.server');
      const result = await checkRedisHealth();
      
      expect(result).toBe(false);
    });
  });
});