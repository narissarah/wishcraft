import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";

// Vercel cron job for inventory sync
export async function loader({ request }: LoaderFunctionArgs) {
  // Verify the request is from Vercel's cron system
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    log.warn("Unauthorized cron request for inventory sync");
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    log.info("Starting scheduled inventory sync");

    // Get all registry items that need inventory sync
    const itemsToSync = await db.registry_items.findMany({
      where: {
        inventoryTracked: true,
        status: "active",
        OR: [
          { lastInventorySync: null },
          {
            lastInventorySync: {
              lt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
            },
          },
        ],
      },
      include: {
        registries: {
          include: {
            shops: true,
          },
        },
      },
      take: 100, // Process in batches
    });

    log.info(`Found ${itemsToSync.length} items to sync`);

    // Queue sync jobs
    const syncJobs = itemsToSync.map((item) =>
      db.system_jobs.create({
        data: {
          id: `inv-sync-${item.id}-${Date.now()}`,
          type: "inventory_sync",
          status: "pending",
          priority: 3,
          payload: JSON.stringify({
            itemId: item.id,
            productId: item.productId,
            variantId: item.variantId,
            shopId: item.registries.shopId,
          }),
          shopId: item.registries.shopId,
          registryId: item.registryId,
          runAt: new Date(),
          updatedAt: new Date(),
        },
      })
    );

    await db.$transaction(syncJobs);

    log.info("Inventory sync jobs queued successfully");

    return json({
      success: true,
      message: `Queued ${itemsToSync.length} inventory sync jobs`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("Error in inventory sync cron:", error);
    return json(
      {
        error: "Failed to process inventory sync",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}