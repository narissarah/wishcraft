import crypto from "crypto";
import { log } from "~/lib/logger.server";

const ENCRYPTION_KEY = process.env['ENCRYPTION_KEY'];

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  throw new Error('ENCRYPTION_KEY must be at least 32 characters');
}

function getKey(): Buffer {
  return Buffer.from(ENCRYPTION_KEY!, 'utf-8').slice(0, 32);
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
  const key = process.env['SEARCH_HASH_KEY'] || ENCRYPTION_KEY;
  return crypto.createHmac('sha256', key!).update(data.toLowerCase()).digest('hex');
}

export function generateInvitationToken(collaboratorId: string): string {
  const secret = process.env['SESSION_SECRET'] || ENCRYPTION_KEY;
  const signature = crypto.createHmac('sha256', secret!)
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
    
    const secret = process.env['SESSION_SECRET'] || ENCRYPTION_KEY;
    const expectedSignature = crypto.createHmac('sha256', secret!)
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