#!/usr/bin/env tsx

/**
 * Migration script to encrypt existing OAuth tokens in the database
 * Run this after deploying the encrypted session storage
 */

import { migrateExistingSessionsToEncrypted } from "~/lib/encrypted-session-storage.server";
import { log } from "~/lib/logger.server";

async function main() {
  try {
    console.log("🔐 Starting session encryption migration...");
    
    await migrateExistingSessionsToEncrypted();
    
    console.log("✅ Session encryption migration completed successfully!");
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Session encryption migration failed:", error);
    log.error("Session encryption migration failed", error as Error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}