/**
 * Simple Session Storage for Shopify App
 * Simplified from complex encrypted-session-storage.server.ts
 */

import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { db } from "./db.server";

// Use the standard Prisma session storage
export const sessionStorage = new PrismaSessionStorage(db);