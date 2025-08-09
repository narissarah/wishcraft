import crypto from "crypto";import type { ActionFunctionArgs } from "@remix-run/node";
import { apiResponse } from "~/lib/api-response.server";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { createWebhookHandler } from "~/lib/webhook.server";

/**
 * Products Update Webhook - Consolidated Pattern
 * Updates registry items when products change in Shopify
 */
const handler = createWebhookHandler(
  {
    topic: "products.update",
    requireAuth: true,
    rateLimit: { max: 50, windowMs: 60000 }
  },
  async ({ shop, payload, admin }) => {
    if (!admin) {
      throw new Error("No admin context available");
    }

    log.webhook("PRODUCTS_UPDATE", shop, { verified: true });

    const product = payload;
    
    try {
      // Update all registry items that reference this product
      const updatedItems = await db.registry_items.updateMany({
        where: {
          productId: product.id.toString(),
          registries: { shopId: shop }
        },
        data: {
          productTitle: product.title,
          productImage: product.images?.[0]?.src || product.image?.src,
          price: parseFloat(product.variants?.[0]?.price || '0'),
          compareAtPrice: product.variants?.[0]?.compare_at_price 
            ? parseFloat(product.variants[0].compare_at_price) 
            : null,
          status: product.status === 'active' ? 'active' : 'out_of_stock'
        }
      });

      log.info(`Updated ${updatedItems.count} registry items for product ${product.id}`, {
        productId: product.id,
        productTitle: product.title,
        updatedItems: updatedItems.count,
        shopId: shop
      });

      return apiResponse.success({ received: true, updatedItems: updatedItems.count });
    } catch (error) {
      log.error(`Error updating registry items for product ${product.id}`, error as Error, { 
        productId: product.id,
        shop 
      });
      throw error;
    }
  }
);

export const action = handler;