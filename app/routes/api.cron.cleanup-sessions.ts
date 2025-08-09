import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";

// Vercel cron job for session cleanup
export async function loader({ request }: LoaderFunctionArgs) {
  // Verify the request is from Vercel's cron system
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    log.warn("Unauthorized cron request for session cleanup");
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    log.info("Starting scheduled session cleanup");

    // Delete expired sessions
    const expiredSessions = await db.sessions.deleteMany({
      where: {
        expires: {
          lt: new Date(),
        },
      },
    });

    // Delete orphaned offline sessions older than 30 days
    const orphanedSessions = await db.sessions.deleteMany({
      where: {
        isOnline: false,
        updatedAt: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    // Clean up old performance metrics (keep last 7 days)
    const oldMetrics = await db.performance_metrics.deleteMany({
      where: {
        createdAt: {
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    // Clean up old analytics events based on shop data retention settings
    const shops = await db.shops.findMany({
      select: {
        id: true,
        dataRetentionPeriod: true,
      },
    });

    let analyticsDeleted = 0;
    for (const shop of shops) {
      const retentionDays = shop.dataRetentionPeriod || 90;
      const deleted = await db.analytics_events.deleteMany({
        where: {
          shopId: shop.id,
          timestamp: {
            lt: new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000),
          },
        },
      });
      analyticsDeleted += deleted.count;
    }

    // Log cleanup results
    const results = {
      expiredSessions: expiredSessions.count,
      orphanedSessions: orphanedSessions.count,
      oldMetrics: oldMetrics.count,
      analyticsEvents: analyticsDeleted,
    };

    log.info("Session cleanup completed", results);

    // Create audit log
    await db.audit_logs.create({
      data: {
        id: `cleanup-${Date.now()}`,
        action: "system_cleanup",
        resource: "sessions",
        resourceId: "cron",
        newValues: JSON.stringify(results),
        timestamp: new Date(),
      },
    });

    return json({
      success: true,
      message: "Session cleanup completed",
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("Error in session cleanup cron:", error);
    return json(
      {
        error: "Failed to process session cleanup",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}