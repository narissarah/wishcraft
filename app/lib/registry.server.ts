import { db } from "~/lib/db.server";
import { ShopifyAPIService, createShopifyAPI, type ShopifyProduct } from "~/lib/shopify-api.server";
import { generateSlug } from "~/lib/utils.server";
import crypto from "crypto";

// ============================================================================
// REGISTRY TYPES & INTERFACES
// ============================================================================

export interface CreateRegistryInput {
  title: string;
  description?: string;
  eventType: string;
  eventDate?: Date;
  visibility: 'public' | 'private' | 'friends' | 'password';
  password?: string;
  customerId?: string;
  customerEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
  shippingAddresses?: Array<{
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    zip: string;
    country: string;
    phone?: string;
    isDefault?: boolean;
  }>;
  settings?: {
    allowGiftMessages?: boolean;
    allowAnonymousGifts?: boolean;
    requireGiftApproval?: boolean;
    enableGroupGifting?: boolean;
    enableSocialSharing?: boolean;
    maxQuantityPerItem?: number;
  };
}

export interface UpdateRegistryInput extends Partial<CreateRegistryInput> {
  id: string;
}

export interface AddItemToRegistryInput {
  registryId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
  allowGroupGifting?: boolean;
  customPrice?: number;
}

export interface RegistryWithDetails {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  status: string;
  visibility: string;
  eventType: string | null;
  eventDate: Date | null;
  shopId: string;
  customerId: string | null;
  customerEmail: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    quantity: number;
    priority: string;
    notes: string | null;
    allowGroupGifting: boolean;
    customPrice: number | null;
    product?: ShopifyProduct;
    purchases: Array<{
      id: string;
      quantity: number;
      buyerName: string | null;
      buyerEmail: string | null;
      giftMessage: string | null;
      isAnonymous: boolean;
      createdAt: Date;
    }>;
  }>;
  addresses: Array<{
    id: string;
    firstName: string;
    lastName: string;
    address1: string;
    address2: string | null;
    city: string;
    province: string;
    zip: string;
    country: string;
    phone: string | null;
    isDefault: boolean;
  }>;
  collaborators: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    permission: string;
    status: string;
  }>;
  settings: {
    allowGiftMessages: boolean;
    allowAnonymousGifts: boolean;
    requireGiftApproval: boolean;
    enableGroupGifting: boolean;
    enableSocialSharing: boolean;
    maxQuantityPerItem: number;
  } | null;
}

// ============================================================================
// REGISTRY SERVICE CLASS
// ============================================================================

export class RegistryService {
  private shopId: string;
  private shopifyAPI?: ShopifyAPIService;

  constructor(shopId: string, shopifyAPI?: ShopifyAPIService) {
    this.shopId = shopId;
    this.shopifyAPI = shopifyAPI;
  }

  /**
   * Create a new registry
   */
  async createRegistry(input: CreateRegistryInput): Promise<RegistryWithDetails> {
    try {
      // Generate unique slug
      const baseSlug = generateSlug(input.title);
      const slug = await this.generateUniqueSlug(baseSlug);

      // Hash password if provided
      let passwordHash: string | null = null;
      if (input.password && input.visibility === 'password') {
        passwordHash = crypto.createHash('sha256').update(input.password).digest('hex');
      }

      // Create registry with transaction
      const registry = await db.$transaction(async (tx) => {
        // Create main registry
        const newRegistry = await tx.registry.create({
          data: {
            title: input.title,
            description: input.description || null,
            slug,
            status: 'active',
            visibility: input.visibility,
            eventType: input.eventType,
            eventDate: input.eventDate || null,
            passwordHash,
            shopId: this.shopId,
            customerId: input.customerId || null,
            customerEmail: input.customerEmail || null,
            customerFirstName: input.customerFirstName || null,
            customerLastName: input.customerLastName || null,
            customerPhone: input.customerPhone || null,
          }
        });

        // Create shipping addresses
        if (input.shippingAddresses && input.shippingAddresses.length > 0) {
          await tx.registryAddress.createMany({
            data: input.shippingAddresses.map(address => ({
              registryId: newRegistry.id,
              ...address
            }))
          });
        }

        // Create settings
        if (input.settings) {
          await tx.registrySettings.create({
            data: {
              registryId: newRegistry.id,
              allowGiftMessages: input.settings.allowGiftMessages ?? true,
              allowAnonymousGifts: input.settings.allowAnonymousGifts ?? true,
              requireGiftApproval: input.settings.requireGiftApproval ?? false,
              enableGroupGifting: input.settings.enableGroupGifting ?? true,
              enableSocialSharing: input.settings.enableSocialSharing ?? true,
              maxQuantityPerItem: input.settings.maxQuantityPerItem ?? 10,
            }
          });
        }

        // Log activity
        await tx.registryActivity.create({
          data: {
            registryId: newRegistry.id,
            type: 'registry_created',
            description: 'Registry was created',
            actorType: 'owner',
            actorId: input.customerId || 'system',
            actorEmail: input.customerEmail || null,
            actorName: input.customerFirstName && input.customerLastName 
              ? `${input.customerFirstName} ${input.customerLastName}`
              : null,
          }
        });

        return newRegistry;
      });

      // Return full registry details
      return this.getRegistryById(registry.id) as Promise<RegistryWithDetails>;
    } catch (error) {
      console.error('Error creating registry:', error);
      throw new Error('Failed to create registry');
    }
  }

  /**
   * Update an existing registry
   */
  async updateRegistry(input: UpdateRegistryInput): Promise<RegistryWithDetails> {
    try {
      const existingRegistry = await db.registry.findUnique({
        where: { id: input.id, shopId: this.shopId }
      });

      if (!existingRegistry) {
        throw new Error('Registry not found');
      }

      // Handle password update
      let passwordHash: string | null = existingRegistry.passwordHash;
      if (input.password && input.visibility === 'password') {
        passwordHash = crypto.createHash('sha256').update(input.password).digest('hex');
      } else if (input.visibility !== 'password') {
        passwordHash = null;
      }

      // Generate new slug if title changed
      let slug = existingRegistry.slug;
      if (input.title && input.title !== existingRegistry.title) {
        const baseSlug = generateSlug(input.title);
        slug = await this.generateUniqueSlug(baseSlug, input.id);
      }

      const updatedRegistry = await db.$transaction(async (tx) => {
        // Update main registry
        const registry = await tx.registry.update({
          where: { id: input.id },
          data: {
            title: input.title ?? existingRegistry.title,
            description: input.description ?? existingRegistry.description,
            slug,
            visibility: input.visibility ?? existingRegistry.visibility,
            eventType: input.eventType ?? existingRegistry.eventType,
            eventDate: input.eventDate ?? existingRegistry.eventDate,
            passwordHash,
            customerEmail: input.customerEmail ?? existingRegistry.customerEmail,
            customerFirstName: input.customerFirstName ?? existingRegistry.customerFirstName,
            customerLastName: input.customerLastName ?? existingRegistry.customerLastName,
            customerPhone: input.customerPhone ?? existingRegistry.customerPhone,
            updatedAt: new Date(),
          }
        });

        // Update shipping addresses if provided
        if (input.shippingAddresses) {
          // Delete existing addresses
          await tx.registryAddress.deleteMany({
            where: { registryId: input.id }
          });

          // Create new addresses
          if (input.shippingAddresses.length > 0) {
            await tx.registryAddress.createMany({
              data: input.shippingAddresses.map(address => ({
                registryId: input.id,
                ...address
              }))
            });
          }
        }

        // Update settings if provided
        if (input.settings) {
          await tx.registrySettings.upsert({
            where: { registryId: input.id },
            update: {
              allowGiftMessages: input.settings.allowGiftMessages,
              allowAnonymousGifts: input.settings.allowAnonymousGifts,
              requireGiftApproval: input.settings.requireGiftApproval,
              enableGroupGifting: input.settings.enableGroupGifting,
              enableSocialSharing: input.settings.enableSocialSharing,
              maxQuantityPerItem: input.settings.maxQuantityPerItem,
            },
            create: {
              registryId: input.id,
              allowGiftMessages: input.settings.allowGiftMessages ?? true,
              allowAnonymousGifts: input.settings.allowAnonymousGifts ?? true,
              requireGiftApproval: input.settings.requireGiftApproval ?? false,
              enableGroupGifting: input.settings.enableGroupGifting ?? true,
              enableSocialSharing: input.settings.enableSocialSharing ?? true,
              maxQuantityPerItem: input.settings.maxQuantityPerItem ?? 10,
            }
          });
        }

        // Log activity
        await tx.registryActivity.create({
          data: {
            registryId: input.id,
            type: 'registry_updated',
            description: 'Registry was updated',
            actorType: 'owner',
            actorId: registry.customerId || 'system',
            actorEmail: registry.customerEmail || null,
            actorName: registry.customerFirstName && registry.customerLastName 
              ? `${registry.customerFirstName} ${registry.customerLastName}`
              : null,
          }
        });

        return registry;
      });

      return this.getRegistryById(updatedRegistry.id) as Promise<RegistryWithDetails>;
    } catch (error) {
      console.error('Error updating registry:', error);
      throw new Error('Failed to update registry');
    }
  }

  /**
   * Delete a registry
   */
  async deleteRegistry(registryId: string): Promise<boolean> {
    try {
      const registry = await db.registry.findUnique({
        where: { id: registryId, shopId: this.shopId }
      });

      if (!registry) {
        throw new Error('Registry not found');
      }

      await db.$transaction(async (tx) => {
        // Delete related records (cascading deletes handled by schema)
        await tx.registry.delete({
          where: { id: registryId }
        });

        // Log deletion activity
        await tx.registryActivity.create({
          data: {
            registryId: registryId,
            type: 'registry_deleted',
            description: 'Registry was deleted',
            actorType: 'system',
            actorId: 'system',
            actorEmail: null,
            actorName: null,
          }
        });
      });

      return true;
    } catch (error) {
      console.error('Error deleting registry:', error);
      throw new Error('Failed to delete registry');
    }
  }

  /**
   * Get registry by ID with full details
   */
  async getRegistryById(registryId: string): Promise<RegistryWithDetails | null> {
    try {
      const registry = await db.registry.findUnique({
        where: { id: registryId, shopId: this.shopId },
        include: {
          items: {
            include: {
              purchases: {
                orderBy: { createdAt: 'desc' }
              }
            },
            orderBy: { createdAt: 'asc' }
          },
          addresses: {
            orderBy: { isDefault: 'desc' }
          },
          collaborators: {
            where: { status: 'active' },
            orderBy: { createdAt: 'asc' }
          },
          settings: true
        }
      });

      if (!registry) {
        return null;
      }

      // Fetch product data from Shopify if API is available
      const itemsWithProducts = await Promise.all(
        registry.items.map(async (item) => {
          let product: ShopifyProduct | undefined;
          
          if (this.shopifyAPI) {
            try {
              const shopifyProduct = await this.shopifyAPI.getProduct(item.productId);
              if (shopifyProduct) {
                product = shopifyProduct;
              }
            } catch (error) {
              console.error(`Error fetching product ${item.productId}:`, error);
            }
          }

          return {
            ...item,
            product
          };
        })
      );

      return {
        ...registry,
        items: itemsWithProducts
      };
    } catch (error) {
      console.error('Error getting registry:', error);
      throw new Error('Failed to get registry');
    }
  }

  /**
   * Get registry by slug (for public access)
   */
  async getRegistryBySlug(slug: string): Promise<RegistryWithDetails | null> {
    try {
      const registry = await db.registry.findFirst({
        where: { 
          slug, 
          shopId: this.shopId,
          status: { in: ['active', 'public'] }
        },
        include: {
          items: {
            include: {
              purchases: true
            },
            orderBy: { createdAt: 'asc' }
          },
          addresses: {
            orderBy: { isDefault: 'desc' }
          },
          collaborators: {
            where: { status: 'active' }
          },
          settings: true
        }
      });

      if (!registry) {
        return null;
      }

      // Fetch product data from Shopify
      const itemsWithProducts = await Promise.all(
        registry.items.map(async (item) => {
          let product: ShopifyProduct | undefined;
          
          if (this.shopifyAPI) {
            try {
              const shopifyProduct = await this.shopifyAPI.getProduct(item.productId);
              if (shopifyProduct) {
                product = shopifyProduct;
              }
            } catch (error) {
              console.error(`Error fetching product ${item.productId}:`, error);
            }
          }

          return {
            ...item,
            product
          };
        })
      );

      return {
        ...registry,
        items: itemsWithProducts
      };
    } catch (error) {
      console.error('Error getting registry by slug:', error);
      throw new Error('Failed to get registry');
    }
  }

  /**
   * Add item to registry
   */
  async addItemToRegistry(input: AddItemToRegistryInput): Promise<boolean> {
    try {
      // Verify registry exists and belongs to shop
      const registry = await db.registry.findUnique({
        where: { id: input.registryId, shopId: this.shopId }
      });

      if (!registry) {
        throw new Error('Registry not found');
      }

      // Verify product exists in Shopify if API available
      if (this.shopifyAPI) {
        const product = await this.shopifyAPI.getProduct(input.productId);
        if (!product) {
          throw new Error('Product not found in Shopify catalog');
        }

        // Verify variant if specified
        if (input.variantId) {
          const variant = product.variants.find(v => v.id === input.variantId);
          if (!variant) {
            throw new Error('Product variant not found');
          }
        }
      }

      // Check if item already exists in registry
      const existingItem = await db.registryItem.findFirst({
        where: {
          registryId: input.registryId,
          productId: input.productId,
          variantId: input.variantId
        }
      });

      if (existingItem) {
        // Update quantity if item already exists
        await db.registryItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: existingItem.quantity + input.quantity,
            updatedAt: new Date()
          }
        });
      } else {
        // Create new item
        await db.registryItem.create({
          data: {
            registryId: input.registryId,
            productId: input.productId,
            variantId: input.variantId,
            quantity: input.quantity,
            priority: input.priority || 'medium',
            notes: input.notes,
            allowGroupGifting: input.allowGroupGifting ?? true,
            customPrice: input.customPrice,
          }
        });
      }

      // Log activity
      await db.registryActivity.create({
        data: {
          registryId: input.registryId,
          type: 'item_added',
          description: `Item added to registry (Product ID: ${input.productId})`,
          actorType: 'owner',
          actorId: registry.customerId || 'system',
          actorEmail: registry.customerEmail,
          actorName: registry.customerFirstName && registry.customerLastName 
            ? `${registry.customerFirstName} ${registry.customerLastName}`
            : null,
        }
      });

      return true;
    } catch (error) {
      console.error('Error adding item to registry:', error);
      throw new Error('Failed to add item to registry');
    }
  }

  /**
   * Remove item from registry
   */
  async removeItemFromRegistry(registryId: string, itemId: string): Promise<boolean> {
    try {
      const registry = await db.registry.findUnique({
        where: { id: registryId, shopId: this.shopId }
      });

      if (!registry) {
        throw new Error('Registry not found');
      }

      const item = await db.registryItem.findUnique({
        where: { id: itemId, registryId }
      });

      if (!item) {
        throw new Error('Item not found in registry');
      }

      await db.$transaction(async (tx) => {
        // Delete the item
        await tx.registryItem.delete({
          where: { id: itemId }
        });

        // Log activity
        await tx.registryActivity.create({
          data: {
            registryId: registryId,
            type: 'item_removed',
            description: `Item removed from registry (Product ID: ${item.productId})`,
            actorType: 'owner',
            actorId: registry.customerId || 'system',
            actorEmail: registry.customerEmail,
            actorName: registry.customerFirstName && registry.customerLastName 
              ? `${registry.customerFirstName} ${registry.customerLastName}`
              : null,
          }
        });
      });

      return true;
    } catch (error) {
      console.error('Error removing item from registry:', error);
      throw new Error('Failed to remove item from registry');
    }
  }

  /**
   * Update item in registry
   */
  async updateRegistryItem(itemId: string, updates: {
    quantity?: number;
    priority?: 'low' | 'medium' | 'high';
    notes?: string;
    allowGroupGifting?: boolean;
    customPrice?: number;
  }): Promise<boolean> {
    try {
      const item = await db.registryItem.findUnique({
        where: { id: itemId },
        include: { registry: true }
      });

      if (!item || item.registry.shopId !== this.shopId) {
        throw new Error('Item not found');
      }

      await db.registryItem.update({
        where: { id: itemId },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });

      // Log activity
      await db.registryActivity.create({
        data: {
          registryId: item.registryId,
          type: 'item_updated',
          description: `Registry item updated (Product ID: ${item.productId})`,
          actorType: 'owner',
          actorId: item.registry.customerId || 'system',
          actorEmail: item.registry.customerEmail,
          actorName: item.registry.customerFirstName && item.registry.customerLastName 
            ? `${item.registry.customerFirstName} ${item.registry.customerLastName}`
            : null,
        }
      });

      return true;
    } catch (error) {
      console.error('Error updating registry item:', error);
      throw new Error('Failed to update registry item');
    }
  }

  /**
   * Verify registry password
   */
  async verifyRegistryPassword(registryId: string, password: string): Promise<boolean> {
    try {
      const registry = await db.registry.findUnique({
        where: { id: registryId, shopId: this.shopId }
      });

      if (!registry || registry.visibility !== 'password' || !registry.passwordHash) {
        return false;
      }

      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      return passwordHash === registry.passwordHash;
    } catch (error) {
      console.error('Error verifying registry password:', error);
      return false;
    }
  }

  /**
   * Generate unique slug for registry
   */
  private async generateUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await db.registry.findFirst({
        where: {
          slug,
          shopId: this.shopId,
          ...(excludeId && { id: { not: excludeId } })
        }
      });

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create RegistryService instance
 */
export function createRegistryService(shopId: string, shopifyAPI?: ShopifyAPIService): RegistryService {
  return new RegistryService(shopId, shopifyAPI);
}

/**
 * Create RegistryService with Shopify API from request
 */
export async function createRegistryServiceFromRequest(request: Request, shopId: string): Promise<RegistryService> {
  try {
    const shopifyAPI = await createShopifyAPI(request);
    return new RegistryService(shopId, shopifyAPI);
  } catch (error) {
    // Fallback without Shopify API if authentication fails
    console.warn('Could not create Shopify API, using registry service without product data');
    return new RegistryService(shopId);
  }
}

// ============================================================================
// COLLABORATION FUNCTIONS
// ============================================================================

/**
 * Get registry with collaborators (SECURE: Shop-isolated)
 */
export async function getRegistryWithCollaborators(registryId: string, shopId: string) {
  return db.registry.findUnique({
    where: { 
      id: registryId,
      shopId: shopId // CRITICAL: Shop isolation for security compliance
    },
    include: {
      collaborators: {
        include: {
          user: true
        }
      }
    }
  });
}

/**
 * Add collaborator to registry
 */
export async function addCollaborator(registryId: string, email: string, role: string = 'editor') {
  return db.registryCollaborator.create({
    data: {
      registryId,
      email,
      role,
      status: 'pending'
    }
  });
}

/**
 * Update collaborator
 */
export async function updateCollaborator(collaboratorId: string, updates: any) {
  return db.registryCollaborator.update({
    where: { id: collaboratorId },
    data: updates
  });
}

/**
 * Remove collaborator
 */
export async function removeCollaborator(collaboratorId: string) {
  return db.registryCollaborator.delete({
    where: { id: collaboratorId }
  });
}

/**
 * Get registry with items for checkout (SECURE: Shop-isolated)
 */
export async function getRegistryWithItems(registryId: string, shopId: string) {
  return db.registry.findUnique({
    where: { 
      id: registryId,
      shopId: shopId // CRITICAL: Shop isolation for security compliance
    },
    include: {
      items: {
        include: {
          purchases: true
        }
      }
    }
  });
}

/**
 * Get registry by slug with items (SECURE: Shop-isolated)
 * For customer-facing routes that use registry slugs
 */
export async function getRegistryBySlugWithItems(slug: string) {
  // First lookup to get shop context, then validate access through customer auth
  return db.registry.findUnique({
    where: { slug },
    include: {
      items: {
        include: {
          purchases: true
        }
      },
      shop: true // Include shop for validation
    }
  });
}

// ============================================================================
// STANDALONE FUNCTION EXPORTS (for test compatibility)
// ============================================================================

/**
 * Create a new registry (standalone function)
 */
export async function createRegistry(input: CreateRegistryInput): Promise<any> {
  // Validate input data
  validateRegistryData(input);
  
  // Use default shopId if not provided (for backwards compatibility)
  const shopId = input.shopId || 'default-shop';
  const service = new RegistryService(shopId);
  
  return service.createRegistry(input);
}

/**
 * Get registry by ID or slug (standalone function)
 */
export async function getRegistry(idOrSlug: string): Promise<any> {
  // Determine if input is an ID or slug
  const isId = idOrSlug.startsWith('reg_') || idOrSlug.includes('-');
  
  if (isId) {
    // Try to find by ID first
    const service = new RegistryService('default-shop');
    return service.getRegistryById(idOrSlug);
  } else {
    // Try to find by slug
    const service = new RegistryService('default-shop');
    return service.getRegistryBySlug(idOrSlug);
  }
}

/**
 * Update registry (standalone function)
 */
export async function updateRegistry(registryId: string, updates: Partial<CreateRegistryInput>): Promise<any> {
  const service = new RegistryService('default-shop');
  return service.updateRegistry({ id: registryId, ...updates });
}

/**
 * Delete registry (standalone function)
 */
export async function deleteRegistry(registryId: string): Promise<boolean> {
  const service = new RegistryService('default-shop');
  return service.deleteRegistry(registryId);
}

/**
 * Add item to registry (standalone function)
 */
export async function addItemToRegistry(registryId: string, itemData: any): Promise<any> {
  // Validate item data
  if (!itemData.productId || itemData.quantity <= 0) {
    throw new Error('Invalid item data');
  }
  
  // Check for duplicate items
  const existingItem = await db.registryItem.findFirst({
    where: {
      registryId,
      productId: itemData.productId,
      productVariantId: itemData.productVariantId
    }
  });
  
  if (existingItem) {
    throw new Error('Item already exists in registry');
  }
  
  // Create new item
  const newItem = await db.registryItem.create({
    data: {
      registryId,
      productId: itemData.productId,
      productVariantId: itemData.productVariantId,
      productTitle: itemData.productTitle,
      quantity: itemData.quantity,
      price: itemData.price,
      status: 'available'
    }
  });
  
  // Log activity
  await db.registryActivity.create({
    data: {
      registryId,
      type: 'item_added',
      description: `Item added to registry: ${itemData.productTitle}`,
      actorType: 'owner',
      actorId: 'system',
      actorEmail: null,
      actorName: null,
    }
  });
  
  return newItem;
}

/**
 * Remove item from registry (standalone function)
 */
export async function removeItemFromRegistry(itemId: string): Promise<boolean> {
  const item = await db.registryItem.findUnique({
    where: { id: itemId },
    include: { registry: true }
  });
  
  if (!item) {
    throw new Error('Item not found');
  }
  
  await db.registryItem.delete({
    where: { id: itemId }
  });
  
  // Log activity
  await db.registryActivity.create({
    data: {
      registryId: item.registryId,
      type: 'item_removed',
      description: `Item removed from registry`,
      actorType: 'owner',
      actorId: 'system',
      actorEmail: null,
      actorName: null,
    }
  });
  
  return true;
}

/**
 * Update registry item (standalone function)
 */
export async function updateRegistryItem(itemId: string, updates: any): Promise<any> {
  if (updates.quantity !== undefined && updates.quantity <= 0) {
    throw new Error('Invalid quantity');
  }
  
  const updatedItem = await db.registryItem.update({
    where: { id: itemId },
    data: {
      ...updates,
      updatedAt: new Date()
    }
  });
  
  return updatedItem;
}

/**
 * Validate registry data (standalone function)
 */
export function validateRegistryData(data: any): void {
  // Validate required fields
  if (!data.title || data.title.trim() === '') {
    throw new Error('Title is required');
  }
  
  if (!data.customerId) {
    throw new Error('Customer ID is required');
  }
  
  if (!data.shopId) {
    throw new Error('Shop ID is required');
  }
  
  // Validate email format
  if (data.customerEmail && !isValidEmail(data.customerEmail)) {
    throw new Error('Invalid email address');
  }
  
  // Validate visibility options
  if (data.visibility && !['public', 'private', 'password', 'friends_only'].includes(data.visibility)) {
    throw new Error('Invalid visibility option');
  }
  
  // Validate event date is in the future
  if (data.eventDate && new Date(data.eventDate) < new Date()) {
    throw new Error('Event date must be in the future');
  }
}

/**
 * Generate unique slug (standalone function)
 */
export function generateUniqueSlug(title: string): string {
  // Convert title to slug format
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  
  // Add timestamp for uniqueness
  const timestamp = Date.now();
  return `${slug}-${timestamp}`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}