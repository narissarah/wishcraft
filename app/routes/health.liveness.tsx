import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Liveness Probe Endpoint
 * Simple endpoint that returns 200 OK if the application is running
 * Used by Kubernetes/container orchestrators to check if the app is alive
 */
export async function loader({ request }: LoaderFunctionArgs) {
  return new Response("OK", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}