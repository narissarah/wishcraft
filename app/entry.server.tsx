import type { EntryContext } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { renderToString } from "react-dom/server";
import { getSecurityHeaders } from "~/lib/security-headers.server";
// Environment validation removed - not exported from validation.server

// Environment validation handled at startup

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  // Add performance timing
  const startTime = Date.now();
  
  // Parse URL to check if this is an auth route
  const url = new URL(request.url);
  const isAuthRoute = url.pathname.startsWith('/auth');
  
  // Add Shopify document response headers - REQUIRED for embedded apps
  // BUT skip for auth routes to avoid "authenticate.admin() from configured login path" error
  if (!isAuthRoute) {
    const { shopify } = await import("~/shopify.server");
    shopify.addDocumentResponseHeaders(request, responseHeaders);
  }
  
  // Get nonce from server middleware
  const nonce = (request as Request & { nonce?: string }).nonce;
  
  const markup = renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );
  
  // Set security headers with the same nonce from server
  const shop = url.searchParams.get('shop');
  const securityHeaders = getSecurityHeaders(nonce || '', shop);
  
  Object.entries(securityHeaders).forEach(([key, value]) => {
    if (value) responseHeaders.set(key, value);
  });
  
  responseHeaders.set("Content-Type", "text/html");
  
  // Add performance headers
  const renderTime = Date.now() - startTime;
  responseHeaders.set("Server-Timing", `render;dur=${renderTime}`);
  
  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}