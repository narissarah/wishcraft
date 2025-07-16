// SECURITY FIX: CVE-004 - Database field-level encryption for PII compliance
import crypto from 'crypto';
import { log } from '~/lib/logger.server';

// Get encryption key from environment or throw error
function getDataEncryptionKey(): Buffer {
  const key = process.env.DATA_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error(
      '🚨 CRITICAL: DATA_ENCRYPTION_KEY environment variable is required for PII encryption.\n' +
      'Generate a secure key with: `openssl rand -base64 32`'
    );
  }
  
  // Use a static salt for data encryption (different from session salt)
  const salt = process.env.DATA_ENCRYPTION_SALT || 'wishcraft-data-encryption-v1';
  return crypto.scryptSync(key, salt, 32);
}

const dataEncryptionKey = getDataEncryptionKey();

// Encrypt sensitive data before storing in database
export function encryptPII(data: string): string {
  if (!data) return data;
  
  const iv = crypto.randomBytes(16);
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
import bcrypt from 'bcrypt';

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
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
}

// Create a searchable hash with a secret key for database indexing
export function createSearchableEmailHash(email: string): string {
  if (!email) return '';
  
  // Use HMAC with a secret key for searchable hashes
  const searchKey = process.env.SEARCH_HASH_KEY || process.env.ENCRYPTION_KEY || 'default-search-key';
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
  
  const iv = crypto.randomBytes(16);
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
  
  // Check for potentially malicious content
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /\beval\s*\(/i,
    /\bfunction\s*\(/i,
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(message)) {
      return { isValid: false, error: 'Gift message contains invalid content' };
    }
  }
  
  return { isValid: true };
}

// Sanitize gift message for safe display
export function sanitizeGiftMessage(message: string): string {
  if (!message) return '';
  
  // Remove potentially harmful content while preserving formatting
  return message
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/\beval\s*\(/gi, '')
    .replace(/\bfunction\s*\(/gi, '')
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