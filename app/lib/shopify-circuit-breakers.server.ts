// ARCHITECTURE FIX: Circuit breakers for Shopify API calls
import { getCircuitBreaker, CircuitBreaker } from "~/lib/circuit-breaker.server";
import { log } from "~/lib/logger.server";
import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

// Circuit breaker configurations for different Shopify APIs
const SHOPIFY_API_BREAKER_CONFIG = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000, // 30 seconds
  openDuration: 60000, // 1 minute
  halfOpenRetries: 3
};

const WEBHOOK_BREAKER_CONFIG = {
  failureThreshold: 10,
  successThreshold: 5,
  timeout: 15000, // 15 seconds
  openDuration: 30000, // 30 seconds
  halfOpenRetries: 5,
  resetTimeout: 30000, // 30 seconds
  volumeThreshold: 5,
  errorThresholdPercentage: 60
};

// Circuit breaker instances - 2025 GraphQL-only compliance
export const graphqlAdminApiBreaker = getCircuitBreaker('ShopifyGraphQLAdminAPI', SHOPIFY_API_BREAKER_CONFIG);
// REMOVED: restAdminApiBreaker - REST API deprecated for 2025 compliance
export const webhookProcessingBreaker = getCircuitBreaker('ShopifyWebhookProcessing', WEBHOOK_BREAKER_CONFIG);
export const externalServiceBreaker = getCircuitBreaker('ExternalServices', SHOPIFY_API_BREAKER_CONFIG);

// Wrapped GraphQL Admin API call with circuit breaker
export async function callGraphQLAdminAPIWithBreaker(
  admin: AdminApiContext,
  query: string,
  variables?: any
) {
  return graphqlAdminApiBreaker.call(async () => {
    try {
      const response = await admin.graphql(query, { variables });
      const responseData = await response.json();
      const json = responseData as any;
      
      // Check for GraphQL errors
      if (json.errors && json.errors.length > 0) {
        // Check if it's a rate limit error
        const rateLimitError = json.errors.find((error: any) => 
          error.message?.includes('Throttled') || 
          error.extensions?.code === 'THROTTLED'
        );
        
        if (rateLimitError) {
          throw new Error('Shopify API rate limit exceeded');
        }
        
        throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
      }
      
      return json;
    } catch (error) {
      log.error('Shopify GraphQL API error', error);
      throw error;
    }
  });
}

// REMOVED: callRESTAdminAPIWithBreaker - REST API deprecated for 2025 compliance
// Use callGraphQLAdminAPIWithBreaker instead for all API calls

// Wrapped webhook processing with circuit breaker
export async function processWebhookWithBreaker(
  processFn: () => Promise<any>
) {
  return webhookProcessingBreaker.call(async () => {
    try {
      return await processFn();
    } catch (error) {
      log.error('Webhook processing error', error);
      throw error;
    }
  });
}

// Wrapped external service call with circuit breaker
export async function callExternalServiceWithBreaker(
  serviceName: string,
  callFn: () => Promise<any>
) {
  return externalServiceBreaker.call(async () => {
    try {
      const result = await callFn();
      log.debug(`External service ${serviceName} call successful`);
      return result;
    } catch (error) {
      log.error(`External service ${serviceName} error`, error);
      throw error;
    }
  });
}

// Get all circuit breaker states for monitoring
export function getCircuitBreakerStates() {
  return {
    graphqlAPI: {
      state: graphqlAdminApiBreaker.getState(),
      metrics: graphqlAdminApiBreaker.getMetrics()
    },
    restAPI: {
      state: restAdminApiBreaker.getState(),
      metrics: restAdminApiBreaker.getMetrics()
    },
    webhooks: {
      state: webhookProcessingBreaker.getState(),
      metrics: webhookProcessingBreaker.getMetrics()
    },
    externalServices: {
      state: externalServiceBreaker.getState(),
      metrics: externalServiceBreaker.getMetrics()
    }
  };
}

// Health check for all circuit breakers
export function areCircuitBreakersHealthy(): boolean {
  const states = getCircuitBreakerStates();
  return Object.values(states).every(breaker => 
    breaker.state === 'CLOSED' || breaker.state === 'HALF_OPEN'
  );
}

// Reset all circuit breakers (for recovery)
export function resetAllShopifyCircuitBreakers() {
  graphqlAdminApiBreaker.reset();
  restAdminApiBreaker.reset();
  webhookProcessingBreaker.reset();
  externalServiceBreaker.reset();
  log.info('All Shopify circuit breakers reset');
}