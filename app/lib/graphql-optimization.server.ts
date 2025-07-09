import { LRUCache } from 'lru-cache';

// GraphQL query optimization for Shopify Admin API

export interface GraphQLOptimizationConfig {
  enableBatching: boolean;
  enableCaching: boolean;
  maxBatchSize: number;
  cacheMaxAge: number;
}

const defaultConfig: GraphQLOptimizationConfig = {
  enableBatching: true,
  enableCaching: true,
  maxBatchSize: 10,
  cacheMaxAge: 5 * 60 * 1000, // 5 minutes
};

// Query result cache
const queryCache = new LRUCache<string, any>({
  max: 1000,
  ttl: defaultConfig.cacheMaxAge,
});

// Query batching utilities
interface BatchedQuery {
  query: string;
  variables: Record<string, any>;
  resolve: (result: any) => void;
  reject: (error: any) => void;
}

class GraphQLBatcher {
  private batch: BatchedQuery[] = [];
  private timeout: NodeJS.Timeout | null = null;

  addToBatch(query: string, variables: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.batch.push({ query, variables, resolve, reject });
      
      if (this.batch.length >= defaultConfig.maxBatchSize) {
        this.executeBatch();
      } else if (!this.timeout) {
        this.timeout = setTimeout(() => this.executeBatch(), 10); // 10ms debounce
      }
    });
  }

  private async executeBatch() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    const currentBatch = [...this.batch];
    this.batch = [];

    try {
      // Group queries by type for optimization
      const groupedQueries = this.groupQueriesByType(currentBatch);
      const results = await this.executeGroupedQueries(groupedQueries);
      
      // Resolve individual promises
      currentBatch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      currentBatch.forEach(item => item.reject(error));
    }
  }

  private groupQueriesByType(queries: BatchedQuery[]): Map<string, BatchedQuery[]> {
    const groups = new Map<string, BatchedQuery[]>();
    
    queries.forEach(query => {
      const queryType = this.extractQueryType(query.query);
      if (!groups.has(queryType)) {
        groups.set(queryType, []);
      }
      groups.get(queryType)!.push(query);
    });
    
    return groups;
  }

  private extractQueryType(query: string): string {
    // Extract the main query type (products, orders, customers, etc.)
    const match = query.match(/query\s*{\s*(\w+)/);
    return match ? match[1] : 'unknown';
  }

  private async executeGroupedQueries(groups: Map<string, BatchedQuery[]>): Promise<any[]> {
    const results: any[] = [];
    
    for (const [queryType, queries] of groups) {
      if (queryType === 'products' && queries.length > 1) {
        // Batch product queries
        const batchedResult = await this.batchProductQueries(queries);
        results.push(...batchedResult);
      } else {
        // Execute individually for other query types
        for (const query of queries) {
          const result = await this.executeQuery(query.query, query.variables);
          results.push(result);
        }
      }
    }
    
    return results;
  }

  private async batchProductQueries(queries: BatchedQuery[]): Promise<any[]> {
    // Combine multiple product queries into a single query
    const productIds = queries.flatMap(q => 
      q.variables.id ? [q.variables.id] : []
    );
    
    if (productIds.length === 0) return [];

    const batchQuery = `
      query BatchedProducts($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            description
            handle
            vendor
            productType
            tags
            status
            totalInventory
            images(first: 10) {
              edges {
                node {
                  id
                  url
                  altText
                  width
                  height
                }
              }
            }
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  price
                  compareAtPrice
                  sku
                  barcode
                  inventoryQuantity
                  availableForSale
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
            metafields(first: 10) {
              edges {
                node {
                  namespace
                  key
                  value
                  type
                }
              }
            }
          }
        }
      }
    `;

    const result = await this.executeQuery(batchQuery, { ids: productIds });
    
    // Map results back to individual queries
    return queries.map(query => {
      const productId = query.variables.id;
      const product = result.data.nodes.find((node: any) => node.id === productId);
      return { data: { product } };
    });
  }

  private async executeQuery(query: string, variables: Record<string, any>): Promise<any> {
    // This would integrate with your Shopify GraphQL client
    // For now, returning a mock structure
    return { data: {}, extensions: {} };
  }
}

const batcher = new GraphQLBatcher();

// Optimized GraphQL fragments for common queries
export const OPTIMIZED_FRAGMENTS = {
  PRODUCT_CORE: `
    fragment ProductCore on Product {
      id
      title
      handle
      vendor
      productType
      status
      totalInventory
    }
  `,
  
  PRODUCT_WITH_IMAGES: `
    fragment ProductWithImages on Product {
      ...ProductCore
      images(first: 5) {
        edges {
          node {
            id
            url(transform: { maxWidth: 800, maxHeight: 800 })
            altText
            width
            height
          }
        }
      }
    }
  `,
  
  PRODUCT_VARIANT_CORE: `
    fragment ProductVariantCore on ProductVariant {
      id
      title
      price
      compareAtPrice
      availableForSale
      selectedOptions {
        name
        value
      }
    }
  `,
  
  ORDER_SUMMARY: `
    fragment OrderSummary on Order {
      id
      name
      email
      totalPrice
      subtotalPrice
      totalTax
      currencyCode
      financialStatus
      fulfillmentStatus
      processedAt
    }
  `,
  
  CUSTOMER_CORE: `
    fragment CustomerCore on Customer {
      id
      email
      firstName
      lastName
      phone
      acceptsMarketing
      state
      tags
    }
  `
};

// Query optimization functions
export function optimizeProductQuery(
  productIds: string[], 
  fields: ('images' | 'variants' | 'metafields')[] = []
): string {
  const fragments = [OPTIMIZED_FRAGMENTS.PRODUCT_CORE];
  
  if (fields.includes('images')) {
    fragments.push(OPTIMIZED_FRAGMENTS.PRODUCT_WITH_IMAGES);
  }

  let additionalFields = '';
  if (fields.includes('variants')) {
    additionalFields += `
      variants(first: 100) {
        edges {
          node {
            ...ProductVariantCore
          }
        }
      }
    `;
  }
  
  if (fields.includes('metafields')) {
    additionalFields += `
      metafields(first: 10, namespace: "wishcraft") {
        edges {
          node {
            namespace
            key
            value
            type
          }
        }
      }
    `;
  }

  return `
    ${fragments.join('\n')}
    
    query OptimizedProducts($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          ...ProductCore
          ${fields.includes('images') ? '...ProductWithImages' : ''}
          ${additionalFields}
        }
      }
    }
  `;
}

export function optimizeInventoryQuery(productIds: string[]): string {
  return `
    query OptimizedInventory($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
          totalInventory
          variants(first: 100) {
            edges {
              node {
                id
                inventoryQuantity
                availableForSale
              }
            }
          }
        }
      }
    }
  `;
}

// Caching utilities
export function getCacheKey(query: string, variables: Record<string, any>): string {
  const normalizedQuery = query.replace(/\s+/g, ' ').trim();
  const variablesHash = JSON.stringify(variables, Object.keys(variables).sort());
  return `${normalizedQuery}:${variablesHash}`;
}

export async function cachedGraphQLQuery<T>(
  query: string,
  variables: Record<string, any>,
  executeQuery: (query: string, variables: Record<string, any>) => Promise<T>,
  ttl?: number
): Promise<T> {
  if (!defaultConfig.enableCaching) {
    return executeQuery(query, variables);
  }

  const cacheKey = getCacheKey(query, variables);
  const cached = queryCache.get(cacheKey);
  
  if (cached) {
    return cached;
  }

  const result = await executeQuery(query, variables);
  queryCache.set(cacheKey, result, { ttl });
  
  return result;
}

// Query complexity analysis
export function analyzeQueryComplexity(query: string): {
  score: number;
  warnings: string[];
  suggestions: string[];
} {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Check for nested queries
  const nestedQueries = (query.match(/{\s*\w+\s*{/g) || []).length;
  score += nestedQueries * 2;
  
  if (nestedQueries > 3) {
    warnings.push('Query has deep nesting which may impact performance');
    suggestions.push('Consider flattening the query structure');
  }

  // Check for large first/last parameters
  const largeLimits = query.match(/first:\s*(\d+)|last:\s*(\d+)/g) || [];
  largeLimits.forEach(limit => {
    const num = parseInt(limit.match(/\d+/)![0]);
    if (num > 250) {
      score += 10;
      warnings.push(`Large limit detected: ${num}. Shopify recommends max 250 items per query`);
      suggestions.push('Use pagination with smaller limits and cursor-based navigation');
    }
  });

  // Check for missing fragments
  const repeatedFields = query.match(/(\w+)\s*{[^}]*}/g) || [];
  const fieldCounts = new Map<string, number>();
  
  repeatedFields.forEach(field => {
    const fieldName = field.split('{')[0].trim();
    fieldCounts.set(fieldName, (fieldCounts.get(fieldName) || 0) + 1);
  });

  fieldCounts.forEach((count, field) => {
    if (count > 2) {
      score += count;
      suggestions.push(`Consider using fragments for repeated field: ${field}`);
    }
  });

  return { score, warnings, suggestions };
}

// Batch execution wrapper
export async function batchedGraphQLQuery<T>(
  query: string,
  variables: Record<string, any>
): Promise<T> {
  if (!defaultConfig.enableBatching) {
    // Execute immediately if batching is disabled
    throw new Error('Direct execution not implemented. Use your GraphQL client.');
  }

  return batcher.addToBatch(query, variables);
}

// Query performance monitoring
export class GraphQLPerformanceMonitor {
  private metrics = new Map<string, {
    count: number;
    totalTime: number;
    avgTime: number;
    errors: number;
  }>();

  recordQuery(query: string, executionTime: number, hasError = false): void {
    const queryType = this.extractQueryType(query);
    const current = this.metrics.get(queryType) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      errors: 0
    };

    current.count++;
    current.totalTime += executionTime;
    current.avgTime = current.totalTime / current.count;
    
    if (hasError) {
      current.errors++;
    }

    this.metrics.set(queryType, current);
  }

  private extractQueryType(query: string): string {
    const match = query.match(/query\s*(\w+)?.*?{\s*(\w+)/);
    return match ? (match[1] || match[2]) : 'unknown';
  }

  getMetrics(): Map<string, any> {
    return new Map(this.metrics);
  }

  getSlowQueries(threshold = 1000): Array<{ queryType: string; avgTime: number }> {
    return Array.from(this.metrics.entries())
      .filter(([, metrics]) => metrics.avgTime > threshold)
      .map(([queryType, metrics]) => ({ queryType, avgTime: metrics.avgTime }))
      .sort((a, b) => b.avgTime - a.avgTime);
  }
}

export const performanceMonitor = new GraphQLPerformanceMonitor();