import { shopifyApi } from '@shopify/shopify-api';
import { 
  optimizeProductQuery, 
  optimizeInventoryQuery, 
  cachedGraphQLQuery,
  performanceMonitor,
  analyzeQueryComplexity,
  OPTIMIZED_FRAGMENTS
} from './graphql-optimization.server';
import { cacheUtils } from './performance.server';

// Optimized Shopify GraphQL client wrapper
export class OptimizedShopifyClient {
  private session: any;
  private client: any;

  constructor(session: any) {
    this.session = session;
    this.client = new shopifyApi.clients.Graphql({ session });
  }

  // Optimized product fetching with intelligent batching
  async getProducts(
    productIds: string[], 
    options: {
      includeImages?: boolean;
      includeVariants?: boolean;
      includeMetafields?: boolean;
      useCache?: boolean;
      ttl?: number;
    } = {}
  ) {
    const { 
      includeImages = true, 
      includeVariants = true, 
      includeMetafields = false,
      useCache = true,
      ttl = 300000 // 5 minutes
    } = options;

    // Batch optimization: if requesting many products, split into optimal chunks
    if (productIds.length > 10) {
      const chunks = this.chunkArray(productIds, 10);
      const results = await Promise.all(
        chunks.map(chunk => this.fetchProductChunk(chunk, options))
      );
      return results.flat();
    }

    return this.fetchProductChunk(productIds, options);
  }

  private async fetchProductChunk(
    productIds: string[], 
    options: any
  ) {
    const fields: Array<'images' | 'variants' | 'metafields'> = [];
    if (options.includeImages) fields.push('images');
    if (options.includeVariants) fields.push('variants');
    if (options.includeMetafields) fields.push('metafields');

    const query = optimizeProductQuery(productIds, fields);
    const variables = { ids: productIds };

    if (options.useCache) {
      return cachedGraphQLQuery(
        query,
        variables,
        (q, v) => this.executeQuery(q, v),
        options.ttl
      );
    }

    return this.executeQuery(query, variables);
  }

  // Optimized inventory checking
  async getInventoryLevels(productIds: string[], useCache = true) {
    const cacheKey = cacheUtils.generateKey('inventory', ...productIds);
    
    if (useCache) {
      const cached = cacheUtils.get(cacheKey);
      if (cached) return cached;
    }

    const query = optimizeInventoryQuery(productIds);
    const result = await this.executeQuery(query, { ids: productIds });

    if (useCache) {
      cacheUtils.set(cacheKey, result, { ttl: 60000 }); // 1 minute cache for inventory
    }

    return result;
  }

  // Optimized order creation with minimal fields
  async createOrder(orderData: any) {
    const query = `
      mutation CreateOrder($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            name
            order {
              id
              name
              totalPrice
              financialStatus
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    return this.executeQuery(query, { input: orderData });
  }

  // Optimized customer lookup with caching
  async getCustomer(customerId: string, useCache = true) {
    const cacheKey = cacheUtils.generateKey('customer', customerId);
    
    if (useCache) {
      const cached = cacheUtils.get(cacheKey);
      if (cached) return cached;
    }

    const query = `
      ${OPTIMIZED_FRAGMENTS.CUSTOMER_CORE}
      
      query GetCustomer($id: ID!) {
        customer(id: $id) {
          ...CustomerCore
          defaultAddress {
            id
            firstName
            lastName
            address1
            address2
            city
            province
            country
            zip
            phone
          }
          addresses(first: 5) {
            edges {
              node {
                id
                firstName
                lastName
                address1
                city
                province
                country
                zip
              }
            }
          }
        }
      }
    `;

    const result = await this.executeQuery(query, { id: customerId });

    if (useCache) {
      cacheUtils.set(cacheKey, result, { ttl: 300000 }); // 5 minutes
    }

    return result;
  }

  // Batch metafield operations
  async batchSetMetafields(metafields: Array<{
    ownerId: string;
    namespace: string;
    key: string;
    value: string;
    type: string;
  }>) {
    // Shopify allows up to 25 metafields per mutation
    const chunks = this.chunkArray(metafields, 25);
    
    const results = await Promise.all(
      chunks.map(chunk => this.setMetafieldChunk(chunk))
    );

    return results.flat();
  }

  private async setMetafieldChunk(metafields: any[]) {
    const query = `
      mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    return this.executeQuery(query, { metafields });
  }

  // Optimized search with pagination
  async searchProducts(
    query: string, 
    options: {
      first?: number;
      after?: string;
      includeImages?: boolean;
      sortKey?: string;
      reverse?: boolean;
    } = {}
  ) {
    const {
      first = 50,
      after,
      includeImages = true,
      sortKey = 'RELEVANCE',
      reverse = false
    } = options;

    const searchQuery = `
      ${includeImages ? OPTIMIZED_FRAGMENTS.PRODUCT_WITH_IMAGES : OPTIMIZED_FRAGMENTS.PRODUCT_CORE}
      
      query SearchProducts(
        $query: String!
        $first: Int!
        $after: String
        $sortKey: ProductSortKeys!
        $reverse: Boolean!
      ) {
        products(
          query: $query
          first: $first
          after: $after
          sortKey: $sortKey
          reverse: $reverse
        ) {
          edges {
            node {
              ${includeImages ? '...ProductWithImages' : '...ProductCore'}
            }
            cursor
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    return this.executeQuery(searchQuery, {
      query,
      first,
      after,
      sortKey,
      reverse
    });
  }

  // Execute query with performance monitoring
  private async executeQuery(query: string, variables: Record<string, any> = {}) {
    const startTime = Date.now();
    
    // Analyze query complexity
    const complexity = analyzeQueryComplexity(query);
    if (complexity.warnings.length > 0) {
      console.warn('GraphQL Query Warnings:', complexity.warnings);
    }

    try {
      const result = await this.client.query({
        data: { query, variables }
      });

      const executionTime = Date.now() - startTime;
      performanceMonitor.recordQuery(query, executionTime, false);

      // Log slow queries
      if (executionTime > 1000) {
        console.warn(`Slow GraphQL query detected: ${executionTime}ms`, {
          complexity: complexity.score,
          suggestions: complexity.suggestions
        });
      }

      return result.body;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      performanceMonitor.recordQuery(query, executionTime, true);
      throw error;
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

// Registry-specific optimized queries
export class RegistryQueries {
  private client: OptimizedShopifyClient;

  constructor(session: any) {
    this.client = new OptimizedShopifyClient(session);
  }

  // Get products for registry with optimized fields
  async getRegistryProducts(productIds: string[]) {
    return this.client.getProducts(productIds, {
      includeImages: true,
      includeVariants: true,
      includeMetafields: true,
      useCache: true,
      ttl: 600000 // 10 minutes for registry products
    });
  }

  // Fast inventory check for registry items
  async checkRegistryInventory(productIds: string[]) {
    return this.client.getInventoryLevels(productIds, true);
  }

  // Optimized product search for adding to registry
  async searchForRegistry(searchTerm: string, cursor?: string) {
    return this.client.searchProducts(searchTerm, {
      first: 20,
      after: cursor,
      includeImages: true,
      sortKey: 'RELEVANCE'
    });
  }

  // Batch update registry metafields
  async updateRegistryMetafields(registryItems: Array<{
    productId: string;
    registryId: string;
    quantity: number;
    priority: string;
    notes?: string;
  }>) {
    const metafields = registryItems.flatMap(item => [
      {
        ownerId: item.productId,
        namespace: 'wishcraft',
        key: 'registry_id',
        value: item.registryId,
        type: 'single_line_text_field'
      },
      {
        ownerId: item.productId,
        namespace: 'wishcraft',
        key: 'quantity_wanted',
        value: item.quantity.toString(),
        type: 'number_integer'
      },
      {
        ownerId: item.productId,
        namespace: 'wishcraft',
        key: 'priority',
        value: item.priority,
        type: 'single_line_text_field'
      }
    ]);

    return this.client.batchSetMetafields(metafields);
  }
}

// Performance utilities for Shopify operations
export const shopifyPerformanceUtils = {
  // Optimize webhook payload size
  minimizeWebhookPayload: (payload: any, requiredFields: string[]) => {
    const minimized: any = {};
    requiredFields.forEach(field => {
      if (payload[field] !== undefined) {
        minimized[field] = payload[field];
      }
    });
    return minimized;
  },

  // Rate limiting helper
  createRateLimiter: (maxRequests: number, windowMs: number) => {
    const requests = new Map<string, number[]>();
    
    return (identifier: string): boolean => {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      if (!requests.has(identifier)) {
        requests.set(identifier, []);
      }
      
      const userRequests = requests.get(identifier)!;
      
      // Remove old requests outside the window
      const validRequests = userRequests.filter(time => time > windowStart);
      
      if (validRequests.length >= maxRequests) {
        return false; // Rate limit exceeded
      }
      
      validRequests.push(now);
      requests.set(identifier, validRequests);
      return true;
    };
  },

  // GraphQL query cost estimation
  estimateQueryCost: (query: string): number => {
    let cost = 1; // Base cost
    
    // Count field selections
    const fields = (query.match(/\w+(?=\s*{|\s*$)/g) || []).length;
    cost += fields * 0.5;
    
    // Penalize large limits
    const limits = query.match(/first:\s*(\d+)|last:\s*(\d+)/g) || [];
    limits.forEach(limit => {
      const num = parseInt(limit.match(/\d+/)![0]);
      cost += Math.ceil(num / 10);
    });
    
    // Penalize deep nesting
    const depth = (query.match(/{/g) || []).length;
    cost += depth * 2;
    
    return Math.ceil(cost);
  }
};