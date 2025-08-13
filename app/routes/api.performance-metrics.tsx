import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { apiError, apiMethodNotAllowed, apiSuccess } from "~/lib/api-response.server";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return apiMethodNotAllowed(['POST']);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return apiMethodNotAllowed(['POST']);
  }

  try {
    const { metrics, url, userAgent, viewport, connection } = await request.json();
    
    // Get shop from session or headers
    const shopDomain = request.headers.get('X-Shop-Domain');
    if (!shopDomain) {
      return apiError('Shop domain not found', 400);
    }

    // Find shop ID
    const shop = await db.shops.findUnique({
      where: { domain: shopDomain },
      select: { id: true }
    });

    if (!shop) {
      return apiError('Shop not found', 404);
    }

    // Process and store each metric
    const metricRecords = metrics.map((metric: any) => ({
      id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      shopId: shop.id,
      metricType: `web_vitals_${metric.name.toLowerCase()}`,
      metricValue: metric.value,
      url,
      userAgent,
      viewport: JSON.stringify(viewport),
      connection,
      createdAt: new Date(),
    }));

    await db.performance_metrics.createMany({
      data: metricRecords,
    });

    // Check if metrics meet Built for Shopify requirements
    const violations = metrics.filter((metric: any) => {
      const thresholds: Record<string, number> = {
        LCP: 2500,
        CLS: 0.1,
        INP: 200,
      };
      return metric.value > (thresholds[metric.name] || Infinity);
    });

    if (violations.length > 0) {
      log.warn('Web Vitals threshold violations detected', {
        shopId: shop.id,
        violations,
        url,
      });
    }

    return apiSuccess({ 
      received: true, 
      violations: violations.length,
    });
  } catch (error) {
    log.error('Failed to process performance metrics', error as Error);
    return apiError('Failed to process metrics', 500);
  }
};