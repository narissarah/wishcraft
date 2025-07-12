/**
 * Enhanced Error Handling for Shopify 2025-01 API Changes
 * Handles new error types, validation changes, and improved error reporting
 */

export interface ShopifyAPIError {
  code: string;
  message: string;
  field?: string;
  extensions?: {
    code: string;
    documentation_url?: string;
    requestId?: string;
    cost?: {
      throttle_status: {
        maximum_available: number;
        currently_available: number;
        restore_rate: number;
      };
      actual_query_cost: number;
      requested_query_cost: number;
    };
  };
}

export interface GraphQLError {
  message: string;
  locations?: Array<{
    line: number;
    column: number;
  }>;
  path?: string[];
  extensions?: {
    code: string;
    exception?: any;
  };
}

export interface ShopifyErrorResponse {
  errors?: GraphQLError[];
  data?: any;
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

/**
 * Enhanced error handler for 2025-01 API compliance
 */
export class ShopifyErrorHandler {
  
  /**
   * Process and categorize Shopify API errors
   */
  static processAPIError(response: ShopifyErrorResponse): {
    isRetryable: boolean;
    retryAfter?: number;
    category: 'rate_limit' | 'authentication' | 'validation' | 'server_error' | 'client_error';
    userMessage: string;
    technicalMessage: string;
    requestId?: string;
    cost?: any;
  } {
    // Handle GraphQL errors
    if (response.errors && response.errors.length > 0) {
      const firstError = response.errors[0];
      
      // Check for specific 2025-01 error types
      if (firstError.extensions?.code) {
        switch (firstError.extensions.code) {
          case 'THROTTLED':
          case 'RATE_LIMITED':
            return this.handleRateLimitError(response);
          
          case 'AUTHENTICATION_REQUIRED':
          case 'UNAUTHORIZED':
            return this.handleAuthenticationError(firstError);
          
          case 'VALIDATION_ERROR':
          case 'INVALID_INPUT':
            return this.handleValidationError(firstError);
          
          case 'INTERNAL_SERVER_ERROR':
          case 'TIMEOUT':
            return this.handleServerError(firstError);
          
          case 'DEPRECATED_MUTATION':
          case 'DEPRECATED_FIELD':
            return this.handleDeprecationError(firstError);
          
          case 'INSUFFICIENT_SCOPE':
            return this.handleScopeError(firstError);
          
          case 'RESOURCE_NOT_FOUND':
            return this.handleNotFoundError(firstError);
          
          default:
            return this.handleUnknownError(firstError);
        }
      }
      
      // Fallback for errors without extensions
      return this.handleGenericGraphQLError(firstError);
    }
    
    // Check for cost/throttling information
    if (response.extensions?.cost) {
      const cost = response.extensions.cost;
      if (cost.throttleStatus.currentlyAvailable < cost.requestedQueryCost) {
        return this.handleRateLimitError(response);
      }
    }
    
    // No errors found
    return {
      isRetryable: false,
      category: 'client_error',
      userMessage: 'Unknown error occurred',
      technicalMessage: 'No errors found in response'
    };
  }

  private static handleRateLimitError(response: ShopifyErrorResponse) {
    const cost = response.extensions?.cost;
    const restoreRate = cost?.throttleStatus.restoreRate || 50; // Default restore rate
    const currentlyAvailable = cost?.throttleStatus.currentlyAvailable || 0;
    const requestedCost = cost?.requestedQueryCost || 1;
    
    // Calculate retry delay based on cost restoration
    const retryAfter = Math.ceil((requestedCost - currentlyAvailable) / restoreRate);
    
    return {
      isRetryable: true,
      retryAfter: Math.max(retryAfter, 1), // Minimum 1 second
      category: 'rate_limit' as const,
      userMessage: 'Request rate exceeded. Please wait a moment and try again.',
      technicalMessage: `GraphQL cost limit exceeded. Current: ${currentlyAvailable}, Requested: ${requestedCost}`,
      cost: cost
    };
  }

  private static handleAuthenticationError(error: GraphQLError) {
    return {
      isRetryable: false,
      category: 'authentication' as const,
      userMessage: 'Authentication required. Please reconnect your Shopify store.',
      technicalMessage: `Authentication error: ${error.message}`,
      requestId: error.extensions?.exception?.requestId
    };
  }

  private static handleValidationError(error: GraphQLError) {
    return {
      isRetryable: false,
      category: 'validation' as const,
      userMessage: 'Invalid data provided. Please check your input and try again.',
      technicalMessage: `Validation error: ${error.message}`,
      requestId: error.extensions?.exception?.requestId
    };
  }

  private static handleServerError(error: GraphQLError) {
    return {
      isRetryable: true,
      retryAfter: 5, // 5 seconds for server errors
      category: 'server_error' as const,
      userMessage: 'Shopify is experiencing temporary issues. Please try again in a few moments.',
      technicalMessage: `Server error: ${error.message}`,
      requestId: error.extensions?.exception?.requestId
    };
  }

  private static handleDeprecationError(error: GraphQLError) {
    console.warn('DEPRECATED API USAGE:', error.message);
    
    return {
      isRetryable: false,
      category: 'client_error' as const,
      userMessage: 'This feature is no longer supported. Please contact support.',
      technicalMessage: `Deprecated API usage: ${error.message}`,
    };
  }

  private static handleScopeError(error: GraphQLError) {
    return {
      isRetryable: false,
      category: 'authentication' as const,
      userMessage: 'This action requires additional permissions. Please reinstall the app.',
      technicalMessage: `Insufficient scope: ${error.message}`,
    };
  }

  private static handleNotFoundError(error: GraphQLError) {
    return {
      isRetryable: false,
      category: 'client_error' as const,
      userMessage: 'The requested resource was not found.',
      technicalMessage: `Resource not found: ${error.message}`,
    };
  }

  private static handleUnknownError(error: GraphQLError) {
    return {
      isRetryable: false,
      category: 'client_error' as const,
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalMessage: `Unknown error [${error.extensions?.code}]: ${error.message}`,
    };
  }

  private static handleGenericGraphQLError(error: GraphQLError) {
    // Check message content for common patterns
    const message = error.message.toLowerCase();
    
    if (message.includes('throttled') || message.includes('rate limit')) {
      return {
        isRetryable: true,
        retryAfter: 2,
        category: 'rate_limit' as const,
        userMessage: 'Request rate exceeded. Please wait a moment and try again.',
        technicalMessage: error.message,
      };
    }
    
    if (message.includes('unauthorized') || message.includes('access token')) {
      return {
        isRetryable: false,
        category: 'authentication' as const,
        userMessage: 'Authentication required. Please reconnect your Shopify store.',
        technicalMessage: error.message,
      };
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return {
        isRetryable: false,
        category: 'validation' as const,
        userMessage: 'Invalid data provided. Please check your input and try again.',
        technicalMessage: error.message,
      };
    }
    
    return {
      isRetryable: false,
      category: 'client_error' as const,
      userMessage: 'An error occurred while processing your request.',
      technicalMessage: error.message,
    };
  }

  /**
   * Log structured error information for monitoring
   */
  static logError(
    error: any, 
    context: {
      operation: string;
      variables?: any;
      shop?: string;
      userId?: string;
    }
  ) {
    const errorInfo = this.processAPIError(error);
    
    console.error('Shopify API Error:', {
      timestamp: new Date().toISOString(),
      operation: context.operation,
      category: errorInfo.category,
      isRetryable: errorInfo.isRetryable,
      retryAfter: errorInfo.retryAfter,
      userMessage: errorInfo.userMessage,
      technicalMessage: errorInfo.technicalMessage,
      requestId: errorInfo.requestId,
      cost: errorInfo.cost,
      shop: context.shop,
      userId: context.userId,
      variables: context.variables ? JSON.stringify(context.variables) : undefined
    });
  }
}

/**
 * Utility function to wrap Shopify API calls with enhanced error handling
 */
export async function withErrorHandling<T>(
  operation: string,
  apiCall: () => Promise<Response>,
  context: { shop?: string; userId?: string; variables?: any } = {}
): Promise<{
  success: boolean;
  data?: T;
  error?: {
    category: string;
    userMessage: string;
    technicalMessage: string;
    isRetryable: boolean;
    retryAfter?: number;
  };
}> {
  try {
    const response = await apiCall();
    const data = await response.json();
    
    if (data.errors && data.errors.length > 0) {
      const errorInfo = ShopifyErrorHandler.processAPIError(data);
      ShopifyErrorHandler.logError(data, { operation, ...context });
      
      return {
        success: false,
        error: errorInfo
      };
    }
    
    return {
      success: true,
      data: data.data
    };
  } catch (error) {
    const errorInfo = {
      category: 'client_error',
      userMessage: 'A network error occurred. Please check your connection and try again.',
      technicalMessage: error instanceof Error ? error.message : 'Unknown network error',
      isRetryable: true,
      retryAfter: 5
    };
    
    ShopifyErrorHandler.logError(error, { operation, ...context });
    
    return {
      success: false,
      error: errorInfo
    };
  }
}