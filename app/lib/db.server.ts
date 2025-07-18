import { PrismaClient } from "@prisma/client";
import { log } from "~/lib/logger.server";

declare global {
  // eslint-disable-next-line no-var
  var __db__: PrismaClient | undefined;
}

// PERFORMANCE FIX: Enhanced database configuration with connection pooling
const createPrismaClient = () => {
  const databaseUrl = new URL(process.env.DATABASE_URL!);
  
  // Add connection pooling parameters
  databaseUrl.searchParams.set('connection_limit', process.env.DATABASE_POOL_MAX || '10');
  databaseUrl.searchParams.set('connect_timeout', '30');
  databaseUrl.searchParams.set('pool_timeout', '10');
  databaseUrl.searchParams.set('pgbouncer', 'true'); // Enable PgBouncer compatibility
  databaseUrl.searchParams.set('statement_cache_size', '100');
  
  return new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? [
          { level: "query", emit: "event" },
          { level: "error", emit: "event" },
          { level: "warn", emit: "event" }
        ]
      : [
          { level: "error", emit: "event" },
          { level: "warn", emit: "event" }
        ],
    datasources: {
      db: {
        url: databaseUrl.toString(),
      },
    },
    // Connection pool configuration
    errorFormat: process.env.NODE_ENV === "development" ? "pretty" : "minimal",
  });
};

let db: PrismaClient;

// This is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
if (process.env.NODE_ENV === "production") {
  db = createPrismaClient();
  
  db.$connect().catch((error) => {
    log.error("Failed to connect to database", error);
    process.exit(1);
  });
} else {
  if (!global.__db__) {
    global.__db__ = createPrismaClient();
    
    // Log Prisma events in development
    global.__db__.$on("query" as never, (e: any) => {
      // PERFORMANCE: Log slow queries
      if (e.duration > 1000) {
        log.warn(`Slow query detected (${e.duration}ms): ${e.query}`);
      }
      log.debug(`Prisma Query: ${e.query}`, { duration: e.duration });
    });
    global.__db__.$on("error" as never, (e: any) => {
      log.error("Prisma Error", e);
    });
    global.__db__.$on("warn" as never, (e: any) => {
      log.warn("Prisma Warning", e);
    });
    
    global.__db__.$connect().catch((error) => {
      log.error("Failed to connect to database in development", error);
      process.exit(1);
    });
  }
  db = global.__db__;
}

// PERFORMANCE: Graceful shutdown with error handling
process.on("beforeExit", async () => {
  try {
    await db.$disconnect();
    log.info("Database connection closed gracefully");
  } catch (error) {
    log.error("Error during database disconnection", error as Error);
  }
});

process.on("SIGTERM", async () => {
  try {
    await db.$disconnect();
    log.info("Database connection closed on SIGTERM");
    process.exit(0);
  } catch (error) {
    log.error("Error during database disconnection on SIGTERM", error as Error);
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  try {
    await db.$disconnect();
    log.info("Database connection closed on SIGINT");
    process.exit(0);
  } catch (error) {
    log.error("Error during database disconnection on SIGINT", error as Error);
    process.exit(1);
  }
});

export { db };

// Database utilities for WishCraft
export class DatabaseError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = "DatabaseError";
  }
}

// Validation utilities
export const validate = {
  shopifyGlobalId: (id: string): boolean => {
    return id.startsWith("gid://shopify/");
  },

  registrySlug: (slug: string): boolean => {
    // Registry slug validation: alphanumeric, hyphens, 3-100 chars
    return /^[a-z0-9-]{3,100}$/.test(slug);
  },

  email: (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  eventType: (type: string): boolean => {
    const validTypes = [
      "wedding",
      "birthday", 
      "baby",
      "graduation",
      "anniversary",
      "holiday",
      "housewarming",
      "general"
    ];
    return validTypes.includes(type);
  },

  visibility: (visibility: string): boolean => {
    const validVisibilities = ["public", "private", "friends", "password"];
    return validVisibilities.includes(visibility);
  },

  priority: (priority: string): boolean => {
    const validPriorities = ["high", "medium", "low"];
    return validPriorities.includes(priority);
  },

  status: (status: string, type: "registry" | "item" | "purchase"): boolean => {
    const statusMap = {
      registry: ["active", "paused", "completed", "archived"],
      item: ["active", "out_of_stock", "discontinued", "hidden"],
      purchase: ["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"]
    };
    return statusMap[type].includes(status);
  }
};

// JSON parsing utilities for SQLite string fields
export const json = {
  parse: <T>(value: string | null): T | null => {
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  },

  stringify: (value: any): string | null => {
    if (value === null || value === undefined) return null;
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
};

// Registry-specific database operations
export const registryDb = {
  // Get registry with all related data
  async getRegistryWithDetails(registryId: string) {
    try {
      const registry = await db.registry.findUnique({
        where: { id: registryId },
        include: {
          items: {
            orderBy: { createdAt: "asc" }
          },
          purchases: true,
          shop: {
            include: {
              settings: true
            }
          }
        }
      });

      if (!registry) return null;

      // Return registry as is - no JSON fields to parse in current schema
      return registry;
    } catch (error) {
      throw new DatabaseError("Failed to fetch registry details", error as Error);
    }
  },

  // Create new registry with validation
  async createRegistry(data: {
    title: string;
    description?: string;
    slug: string;
    eventType: string;
    eventDate?: Date;
    eventLocation?: string;
    eventDetails?: any;
    visibility: string;
    accessCode?: string;
    shopId: string;
    customerId: string;
    customerEmail: string;
    customerFirstName?: string;
    customerLastName?: string;
    customerPhone?: string;
    metadata?: any;
  }) {
    // Validation
    if (!validate.registrySlug(data.slug)) {
      throw new DatabaseError("Invalid registry slug format");
    }
    if (!validate.eventType(data.eventType)) {
      throw new DatabaseError("Invalid event type");
    }
    if (!validate.visibility(data.visibility)) {
      throw new DatabaseError("Invalid visibility setting");
    }
    if (!validate.email(data.customerEmail)) {
      throw new DatabaseError("Invalid customer email");
    }

    try {
      const registry = await db.registry.create({
        data: {
          title: data.title,
          description: data.description,
          slug: data.slug,
          eventType: data.eventType,
          eventDate: data.eventDate,
          visibility: data.visibility,
          accessCode: data.accessCode,
          shopId: data.shopId,
          customerId: data.customerId,
          customerEmail: data.customerEmail,
          customerFirstName: data.customerFirstName,
          customerLastName: data.customerLastName
        },
        include: {
          shop: true
        }
      });

      // Log creation activity
      await db.auditLog.create({
        data: {
          action: "registry_created",
          resource: "registry",
          resourceId: registry.id,
          shopId: data.shopId,
          metadata: JSON.stringify({
            title: registry.title,
            customerId: data.customerId,
            customerEmail: data.customerEmail
          })
        }
      });

      return registry;
    } catch (error) {
      throw new DatabaseError("Failed to create registry", error as Error);
    }
  },

  // Add item to registry
  async addRegistryItem(data: {
    registryId: string;
    productId: string;
    variantId?: string;
    productHandle: string;
    productTitle: string;
    variantTitle?: string;
    productType?: string;
    vendor?: string;
    productImage?: string;
    productImages?: string[];
    productUrl?: string;
    description?: string;
    quantity: number;
    priority: string;
    notes?: string;
    personalNote?: string;
    price: number;
    compareAtPrice?: number;
    currencyCode: string;
    allowGroupGifting?: boolean;
    allowPartialGifting?: boolean;
    minGiftAmount?: number;
    metadata?: any;
  }) {
    // Validation
    if (!validate.priority(data.priority)) {
      throw new DatabaseError("Invalid priority level");
    }

    try {
      const item = await db.registryItem.create({
        data: {
          registryId: data.registryId,
          productId: data.productId,
          variantId: data.variantId,
          productHandle: data.productHandle,
          productTitle: data.productTitle,
          variantTitle: data.variantTitle,
          productImage: data.productImage,
          quantity: data.quantity,
          priority: data.priority,
          notes: data.notes,
          price: data.price,
          compareAtPrice: data.compareAtPrice,
          currencyCode: data.currencyCode
        }
      });

      // Update registry total value
      await db.registry.update({
        where: { id: data.registryId },
        data: {
          totalValue: {
            increment: data.price * data.quantity
          }
        }
      });

      // Log activity
      const registry = await db.registry.findUnique({
        where: { id: data.registryId },
        select: { shopId: true }
      });
      
      if (registry) {
        await db.auditLog.create({
          data: {
            action: "item_added",
            resource: "registry_item",
            resourceId: item.id,
            shopId: registry.shopId,
            metadata: JSON.stringify({
              registryId: data.registryId,
              productTitle: data.productTitle,
              itemId: item.id
            })
          }
        });
      }

      return item;
    } catch (error) {
      throw new DatabaseError("Failed to add registry item", error as Error);
    }
  }
};

// Analytics utilities (disabled for now)
export const analyticsDb = {
  async recordEvent(data: {
    shopId: string;
    event: string;
    category: string;
    properties?: any;
    value?: number;
    currency?: string;
    registryId?: string;
    itemId?: string;
    userId?: string;
    sessionId?: string;
    source?: string;
    medium?: string;
    campaign?: string;
  }) {
    // Analytics events temporarily disabled
    log.debug('Analytics event recorded', data);
    return null;
  }
};

// Health check and database validation
export const dbHealth = {
  async check(): Promise<{ status: "healthy" | "unhealthy"; details: any }> {
    try {
      // Test basic connection
      await db.$queryRaw`SELECT 1`;
      
      // Test table existence (PostgreSQL compatible)
      const tableCount = await db.$queryRaw`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `;

      return {
        status: "healthy",
        details: {
          connected: true,
          tables: tableCount,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: "unhealthy",
        details: {
          connected: false,
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
};

/**
 * Check database connection health
 */
export async function checkDatabaseConnection(): Promise<{
  isConnected: boolean;
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    await db.$queryRaw`SELECT 1`;
    return {
      isConnected: true,
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      isConnected: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
}