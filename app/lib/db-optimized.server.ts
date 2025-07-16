// PERFORMANCE FIX: Database optimization with connection pooling and query performance
import { PrismaClient } from "@prisma/client";
import { log } from "~/lib/logger.server";

// Database connection pool configuration
const CONNECTION_POOL_CONFIG = {
  // Connection pool size based on environment
  connectionLimit: process.env.DATABASE_CONNECTION_LIMIT 
    ? parseInt(process.env.DATABASE_CONNECTION_LIMIT) 
    : process.env.NODE_ENV === "production" ? 10 : 5,
  
  // Query timeout in milliseconds
  queryTimeout: process.env.DATABASE_QUERY_TIMEOUT 
    ? parseInt(process.env.DATABASE_QUERY_TIMEOUT)
    : 30000, // 30 seconds
    
  // Connection timeout
  connectTimeout: process.env.DATABASE_CONNECT_TIMEOUT
    ? parseInt(process.env.DATABASE_CONNECT_TIMEOUT)
    : 5000, // 5 seconds
};

// Singleton pattern with connection pooling
class DatabaseManager {
  private static instance: DatabaseManager;
  private client: PrismaClient;
  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private readonly maxRetries: number = 3;
  
  private constructor() {
    this.client = new PrismaClient({
      log: process.env.NODE_ENV === "development" 
        ? ["query", "info", "warn", "error"]
        : ["error", "warn"],
      datasources: {
        db: {
          url: this.getConnectionUrl(),
        },
      },
    });
    
    this.setupEventListeners();
    this.setupConnectionPooling();
  }
  
  private getConnectionUrl(): string {
    const baseUrl = process.env.DATABASE_URL;
    if (!baseUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    
    // Add connection pool parameters to PostgreSQL URL
    const url = new URL(baseUrl);
    url.searchParams.set("connection_limit", CONNECTION_POOL_CONFIG.connectionLimit.toString());
    url.searchParams.set("connect_timeout", (CONNECTION_POOL_CONFIG.connectTimeout / 1000).toString());
    url.searchParams.set("pool_timeout", "10");
    url.searchParams.set("statement_cache_size", "200");
    
    return url.toString();
  }
  
  private setupEventListeners(): void {
    if (process.env.NODE_ENV === "development") {
      // Query performance monitoring
      this.client.$on("query" as never, (e: any) => {
        if (e.duration > 1000) {
          log.warn(`Slow query detected (${e.duration}ms): ${e.query}`);
        }
        log.debug(`Query executed in ${e.duration}ms`);
      });
    }
    
    // Error handling
    this.client.$on("error" as never, (e: any) => {
      log.error("Database error", e);
    });
  }
  
  private setupConnectionPooling(): void {
    // Implement connection health check
    setInterval(async () => {
      if (this.isConnected) {
        try {
          await this.client.$queryRaw`SELECT 1`;
        } catch (error) {
          log.error("Database health check failed", error);
          this.isConnected = false;
          this.reconnect();
        }
      }
    }, 60000); // Check every minute
  }
  
  private async reconnect(): Promise<void> {
    if (this.connectionRetries >= this.maxRetries) {
      log.error("Max database reconnection attempts reached");
      return;
    }
    
    this.connectionRetries++;
    log.info(`Attempting database reconnection (attempt ${this.connectionRetries})`);
    
    try {
      await this.client.$disconnect();
      await this.client.$connect();
      this.isConnected = true;
      this.connectionRetries = 0;
      log.info("Database reconnected successfully");
    } catch (error) {
      log.error("Database reconnection failed", error);
      setTimeout(() => this.reconnect(), 5000 * this.connectionRetries);
    }
  }
  
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }
  
  public async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.$connect();
        this.isConnected = true;
        log.info("Database connected successfully");
      } catch (error) {
        log.error("Failed to connect to database", error);
        throw error;
      }
    }
  }
  
  public getClient(): PrismaClient {
    if (!this.isConnected) {
      throw new Error("Database is not connected");
    }
    return this.client;
  }
  
  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.$disconnect();
      this.isConnected = false;
      log.info("Database disconnected");
    }
  }
}

// Export optimized database client
const dbManager = DatabaseManager.getInstance();
export const db = dbManager.getClient();

// Initialize connection
if (process.env.NODE_ENV === "production") {
  dbManager.connect().catch((error) => {
    log.error("Failed to initialize database connection", error);
    process.exit(1);
  });
}

// Graceful shutdown
process.on("beforeExit", async () => {
  await dbManager.disconnect();
});

// Query optimization utilities
export const queryOptimizer = {
  // Batch operations for better performance
  async batchCreate<T>(model: any, data: T[], batchSize: number = 100): Promise<any[]> {
    const results = [];
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const created = await model.createMany({ data: batch });
      results.push(created);
    }
    return results;
  },
  
  // Cursor-based pagination for large datasets
  async paginate<T>(
    model: any,
    options: {
      cursor?: string;
      take?: number;
      where?: any;
      orderBy?: any;
      include?: any;
    }
  ): Promise<{ items: T[]; nextCursor: string | null }> {
    const take = options.take || 50;
    const items = await model.findMany({
      take: take + 1,
      cursor: options.cursor ? { id: options.cursor } : undefined,
      where: options.where,
      orderBy: options.orderBy || { createdAt: 'desc' },
      include: options.include,
    });
    
    const hasNextPage = items.length > take;
    const nextCursor = hasNextPage ? items[take - 1].id : null;
    
    return {
      items: items.slice(0, take),
      nextCursor,
    };
  },
  
  // Optimized count queries
  async count(model: any, where?: any): Promise<number> {
    // Use raw query for better performance on large tables
    if (where && Object.keys(where).length > 0) {
      return await model.count({ where });
    }
    
    // For simple counts, use raw SQL
    const tableName = model.name.toLowerCase() + 's';
    const result = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM ${tableName}
    `;
    return Number(result[0].count);
  },
};

// Transaction utilities with retry logic
export const transactionManager = {
  async executeWithRetry<T>(
    operation: (tx: any) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await db.$transaction(operation, {
          maxWait: 5000,
          timeout: 30000,
          isolationLevel: 'ReadCommitted',
        });
      } catch (error) {
        lastError = error as Error;
        log.warn(`Transaction failed (attempt ${attempt}/${maxRetries})`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
        }
      }
    }
    
    throw lastError;
  },
};