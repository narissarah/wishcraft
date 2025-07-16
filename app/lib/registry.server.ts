import { db } from "~/lib/db.server";
import { generateSlug } from "~/lib/utils";
import { encryptPII, decryptPII, hashAccessCode, verifyAccessCode, encryptGiftMessage, decryptGiftMessage, validateGiftMessage, sanitizeGiftMessage, logGiftMessageOperation, createSearchableEmailHash } from "~/lib/encryption.server";
import { cache, cacheKeys, withCache } from "~/lib/cache-unified.server";
import type { Registry, RegistryItem, RegistryPurchase } from "@prisma/client";

// ============================================================================
// REGISTRY TYPES & INTERFACES
// ============================================================================

export interface CreateRegistryInput {
  title: string;
  description?: string;
  eventType: string;
  eventDate?: Date;
  visibility: 'public' | 'private' | 'friends' | 'password';
  accessCode?: string;
  customerId?: string;
  customerEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
}

export interface RegistryWithDecryptedPII extends Omit<Registry, 'customerEmail' | 'customerFirstName' | 'customerLastName'> {
  customerEmail: string;
  customerFirstName?: string;
  customerLastName?: string;
}

export interface UpdateRegistryInput extends Partial<CreateRegistryInput> {
  id: string;
}

export interface AddItemToRegistryInput {
  registryId: string;
  productId: string;
  variantId?: string;
  productHandle: string;
  productTitle: string;
  variantTitle?: string;
  productImage?: string;
  quantity?: number;
  priority?: 'high' | 'medium' | 'low';
  notes?: string;
  price: number;
  compareAtPrice?: number;
  currencyCode?: string;
}

export interface PurchaseRegistryItemInput {
  registryId: string;
  itemId: string;
  quantity: number;
  purchaserEmail?: string;
  purchaserName?: string;
  orderId?: string;
  orderName?: string;
  giftMessage?: string;
}

export type RegistryWithDetails = Registry & {
  items: RegistryItem[];
  purchases: RegistryPurchase[];
  _count: {
    items: number;
    purchases: number;
  };
};

// ============================================================================
// REGISTRY CRUD OPERATIONS
// ============================================================================

/**
 * Create a new registry with encrypted PII
 */
export async function createRegistry(shopId: string, data: CreateRegistryInput): Promise<RegistryWithDecryptedPII> {
  const slug = generateSlug(data.title);
  
  // Encrypt PII fields
  const encryptedEmail = data.customerEmail ? encryptPII(data.customerEmail) : '';
  const encryptedFirstName = data.customerFirstName ? encryptPII(data.customerFirstName) : null;
  const encryptedLastName = data.customerLastName ? encryptPII(data.customerLastName) : null;
  
  // Create searchable hash for efficient queries
  const customerEmailHash = data.customerEmail ? createSearchableEmailHash(data.customerEmail) : null;
  
  // Hash access code if provided
  const hashedAccessCode = data.accessCode ? await hashAccessCode(data.accessCode) : null;
  
  const registry = await db.registry.create({
    data: {
      title: data.title,
      description: data.description,
      slug,
      eventType: data.eventType,
      eventDate: data.eventDate,
      visibility: data.visibility,
      accessCode: hashedAccessCode,
      customerId: data.customerId || '',
      customerEmail: encryptedEmail,
      customerEmailHash,
      customerFirstName: encryptedFirstName,
      customerLastName: encryptedLastName,
      shopId,
      status: 'active',
    },
  });

  // Invalidate relevant caches
  await Promise.all([
    cache.invalidateByTag("registry"),
    cache.invalidateByTag(`shop:${shopId}`),
    data.customerEmail && cache.delete(cacheKeys.customerRegistries(shopId, data.customerEmail))
  ]);

  return decryptRegistryPII(registry);
}

/**
 * Get registry by ID with decrypted PII (cached)
 */
export const getRegistryById = withCache(
  async (id: string): Promise<RegistryWithDecryptedPII | null> => {
    const registry = await db.registry.findUnique({
      where: { id },
    });
    
    if (!registry) return null;
    
    return decryptRegistryPII(registry);
  },
  (id: string) => cacheKeys.registry(id),
  { ttl: 300, tags: ["registry"] }
);

/**
 * Get registry with items and purchases - OPTIMIZED
 */
export async function getRegistryWithDetails(id: string): Promise<RegistryWithDetails | null> {
  // PERFORMANCE: Use select instead of include for better performance
  const registry = await db.registry.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      slug: true,
      status: true,
      eventType: true,
      eventDate: true,
      visibility: true,
      accessCode: true,
      shopId: true,
      customerId: true,
      customerEmail: true,
      customerFirstName: true,
      customerLastName: true,
      views: true,
      totalValue: true,
      purchasedValue: true,
      createdAt: true,
      updatedAt: true,
      // Only select needed fields from relations
      items: {
        select: {
          id: true,
          productId: true,
          variantId: true,
          productHandle: true,
          productTitle: true,
          variantTitle: true,
          productImage: true,
          quantity: true,
          quantityPurchased: true,
          priority: true,
          notes: true,
          price: true,
          compareAtPrice: true,
          currencyCode: true,
          inventoryTracked: true,
          inventoryQuantity: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        where: { status: 'active' }, // Filter out inactive items
      },
      purchases: {
        select: {
          id: true,
          orderId: true,
          lineItemId: true,
          orderName: true,
          productId: true,
          variantId: true,
          quantity: true,
          unitPrice: true,
          totalAmount: true,
          currencyCode: true,
          purchaserEmail: true,
          purchaserName: true,
          isGift: true,
          giftMessage: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50, // Limit recent purchases
      },
      _count: {
        select: {
          items: true,
          purchases: true,
        },
      },
    },
  });

  if (!registry) return null;
  
  // Decrypt PII fields and gift messages
  return {
    ...registry,
    customerEmail: decryptPII(registry.customerEmail),
    customerFirstName: registry.customerFirstName ? decryptPII(registry.customerFirstName) : null,
    customerLastName: registry.customerLastName ? decryptPII(registry.customerLastName) : null,
    purchases: registry.purchases.map(purchase => {
      try {
        const decryptedGiftMessage = purchase.giftMessage 
          ? decryptGiftMessage(purchase.giftMessage, purchase.purchaserEmail || 'anonymous', registry.id)
          : null;
        
        logGiftMessageOperation('decrypt', purchase.purchaserEmail || 'anonymous', registry.id, true);
        
        return {
          ...purchase,
          giftMessage: decryptedGiftMessage,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logGiftMessageOperation('decrypt', purchase.purchaserEmail || 'anonymous', registry.id, false, errorMessage);
        
        return {
          ...purchase,
          giftMessage: '[ENCRYPTED GIFT MESSAGE]',
        };
      }
    }),
  } as RegistryWithDetails;
}

/**
 * Get registries by shop with decrypted PII - OPTIMIZED
 */
export async function getRegistriesByShop(
  shopId: string,
  options?: {
    take?: number;
    skip?: number;
    status?: string;
    eventType?: string;
  }
): Promise<RegistryWithDecryptedPII[]> {
  // PERFORMANCE: Add pagination and filtering
  const registries = await db.registry.findMany({
    where: {
      shopId,
      ...(options?.status && { status: options.status }),
      ...(options?.eventType && { eventType: options.eventType }),
    },
    orderBy: { createdAt: 'desc' },
    take: options?.take || 20, // Default to 20 items
    skip: options?.skip || 0,
    select: {
      id: true,
      title: true,
      description: true,
      slug: true,
      status: true,
      eventType: true,
      eventDate: true,
      visibility: true,
      shopId: true,
      customerId: true,
      customerEmail: true,
      customerFirstName: true,
      customerLastName: true,
      views: true,
      totalValue: true,
      purchasedValue: true,
      createdAt: true,
      updatedAt: true,
      // Count items without loading them
      _count: {
        select: {
          items: true,
          purchases: true,
        },
      },
    },
  });
  
  return registries.map(decryptRegistryPII);
}

/**
 * Update registry with PII encryption
 */
export async function updateRegistry(id: string, data: Partial<CreateRegistryInput>): Promise<RegistryWithDecryptedPII> {
  const updateData: any = { ...data };
  
  if (data.title) {
    updateData.slug = generateSlug(data.title);
  }
  
  // Encrypt PII fields if they're being updated
  if (data.customerEmail) {
    updateData.customerEmail = encryptPII(data.customerEmail);
    updateData.customerEmailHash = createSearchableEmailHash(data.customerEmail);
  }
  if (data.customerFirstName) {
    updateData.customerFirstName = encryptPII(data.customerFirstName);
  }
  if (data.customerLastName) {
    updateData.customerLastName = encryptPII(data.customerLastName);
  }
  
  // Hash access code if being updated
  if (data.accessCode) {
    updateData.accessCode = await hashAccessCode(data.accessCode);
  }

  const updatedRegistry = await db.registry.update({
    where: { id },
    data: updateData,
  });

  return decryptRegistryPII(updatedRegistry);
}

/**
 * Delete registry
 */
export async function deleteRegistry(id: string): Promise<void> {
  await db.registry.delete({
    where: { id },
  });
}

/**
 * Add item to registry
 */
export async function addItemToRegistry(data: AddItemToRegistryInput): Promise<RegistryItem> {
  const item = await db.registryItem.create({
    data: {
      registryId: data.registryId,
      productId: data.productId,
      variantId: data.variantId,
      productHandle: data.productHandle,
      productTitle: data.productTitle,
      variantTitle: data.variantTitle,
      productImage: data.productImage,
      quantity: data.quantity || 1,
      priority: data.priority || 'medium',
      notes: data.notes,
      price: data.price,
      compareAtPrice: data.compareAtPrice,
      currencyCode: data.currencyCode || 'USD',
    },
  });

  return item;
}

/**
 * Remove item from registry
 */
export async function removeItemFromRegistry(itemId: string): Promise<void> {
  await db.registryItem.delete({
    where: { id: itemId },
  });
}

/**
 * Purchase registry item
 */
export async function purchaseRegistryItem(data: PurchaseRegistryItemInput): Promise<RegistryPurchase> {
  const item = await db.registryItem.findUnique({
    where: { id: data.itemId },
  });

  if (!item) {
    throw new Error('Registry item not found');
  }

  // Process gift message encryption
  let encryptedGiftMessage = '';
  let purchaserId = data.purchaserEmail || 'anonymous';
  
  if (data.giftMessage) {
    try {
      // Validate gift message content
      const validation = validateGiftMessage(data.giftMessage);
      if (!validation.isValid) {
        logGiftMessageOperation('validate', purchaserId, data.registryId, false, validation.error);
        throw new Error(validation.error || 'Invalid gift message');
      }
      
      // Sanitize before encryption
      const sanitizedMessage = sanitizeGiftMessage(data.giftMessage);
      
      // Encrypt gift message
      encryptedGiftMessage = encryptGiftMessage(sanitizedMessage, purchaserId, data.registryId);
      
      logGiftMessageOperation('encrypt', purchaserId, data.registryId, true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logGiftMessageOperation('encrypt', purchaserId, data.registryId, false, errorMessage);
      throw new Error(`Failed to process gift message: ${errorMessage}`);
    }
  }

  const purchase = await db.registryPurchase.create({
    data: {
      registryId: data.registryId,
      productId: item.productId,
      variantId: item.variantId,
      quantity: data.quantity,
      unitPrice: item.price,
      totalAmount: item.price * data.quantity,
      currencyCode: item.currencyCode,
      purchaserEmail: data.purchaserEmail,
      purchaserName: data.purchaserName,
      orderId: data.orderId,
      orderName: data.orderName,
      giftMessage: encryptedGiftMessage,
      status: 'confirmed',
    },
  });

  // Update item quantity purchased
  await db.registryItem.update({
    where: { id: data.itemId },
    data: {
      quantityPurchased: {
        increment: data.quantity,
      },
    },
  });

  return purchase;
}

/**
 * Get registry by slug with decrypted PII (cached)
 */
export const getRegistryBySlug = withCache(
  async (slug: string): Promise<RegistryWithDecryptedPII | null> => {
    const registry = await db.registry.findFirst({
      where: { slug },
    });
    
    if (!registry) return null;
    
    return decryptRegistryPII(registry);
  },
  (slug: string) => cacheKeys.registryBySlug(slug),
  { ttl: 300, tags: ["registry"] }
);

/**
 * Search registries (NOTE: PII search is limited due to encryption)
 */
export async function searchRegistries(query: string, shopId?: string): Promise<RegistryWithDecryptedPII[]> {
  const where: any = {
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      // NOTE: Can't search encrypted PII fields directly
      // For production, implement searchable hashes for customer data
    ],
  };

  if (shopId) {
    where.shopId = shopId;
  }

  const registries = await db.registry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  
  return registries.map(decryptRegistryPII);
}

/**
 * Get registry statistics
 */
export async function getRegistryStats(registryId: string) {
  const registry = await db.registry.findUnique({
    where: { id: registryId },
    include: {
      items: true,
      purchases: true,
    },
  });

  if (!registry) {
    return null;
  }

  const totalItems = registry.items.length;
  const totalPurchases = registry.purchases.length;
  const totalValue = registry.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const purchasedValue = registry.purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
  const completionRate = totalItems > 0 ? (totalPurchases / totalItems) * 100 : 0;

  return {
    totalItems,
    totalPurchases,
    totalValue,
    purchasedValue,
    completionRate,
    remainingValue: totalValue - purchasedValue,
  };
}

// ============================================================================
// SECURITY UTILITIES
// ============================================================================

/**
 * Helper function to decrypt PII fields in registry
 */
function decryptRegistryPII(registry: any): RegistryWithDecryptedPII {
  return {
    ...registry,
    customerEmail: decryptPII(registry.customerEmail),
    customerFirstName: registry.customerFirstName ? decryptPII(registry.customerFirstName) : null,
    customerLastName: registry.customerLastName ? decryptPII(registry.customerLastName) : null,
  };
}

/**
 * Verify access code for protected registry
 */
export async function verifyRegistryAccess(registryId: string, accessCode: string): Promise<boolean> {
  const registry = await db.registry.findUnique({
    where: { id: registryId },
    select: { accessCode: true },
  });
  
  if (!registry || !registry.accessCode) {
    return false;
  }
  
  return await verifyAccessCode(accessCode, registry.accessCode);
}

// ============================================================================
// GDPR COMPLIANCE UTILITIES
// ============================================================================

/**
 * Search registries by customer email (using searchable hash for efficiency)
 */
export async function searchRegistriesByCustomer(
  shopId: string,
  customerEmail: string
): Promise<RegistryWithDecryptedPII[]> {
  // Use searchable hash for efficient query
  const emailHash = createSearchableEmailHash(customerEmail);
  
  // Now we can efficiently query using the indexed hash
  const registries = await db.registry.findMany({
    where: { 
      shopId,
      customerEmailHash: emailHash 
    },
    include: {
      items: {
        where: { status: 'active' },
        take: 100 // Limit items per registry
      },
      purchases: {
        take: 50 // Limit recent purchases
      },
    },
  });
  
  return registries.map(decryptRegistryPII);
}

/**
 * GDPR: Get all data for a specific customer
 */
export async function getCustomerData(shopId: string, customerEmail: string) {
  const registries = await searchRegistriesByCustomer(shopId, customerEmail);
  
  return {
    registries,
    dataCollected: {
      personalData: ['email', 'firstName', 'lastName'],
      behavioralData: ['registryViews', 'itemPreferences'],
      timestamps: ['createdAt', 'updatedAt'],
    },
  };
}

/**
 * GDPR: Delete all data for a specific customer
 */
export async function deleteCustomerData(shopId: string, customerEmail: string) {
  const registries = await searchRegistriesByCustomer(shopId, customerEmail);
  
  for (const registry of registries) {
    await deleteRegistry(registry.id);
  }
  
  return {
    deletedRegistries: registries.length,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// PERFORMANCE OPTIMIZED OPERATIONS
// ============================================================================

/**
 * Batch create registry items with optimized performance
 */
export async function batchCreateRegistryItems(
  registryId: string,
  items: Array<{
    productId: string;
    variantId?: string;
    productHandle: string;
    productTitle: string;
    variantTitle?: string;
    productImage?: string;
    quantity: number;
    priority: string;
    notes?: string;
    price: number;
    compareAtPrice?: number;
    currencyCode: string;
  }>
): Promise<number> {
  // PERFORMANCE: Use createMany for batch insert
  const result = await db.registryItem.createMany({
    data: items.map(item => ({
      registryId,
      ...item,
      status: 'active',
    })),
  });
  
  // Update registry total value in single query
  const totalValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  await db.registry.update({
    where: { id: registryId },
    data: {
      totalValue: { increment: totalValue },
    },
  });
  
  return result.count;
}

/**
 * Get registry statistics with optimized queries
 */
export async function getOptimizedRegistryStats(shopId: string) {
  // PERFORMANCE: Use aggregation pipeline
  const [registryStats, itemStats, purchaseStats] = await Promise.all([
    // Registry statistics
    db.registry.aggregate({
      where: { shopId },
      _count: { id: true },
      _sum: { 
        totalValue: true,
        purchasedValue: true,
        views: true,
      },
      _avg: {
        totalValue: true,
        purchasedValue: true,
      },
    }),
    
    // Item statistics
    db.registryItem.aggregate({
      where: {
        registry: { shopId },
      },
      _count: { id: true },
      _sum: {
        quantity: true,
        quantityPurchased: true,
      },
    }),
    
    // Purchase statistics
    db.registryPurchase.aggregate({
      where: {
        registry: { shopId },
      },
      _count: { id: true },
      _sum: {
        totalAmount: true,
      },
    }),
  ]);
  
  return {
    registries: {
      total: registryStats._count.id,
      totalValue: registryStats._sum.totalValue || 0,
      totalPurchased: registryStats._sum.purchasedValue || 0,
      totalViews: registryStats._sum.views || 0,
      avgValue: registryStats._avg.totalValue || 0,
      avgPurchased: registryStats._avg.purchasedValue || 0,
    },
    items: {
      total: itemStats._count.id,
      totalQuantity: itemStats._sum.quantity || 0,
      totalPurchased: itemStats._sum.quantityPurchased || 0,
    },
    purchases: {
      total: purchaseStats._count.id,
      totalAmount: purchaseStats._sum.totalAmount || 0,
    },
  };
}

/**
 * Cursor-based pagination for large registry lists
 */
export async function getRegistriesWithCursor(
  shopId: string,
  cursor?: string,
  take: number = 20
): Promise<{
  registries: RegistryWithDecryptedPII[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const registries = await db.registry.findMany({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      eventType: true,
      eventDate: true,
      customerEmail: true,
      customerFirstName: true,
      customerLastName: true,
      totalValue: true,
      purchasedValue: true,
      views: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          items: true,
          purchases: true,
        },
      },
    },
  });
  
  const hasMore = registries.length > take;
  const items = hasMore ? registries.slice(0, take) : registries;
  const nextCursor = hasMore ? items[items.length - 1].id : null;
  
  return {
    registries: items.map(decryptRegistryPII),
    nextCursor,
    hasMore,
  };
}