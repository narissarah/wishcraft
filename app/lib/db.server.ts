import { PrismaClient } from "@prisma/client";

declare global {
  var __db__: PrismaClient | undefined;
}

const createPrismaClient = () => {
  if (!process.env['DATABASE_URL']) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  return new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
    errorFormat: process.env["NODE_ENV"] === "development" ? "pretty" : "minimal",
  });
};

let db: PrismaClient;

if (process.env["NODE_ENV"] === "production") {
  db = createPrismaClient();
} else {
  if (!global.__db__) {
    global.__db__ = createPrismaClient();
  }
  db = global.__db__;
}

export { db };