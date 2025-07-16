import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";

/**
 * Kubernetes Readiness Probe
 * Checks if the application is ready to receive traffic
 * Validates critical dependencies like database and environment
 */
export const loader: LoaderFunction = async () => {
  const checks = {
    database: false,
    environment: false,
    shopify: false,
  };
  
  // Check database connectivity
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    log.error("Database readiness check failed", error as Error);
  }
  
  // Check critical environment variables
  checks.environment = !!(
    process.env.DATABASE_URL &&
    process.env.SHOPIFY_API_KEY &&
    process.env.SHOPIFY_API_SECRET &&
    process.env.SHOPIFY_APP_URL
  );
  
  // Check Shopify configuration
  checks.shopify = !!(
    process.env.SHOPIFY_SCOPES &&
    process.env.SESSION_SECRET
  );
  
  const isReady = Object.values(checks).every(Boolean);
  
  return json(
    {
      status: isReady ? "ready" : "not ready",
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: isReady ? 200 : 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
};