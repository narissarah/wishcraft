import crypto from "crypto";
import type { ActionFunctionArgs } from "@remix-run/node";
import { apiResponse } from "~/lib/api-response.server";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { createWebhookHandler } from "~/lib/webhook.server";
import { encryptGiftMessage, validateGiftMessage, sanitizeGiftMessage, logGiftMessageOperation } from "~/lib/crypto.server";
import { withDatabaseErrorHandling, withErrorHandling } from "~/lib/error-handler.server";
import { BUSINESS_RULES } from "~/lib/constants.server";

/**
 * Orders Create Webhook - Consolidated Pattern
 * Tracks registry purchases and processes gift messages
 */
const handler = createWebhookHandler(
  {
    topic: "orders.create",
    requireAuth: true,
    rateLimit: { max: 20, windowMs: 60000 }
  },
  async ({ shop, payload, admin }) => {
    if (!admin) {
      throw new Error("No admin context available");
    }

    log.webhook("ORDERS_CREATE", shop, { verified: true });

    const order = payload;
    
    try {
      // Process order items that might be registry purchases
      for (const item of order.line_items || []) {
        // Check if this is a registry purchase via line item properties
        const registryId = item.properties?.find((p: any) => p.name === '_registry_id')?.value;
        
        if (registryId) {
          // Extract gift message from line item properties
          const giftMessageProperty = item.properties?.find((p: any) => 
            ['_gift_message', 'gift_message', 'Gift Message', 'message', 'note', 'personal_message'].includes(p.name)
          );
          const giftMessage = giftMessageProperty?.value;
          
          // Process gift message if present
          let encryptedGiftMessage = null;
          const purchaserEmail = order.email || order.customer?.email || 'anonymous';
          
          if (giftMessage && giftMessage.trim()) {
            try {
              // Validate gift message content
              const validation = validateGiftMessage(giftMessage);
              if (validation.isValid) {
                // Sanitize and encrypt gift message
                const sanitizedMessage = sanitizeGiftMessage(giftMessage);
                encryptedGiftMessage = encryptGiftMessage(sanitizedMessage, purchaserEmail, registryId);
                
                logGiftMessageOperation('encrypt', purchaserEmail, registryId, true);
              } else {
                logGiftMessageOperation('validate', purchaserEmail, registryId, false, validation.error);
                log.warn('Invalid gift message in order', {
                  orderId: order.id,
                  error: validation.error,
                  shopDomain: shop
                });
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              logGiftMessageOperation('encrypt', purchaserEmail, registryId, false, errorMessage);
              log.error('Failed to encrypt gift message', {
                orderId: order.id,
                error: errorMessage,
                shopDomain: shop
              });
            }
          }
          
          // Create purchase record with encrypted gift message
          const purchase = await db.registry_purchases.create({
            data: {
              id: crypto.randomUUID(),
              registryItemId: item.id || '',
              quantity: item.quantity || 1,
              unitPrice: parseFloat(item.price) || 0,
              totalAmount: (parseFloat(item.price) || 0) * (item.quantity || 1),
              currencyCode: order.currency || 'USD',
              orderId: order.id.toString(),
              orderName: order.name,
              purchaserEmail: purchaserEmail,
              purchaserName: order.customer?.first_name && order.customer?.last_name
                ? `${order.customer.first_name} ${order.customer.last_name}`
                : order.customer?.first_name || 'Anonymous',
              updatedAt: new Date(),
              giftMessage: encryptedGiftMessage,
              status: 'confirmed'
            }
          });

          // Update registry purchased value
          const itemPrice = parseFloat(item.price) * item.quantity;
          await db.registries.update({
            where: { id: registryId },
            data: {
              purchasedValue: {
                increment: itemPrice
              }
            }
          });

          log.info('Registry purchase recorded', {
            registryId,
            purchaseId: purchase.id,
            orderId: order.id.toString(),
            amount: itemPrice,
            shopId: shop
          });
        }
      }

      return apiResponse.success({ received: true });
    } catch (error) {
      log.error(`Error processing order webhook for ${shop}`, error as Error, { 
        shop,
        orderId: order.id?.toString() 
      });
      throw error;
    }
  }
);

export const action = handler;