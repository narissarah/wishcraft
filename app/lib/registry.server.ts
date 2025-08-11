import { db } from "~/lib/db.server";
import { decryptRegistryForDisplay } from "~/lib/registry-pii.server";
import type { RegistryWithPII } from "~/lib/types";
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

export async function createRegistry(shopId: string, input: CreateRegistryInput) {
  const title = sanitizeString(input.title);
  const slug = createSlug(title);
  
  const hashedAccessCode = input.accessCode ? hashAccessCode(input.accessCode) : null;
  
  const registry = await db.registries.create({
    data: {
      id: `reg_${crypto.randomUUID()}`,
      shopId,
      title,
      slug,
      description: input.description ? sanitizeString(input.description) : null,
      eventType: input.eventType,
      eventDate: input.eventDate || null,
      visibility: input.visibility,
      accessCode: hashedAccessCode,
      customerId: input.customerId || 'anonymous',
      customerEmail: input.customerEmail || '',
      customerFirstName: input.customerFirstName || null,
      customerLastName: input.customerLastName || null,
      customerPhone: input.customerPhone || null,
      updatedAt: new Date(),
    },
  });
  
  return decryptRegistryForDisplay(registry as RegistryWithPII);
}

export async function getRegistry(id: string, shopId?: string) {
  const where: { id: string; shopId?: string } = { id };
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
  
  return registry ? decryptRegistryForDisplay(registry as RegistryWithPII) : null;
}

export async function updateRegistry(input: UpdateRegistryInput) {
  const { id, ...updateData } = input;
  
  const data: Record<string, unknown> = { updatedAt: new Date() };
  
  if (updateData.title) {
    data['title'] = sanitizeString(updateData.title);
    data['slug'] = createSlug(sanitizeString(updateData.title));
  }
  
  if (updateData.description !== undefined) {
    data['description'] = updateData.description ? sanitizeString(updateData.description) : null;
  }
  
  if (updateData.eventType) data['eventType'] = updateData.eventType;
  if (updateData.eventDate !== undefined) data['eventDate'] = updateData.eventDate || null;
  if (updateData.visibility) data['visibility'] = updateData.visibility;
  
  if (updateData.accessCode !== undefined) {
    data['accessCode'] = updateData.accessCode ? hashAccessCode(updateData.accessCode) : null;
  }
  
  if (updateData.customerEmail !== undefined) {
    data['customerEmail'] = updateData.customerEmail || null;
  }
  
  if (updateData.customerFirstName !== undefined) {
    data['customerFirstName'] = updateData.customerFirstName || null;
  }
  
  if (updateData.customerLastName !== undefined) {
    data['customerLastName'] = updateData.customerLastName || null;
  }
  
  if (updateData.customerPhone !== undefined) {
    data['customerPhone'] = updateData.customerPhone || null;
  }
  
  const registry = await db.registries.update({
    where: { id },
    data,
  });
  
  return decryptRegistryForDisplay(registry as RegistryWithPII);
}

export async function deleteRegistry(id: string, shopId: string) {
  const registry = await db.registries.update({
    where: { id, shopId },
    data: {
      status: 'archived',
      updatedAt: new Date(),
    },
  });
  
  return decryptRegistryForDisplay(registry as RegistryWithPII);
}

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
  
  const where: Record<string, unknown> = {
    shopId,
    status,
  };
  
  if (search) {
    where['OR'] = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  if (eventType) {
    where['eventType'] = eventType;
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
  
  return registries.map(registry => decryptRegistryForDisplay(registry as RegistryWithPII));
}

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
      id: `reg_${crypto.randomUUID()}`,
      registryId: data.registryId,
      productId: data.productId,
      productHandle: data.productHandle,
      productTitle: data.productTitle,
      variantTitle: data.variantTitle || null,
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

export async function removeItemFromRegistry(itemId: string, registryId: string) {
  await db.registry_items.delete({
    where: {
      id: itemId,
      registryId
    },
  });
  
  return { success: true };
}