import { PrismaClient } from "@prisma/client";

declare global {
  var __db__: PrismaClient | undefined;
}

// Lazy initialization for serverless environments

const createPrismaClient = () => {
  if (!process.env['DATABASE_URL']) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  return new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['error', 'warn'] : ['error'],
    errorFormat: process.env['NODE_ENV'] === 'development' ? 'pretty' : 'minimal',
    datasources: {
      db: {
        url: (() => {
          const baseUrl = process.env['DATABASE_URL'];
          if (!baseUrl) return undefined;
          const url = new URL(baseUrl);
          url.searchParams.set('connect_timeout', '10');
          url.searchParams.set('pool_timeout', '10');
          url.searchParams.set('socket_timeout', '10');
          return url.toString();
        })()
      }
    }
  });
};

// Use singleton pattern for serverless environments
function getDb(): PrismaClient {
  // Always use global instance to prevent connection exhaustion
  if (!global.__db__) {
    global.__db__ = createPrismaClient();
  }
  return global.__db__;
}

// Export a getter to ensure lazy initialization
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    try {
      const client = getDb();
      return Reflect.get(client, prop, receiver);
    } catch (error) {
      // Note: Cannot use log here to avoid circular imports
      throw error;
    }
  }
});