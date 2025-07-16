/**
 * Server-side utility functions
 */
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function validatePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// DEPRECATED: Use sanitizeInput from sanitization-unified.server.ts instead
export function sanitizeInput(input: string): string {
  const { sanitizeInput: unifiedSanitizeInput } = require('./sanitization-unified.server');
  return unifiedSanitizeInput(input);
}

// Removed duplicate formatCurrency - use formatPrice from utils.ts instead

// Removed duplicate generateSlug - use generateSlug from utils.ts instead

// Removed duplicate truncateString - use truncateText from utils.ts instead

export function parseJSON<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}

// Removed insecure generateId - use generatePassword or generateSecureToken from security.server.ts for secure ID generation

// Removed duplicate generateSlug - use generateSlug from utils.ts instead

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}