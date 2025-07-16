/**
 * Enhanced Shopify API Client with Circuit Breaker Pattern
 * Built for Shopify 2025 Compliance
 */

import { shopifyApp } from "@shopify/shopify-app-remix";
import { getCircuitBreaker, retryWithBackoff } from "~/lib/circuit-breaker.server";
import { log } from "~/lib/logger.server";
import type { AdminApiContext } from "@shopify/shopify-app-remix";

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    extensions?: {
      code: string;
      documentation?: string;
    };
  }>;
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

export class ShopifyAPIClient {
  private readonly admin: AdminApiContext;
  private readonly shop: string;
  private readonly circuitBreaker;
  
  constructor(admin: AdminApiContext, shop: string) {
    this.admin = admin;
    this.shop = shop;
    this.circuitBreaker = getCircuitBreaker(`shopify-api-${shop}`, {
      failureThreshold: 3,
      resetTimeout: 60000,
      requestTimeout: 30000,
      volumeThreshold: 5,
      errorThresholdPercentage: 50
    });
  }

  /**
   * Execute a GraphQL query with circuit breaker protection
   */
  async graphql<T = any>(
    query: string,
    variables?: Record<string, any>,
    options?: {
      fallback?: () => Promise<T> | T;
      retryable?: boolean;
      maxRetries?: number;
    }
  ): Promise<GraphQLResponse<T>> {
    const executeQuery = async () => {
      const startTime = Date.now();
      
      try {
        const response = await this.admin.graphql(query, { variables });
        const result = await response.json() as GraphQLResponse<T>;
        
        // Log query costs for monitoring
        if (result.extensions?.cost) {
          const cost = result.extensions.cost;
          log.debug("GraphQL query cost", {
            shop: this.shop,
            requestedCost: cost.requestedQueryCost,
            actualCost: cost.actualQueryCost,
            availablePoints: cost.throttleStatus.currentlyAvailable,
            duration: Date.now() - startTime
          });
          
          // Warn if approaching rate limit
          const utilizationRate = 1 - (cost.throttleStatus.currentlyAvailable / cost.throttleStatus.maximumAvailable);
          if (utilizationRate > 0.8) {
            log.warn("High GraphQL rate limit utilization", {
              shop: this.shop,
              utilizationRate,
              available: cost.throttleStatus.currentlyAvailable,
              maximum: cost.throttleStatus.maximumAvailable
            });
          }
        }
        
        // Check for GraphQL errors
        if (result.errors && result.errors.length > 0) {
          const error = new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(", ")}`);
          (error as any).graphqlErrors = result.errors;
          throw error;
        }
        
        return result;
      } catch (error) {
        // Enhance error with context
        if (error instanceof Error) {
          (error as any).shop = this.shop;
          (error as any).query = query.substring(0, 100) + "...";
          (error as any).duration = Date.now() - startTime;
        }
        throw error;
      }
    };

    // Wrap with circuit breaker
    const circuitBreakerExecute = () => this.circuitBreaker.execute(
      executeQuery,
      options?.fallback
    );

    // Add retry logic if enabled
    if (options?.retryable) {
      return retryWithBackoff(circuitBreakerExecute, {
        maxAttempts: options.maxRetries || 3,
        initialDelay: 1000,
        maxDelay: 10000,
        factor: 2,
        jitter: true
      });
    }

    return circuitBreakerExecute();
  }

  /**
   * Execute a REST API call with circuit breaker protection
   */
  async rest<T = any>(
    method: string,
    path: string,
    options?: {
      data?: any;
      query?: Record<string, any>;
      fallback?: () => Promise<T> | T;
      retryable?: boolean;
      maxRetries?: number;
    }
  ): Promise<T> {
    const executeRequest = async () => {
      const startTime = Date.now();
      
      try {
        const response = await this.admin.rest[method.toUpperCase()](path, {
          data: options?.data,
          query: options?.query
        });
        
        log.debug("REST API call completed", {
          shop: this.shop,
          method,
          path,
          duration: Date.now() - startTime,
          status: response.status
        });
        
        if (!response.ok) {
          const error = new Error(`REST API error: ${response.status} ${response.statusText}`);
          (error as any).status = response.status;
          (error as any).statusText = response.statusText;
          throw error;
        }
        
        return response.body as T;
      } catch (error) {
        // Enhance error with context
        if (error instanceof Error) {
          (error as any).shop = this.shop;
          (error as any).method = method;
          (error as any).path = path;
          (error as any).duration = Date.now() - startTime;
        }
        throw error;
      }
    };

    // Wrap with circuit breaker
    const circuitBreakerExecute = () => this.circuitBreaker.execute(
      executeRequest,
      options?.fallback
    );

    // Add retry logic if enabled
    if (options?.retryable) {
      return retryWithBackoff(circuitBreakerExecute, {
        maxAttempts: options.maxRetries || 3,
        initialDelay: 1000,
        maxDelay: 10000,
        factor: 2,
        jitter: true
      });
    }

    return circuitBreakerExecute();
  }

  /**
   * Batch multiple GraphQL queries
   */
  async batchGraphQL<T = any>(
    queries: Array<{
      query: string;
      variables?: Record<string, any>;
      key: string;
    }>
  ): Promise<Record<string, GraphQLResponse<T>>> {
    const batchQuery = `
      query BatchQuery {
        ${queries.map((q, i) => `
          query${i}: ${q.query}
        `).join("\n")}
      }
    `;

    const variables = queries.reduce((acc, q, i) => {
      if (q.variables) {
        Object.entries(q.variables).forEach(([key, value]) => {
          acc[`${key}_${i}`] = value;
        });
      }
      return acc;
    }, {} as Record<string, any>);

    const response = await this.graphql(batchQuery, variables, { retryable: true });
    
    // Map responses back to keys
    const results: Record<string, GraphQLResponse<T>> = {};
    queries.forEach((q, i) => {
      results[q.key] = {
        data: response.data?.[`query${i}`],
        errors: response.errors
      };
    });
    
    return results;
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics() {
    return this.circuitBreaker.getMetrics();
  }

  /**
   * Get circuit breaker state
   */
  getState() {
    return this.circuitBreaker.getState();
  }

  /**
   * Force reset circuit breaker
   */
  reset() {
    this.circuitBreaker.reset();
  }
}

// Factory function to create API client
export function createShopifyAPIClient(admin: AdminApiContext, shop: string): ShopifyAPIClient {
  return new ShopifyAPIClient(admin, shop);
}

// Common GraphQL queries with circuit breaker
export const ShopifyQueries = {
  getProducts: (first: number = 50, cursor?: string) => `
    query GetProducts($first: Int!, $cursor: String) {
      products(first: $first, after: $cursor) {
        edges {
          node {
            id
            title
            handle
            status
            totalInventory
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  price
                  inventoryQuantity
                }
              }
            }
          }
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
  
  getCustomer: (id: string) => `
    query GetCustomer($id: ID!) {
      customer(id: $id) {
        id
        email
        firstName
        lastName
        acceptsMarketing
        createdAt
        updatedAt
        state
        addresses(first: 5) {
          edges {
            node {
              id
              address1
              address2
              city
              province
              country
              zip
            }
          }
        }
      }
    }
  `,
  
  createWebhook: (topic: string, callbackUrl: string) => `
    mutation CreateWebhook($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
      webhookSubscriptionCreate(
        topic: $topic
        webhookSubscription: {
          callbackUrl: $callbackUrl
          format: JSON
        }
      ) {
        webhookSubscription {
          id
          topic
          callbackUrl
        }
        userErrors {
          field
          message
        }
      }
    }
  `
};

// Rate limit aware GraphQL client
export class RateLimitAwareClient extends ShopifyAPIClient {
  private requestQueue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private minRequestInterval = 200; // 200ms between requests

  async graphql<T = any>(
    query: string,
    variables?: Record<string, any>,
    options?: any
  ): Promise<GraphQLResponse<T>> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await super.graphql<T>(query, variables, options);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve => 
          setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
        );
      }

      const request = this.requestQueue.shift();
      if (request) {
        this.lastRequestTime = Date.now();
        await request();
      }
    }

    this.processing = false;
  }
}