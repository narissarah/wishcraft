import crypto from "crypto";import type { ActionFunctionArgs } from "@remix-run/node";
import { apiResponse } from "~/lib/api-response.server";
import { createWebhookHandler } from "~/lib/webhook.server";
import { log } from "~/lib/logger.server";
import { db } from "~/lib/db.server";

/**
 * Inventory Levels Update Webhook - Consolidated Pattern
 */
const handler = createWebhookHandler(
  {
    topic: "inventory_levels.update",
    requireAuth: true,
    rateLimit: { max: 100, windowMs: 60000 }
  },
  async ({ shop, payload, admin }) => {
    if (!admin) {
      throw new Error("No admin context available");
    }

    const inventoryLevel = payload;
    
    log.webhook("INVENTORY_LEVELS_UPDATE", shop, { verified: true });

    if (inventoryLevel.inventory_item_id) {
      await db.registry_items.updateMany({
        where: {
          registries: {
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

    return apiResponse.success({ received: true });
  }
);

export const action = handler;