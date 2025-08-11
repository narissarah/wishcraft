import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import type { PrismaClient } from "@prisma/client";
import { db } from "~/lib/db.server";

// Lazy initialization for serverless
let storageInstance: PrismaSessionStorage<PrismaClient> | null = null;

function getSessionStorage() {
  if (!storageInstance) {
    storageInstance = new PrismaSessionStorage(db);
  }
  return storageInstance;
}

// Export via proxy for lazy initialization
export const sessionStorage = new Proxy({} as PrismaSessionStorage<PrismaClient>, {
  get(_target, prop) {
    const storage = getSessionStorage();
    return Reflect.get(storage, prop);
  }
});