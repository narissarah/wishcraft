import { PrismaClient } from "@prisma/client";

declare global {
  var __db__: PrismaClient;
}

let db: PrismaClient;

// This is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
if (process.env.NODE_ENV === "production") {
  db = new PrismaClient();
} else {
  if (!global.__db__) {
    global.__db__ = new PrismaClient({
      log: ["query", "error", "warn"],
    });
  }
  db = global.__db__;
  db.$connect();
}

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
            include: {
              purchases: {
                include: {
                  groupContributions: true,
                  shippingAddress: true
                }
              }
            },
            orderBy: { displayOrder: "asc" }
          },
          collaborators: {
            where: { status: "active" }
          },
          addresses: true,
          activities: {
            orderBy: { createdAt: "desc" },
            take: 50
          },
          shop: {
            include: {
              settings: true
            }
          }
        }
      });

      if (!registry) return null;

      // Parse JSON fields
      return {
        ...registry,
        eventDetails: json.parse(registry.eventDetails),
        metadata: json.parse(registry.metadata),
        items: registry.items.map(item => ({
          ...item,
          productImages: json.parse<string[]>(item.productImages),
          metadata: json.parse(item.metadata)
        })),
        collaborators: registry.collaborators.map(collab => ({
          ...collab,
          permissions: json.parse(collab.permissions)
        })),
        addresses: registry.addresses.map(addr => ({
          ...addr,
          verificationData: json.parse(addr.verificationData)
        })),
        activities: registry.activities.map(activity => ({
          ...activity,
          metadata: json.parse(activity.metadata)
        }))
      };
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
          ...data,
          eventDetails: json.stringify(data.eventDetails),
          metadata: json.stringify(data.metadata)
        },
        include: {
          shop: true
        }
      });

      // Log creation activity
      await db.registryActivity.create({
        data: {
          registryId: registry.id,
          type: "registry_created",
          description: `Registry "${registry.title}" was created`,
          actorType: "owner",
          actorId: data.customerId,
          actorEmail: data.customerEmail
        }
      });

      return {
        ...registry,
        eventDetails: json.parse(registry.eventDetails),
        metadata: json.parse(registry.metadata)
      };
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
          ...data,
          productImages: json.stringify(data.productImages),
          metadata: json.stringify(data.metadata)
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
      await db.registryActivity.create({
        data: {
          registryId: data.registryId,
          type: "item_added",
          description: `Added "${data.productTitle}" to registry`,
          itemId: item.id,
          actorType: "owner"
        }
      });

      return {
        ...item,
        productImages: json.parse<string[]>(item.productImages),
        metadata: json.parse(item.metadata)
      };
    } catch (error) {
      throw new DatabaseError("Failed to add registry item", error as Error);
    }
  }
};

// Analytics utilities
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
    try {
      return await db.analyticsEvent.create({
        data: {
          ...data,
          properties: json.stringify(data.properties),
          timestamp: new Date()
        }
      });
    } catch (error) {
      throw new DatabaseError("Failed to record analytics event", error as Error);
    }
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