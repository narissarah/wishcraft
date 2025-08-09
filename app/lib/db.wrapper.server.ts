// Database wrapper that selects appropriate configuration based on deployment platform
import type { PrismaClient } from "@prisma/client";

let db: PrismaClient;

async function initializeDatabase() {
  if (process.env.DEPLOYMENT_PLATFORM === "vercel") {
    // Use serverless-optimized configuration for Vercel
    const { db: vercelDb } = await import("./db.serverless");
    return vercelDb;
  } else {
    // Use standard configuration for local development
    const { db: standardDb } = await import("./db.server");
    return standardDb;
  }
}

// Initialize database connection
db = await initializeDatabase();

export { db };