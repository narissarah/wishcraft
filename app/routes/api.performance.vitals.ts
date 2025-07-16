import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { z } from "zod";
import { validateAction, AnalyticsSchemas } from "~/lib/validation-unified.server";

// Validation schema for web vitals payload
const MetricsPayloadSchema = AnalyticsSchemas.webVitals;

export const action = validateAction(MetricsPayloadSchema)(
  async ({ request, validatedData }) => {
    
    // Extract shop from URL or session
    const url = new URL(request.url);
    const shopId = url.searchParams.get("shop") || "unknown";
    
    // Process each metric
    for (const metric of validatedData.metrics) {
      // Check for CLS violations
      if (metric.cls !== undefined && metric.cls > 0.1) {
        log.error("CLS violation detected", {
          shopId,
          cls: metric.cls,
          url: metric.url,
          userAgent: metric.userAgent,
          viewport: metric.viewport
        });
        
        // Store critical CLS violation
        await db.performanceMetrics.create({
          data: {
            shopId,
            metricType: "CLS_VIOLATION",
            metricValue: metric.cls,
            url: metric.url,
            userAgent: metric.userAgent,
            viewport: JSON.stringify(metric.viewport),
            connection: metric.connection
          }
        });
      }
      
      // Store all metrics
      const metricsToStore = [
        { type: "CLS", value: metric.cls },
        { type: "FCP", value: metric.fcp },
        { type: "FID", value: metric.fid },
        { type: "LCP", value: metric.lcp },
        { type: "TTFB", value: metric.ttfb },
        { type: "INP", value: metric.inp }
      ].filter(m => m.value !== undefined);
      
      // Batch insert metrics
      if (metricsToStore.length > 0) {
        await db.performanceMetrics.createMany({
          data: metricsToStore.map(m => ({
            shopId,
            metricType: m.type,
            metricValue: m.value!,
            url: metric.url,
            userAgent: metric.userAgent,
            viewport: JSON.stringify(metric.viewport),
            connection: metric.connection
          }))
        });
      }
      
      // Store custom measures
      if (metric.customMeasure) {
        await db.performanceMetrics.create({
          data: {
            shopId,
            metricType: `CUSTOM_${metric.customMeasure.name}`,
            metricValue: metric.customMeasure.duration,
            url: metric.url,
            userAgent: metric.userAgent,
            viewport: JSON.stringify(metric.viewport),
            connection: metric.connection
          }
        });
      }
      
      // Log performance summary
      log.info("Performance metrics received", {
        shopId,
        metrics: {
          cls: metric.cls,
          lcp: metric.lcp,
          fid: metric.fid,
          inp: metric.inp
        },
        url: metric.url.substring(0, 100),
        alert: metric.alert
      });
    }
    
    // Check if shop needs performance improvements
    await checkShopPerformanceHealth(shopId);
    
    return json({ success: true });
  }
);

async function checkShopPerformanceHealth(shopId: string) {
  // Get recent CLS metrics
  const recentCLS = await db.performanceMetrics.findMany({
    where: {
      shopId,
      metricType: "CLS",
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    },
    select: {
      metricValue: true
    }
  });
  
  if (recentCLS.length === 0) return;
  
  // Calculate CLS p75 (75th percentile)
  const clsValues = recentCLS.map(m => m.metricValue).sort((a, b) => a - b);
  const p75Index = Math.floor(clsValues.length * 0.75);
  const clsP75 = clsValues[p75Index];
  
  // Alert if CLS p75 exceeds threshold
  if (clsP75 > 0.1) {
    log.warn("Shop has poor CLS performance", {
      shopId,
      clsP75,
      sampleSize: clsValues.length,
      required: 0.1
    });
    
    // Update shop compliance metadata
    await db.shop.update({
      where: { id: shopId },
      data: {
        complianceMetadata: {
          performanceIssues: {
            cls: {
              p75: clsP75,
              compliant: false,
              lastChecked: new Date().toISOString()
            }
          }
        }
      }
    });
  }
}

// GET endpoint for performance dashboard
export async function loader({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const shopId = url.searchParams.get("shop");
  const metricType = url.searchParams.get("type");
  const hours = parseInt(url.searchParams.get("hours") || "24");
  
  if (!shopId) {
    return json({ error: "Shop ID required" }, { status: 400 });
  }
  
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const where: any = {
    shopId,
    createdAt: { gte: since }
  };
  
  if (metricType) {
    where.metricType = metricType;
  }
  
  const metrics = await db.performanceMetrics.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 1000
  });
  
  // Calculate statistics
  const stats = calculatePerformanceStats(metrics);
  
  return json({
    metrics,
    stats,
    period: { hours, since }
  });
}

function calculatePerformanceStats(metrics: any[]) {
  const grouped = metrics.reduce((acc, m) => {
    if (!acc[m.metricType]) {
      acc[m.metricType] = [];
    }
    acc[m.metricType].push(m.metricValue);
    return acc;
  }, {} as Record<string, number[]>);
  
  const stats: Record<string, any> = {};
  
  for (const [type, values] of Object.entries(grouped)) {
    const sorted = values.sort((a, b) => a - b);
    stats[type] = {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    };
    
    // Add compliance check for CLS
    if (type === "CLS") {
      stats[type].compliant = stats[type].p75 <= 0.1;
      stats[type].required = 0.1;
    }
  }
  
  return stats;
}