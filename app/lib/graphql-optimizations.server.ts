import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { log } from "~/lib/logger.server";
import { cache } from "~/lib/cache-unified.server";

/**
 * Advanced GraphQL Optimizations for Shopify 2025
 * Implements query complexity analysis, field-level caching, and intelligent batching
 */

// Query complexity scoring
interface QueryComplexity {
  score: number;
  fields: number;
  depth: number;
  lists: number;
}

/**
 * Analyze GraphQL query complexity to prevent expensive operations
 */
export function analyzeQueryComplexity(query: string): QueryComplexity {
  let score = 0;
  let fields = 0;
  let depth = 0;
  let lists = 0;
  let currentDepth = 0;
  let maxDepth = 0;

  // Simple complexity analysis based on query structure
  const tokens = query.split(/\s+/);
  
  for (const token of tokens) {
    if (token.includes('{')) {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    }
    if (token.includes('}')) {
      currentDepth--;
    }
    if (token.includes('(') && token.includes('first:')) {
      lists++;
      // Extract the number after 'first:'
      const match = token.match(/first:\s*(\d+)/);
      if (match) {
        score += parseInt(match[1]) * 0.1;
      }
    }
    if (token.match(/^\w+$/) && !token.match(/^(query|mutation|fragment|on)$/)) {
      fields++;
    }
  }

  depth = maxDepth;
  score += fields * 1 + depth * 5 + lists * 10;

  return { score, fields, depth, lists };
}

/**
 * Query result cache with field-level granularity
 */
export class GraphQLCache {
  private static readonly CACHE_PREFIX = 'gql:';
  private static readonly DEFAULT_TTL = 300; // 5 minutes

  /**
   * Generate cache key for GraphQL queries
   */
  static generateCacheKey(
    shop: string,
    query: string,
    variables?: Record<string, any>
  ): string {
    const queryHash = this.hashQuery(query);
    const variablesHash = variables ? this.hashQuery(JSON.stringify(variables)) : 'novars';
    return `${this.CACHE_PREFIX}${shop}:${queryHash}:${variablesHash}`;
  }

  /**
   * Simple hash function for queries
   */
  private static hashQuery(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Cache GraphQL query result
   */
  static async cacheResult(
    key: string,
    data: any,
    ttl: number = this.DEFAULT_TTL
  ): Promise<void> {
    await cache.set(key, data, { ttl });
  }

  /**
   * Get cached GraphQL result
   */
  static async getCachedResult(key: string): Promise<any | null> {
    return await cache.get(key);
  }

  /**
   * Invalidate cache entries by pattern
   */
  static async invalidatePattern(shop: string, pattern: string): Promise<void> {
    const cachePattern = `${this.CACHE_PREFIX}${shop}:${pattern}*`;
    await cache.invalidateByTags([cachePattern]);
  }
}

/**
 * Query batching and deduplication
 */
export class GraphQLBatcher {
  private static batchQueue: Map<string, {
    queries: Array<{ query: string; variables?: any; resolve: Function; reject: Function }>;
    timeout: NodeJS.Timeout;
  }> = new Map();

  private static readonly BATCH_WINDOW = 50; // milliseconds
  private static readonly MAX_BATCH_SIZE = 10;

  /**
   * Add query to batch queue
   */
  static async batchQuery(
    admin: any, // Using any to avoid type conflicts with AdminApiContext
    query: string,
    variables?: Record<string, any>
  ): Promise<any> {
    const shop = admin.session?.shop || admin.rest?.session?.shop;
    
    return new Promise((resolve, reject) => {
      const queueKey = shop;
      
      if (!this.batchQueue.has(queueKey)) {
        this.batchQueue.set(queueKey, {
          queries: [],
          timeout: setTimeout(() => this.executeBatch(queueKey, admin), this.BATCH_WINDOW)
        });
      }

      const queue = this.batchQueue.get(queueKey)!;
      queue.queries.push({ query, variables, resolve, reject });

      // Execute immediately if batch is full
      if (queue.queries.length >= this.MAX_BATCH_SIZE) {
        clearTimeout(queue.timeout);
        this.executeBatch(queueKey, admin);
      }
    });
  }

  /**
   * Execute batched queries
   */
  private static async executeBatch(queueKey: string, admin: any): Promise<void> {
    const queue = this.batchQueue.get(queueKey);
    if (!queue || queue.queries.length === 0) return;

    this.batchQueue.delete(queueKey);
    const { queries } = queue;

    try {
      // Create a single batched query
      const batchedQuery = this.createBatchedQuery(queries);
      
      const response = await admin.graphql(batchedQuery.query, {
        variables: batchedQuery.variables
      });

      const data = await response.json();

      // Distribute results to individual promises
      queries.forEach((q, index) => {
        const result = data.data?.[`query${index}`];
        if (result) {
          q.resolve(result);
        } else {
          q.reject(new Error(data.errors?.[index]?.message || 'Query failed'));
        }
      });
    } catch (error) {
      // Reject all queries in batch
      queries.forEach(q => q.reject(error));
    }
  }

  /**
   * Create a single batched query from multiple queries
   */
  private static createBatchedQuery(
    queries: Array<{ query: string; variables?: any }>
  ): { query: string; variables: Record<string, any> } {
    const combinedVariables: Record<string, any> = {};
    const queryParts: string[] = [];

    queries.forEach((q, index) => {
      // Extract query name and body
      const match = q.query.match(/query\s+(\w+)?\s*(\([^)]*\))?\s*{([\s\S]*)}/);
      if (!match) return;

      const queryBody = match[3];
      const variableDeclarations = match[2] || '';

      // Rename variables to avoid conflicts
      if (q.variables) {
        Object.entries(q.variables).forEach(([key, value]) => {
          combinedVariables[`${key}_${index}`] = value;
        });
      }

      // Adjust query to use renamed variables
      let adjustedQuery = queryBody;
      if (q.variables) {
        Object.keys(q.variables).forEach(key => {
          adjustedQuery = adjustedQuery.replace(
            new RegExp(`\\$${key}`, 'g'),
            `$${key}_${index}`
          );
        });
      }

      queryParts.push(`query${index}: ${adjustedQuery}`);
    });

    return {
      query: `query BatchedQuery { ${queryParts.join('\n')} }`,
      variables: combinedVariables
    };
  }
}

/**
 * DataLoader pattern for N+1 query prevention
 */
export class GraphQLDataLoader<K, V> {
  private batch: Array<{ key: K; resolve: (value: V) => void; reject: (error: any) => void }> = [];
  private batchTimeout?: NodeJS.Timeout;
  private cache = new Map<K, Promise<V>>();

  constructor(
    private batchFn: (keys: K[]) => Promise<Map<K, V>>,
    private options: { maxBatchSize?: number; batchWindow?: number } = {}
  ) {
    this.options.maxBatchSize = options.maxBatchSize || 100;
    this.options.batchWindow = options.batchWindow || 10;
  }

  async load(key: K): Promise<V> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Create promise and add to batch
    const promise = new Promise<V>((resolve, reject) => {
      this.batch.push({ key, resolve, reject });
      
      // Schedule batch execution
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => this.executeBatch(), this.options.batchWindow);
      }

      // Execute immediately if batch is full
      if (this.batch.length >= this.options.maxBatchSize!) {
        clearTimeout(this.batchTimeout);
        this.executeBatch();
      }
    });

    this.cache.set(key, promise);
    return promise;
  }

  private async executeBatch(): Promise<void> {
    const batch = this.batch;
    this.batch = [];
    this.batchTimeout = undefined;

    if (batch.length === 0) return;

    try {
      const keys = batch.map(item => item.key);
      const results = await this.batchFn(keys);

      batch.forEach(({ key, resolve, reject }) => {
        if (results.has(key)) {
          resolve(results.get(key)!);
        } else {
          reject(new Error(`No result for key: ${key}`));
        }
      });
    } catch (error) {
      batch.forEach(({ reject }) => reject(error));
    }
  }

  clear(key?: K): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

/**
 * Optimized query fragments with minimal field selection
 */
export const OptimizedFragments = {
  // Minimal product fields for list views
  PRODUCT_LIST_FIELDS: `
    fragment ProductListFields on Product {
      id
      title
      handle
      featuredImage {
        url(transform: { maxWidth: 200, maxHeight: 200 })
      }
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
    }
  `,

  // Detailed product fields for single product views
  PRODUCT_DETAIL_FIELDS: `
    fragment ProductDetailFields on Product {
      id
      title
      handle
      description
      vendor
      productType
      tags
      featuredImage {
        url
        altText
      }
      images(first: 10) {
        edges {
          node {
            url
            altText
          }
        }
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            price
            availableForSale
            selectedOptions {
              name
              value
            }
          }
        }
      }
    }
  `,

  // Minimal customer fields
  CUSTOMER_BASIC_FIELDS: `
    fragment CustomerBasicFields on Customer {
      id
      email
      displayName
    }
  `,

  // Registry-specific metafields
  REGISTRY_METAFIELDS: `
    fragment RegistryMetafields on Metafield {
      namespace
      key
      value
      type
    }
  `
};

/**
 * Query performance monitoring
 */
export async function monitorGraphQLPerformance(
  queryName: string,
  startTime: number,
  complexity: QueryComplexity,
  success: boolean,
  error?: string
): Promise<void> {
  const duration = Date.now() - startTime;
  
  await log.info('GraphQL query performance', {
    queryName,
    duration,
    complexity,
    success,
    error,
    timestamp: new Date().toISOString()
  });

  // Alert on slow queries
  if (duration > 1000) {
    await log.warn('Slow GraphQL query detected', {
      queryName,
      duration,
      complexity
    });
  }

  // Alert on complex queries
  if (complexity.score > 100) {
    await log.warn('Complex GraphQL query detected', {
      queryName,
      complexity
    });
  }
}