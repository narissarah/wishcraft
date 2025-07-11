import { db } from "~/lib/db.server";
import { generateSlug } from "~/lib/utils.server";
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
  customerId?: string;
  customerEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
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
 * Create a new registry
 */
export async function createRegistry(shopId: string, data: CreateRegistryInput): Promise<Registry> {
  const slug = generateSlug(data.title);
  
  const registry = await db.registry.create({
    data: {
      title: data.title,
      description: data.description,
      slug,
      eventType: data.eventType,
      eventDate: data.eventDate,
      visibility: data.visibility,
      customerId: data.customerId || null,
      customerEmail: data.customerEmail || null,
      customerFirstName: data.customerFirstName,
      customerLastName: data.customerLastName,
      customerPhone: data.customerPhone,
      shopId,
      status: 'ACTIVE',
    },
  });

  return registry;
}

/**
 * Get registry by ID
 */
export async function getRegistryById(id: string): Promise<Registry | null> {
  return await db.registry.findUnique({
    where: { id },
  });
}

/**
 * Get registry with items and purchases
 */
export async function getRegistryWithDetails(id: string): Promise<RegistryWithDetails | null> {
  const registry = await db.registry.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { createdAt: 'desc' },
      },
      purchases: {
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          items: true,
          purchases: true,
        },
      },
    },
  });

  return registry;
}

/**
 * Get registries by shop
 */
export async function getRegistriesByShop(shopId: string): Promise<Registry[]> {
  return await db.registry.findMany({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update registry
 */
export async function updateRegistry(id: string, data: Partial<CreateRegistryInput>): Promise<Registry> {
  const updateData: any = { ...data };
  
  if (data.title) {
    updateData.slug = generateSlug(data.title);
  }

  const updatedRegistry = await db.registry.update({
    where: { id },
    data: updateData,
  });

  return updatedRegistry;
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
      giftMessage: data.giftMessage,
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
 * Get registry by slug
 */
export async function getRegistryBySlug(slug: string): Promise<Registry | null> {
  return await db.registry.findFirst({
    where: { slug },
  });
}

/**
 * Search registries
 */
export async function searchRegistries(query: string, shopId?: string): Promise<Registry[]> {
  const where: any = {
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { customerEmail: { contains: query, mode: 'insensitive' } },
      { customerFirstName: { contains: query, mode: 'insensitive' } },
      { customerLastName: { contains: query, mode: 'insensitive' } },
    ],
  };

  if (shopId) {
    where.shopId = shopId;
  }

  return await db.registry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
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