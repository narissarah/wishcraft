/**
 * Unified Validation System for WishCraft
 * Consolidates all validation implementations into a single, comprehensive system
 * Built for Shopify 2025 Compliance
 */

import { z } from "zod";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { log } from "~/lib/logger.server";
import crypto from "crypto";
import { 
  sanitizeText, 
  sanitizeGiftMessage, 
  sanitizeSearchQuery,
  sanitizeInput,
  sanitizeHtml,
  sanitizeCustomerData,
  createSlug 
} from "~/lib/sanitization-unified.server";

/**
 * Base validation schemas with comprehensive coverage
 */
export const BaseSchemas = {
  // Identifiers
  uuid: z.string().uuid("Invalid UUID format"),
  cuid: z.string().cuid("Invalid CUID format"),
  
  // Shopify-specific
  shopifyGlobalId: z.string().refine(
    (id) => id.startsWith("gid://shopify/"),
    "Invalid Shopify Global ID format"
  ),
  shopifyDomain: z.string().refine(
    (domain) => /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(domain),
    "Invalid Shopify domain format"
  ),
  shopifyOrderId: z.union([z.string(), z.number()]).transform(String),
  
  // Contact information
  email: z.string().email("Invalid email format").max(254),
  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
    .optional(),
  
  // Text fields
  slug: z.string()
    .min(3, "Slug must be at least 3 characters")
    .max(100, "Slug must not exceed 100 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  url: z.string().url("Invalid URL format").max(2048),
  
  // Numbers
  positiveNumber: z.number().positive("Must be a positive number"),
  nonNegativeNumber: z.number().min(0, "Must be non-negative"),
  percentage: z.number().min(0).max(100),
  price: z.number()
    .min(0, "Price must be positive")
    .max(999999.99, "Price exceeds maximum value"),
  quantity: z.number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(999, "Quantity exceeds maximum value"),
  
  // Date/time
  isoDate: z.string().datetime("Invalid ISO date format"),
  futureDate: z.string()
    .datetime()
    .transform(str => new Date(str))
    .refine(date => date > new Date(), "Date must be in the future"),
  
  // Currency
  currencyCode: z.enum(["USD", "CAD", "EUR", "GBP", "AUD", "JPY", "NZD", "CHF", "SEK", "NOK"], {
    errorMap: () => ({ message: "Invalid currency code" })
  }),
  
  // Colors
  hexColor: z.string()
    .regex(/^#[0-9a-f]{6}$/i, "Invalid hex color format"),
  
  // File validation
  mimeType: z.string()
    .regex(/^(image|video|audio|application|text)\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*$/, "Invalid MIME type"),
  fileSize: z.number()
    .int("File size must be an integer")
    .min(1, "File must not be empty")
    .max(10 * 1024 * 1024, "File size must not exceed 10MB"),
};

/**
 * Registry validation schemas
 */
export const RegistrySchemas = {
  create: z.object({
    title: z.string()
      .min(1, "Title is required")
      .max(255, "Title must not exceed 255 characters")
      .transform(sanitizeText),
    description: z.string()
      .max(2000, "Description must not exceed 2000 characters")
      .transform(sanitizeText)
      .optional(),
    eventType: z.enum([
      "wedding",
      "birthday",
      "baby",
      "graduation",
      "anniversary",
      "holiday",
      "housewarming",
      "general"
    ]),
    eventDate: BaseSchemas.futureDate.optional(),
    visibility: z.enum(["public", "private", "friends", "password"]),
    accessCode: z.string()
      .min(4, "Access code must be at least 4 characters")
      .max(50, "Access code must not exceed 50 characters")
      .optional(),
    customerId: BaseSchemas.shopifyGlobalId.optional(),
    customerEmail: BaseSchemas.email,
    customerFirstName: z.string()
      .min(1, "First name is required")
      .max(100, "First name must not exceed 100 characters")
      .transform(sanitizeText),
    customerLastName: z.string()
      .max(100, "Last name must not exceed 100 characters")
      .transform(sanitizeText)
      .optional(),
    customerPhone: BaseSchemas.phone
  }),
  
  update: z.object({
    id: BaseSchemas.cuid,
    title: z.string()
      .min(1, "Title is required")
      .max(255, "Title must not exceed 255 characters")
      .transform(sanitizeText)
      .optional(),
    description: z.string()
      .max(2000, "Description must not exceed 2000 characters")
      .transform(sanitizeText)
      .optional(),
    eventType: z.enum([
      "wedding",
      "birthday",
      "baby",
      "graduation",
      "anniversary",
      "holiday",
      "housewarming",
      "general"
    ]).optional(),
    eventDate: BaseSchemas.isoDate.optional(),
    visibility: z.enum(["public", "private", "friends", "password"]).optional(),
    accessCode: z.string()
      .min(4, "Access code must be at least 4 characters")
      .max(50, "Access code must not exceed 50 characters")
      .optional(),
    status: z.enum(["active", "inactive", "draft", "archived"]).optional()
  }),
  
  addItem: z.object({
    registryId: BaseSchemas.cuid,
    productId: BaseSchemas.shopifyGlobalId,
    variantId: BaseSchemas.shopifyGlobalId.optional(),
    productHandle: BaseSchemas.slug,
    productTitle: z.string()
      .min(1, "Product title is required")
      .max(255, "Product title must not exceed 255 characters")
      .transform(sanitizeText),
    variantTitle: z.string()
      .max(255, "Variant title must not exceed 255 characters")
      .transform(sanitizeText)
      .optional(),
    productImage: BaseSchemas.url.optional(),
    quantity: BaseSchemas.quantity.default(1),
    priority: z.enum(["high", "medium", "low"]).default("medium"),
    notes: z.string()
      .max(1000, "Notes must not exceed 1000 characters")
      .transform(sanitizeText)
      .optional(),
    price: BaseSchemas.price,
    compareAtPrice: BaseSchemas.price.optional(),
    currencyCode: BaseSchemas.currencyCode.default("USD")
  }),
  
  purchase: z.object({
    registryId: BaseSchemas.cuid,
    itemId: BaseSchemas.cuid,
    quantity: BaseSchemas.quantity,
    purchaserEmail: BaseSchemas.email.optional(),
    purchaserName: z.string()
      .min(1, "Purchaser name is required")
      .max(255, "Purchaser name must not exceed 255 characters")
      .transform(sanitizeText)
      .optional(),
    orderId: BaseSchemas.shopifyGlobalId.optional(),
    orderName: z.string()
      .max(255, "Order name must not exceed 255 characters")
      .optional(),
    giftMessage: z.string()
      .max(500, "Gift message must not exceed 500 characters")
      .transform(sanitizeGiftMessage)
      .optional()
  })
};

/**
 * Query parameter schemas
 */
export const QuerySchemas = {
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
    sortBy: z.string().max(50).optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc")
  }),
  
  registryFilters: z.object({
    status: z.enum(["active", "inactive", "draft", "archived"]).optional(),
    eventType: z.enum([
      "wedding",
      "birthday",
      "baby",
      "graduation",
      "anniversary",
      "holiday",
      "housewarming",
      "general"
    ]).optional(),
    visibility: z.enum(["public", "private", "friends", "password"]).optional(),
    customerId: z.string().optional(),
    search: z.string()
      .max(100, "Search query must not exceed 100 characters")
      .transform(sanitizeSearchQuery)
      .optional()
  }),
  
  dateRange: z.object({
    startDate: BaseSchemas.isoDate.optional(),
    endDate: BaseSchemas.isoDate.optional()
  }).refine(data => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  }, "End date must be after start date")
};

/**
 * Performance and analytics schemas
 */
export const AnalyticsSchemas = {
  webVitals: z.object({
    metrics: z.array(z.object({
      cls: z.number().min(0).max(10).optional(),
      fcp: z.number().min(0).max(60000).optional(),
      fid: z.number().min(0).max(10000).optional(),
      lcp: z.number().min(0).max(60000).optional(),
      ttfb: z.number().min(0).max(60000).optional(),
      inp: z.number().min(0).max(10000).optional(),
      url: BaseSchemas.url,
      userAgent: z.string().max(1000),
      viewport: z.object({
        width: z.number().int().min(1).max(10000),
        height: z.number().int().min(1).max(10000)
      }),
      connection: z.string().max(20).optional(),
      timestamp: z.number().int().min(0).optional(),
      customMeasure: z.object({
        name: z.string().max(50),
        duration: z.number().min(0)
      }).optional(),
      alert: z.boolean().optional()
    }))
  }),
  
  error: z.object({
    message: z.string().min(1).max(1000),
    stack: z.string().max(5000).optional(),
    level: z.enum(["error", "warning", "info"]).default("error"),
    timestamp: z.number().int().positive(),
    url: BaseSchemas.url.optional(),
    userAgent: z.string().max(500).optional()
  })
};

/**
 * Webhook validation schemas
 */
export const WebhookSchemas = {
  base: z.object({
    topic: z.string()
      .min(1, "Topic is required")
      .max(100, "Topic must not exceed 100 characters")
      .regex(/^[a-z_/]+$/, "Invalid webhook topic format"),
    shop: BaseSchemas.shopifyDomain,
    payload: z.any(),
    hmac: z.string()
      .min(1, "HMAC signature is required")
      .max(500, "HMAC signature is too long")
  }),
  
  orderCreate: z.object({
    id: BaseSchemas.shopifyOrderId,
    name: z.string().optional(),
    email: BaseSchemas.email.optional(),
    currency: BaseSchemas.currencyCode.default("USD"),
    line_items: z.array(z.object({
      id: BaseSchemas.shopifyOrderId,
      product_id: BaseSchemas.shopifyOrderId,
      variant_id: BaseSchemas.shopifyOrderId.optional(),
      quantity: z.number().int().min(1),
      price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
      title: z.string().max(255),
      properties: z.array(z.object({
        name: z.string(),
        value: z.string()
      })).optional()
    })).default([]),
    customer: z.object({
      id: BaseSchemas.shopifyOrderId,
      email: BaseSchemas.email.optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional()
    }).optional()
  }),
  
  productUpdate: z.object({
    id: BaseSchemas.shopifyOrderId,
    title: z.string().max(255),
    handle: z.string().max(255),
    status: z.enum(["active", "archived", "draft"]),
    variants: z.array(z.object({
      id: BaseSchemas.shopifyOrderId,
      title: z.string().max(255),
      price: z.string().regex(/^\d+(\.\d{1,2})?$/),
      inventory_quantity: z.number().int().min(0).optional()
    })).optional()
  })
};

/**
 * Shop configuration schemas
 */
export const ShopSchemas = {
  config: z.object({
    enablePasswordProtection: z.boolean().default(false),
    enableGiftMessages: z.boolean().default(true),
    enableSocialSharing: z.boolean().default(true),
    enableEmailNotifications: z.boolean().default(true),
    primaryColor: BaseSchemas.hexColor.default("#007ace"),
    accentColor: BaseSchemas.hexColor.default("#f3f3f3"),
    defaultRegistryVisibility: z.enum(["public", "private", "friends", "password"]).default("public"),
    maxItemsPerRegistry: z.number()
      .int("Max items must be an integer")
      .min(1, "Max items must be at least 1")
      .max(1000, "Max items must not exceed 1000")
      .default(100),
    enableInventoryTracking: z.boolean().default(true),
    dataRetentionPeriod: z.number()
      .int()
      .min(30, "Retention period must be at least 30 days")
      .max(2555, "Retention period must not exceed 7 years")
      .default(2555) // 7 years default
  })
};

// Sanitization functions are now imported from sanitization-unified.server.ts
// This eliminates duplicate sanitization logic across the codebase

/**
 * Sanitization utilities - now using unified sanitization system
 */
export class Sanitizer {
  static sanitizeHtml = sanitizeText;
  static sanitizeGiftMessage = sanitizeGiftMessage;
  static sanitizeSearchQuery = sanitizeSearchQuery;
  static createSlug = createSlug;
  static sanitizeCustomerData = sanitizeCustomerData;
}

/**
 * Validation middleware for actions
 */
export function validateAction<T>(
  schema: z.ZodSchema<T>
) {
  return function (handler: (args: ActionFunctionArgs & { validatedData: T }) => Promise<Response>) {
    return async function (args: ActionFunctionArgs): Promise<Response> {
      try {
        let data: any;
        
        const contentType = args.request.headers.get("content-type") || "";
        
        if (contentType.includes("application/json")) {
          data = await args.request.json();
        } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
          const formData = await args.request.formData();
          data = Object.fromEntries(formData.entries());
        } else {
          return json({ error: "Unsupported content type" }, { status: 415 });
        }
        
        const result = schema.safeParse(data);
        
        if (!result.success) {
          log.warn("Action validation failed", {
            url: args.request.url,
            method: args.request.method,
            errors: result.error.errors
          });
          
          return validationErrorResponse(result.error.errors.map(err => ({
            message: err.message,
            path: err.path.map(p => p.toString())
          })));
        }
        
        return await handler({
          ...args,
          validatedData: result.data
        });
        
      } catch (error) {
        log.error("Action validation error", error);
        return json({ error: "Internal server error" }, { status: 500 });
      }
    };
  };
}

/**
 * Validation middleware for loaders
 */
export function validateLoader<T>(
  schema: z.ZodSchema<T>
) {
  return function (handler: (args: LoaderFunctionArgs & { validatedData: T }) => Promise<Response>) {
    return async function (args: LoaderFunctionArgs): Promise<Response> {
      try {
        const url = new URL(args.request.url);
        const params = Object.fromEntries(url.searchParams.entries());
        
        const result = schema.safeParse(params);
        
        if (!result.success) {
          log.warn("Loader validation failed", {
            url: args.request.url,
            errors: result.error.errors
          });
          
          return validationErrorResponse(result.error.errors.map(err => ({
            message: err.message,
            path: err.path.map(p => p.toString())
          })));
        }
        
        return await handler({
          ...args,
          validatedData: result.data
        });
        
      } catch (error) {
        log.error("Loader validation error", error);
        return json({ error: "Internal server error" }, { status: 500 });
      }
    };
  };
}

/**
 * Validation wrapper for API routes
 */
export function withValidation<T extends z.ZodSchema>(schema: T) {
  return async (request: Request): Promise<{
    data?: z.infer<T>;
    errors?: { message: string; path?: string[] }[];
  }> => {
    try {
      const contentType = request.headers.get('content-type') || '';
      
      let rawData: any;
      
      if (contentType.includes('application/json')) {
        rawData = await request.json();
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        rawData = Object.fromEntries(formData);
      } else {
        return { errors: [{ message: 'Unsupported content type' }] };
      }
      
      const result = schema.safeParse(rawData);
      
      if (result.success) {
        return { data: result.data };
      } else {
        return {
          errors: result.error.errors.map(err => ({
            message: err.message,
            path: err.path.map(p => p.toString())
          }))
        };
      }
    } catch (error) {
      return {
        errors: [{ message: 'Invalid request format' }]
      };
    }
  };
}

/**
 * Validate query parameters
 */
export function validateQueryParams<T extends z.ZodSchema>(
  request: Request,
  schema: T
): { data?: z.infer<T>; errors?: { message: string; path?: string[] }[] } {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    
    const result = schema.safeParse(params);
    
    if (result.success) {
      return { data: result.data };
    } else {
      return {
        errors: result.error.errors.map(err => ({
          message: err.message,
          path: err.path.map(p => p.toString())
        }))
      };
    }
  } catch (error) {
    return {
      errors: [{ message: 'Invalid query parameters' }]
    };
  }
}

/**
 * Validation error response helper
 */
export function validationErrorResponse(errors: { message: string; path?: string[] }[]) {
  return json(
    {
      error: 'Validation failed',
      details: errors
    },
    { status: 400 }
  );
}

/**
 * Security validation helpers
 */
export function validateCSRFToken(token: string, expected: string): boolean {
  if (!token || !expected) return false;
  
  try {
    // Use timing-safe comparison
    const tokenBuffer = Buffer.from(token, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    
    if (tokenBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
  } catch (error) {
    return false;
  }
}

export function validateOrigin(origin: string, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  
  try {
    const url = new URL(origin);
    
    // Check against allowed origins
    return allowedOrigins.some(allowed => {
      if (allowed === "*") return true;
      
      try {
        const allowedUrl = new URL(allowed);
        return url.origin === allowedUrl.origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function validateIPAddress(ip: string): boolean {
  // IPv4 regex
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // IPv6 regex (simplified)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * File upload validation
 */
export function validateFileUpload(file: File): {
  valid: boolean;
  reason?: string;
  sanitized?: {
    name: string;
    type: string;
    size: number;
  };
} {
  // Check file size
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, reason: "File too large (max 10MB)" };
  }
  
  // Check file type
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'text/csv'
  ];
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, reason: "File type not allowed" };
  }
  
  // Sanitize filename
  const sanitizedName = file.name
    .replace(/[^\w.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100);
  
  return {
    valid: true,
    sanitized: {
      name: sanitizedName,
      type: file.type,
      size: file.size
    }
  };
}

/**
 * Export all schemas and utilities for easy access
 */
export const schemas = {
  base: BaseSchemas,
  registry: RegistrySchemas,
  query: QuerySchemas,
  analytics: AnalyticsSchemas,
  webhook: WebhookSchemas,
  shop: ShopSchemas
};

/**
 * Export legacy aliases for migration compatibility
 */
export const validators = BaseSchemas;
export const CommonSchemas = BaseSchemas;
export const validateRequest = withValidation;

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
  public errors: string[];
  
  constructor(errors: string[]) {
    super(`Validation failed: ${errors.join(", ")}`);
    this.name = "ValidationError";
    this.errors = errors;
  }
}