import type { LoaderFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";

/**
 * Readiness Probe Endpoint
 * Checks if the application is ready to accept traffic
 * Used by load balancers and orchestrators to determine if the app should receive requests
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Quick database connectivity check
    await db.$queryRaw`SELECT 1`;
    
    // Check if critical environment variables are set
    const criticalEnvVars = [
      'DATABASE_URL',
      'SHOPIFY_API_KEY',
      'SHOPIFY_API_SECRET',
      'SESSION_SECRET'
    ];
    
    const missingVars = criticalEnvVars.filter(v => !process.env[v]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing critical environment variables: ${missingVars.join(', ')}`);
    }
    
    return new Response("READY", {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    // Service is not ready
    console.error("Readiness check failed:", error);
    
    return new Response("NOT READY", {
      status: 503,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }
}