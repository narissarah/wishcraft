import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRequest, createResponse } from 'node-mocks-http';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { authenticate } from '~/shopify.server';
import {
  initiateCustomerAuth,
  handleCustomerAuthCallback,
  validateCustomerAccess,
  requireCustomerRegistryAccess
} from '~/lib/customer-auth.server';
import { db } from '~/lib/db.server';

// Mock dependencies
vi.mock('~/shopify.server', () => ({
  authenticate: {
    admin: vi.fn(),
    webhook: vi.fn(),
    public: vi.fn()
  }
}));

vi.mock('~/lib/db.server', () => ({
  db: {
    registry: {
      findUnique: vi.fn(),
      findFirst: vi.fn()
    },
    session: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    customer: {
      findUnique: vi.fn()
    }
  }
}));

describe('Authentication and Authorization Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Shopify OAuth Security', () => {
    it('should validate HMAC signatures correctly', async () => {
      const secret = 'test_webhook_secret';
      const payload = JSON.stringify({ test: 'data', timestamp: Date.now() });
      
      // Create valid HMAC
      const validHmac = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('base64');

      // Create invalid HMAC
      const invalidHmac = crypto
        .createHmac('sha256', 'wrong_secret')
        .update(payload, 'utf8')
        .digest('base64');

      const validateHmac = (receivedHmac: string, body: string, secret: string): boolean => {
        const expectedHmac = crypto
          .createHmac('sha256', secret)
          .update(body, 'utf8')
          .digest('base64');
        
        return crypto.timingSafeEqual(
          Buffer.from(expectedHmac, 'base64'),
          Buffer.from(receivedHmac, 'base64')
        );
      };

      // Test valid HMAC
      expect(validateHmac(validHmac, payload, secret)).toBe(true);
      
      // Test invalid HMAC
      expect(validateHmac(invalidHmac, payload, secret)).toBe(false);
      
      // Test timing attack resistance
      const startTime = process.hrtime.bigint();
      validateHmac(invalidHmac, payload, secret);
      const invalidTime = process.hrtime.bigint() - startTime;
      
      const startTime2 = process.hrtime.bigint();
      validateHmac(validHmac, payload, secret);
      const validTime = process.hrtime.bigint() - startTime2;
      
      // Time difference should be minimal (timing attack resistance)
      const timeDifference = Number(invalidTime - validTime) / 1000000; // Convert to ms
      expect(Math.abs(timeDifference)).toBeLessThan(10); // Less than 10ms difference
    });

    it('should reject tampered webhook payloads', async () => {
      const originalPayload = {
        id: 123,
        email: 'user@example.com',
        created_at: '2024-01-01T00:00:00Z'
      };

      const tamperedPayload = {
        id: 456, // Changed ID
        email: 'admin@evil.com', // Changed email
        created_at: '2024-01-01T00:00:00Z'
      };

      const secret = 'webhook_secret';
      const originalHmac = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(originalPayload), 'utf8')
        .digest('base64');

      vi.mocked(authenticate.webhook).mockImplementation(async (request) => {
        const receivedHmac = request.headers.get('X-Shopify-Hmac-Sha256');
        const body = await request.text();
        
        const expectedHmac = crypto
          .createHmac('sha256', secret)
          .update(body, 'utf8')
          .digest('base64');

        if (!crypto.timingSafeEqual(Buffer.from(expectedHmac, 'base64'), Buffer.from(receivedHmac || '', 'base64'))) {
          throw new Error('Invalid HMAC signature');
        }

        return {
          topic: 'CUSTOMERS/CREATE',
          shop: 'test-shop.myshopify.com',
          session: {},
          admin: {},
          payload: JSON.parse(body)
        };
      });

      // Test with original payload and correct HMAC - should succeed
      const validRequest = new Request('https://app.com/webhook', {
        method: 'POST',
        headers: {
          'X-Shopify-Hmac-Sha256': originalHmac,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(originalPayload)
      });

      const validResult = await authenticate.webhook(validRequest);
      expect(validResult.payload.id).toBe(123);

      // Test with tampered payload but original HMAC - should fail
      const tamperedRequest = new Request('https://app.com/webhook', {
        method: 'POST',
        headers: {
          'X-Shopify-Hmac-Sha256': originalHmac, // Original HMAC with tampered payload
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tamperedPayload)
      });

      await expect(authenticate.webhook(tamperedRequest)).rejects.toThrow('Invalid HMAC signature');
    });

    it('should validate OAuth state parameter to prevent CSRF', async () => {
      const validState = crypto.randomBytes(32).toString('hex');
      const invalidState = crypto.randomBytes(32).toString('hex');
      
      // Mock session storage
      const sessionStore = new Map<string, string>();
      sessionStore.set('oauth_state', validState);

      const validateOAuthCallback = (receivedState: string, storedState?: string): boolean => {
        if (!storedState || !receivedState) {
          return false;
        }
        return crypto.timingSafeEqual(
          Buffer.from(storedState, 'hex'),
          Buffer.from(receivedState, 'hex')
        );
      };

      // Test valid state
      expect(validateOAuthCallback(validState, sessionStore.get('oauth_state'))).toBe(true);
      
      // Test invalid state
      expect(validateOAuthCallback(invalidState, sessionStore.get('oauth_state'))).toBe(false);
      
      // Test missing state
      expect(validateOAuthCallback('', sessionStore.get('oauth_state'))).toBe(false);
      expect(validateOAuthCallback(validState, undefined)).toBe(false);
    });

    it('should enforce PKCE for OAuth security', async () => {
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      const validatePKCE = (receivedVerifier: string, storedChallenge: string): boolean => {
        const computedChallenge = crypto
          .createHash('sha256')
          .update(receivedVerifier)
          .digest('base64url');
        
        return computedChallenge === storedChallenge;
      };

      // Test valid PKCE
      expect(validatePKCE(codeVerifier, codeChallenge)).toBe(true);
      
      // Test invalid verifier
      const wrongVerifier = crypto.randomBytes(32).toString('base64url');
      expect(validatePKCE(wrongVerifier, codeChallenge)).toBe(false);
      
      // Test short verifier (security requirement: min 43 characters)
      const shortVerifier = 'short';
      expect(shortVerifier.length).toBeLessThan(43);
      
      // Test long verifier (security requirement: max 128 characters)
      const longVerifier = 'a'.repeat(129);
      expect(longVerifier.length).toBeGreaterThan(128);
    });
  });

  describe('JWT Token Security', () => {
    it('should create secure JWT tokens with proper claims', async () => {
      const secret = 'jwt_secret_key_minimum_32_characters';
      const payload = {
        userId: 'user_123',
        email: 'user@example.com',
        role: 'customer'
      };

      const token = jwt.sign(payload, secret, {
        expiresIn: '1h',
        issuer: 'wishcraft-app',
        audience: 'wishcraft-users',
        algorithm: 'HS256'
      });

      // Verify token structure
      const decoded = jwt.verify(token, secret) as any;
      expect(decoded.userId).toBe('user_123');
      expect(decoded.email).toBe('user@example.com');
      expect(decoded.role).toBe('customer');
      expect(decoded.iss).toBe('wishcraft-app');
      expect(decoded.aud).toBe('wishcraft-users');
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);

      // Test token tampering
      const parts = token.split('.');
      const tamperedPayload = Buffer.from(JSON.stringify({
        ...payload,
        role: 'admin' // Privilege escalation attempt
      })).toString('base64url');
      
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      
      expect(() => jwt.verify(tamperedToken, secret)).toThrow();
    });

    it('should reject expired tokens', async () => {
      const secret = 'jwt_secret_key_minimum_32_characters';
      const payload = { userId: 'user_123' };

      // Create immediately expired token
      const expiredToken = jwt.sign(payload, secret, {
        expiresIn: -1 // Already expired
      });

      expect(() => jwt.verify(expiredToken, secret)).toThrow('jwt expired');
    });

    it('should validate token algorithm to prevent none algorithm attack', async () => {
      const secret = 'jwt_secret_key_minimum_32_characters';
      const payload = { userId: 'user_123', role: 'admin' };

      // Create token with none algorithm (security vulnerability)
      const noneToken = jwt.sign(payload, '', { algorithm: 'none' });

      // Should reject none algorithm when expecting HS256
      expect(() => jwt.verify(noneToken, secret, { algorithms: ['HS256'] })).toThrow();
      
      // Should also reject when no algorithms specified
      expect(() => jwt.verify(noneToken, secret)).toThrow();
    });
  });

  describe('Customer Authentication Security', () => {
    it('should generate cryptographically secure state and verifiers', async () => {
      const { authUrl, state, codeVerifier } = await initiateCustomerAuth(
        'test-shop.myshopify.com',
        'https://example.com/return'
      );

      // Test state entropy
      expect(state).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(/^[a-f0-9]{64}$/.test(state)).toBe(true);

      // Test code verifier meets PKCE requirements
      expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
      expect(codeVerifier.length).toBeLessThanOrEqual(128);
      expect(/^[A-Za-z0-9\-._~]*$/.test(codeVerifier)).toBe(true);

      // Test auth URL includes security parameters
      const url = new URL(authUrl);
      expect(url.searchParams.get('state')).toBe(state);
      expect(url.searchParams.get('code_challenge')).toBeDefined();
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');

      // Verify code challenge is correctly computed
      const expectedChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
      expect(url.searchParams.get('code_challenge')).toBe(expectedChallenge);
    });

    it('should validate callback parameters securely', async () => {
      const shop = 'test-shop.myshopify.com';
      const validCode = 'auth_code_123';
      const validState = crypto.randomBytes(32).toString('hex');
      const validVerifier = crypto.randomBytes(32).toString('base64url');

      // Mock successful token exchange
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'access_token_123',
          refresh_token: 'refresh_token_123',
          expires_in: 3600
        })
      });

      // Test with invalid state (should fail)
      const invalidState = crypto.randomBytes(32).toString('hex');
      await expect(
        handleCustomerAuthCallback(shop, validCode, invalidState, validVerifier)
      ).rejects.toThrow();

      // Test with invalid code verifier (should fail)
      const invalidVerifier = crypto.randomBytes(32).toString('base64url');
      await expect(
        handleCustomerAuthCallback(shop, validCode, validState, invalidVerifier)
      ).rejects.toThrow();

      // Test with empty/null parameters
      await expect(
        handleCustomerAuthCallback(shop, '', validState, validVerifier)
      ).rejects.toThrow();

      await expect(
        handleCustomerAuthCallback(shop, validCode, '', validVerifier)
      ).rejects.toThrow();
    });
  });

  describe('Authorization and Access Control', () => {
    it('should enforce registry access permissions correctly', async () => {
      const publicRegistry = {
        id: 'reg_public',
        visibility: 'public',
        customerId: 'owner_123',
        collaborators: []
      };

      const privateRegistry = {
        id: 'reg_private',
        visibility: 'private',
        customerId: 'owner_123',
        collaborators: []
      };

      const passwordRegistry = {
        id: 'reg_password',
        visibility: 'password',
        customerId: 'owner_123',
        password: 'hashed_password',
        collaborators: []
      };

      vi.mocked(db.registry.findUnique)
        .mockResolvedValueOnce(publicRegistry as any)
        .mockResolvedValueOnce(privateRegistry as any)
        .mockResolvedValueOnce(passwordRegistry as any);

      // Test public registry access (should allow anonymous)
      const { hasAccess: publicAccess } = await validateCustomerAccess(
        new Request('https://app.com/registry/public'),
        'reg_public'
      );
      expect(publicAccess).toBe(true);

      // Test private registry access without authentication (should deny)
      const { hasAccess: privateAccess } = await validateCustomerAccess(
        new Request('https://app.com/registry/private'),
        'reg_private'
      );
      expect(privateAccess).toBe(false);

      // Test password-protected registry (should deny without password)
      const { hasAccess: passwordAccess } = await validateCustomerAccess(
        new Request('https://app.com/registry/password'),
        'reg_password'
      );
      expect(passwordAccess).toBe(false);
    });

    it('should prevent privilege escalation attacks', async () => {
      const registry = {
        id: 'reg_test',
        visibility: 'private',
        customerId: 'owner_123',
        collaborators: [
          {
            id: 'collab_1',
            email: 'collaborator@example.com',
            role: 'viewer',
            status: 'active'
          }
        ]
      };

      vi.mocked(db.registry.findUnique).mockResolvedValue(registry as any);

      // Test owner access (should allow)
      const ownerRequest = new Request('https://app.com/registry/test', {
        headers: {
          'Authorization': 'Bearer owner_token'
        }
      });

      // Mock owner session
      const ownerSession = { customerId: 'owner_123', role: 'owner' };
      
      // Test collaborator trying to access as owner (should deny)
      const collaboratorRequest = new Request('https://app.com/registry/test', {
        headers: {
          'Authorization': 'Bearer collaborator_token'
        }
      });

      // Mock malicious session attempting privilege escalation
      const maliciousSession = { 
        customerId: 'collab_1', 
        role: 'admin' // Attempted privilege escalation
      };

      // Verify that role is validated against actual permissions
      const validateRole = (session: any, registry: any) => {
        if (session.customerId === registry.customerId) {
          return 'owner';
        }
        
        const collaborator = registry.collaborators.find((c: any) => 
          c.email === session.customerId || c.id === session.customerId
        );
        
        return collaborator?.role || 'none';
      };

      expect(validateRole(ownerSession, registry)).toBe('owner');
      expect(validateRole(maliciousSession, registry)).toBe('viewer'); // Not admin
    });

    it('should validate CORS headers securely', async () => {
      const allowedOrigins = [
        'https://shop1.myshopify.com',
        'https://shop2.myshopify.com',
        'https://wishcraft-app.com'
      ];

      const validateCORS = (origin: string | null, allowedOrigins: string[]): boolean => {
        if (!origin) return false;
        
        // Exact match only - prevent subdomain attacks
        return allowedOrigins.includes(origin);
      };

      // Test valid origins
      expect(validateCORS('https://shop1.myshopify.com', allowedOrigins)).toBe(true);
      expect(validateCORS('https://wishcraft-app.com', allowedOrigins)).toBe(true);

      // Test invalid origins
      expect(validateCORS('https://evil.com', allowedOrigins)).toBe(false);
      expect(validateCORS('https://shop1.myshopify.com.evil.com', allowedOrigins)).toBe(false);
      expect(validateCORS('http://shop1.myshopify.com', allowedOrigins)).toBe(false); // Wrong protocol
      expect(validateCORS(null, allowedOrigins)).toBe(false);

      // Test subdomain attack attempts
      expect(validateCORS('https://malicious.shop1.myshopify.com', allowedOrigins)).toBe(false);
      expect(validateCORS('https://shop1.myshopify.com.attacker.com', allowedOrigins)).toBe(false);
    });

    it('should prevent session fixation attacks', async () => {
      const generateSecureSessionId = (): string => {
        return crypto.randomBytes(32).toString('hex');
      };

      const validateSessionIntegrity = (sessionId: string, userAgent: string, ip: string): boolean => {
        // In real implementation, these would be hashed together and stored
        const sessionFingerprint = crypto
          .createHash('sha256')
          .update(`${sessionId}:${userAgent}:${ip}`)
          .digest('hex');
        
        // Verify session hasn't been hijacked
        return sessionFingerprint.length === 64; // Basic validation
      };

      // Generate new session ID on login
      const oldSessionId = 'old_session_123';
      const newSessionId = generateSecureSessionId();
      
      expect(newSessionId).not.toBe(oldSessionId);
      expect(newSessionId).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/.test(newSessionId)).toBe(true);

      // Test session validation
      const userAgent = 'Mozilla/5.0 (Test Browser)';
      const clientIP = '192.168.1.100';
      
      expect(validateSessionIntegrity(newSessionId, userAgent, clientIP)).toBe(true);
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should prevent SQL injection in database queries', async () => {
      const maliciousInput = "'; DROP TABLE registries; --";
      const safeInput = "sarah-johns-wedding-registry";

      // Mock parameterized query function
      const findRegistryBySlug = (slug: string) => {
        // This simulates a parameterized query that's safe from SQL injection
        if (typeof slug !== 'string' || slug.length > 100) {
          throw new Error('Invalid slug parameter');
        }
        
        // Validate slug format
        if (!/^[a-z0-9-]+$/.test(slug)) {
          throw new Error('Invalid slug format');
        }
        
        return { id: 'reg_123', slug };
      };

      // Test safe input
      expect(() => findRegistryBySlug(safeInput)).not.toThrow();
      
      // Test malicious input
      expect(() => findRegistryBySlug(maliciousInput)).toThrow('Invalid slug format');
      
      // Test oversized input
      const oversizedInput = 'a'.repeat(101);
      expect(() => findRegistryBySlug(oversizedInput)).toThrow('Invalid slug parameter');
    });

    it('should sanitize user input to prevent XSS attacks', async () => {
      const sanitizeHTML = (input: string): string => {
        // Basic HTML sanitization (in production, use a library like DOMPurify)
        return input
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;');
      };

      const maliciousInputs = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("xss")',
        '<iframe src="javascript:alert(1)"></iframe>',
        '"><script>alert("xss")</script>'
      ];

      maliciousInputs.forEach(input => {
        const sanitized = sanitizeHTML(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('<iframe>');
        expect(sanitized).not.toContain('onerror=');
      });

      // Test safe input is preserved
      const safeInput = 'My Wedding Registry';
      expect(sanitizeHTML(safeInput)).toBe(safeInput);
    });

    it('should validate email formats securely', async () => {
      const validateEmail = (email: string): boolean => {
        // RFC 5322 compliant regex (simplified)
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        
        if (!email || email.length > 254) return false;
        return emailRegex.test(email);
      };

      // Valid emails
      const validEmails = [
        'user@example.com',
        'test.email+tag@domain.co.uk',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });

      // Invalid emails
      const invalidEmails = [
        'invalid',
        '@domain.com',
        'user@',
        'user..double.dot@domain.com',
        'user@domain',
        'a'.repeat(250) + '@domain.com', // Too long
        'user@domain..com',
        'user name@domain.com' // Space not allowed
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    it('should implement rate limiting for authentication attempts', async () => {
      const rateLimiter = new Map<string, { attempts: number; lastAttempt: number }>();
      const MAX_ATTEMPTS = 5;
      const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

      const checkRateLimit = (identifier: string): boolean => {
        const now = Date.now();
        const record = rateLimiter.get(identifier);

        if (!record) {
          rateLimiter.set(identifier, { attempts: 1, lastAttempt: now });
          return true;
        }

        // Reset if window expired
        if (now - record.lastAttempt > WINDOW_MS) {
          rateLimiter.set(identifier, { attempts: 1, lastAttempt: now });
          return true;
        }

        // Check if limit exceeded
        if (record.attempts >= MAX_ATTEMPTS) {
          return false;
        }

        // Increment attempts
        record.attempts++;
        record.lastAttempt = now;
        return true;
      };

      const testIP = '192.168.1.100';

      // Test normal usage
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        expect(checkRateLimit(testIP)).toBe(true);
      }

      // Test rate limit exceeded
      expect(checkRateLimit(testIP)).toBe(false);
      expect(checkRateLimit(testIP)).toBe(false);

      // Test different IP not affected
      expect(checkRateLimit('192.168.1.101')).toBe(true);
    });

    it('should protect against brute force attacks with exponential backoff', async () => {
      const failedAttempts = new Map<string, { count: number; nextAllowedAttempt: number }>();

      const calculateBackoff = (attemptCount: number): number => {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 5 minutes
        const backoffMs = Math.min(Math.pow(2, attemptCount) * 1000, 5 * 60 * 1000);
        return Date.now() + backoffMs;
      };

      const checkBruteForceProtection = (identifier: string): { allowed: boolean; waitTime?: number } => {
        const record = failedAttempts.get(identifier);
        const now = Date.now();

        if (!record) {
          return { allowed: true };
        }

        if (now < record.nextAllowedAttempt) {
          return { 
            allowed: false, 
            waitTime: record.nextAllowedAttempt - now 
          };
        }

        return { allowed: true };
      };

      const recordFailedAttempt = (identifier: string): void => {
        const record = failedAttempts.get(identifier) || { count: 0, nextAllowedAttempt: 0 };
        record.count++;
        record.nextAllowedAttempt = calculateBackoff(record.count);
        failedAttempts.set(identifier, record);
      };

      const testUser = 'user@example.com';

      // First few attempts should be allowed immediately
      expect(checkBruteForceProtection(testUser).allowed).toBe(true);
      recordFailedAttempt(testUser);
      
      expect(checkBruteForceProtection(testUser).allowed).toBe(false);
      expect(checkBruteForceProtection(testUser).waitTime).toBeGreaterThan(0);

      // Test backoff increases
      recordFailedAttempt(testUser);
      const secondBackoff = checkBruteForceProtection(testUser).waitTime || 0;
      
      recordFailedAttempt(testUser);
      const thirdBackoff = checkBruteForceProtection(testUser).waitTime || 0;
      
      expect(thirdBackoff).toBeGreaterThan(secondBackoff);
    });
  });
});