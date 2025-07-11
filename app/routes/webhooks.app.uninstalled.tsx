import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { 
  verifyWebhookRequest, 
  logWebhookEvent, 
  validateWebhookTopic,
  checkWebhookRateLimit 
} from "~/lib/webhook-security.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // Verify HMAC signature first
  const verification = await verifyWebhookRequest(request.clone());
  
  if (!verification.isValid) {
    await logWebhookEvent("APP_UNINSTALLED", verification.shop ?? "unknown", null, false, "Invalid HMAC signature");
    throw new Response("Unauthorized - Invalid HMAC signature", { status: 401 });
  }

  // Validate webhook topic
  if (!validateWebhookTopic(verification.topic, "APP_UNINSTALLED")) {
    await logWebhookEvent("APP_UNINSTALLED", verification.shop ?? "unknown", null, false, "Invalid topic");
    throw new Response("Bad Request - Invalid topic", { status: 400 });
  }

  // Rate limiting
  if (!checkWebhookRateLimit(verification.shop ?? "unknown", 5, 60000)) {
    await logWebhookEvent("APP_UNINSTALLED", verification.shop ?? "unknown", null, false, "Rate limit exceeded");
    throw new Response("Too Many Requests", { status: 429 });
  }

  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request,
  );

  if (!admin && topic === "APP_UNINSTALLED") {
    await logWebhookEvent("APP_UNINSTALLED", shop, payload, false, "No admin context");
    throw new Response("Unauthorized", { status: 401 });
  }

  log.webhook("APP_UNINSTALLED", shop, { verified: true });

  try {
    // Perform app uninstall cleanup
    await db.$transaction(async (tx) => {
      // 1. Archive all active registries for the shop
      const registries = await tx.registry.updateMany({
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
      await tx.systemJob.updateMany({
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
      await tx.auditLog.create({
        data: {
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
      await tx.shop.update({
        where: { id: shop },
        data: {
          settings: {
            update: {
              appUninstalledAt: new Date(),
              appActive: false
            }
          }
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

    await logWebhookEvent("APP_UNINSTALLED", shop, payload, true);
    return new Response("OK", { status: 200 });
  } catch (error) {
    log.error(`Error handling app uninstall for ${shop}`, error as Error, { shop });
    await logWebhookEvent("APP_UNINSTALLED", shop, payload, false, error instanceof Error ? error.message : "Unknown error");
    
    // Queue retry job for critical cleanup
    try {
      await db.systemJob.create({
        data: {
          type: "app_uninstall_cleanup_retry",
          shopId: shop,
          payload: JSON.stringify({
            shop,
            error: error instanceof Error ? error.message : "Unknown error",
            attemptedAt: new Date().toISOString()
          }),
          priority: 2,
          runAt: new Date(Date.now() + 300000) // Retry in 5 minutes
        }
      });
    } catch (jobError) {
      log.error("Failed to queue retry job", jobError as Error, { shop });
    }

    // Still return 200 to prevent webhook retry storms
    return new Response("OK", { status: 200 });
  }
};