import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";
// Removed complex caching for production simplicity
import { log } from "~/lib/logger.server";
import { rateLimiter } from "~/lib/rate-limiter.server";

/**
 * GET /api/registries - List all registries for a shop
 * Implements Redis caching for performance
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.check(request);
    if (rateLimitResult && !rateLimitResult.allowed) {
      return json({ error: "Too many requests" }, { status: 429 });
    }
    
    // Authenticate
    const { admin, session } = await authenticate.admin(request);
    const shop = session.shop;
    
    // Simplified for production - direct database access
    
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
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
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
    
    // Simplified - no caching for production readiness
    
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
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.check(request);
    if (rateLimitResult && !rateLimitResult.allowed) {
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
        customerEmail: '',
        title: name as string,
        slug: `${name}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        eventDate: eventDate ? new Date(eventDate as string) : null,
        status: "active",
        visibility: privacy as "public" | "private",
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
    
    // Simplified - no cache to invalidate
    
    log.info("Registry created", {
      shop,
      registryId: registry.id,
      customerId,
    });
    
    return json({ registry }, { status: 201 });
  } catch (error) {
    log.error("Failed to create registry", error);
    
    return json(
      { error: "Failed to create registry" },
      { status: 500 }
    );
  }
}