import { db } from "~/lib/db.server";
import { createShopifyAPI, type ShopifyProduct } from "~/lib/shopify-api.server";
import { authenticate } from "~/shopify.server";

// ============================================================================
// INVENTORY SYNC SERVICE
// ============================================================================

export interface InventoryUpdateData {
  productId: string;
  variantId: string;
  inventoryQuantity: number;
  availableForSale: boolean;
  price?: string;
  compareAtPrice?: string;
}

export interface ProductUpdateData {
  productId: string;
  title?: string;
  handle?: string;
  status?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  images?: Array<{
    id: string;
    url: string;
    altText?: string;
  }>;
}

export class InventorySyncService {
  private shopId: string;

  constructor(shopId: string) {
    this.shopId = shopId;
  }

  /**
   * Sync inventory levels for all registry items
   */
  async syncAllRegistryInventory(): Promise<void> {
    try {
      console.log(`Starting inventory sync for shop ${this.shopId}`);

      // Get all unique product/variant combinations from registries
      const registryItems = await db.registryItem.findMany({
        where: {
          registry: { shopId: this.shopId }
        },
        select: {
          productId: true,
          variantId: true
        },
        distinct: ['productId', 'variantId']
      });

      if (registryItems.length === 0) {
        console.log('No registry items found for inventory sync');
        return;
      }

      // Group by product ID
      const productIds = [...new Set(registryItems.map(item => item.productId))];
      
      // Create a mock admin context for API calls (in production, use stored tokens)
      const mockRequest = new Request('http://localhost:3000');
      try {
        const shopifyAPI = await createShopifyAPI(mockRequest);

        // Process products in batches
        const batchSize = 10;
        for (let i = 0; i < productIds.length; i += batchSize) {
          const batch = productIds.slice(i, i + batchSize);
          await this.syncProductBatch(batch, shopifyAPI);
        }

        // Update sync timestamp
        await db.metafieldSync.upsert({
          where: {
            shopId_namespace_key: {
              shopId: this.shopId,
              namespace: 'wishcraft',
              key: 'last_inventory_sync'
            }
          },
          update: {
            value: new Date().toISOString(),
            updatedAt: new Date()
          },
          create: {
            shopId: this.shopId,
            namespace: 'wishcraft',
            key: 'last_inventory_sync',
            value: new Date().toISOString(),
            type: 'string'
          }
        });

        console.log(`Inventory sync completed for ${productIds.length} products`);
      } catch (apiError) {
        console.error('Shopify API error during sync:', apiError);
        // Continue with cached data
      }
    } catch (error) {
      console.error('Error during inventory sync:', error);
      throw new Error('Failed to sync inventory');
    }
  }

  /**
   * Sync a batch of products
   */
  private async syncProductBatch(productIds: string[], shopifyAPI: any): Promise<void> {
    for (const productId of productIds) {
      try {
        const product = await shopifyAPI.getProduct(productId);
        if (product) {
          await this.updateProductCache(product);
        }
      } catch (error) {
        console.error(`Error syncing product ${productId}:`, error);
        // Continue with next product
      }
    }
  }

  /**
   * Update product cache in database
   */
  async updateProductCache(product: ShopifyProduct): Promise<void> {
    try {
      // Update or create product cache
      await db.productCache.upsert({
        where: {
          shopId_productId: {
            shopId: this.shopId,
            productId: product.id
          }
        },
        update: {
          title: product.title,
          handle: product.handle,
          vendor: product.vendor,
          productType: product.productType,
          status: product.status,
          tags: JSON.stringify(product.tags),
          images: JSON.stringify(product.images),
          priceRange: JSON.stringify(product.priceRange),
          totalInventory: product.totalInventory,
          lastSyncAt: new Date(),
          updatedAt: new Date()
        },
        create: {
          shopId: this.shopId,
          productId: product.id,
          title: product.title,
          handle: product.handle,
          vendor: product.vendor,
          productType: product.productType,
          status: product.status,
          tags: JSON.stringify(product.tags),
          images: JSON.stringify(product.images),
          priceRange: JSON.stringify(product.priceRange),
          totalInventory: product.totalInventory,
          lastSyncAt: new Date()
        }
      });

      // Update variant caches
      for (const variant of product.variants) {
        await db.variantCache.upsert({
          where: {
            shopId_variantId: {
              shopId: this.shopId,
              variantId: variant.id
            }
          },
          update: {
            title: variant.title,
            sku: variant.sku,
            price: parseFloat(variant.price),
            compareAtPrice: variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : null,
            inventoryQuantity: variant.inventoryQuantity,
            availableForSale: variant.availableForSale,
            inventoryPolicy: variant.inventoryPolicy,
            inventoryManagement: variant.inventoryManagement,
            lastSyncAt: new Date(),
            updatedAt: new Date()
          },
          create: {
            shopId: this.shopId,
            variantId: variant.id,
            productId: product.id,
            title: variant.title,
            sku: variant.sku,
            price: parseFloat(variant.price),
            compareAtPrice: variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : null,
            inventoryQuantity: variant.inventoryQuantity,
            availableForSale: variant.availableForSale,
            inventoryPolicy: variant.inventoryPolicy,
            inventoryManagement: variant.inventoryManagement,
            lastSyncAt: new Date()
          }
        });
      }

      console.log(`Updated cache for product ${product.id}`);
    } catch (error) {
      console.error(`Error updating product cache for ${product.id}:`, error);
    }
  }

  /**
   * Handle inventory level webhook update
   */
  async handleInventoryLevelUpdate(inventoryLevelData: any): Promise<void> {
    try {
      const { inventory_item_id, available } = inventoryLevelData;

      // Find variant by inventory item ID (this would need to be tracked)
      // For now, we'll trigger a full sync of related products
      console.log(`Inventory level updated for item ${inventory_item_id}: ${available} available`);

      // Trigger sync for affected registry items
      await this.syncInventoryForItem(inventory_item_id, available);
    } catch (error) {
      console.error('Error handling inventory level update:', error);
    }
  }

  /**
   * Handle product update webhook
   */
  async handleProductUpdate(productData: any): Promise<void> {
    try {
      const productId = productData.id ? `gid://shopify/Product/${productData.id}` : productData.gid;
      
      console.log(`Product updated: ${productId}`);

      // Get fresh product data and update cache
      const mockRequest = new Request('http://localhost:3000');
      try {
        const shopifyAPI = await createShopifyAPI(mockRequest);
        const product = await shopifyAPI.getProduct(productId);
        
        if (product) {
          await this.updateProductCache(product);
          
          // Trigger registry item updates
          await this.updateRegistryItemsForProduct(productId, product);
        }
      } catch (apiError) {
        console.error('Shopify API error during product update:', apiError);
      }
    } catch (error) {
      console.error('Error handling product update:', error);
    }
  }

  /**
   * Update registry items when product changes
   */
  private async updateRegistryItemsForProduct(productId: string, product: ShopifyProduct): Promise<void> {
    try {
      // Find all registry items with this product
      const registryItems = await db.registryItem.findMany({
        where: {
          productId,
          registry: { shopId: this.shopId }
        },
        include: {
          registry: {
            select: { id: true, title: true, customerId: true }
          }
        }
      });

      for (const item of registryItems) {
        // Check if variant still exists and is available
        const variant = product.variants.find(v => v.id === item.variantId);
        
        if (!variant || !variant.availableForSale) {
          // Log activity for unavailable items
          await db.registryActivity.create({
            data: {
              registryId: item.registryId,
              type: 'item_unavailable',
              description: `Item "${product.title}" is no longer available`,
              actorType: 'system',
              actorId: 'inventory_sync',
              actorEmail: null,
              actorName: 'Inventory Sync'
            }
          });
        }

        // Update cached price if different
        if (variant && item.customPrice === null) {
          const newPrice = parseFloat(variant.price);
          if (item.price !== newPrice) {
            await db.registryItem.update({
              where: { id: item.id },
              data: { 
                price: newPrice,
                updatedAt: new Date()
              }
            });

            // Log price change
            await db.registryActivity.create({
              data: {
                registryId: item.registryId,
                type: 'item_price_changed',
                description: `Price updated for "${product.title}"`,
                actorType: 'system',
                actorId: 'inventory_sync',
                actorEmail: null,
                actorName: 'Inventory Sync'
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error updating registry items for product:', error);
    }
  }

  /**
   * Sync inventory for specific inventory item
   */
  private async syncInventoryForItem(inventoryItemId: string, available: number): Promise<void> {
    try {
      // This would require mapping inventory item IDs to variant IDs
      // For now, log the update
      console.log(`Inventory updated: Item ${inventoryItemId} now has ${available} available`);

      // Update variant cache if we can identify the variant
      // This would need additional mapping logic in a real implementation
    } catch (error) {
      console.error('Error syncing inventory for item:', error);
    }
  }

  /**
   * Get cached inventory for registry items
   */
  async getCachedInventoryForRegistry(registryId: string): Promise<Record<string, { available: number; price: number }>> {
    try {
      const registryItems = await db.registryItem.findMany({
        where: {
          registryId,
          registry: { shopId: this.shopId }
        },
        select: {
          productId: true,
          variantId: true
        }
      });

      const inventory: Record<string, { available: number; price: number }> = {};

      for (const item of registryItems) {
        if (item.variantId) {
          const variantCache = await db.variantCache.findUnique({
            where: {
              shopId_variantId: {
                shopId: this.shopId,
                variantId: item.variantId
              }
            }
          });

          if (variantCache) {
            inventory[item.variantId] = {
              available: variantCache.inventoryQuantity,
              price: variantCache.price
            };
          }
        }
      }

      return inventory;
    } catch (error) {
      console.error('Error getting cached inventory:', error);
      return {};
    }
  }

  /**
   * Check if inventory sync is needed
   */
  async needsInventorySync(): Promise<boolean> {
    try {
      const lastSync = await db.metafieldSync.findUnique({
        where: {
          shopId_namespace_key: {
            shopId: this.shopId,
            namespace: 'wishcraft',
            key: 'last_inventory_sync'
          }
        }
      });

      if (!lastSync) {
        return true; // Never synced
      }

      const lastSyncTime = new Date(lastSync.value);
      const now = new Date();
      const hoursSinceSync = (now.getTime() - lastSyncTime.getTime()) / (1000 * 60 * 60);

      // Sync if more than 4 hours old
      return hoursSinceSync > 4;
    } catch (error) {
      console.error('Error checking sync status:', error);
      return true; // Err on the side of syncing
    }
  }
}

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

/**
 * Handle inventory levels update webhook
 */
export async function handleInventoryLevelsUpdate(payload: any, shop: string): Promise<void> {
  try {
    const syncService = new InventorySyncService(shop);
    await syncService.handleInventoryLevelUpdate(payload);
  } catch (error) {
    console.error('Error handling inventory levels update webhook:', error);
  }
}

/**
 * Handle products update webhook
 */
export async function handleProductsUpdate(payload: any, shop: string): Promise<void> {
  try {
    const syncService = new InventorySyncService(shop);
    await syncService.handleProductUpdate(payload);
  } catch (error) {
    console.error('Error handling products update webhook:', error);
  }
}

/**
 * Handle product variants update webhook
 */
export async function handleProductVariantsUpdate(payload: any, shop: string): Promise<void> {
  try {
    const productId = payload.product_id ? `gid://shopify/Product/${payload.product_id}` : null;
    
    if (productId) {
      // Trigger product sync to update all variants
      const syncService = new InventorySyncService(shop);
      await syncService.handleProductUpdate({ id: payload.product_id });
    }
  } catch (error) {
    console.error('Error handling product variants update webhook:', error);
  }
}

// ============================================================================
// BACKGROUND JOBS
// ============================================================================

/**
 * Background job to sync inventory for all shops
 */
export async function syncInventoryForAllShops(): Promise<void> {
  try {
    console.log('Starting inventory sync for all shops');

    // Get all shops that have registries
    const shops = await db.shop.findMany({
      where: {
        registries: {
          some: {}
        }
      },
      select: { id: true }
    });

    for (const shop of shops) {
      try {
        const syncService = new InventorySyncService(shop.id);
        
        if (await syncService.needsInventorySync()) {
          console.log(`Syncing inventory for shop ${shop.id}`);
          await syncService.syncAllRegistryInventory();
        } else {
          console.log(`Skipping sync for shop ${shop.id} - recently synced`);
        }
      } catch (error) {
        console.error(`Error syncing shop ${shop.id}:`, error);
        // Continue with next shop
      }
    }

    console.log('Completed inventory sync for all shops');
  } catch (error) {
    console.error('Error in syncInventoryForAllShops:', error);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create InventorySyncService instance
 */
export function createInventorySyncService(shopId: string): InventorySyncService {
  return new InventorySyncService(shopId);
}

/**
 * Format inventory status for display
 */
export function formatInventoryStatus(inventoryQuantity: number, inventoryPolicy: string): {
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
  message: string;
} {
  if (inventoryQuantity <= 0) {
    return {
      status: 'out-of-stock',
      message: inventoryPolicy === 'continue' ? 'Available on backorder' : 'Out of stock'
    };
  }
  
  if (inventoryQuantity <= 5) {
    return {
      status: 'low-stock',
      message: `Only ${inventoryQuantity} left in stock`
    };
  }
  
  return {
    status: 'in-stock',
    message: `${inventoryQuantity} in stock`
  };
}

/**
 * Check if product/variant is available for registry
 */
export function isAvailableForRegistry(
  availableForSale: boolean,
  inventoryQuantity: number,
  inventoryPolicy: string
): boolean {
  return availableForSale && (inventoryQuantity > 0 || inventoryPolicy === 'continue');
}