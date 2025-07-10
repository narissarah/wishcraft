import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";
import { registryCache, apiCache } from "~/lib/cache/redis.server";
import { log } from "~/lib/logger.server";
import { captureException } from "~/lib/monitoring.server";
import { rateLimiter } from "~/lib/rate-limiter.server";

/**
 * GET /api/registries - List all registries for a shop
 * Implements Redis caching for performance
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Rate limiting
    const { allowed } = await rateLimiter.check(request);
    if (!allowed) {
      return json({ error: "Too many requests" }, { status: 429 });
    }
    
    // Authenticate
    const { admin, session } = await authenticate.admin(request);
    const shop = session.shop;
    
    // Check cache first
    const cacheKey = `registries:${shop}`;
    const cached = await apiCache.get(cacheKey);
    
    if (cached) {
      log.debug("Cache hit for registries", { shop });
      return json(cached);
    }
    
    // Fetch from database
    const registries = await db.registry.findMany({
      where: { shopId: shop },
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
            purchasedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    
    // Transform data
    const response = {
      registries: registries.map(registry => ({
        id: registry.id,
        name: registry.name,
        customerId: registry.customerId,
        eventDate: registry.eventDate,
        status: registry.status,
        privacy: registry.privacy,
        itemCount: registry.items.length,
        purchaseCount: registry.purchases.filter(p => p.status === "COMPLETED").length,
        createdAt: registry.createdAt,
        updatedAt: registry.updatedAt,
      })),
      total: registries.length,
    };
    
    // Cache the response
    await apiCache.set(cacheKey, response, undefined, 300); // 5 minutes
    
    return json(response);
  } catch (error) {
    log.error("Failed to fetch registries", error);
    captureException(error as Error, { 
      tags: { endpoint: "api.registries" },
    });
    
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
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  
  try {
    // Rate limiting
    const { allowed } = await rateLimiter.check(request);
    if (!allowed) {
      return json({ error: "Too many requests" }, { status: 429 });
    }
    
    // Authenticate
    const { admin, session } = await authenticate.admin(request);
    const shop = session.shop;
    
    // Parse request body
    const formData = await request.formData();
    const data = Object.fromEntries(formData);
    
    // Validate input
    const { name, customerId, eventDate, privacy = "PUBLIC" } = data;
    
    if (!name || !customerId) {
      return json(
        { error: "Name and customer ID are required" },
        { status: 400 }
      );
    }
    
    // Create registry
    const registry = await db.registry.create({
      data: {
        shopId: shop,
        customerId: customerId as string,
        name: name as string,
        eventDate: eventDate ? new Date(eventDate as string) : null,
        status: "ACTIVE",
        privacy: privacy as "PUBLIC" | "PRIVATE",
        preferences: {},
      },
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        shopId: shop,
        userId: session.id,
        action: "REGISTRY_CREATED",
        resource: "registry",
        resourceId: registry.id,
        metadata: JSON.stringify({ name, customerId }),
      },
    });
    
    // Invalidate cache
    await apiCache.invalidate(`registries:${shop}`);
    
    log.info("Registry created", {
      shop,
      registryId: registry.id,
      customerId,
    });
    
    return json({ registry }, { status: 201 });
  } catch (error) {
    log.error("Failed to create registry", error);
    captureException(error as Error, {
      tags: { endpoint: "api.registries", method: "POST" },
    });
    
    return json(
      { error: "Failed to create registry" },
      { status: 500 }
    );
  }
}