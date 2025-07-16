import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { verifyWebhookRequest, logWebhookEvent, validateWebhookTopic, checkWebhookRateLimit } from "~/lib/webhook-security.server";
import { parseWebhookPayload, handleWebhookResponse } from "~/lib/webhook-utils.server";
import { responses } from "~/lib/response-utils.server";
import { AuditLogger } from "~/lib/audit-logger.server";
import { WebhookSchemas } from "~/lib/validation-unified.server";
import { encryptGiftMessage, validateGiftMessage, sanitizeGiftMessage, logGiftMessageOperation } from "~/lib/encryption.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // Verify HMAC signature first
  const verification = await verifyWebhookRequest(request.clone());
  
  if (!verification.isValid) {
    await logWebhookEvent("ORDERS_CREATE", verification.shop, null, false, "Invalid HMAC signature");
    return responses.unauthorized("Invalid HMAC signature");
  }

  // Validate webhook topic
  if (!validateWebhookTopic(verification.topic, "ORDERS_CREATE")) {
    await logWebhookEvent("ORDERS_CREATE", verification.shop, null, false, "Invalid topic");
    return responses.badRequest("Invalid topic");
  }

  // Rate limiting
  if (!checkWebhookRateLimit(verification.shop, 20, 60000)) {
    await logWebhookEvent("ORDERS_CREATE", verification.shop, null, false, "Rate limit exceeded");
    return responses.tooManyRequests("Rate limit exceeded");
  }

  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request,
  );

  if (!admin && topic === "ORDERS_CREATE") {
    await logWebhookEvent("ORDERS_CREATE", shop, payload, false, "No admin context");
    return responses.unauthorized("No admin context");
  }

  log.webhook("ORDERS_CREATE", shop, { verified: true });

  const order = parseWebhookPayload(payload);
  
  // Validate webhook payload structure
  const orderValidation = WebhookSchemas.orderCreate.safeParse(order);
  if (!orderValidation.success) {
    log.error("Invalid order webhook payload", orderValidation.error);
    await logWebhookEvent("ORDERS_CREATE", shop, payload, false, "Invalid payload structure");
    return responses.ok(); // Still return 200 to prevent retries
  }
  
  const validatedOrder = orderValidation.data;
  
  try {
    // Process order items that might be registry purchases
    for (const item of validatedOrder.line_items || []) {
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
        const purchaserEmail = validatedOrder.email || validatedOrder.customer?.email || 'anonymous';
        
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
                orderId: validatedOrder.id,
                error: validation.error,
                shopDomain: verification.shop
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logGiftMessageOperation('encrypt', purchaserEmail, registryId, false, errorMessage);
            log.error('Failed to encrypt gift message', {
              orderId: validatedOrder.id,
              error: errorMessage,
              shopDomain: verification.shop
            });
          }
        }
        
        // Create purchase record with encrypted gift message
        const purchase = await db.registryPurchase.create({
          data: {
            registryId,
            productId: item.product_id?.toString() || '',
            variantId: item.variant_id?.toString(),
            quantity: item.quantity || 1,
            unitPrice: parseFloat(item.price) || 0,
            totalAmount: (parseFloat(item.price) || 0) * (item.quantity || 1),
            currencyCode: validatedOrder.currency || 'USD',
            orderId: validatedOrder.id.toString(),
            orderName: validatedOrder.name,
            purchaserEmail: purchaserEmail,
            purchaserName: validatedOrder.customer?.first_name && validatedOrder.customer?.last_name
              ? `${validatedOrder.customer.first_name} ${validatedOrder.customer.last_name}`
              : validatedOrder.customer?.first_name || 'Anonymous',
            giftMessage: encryptedGiftMessage,
            status: 'confirmed'
          }
        });

        // Update registry purchased value
        const itemPrice = parseFloat(item.price) * item.quantity;
        await db.registry.update({
          where: { id: registryId },
          data: {
            purchasedValue: {
              increment: itemPrice
            }
          }
        });

        // Log the purchase
        await AuditLogger.log({
          action: 'registry_purchase',
          resource: 'order',
          resourceId: validatedOrder.id.toString(),
          shopId: shop,
          metadata: {
            registryId,
            purchaseId: purchase.id,
            itemTitle: item.title,
            quantity: item.quantity,
            amount: itemPrice,
            purchaserEmail: purchase.purchaserEmail
          }
        });

        log.info(`Recorded registry purchase for registry ${registryId}`, {
          registryId,
          purchaseId: purchase.id,
          orderId: validatedOrder.id.toString(),
          amount: itemPrice
        });
      }
    }

    await logWebhookEvent("ORDERS_CREATE", shop, payload, true);
    return responses.ok();
  } catch (error) {
    log.error(`Error processing order webhook for ${shop}`, error as Error, { 
      shop,
      orderId: validatedOrder.id?.toString() 
    });
    await logWebhookEvent("ORDERS_CREATE", shop, payload, false, error instanceof Error ? error.message : "Unknown error");
    
    // Still return 200 to prevent webhook retry storms
    return responses.ok();
  }
};