/**
 * Comprehensive Error Handling Middleware for WishCraft
 * Centralizes error processing, logging, and response formatting
 */

import { json } from "@remix-run/node";
import { log } from "./logger.server";
import { apiResponse } from "./api-response.server";
import { ERROR_MESSAGES } from "./constants.server";
import { generateErrorId } from "./crypto.server";

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  shopId?: string;
  userAgent?: string;
  ip?: string;
  url?: string;
  method?: string;
  stack?: string;
  type?: string;
  critical?: boolean;
  client?: boolean;
  componentStack?: string;
  operation?: string;
  service?: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly context: ErrorContext;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    isOperational: boolean = true,
    context: ErrorContext = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.context = context;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// Predefined error classes for common scenarios
export class ValidationError extends AppError {
  constructor(message: string = ERROR_MESSAGES.VALIDATION_FAILED, context: ErrorContext = {}) {
    super(message, 400, "VALIDATION_ERROR", true, context);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = ERROR_MESSAGES.UNAUTHORIZED, context: ErrorContext = {}) {
    super(message, 401, "AUTHENTICATION_ERROR", true, context);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = ERROR_MESSAGES.FORBIDDEN, context: ErrorContext = {}) {
    super(message, 403, "AUTHORIZATION_ERROR", true, context);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = ERROR_MESSAGES.NOT_FOUND, context: ErrorContext = {}) {
    super(message, 404, "NOT_FOUND_ERROR", true, context);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = ERROR_MESSAGES.RATE_LIMITED, context: ErrorContext = {}) {
    super(message, 429, "RATE_LIMIT_ERROR", true, context);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = ERROR_MESSAGES.DATABASE_QUERY_FAILED, context: ErrorContext = {}) {
    super(message, 500, "DATABASE_ERROR", true, context);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string = ERROR_MESSAGES.EXTERNAL_SERVICE_UNAVAILABLE, context: ErrorContext = {}) {
    super(message, 503, "EXTERNAL_SERVICE_ERROR", true, context);
  }
}

/**
 * Enhanced error logging with structured data
 */
export function logError(error: Error, context: ErrorContext = {}): string {
  const errorId = generateErrorId();
  
  const logData = {
    errorId,
    name: error.name,
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  };

  // Add specific AppError properties if available
  if (error instanceof AppError) {
    Object.assign(logData, {
      statusCode: error.statusCode,
      code: error.code,
      isOperational: error.isOperational,
      errorContext: error.context,
    });
  }

  // Log based on severity
  if (error instanceof AppError && error.statusCode < 500) {
    log.warn("Application Error", error);
  } else {
    log.error("System Error", error);
  }

  return errorId;
}

/**
 * Convert any error to a standardized API response
 */
export function errorToResponse(error: Error, context: ErrorContext = {}): Response {
  const errorId = logError(error, context);

  // Handle known AppError instances
  if (error instanceof AppError) {
    return handleAppError(error, errorId);
  }

  // Handle common Node.js/system errors
  if (error.name === "ValidationError") {
    return apiResponse.validationError({ message: [error.message] });
  }

  if (error.message.includes("ECONNREFUSED") || error.message.includes("ENOTFOUND")) {
    return apiResponse.error("SERVICE_UNAVAILABLE", "External service unavailable", 503);
  }

  if (error.message.includes("timeout")) {
    return apiResponse.error("REQUEST_TIMEOUT", "Request timeout", 408);
  }

  // Handle Prisma errors
  if (error.name === "PrismaClientKnownRequestError") {
    return handlePrismaError(error as any, errorId);
  }

  // Handle unexpected errors
  return apiResponse.serverError(error);
}

/**
 * Handle AppError instances with proper status codes
 */
function handleAppError(error: AppError, errorId: string): Response {
  switch (error.statusCode) {
    case 400:
      return apiResponse.validationError({ message: [error.message] });
    case 401:
      return apiResponse.unauthorized(error.message);
    case 403:
      return apiResponse.forbidden(error.message);
    case 404:
      return apiResponse.notFound(error.message);
    case 429:
      return apiResponse.rateLimitExceeded();
    case 503:
      return apiResponse.error("SERVICE_UNAVAILABLE", error.message, 503);
    default:
      return apiResponse.serverError(error);
  }
}

/**
 * Handle Prisma database errors with meaningful messages
 */
function handlePrismaError(error: any, errorId: string): Response {
  const { code, meta } = error;

  switch (code) {
    case "P2002": // Unique constraint violation
      const field = meta?.target?.[0] || "field";
      return apiResponse.validationError({
        [field]: [`${field} already exists`]
      });

    case "P2025": // Record not found
      return apiResponse.notFound("Record not found");

    case "P2003": // Foreign key constraint violation
      return apiResponse.validationError({
        reference: ["Invalid reference to related record"]
      });

    case "P1001": // Database unreachable
    case "P1002": // Database timeout
      return apiResponse.error("DATABASE_UNAVAILABLE", "Database unavailable", 503);

    case "P2034": // Transaction conflict
      return apiResponse.error("TRANSACTION_CONFLICT", "Operation conflict, please retry", 409);

    default:
      return apiResponse.serverError(error);
  }
}

/**
 * Middleware wrapper for route handlers
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  contextExtractor?: (request?: Request) => ErrorContext
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      const request = args.find(arg => arg instanceof Request);
      const context = contextExtractor ? contextExtractor(request) : extractRequestContext(request);
      
      return errorToResponse(error as Error, context);
    }
  }) as T;
}

/**
 * Extract error context from request
 */
export function extractRequestContext(request?: Request): ErrorContext {
  if (!request) return {};

  return {
    url: request.url,
    method: request.method,
    userAgent: request.headers.get("user-agent") || undefined,
    ip: request.headers.get("x-forwarded-for") || 
        request.headers.get("x-real-ip") || 
        undefined,
  };
}

/**
 * Global unhandled error handlers for server-side
 */
export function setupGlobalErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on("uncaughtException", (error: Error) => {
    const errorId = logError(error, { 
      type: "uncaughtException",
      critical: true 
    });
    
    log.error("CRITICAL: Uncaught Exception", error, { errorId });
    
    // Graceful shutdown
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    const errorId = logError(error, { 
      type: "unhandledRejection",
      critical: true 
    });
    
    log.error("CRITICAL: Unhandled Promise Rejection", error);
    
    // Graceful shutdown
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle warning events
  process.on("warning", (warning: Error) => {
    log.warn("Node.js Warning", warning);
  });
}

/**
 * Error boundary for React components (client-side)
 */
export class ErrorBoundary {
  static getDerivedStateFromError(error: Error) {
    const errorId = logError(error, { 
      type: "react-error-boundary",
      client: true 
    });
    
    return { 
      hasError: true, 
      errorId,
      error: {
        name: error.name,
        message: error.message,
      }
    };
  }

  static componentDidCatch(error: Error, errorInfo: any) {
    logError(error, {
      type: "react-component-error",
      client: true,
      componentStack: errorInfo.componentStack,
    });
  }
}

/**
 * Utility to safely execute async operations with error handling
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  fallback?: T,
  context: ErrorContext = {}
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    logError(error as Error, context);
    return fallback;
  }
}

/**
 * Utility to wrap database operations with consistent error handling
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string = "database operation"
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const context = { operation: operationName };
    
    // Re-throw as DatabaseError for consistent handling
    if (error instanceof Error) {
      throw new DatabaseError(`${operationName} failed: ${error.message}`, context);
    }
    
    throw new DatabaseError(`${operationName} failed`, context);
  }
}

/**
 * Utility for handling external API calls with retries and error handling
 */
export async function withExternalServiceErrorHandling<T>(
  operation: () => Promise<T>,
  serviceName: string = "external service"
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const context = { service: serviceName };
    
    // Re-throw as ExternalServiceError for consistent handling
    if (error instanceof Error) {
      throw new ExternalServiceError(`${serviceName} error: ${error.message}`, context);
    }
    
    throw new ExternalServiceError(`${serviceName} failed`, context);
  }
}