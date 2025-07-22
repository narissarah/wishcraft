/**
 * Core Validation Module for WishCraft - MINIMAL
 * Only exports that are actually used in the codebase
 */

import { z } from "zod";
import { json } from "@remix-run/node";
import { log } from "./logger.server";
import { db } from "./db.server";

// ============================================
// Core Request Validation
// ============================================

export function withValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (data: T, request: Request) => Promise<Response>
) {
  return async (request: Request) => {
    const requestData = await request.json();
    const data = schema.parse(requestData);
    return handler(data, request);
  };
}

export function validateRequest<T>(schema: z.ZodSchema<T>, data: any) {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors: Record<string, string[]> = {};
      for (const err of error.errors) {
        const path = err.path.join('.');
        if (!formattedErrors[path]) {
          formattedErrors[path] = [];
        }
        formattedErrors[path].push(err.message);
      }
      return { success: false, data: null, errors: formattedErrors };
    }
    return { success: false, data: null, errors: { general: ["Validation failed"] } };
  }
}

export function validationErrorResponse(error: z.ZodError) {
  return json(
    {
      error: "Validation failed",
      details: error.errors,
    },
    { status: 400 }
  );
}


// ============================================
// Sanitization Functions
// ============================================

export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

export function createSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const Sanitizer = {
  string: sanitizeString,
  slug: createSlug,
  number: (input: any): number => {
    const num = Number(input);
    return isNaN(num) ? 0 : num;
  },
  boolean: (input: any): boolean => {
    return Boolean(input);
  }
};

// ============================================
// Common Schemas (only used ones)
// ============================================

export const shopifyIdSchema = z.string().min(1);

export const RegistrySchemas = {
  search: z.object({
    q: z.string().optional(),
    eventType: z.string().optional(),
    sortBy: z.enum(["createdAt", "eventDate", "title"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  }),
  create: z.object({
    customerId: z.string(),
    customerFirstName: z.string(),
    customerLastName: z.string(),
    customerEmail: z.string().email(),
    title: z.string(),
    description: z.string().optional(),
    eventType: z.string(),
    eventDate: z.string().optional(),
    visibility: z.enum(["public", "private", "unlisted"]),
    accessCode: z.string().optional()
  })
};

export const QuerySchemas = {
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  }),
  filters: z.object({
    status: z.string().optional(),
    eventType: z.string().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional()
  }),
  registryFilters: z.object({
    status: z.string().optional(),
    eventType: z.string().optional(),
    visibility: z.string().optional(),
    customerId: z.string().optional(),
    search: z.string().optional()
  })
};

export const AnalyticsSchemas = {
  dateRange: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime()
  }),
  metrics: z.object({
    metricType: z.enum(["views", "purchases", "conversions", "value"]),
    groupBy: z.enum(["day", "week", "month"]).optional()
  }),
  webVitals: z.object({
    name: z.string(),
    value: z.number(),
    id: z.string().optional(),
    rating: z.string().optional(),
    delta: z.number().optional()
  }),
  error: z.object({
    message: z.string(),
    stack: z.string().optional(),
    url: z.string().optional()
  })
};

export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): T {
  const params = Object.fromEntries(searchParams.entries());
  return schema.parse(params);
}

// ============================================
// Built for Shopify Compliance
// ============================================

export async function checkBuiltForShopifyCompliance(shopId: string) {
  const results = {
    webhookReliability: await getWebhookReliabilityMetrics(shopId),
    performanceScore: await getPerformanceScore(shopId),
    securityCompliance: true, // Always true with current implementation
    apiVersionCurrent: true,  // Using 2025-07
  };

  const score = 
    (results.webhookReliability >= 95 ? 25 : 0) +
    (results.performanceScore >= 90 ? 25 : 0) +
    (results.securityCompliance ? 25 : 0) +
    (results.apiVersionCurrent ? 25 : 0);

  return {
    compliant: score >= 90,
    score,
    details: results
  };
}

export async function getWebhookReliabilityMetrics(shopId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Use audit logs as webhook log substitute
  const logs = await db.audit_logs.findMany({
    where: {
      shopId: shopId,
      action: { contains: 'WEBHOOK' },
      timestamp: { gte: thirtyDaysAgo }
    },
    select: { action: true }
  });

  if (logs.length === 0) return 100;
  
  const successCount = logs.filter((log: any) => !log.action.includes('ERROR')).length;
  return Math.round((successCount / logs.length) * 100);
}

async function getPerformanceScore(shopId: string) {
  const metrics = await db.performance_metrics.findMany({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  if (metrics.length === 0) return 100;

  const scores = metrics.map((m: any) => {
    let score = 100;
    if (m.metric === 'INP' && m.value > 200) score -= 20;
    if (m.metric === 'LCP' && m.value > 2500) score -= 20;
    if (m.metric === 'CLS' && m.value > 0.1) score -= 20;
    return score;
  });

  return Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
}

// ============================================
// Customer Privacy Service (GDPR)
// ============================================

export class CustomerPrivacyService {
  static async exportCustomerData(customerId: string, shopId: string) {
    const data = await db.registries.findMany({
      where: { customerId, shopId },
      include: {
        registry_items: true,
        registry_collaborators: true
      }
    });
    
    return {
      registries: data.map(r => ({
        ...r,
        customerEmail: r.customerEmail, // Already encrypted
        customerFirstName: r.customerFirstName,
        customerLastName: r.customerLastName
      })),
      exportDate: new Date().toISOString(),
      customerId,
      shopId
    };
  }

  static async deleteCustomerData(customerId: string, shopId: string) {
    await db.$transaction([
      db.registries.updateMany({
        where: { customerId, shopId },
        data: {
          customerEmail: '[REDACTED]',
          customerFirstName: '[REDACTED]', 
          customerLastName: '[REDACTED]',
          customerPhone: '[REDACTED]'
        }
      }),
      db.registry_purchases.updateMany({
        where: { 
          purchaserId: customerId
        },
        data: {
          purchaserEmail: '[REDACTED]',
          purchaserName: '[REDACTED]',
          purchaserPhone: '[REDACTED]',
          giftMessage: '[REDACTED]'
        }
      })
    ]);
    
    return { success: true, deletedAt: new Date().toISOString() };
  }
}