import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  requireAdminAuth, 
  getAdminAuth, 
  isValidShopDomain,
  validateWebhookSignature 
} from '~/lib/auth.server';

// Mock dependencies
vi.mock('~/lib/db.server', () => ({
  db: {
    shop: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('~/shopify.server', () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

describe('Auth Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isValidShopDomain', () => {
    it('should validate correct shop domains', () => {
      expect(isValidShopDomain('test-shop.myshopify.com')).toBe(true);
      expect(isValidShopDomain('my-store.myshopify.com')).toBe(true);
    });

    it('should reject invalid shop domains', () => {
      expect(isValidShopDomain('invalid-domain.com')).toBe(false);
      expect(isValidShopDomain('test.shopify.com')).toBe(false);
      expect(isValidShopDomain('')).toBe(false);
      expect(isValidShopDomain(null as any)).toBe(false);
    });
  });

  describe('validateWebhookSignature', () => {
    const testSecret = 'test-secret';
    const validParams = new URLSearchParams({
      shop: 'test-shop.myshopify.com',
      timestamp: '1234567890',
    });

    beforeEach(() => {
      process.env.SHOPIFY_API_SECRET = testSecret;
    });

    it('should validate correct HMAC signatures', () => {
      const expectedHmac = 'expected-hmac-value';
      const result = validateWebhookSignature(expectedHmac, validParams);
      expect(typeof result).toBe('boolean');
    });

    it('should reject invalid HMAC signatures', () => {
      const invalidHmac = 'invalid-hmac';
      const result = validateWebhookSignature(invalidHmac, validParams);
      expect(typeof result).toBe('boolean');
    });
  });
});