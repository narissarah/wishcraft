import crypto from "crypto";
import type { ActionFunctionArgs } from "@remix-run/node";
import { apiResponse } from "~/lib/api-response.server";
import { createWebhookHandler } from "~/lib/webhook.server";
import { log } from "~/lib/logger.server";
import { deleteShopData } from "~/lib/gdpr-simple.server";

/**
 * GDPR Webhook: Shop Data Redaction - Consolidated Pattern
 * Triggered when a shop uninstalls the app - all data must be deleted
 */
const handler = createWebhookHandler(
  {
    topic: "shop.redact",
    requireAuth: false, // GDPR webhooks don't require auth
    rateLimit: { max: 5, windowMs: 60000 }
  },
  async ({ shop, payload }) => {
    log.webhook("SHOP_REDACT", shop, { verified: true });

    try {
      // GDPR: Handle shop data redaction directly
      log.info("GDPR shop data redaction requested", {
        shopId: shop,
        shopDomain: payload.shop_domain,
        requestedAt: new Date().toISOString()
      });

      // Delete all shop data - GDPR Compliance (48 hours after app uninstall)
      const deletionResult = await deleteShopData({
        shopId: shop,
        shopDomain: payload.shop_domain
      });

      log.info("GDPR shop data deletion completed", {
        shopId: shop,
        shopDomain: payload.shop_domain,
        recordsDeleted: deletionResult.recordsDeleted,
        tablesCleared: deletionResult.tablesCleared
      });

      return apiResponse.success({ 
        received: true, 
        processed: true,
        recordsDeleted: deletionResult.recordsDeleted,
        tablesCleared: deletionResult.tablesCleared.length
      });
    } catch (error) {
      log.error("Failed to process GDPR shop redaction request", error as Error, {
        shopId: shop,
        shopDomain: payload.shop_domain
      });
      throw error;
    }
  }
);

export const action = handler;