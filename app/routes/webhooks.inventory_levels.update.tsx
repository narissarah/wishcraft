import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
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
    // Find all registry items that might be affected by this inventory update
    const affectedItems = await db.registryItem.findMany({
      where: {
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

    // Update inventory quantities for affected items if we can match them
    if (inventoryLevel.inventory_item_id) {
      await db.registryItem.updateMany({
        where: {
          registry: {
            shopId: shop
          },
          inventoryTracked: true
        },
        data: {
          inventoryQuantity: inventoryLevel.available,
          status: inventoryLevel.available === 0 ? 'unavailable' : 'active'
        }
      });
    }

    // Log the inventory update
    await db.auditLog.create({
      data: {
        action: 'inventory_updated',
        resource: 'inventory',
        resourceId: inventoryLevel.inventory_item_id,
        shopId: shop,
        metadata: JSON.stringify({
          locationId: inventoryLevel.location_id,
          available: inventoryLevel.available,
          onHand: inventoryLevel.on_hand,
          affectedItemsCount: affectedItems.length
        })
      }
    });

    console.log(`✅ Successfully processed inventory update for ${affectedItems.length} items`);
  } catch (error) {
    console.error(`❌ Error processing inventory level update webhook:`, error);
    // Don't fail the webhook - log and continue
  }
  
  return new Response(null, { status: 200 });
};