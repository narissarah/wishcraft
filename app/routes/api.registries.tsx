import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { rateLimiter } from "~/lib/rate-limiter.server";
import { RegistrySchemas, QuerySchemas, withValidation, validateQueryParams, validationErrorResponse, Sanitizer } from "~/lib/validation-unified.server";
import { responses } from "~/lib/response-utils.server";
import { AuditLogger } from "~/lib/audit-logger.server";
import { RegistryCache } from "~/lib/cache-unified.server";

/**
 * GET /api/registries - List all registries for a shop
 * Implements Redis caching for performance
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.check(request);
    if (rateLimitResult && !rateLimitResult.allowed) {
      return responses.tooManyRequests();
    }
    
    // Validate query parameters
    const { data: queryData, errors: queryErrors } = validateQueryParams(
      request,
      QuerySchemas.registryFilters.merge(QuerySchemas.pagination)
    );
    
    if (queryErrors) {
      return validationErrorResponse(queryErrors);
    }
    
    // Authenticate
    const { admin, session } = await authenticate.admin(request);
    const shop = session.shop;
    
    // Try to get from cache first
    const cacheKey = { ...queryData };
    const cachedData = await RegistryCache.getList(shop, cacheKey);
    if (cachedData) {
      log.debug('Registry list cache hit', { shop });
      return json(cachedData);
    }
    
    // Build where clause with validated filters
    const whereClause: any = { shopId: shop };
    if (queryData?.status) whereClause.status = queryData.status;
    if (queryData?.eventType) whereClause.eventType = queryData.eventType;
    if (queryData?.visibility) whereClause.visibility = queryData.visibility;
    if (queryData?.customerId) whereClause.customerId = queryData.customerId;
    if (queryData?.search) {
      whereClause.title = {
        contains: Sanitizer.sanitizeHtml(queryData.search),
        mode: 'insensitive'
      };
    }
    
    // Fetch from database with pagination
    const registries = await db.registry.findMany({
      where: whereClause,
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            quantity: true,
            priority: true,
          },
        },
        purchases: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: ((queryData?.page || 1) - 1) * (queryData?.limit || 20),
      take: queryData?.limit || 20,
    });
    
    // Transform data
    const response = {
      registries: registries.map(registry => ({
        id: registry.id,
        name: registry.title,
        customerId: registry.customerId,
        eventDate: registry.eventDate,
        status: registry.status,
        privacy: registry.visibility,
        itemCount: registry.items.length,
        purchaseCount: registry.purchases.filter((p: any) => p.status === "COMPLETED").length,
        createdAt: registry.createdAt,
        updatedAt: registry.updatedAt,
      })),
      total: registries.length,
    };
    
    // Cache the response
    await RegistryCache.setList(shop, cacheKey, response);
    log.debug('Registry list cached', { shop });
    
    return json(response);
  } catch (error) {
    log.error("Failed to fetch registries", error);
    
    return json(
      { error: "Failed to fetch registries" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/registries - Create a new registry
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return responses.methodNotAllowed();
  }
  
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.check(request);
    if (rateLimitResult && !rateLimitResult.allowed) {
      return responses.tooManyRequests();
    }
    
    // Validate input data
    const validator = withValidation(RegistrySchemas.create);
    const { data: validatedData, errors } = await validator(request);
    
    if (errors || !validatedData) {
      return validationErrorResponse(errors || [{ message: 'Validation failed' }]);
    }
    
    // Authenticate
    const { admin, session } = await authenticate.admin(request);
    const shop = session.shop;
    
    // Sanitize customer data
    const sanitizedCustomer = Sanitizer.sanitizeCustomerData({
      firstName: validatedData.customerFirstName,
      lastName: validatedData.customerLastName,
      email: validatedData.customerEmail
    });
    
    // Create registry with validated and sanitized data
    const registry = await db.registry.create({
      data: {
        shopId: shop,
        customerId: validatedData.customerId,
        customerEmail: sanitizedCustomer.email!,
        customerFirstName: sanitizedCustomer.firstName,
        customerLastName: sanitizedCustomer.lastName,
        title: Sanitizer.sanitizeHtml(validatedData.title),
        description: validatedData.description ? Sanitizer.sanitizeHtml(validatedData.description) : null,
        slug: Sanitizer.createSlug(validatedData.title),
        eventType: validatedData.eventType,
        eventDate: validatedData.eventDate ? new Date(validatedData.eventDate) : null,
        status: "active",
        visibility: validatedData.visibility,
        accessCode: validatedData.accessCode || null,
      },
    });
    
    // Create audit log
    await AuditLogger.logUserAction(
      'registry_created',
      'registry',
      registry.id,
      shop,
      session.id,
      undefined,
      request
    );
    
    // Invalidate list cache
    await RegistryCache.invalidate(shop);
    
    // Cache the new registry
    await RegistryCache.set(shop, registry.id, registry);
    
    log.info("Registry created", {
      shop,
      registryId: registry.id,
      customerId: validatedData.customerId,
    });
    
    return json({ registry }, { status: 201 });
  } catch (error) {
    log.error("Failed to create registry", error);
    
    return responses.serverError();
  }
}