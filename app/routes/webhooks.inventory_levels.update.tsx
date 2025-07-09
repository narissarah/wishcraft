import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { handleInventoryLevelsUpdate } from "~/lib/inventory-sync.server";
import { notifyInventoryUpdate } from "~/lib/websocket.server";
import { db } from "~/lib/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request,
  );

  if (!admin && topic === "INVENTORY_LEVELS_UPDATE") {
    throw new Response("Unauthorized", { status: 401 });
  }

  console.log(`📦 Received INVENTORY_LEVELS_UPDATE webhook for ${shop}`);

  const inventoryLevel = typeof payload === 'string' ? JSON.parse(payload) : payload;
  
  // Process inventory level updates for gift registry functionality
  try {
    await handleInventoryLevelsUpdate(inventoryLevel, shop);
    
    // Find all registry items that reference this inventory item
    const affectedItems = await db.registryItem.findMany({
      where: {
        productVariantId: inventoryLevel.inventory_item_id,
        registry: {
          shopId: shop
        }
      },
      include: {
        registry: {
          select: {
            id: true,
            shopId: true
          }
        }
      }
    });

    console.log(`📊 Found ${affectedItems.length} registry items affected by inventory update`);

    // Group by registry to send targeted notifications
    const registryGroups = new Map<string, any[]>();
    
    affectedItems.forEach(item => {
      const registryId = item.registry.id;
      if (!registryGroups.has(registryId)) {
        registryGroups.set(registryId, []);
      }
      registryGroups.get(registryId)!.push(item);
    });

    // Send real-time notifications for each affected registry
    const notificationPromises = Array.from(registryGroups.entries()).map(async ([registryId, items]) => {
      const inventoryData = {
        inventoryItemId: inventoryLevel.inventory_item_id,
        locationId: inventoryLevel.location_id,
        available: inventoryLevel.available,
        committed: inventoryLevel.committed,
        incoming: inventoryLevel.incoming,
        onHand: inventoryLevel.on_hand,
        updated_at: inventoryLevel.updated_at,
        affectedProducts: items.map(item => ({
          productId: item.productId,
          productTitle: item.productTitle,
          productVariantId: item.productVariantId,
          productVariantTitle: item.productVariantTitle,
          registryItemId: item.id
        }))
      };

      // Send WebSocket notification for real-time updates
      await notifyInventoryUpdate(registryId, inventoryLevel.inventory_item_id, inventoryData);
      
      // Check for low stock alerts
      if (inventoryLevel.available <= 5 && inventoryLevel.available > 0) {
        await createLowStockAlert(registryId, inventoryLevel, items);
      }

      // Check for out of stock
      if (inventoryLevel.available === 0) {
        await createOutOfStockAlert(registryId, inventoryLevel, items);
      }
    });

    await Promise.all(notificationPromises);

    console.log(`✅ Successfully processed inventory update for ${affectedItems.length} items across ${registryGroups.size} registries`);
  } catch (error) {
    console.error(`❌ Error processing inventory level update webhook:`, error);
    // Don't fail the webhook - log and continue
  }
  
  return new Response(null, { status: 200 });
};

async function createLowStockAlert(registryId: string, inventoryLevel: any, items: any[]) {
  try {
    // Check if alert already exists to avoid duplicates
    const existingAlert = await db.registryAlert.findFirst({
      where: {
        registryId: registryId,
        type: 'low_stock',
        metadata: {
          path: ['inventoryItemId'],
          equals: inventoryLevel.inventory_item_id
        }
      }
    });

    if (!existingAlert) {
      await db.registryAlert.create({
        data: {
          registryId: registryId,
          type: 'low_stock',
          title: 'Low Stock Alert',
          message: `${items[0]?.productTitle} is running low (${inventoryLevel.available} remaining)`,
          severity: 'warning',
          isRead: false,
          metadata: {
            inventoryItemId: inventoryLevel.inventory_item_id,
            available: inventoryLevel.available,
            affectedItems: items.map(item => item.id)
          }
        }
      });

      console.log(`⚠️ Created low stock alert for registry ${registryId}`);
    }
  } catch (error) {
    console.error('Failed to create low stock alert:', error);
  }
}

async function createOutOfStockAlert(registryId: string, inventoryLevel: any, items: any[]) {
  try {
    // Check if alert already exists to avoid duplicates
    const existingAlert = await db.registryAlert.findFirst({
      where: {
        registryId: registryId,
        type: 'out_of_stock',
        metadata: {
          path: ['inventoryItemId'],
          equals: inventoryLevel.inventory_item_id
        }
      }
    });

    if (!existingAlert) {
      await db.registryAlert.create({
        data: {
          registryId: registryId,
          type: 'out_of_stock',
          title: 'Out of Stock Alert',
          message: `${items[0]?.productTitle} is now out of stock`,
          severity: 'critical',
          isRead: false,
          metadata: {
            inventoryItemId: inventoryLevel.inventory_item_id,
            available: inventoryLevel.available,
            affectedItems: items.map(item => item.id)
          }
        }
      });

      // Update registry items status
      await db.registryItem.updateMany({
        where: {
          registryId: registryId,
          productVariantId: inventoryLevel.inventory_item_id
        },
        data: {
          status: 'unavailable',
          unavailableReason: 'out_of_stock'
        }
      });

      console.log(`🚨 Created out of stock alert for registry ${registryId}`);
    }
  } catch (error) {
    console.error('Failed to create out of stock alert:', error);
  }
}