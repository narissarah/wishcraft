import { z } from "zod";
import { REGISTRY_VISIBILITY, REGISTRY_EVENT_TYPES } from "~/lib/constants";

export function sanitizeString(input: string): string {
  // Comprehensive XSS prevention: encode HTML entities
  return input
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;');
}

export function createSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function sanitizeHtml(input: string): string {
  // Remove all HTML tags and encode entities to prevent XSS
  return input
    .replace(/<[^>]*>/g, '')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function toNumber(input: unknown): number {
  const num = Number(input);
  return isNaN(num) ? 0 : num;
}

export const shopifyIdSchema = z.string().min(1);

export const RegistrySchemas = {
  search: z.object({
    q: z.string().optional(),
    eventType: z.string().optional(),
    sortBy: z.enum(["createdAt", "eventDate", "title"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
};

export const QuerySchemas = {
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    cursor: z.string().optional(),
  }),
  
  search: z.object({
    q: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  })
};

// Input validation schemas
export const InputSchemas = {
  email: z.string().email().max(255),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  date: z.string().datetime().or(z.date()),
  url: z.string().url().max(2048),
  
  registry: z.object({
    title: z.string().min(3).max(100),
    description: z.string().max(1000).optional(),
    eventType: z.enum(Object.values(REGISTRY_EVENT_TYPES) as [string, ...string[]]),
    eventDate: z.string().datetime().optional(),
    visibility: z.enum(Object.values(REGISTRY_VISIBILITY) as [string, ...string[]]),
    accessCode: z.string().min(4).max(20).optional(),
    customerEmail: z.string().email().optional(),
    customerFirstName: z.string().max(50).optional(),
    customerLastName: z.string().max(50).optional(),
    customerPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  })
};