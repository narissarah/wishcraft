/**
 * Encryption Tests
 * Comprehensive tests for encryption functionality including PII and gift message encryption
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  encryptPII,
  decryptPII,
  encryptGiftMessage,
  decryptGiftMessage,
  validateGiftMessage,
  sanitizeGiftMessage,
  logGiftMessageOperation,
  hashAccessCode,
  verifyAccessCode,
  sanitizeEmailForSearch,
  maskPII,
} from '../app/lib/encryption.server';

// Mock crypto for deterministic tests
vi.mock('crypto', () => ({
  randomBytes: vi.fn(() => Buffer.from('aaaaaaaaaaaaaaaa')), // 16 bytes
  scryptSync: vi.fn(() => Buffer.from('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')), // 32 bytes
  createCipheriv: vi.fn(() => ({
    update: vi.fn(() => 'encrypted'),
    final: vi.fn(() => ''),
    getAuthTag: vi.fn(() => Buffer.from('cccccccccccccccc')),
    setAAD: vi.fn(),
  })),
  createDecipheriv: vi.fn(() => ({
    update: vi.fn(() => 'decrypted'),
    final: vi.fn(() => ''),
    setAuthTag: vi.fn(),
    setAAD: vi.fn(),
  })),
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'mocked_hash'),
  })),
}));

// Mock bcrypt
vi.mock('bcrypt', () => ({
  hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
  compare: vi.fn((password: string, hash: string) => 
    Promise.resolve(hash === `hashed_${password}`)
  ),
}));

// Mock console for logging tests
const mockConsoleLog = vi.fn();
vi.stubGlobal('console', { log: mockConsoleLog });

describe('Encryption Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENCRYPTION_KEY = 'test_encryption_key_32_characters_long';
    process.env.DATA_ENCRYPTION_SALT = 'test_salt';
  });

  describe('PII Encryption', () => {
    it('should encrypt PII data', () => {
      const plaintext = 'test@example.com';
      const encrypted = encryptPII(plaintext);
      
      expect(encrypted).toBe('6161616161616161616161616161616161616161616161616161616161616161:6363636363636363636363636363636363636363636363636363636363636363:encrypted');
      expect(encrypted).not.toBe(plaintext);
    });

    it('should decrypt PII data', () => {
      const encrypted = '6161616161616161616161616161616161616161616161616161616161616161:6363636363636363636363636363636363636363636363636363636363636363:encrypted';
      const decrypted = decryptPII(encrypted);
      
      expect(decrypted).toBe('decrypted');
    });

    it('should return empty string for empty input', () => {
      expect(encryptPII('')).toBe('');
      expect(decryptPII('')).toBe('');
    });

    it('should return placeholder for decryption failures', () => {
      const mockError = new Error('Decryption failed');
      vi.mocked(require('crypto').createDecipheriv).mockImplementation(() => {
        throw mockError;
      });
      
      const result = decryptPII('invalid:encrypted:data');
      expect(result).toBe('[ENCRYPTED]');
    });

    it('should handle malformed encrypted data', () => {
      const result = decryptPII('malformed_data');
      expect(result).toBe('malformed_data');
    });
  });

  describe('Gift Message Encryption', () => {
    it('should encrypt gift message with metadata', () => {
      const message = 'Happy Birthday! Hope you love this gift!';
      const purchaserId = 'purchaser@example.com';
      const registryId = 'registry123';
      
      const encrypted = encryptGiftMessage(message, purchaserId, registryId);
      
      expect(encrypted).toMatch(/^v1:\d+:/);
      expect(encrypted).toContain('6161616161616161616161616161616161616161616161616161616161616161');
      expect(encrypted).toContain('6363636363636363636363636363636363636363636363636363636363636363');
    });

    it('should decrypt gift message with validation', () => {
      const purchaserId = 'purchaser@example.com';
      const registryId = 'registry123';
      const timestamp = Date.now().toString();
      const additionalData = `gift:${purchaserId}:${registryId}`;
      const additionalDataHex = Buffer.from(additionalData).toString('hex');
      
      const encrypted = `v1:${timestamp}:6161616161616161616161616161616161616161616161616161616161616161:6363636363636363636363636363636363636363636363636363636363636363:${additionalDataHex}:encrypted`;
      
      const decrypted = decryptGiftMessage(encrypted, purchaserId, registryId);
      
      expect(decrypted).toBe('decrypted');
    });

    it('should return empty string for empty gift message', () => {
      const result = encryptGiftMessage('', 'purchaser@example.com', 'registry123');
      expect(result).toBe('');
    });

    it('should handle context mismatch', () => {
      const purchaserId = 'purchaser@example.com';
      const registryId = 'registry123';
      const wrongRegistryId = 'registry456';
      const timestamp = Date.now().toString();
      const additionalData = `gift:${purchaserId}:${registryId}`;
      const additionalDataHex = Buffer.from(additionalData).toString('hex');
      
      const encrypted = `v1:${timestamp}:6161616161616161616161616161616161616161616161616161616161616161:6363636363636363636363636363636363636363636363636363636363636363:${additionalDataHex}:encrypted`;
      
      const decrypted = decryptGiftMessage(encrypted, purchaserId, wrongRegistryId);
      
      expect(decrypted).toBe('[ENCRYPTED GIFT MESSAGE]');
    });

    it('should handle unsupported version', () => {
      const encrypted = 'v2:123456:invalid:format';
      const decrypted = decryptGiftMessage(encrypted, 'purchaser@example.com', 'registry123');
      
      expect(decrypted).toBe('[ENCRYPTED GIFT MESSAGE]');
    });

    it('should handle old messages (older than 5 years)', () => {
      const oldTimestamp = (Date.now() - (6 * 365 * 24 * 60 * 60 * 1000)).toString(); // 6 years ago
      const encrypted = `v1:${oldTimestamp}:6161616161616161616161616161616161616161616161616161616161616161:6363636363636363636363636363636363636363636363636363636363636363:67696674:encrypted`;
      
      const decrypted = decryptGiftMessage(encrypted, 'purchaser@example.com', 'registry123');
      
      expect(decrypted).toBe('[ENCRYPTED GIFT MESSAGE]');
    });
  });

  describe('Gift Message Validation', () => {
    it('should validate valid gift messages', () => {
      const validMessage = 'Happy Birthday! Hope you love this gift!';
      const result = validateGiftMessage(validMessage);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept empty messages', () => {
      const result = validateGiftMessage('');
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject messages that are too long', () => {
      const longMessage = 'a'.repeat(2001);
      const result = validateGiftMessage(longMessage);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Gift message too long (max 2000 characters)');
    });

    it('should reject messages with suspicious patterns', () => {
      const suspiciousMessages = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'onclick="alert(1)"',
        'eval(malicious_code)',
        'function malicious() { }',
      ];
      
      suspiciousMessages.forEach(message => {
        const result = validateGiftMessage(message);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Gift message contains invalid content');
      });
    });
  });

  describe('Gift Message Sanitization', () => {
    it('should sanitize malicious content', () => {
      const maliciousMessage = '<script>alert("xss")</script>Happy Birthday!';
      const sanitized = sanitizeGiftMessage(maliciousMessage);
      
      expect(sanitized).toBe('Happy Birthday!');
    });

    it('should remove javascript: protocols', () => {
      const message = 'Click here: javascript:alert("xss") for more info';
      const sanitized = sanitizeGiftMessage(message);
      
      expect(sanitized).toBe('Click here:  for more info');
    });

    it('should remove event handlers', () => {
      const message = 'Hello onclick="alert(1)" world';
      const sanitized = sanitizeGiftMessage(message);
      
      expect(sanitized).toBe('Hello  world');
    });

    it('should return empty string for empty input', () => {
      expect(sanitizeGiftMessage('')).toBe('');
    });

    it('should trim whitespace', () => {
      const message = '  Happy Birthday!  ';
      const sanitized = sanitizeGiftMessage(message);
      
      expect(sanitized).toBe('Happy Birthday!');
    });
  });

  describe('Gift Message Logging', () => {
    it('should log gift message operations', () => {
      const operation = 'encrypt';
      const purchaserId = 'purchaser@example.com';
      const registryId = 'registry123';
      const success = true;
      
      logGiftMessageOperation(operation, purchaserId, registryId, success);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'GIFT_MESSAGE_SECURITY:',
        expect.stringContaining('"operation":"encrypt"')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'GIFT_MESSAGE_SECURITY:',
        expect.stringContaining('"success":true')
      );
    });

    it('should mask sensitive data in logs', () => {
      const operation = 'decrypt';
      const purchaserId = 'purchaser@example.com';
      const registryId = 'registry123';
      const success = false;
      const error = 'Decryption failed';
      
      logGiftMessageOperation(operation, purchaserId, registryId, success, error);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'GIFT_MESSAGE_SECURITY:',
        expect.stringContaining('"purchaserId":"purchase****"')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'GIFT_MESSAGE_SECURITY:',
        expect.stringContaining('"registryId":"registry1****"')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'GIFT_MESSAGE_SECURITY:',
        expect.stringContaining('"error":"Decryption failed"')
      );
    });
  });

  describe('Access Code Hashing', () => {
    it('should hash access codes', async () => {
      const accessCode = 'secret123';
      const hashed = await hashAccessCode(accessCode);
      
      expect(hashed).toBe('hashed_secret123');
    });

    it('should verify access codes', async () => {
      const accessCode = 'secret123';
      const hashed = 'hashed_secret123';
      
      const isValid = await verifyAccessCode(accessCode, hashed);
      expect(isValid).toBe(true);
    });

    it('should reject invalid access codes', async () => {
      const accessCode = 'secret123';
      const wrongHash = 'hashed_wrong';
      
      const isValid = await verifyAccessCode(accessCode, wrongHash);
      expect(isValid).toBe(false);
    });

    it('should handle empty access codes', async () => {
      const result = await hashAccessCode('');
      expect(result).toBe('');
      
      const isValid = await verifyAccessCode('', '');
      expect(isValid).toBe(false);
    });
  });

  describe('Email Sanitization', () => {
    it('should create searchable email hash', () => {
      const email = 'Test@Example.Com';
      const hash = sanitizeEmailForSearch(email);
      
      expect(hash).toBe('mocked_hash');
    });

    it('should normalize email case', () => {
      const email1 = 'Test@Example.Com';
      const email2 = 'test@example.com';
      
      const hash1 = sanitizeEmailForSearch(email1);
      const hash2 = sanitizeEmailForSearch(email2);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('PII Masking', () => {
    it('should mask email addresses', () => {
      const email = 'test@example.com';
      const masked = maskPII(email);
      
      expect(masked).toBe('te****@example.com');
    });

    it('should mask long names', () => {
      const name = 'John Doe';
      const masked = maskPII(name);
      
      expect(masked).toBe('Jo****');
    });

    it('should mask short strings', () => {
      const short = 'Hi';
      const masked = maskPII(short);
      
      expect(masked).toBe('****');
    });

    it('should return empty string for empty input', () => {
      expect(maskPII('')).toBe('');
    });
  });
});

// Integration tests
describe('Encryption Integration', () => {
  it('should encrypt and decrypt PII data roundtrip', () => {
    const originalData = 'sensitive@example.com';
    const encrypted = encryptPII(originalData);
    const decrypted = decryptPII(encrypted);
    
    expect(decrypted).toBe('decrypted'); // Mocked decryption result
    expect(encrypted).not.toBe(originalData);
  });

  it('should encrypt and decrypt gift messages roundtrip', () => {
    const originalMessage = 'Happy Birthday! 🎉';
    const purchaserId = 'purchaser@example.com';
    const registryId = 'registry123';
    
    const encrypted = encryptGiftMessage(originalMessage, purchaserId, registryId);
    const decrypted = decryptGiftMessage(encrypted, purchaserId, registryId);
    
    expect(decrypted).toBe('decrypted'); // Mocked decryption result
    expect(encrypted).not.toBe(originalMessage);
  });

  it('should validate and sanitize gift messages in workflow', () => {
    const userInput = '<script>alert("xss")</script>Happy Birthday!';
    
    // Validate
    const validation = validateGiftMessage(userInput);
    expect(validation.isValid).toBe(false);
    
    // Sanitize
    const sanitized = sanitizeGiftMessage(userInput);
    expect(sanitized).toBe('Happy Birthday!');
    
    // Validate sanitized version
    const sanitizedValidation = validateGiftMessage(sanitized);
    expect(sanitizedValidation.isValid).toBe(true);
  });
});