import { PrismaClient } from '@prisma/client';
import { cacheUtils } from './performance.server';

// Database optimization utilities for high performance queries

export interface QueryOptimizationOptions {
  useCache?: boolean;
  cacheTTL?: number;
  includeCount?: boolean;
  select?: Record<string, any>;
  orderBy?: Record<string, any>;
  take?: number;
  skip?: number;
}

// Optimized Prisma client with connection pooling and caching
export class OptimizedPrismaClient {
  private prisma: PrismaClient;
  private queryMetrics: Map<string, {
    count: number;
    totalTime: number;
    avgTime: number;
    slowQueries: number;
  }> = new Map();

  constructor() {
    this.prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' }
      ],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });

    // Query performance monitoring
    this.prisma.$on('query', (e) => {
      this.recordQueryMetrics(e.query, e.duration);
      
      if (e.duration > 1000) { // Log slow queries
        console.warn(`Slow query detected: ${e.duration}ms`, {
          query: e.query.substring(0, 200),
          params: e.params
        });
      }
    });
  }

  // Optimized registry queries
  async getRegistriesByShop(
    shopId: string, 
    options: QueryOptimizationOptions = {}
  ) {
    const { 
      useCache = true, 
      cacheTTL = 300000, // 5 minutes
      take = 50,
      skip = 0,
      orderBy = { updatedAt: 'desc' as const }
    } = options;

    const cacheKey = cacheUtils.generateKey('registries', shopId, take, skip);
    
    if (useCache) {
      const cached = cacheUtils.get(cacheKey);
      if (cached) return cached;
    }

    const result = await this.prisma.registry.findMany({
      where: { shopId },
      select: {
        id: true,
        title: true,
        slug: true,
        eventType: true,
        eventDate: true,
        visibility: true,
        status: true,
        totalValue: true,
        purchasedValue: true,
        completionRate: true,
        views: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            items: true,
            activities: true
          }
        }
      },
      orderBy,
      take,
      skip
    });

    if (useCache) {
      cacheUtils.set(cacheKey, result, { ttl: cacheTTL });
    }

    return result;
  }

  // Optimized registry with items
  async getRegistryWithItems(
    registryId: string,
    options: QueryOptimizationOptions = {}
  ) {
    const { useCache = true, cacheTTL = 180000 } = options; // 3 minutes
    const cacheKey = cacheUtils.generateKey('registry_with_items', registryId);

    if (useCache) {
      const cached = cacheUtils.get(cacheKey);
      if (cached) return cached;
    }

    const result = await this.prisma.registry.findUnique({
      where: { id: registryId },
      select: {
        id: true,
        title: true,
        description: true,
        slug: true,
        eventType: true,
        eventDate: true,
        eventLocation: true,
        visibility: true,
        allowAnonymousGifts: true,
        totalValue: true,
        purchasedValue: true,
        completionRate: true,
        customerEmail: true,
        customerFirstName: true,
        customerLastName: true,
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            productHandle: true,
            productTitle: true,
            variantTitle: true,
            productImage: true,
            quantity: true,
            quantityPurchased: true,
            priority: true,
            price: true,
            compareAtPrice: true,
            status: true,
            allowGroupGifting: true,
            inventoryQuantity: true,
            displayOrder: true,
            createdAt: true
          },
          where: {
            status: 'active'
          },
          orderBy: [
            { displayOrder: 'asc' },
            { createdAt: 'asc' }
          ]
        },
        addresses: {
          select: {
            id: true,
            type: true,
            isDefault: true,
            label: true,
            firstName: true,
            lastName: true,
            address1: true,
            address2: true,
            city: true,
            province: true,
            country: true,
            zip: true
          }
        }
      }
    });

    if (useCache) {
      cacheUtils.set(cacheKey, result, { ttl: cacheTTL });
    }

    return result;
  }

  // Bulk inventory update with batching
  async updateInventoryBatch(updates: Array<{
    itemId: string;
    inventoryQuantity: number;
    status?: string;
  }>) {
    const batchSize = 100; // PostgreSQL optimal batch size
    const batches = [];
    
    for (let i = 0; i < updates.length; i += batchSize) {
      batches.push(updates.slice(i, i + batchSize));
    }

    const results = await Promise.all(
      batches.map(batch => 
        this.prisma.$transaction(
          batch.map(update => 
            this.prisma.registryItem.update({
              where: { id: update.itemId },
              data: {
                inventoryQuantity: update.inventoryQuantity,
                lastInventorySync: new Date(),
                ...(update.status && { status: update.status })
              }
            })
          )
        )
      )
    );

    // Invalidate cache for affected registries
    const registryIds = new Set(updates.map(u => u.itemId));
    registryIds.forEach(id => {
      cacheUtils.delete(cacheUtils.generateKey('registry_with_items', id));
    });

    return results.flat();
  }

  // Optimized analytics aggregation
  async getRegistryAnalytics(
    registryId: string,
    dateRange: { start: Date; end: Date }
  ) {
    const cacheKey = cacheUtils.generateKey(
      'analytics', 
      registryId, 
      dateRange.start.toISOString(), 
      dateRange.end.toISOString()
    );

    const cached = cacheUtils.get(cacheKey);
    if (cached) return cached;

    // Use raw SQL for complex analytics
    const result = await this.prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(CASE WHEN type = 'registry_viewed' THEN 1 END) as views,
        COUNT(CASE WHEN type = 'item_purchased' THEN 1 END) as purchases,
        COUNT(CASE WHEN type = 'item_added' THEN 1 END) as items_added,
        COUNT(DISTINCT actor_email) as unique_visitors,
        COALESCE(SUM(
          CASE WHEN type = 'item_purchased' AND metadata::jsonb ? 'amount' 
          THEN (metadata::jsonb->>'amount')::numeric 
          END
        ), 0) as revenue
      FROM registry_activities 
      WHERE registry_id = ${registryId}
        AND created_at >= ${dateRange.start}
        AND created_at <= ${dateRange.end}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date ASC
    `;

    cacheUtils.set(cacheKey, result, { ttl: 600000 }); // 10 minutes
    return result;
  }

  // Optimized search with full-text search
  async searchRegistries(
    shopId: string,
    query: string,
    filters: {
      eventType?: string;
      status?: string;
      visibility?: string;
      dateRange?: { start: Date; end: Date };
    } = {},
    options: QueryOptimizationOptions = {}
  ) {
    const { take = 20, skip = 0 } = options;

    // Build where clause dynamically
    const whereClause: any = {
      shopId,
      AND: []
    };

    // Text search using PostgreSQL full-text search
    if (query) {
      whereClause.AND.push({
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { customerFirstName: { contains: query, mode: 'insensitive' } },
          { customerLastName: { contains: query, mode: 'insensitive' } },
          { customerEmail: { contains: query, mode: 'insensitive' } }
        ]
      });
    }

    // Apply filters
    if (filters.eventType) {
      whereClause.AND.push({ eventType: filters.eventType });
    }

    if (filters.status) {
      whereClause.AND.push({ status: filters.status });
    }

    if (filters.visibility) {
      whereClause.AND.push({ visibility: filters.visibility });
    }

    if (filters.dateRange) {
      whereClause.AND.push({
        createdAt: {
          gte: filters.dateRange.start,
          lte: filters.dateRange.end
        }
      });
    }

    const [registries, totalCount] = await Promise.all([
      this.prisma.registry.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          slug: true,
          eventType: true,
          eventDate: true,
          visibility: true,
          status: true,
          totalValue: true,
          completionRate: true,
          views: true,
          createdAt: true,
          _count: {
            select: { items: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take,
        skip
      }),
      this.prisma.registry.count({ where: whereClause })
    ]);

    return {
      registries,
      totalCount,
      hasMore: skip + take < totalCount
    };
  }

  // Optimized group gift aggregation
  async getGroupGiftMetrics(groupGiftId: string) {
    const cacheKey = cacheUtils.generateKey('group_gift_metrics', groupGiftId);
    const cached = cacheUtils.get(cacheKey);
    if (cached) return cached;

    const result = await this.prisma.groupGiftContribution.aggregate({
      where: {
        purchase: {
          groupGiftId
        },
        paymentStatus: 'paid'
      },
      _sum: {
        amount: true
      },
      _count: {
        contributorEmail: true
      }
    });

    const metrics = {
      totalAmount: result._sum.amount || 0,
      contributorCount: result._count.contributorEmail || 0,
      averageContribution: result._count.contributorEmail 
        ? (result._sum.amount || 0) / result._count.contributorEmail 
        : 0
    };

    cacheUtils.set(cacheKey, metrics, { ttl: 60000 }); // 1 minute
    return metrics;
  }

  // Database maintenance utilities
  async cleanupOldActivities(daysToKeep: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    return this.prisma.registryActivity.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        },
        type: {
          in: ['registry_viewed', 'item_viewed'] // Only cleanup view activities
        }
      }
    });
  }

  async optimizeDatabase() {
    // Analyze query performance
    const slowQueries = Array.from(this.queryMetrics.entries())
      .filter(([, metrics]) => metrics.avgTime > 1000)
      .sort((a, b) => b[1].avgTime - a[1].avgTime);

    if (slowQueries.length > 0) {
      console.warn('Slow queries detected:', slowQueries.slice(0, 5));
    }

    // Vacuum and analyze (PostgreSQL specific)
    if (process.env.NODE_ENV === 'production') {
      try {
        await this.prisma.$executeRaw`VACUUM ANALYZE;`;
        console.log('Database vacuum and analyze completed');
      } catch (error) {
        console.error('Database optimization failed:', error);
      }
    }

    return {
      slowQueriesCount: slowQueries.length,
      totalQueries: this.queryMetrics.size,
      avgQueryTime: Array.from(this.queryMetrics.values())
        .reduce((sum, m) => sum + m.avgTime, 0) / this.queryMetrics.size
    };
  }

  private recordQueryMetrics(query: string, duration: number) {
    const queryType = this.extractQueryType(query);
    const current = this.queryMetrics.get(queryType) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      slowQueries: 0
    };

    current.count++;
    current.totalTime += duration;
    current.avgTime = current.totalTime / current.count;
    
    if (duration > 1000) {
      current.slowQueries++;
    }

    this.queryMetrics.set(queryType, current);
  }

  private extractQueryType(query: string): string {
    const match = query.match(/^(SELECT|INSERT|UPDATE|DELETE|UPSERT)/i);
    return match ? match[1].toLowerCase() : 'unknown';
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}

// Index optimization recommendations
export const indexOptimizations = {
  // Composite indexes for common query patterns
  registryQueries: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registries_shop_status_updated ON registries(shop_id, status, updated_at DESC);',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registries_customer_event ON registries(customer_id, event_type, event_date);',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registries_visibility_created ON registries(visibility, created_at DESC) WHERE status = \'active\';'
  ],
  
  registryItemQueries: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registry_items_registry_status_order ON registry_items(registry_id, status, display_order) WHERE status = \'active\';',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registry_items_product_inventory ON registry_items(product_id, inventory_quantity) WHERE inventory_tracked = true;',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registry_items_priority_created ON registry_items(priority, created_at DESC);'
  ],

  purchaseQueries: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_item_status ON registry_purchases(registry_item_id, status, created_at DESC);',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_group_gift ON registry_purchases(group_gift_id, status) WHERE group_gift_id IS NOT NULL;',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_purchaser_date ON registry_purchases(purchaser_email, created_at DESC) WHERE purchaser_email IS NOT NULL;'
  ],

  activityQueries: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_registry_type_date ON registry_activities(registry_id, type, created_at DESC);',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_actor_date ON registry_activities(actor_email, created_at DESC) WHERE actor_email IS NOT NULL;'
  ],

  fullTextSearch: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registries_fulltext ON registries USING gin(to_tsvector(\'english\', title || \' \' || COALESCE(description, \'\')));',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registry_items_fulltext ON registry_items USING gin(to_tsvector(\'english\', product_title || \' \' || COALESCE(description, \'\')));'
  ]
};

// Query optimization helpers
export const queryOptimizations = {
  // Pagination with cursor-based approach for better performance
  createCursorPagination: (
    lastId: string | null,
    take: number,
    orderBy: 'asc' | 'desc' = 'desc'
  ) => ({
    ...(lastId && {
      cursor: { id: lastId },
      skip: 1
    }),
    take,
    orderBy: { id: orderBy }
  }),

  // Optimized select fields for common queries
  registryListSelect: {
    id: true,
    title: true,
    slug: true,
    eventType: true,
    eventDate: true,
    status: true,
    visibility: true,
    totalValue: true,
    completionRate: true,
    views: true,
    createdAt: true,
    updatedAt: true
  },

  registryItemListSelect: {
    id: true,
    productId: true,
    productTitle: true,
    productImage: true,
    quantity: true,
    quantityPurchased: true,
    priority: true,
    price: true,
    status: true,
    displayOrder: true
  },

  // Batch operations
  createBatchUpdate: <T>(
    items: T[],
    batchSize: number = 100
  ): T[][] => {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
};

// Create singleton instance
export const optimizedDb = new OptimizedPrismaClient();