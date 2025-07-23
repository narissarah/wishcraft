import crypto from "crypto";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";

/**
 * App Uninstalled Webhook - Simplified direct implementation
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  // Authenticate webhook
  const { shop, admin } = await authenticate.webhook(request);
  
  if (!admin) {
    console.error("No admin context for app uninstall");
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Perform app uninstall cleanup
    await db.$transaction(async (tx) => {
      // Archive all active registries
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

      // Cancel pending jobs
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

      // Log the uninstall
      await tx.audit_logs.create({
        data: {
          id: crypto.randomUUID(),
          action: 'app_uninstalled',
          resource: 'shop',
          resourceId: shop,
          shopId: shop,
          metadata: JSON.stringify({
            uninstalledAt: new Date().toISOString(),
            registriesArchived: registries.count
          })
        }
      });

      // Mark shop as inactive
      await tx.shop_settings.updateMany({
        where: { shopId: shop },
        data: {
          appUninstalledAt: new Date(),
          appActive: false
        }
      });
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error(`Error handling app uninstall for ${shop}:`, error);
    
    // Queue retry job
    try {
      await db.system_jobs.create({
        data: {
          id: crypto.randomUUID(),
          type: "app_uninstall_cleanup_retry",
          shopId: shop,
          payload: JSON.stringify({
            shop,
            error: error instanceof Error ? error.message : "Unknown error"
          }),
          priority: 2,
          runAt: new Date(Date.now() + 300000), // Retry in 5 minutes
          updatedAt: new Date()
        }
      });
    } catch (jobError) {
      console.error("Failed to queue retry job:", jobError);
    }

    // Return 200 to prevent webhook retry storms
    return new Response("OK", { status: 200 });
  }
};