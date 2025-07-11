import { json } from "@remix-run/node";
import { z } from "zod";
import { sanitizeUserContent, sanitizeRichText } from "~/lib/utils";

// ============================================================================
// REQUEST VALIDATION AND BODY SIZE LIMITS
// ============================================================================

// Size limits
export const REQUEST_SIZE_LIMITS = {
  JSON: 1 * 1024 * 1024,        // 1MB for JSON payloads
  FORM: 2 * 1024 * 1024,        // 2MB for form data
  FILE: 10 * 1024 * 1024,       // 10MB for file uploads
  TOTAL: 10 * 1024 * 1024,      // 10MB total request size
};

// Field length limits
export const FIELD_LIMITS = {
  SHORT_TEXT: 255,
  MEDIUM_TEXT: 1000,
  LONG_TEXT: 5000,
  RICH_TEXT: 10000,
  URL: 2048,
  EMAIL: 320,
  PHONE: 50,
  NAME: 100,
  SLUG: 100,
};

/**
 * Check request body size
 */
export async function checkRequestSize(
  request: Request,
  maxSize: number = REQUEST_SIZE_LIMITS.TOTAL
): Promise<{ valid: boolean; size?: number; error?: string }> {
  const contentLength = request.headers.get("content-length");
  
  if (!contentLength) {
    return { valid: false, error: "No content-length header" };
  }
  
  const size = parseInt(contentLength, 10);
  
  if (isNaN(size)) {
    return { valid: false, error: "Invalid content-length" };
  }
  
  if (size > maxSize) {
    return {
      valid: false,
      size,
      error: `Request body too large. Maximum size: ${maxSize} bytes, received: ${size} bytes`,
    };
  }
  
  return { valid: true, size };
}

/**
 * Request validation middleware
 */
export async function validateRequestMiddleware(
  request: Request,
  options: {
    maxSize?: number;
    allowedContentTypes?: string[];
  } = {}
) {
  const {
    maxSize = REQUEST_SIZE_LIMITS.TOTAL,
    allowedContentTypes = ["application/json", "application/x-www-form-urlencoded", "multipart/form-data"],
  } = options;
  
  // Check request size
  const sizeCheck = await checkRequestSize(request, maxSize);
  if (!sizeCheck.valid) {
    return json(
      { error: "Request too large", message: sizeCheck.error },
      { status: 413 }
    );
  }
  
  // Check content type
  const contentType = request.headers.get("content-type");
  if (contentType && !allowedContentTypes.some(type => contentType.includes(type))) {
    return json(
      { error: "Invalid content type", message: `Content type ${contentType} not allowed` },
      { status: 415 }
    );
  }
  
  return null;
}

/**
 * Zod schemas for common validations
 */
export const ValidationSchemas = {
  // User input schemas
  email: z.string().email().max(FIELD_LIMITS.EMAIL),
  phone: z.string().regex(/^\+?[\d\s-()]+$/).max(FIELD_LIMITS.PHONE).optional(),
  url: z.string().url().max(FIELD_LIMITS.URL),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(FIELD_LIMITS.SLUG),
  
  // Text schemas with sanitization
  shortText: z.string().max(FIELD_LIMITS.SHORT_TEXT).transform(sanitizeUserContent),
  mediumText: z.string().max(FIELD_LIMITS.MEDIUM_TEXT).transform(sanitizeUserContent),
  longText: z.string().max(FIELD_LIMITS.LONG_TEXT).transform(sanitizeUserContent),
  richText: z.string().max(FIELD_LIMITS.RICH_TEXT).transform(sanitizeRichText),
  
  // Common fields
  name: z.string().min(1).max(FIELD_LIMITS.NAME).transform(sanitizeUserContent),
  title: z.string().min(3).max(FIELD_LIMITS.SHORT_TEXT).transform(sanitizeUserContent),
  description: z.string().max(FIELD_LIMITS.LONG_TEXT).transform(sanitizeRichText).optional(),
  
  // IDs and references
  shopifyId: z.string().regex(/^gid:\/\/shopify\/\w+\/\d+$/),
  uuid: z.string().uuid(),
  cuid: z.string().regex(/^c[a-z0-9]{24}$/),
  
  // Dates
  futureDate: z.string().datetime().refine(date => new Date(date) > new Date(), {
    message: "Date must be in the future",
  }),
  pastDate: z.string().datetime().refine(date => new Date(date) < new Date(), {
    message: "Date must be in the past",
  }),
  
  // Numbers
  positiveInt: z.number().int().positive(),
  percentage: z.number().min(0).max(100),
  price: z.number().positive().multipleOf(0.01),
  quantity: z.number().int().min(0),
  
  // Enums
  eventType: z.enum([
    "wedding",
    "birthday",
    "baby",
    "graduation",
    "anniversary",
    "holiday",
    "housewarming",
    "general",
  ]),
  visibility: z.enum(["public", "private", "friends", "password"]),
  priority: z.enum(["high", "medium", "low"]),
  status: z.enum(["active", "paused", "completed", "archived"]),
};

/**
 * Registry-specific validation schemas
 */
export const RegistryValidationSchemas = {
  createRegistry: z.object({
    title: ValidationSchemas.title,
    description: ValidationSchemas.description,
    eventType: ValidationSchemas.eventType,
    eventDate: ValidationSchemas.futureDate.optional(),
    eventLocation: ValidationSchemas.mediumText.optional(),
    visibility: ValidationSchemas.visibility.default("public"),
    allowAnonymousGifts: z.boolean().default(true),
    requiresApproval: z.boolean().default(false),
    accessCode: z.string().min(6).max(20).optional(),
  }),
  
  updateRegistry: z.object({
    title: ValidationSchemas.title.optional(),
    description: ValidationSchemas.description,
    eventDate: ValidationSchemas.futureDate.optional(),
    eventLocation: ValidationSchemas.mediumText.optional(),
    visibility: ValidationSchemas.visibility.optional(),
    allowAnonymousGifts: z.boolean().optional(),
    requiresApproval: z.boolean().optional(),
    accessCode: z.string().min(6).max(20).optional(),
    status: ValidationSchemas.status.optional(),
  }),
  
  addRegistryItem: z.object({
    productId: ValidationSchemas.shopifyId,
    variantId: ValidationSchemas.shopifyId.optional(),
    quantity: ValidationSchemas.quantity.default(1),
    priority: ValidationSchemas.priority.default("medium"),
    notes: ValidationSchemas.mediumText.optional(),
    personalNote: ValidationSchemas.mediumText.optional(),
    allowGroupGifting: z.boolean().default(true),
    allowPartialGifting: z.boolean().default(true),
    minGiftAmount: ValidationSchemas.price.optional(),
  }),
  
  registryAddress: z.object({
    type: z.enum(["shipping", "billing", "event"]).default("shipping"),
    isDefault: z.boolean().default(false),
    label: ValidationSchemas.shortText.optional(),
    firstName: ValidationSchemas.name,
    lastName: ValidationSchemas.name,
    company: ValidationSchemas.name.optional(),
    address1: ValidationSchemas.mediumText,
    address2: ValidationSchemas.mediumText.optional(),
    city: ValidationSchemas.name,
    province: ValidationSchemas.name.optional(),
    country: z.string().length(2), // ISO country code
    zip: z.string().max(20),
    phone: ValidationSchemas.phone.optional(),
  }),
  
  giftMessage: z.object({
    message: ValidationSchemas.richText,
    isAnonymous: z.boolean().default(false),
    senderName: ValidationSchemas.name.optional(),
    senderEmail: ValidationSchemas.email.optional(),
  }),
};

/**
 * Validate request data with schema
 */
export async function validateRequestData<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data?: T; errors?: z.ZodError }> {
  try {
    let data: any;
    
    const contentType = request.headers.get("content-type");
    
    if (contentType?.includes("application/json")) {
      data = await request.json();
    } else if (contentType?.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      data = Object.fromEntries(formData);
    } else if (contentType?.includes("multipart/form-data")) {
      const formData = await request.formData();
      data = Object.fromEntries(formData);
    } else {
      throw new Error("Unsupported content type");
    }
    
    const validated = schema.parse(data);
    return { data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { errors: error };
    }
    throw error;
  }
}

/**
 * Apply validation to a loader/action
 */
export function withValidation<T extends (...args: any[]) => any>(
  handler: T,
  options: {
    schema?: z.ZodSchema<any>;
    maxSize?: number;
    allowedContentTypes?: string[];
  } = {}
): T {
  return (async (...args: Parameters<T>) => {
    const request = args[0]?.request as Request;
    if (!request) {
      return handler(...args);
    }
    
    // Validate request size and content type
    const validationResponse = await validateRequestMiddleware(request, {
      maxSize: options.maxSize,
      allowedContentTypes: options.allowedContentTypes,
    });
    
    if (validationResponse) {
      throw validationResponse;
    }
    
    // Validate request data with schema if provided
    if (options.schema && ["POST", "PUT", "PATCH"].includes(request.method)) {
      const { data, errors } = await validateRequestData(request, options.schema);
      
      if (errors) {
        throw json(
          {
            error: "Validation failed",
            errors: errors.errors.map(err => ({
              field: err.path.join("."),
              message: err.message,
            })),
          },
          { status: 400 }
        );
      }
      
      // Pass validated data to handler
      args[0] = { ...args[0], validatedData: data };
    }
    
    return handler(...args);
  }) as T;
}

/**
 * Sanitize and validate file uploads
 */
export function validateFileUpload(
  file: File,
  options: {
    maxSize?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): { valid: boolean; error?: string } {
  const {
    maxSize = REQUEST_SIZE_LIMITS.FILE,
    allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"],
    allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  } = options;
  
  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB`,
    };
  }
  
  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
    };
  }
  
  // Check file extension
  const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file extension. Allowed extensions: ${allowedExtensions.join(", ")}`,
    };
  }
  
  return { valid: true };
}

/**
 * Rate limit validation
 */
export function createRateLimitValidator(
  limits: Record<string, { max: number; window: number }>
) {
  const attempts = new Map<string, number[]>();
  
  return function validateRateLimit(
    key: string,
    action: string
  ): { allowed: boolean; remaining: number; resetAt: Date } {
    const limit = limits[action] || { max: 100, window: 60000 };
    const now = Date.now();
    const windowStart = now - limit.window;
    
    // Get attempts for this key
    const keyAttempts = attempts.get(key) || [];
    const validAttempts = keyAttempts.filter(time => time > windowStart);
    
    if (validAttempts.length >= limit.max) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Math.min(...validAttempts) + limit.window),
      };
    }
    
    // Add current attempt
    validAttempts.push(now);
    attempts.set(key, validAttempts);
    
    return {
      allowed: true,
      remaining: limit.max - validAttempts.length,
      resetAt: new Date(now + limit.window),
    };
  };
}

// Export Zod for use in other files
export { z } from "zod";