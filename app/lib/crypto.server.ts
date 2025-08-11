import crypto from "crypto";
import { log } from "~/lib/logger.server";

// Lazy initialization to prevent serverless crashes
let encryptionKey: Buffer | null = null;
let searchHashKey: string | null = null;
let sessionSecret: string | null = null;

function getKey(): Buffer {
  if (!encryptionKey) {
    const key = process.env['ENCRYPTION_KEY'];
    if (!key || key.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters');
    }
    encryptionKey = Buffer.from(key, 'utf-8').slice(0, 32);
  }
  return encryptionKey;
}

function getSearchHashKey(): string {
  if (!searchHashKey) {
    searchHashKey = process.env['SEARCH_HASH_KEY'] || process.env['ENCRYPTION_KEY'] || null;
    if (!searchHashKey) {
      throw new Error('SEARCH_HASH_KEY or ENCRYPTION_KEY must be set');
    }
  }
  return searchHashKey;
}

function getSessionSecret(): string {
  if (!sessionSecret) {
    sessionSecret = process.env['SESSION_SECRET'] || process.env['ENCRYPTION_KEY'] || null;
    if (!sessionSecret) {
      throw new Error('SESSION_SECRET or ENCRYPTION_KEY must be set');
    }
  }
  return sessionSecret;
}

export function encrypt(text: string): string {
  if (!text) return '';
  
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  if (!encryptedData) return '';
  
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return '';
    
    const [ivHex, authTagHex, encrypted] = parts;
    if (!ivHex || !authTagHex || !encrypted) return '';
    
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    log.error('Failed to decrypt data:', error);
    return '';
  }
}

export function createSearchHash(data: string): string {
  const key = getSearchHashKey();
  return crypto.createHmac('sha256', key).update(data.toLowerCase()).digest('hex');
}

export function generateInvitationToken(collaboratorId: string): string {
  const secret = getSessionSecret();
  const signature = crypto.createHmac('sha256', secret)
    .update(collaboratorId)
    .digest('base64url');
    
  return `${collaboratorId}.${signature}`;
}

export function verifyInvitationToken(token: string): { valid: boolean; collaboratorId?: string } {
  try {
    const [collaboratorId, signature] = token.split('.');
    if (!collaboratorId || !signature) {
      return { valid: false };
    }
    
    const secret = getSessionSecret();
    const expectedSignature = crypto.createHmac('sha256', secret)
      .update(collaboratorId)
      .digest('base64url');
    
    if (signature !== expectedSignature) {
      return { valid: false };
    }
    
    return { valid: true, collaboratorId };
  } catch (error) {
    return { valid: false };
  }
}

export function hashAccessCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export function verifyAccessCode(code: string, hash: string): boolean {
  return hashAccessCode(code) === hash;
}

export const encryptPII = encrypt;
export const decryptPII = decrypt;