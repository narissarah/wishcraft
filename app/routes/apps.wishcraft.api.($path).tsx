import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { createRegistryServiceFromRequest } from "~/lib/registry.server";
import { createRegistrySharingService } from "~/lib/registry-sharing.server";
import { createRegistryAnalyticsService } from "~/lib/registry-analytics.server";
import { getCustomerSession } from "~/lib/customer-auth.server";

/**
 * App Proxy Route Handler
 * Handles all storefront API requests through Shopify's app proxy
 * Path: /apps/wishcraft/api/*
 */

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { searchParams } = new URL(request.url);
  const path = params.path || '';
  
  try {
    // Authenticate the request
    const { shop } = await authenticate.public.appProxy(request);
    
    if (!shop) {
      return json({ error: 'Shop not found' }, { status: 404 });
    }

    // Route based on path
    switch (path) {
      case 'registries':
        return handleGetRegistries(request, shop.id);
        
      case 'registry':
        return handleGetRegistry(request, shop.id, searchParams);
        
      case 'products':
        return handleGetProducts(request, shop.id, searchParams);
        
      default:
        return json({ error: 'Endpoint not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('App proxy error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const path = params.path || '';
  
  try {
    // Authenticate the request
    const { shop } = await authenticate.public.appProxy(request);
    
    if (!shop) {
      return json({ error: 'Shop not found' }, { status: 404 });
    }

    // Route based on path and method
    const method = request.method;
    
    if (method === 'POST') {
      switch (path) {
        case 'registries':
          return handleCreateRegistry(request, shop.id);
          
        case 'registry/items':
          return handleAddToRegistry(request, shop.id);
          
        case 'registry/share':
          return handleShareRegistry(request, shop.id);
          
        case 'analytics/track':
          return handleTrackEvent(request, shop.id);
          
        default:
          return json({ error: 'Endpoint not found' }, { status: 404 });
      }
    }
    
    return json({ error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    console.error('App proxy action error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

/**
 * Get customer registries
 */
async function handleGetRegistries(request: Request, shopId: string) {
  try {
    const customerSession = await getCustomerSession(request);
    
    if (!customerSession) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    const registryService = await createRegistryServiceFromRequest(request, shopId);
    const registries = await registryService.getCustomerRegistries(customerSession.customerId);

    return json({
      registries: registries.map(registry => ({
        id: registry.id,
        title: registry.title,
        slug: registry.slug,
        visibility: registry.visibility,
        itemCount: registry._count?.items || 0,
        createdAt: registry.createdAt,
        updatedAt: registry.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching registries:', error);
    return json({ error: 'Failed to fetch registries' }, { status: 500 });
  }
}

/**
 * Get specific registry (public view)
 */
async function handleGetRegistry(request: Request, shopId: string, searchParams: URLSearchParams) {
  try {
    const registryId = searchParams.get('id');
    const registrySlug = searchParams.get('slug');
    
    if (!registryId && !registrySlug) {
      return json({ error: 'Registry ID or slug required' }, { status: 400 });
    }

    const registryService = await createRegistryServiceFromRequest(request, shopId);
    
    let registry;
    if (registryId) {
      registry = await registryService.getRegistryById(registryId);
    } else if (registrySlug) {
      registry = await registryService.getRegistryBySlug(registrySlug);
    }

    if (!registry) {
      return json({ error: 'Registry not found' }, { status: 404 });
    }

    // Check access permissions
    const customerSession = await getCustomerSession(request);
    const hasAccess = await checkRegistryAccess(registry, customerSession, request);
    
    if (!hasAccess) {
      return json({ error: 'Access denied' }, { status: 403 });
    }

    // Get registry items
    const items = await registryService.getRegistryItems(registry.id);

    // Track registry view
    const analyticsService = createRegistryAnalyticsService(shopId);
    await analyticsService.trackRegistryView(registry.id, {
      customerId: customerSession?.customerId,
      customerEmail: customerSession?.email,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
      referrer: request.headers.get('referer') || undefined
    });

    return json({
      registry: {
        id: registry.id,
        title: registry.title,
        description: registry.description,
        slug: registry.slug,
        visibility: registry.visibility,
        customerFirstName: registry.customerFirstName,
        customerLastName: registry.customerLastName,
        createdAt: registry.createdAt
      },
      items: items.map(item => ({
        id: item.id,
        productId: item.productId,
        productTitle: item.productTitle,
        productHandle: item.productHandle,
        productImage: item.productImage,
        productUrl: item.productUrl,
        variantId: item.variantId,
        variantTitle: item.variantTitle,
        quantity: item.quantity,
        quantityPurchased: item.quantityPurchased,
        price: item.price,
        priority: item.priority,
        notes: item.notes,
        addedAt: item.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching registry:', error);
    return json({ error: 'Failed to fetch registry' }, { status: 500 });
  }
}

/**
 * Get products for registry selection
 */
async function handleGetProducts(request: Request, shopId: string, searchParams: URLSearchParams) {
  try {
    const query = searchParams.get('query') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    
    // This would integrate with your Shopify API service
    // For now, return mock data
    return json({
      products: [],
      hasMore: false
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

/**
 * Create new registry
 */
async function handleCreateRegistry(request: Request, shopId: string) {
  try {
    const customerSession = await getCustomerSession(request);
    
    if (!customerSession) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, visibility = 'private', eventDate, eventType } = body;

    if (!title) {
      return json({ error: 'Title is required' }, { status: 400 });
    }

    const registryService = await createRegistryServiceFromRequest(request, shopId);
    const registry = await registryService.createRegistry({
      title,
      description,
      visibility,
      eventDate: eventDate ? new Date(eventDate) : undefined,
      eventType,
      customerId: customerSession.customerId,
      customerEmail: customerSession.email,
      customerFirstName: customerSession.firstName,
      customerLastName: customerSession.lastName
    });

    return json({
      registry: {
        id: registry.id,
        title: registry.title,
        slug: registry.slug,
        visibility: registry.visibility
      }
    });
  } catch (error) {
    console.error('Error creating registry:', error);
    return json({ error: 'Failed to create registry' }, { status: 500 });
  }
}

/**
 * Add item to registry
 */
async function handleAddToRegistry(request: Request, shopId: string) {
  try {
    const customerSession = await getCustomerSession(request);
    
    if (!customerSession) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const {
      registry_id,
      product_id,
      variant_id,
      quantity = 1,
      priority = 'medium',
      notes,
      product_title,
      product_handle,
      product_image,
      product_url
    } = body;

    if (!registry_id || !product_id) {
      return json({ error: 'Registry ID and Product ID are required' }, { status: 400 });
    }

    const registryService = await createRegistryServiceFromRequest(request, shopId);
    
    // Verify registry ownership or collaboration
    const registry = await registryService.getRegistryById(registry_id);
    if (!registry || registry.customerId !== customerSession.customerId) {
      // Check if user is a collaborator
      const hasEditAccess = await registryService.checkEditAccess(registry_id, customerSession.customerId);
      if (!hasEditAccess) {
        return json({ error: 'Access denied' }, { status: 403 });
      }
    }

    await registryService.addItemToRegistry({
      registryId: registry_id,
      productId: product_id,
      variantId: variant_id,
      quantity,
      priority,
      notes,
      productTitle: product_title,
      productHandle: product_handle,
      productImage: product_image,
      productUrl: product_url
    });

    // Track the event
    const analyticsService = createRegistryAnalyticsService(shopId);
    await analyticsService.trackItemInteraction(registry_id, product_id, 'added_to_registry', {
      customerId: customerSession.customerId,
      customerEmail: customerSession.email,
      quantity,
      priority
    });

    return json({ success: true, message: 'Item added to registry' });
  } catch (error) {
    console.error('Error adding to registry:', error);
    return json({ error: 'Failed to add item to registry' }, { status: 500 });
  }
}

/**
 * Share registry
 */
async function handleShareRegistry(request: Request, shopId: string) {
  try {
    const customerSession = await getCustomerSession(request);
    
    if (!customerSession) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { registry_id, platform, emails, message } = body;

    if (!registry_id) {
      return json({ error: 'Registry ID is required' }, { status: 400 });
    }

    const sharingService = createRegistrySharingService(shopId);

    if (emails && emails.length > 0) {
      // Email sharing
      const result = await sharingService.sendEmailShares(registry_id, {
        recipientEmails: emails,
        senderName: `${customerSession.firstName} ${customerSession.lastName}`.trim(),
        senderEmail: customerSession.email,
        personalMessage: message
      });

      return json({
        success: result.success,
        sentEmails: result.sentEmails,
        failedEmails: result.failedEmails
      });
    } else {
      // Social/link sharing
      await sharingService.trackShare(registry_id, platform, customerSession.customerId);
      
      return json({ success: true, message: 'Share tracked' });
    }
  } catch (error) {
    console.error('Error sharing registry:', error);
    return json({ error: 'Failed to share registry' }, { status: 500 });
  }
}

/**
 * Track analytics event
 */
async function handleTrackEvent(request: Request, shopId: string) {
  try {
    const body = await request.json();
    const { event_type, registry_id, product_id, data = {} } = body;

    if (!event_type || !registry_id) {
      return json({ error: 'Event type and registry ID are required' }, { status: 400 });
    }

    const analyticsService = createRegistryAnalyticsService(shopId);
    
    if (product_id) {
      await analyticsService.trackItemInteraction(registry_id, product_id, event_type, data);
    } else {
      await analyticsService.trackRegistryView(registry_id, data);
    }

    return json({ success: true });
  } catch (error) {
    console.error('Error tracking event:', error);
    return json({ error: 'Failed to track event' }, { status: 500 });
  }
}

/**
 * Check registry access permissions
 */
async function checkRegistryAccess(
  registry: any,
  customerSession: any,
  request: Request
): Promise<boolean> {
  // Public registries are always accessible
  if (registry.visibility === 'public') {
    return true;
  }

  // Private registries require authentication
  if (registry.visibility === 'private') {
    if (!customerSession) {
      return false;
    }
    
    // Owner always has access
    if (registry.customerId === customerSession.customerId) {
      return true;
    }
    
    // Check collaborator access (would need to implement)
    return false;
  }

  // Password-protected registries (would need password check)
  if (registry.visibility === 'password') {
    const password = new URL(request.url).searchParams.get('password');
    if (!password) {
      return false;
    }
    
    // Verify password (simplified)
    return password === registry.password; // In real app, use proper hashing
  }

  return false;
}