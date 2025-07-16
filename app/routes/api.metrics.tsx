// API Route for Performance Metrics Collection
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { trackPerformanceMetrics } from "~/lib/built-for-shopify.server";
import { log } from "~/lib/logger.server";
import { db } from "~/lib/db.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const type = formData.get("type");
    
    if (type !== "performance_metrics") {
      return json({ error: "Invalid metrics type" }, { status: 400 });
    }
    
    const shopId = formData.get("shopId") as string;
    const metricsJson = formData.get("metrics") as string;
    
    if (!shopId || !metricsJson) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }
    
    const metrics = JSON.parse(metricsJson);
    
    // Store individual metrics in database
    const metricPromises = [];
    
    // Core Web Vitals
    if (metrics.lcp) {
      metricPromises.push(
        db.performanceMetrics.create({
          data: {
            shopId,
            metricType: "lcp",
            metricValue: metrics.lcp,
            url: metrics.url,
            userAgent: metrics.userAgent,
            viewport: JSON.stringify(metrics.viewport),
            connection: metrics.connection,
          },
        })
      );
    }
    
    if (metrics.fid) {
      metricPromises.push(
        db.performanceMetrics.create({
          data: {
            shopId,
            metricType: "fid",
            metricValue: metrics.fid,
            url: metrics.url,
            userAgent: metrics.userAgent,
            viewport: JSON.stringify(metrics.viewport),
            connection: metrics.connection,
          },
        })
      );
    }
    
    if (metrics.cls) {
      metricPromises.push(
        db.performanceMetrics.create({
          data: {
            shopId,
            metricType: "cls",
            metricValue: metrics.cls,
            url: metrics.url,
            userAgent: metrics.userAgent,
            viewport: JSON.stringify(metrics.viewport),
            connection: metrics.connection,
          },
        })
      );
    }
    
    if (metrics.ttfb) {
      metricPromises.push(
        db.performanceMetrics.create({
          data: {
            shopId,
            metricType: "ttfb",
            metricValue: metrics.ttfb,
            url: metrics.url,
            userAgent: metrics.userAgent,
            viewport: JSON.stringify(metrics.viewport),
            connection: metrics.connection,
          },
        })
      );
    }
    
    // Additional metrics
    if (metrics.fcp) {
      metricPromises.push(
        db.performanceMetrics.create({
          data: {
            shopId,
            metricType: "fcp",
            metricValue: metrics.fcp,
            url: metrics.url,
            userAgent: metrics.userAgent,
            viewport: JSON.stringify(metrics.viewport),
            connection: metrics.connection,
          },
        })
      );
    }
    
    if (metrics.inp) {
      metricPromises.push(
        db.performanceMetrics.create({
          data: {
            shopId,
            metricType: "inp",
            metricValue: metrics.inp,
            url: metrics.url,
            userAgent: metrics.userAgent,
            viewport: JSON.stringify(metrics.viewport),
            connection: metrics.connection,
          },
        })
      );
    }
    
    // Save all metrics
    await Promise.all(metricPromises);
    
    // Track the metrics and check compliance
    const result = await trackPerformanceMetrics(shopId, metrics);
    
    // Log compliance status
    if (!result.isCompliant) {
      log.warn("Performance not meeting Built for Shopify standards", {
        shopId,
        compliance: result.compliance,
      });
    }
    
    return json({
      success: true,
      isCompliant: result.isCompliant,
      compliance: result.compliance,
      metricsStored: metricPromises.length,
    });
  } catch (error) {
    log.error("Failed to track performance metrics", error as Error);
    return json({ error: "Failed to track metrics" }, { status: 500 });
  }
}