/**
 * Unified GraphQL Client for WishCraft
 * Consolidates duplicate GraphQL client implementations
 * Shopify 2025 Compliance Ready
 */

import { authenticate } from "~/shopify.server";
import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { cache } from './cache.server';
import { log } from "./logger.server";

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: {
      code: string;
      documentation?: string;
      timestamp?: string;
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
    tracing?: any;
  };
}

export interface QueryOptions {
  variables?: Record<string, any>;
  operationName?: string;
  cacheKey?: string;
  cacheTtl?: number;
  retries?: number;
  timeout?: number;
}

/**
 * Execute a GraphQL query with caching and error handling
 */
export async function graphqlQuery<T = any>(
  request: Request,
  query: string,
  options: QueryOptions = {}
): Promise<GraphQLResponse<T>> {
  const startTime = Date.now();
  const maxRetries = options.retries ?? 3;
  let lastError: Error | undefined;
  
  try {
    // Authenticate with Shopify
    const { admin } = await authenticate.admin(request);
    
    // Check cache first if cacheKey provided
    if (options.cacheKey) {
      const cached = await cache.get(options.cacheKey);
      if (cached) {
        log.debug("GraphQL cache hit", { cacheKey: options.cacheKey });
        return cached as GraphQLResponse<T>;
      }
    }

    // Execute GraphQL query with retry logic
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await admin.graphql(query, {
          variables: options.variables,
        });

        const responseData = await response.json() as GraphQLResponse<T>;
        const duration = Date.now() - startTime;

        // Log query performance
        log.info("GraphQL query executed", {
          operationName: options.operationName,
          duration,
          hasErrors: !!responseData.errors,
          cost: responseData.extensions?.cost,
          attempt: attempt > 0 ? attempt : undefined,
        });

        // Check for rate limiting errors
        const rateLimitError = responseData.errors?.find(
          err => err.extensions?.code === 'THROTTLED'
        );
        
        if (rateLimitError && attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
          log.warn(`GraphQL rate limited, retrying in ${delay}ms`, {
            attempt,
            operationName: options.operationName,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Cache successful responses
        if (options.cacheKey && !responseData.errors) {
          const ttl = options.cacheTtl || 300; // 5 minutes default
          await cache.set(options.cacheKey, responseData, ttl);
        }

        return responseData;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if error is retryable
        const isRetryable = 
          error instanceof Error && (
            error.message.includes('ECONNRESET') ||
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('ENOTFOUND') ||
            error.message.includes('fetch failed')
          );
        
        if (isRetryable && attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          log.warn(`GraphQL request failed, retrying in ${delay}ms`, {
            attempt,
            operationName: options.operationName,
            error: lastError.message,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw lastError;
      }
    }
    
    throw lastError || new Error('GraphQL query failed after retries');
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("GraphQL query failed", {
      error: error instanceof Error ? error.message : String(error),
      operationName: options.operationName,
      duration,
    });
    
    throw error;
  }
}

/**
 * Execute a GraphQL mutation (no caching)
 */
export async function graphqlMutation<T = any>(
  request: Request,
  mutation: string,
  variables?: Record<string, any>
): Promise<GraphQLResponse<T>> {
  return graphqlQuery<T>(request, mutation, {
    variables,
    operationName: "mutation",
  });
}