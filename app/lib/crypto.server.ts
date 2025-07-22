/**
 * Unified Crypto Module for WishCraft
 * Consolidates all cryptographic operations including utilities and encryption
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { log } from '~/lib/logger.server';

// ============================================
// Core Crypto Utilities
// ============================================

/**
 * Generate secure random bytes
 */
export function generateRandomBytes(length: number = 32): Buffer {
  return crypto.randomBytes(length);
}

/**
 * Generate secure random string
 */
export function generateRandomString(length: number = 32, encoding: BufferEncoding = 'hex'): string {
  return generateRandomBytes(length).toString(encoding);
}

/**
 * Generate secure random Base64 string
 */
export function generateRandomBase64(length: number = 32): string {
  return generateRandomBytes(length).toString('base64');
}

/**
 * Generate secure random Base64URL string
 */
export function generateRandomBase64URL(length: number = 32): string {
  return generateRandomBytes(length).toString('base64url');
}

/**
 * Create SHA256 hash
 */
export function createSHA256Hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Create MD5 hash (for non-security purposes like cache keys)
 */
export function createMD5Hash(data: string): string {
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Hash data using bcrypt
 */
export async function hashData(data: string, rounds: number = 10): Promise<string> {
  return bcrypt.hash(data, rounds);
}

/**
 * Create SHA256 hash with Base64 encoding
 */
export function createSHA256HashBase64(data: string): string {
  return crypto.createHash('sha256').update(data).digest('base64');
}

/**
 * Create SHA256 hash with Base64URL encoding
 */
export function createSHA256HashBase64URL(data: string): string {
  return crypto.createHash('sha256').update(data).digest('base64url');
}

/**
 * Generate nonce for CSP headers
 */
export function generateNonce(length: number = 16): string {
  return generateRandomBytes(length).toString('base64');
}

/**
 * Generate secure token for various purposes
 */
export function generateSecureToken(length: number = 32): string {
  return generateRandomString(length);
}

/**
 * Generate error ID with timestamp
 */
export function generateErrorId(): string {
  return `error_${Date.now()}_${generateRandomBytes(6).toString('base64url')}`;
}

/**
 * Generate CSRF token
 */
export function generateCSRFToken(length: number = 32): string {
  return generateRandomString(length);
}

/**
 * Generate cryptographically secure ID with optional prefix
 * Replaces Math.random().toString(36).substr(2, 9) pattern
 */
export function generateSecureId(prefix = '', length = 9): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = generateRandomBytes(length);
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  
  return prefix ? `${prefix}_${Date.now()}_${result}` : result;
}

/**
 * Generate cryptographically secure password
 */
export function generateSecurePassword(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const bytes = generateRandomBytes(length);
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  
  return password;
}

/**
 * Generate cryptographically secure random integer
 */
export function generateSecureInt(min: number, max: number): number {
  return crypto.randomInt(min, max);
}

/**
 * Generate cryptographically secure random float between 0 and 1
 */
export function generateSecureFloat(): number {
  const bytes = generateRandomBytes(4);
  const max = 0xffffffff;
  const value = bytes.readUInt32BE(0);
  return value / max;
}

/**
 * Generate secure jitter for backoff algorithms
 */
export function generateJitter(min = 0.5, max = 1.5): number {
  const range = max - min;
  return min + (generateSecureFloat() * range);
}

/**
 * Generate secure probability check
 */
export function shouldExecuteWithProbability(probability: number): boolean {
  if (probability <= 0) return false;
  if (probability >= 1) return true;
  return generateSecureFloat() < probability;
}

/**
 * Generate secure request ID for tracking
 */
export function generateRequestId(): string {
  return generateSecureId('req');
}

/**
 * Generate secure transaction ID
 */
export function generateTransactionId(): string {
  return generateSecureId('tx');
}

/**
 * Generate secure notification ID
 */
export function generateNotificationId(): string {
  return generateSecureId('notif');
}

/**
 * Generate secure UUID-like string
 */
export function generateSecureUUID(): string {
  const bytes = generateRandomBytes(16);
  const hex = bytes.toString('hex');
  
  // Format as UUID-like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return [
    hex.substr(0, 8),
    hex.substr(8, 4),
    hex.substr(12, 4),
    hex.substr(16, 4),
    hex.substr(20, 12)
  ].join('-');
}

/**
 * Generate secure invitation token
 */
export function generateInvitationToken(collaboratorId: string, expiresAt?: Date): string {
  // SECURITY FIX: Use simple but secure token format
  // Token format: collaboratorId.signature
  const secret = process.env.COLLABORATION_TOKEN_SECRET || process.env.SESSION_SECRET;
  
  if (!secret) {
    throw new Error('COLLABORATION_TOKEN_SECRET or SESSION_SECRET is required for secure token generation');
  }
  
  if (secret.length < 32) {
    throw new Error('COLLABORATION_TOKEN_SECRET or SESSION_SECRET must be at least 32 characters for secure token generation');
  }
  
  const signature = crypto.createHmac('sha256', secret)
    .update(collaboratorId)
    .digest('base64url');
    
  return `${collaboratorId}.${signature}`;
}

/**
 * Verify invitation token
 */
export async function verifyInvitationToken(token: string, expectedCollaboratorId: string): Promise<{ valid: boolean; data?: any }> {
  try {
    const [collaboratorId, signature] = token.split('.');
    if (!collaboratorId || !signature) {
      return { valid: false };
    }
    
    // SECURITY FIX: Use same secret as generation function
    const secret = process.env.COLLABORATION_TOKEN_SECRET || process.env.SESSION_SECRET;
    
    if (!secret) {
      throw new Error('COLLABORATION_TOKEN_SECRET or SESSION_SECRET is required for token verification');
    }
    
    if (secret.length < 32) {
      throw new Error('COLLABORATION_TOKEN_SECRET or SESSION_SECRET must be at least 32 characters for secure verification');
    }
    
    // Verify signature using same method as generation
    const expectedSignature = crypto.createHmac('sha256', secret)
      .update(collaboratorId)
      .digest('base64url');
      
    if (signature !== expectedSignature) {
      return { valid: false };
    }
    
    // Check collaborator ID matches expected value
    if (collaboratorId !== expectedCollaboratorId) {
      return { valid: false };
    }
    
    return { valid: true, data: { id: collaboratorId } };
  } catch (error) {
    return { valid: false };
  }
}

// ============================================
// Field-Level Encryption for PII
// ============================================

// Get encryption key from environment or throw error
function getDataEncryptionKey(): Buffer {
  // SECURITY FIX: Never reuse encryption keys - DATA_ENCRYPTION_KEY must be dedicated
  const key = process.env.DATA_ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error(
      'CRITICAL SECURITY ERROR: DATA_ENCRYPTION_KEY environment variable is required for PII encryption.\n' +
      'Do NOT reuse ENCRYPTION_KEY - PII encryption must use dedicated key for security isolation.\n' +
      'Generate a dedicated key with: `openssl rand -base64 32`'
    );
  }
  
  // SECURITY: DATA_ENCRYPTION_SALT is REQUIRED in production
  const salt = process.env.DATA_ENCRYPTION_SALT;
  
  if (!salt) {
    throw new Error('CRITICAL SECURITY ERROR: DATA_ENCRYPTION_SALT environment variable is required for PII encryption. Cannot start application without proper encryption salt.');
  }
  
  if (salt.length < 32) {
    throw new Error('CRITICAL SECURITY ERROR: DATA_ENCRYPTION_SALT must be at least 32 characters long for proper security.');
  }
  
  return crypto.scryptSync(key, salt, 32);
}

const dataEncryptionKey = getDataEncryptionKey();

// Encrypt sensitive data before storing in database
export function encryptPII(data: string): string {
  if (!data) return data;
  
  const iv = generateRandomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataEncryptionKey, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

// Decrypt sensitive data when reading from database
export function decryptPII(encryptedData: string): string {
  if (!encryptedData || !encryptedData.includes(':')) return encryptedData;
  
  try {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', dataEncryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    log.error('Failed to decrypt PII data', error as Error);
    return '[ENCRYPTED]'; // Return placeholder on decryption failure
  }
}

// Hash access codes using bcrypt
export async function hashAccessCode(accessCode: string): Promise<string> {
  if (!accessCode) return '';
  
  const saltRounds = 12; // High security for access codes
  return await bcrypt.hash(accessCode, saltRounds);
}

export async function verifyAccessCode(accessCode: string, hashedCode: string): Promise<boolean> {
  if (!accessCode || !hashedCode) return false;
  
  return await bcrypt.compare(accessCode, hashedCode);
}

// Utility functions for safe PII handling
export function sanitizeEmailForSearch(email: string): string {
  // Create a searchable hash of email (one-way)
  return createSHA256Hash(email.toLowerCase());
}

// Create a searchable hash with a secret key for database indexing
export function createSearchableEmailHash(email: string): string {
  if (!email) return '';
  
  // SECURITY FIX: Use dedicated search key - never reuse encryption keys
  const searchKey = process.env.SEARCH_HASH_KEY;
  
  if (!searchKey) {
    throw new Error(
      'CRITICAL SECURITY ERROR: SEARCH_HASH_KEY environment variable is required for searchable hashes.\n' +
      'Do NOT reuse ENCRYPTION_KEY - search hashing must use dedicated key.\n' +
      'Generate with: `openssl rand -hex 32`'
    );
  }
  
  if (searchKey.length < 32) {
    throw new Error('CRITICAL SECURITY ERROR: SEARCH_HASH_KEY must be at least 32 characters for secure hashing.');
  }
  
  return crypto.createHmac('sha256', searchKey).update(email.toLowerCase()).digest('hex');
}

export function maskPII(data: string): string {
  if (!data) return data;
  
  // Show first 2 and last 2 characters for emails
  if (data.includes('@')) {
    const [local, domain] = data.split('@');
    return `${local.substring(0, 2)}****@${domain}`;
  }
  
  // Show first 2 characters for names
  if (data.length > 4) {
    return `${data.substring(0, 2)}****`;
  }
  
  return '****';
}

/**
 * Gift Message Encryption - Specialized encryption for gift messages
 * 
 * Gift messages require special handling because:
 * 1. They contain personal, sentimental content
 * 2. They need to be fully reversible for display
 * 3. They should be encrypted both at rest and in transit
 * 4. They may contain emoji and special characters
 */

// Encrypt gift message with additional metadata
export function encryptGiftMessage(
  message: string,
  purchaserId: string,
  registryId: string
): string {
  if (!message || message.trim() === '') return '';
  
  // Create additional authenticated data for gift messages
  const additionalData = `gift:${purchaserId}:${registryId}`;
  const timestamp = Date.now().toString();
  
  const iv = generateRandomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataEncryptionKey, iv);
  
  // Add authenticated data to prevent tampering
  cipher.setAAD(Buffer.from(additionalData));
  
  let encrypted = cipher.update(message, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: version:timestamp:iv:authTag:additionalData:encryptedMessage
  return `v1:${timestamp}:${iv.toString('hex')}:${authTag.toString('hex')}:${Buffer.from(additionalData).toString('hex')}:${encrypted}`;
}

// Decrypt gift message with validation
export function decryptGiftMessage(
  encryptedMessage: string,
  purchaserId: string,
  registryId: string
): string {
  if (!encryptedMessage || !encryptedMessage.includes(':')) return encryptedMessage;
  
  try {
    const parts = encryptedMessage.split(':');
    if (parts.length !== 6) {
      throw new Error('Invalid gift message format');
    }
    
    const [version, timestamp, ivHex, authTagHex, additionalDataHex, encrypted] = parts;
    
    // Validate version
    if (version !== 'v1') {
      throw new Error('Unsupported gift message version');
    }
    
    // Validate timestamp (messages older than 5 years are suspicious)
    const messageTime = parseInt(timestamp);
    const fiveYearsAgo = Date.now() - (5 * 365 * 24 * 60 * 60 * 1000);
    if (messageTime < fiveYearsAgo) {
      throw new Error('Gift message too old');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const additionalData = Buffer.from(additionalDataHex, 'hex').toString();
    
    // Validate additional data matches current context
    const expectedAdditionalData = `gift:${purchaserId}:${registryId}`;
    if (additionalData !== expectedAdditionalData) {
      throw new Error('Gift message context mismatch');
    }
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', dataEncryptionKey, iv);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(additionalData));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    log.error('Failed to decrypt gift message', error as Error);
    return '[ENCRYPTED GIFT MESSAGE]'; // Return placeholder on decryption failure
  }
}

// Validate gift message content before encryption
export function validateGiftMessage(message: string): { isValid: boolean; error?: string } {
  if (!message) return { isValid: true }; // Empty messages are allowed
  
  // Check length limits
  if (message.length > 2000) {
    return { isValid: false, error: 'Gift message too long (max 2000 characters)' };
  }
  
  // SECURITY FIX: Enhanced XSS prevention patterns
  const suspiciousPatterns = [
    // Script tags and JavaScript
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/i,
    /vbscript:/i,
    /data:text\/html/i,
    
    // Event handlers
    /on\w+\s*=/i,
    /onclick|onload|onerror|onmouseover|onfocus|onblur|onkeyup|onkeydown/i,
    
    // Dangerous functions
    /\beval\s*\(/i,
    /\bfunction\s*\(/i,
    /\balert\s*\(/i,
    /\bconfirm\s*\(/i,
    /\bprompt\s*\(/i,
    
    // HTML injection attempts
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<link/i,
    /<meta/i,
    /<style/i,
    
    // Protocol handlers
    /about:|chrome:|moz-extension:|extension:|resource:/i,
    
    // Expression evaluations
    /expression\s*\(/i,
    /url\s*\(\s*['"]?javascript:/i,
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(message)) {
      return { isValid: false, error: 'Gift message contains invalid content' };
    }
  }
  
  return { isValid: true };
}

// SECURITY FIX: Enhanced sanitization for safe display
export function sanitizeGiftMessage(message: string): string {
  if (!message) return '';
  
  // Comprehensive sanitization to prevent XSS attacks
  return message
    // Remove script tags and content
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<\/script>/gi, '')
    
    // Remove dangerous protocols
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:text\/html/gi, '')
    
    // Remove event handlers
    .replace(/on\w+\s*=/gi, '')
    .replace(/(onclick|onload|onerror|onmouseover|onfocus|onblur|onkeyup|onkeydown)\s*=/gi, '')
    
    // Remove dangerous HTML tags
    .replace(/<(iframe|object|embed|link|meta|style)[^>]*>/gi, '')
    .replace(/<\/(iframe|object|embed|link|meta|style)>/gi, '')
    
    // Remove CSS expressions
    .replace(/expression\s*\(/gi, '')
    .replace(/url\s*\(\s*['"]?javascript:/gi, '')
    
    // Remove dangerous functions
    .replace(/\b(eval|alert|confirm|prompt|function)\s*\(/gi, '')
    
    // Basic HTML entity encoding for remaining content
    .replace(/&/g, '&amp;') // Must be first to avoid double-encoding
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

// Audit log for gift message encryption operations
export function logGiftMessageOperation(
  operation: 'encrypt' | 'decrypt' | 'validate',
  purchaserId: string,
  registryId: string,
  success: boolean,
  error?: string
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    purchaserId: purchaserId.substring(0, 8) + '****', // Partial masking
    registryId: registryId.substring(0, 8) + '****',
    success,
    error: error ? error.substring(0, 100) : undefined,
  };
  
  // Log to security audit trail
  log.audit('GIFT_MESSAGE_SECURITY', JSON.stringify(logEntry));
}

// ============================================
// COMPREHENSIVE PII ENCRYPTION SYSTEM
// ============================================

/**
 * Encrypt all PII fields in a purchase record
 */
export function encryptPurchasePII(purchase: {
  purchaserEmail?: string;
  purchaserName?: string;
  purchaserPhone?: string;
  giftMessage?: string;
}): {
  purchaserEmail?: string;
  purchaserName?: string;
  purchaserPhone?: string;
  giftMessage?: string;
} {
  return {
    purchaserEmail: purchase.purchaserEmail ? encryptPII(purchase.purchaserEmail) : undefined,
    purchaserName: purchase.purchaserName ? encryptPII(purchase.purchaserName) : undefined,
    purchaserPhone: purchase.purchaserPhone ? encryptPII(purchase.purchaserPhone) : undefined,
    giftMessage: purchase.giftMessage ? encryptGiftMessage(purchase.giftMessage, 
      purchase.purchaserEmail || 'anonymous', 'purchase') : undefined,
  };
}

/**
 * Decrypt all PII fields in a purchase record
 */
export function decryptPurchasePII(purchase: {
  purchaserEmail?: string;
  purchaserName?: string;
  purchaserPhone?: string;
  giftMessage?: string;
}): {
  purchaserEmail?: string;
  purchaserName?: string;
  purchaserPhone?: string;
  giftMessage?: string;
} {
  return {
    purchaserEmail: purchase.purchaserEmail ? decryptPII(purchase.purchaserEmail) : undefined,
    purchaserName: purchase.purchaserName ? decryptPII(purchase.purchaserName) : undefined,
    purchaserPhone: purchase.purchaserPhone ? decryptPII(purchase.purchaserPhone) : undefined,
    giftMessage: purchase.giftMessage ? decryptGiftMessage(purchase.giftMessage, 
      purchase.purchaserEmail || 'anonymous', 'purchase') : undefined,
  };
}

/**
 * Encrypt all PII fields in an address record
 */
export function encryptAddressPII(address: {
  firstName?: string;
  lastName?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  zip?: string;
  phone?: string;
}): {
  firstName?: string;
  lastName?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  zip?: string;
  phone?: string;
} {
  return {
    firstName: address.firstName ? encryptPII(address.firstName) : undefined,
    lastName: address.lastName ? encryptPII(address.lastName) : undefined,
    company: address.company ? encryptPII(address.company) : undefined,
    address1: address.address1 ? encryptPII(address.address1) : undefined,
    address2: address.address2 ? encryptPII(address.address2) : undefined,
    city: address.city ? encryptPII(address.city) : undefined,
    zip: address.zip ? encryptPII(address.zip) : undefined,
    phone: address.phone ? encryptPII(address.phone) : undefined,
  };
}

/**
 * Decrypt all PII fields in an address record
 */
export function decryptAddressPII(address: {
  firstName?: string;
  lastName?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  zip?: string;
  phone?: string;
}): {
  firstName?: string;
  lastName?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  zip?: string;
  phone?: string;
} {
  return {
    firstName: address.firstName ? decryptPII(address.firstName) : undefined,
    lastName: address.lastName ? decryptPII(address.lastName) : undefined,
    company: address.company ? decryptPII(address.company) : undefined,
    address1: address.address1 ? decryptPII(address.address1) : undefined,
    address2: address.address2 ? decryptPII(address.address2) : undefined,
    city: address.city ? decryptPII(address.city) : undefined,
    zip: address.zip ? decryptPII(address.zip) : undefined,
    phone: address.phone ? decryptPII(address.phone) : undefined,
  };
}

/**
 * Encrypt PII fields in a collaborator record
 */
export function encryptCollaboratorPII(collaborator: {
  email: string;
  name?: string;
}): {
  email: string;
  name?: string;
} {
  return {
    email: encryptPII(collaborator.email),
    name: collaborator.name ? encryptPII(collaborator.name) : undefined,
  };
}

/**
 * Decrypt PII fields in a collaborator record
 */
export function decryptCollaboratorPII(collaborator: {
  email: string;
  name?: string;
}): {
  email: string;
  name?: string;
} {
  return {
    email: decryptPII(collaborator.email),
    name: collaborator.name ? decryptPII(collaborator.name) : undefined,
  };
}