/**
 * Unified GraphQL Client for WishCraft
 * Consolidates duplicate GraphQL client implementations
 * Shopify 2025 Compliance Ready
 */

import { authenticate } from "~/shopify.server";
import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { cache } from './cache.server';
import { log } from "./logger.server";
import { retryShopifyOperation } from "./retry.server";
import { Errors } from "./errors.server";

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

    // Execute GraphQL query with centralized retry logic
    const responseData = await retryShopifyOperation(async () => {
      const response = await admin.graphql(query, {
        variables: options.variables,
      });

      const data = await response.json() as GraphQLResponse<T>;
      
      // Check for rate limiting or throttling errors that should trigger retry
      const shouldRetry = data.errors?.some(err => 
        err.extensions?.code === 'THROTTLED' ||
        err.message.toLowerCase().includes('throttled') ||
        err.message.toLowerCase().includes('rate limit')
      );
      
      if (shouldRetry) {
        throw Errors.unavailable(`Shopify API throttled: ${data.errors?.[0]?.message}`);
      }
      
      return data;
    });

        const duration = Date.now() - startTime;

        // Log query performance
        log.info("GraphQL query executed", {
          operationName: options.operationName,
          duration,
          hasErrors: !!responseData.errors,
          cost: responseData.extensions?.cost,
        });

        // Cache successful responses
        if (options.cacheKey && !responseData.errors) {
          const ttl = options.cacheTtl || 300; // 5 minutes default
          await cache.set(options.cacheKey, responseData, ttl);
        }

        return responseData;
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