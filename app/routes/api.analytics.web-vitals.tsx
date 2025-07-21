import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { checkRateLimit } from "~/lib/rate-limiter.server";
import { log } from "~/lib/logger.server";

export async function action({ request }: ActionFunctionArgs) {
  // Rate limit analytics requests
  const rateLimitResult = await checkRateLimit(request, "analytics", { max: 100, windowMs: 60000 });
  if (!rateLimitResult.allowed) {
    return json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.name || typeof data.value !== "number") {
      return json({ error: "Invalid data format" }, { status: 400 });
    }

    // Extract shop ID from session or headers
    const shopId = request.headers.get("x-shop-id") || "unknown";
    
    // Store the metric in the database
    await db.performance_metrics.create({
      data: {
        id: `${data.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        shopId,
        metricType: data.name,
        metricValue: data.value,
        url: data.url,
        userAgent: request.headers.get("user-agent"),
        viewport: data.viewport,
        connection: data.connection,
        createdAt: new Date(),
      },
    });

    return json({ success: true });
  } catch (error) {
    log.error("Error storing Web Vitals metric", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}