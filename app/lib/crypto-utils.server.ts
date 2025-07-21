/**
 * Unified Crypto Utilities
 * Consolidates all crypto operations to eliminate duplicates
 */
import crypto from 'crypto';

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