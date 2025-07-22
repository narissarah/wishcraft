import { json } from "@remix-run/node";

/**
 * Standardized API response utilities for Shopify 2025 compliance
 * Minimal implementation following Shopify best practices
 */
export const apiResponse = {
  success: (data: any, meta?: any) => {
    return json({ success: true, data, ...meta }, { status: 200 });
  },

  created: (data: any, message?: string) => {
    return json({ 
      success: true, 
      data, 
      message: message || "Resource created successfully" 
    }, { status: 201 });
  },

  error: (code: string, message: string, status: number = 400, errors?: any) => {
    return json({ 
      success: false, 
      error: { code, message, ...(errors && { errors }) } 
    }, { status });
  },

  validationError: (errors: Record<string, string[]>) => {
    return json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        errors
      }
    }, { status: 400 });
  },

  notFound: (resource: string = "Resource") => {
    return json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `${resource} not found`
      }
    }, { status: 404 });
  },

  unauthorized: (message: string = "Unauthorized") => {
    return json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message
      }
    }, { status: 401 });
  },

  forbidden: (message: string = "Forbidden") => {
    return json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message
      }
    }, { status: 403 });
  },

  rateLimitExceeded: (retryAfter: number = 60) => {
    return json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Rate limit exceeded"
      }
    }, { 
      status: 429,
      headers: { "Retry-After": retryAfter.toString() }
    });
  },

  serverError: (error?: any) => {
    return json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      }
    }, { status: 500 });
  }
};