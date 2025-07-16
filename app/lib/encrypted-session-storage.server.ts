/**
 * Encrypted Session Storage for Shopify OAuth Tokens
 * Wraps PrismaSessionStorage with encryption for security compliance
 */

import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { Session } from "@shopify/shopify-api";
import { db } from "./db.server";
import { encryptAccessToken, decryptAccessToken, safeEncryptToken, safeDecryptToken } from "./session-encryption.server";
import { log } from "./logger.server";

export class EncryptedPrismaSessionStorage extends PrismaSessionStorage {
  constructor() {
    super(db);
  }

  /**
   * Store session with encrypted access token
   */
  async storeSession(session: Session): Promise<boolean> {
    try {
      // Create a copy of the session to avoid mutating the original
      const sessionCopy = { ...session };
      
      // Encrypt the access token before storing
      if (sessionCopy.accessToken) {
        sessionCopy.accessToken = safeEncryptToken(sessionCopy.accessToken);
      }
      
      // Store the session with encrypted token
      const result = await super.storeSession(sessionCopy);
      
      log.info("Session stored with encrypted access token", {
        sessionId: session.id,
        shop: session.shop,
        encrypted: true
      });
      
      return result;
    } catch (error) {
      log.error("Failed to store encrypted session", error as Error);
      throw error;
    }
  }

  /**
   * Load session and decrypt access token
   */
  async loadSession(id: string): Promise<Session | undefined> {
    try {
      const session = await super.loadSession(id);
      
      if (session && session.accessToken) {
        // Decrypt the access token when loading
        session.accessToken = safeDecryptToken(session.accessToken);
        
        log.debug("Session loaded and access token decrypted", {
          sessionId: session.id,
          shop: session.shop,
          hasToken: !!session.accessToken
        });
      }
      
      return session;
    } catch (error) {
      log.error("Failed to load and decrypt session", error as Error);
      throw error;
    }
  }

  /**
   * Find sessions by shop with decryption
   */
  async findSessionsByShop(shop: string): Promise<Session[]> {
    try {
      const sessions = await super.findSessionsByShop(shop);
      
      // Decrypt access tokens for all sessions
      return sessions.map(session => {
        if (session.accessToken) {
          session.accessToken = safeDecryptToken(session.accessToken);
        }
        return session;
      });
    } catch (error) {
      log.error("Failed to find and decrypt sessions by shop", error as Error);
      throw error;
    }
  }

  /**
   * Delete session (no decryption needed)
   */
  async deleteSession(id: string): Promise<boolean> {
    try {
      const result = await super.deleteSession(id);
      
      log.info("Encrypted session deleted", {
        sessionId: id,
        deleted: result
      });
      
      return result;
    } catch (error) {
      log.error("Failed to delete session", error as Error);
      throw error;
    }
  }

  /**
   * Delete sessions by shop (no decryption needed)
   */
  async deleteSessionsByShop(shop: string): Promise<boolean> {
    try {
      const result = await super.deleteSessionsByShop(shop);
      
      log.info("Encrypted sessions deleted by shop", {
        shop,
        deleted: result
      });
      
      return result;
    } catch (error) {
      log.error("Failed to delete sessions by shop", error as Error);
      throw error;
    }
  }
}

/**
 * Migration utility to encrypt existing unencrypted tokens
 */
export async function migrateExistingSessionsToEncrypted(): Promise<void> {
  try {
    log.info("Starting migration of existing sessions to encrypted storage");
    
    // Get all sessions directly from database
    const sessions = await db.session.findMany();
    
    let migratedCount = 0;
    let alreadyEncryptedCount = 0;
    
    for (const session of sessions) {
      if (session.accessToken) {
        // Check if already encrypted (contains colons in encrypted format)
        if (session.accessToken.includes(':') && session.accessToken.split(':').length === 3) {
          alreadyEncryptedCount++;
          continue;
        }
        
        // Encrypt the token
        const encryptedToken = encryptAccessToken(session.accessToken);
        
        // Update in database
        await db.session.update({
          where: { id: session.id },
          data: { accessToken: encryptedToken }
        });
        
        migratedCount++;
      }
    }
    
    log.info("Session encryption migration completed", {
      total: sessions.length,
      migrated: migratedCount,
      alreadyEncrypted: alreadyEncryptedCount,
      skipped: sessions.length - migratedCount - alreadyEncryptedCount
    });
    
  } catch (error) {
    log.error("Failed to migrate sessions to encrypted storage", error as Error);
    throw error;
  }
}