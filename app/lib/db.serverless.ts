import { PrismaClient } from "@prisma/client";
import { log } from "./logger.server";

// Vercel serverless database connection with connection pooling
declare global {
  var __db__: PrismaClient | undefined;
}

// In production on Vercel, we need to handle serverless connection pooling
function getClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Add connection pool settings for serverless
  const url = new URL(databaseUrl);
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("pool_timeout", "20");
  
  const prismaOptions = {
    datasources: {
      db: {
        url: url.toString(),
      },
    },
    log: process.env.NODE_ENV === "development" 
      ? ["query", "info", "warn", "error"]
      : ["error"],
  };

  const client = new PrismaClient(prismaOptions);

  // Serverless: Connect on first use
  client.$connect().catch((error) => {
    log.error("Failed to connect to database:", error);
    throw error;
  });

  return client;
}

// Singleton for development, new instance for production serverless
export const db = global.__db__ || getClient();

if (process.env.NODE_ENV !== "production") {
  global.__db__ = db;
}

// Graceful shutdown for serverless
export async function disconnectDb() {
  try {
    await db.$disconnect();
  } catch (error) {
    log.error("Error disconnecting from database:", error);
  }
}