import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRemixStub } from '@remix-run/testing';
import { json } from '@remix-run/node';
import { loader, action } from '~/routes/api.registries';
import { db } from '~/lib/db.server';

/**
 * Integration tests for Registry API
 * Tests the complete flow including authentication, caching, and database operations
 */

// Mock Shopify authentication
vi.mock('~/shopify.server', () => ({
  authenticate: {
    admin: vi.fn().mockResolvedValue({
      admin: {},
      session: { 
        shop: 'test-shop.myshopify.com',
        id: 'session-123'
      },
    }),
  },
}));

// Mock database
vi.mock('~/lib/db.server', () => ({
  db: {
    registry: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock rate limiter
vi.mock('~/lib/rate-limiter.server', () => ({
  rateLimiter: {
    check: vi.fn().mockResolvedValue({ allowed: true }),
  },
}));

// Mock cache
vi.mock('~/lib/cache/redis.server', () => ({
  apiCache: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
  registryCache: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
}));

describe('API Registries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/registries', () => {
    it('should return cached registries when available', async () => {
      const { apiCache } = await import('~/lib/cache/redis.server');
      const cachedData = {
        registries: [
          {
            id: 'reg-1',
            name: 'Wedding Registry',
            customerId: 'cust-123',
            status: 'ACTIVE',
          },
        ],
        total: 1,
      };
      
      vi.mocked(apiCache.get).mockResolvedValue(cachedData);
      
      const request = new Request('https://app.test/api/registries');
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();
      
      expect(data).toEqual(cachedData);
      expect(apiCache.get).toHaveBeenCalledWith('registries:test-shop.myshopify.com');
      expect(db.registry.findMany).not.toHaveBeenCalled();
    });

    it('should fetch from database when cache miss', async () => {
      const { apiCache } = await import('~/lib/cache/redis.server');
      vi.mocked(apiCache.get).mockResolvedValue(null);
      
      const dbRegistries = [
        {
          id: 'reg-1',
          shopId: 'test-shop.myshopify.com',
          customerId: 'cust-123',
          name: 'Birthday Registry',
          eventDate: new Date('2025-12-25'),
          status: 'ACTIVE',
          privacy: 'PUBLIC',
          preferences: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [],
          purchases: [],
        },
      ];
      
      vi.mocked(db.registry.findMany).mockResolvedValue(dbRegistries);
      
      const request = new Request('https://app.test/api/registries');
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();
      
      expect(data.registries).toHaveLength(1);
      expect(data.registries[0].name).toBe('Birthday Registry');
      expect(db.registry.findMany).toHaveBeenCalledWith({
        where: { shopId: 'test-shop.myshopify.com' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
      expect(apiCache.set).toHaveBeenCalled();
    });

    it('should handle rate limiting', async () => {
      const { rateLimiter } = await import('~/lib/rate-limiter.server');
      vi.mocked(rateLimiter.check).mockResolvedValue({ allowed: false });
      
      const request = new Request('https://app.test/api/registries');
      const response = await loader({ request, params: {}, context: {} });
      
      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe('Too many requests');
    });

    it('should handle database errors gracefully', async () => {
      const { apiCache } = await import('~/lib/cache/redis.server');
      vi.mocked(apiCache.get).mockResolvedValue(null);
      vi.mocked(db.registry.findMany).mockRejectedValue(new Error('Database error'));
      
      const request = new Request('https://app.test/api/registries');
      const response = await loader({ request, params: {}, context: {} });
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch registries');
    });
  });

  describe('POST /api/registries', () => {
    it('should create a new registry', async () => {
      const newRegistry = {
        id: 'reg-new',
        shopId: 'test-shop.myshopify.com',
        customerId: 'cust-456',
        name: 'Anniversary Registry',
        eventDate: null,
        status: 'ACTIVE',
        privacy: 'PUBLIC',
        preferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      vi.mocked(db.registry.create).mockResolvedValue(newRegistry);
      
      const formData = new FormData();
      formData.append('name', 'Anniversary Registry');
      formData.append('customerId', 'cust-456');
      
      const request = new Request('https://app.test/api/registries', {
        method: 'POST',
        body: formData,
      });
      
      const response = await action({ request, params: {}, context: {} });
      
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.registry.name).toBe('Anniversary Registry');
      
      expect(db.registry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Anniversary Registry',
          customerId: 'cust-456',
          shopId: 'test-shop.myshopify.com',
        }),
      });
      
      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'REGISTRY_CREATED',
          resource: 'registry',
        }),
      });
    });

    it('should validate required fields', async () => {
      const formData = new FormData();
      formData.append('name', 'Test Registry');
      // Missing customerId
      
      const request = new Request('https://app.test/api/registries', {
        method: 'POST',
        body: formData,
      });
      
      const response = await action({ request, params: {}, context: {} });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Name and customer ID are required');
    });

    it('should invalidate cache after creation', async () => {
      const { apiCache } = await import('~/lib/cache/redis.server');
      
      vi.mocked(db.registry.create).mockResolvedValue({
        id: 'reg-new',
        shopId: 'test-shop.myshopify.com',
        customerId: 'cust-789',
        name: 'New Registry',
        eventDate: null,
        status: 'ACTIVE',
        privacy: 'PUBLIC',
        preferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      const formData = new FormData();
      formData.append('name', 'New Registry');
      formData.append('customerId', 'cust-789');
      
      const request = new Request('https://app.test/api/registries', {
        method: 'POST',
        body: formData,
      });
      
      await action({ request, params: {}, context: {} });
      
      expect(apiCache.invalidate).toHaveBeenCalledWith('registries:test-shop.myshopify.com');
    });

    it('should handle non-POST methods', async () => {
      const request = new Request('https://app.test/api/registries', {
        method: 'GET',
      });
      
      const response = await action({ request, params: {}, context: {} });
      
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.error).toBe('Method not allowed');
    });
  });
});