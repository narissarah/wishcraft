import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { openApiSpec } from "~/lib/api-docs/openapi.server";
import { rateLimiter } from "~/lib/rate-limiter.server";

/**
 * OpenAPI Documentation Endpoint
 * GET /api/docs - Returns OpenAPI 3.0 specification
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Rate limiting for API docs
  const { allowed } = await rateLimiter.check(request);
  if (!allowed) {
    return json({ error: "Too many requests" }, { status: 429 });
  }
  
  // Return OpenAPI specification
  return json(openApiSpec, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600", // Cache for 1 hour
    },
  });
}