/**
 * Simplified Registry Operations for WishCraft
 * Core CRUD operations without PII complexity
 */

import { db } from "~/lib/db.server";
import { encryptRegistryPII, decryptRegistryPII, decryptRegistryForDisplay } from "~/lib/registry-pii.server";
import { hashAccessCode } from "~/lib/crypto.server";
import { sanitizeString, createSlug } from "~/lib/validation.server";
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

export interface UpdateRegistryInput extends Partial<CreateRegistryInput> {
  id: string;
}

/**
 * Create a new registry
 */
export async function createRegistry(shopId: string, input: CreateRegistryInput) {
  // Sanitize inputs
  const title = sanitizeString(input.title);
  const slug = createSlug(title);
  
  // Encrypt PII
  const encryptedPII = encryptRegistryPII({
    customerEmail: input.customerEmail,
    customerFirstName: input.customerFirstName,
    customerLastName: input.customerLastName,
    customerPhone: input.customerPhone,
  });
  
  // Hash access code if provided
  const hashedAccessCode = input.accessCode ? hashAccessCode(input.accessCode) : null;
  
  const registry = await db.registries.create({
    data: {
      id: crypto.randomUUID(),
      shopId,
      title,
      slug,
      description: input.description ? sanitizeString(input.description) : null,
      eventType: input.eventType,
      eventDate: input.eventDate,
      visibility: input.visibility,
      accessCode: hashedAccessCode,
      customerId: input.customerId || 'anonymous',
      updatedAt: new Date(),
      ...encryptedPII,
    },
  });
  
  return decryptRegistryForDisplay(registry);
}

/**
 * Get registry by ID
 */
export async function getRegistry(id: string, shopId?: string) {
  const where: any = { id };
  if (shopId) {
    where.shopId = shopId;
  }
  
  const registry = await db.registries.findUnique({
    where,
    include: {
      registry_items: {
        orderBy: { createdAt: 'desc' }
      },
      registry_collaborators: {
        where: { status: 'active' }
      },
    },
  });
  
  return registry ? decryptRegistryForDisplay(registry) : null;
}

/**
 * Update registry
 */
export async function updateRegistry(input: UpdateRegistryInput) {
  const { id, ...updateData } = input;
  
  // Prepare update data
  const data: any = {};
  
  if (updateData.title) {
    data.title = sanitizeString(updateData.title);
    data.slug = createSlug(data.title);
  }
  
  if (updateData.description !== undefined) {
    data.description = updateData.description ? sanitizeString(updateData.description) : null;
  }
  
  if (updateData.eventType) data.eventType = updateData.eventType;
  if (updateData.eventDate !== undefined) data.eventDate = updateData.eventDate;
  if (updateData.visibility) data.visibility = updateData.visibility;
  
  if (updateData.accessCode !== undefined) {
    data.accessCodeHash = updateData.accessCode ? hashAccessCode(updateData.accessCode) : null;
  }
  
  // Handle PII updates
  const piiFields = ['customerEmail', 'customerFirstName', 'customerLastName', 'customerPhone'];
  const piiData: any = {};
  let hasPIIUpdates = false;
  
  for (const field of piiFields) {
    if (updateData[field as keyof CreateRegistryInput] !== undefined) {
      hasPIIUpdates = true;
      piiData[field] = updateData[field as keyof CreateRegistryInput];
    }
  }
  
  if (hasPIIUpdates) {
    const encryptedPII = encryptRegistryPII(piiData);
    Object.assign(data, encryptedPII);
  }
  
  const registry = await db.registries.update({
    where: { id },
    data,
  });
  
  return decryptRegistryForDisplay(registry);
}

/**
 * Delete registry
 */
export async function deleteRegistry(id: string, shopId: string) {
  // Soft delete by marking as archived
  const registry = await db.registries.update({
    where: { id, shopId },
    data: {
      status: 'archived',
    },
  });
  
  return decryptRegistryForDisplay(registry);
}

/**
 * List registries for a shop
 */
export async function listRegistries(shopId: string, options: {
  limit?: number;
  offset?: number;
  search?: string;
  eventType?: string;
  status?: string;
} = {}) {
  const {
    limit = 20,
    offset = 0,
    search,
    eventType,
    status = 'active'
  } = options;
  
  const where: any = {
    shopId,
    status,
  };
  
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  if (eventType) {
    where.eventType = eventType;
  }
  
  const registries = await db.registries.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    include: {
      _count: {
        select: {
          registry_items: true,
          registry_collaborators: { where: { status: 'active' } }
        }
      }
    },
  });
  
  return registries.map(decryptRegistryForDisplay);
}

/**
 * Add item to registry
 */
export async function addItemToRegistry(data: {
  registryId: string;
  productId: string;
  productHandle: string;
  productTitle: string;
  variantTitle?: string;
  quantity?: number;
  priority?: 'high' | 'medium' | 'low';
  notes?: string;
  price: number;
  currencyCode?: string;
}) {
  const item = await db.registry_items.create({
    data: {
      id: crypto.randomUUID(),
      registryId: data.registryId,
      productId: data.productId,
      productHandle: data.productHandle,
      productTitle: data.productTitle,
      variantTitle: data.variantTitle,
      quantity: data.quantity || 1,
      priority: data.priority || 'medium',
      notes: data.notes ? sanitizeString(data.notes) : null,
      price: data.price,
      currencyCode: data.currencyCode || 'USD',
      updatedAt: new Date(),
    },
  });
  
  return item;
}

/**
 * Remove item from registry
 */
export async function removeItemFromRegistry(itemId: string, registryId: string) {
  await db.registry_items.delete({
    where: {
      id: itemId,
      registryId, // Ensure item belongs to registry
    },
  });
  
  return { success: true };
}