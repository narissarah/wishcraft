import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { rateLimiter } from "~/lib/security.server";
import { QuerySchemas, validateQueryParams, Sanitizer } from "~/lib/validation.server";
import { z } from "zod";
import { apiResponse } from "~/lib/api-response.server";
import { RegistryCache } from "~/lib/cache.server";
import crypto from "crypto";

// Registry creation validation schema
const CreateRegistrySchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).optional(),
  eventType: z.enum(['wedding', 'birthday', 'baby_shower', 'graduation', 'general']).default('general'),
  eventDate: z.string().datetime().optional(),
  eventLocation: z.string().max(500).optional(),
  visibility: z.enum(['public', 'private']).default('public'),
  customerEmail: z.string().email(),
  customerFirstName: z.string().min(1).max(100).trim(),
  customerLastName: z.string().min(1).max(100).trim(),
  customerPhone: z.string().max(20).optional(),
  customerId: z.string().optional(),
  accessCode: z.string().max(50).optional()
});

/**
 * GET /api/registries - List all registries for a shop
 * Implements Redis caching for performance
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.check(request);
    if (rateLimitResult && !rateLimitResult.allowed) {
      return apiResponse.rateLimitExceeded(60);
    }
    
    // Validate query parameters
    const url = new URL(request.url);
    const queryData = validateQueryParams(
      url.searchParams,
      QuerySchemas.registryFilters.merge(QuerySchemas.pagination)
    );
    
    
    // Authenticate
    const { admin, session } = await authenticate.admin(request);
    const shop = session.shop;
    
    // Try to get from cache first
    const cacheKey = { ...queryData };
    const cachedData = await RegistryCache.getList(shop, cacheKey);
    if (cachedData) {
      log.debug('Registry list cache hit', { shop });
      return apiResponse.success(cachedData);
    }
    
    // Build where clause with validated filters
    const whereClause: any = { shopId: shop };
    if (queryData?.status) whereClause.status = queryData.status;
    if (queryData?.eventType) whereClause.eventType = queryData.eventType;
    if (queryData?.visibility) whereClause.visibility = queryData.visibility;
    if (queryData?.customerId) whereClause.customerId = queryData.customerId;
    if (queryData?.search) {
      whereClause.title = {
        contains: queryData.search || '',
        mode: 'insensitive'
      };
    }
    
    // Optimized query for <500ms performance requirement
    const [registries, totalCount] = await Promise.all([
      db.registries.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          customerId: true,
          eventDate: true,
          status: true,
          visibility: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { registry_items: true }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: ((queryData?.page || 1) - 1) * (queryData?.limit || 20),
        take: queryData?.limit || 20,
      }),
      db.registries.count({ where: whereClause })
    ]);
    
    // Transform data with optimized performance
    const response = {
      registries: registries.map(registry => ({
        id: registry.id,
        name: registry.title,
        customerId: registry.customerId,
        eventDate: registry.eventDate,
        status: registry.status,
        privacy: registry.visibility,
        itemCount: registry._count.registry_items,
        purchaseCount: 0,
        createdAt: registry.createdAt,
        updatedAt: registry.updatedAt,
      })),
      total: totalCount,
    };
    
    // Cache the response
    await RegistryCache.setList(shop, cacheKey, response);
    log.debug('Registry list cached', { shop });
    
    return apiResponse.success(response.registries, {
      pagination: {
        page: queryData?.page || 1,
        pageSize: queryData?.limit || 20,
        total: totalCount,
        totalPages: Math.ceil(totalCount / (queryData?.limit || 20))
      }
    });
  } catch (error) {
    log.error("Failed to fetch registries", error);
    
    return apiResponse.serverError(error);
  }
}

/**
 * POST /api/registries - Create a new registry
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return apiResponse.error(
      "METHOD_NOT_ALLOWED",
      "Method not allowed",
      405
    );
  }
  
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.check(request);
    if (rateLimitResult && !rateLimitResult.allowed) {
      return apiResponse.rateLimitExceeded(60);
    }
    
    // Get request data and validate with comprehensive schema
    const requestData = await request.json();
    
    // Validate input with Zod schema
    const validationResult = CreateRegistrySchema.safeParse(requestData);
    if (!validationResult.success) {
      return apiResponse.validationError(
        Object.fromEntries(
          validationResult.error.errors.map(err => [
            err.path.join('.'), 
            [err.message]
          ])
        )
      );
    }
    
    const validatedData = validationResult.data;
    
    // Authenticate
    const { admin, session } = await authenticate.admin(request);
    const shop = session.shop;
    
    // Sanitize customer data
    const sanitizedCustomer = {
      firstName: Sanitizer.string(validatedData.customerFirstName || ''),
      lastName: Sanitizer.string(validatedData.customerLastName || ''),
      email: validatedData.customerEmail
    };
    
    // Create registry with validated and sanitized data
    const registry = await db.registries.create({
      data: {
        id: crypto.randomUUID(),
        shopId: shop,
        customerId: validatedData.customerId || crypto.randomUUID(),
        customerEmail: sanitizedCustomer.email,
        customerFirstName: sanitizedCustomer.firstName,
        customerLastName: sanitizedCustomer.lastName,
        title: Sanitizer.string(validatedData.title),
        description: validatedData.description ? Sanitizer.string(validatedData.description) : null,
        slug: Sanitizer.slug(validatedData.title),
        eventType: validatedData.eventType,
        eventDate: validatedData.eventDate ? new Date(validatedData.eventDate) : null,
        status: "active",
        visibility: validatedData.visibility,
        accessCode: validatedData.accessCode || null,
        updatedAt: new Date(),
      },
    });
    
    // Invalidate list cache
    await RegistryCache.invalidate(shop);
    
    // Cache the new registry
    await RegistryCache.set(shop, registry.id, registry);
    
    log.info("Registry created", {
      shop,
      registryId: registry.id,
      customerId: validatedData.customerId,
      sessionId: session.id
    });
    
    return apiResponse.created({ registry }, "Registry created successfully");
  } catch (error) {
    log.error("Failed to create registry", error);
    
    return apiResponse.serverError(error);
  }
}