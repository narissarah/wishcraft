import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { rateLimitMiddleware, RATE_LIMITS } from "~/lib/security.server";
import crypto from "crypto";

/**
 * Web Vitals Analytics Endpoint
 * Receives Core Web Vitals data from client-side monitoring
 * Implements Shopify 2025-07 performance tracking requirements
 */
export async function action({ request }: ActionFunctionArgs) {
  // Apply rate limiting to prevent abuse
  const rateLimitResponse = await rateLimitMiddleware(RATE_LIMITS.api)(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Parse the Web Vitals data from the client
    const vitalsData = await request.json();
    
    // Validate required fields
    if (!vitalsData.name || !vitalsData.value || !vitalsData.url) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    // Extract shop ID from URL if available (for multi-tenant tracking)
    const url = new URL(vitalsData.url);
    const shopParam = url.searchParams.get('shop');
    let shopId: string | undefined;
    
    if (shopParam) {
      // Clean shop parameter (remove .myshopify.com if present)
      shopId = shopParam.replace('.myshopify.com', '');
    }

    // Store the performance metric in database
    await db.performance_metrics.create({
      data: {
        id: crypto.randomUUID(),
        shopId: shopId || 'unknown',
        metricType: vitalsData.name,
        metricValue: parseFloat(vitalsData.value.toString()),
        url: vitalsData.url,
        userAgent: request.headers.get('user-agent') || undefined,
        viewport: vitalsData.viewport || undefined,
        connection: vitalsData.connection || undefined,
        createdAt: new Date()
      }
    });

    // Log performance metric for monitoring (structured logging)
    log.info("Web Vitals metric recorded", {
      metric: vitalsData.name,
      value: vitalsData.value,
      rating: vitalsData.rating,
      shopId,
      url: vitalsData.url
    });

    // Check for performance issues and alert if needed
    await checkPerformanceThresholds(vitalsData);

    return json({ success: true });

  } catch (error) {
    log.error("Failed to process Web Vitals data", error as Error, {
      url: request.url,
      userAgent: request.headers.get('user-agent')
    });
    
    // Return success to prevent client-side errors from impacting user experience
    return json({ success: true });
  }
}

/**
 * Check if performance metrics exceed Shopify 2025-07 thresholds
 * and log warnings for performance issues
 */
async function checkPerformanceThresholds(vitalsData: any) {
  const thresholds = {
    // Shopify 2025-07 performance requirements
    'CLS': 0.1,     // Cumulative Layout Shift must be < 0.1
    'INP': 200,     // Interaction to Next Paint must be < 200ms  
    'LCP': 2500,    // Largest Contentful Paint must be < 2.5s
    'FCP': 1800,    // First Contentful Paint should be < 1.8s
    'TTFB': 600     // Time to First Byte should be < 600ms
  };

  const threshold = thresholds[vitalsData.name as keyof typeof thresholds];
  
  if (threshold && vitalsData.value > threshold) {
    log.warn(`Performance threshold exceeded: ${vitalsData.name}`, {
      metric: vitalsData.name,
      value: vitalsData.value,
      threshold,
      rating: vitalsData.rating,
      url: vitalsData.url,
      delta: vitalsData.value - threshold
    });

    // In a production environment, you might:
    // - Send alerts to monitoring systems
    // - Trigger performance optimization workflows
    // - Update performance dashboards
  }
}

// Handle preflight OPTIONS requests
export async function loader() {
  return json({ message: "Use POST to submit Web Vitals data" }, { status: 405 });
}