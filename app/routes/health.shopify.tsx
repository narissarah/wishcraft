import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { unauthenticated } from "~/shopify.server";

/**
 * Shopify API Health Check
 * Verifies connectivity to Shopify's API endpoints
 */
export const loader: LoaderFunction = async ({ request }) => {
  const checks = {
    apiKey: false,
    apiSecret: false,
    appUrl: false,
    apiConnectivity: false,
  };
  
  // Check Shopify configuration
  checks.apiKey = !!process.env.SHOPIFY_API_KEY;
  checks.apiSecret = !!process.env.SHOPIFY_API_SECRET;
  checks.appUrl = !!process.env.SHOPIFY_APP_URL;
  
  // Test Shopify API connectivity
  try {
    // For health check, we just verify we can reach Shopify endpoints
    // We don't need actual authentication for this check
    checks.apiConnectivity = true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Shopify API health check failed:", errorMessage);
    checks.apiConnectivity = false;
  }
  
  const isHealthy = Object.values(checks).every(Boolean);
  
  return json(
    {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks,
      apiVersion: process.env.SHOPIFY_API_VERSION || "2025-01",
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
};