import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";

/**
 * Kubernetes Liveness Probe
 * Returns 200 OK if the application is running
 * This endpoint should be lightweight and fast
 */
export const loader: LoaderFunction = async () => {
  return json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
};