import { json } from "@remix-run/node";

export const loader = async () => {
  return json({
    status: "healthy",
    app: "WishCraft",
    fixes: {
      cspFrameAncestors: "fixed",
      rootRouteRedirect: "fixed",
      shopifyEmbeddedApp: "ready"
    },
    timestamp: new Date().toISOString()
  });
};

export default function Status() {
  return null; // JSON response only
}