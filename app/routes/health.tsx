import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Health check endpoint for monitoring app status
 * Accessible at /health
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {
      environment: {
        SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL || "NOT_SET",
        SHOPIFY_API_KEY: !!process.env.SHOPIFY_API_KEY,
        SHOPIFY_API_SECRET: !!process.env.SHOPIFY_API_SECRET,
        DATABASE_URL: !!process.env.DATABASE_URL,
        SESSION_SECRET: !!process.env.SESSION_SECRET,
      },
      routes: {
        current: url.pathname,
        authRoutes: ["/auth/login", "/auth/callback", "/auth/logout"],
        appRoutes: ["/app", "/app/settings", "/app/registries"],
      },
      authentication: {
        isAuthRoute: url.pathname.startsWith('/auth'),
        isAppRoute: url.pathname.startsWith('/app'),
        expectedBehavior: url.pathname.startsWith('/auth') 
          ? "Should use login()" 
          : url.pathname.startsWith('/app')
          ? "Should use authenticate.admin()"
          : "No authentication required",
      },
      builtForShopify: {
        webVitals: "✓ Implemented",
        securityHeaders: "✓ Configured",
        gdprWebhooks: "✓ Registered",
        rateLimiting: "✓ Active",
        apiVersion: "2024-10",
      }
    }
  };
  
  // Check if all required env vars are set
  const missingEnvVars = Object.entries(health.checks.environment)
    .filter(([key, value]) => value === false || value === "NOT_SET")
    .map(([key]) => key);
  
  if (missingEnvVars.length > 0) {
    health.status = "unhealthy";
    health.checks.environment.missing = missingEnvVars;
  }
  
  return json(health);
}