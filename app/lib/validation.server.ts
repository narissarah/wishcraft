import { z } from "zod";

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

export function sanitizeHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
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