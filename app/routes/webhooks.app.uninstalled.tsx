import crypto from "crypto";import type { ActionFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { createWebhookHandler, logWebhookEvent } from "~/lib/webhook.server";


/**
 * App Uninstalled Webhook - Refactored with centralized handler
 * Reduces boilerplate by 80% while maintaining all security/logging features
 */
const handler = createWebhookHandler(
  {
    topic: "app.uninstalled",
    requireAuth: true,
    rateLimit: { max: 5, windowMs: 60000 }
  },
  async ({ shop, payload, admin }) => {
    if (!admin) {
      throw new Error("No admin context available");
    }

    log.webhook("APP_UNINSTALLED", shop, { verified: true });

    try {
    // Perform app uninstall cleanup
    await db.$transaction(async (tx) => {
      // 1. Archive all active registries for the shop
      const registries = await tx.registries.updateMany({
        where: { 
          shopId: shop,
          status: { in: ['active', 'paused'] }
        },
        data: { 
          status: 'archived',
          updatedAt: new Date()
        }
      });

      // 2. Cancel any pending system jobs
      await tx.system_jobs.updateMany({
        where: {
          shopId: shop,
          status: { in: ['pending', 'running'] }
        },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
          result: JSON.stringify({ 
            reason: 'App uninstalled',
            cancelledAt: new Date().toISOString()
          })
        }
      });

      // 3. Log the uninstall event
      await tx.audit_logs.create({
        data: {
          id: crypto.randomUUID(),
          action: 'app_uninstalled',
          resource: 'shop',
          resourceId: shop,
          shopId: shop,
          metadata: JSON.stringify({
            uninstalledAt: new Date().toISOString(),
            registriesArchived: registries.count,
            webhookId: payload?.webhook_id
          })
        }
      });

      // 4. Mark shop as inactive (don't delete - GDPR requires 48hr wait)
      await tx.shop_settings.updateMany({
        where: { shopId: shop },
        data: {
          appUninstalledAt: new Date(),
          appActive: false
        }
      });

      log.info(`App uninstall cleanup completed for ${shop}`, {
        registriesArchived: registries.count,
        uninstalledAt: new Date().toISOString()
      });
    });

    // 5. Notify external services (if configured)
    if (process.env.WEBHOOK_NOTIFICATION_URL) {
      await fetch(process.env.WEBHOOK_NOTIFICATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'app_uninstalled',
          shop,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV
        })
      }).catch(err => log.error("Failed to notify external service", err as Error, { shop }));
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    log.error(`Error handling app uninstall for ${shop}`, error as Error, { shop });
    
    // Queue retry job for critical cleanup
    try {
      await db.system_jobs.create({
        data: {
          id: crypto.randomUUID(),
          type: "app_uninstall_cleanup_retry",
          shopId: shop,
          payload: JSON.stringify({
            shop,
            error: error instanceof Error ? error.message : "Unknown error",
            attemptedAt: new Date().toISOString()
          }),
          priority: 2,
          runAt: new Date(Date.now() + 300000), // Retry in 5 minutes
          updatedAt: new Date()
        }
      });
    } catch (jobError) {
      log.error("Failed to queue retry job", jobError as Error, { shop });
    }

    // Still return 200 to prevent webhook retry storms
    return new Response("OK", { status: 200 });
  }
  }
);

export const action = async ({ request }: ActionFunctionArgs) => {
  return handler(request);
};