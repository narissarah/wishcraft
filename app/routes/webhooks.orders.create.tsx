/**
 * Simplified Orders Create Webhook
 * Tracks registry purchases without complex gift message processing
 */

import crypto from "crypto";
import type { ActionFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { createWebhookHandler } from "~/lib/webhook.server";
import { encrypt } from "~/lib/crypto.server";
import { sanitizeString } from "~/lib/validation.server";

export const action = createWebhookHandler(
  { topic: "orders.create", requireAuth: false },
  async ({ shop, payload }) => {
  log.info("Orders Create Webhook", { shop, orderId: payload.id });

  const order = payload;
  
  // Process each line item for registry purchases
  for (const item of order.line_items || []) {
    // Check if this is a registry purchase
    const registryId = item.properties?.find((p: any) => p.name === '_registry_id')?.value;
    
    if (!registryId) continue;

    // Find registry item
    const registryItem = await db.registry_items.findUnique({
      where: { id: registryId },
      include: { registries: true }
    });

    if (!registryItem) {
      log.warn("Registry item not found", { registryId, orderId: order.id });
      continue;
    }

    // Extract gift message if present
    const giftMessageProperty = item.properties?.find((p: any) => 
      p.name.toLowerCase().includes('gift') || p.name.toLowerCase().includes('message')
    );
    const giftMessage = giftMessageProperty?.value;

    // Sanitize gift message if provided
    let sanitizedGiftMessage: string | null = null;
    if (giftMessage && giftMessage.trim()) {
      sanitizedGiftMessage = sanitizeString(giftMessage);
    }

    // Create purchase record
    const unitPrice = parseFloat(item.price || '0');
    await db.registry_purchases.create({
      data: {
        id: crypto.randomUUID(),
        registryItemId: registryItem.id,
        orderId: order.id.toString(),
        lineItemId: item.id.toString(),
        quantity: item.quantity,
        unitPrice,
        totalAmount: unitPrice * item.quantity,
        currencyCode: order.currency || 'USD',
        purchaserName: order.customer ? 
          `${order.customer.first_name} ${order.customer.last_name}` : 
          order.billing_address?.name || 'Anonymous',
        purchaserEmail: order.email || order.customer?.email,
        giftMessage: sanitizedGiftMessage,
        updatedAt: new Date(),
      }
    });

    // Update registry item purchased count
    await db.registry_items.update({
      where: { id: registryItem.id },
      data: {
        quantityPurchased: {
          increment: item.quantity
        }
      }
    });

    log.info("Registry purchase processed", {
      registryId: registryItem.id,
      quantity: item.quantity,
      orderId: order.id
    });
  }
  }
);