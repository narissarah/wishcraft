/**
 * Simple Validation
 * Replacement for removed complex validation
 */

import { z } from "zod";

export const RegistrySchemas = {
  create: z.object({
    title: z.string(),
    description: z.string().optional(),
    eventType: z.string(),
    eventDate: z.string().optional(),
    visibility: z.string(),
    accessCode: z.string().optional(),
    customerId: z.string(),
    customerEmail: z.string().optional(),
    customerFirstName: z.string().optional(),
    customerLastName: z.string().optional()
  })
};

export const QuerySchemas = {
  registryFilters: z.object({
    status: z.string().optional(),
    eventType: z.string().optional(),
    visibility: z.string().optional(),
    customerId: z.string().optional(),
    search: z.string().optional()
  }),
  pagination: z.object({
    page: z.number().optional(),
    limit: z.number().optional()
  })
};

export function withValidation(schema: z.ZodSchema) {
  return async (request: Request) => {
    try {
      const formData = await request.formData();
      const data = Object.fromEntries(formData);
      const result = schema.safeParse(data);
      if (!result.success) {
        return { data: null, errors: result.error.issues };
      }
      return { data: result.data, errors: null };
    } catch (error) {
      return { data: null, errors: [{ message: "Invalid request" }] };
    }
  };
}

export function validateQueryParams(request: Request, schema: z.ZodSchema) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  const result = schema.safeParse(params);
  if (!result.success) {
    return { data: null, errors: result.error.issues };
  }
  return { data: result.data, errors: null };
}

export function validationErrorResponse(errors: any[]) {
  return Response.json({ errors }, { status: 400 });
}

export const Sanitizer = {
  sanitizeHtml: (str: string) => str.replace(/<[^>]*>/g, ''),
  createSlug: (str: string) => str.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
  sanitizeCustomerData: (data: any) => data
};