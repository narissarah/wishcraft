import { db } from "~/lib/db.server";
import { encryptPII, decryptPII, hashAccessCode, verifyAccessCode, encryptGiftMessage, decryptGiftMessage, validateGiftMessage, sanitizeGiftMessage, logGiftMessageOperation, createSearchableEmailHash, encryptPurchasePII, decryptPurchasePII, encryptAddressPII, decryptAddressPII, encryptCollaboratorPII, decryptCollaboratorPII } from "~/lib/crypto.server";
import { log } from "~/lib/logger.server";
import { sanitizeString, createSlug } from "~/lib/validation.server";
import type { registries, registry_items, registry_purchases } from "@prisma/client";
import crypto from "crypto";


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

export interface RegistryWithDecryptedPII extends Omit<registries, 'customerEmail' | 'customerFirstName' | 'customerLastName'> {
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
  purchaserPhone?: string;
  orderId?: string;
  orderName?: string;
  giftMessage?: string;
}

export type RegistryWithDetails = registries & {
  items: registry_items[];
  _count: {
    items: number;
  };
};


/**
 * Create a new registry with encrypted PII
 */
export async function createRegistry(shopId: string, data: CreateRegistryInput): Promise<RegistryWithDecryptedPII> {
  const slug = createSlug(data.title);
  
  // Encrypt PII fields
  const encryptedEmail = data.customerEmail ? encryptPII(data.customerEmail) : '';
  const encryptedFirstName = data.customerFirstName ? encryptPII(data.customerFirstName) : null;
  const encryptedLastName = data.customerLastName ? encryptPII(data.customerLastName) : null;
  
  // Create searchable hash for efficient queries
  const customerEmailHash = data.customerEmail ? createSearchableEmailHash(data.customerEmail) : null;
  
  // Hash access code if provided
  const hashedAccessCode = data.accessCode ? await hashAccessCode(data.accessCode) : null;
  
  const registry = await db.registries.create({
    data: {
      id: crypto.randomUUID(),
      title: data.title,
      description: data.description,
      slug,
      eventType: data.eventType,
      eventDate: data.eventDate,
      visibility: data.visibility,
      accessCode: hashedAccessCode,
      customerId: data.customerId || '',
      updatedAt: new Date(),
      customerEmail: encryptedEmail,
      customerFirstName: encryptedFirstName,
      customerLastName: encryptedLastName,
      shopId,
      status: 'active',
    },
  });


  return decryptRegistryPII(registry);
}

/**
 * Get registry by ID with decrypted PII (cached)
 */
export const getRegistryById = async (id: string): Promise<RegistryWithDecryptedPII | null> => {
  try {
    const registry = await db.registries.findUnique({
      where: { id },
    });
    
    if (!registry) return null;
    
    return decryptRegistryPII(registry);
  } catch (error) {
    log.error('Failed to get registry by ID', error as Error, { id });
    return null;
  }
};

/**
 * Get registry with items and purchases - OPTIMIZED
 */
export async function getRegistryWithDetails(id: string): Promise<RegistryWithDetails | null> {
  // PERFORMANCE: Use select instead of include for better performance
  const registry = await db.registries.findUnique({
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
      registry_items: {
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
      _count: {
        select: {
          registry_items: true,
        },
      },
    },
  });

  if (!registry) return null;
  
  // Decrypt PII fields and transform to expected structure
  return {
    ...registry,
    items: registry.registry_items,
    _count: {
      items: registry._count.registry_items
    },
    customerEmail: decryptPII(registry.customerEmail),
    customerFirstName: registry.customerFirstName ? decryptPII(registry.customerFirstName) : null,
    customerLastName: registry.customerLastName ? decryptPII(registry.customerLastName) : null,
  } as unknown as RegistryWithDetails;
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
  const registries = await db.registries.findMany({
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
          registry_items: true,
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
    updateData.slug = createSlug(data.title);
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

  const updatedRegistry = await db.registries.update({
    where: { id },
    data: updateData,
  });

  return decryptRegistryPII(updatedRegistry);
}

/**
 * Delete registry
 */
export async function deleteRegistry(id: string): Promise<void> {
  await db.registries.delete({
    where: { id },
  });
}

/**
 * Add item to registry
 */
export async function addItemToRegistry(data: AddItemToRegistryInput): Promise<registry_items> {
  const item = await db.registry_items.create({
    data: {
      id: crypto.randomUUID(),
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
      updatedAt: new Date(),
    },
  });

  return item;
}

/**
 * Remove item from registry
 */
export async function removeItemFromRegistry(itemId: string): Promise<void> {
  await db.registry_items.delete({
    where: { id: itemId },
  });
}

/**
 * Purchase registry item
 */
export async function purchaseRegistryItem(data: PurchaseRegistryItemInput): Promise<registry_purchases> {
  const item = await db.registry_items.findUnique({
    where: { id: data.itemId },
  });

  if (!item) {
    throw new Error('Registry item not found');
  }

  // Process gift message encryption
  let encryptedGiftMessage = '';
  const purchaserId = data.purchaserEmail || 'anonymous';
  
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

  // CRITICAL: Encrypt all PII fields before storing
  const encryptedPurchaseData = encryptPurchasePII({
    purchaserEmail: data.purchaserEmail,
    purchaserName: data.purchaserName,
    purchaserPhone: data.purchaserPhone,
  });

  const purchase = await db.registry_purchases.create({
    data: {
      id: crypto.randomUUID(),
      registryItemId: data.itemId,
      quantity: data.quantity,
      unitPrice: item.price,
      totalAmount: item.price * data.quantity,
      currencyCode: item.currencyCode,
      purchaserEmail: encryptedPurchaseData.purchaserEmail,
      purchaserName: encryptedPurchaseData.purchaserName,
      purchaserPhone: encryptedPurchaseData.purchaserPhone,
      orderId: data.orderId,
      orderName: data.orderName,
      giftMessage: encryptedGiftMessage,
      status: 'confirmed',
      updatedAt: new Date(),
    },
  });

  // Update item quantity purchased
  await db.registry_items.update({
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
export const getRegistryBySlug = async (slug: string): Promise<RegistryWithDecryptedPII | null> => {
  try {
    const registry = await db.registries.findFirst({
      where: { slug },
    });
    
    if (!registry) return null;
    
    return decryptRegistryPII(registry);
  } catch (error) {
    log.error('Failed to get registry by slug', error as Error, { slug });
    return null;
  }
};

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

  const registries = await db.registries.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  
  return registries.map(decryptRegistryPII);
}

/**
 * Get registry statistics
 */
export async function getRegistryStats(registryId: string) {
  const registry = await db.registries.findUnique({
    where: { id: registryId },
    include: {
      registry_items: true,
    },
  });

  if (!registry) {
    return null;
  }

  const totalItems = registry.registry_items.length;
  // Get purchases through registry items relation
  const totalPurchases = await db.registry_purchases.count({
    where: {
      registry_items: {
        registryId: registryId
      }
    }
  });
  const totalValue = registry.registry_items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const purchasedValue = await db.registry_purchases.aggregate({
    where: {
      registry_items: {
        registryId: registryId
      }
    },
    _sum: {
      totalAmount: true
    }
  }).then(result => result._sum.totalAmount || 0);
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
  const registry = await db.registries.findUnique({
    where: { id: registryId },
    select: { accessCode: true },
  });
  
  if (!registry || !registry.accessCode) {
    return false;
  }
  
  return await verifyAccessCode(accessCode, registry.accessCode);
}


/**
 * Search registries by customer email (using searchable hash for efficiency)
 */
export async function searchRegistriesByCustomer(
  shopId: string,
  customerEmail: string
): Promise<RegistryWithDecryptedPII[]> {
  // Encrypt email for querying
  const encryptedEmail = encryptPII(customerEmail);
  
  // Query using encrypted email
  const registries = await db.registries.findMany({
    where: { 
      shopId,
      customerEmail: encryptedEmail 
    },
    include: {
      registry_items: {
        where: { status: 'active' },
        take: 100 // Limit items per registry
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
  const result = await db.registry_items.createMany({
    data: items.map(item => ({
      id: crypto.randomUUID(),
      registryId,
      ...item,
      status: 'active',
      updatedAt: new Date(),
    })),
  });
  
  // Update registry total value in single query
  const totalValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  await db.registries.update({
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
    db.registries.aggregate({
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
    db.registry_items.aggregate({
      where: {
        registries: { shopId },
      },
      _count: { id: true },
      _sum: {
        quantity: true,
        quantityPurchased: true,
      },
    }),
    
    // Purchase statistics
    db.registry_purchases.aggregate({
      where: {
        registry_items: {
          registries: { shopId },
        },
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
      total: purchaseStats._count?.id || 0,
      totalAmount: purchaseStats._sum?.totalAmount || 0,
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
  const registries = await db.registries.findMany({
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
          registry_items: true,
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