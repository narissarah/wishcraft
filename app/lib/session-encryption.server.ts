/**
 * Session Token Encryption for Enhanced Security
 * Encrypts OAuth access tokens and other sensitive session data
 */

import { encryptPII, decryptPII } from "./encryption.server";
import { log } from "./logger.server";

export interface EncryptedSessionData {
  accessToken: string;
  scope?: string;
  state: string;
}

export interface DecryptedSessionData {
  accessToken: string;
  scope?: string;
  state: string;
}

/**
 * Encrypt session data before storing in database
 */
export function encryptSessionData(sessionData: DecryptedSessionData): EncryptedSessionData {
  try {
    return {
      accessToken: encryptPII(sessionData.accessToken),
      scope: sessionData.scope ? encryptPII(sessionData.scope) : undefined,
      state: encryptPII(sessionData.state)
    };
  } catch (error) {
    log.error("Failed to encrypt session data", error as Error);
    throw new Error("Session encryption failed");
  }
}

/**
 * Decrypt session data when reading from database
 */
export function decryptSessionData(encryptedData: EncryptedSessionData): DecryptedSessionData {
  try {
    return {
      accessToken: decryptPII(encryptedData.accessToken),
      scope: encryptedData.scope ? decryptPII(encryptedData.scope) : undefined,
      state: decryptPII(encryptedData.state)
    };
  } catch (error) {
    log.error("Failed to decrypt session data", error as Error);
    throw new Error("Session decryption failed");
  }
}

/**
 * Encrypt only the access token (most sensitive)
 */
export function encryptAccessToken(token: string): string {
  if (!token) return token;
  return encryptPII(token);
}

/**
 * Decrypt only the access token
 */
export function decryptAccessToken(encryptedToken: string): string {
  if (!encryptedToken) return encryptedToken;
  return decryptPII(encryptedToken);
}

/**
 * Check if a token is already encrypted
 */
export function isTokenEncrypted(token: string): boolean {
  return token && token.includes(':') && token.split(':').length === 3;
}

/**
 * Safely encrypt token only if not already encrypted
 */
export function safeEncryptToken(token: string): string {
  if (!token) return token;
  if (isTokenEncrypted(token)) return token;
  return encryptAccessToken(token);
}

/**
 * Safely decrypt token only if encrypted
 */
export function safeDecryptToken(token: string): string {
  if (!token) return token;
  if (!isTokenEncrypted(token)) return token;
  return decryptAccessToken(token);
}