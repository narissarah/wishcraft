/**
 * Shop Context Validation Middleware
 * Ensures all authenticated requests are properly scoped to the correct shop
 * Prevents cross-shop data access vulnerabilities
 */

import { json } from "@remix-run/node";
// Removed AdminApiContext import as we're using session instead
import { log } from "./logger.server";
import { db } from "./db.server";

export interface ShopContextValidationResult {
  valid: boolean;
  shopId?: string;
  shopDomain?: string;
  error?: string;
}

/**
 * Validate that the authenticated shop matches the requested resource's shop
 * CRITICAL: Always use this for any route that accesses shop-specific data
 */
export async function validateShopContext(
  authenticatedShop: { id: string; domain: string },
  resourceShopId: string
): Promise<ShopContextValidationResult> {
  try {
    // Direct comparison first (most common case)
    if (authenticatedShop.id === resourceShopId) {
      return {
        valid: true,
        shopId: authenticatedShop.id,
        shopDomain: authenticatedShop.domain
      };
    }

    // Check if the resourceShopId is actually a domain
    if (resourceShopId.includes('.myshopify.com')) {
      const shop = await db.shop.findUnique({
        where: { domain: resourceShopId }
      });
      
      if (shop && shop.id === authenticatedShop.id) {
        return {
          valid: true,
          shopId: shop.id,
          shopDomain: shop.domain
        };
      }
    }

    // Log the security violation
    log.error("Cross-shop access attempt detected", {
      authenticatedShopId: authenticatedShop.id,
      authenticatedShopDomain: authenticatedShop.domain,
      requestedResourceShopId: resourceShopId,
      timestamp: new Date().toISOString()
    });

    // Create audit log entry
    await db.auditLog.create({
      data: {
        shopId: authenticatedShop.id,
        action: "CROSS_SHOP_ACCESS_ATTEMPT",
        resource: "shop_context",
        resourceId: resourceShopId,
        metadata: JSON.stringify({
          authenticatedShop,
          attemptedShopId: resourceShopId,
          blocked: true
        }),
        timestamp: new Date()
      }
    }).catch(error => {
      log.error("Failed to create audit log for security violation", error);
    });

    return {
      valid: false,
      error: "Access denied: Invalid shop context"
    };
  } catch (error) {
    log.error("Shop context validation error", error);
    return {
      valid: false,
      error: "Failed to validate shop context"
    };
  }
}

/**
 * Middleware helper to validate shop context for a resource
 * Use in loaders/actions that need shop validation
 */
export async function requireShopContext<T extends { shopId: string }>(
  session: { shop: string },
  resource: T | null,
  resourceType: string = "resource"
): Promise<T> {
  if (!resource) {
    throw json(
      { error: `${resourceType} not found` },
      { status: 404 }
    );
  }

  const validation = await validateShopContext(
    { id: session.shop, domain: session.shop },
    resource.shopId
  );

  if (!validation.valid) {
    throw json(
      { error: validation.error || "Access denied" },
      { status: 403 }
    );
  }

  return resource;
}

/**
 * Batch validate multiple resources belong to the same shop
 */
export async function validateBatchShopContext<T extends { shopId: string }>(
  session: { shop: string },
  resources: T[]
): Promise<boolean> {
  const shopId = session.shop;
  
  for (const resource of resources) {
    if (resource.shopId !== shopId) {
      log.warn("Batch validation failed: Mixed shop contexts", {
        authenticatedShopId: shopId,
        invalidResourceShopId: resource.shopId
      });
      return false;
    }
  }
  
  return true;
}

/**
 * Extract and validate shop from various request sources
 */
export async function extractShopFromRequest(
  request: Request,
  session?: { shop: string }
): Promise<{ shopId: string; shopDomain: string } | null> {
  // Priority 1: Authenticated session context
  if (session) {
    return {
      shopId: session.shop,
      shopDomain: session.shop
    };
  }

  // Priority 2: URL search params
  const url = new URL(request.url);
  const shopParam = url.searchParams.get('shop');
  
  if (shopParam) {
    const shop = await db.shop.findUnique({
      where: { domain: shopParam }
    });
    
    if (shop) {
      return {
        shopId: shop.id,
        shopDomain: shop.domain
      };
    }
  }

  // Priority 3: Referer header (for embedded apps)
  const referer = request.headers.get('referer');
  if (referer) {
    const match = referer.match(/https:\/\/([^\/]+)\.myshopify\.com/);
    if (match) {
      const shop = await db.shop.findUnique({
        where: { domain: `${match[1]}.myshopify.com` }
      });
      
      if (shop) {
        return {
          shopId: shop.id,
          shopDomain: shop.domain
        };
      }
    }
  }

  return null;
}

export default {
  validateShopContext,
  requireShopContext,
  validateBatchShopContext,
  extractShopFromRequest
};