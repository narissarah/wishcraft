import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Debug endpoint to check app health and configuration
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const health = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      status: "checking",
      checks: {} as any,
    };

    // Check environment variables
    health.checks.envVars = {
      SHOPIFY_API_KEY: !!process.env.SHOPIFY_API_KEY,
      SHOPIFY_API_SECRET: !!process.env.SHOPIFY_API_SECRET,
      SHOPIFY_APP_URL: !!process.env.SHOPIFY_APP_URL,
      DATABASE_URL: !!process.env.DATABASE_URL,
      SESSION_SECRET: !!process.env.SESSION_SECRET,
      SHOPIFY_SCOPES: !!process.env.SHOPIFY_SCOPES,
      values: {
        SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL?.substring(0, 30) + "..." || "missing",
        NODE_ENV: process.env.NODE_ENV || "missing",
        VERCEL: !!process.env.VERCEL,
      }
    };

    // Check database connection
    try {
      const { db } = await import("~/lib/db.server");
      await db.$queryRaw`SELECT 1`;
      health.checks.database = { status: "connected" };
    } catch (error: any) {
      health.checks.database = { 
        status: "error", 
        message: error.message?.substring(0, 100) 
      };
    }

    // Check Shopify app initialization
    try {
      const { getShopify } = await import("~/shopify.server");
      const shopifyApp = getShopify();
      health.checks.shopify = { 
        status: "initialized",
        apiVersion: shopifyApp.config.apiVersion 
      };
    } catch (error: any) {
      health.checks.shopify = { 
        status: "error", 
        message: error.message?.substring(0, 100) 
      };
    }

    // Overall status
    const hasErrors = Object.values(health.checks).some((check: any) => 
      check.status === "error" || Object.values(check).includes(false)
    );
    
    health.status = hasErrors ? "error" : "healthy";

    return json(health);
  } catch (error: any) {
    return json({
      timestamp: new Date().toISOString(),
      status: "critical_error",
      error: error.message?.substring(0, 200),
      stack: error.stack?.substring(0, 500)
    }, { status: 500 });
  }
}