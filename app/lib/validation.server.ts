/**
 * Essential Validation for WishCraft
 * Simplified from 713-line validation-unified.server.ts
 */

import { z } from "zod";

// Basic Shopify ID validation
export const shopifyIdSchema = z.string().min(1);

// Registry validation schemas
export const registryCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  eventType: z.enum(['wedding', 'birthday', 'baby_shower', 'anniversary', 'graduation', 'housewarming', 'holiday', 'other']),
  eventDate: z.string().datetime().optional(),
  privacy: z.enum(['public', 'private', 'shared']).default('private')
});

export const registryUpdateSchema = registryCreateSchema.partial();

// Registry item validation
export const registryItemSchema = z.object({
  productId: shopifyIdSchema,
  variantId: shopifyIdSchema.optional(),
  quantity: z.number().int().min(1).max(100),
  priority: z.enum(['high', 'medium', 'low']).default('medium')
});

// Purchase validation
export const purchaseSchema = z.object({
  registryItemId: shopifyIdSchema,
  quantity: z.number().int().min(1),
  giftMessage: z.string().max(500).optional(),
  purchaserEmail: z.string().email(),
  purchaserName: z.string().min(1).max(255)
});

// Collaborator validation
export const collaboratorSchema = z.object({
  email: z.string().email(),
  role: z.enum(['viewer', 'editor']).default('viewer')
});

// Basic sanitization
export function sanitizeString(input: string): string {
  return input.trim().slice(0, 1000);
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// Validation helper
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.issues.map(i => i.message).join(', ')}`);
  }
  return result.data;
}

// Simple slug creation
export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}