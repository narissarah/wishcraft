import type { EntryContext } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { renderToString } from "react-dom/server";
import { getSecurityHeaders } from "~/lib/security-headers.server";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  // Add performance timing
  const startTime = Date.now();
  
  // Parse URL to check route type
  const url = new URL(request.url);
  
  // Define route types
  const isAppRoute = url.pathname.startsWith('/app');
  const isAuthRoute = url.pathname.startsWith('/auth');
  const isApiRoute = url.pathname.startsWith('/api');
  const isWebhookRoute = url.pathname.startsWith('/webhooks');
  
  // CRITICAL: Only add Shopify headers for embedded app routes
  // The library throws an error if we try to add headers on auth routes
  if (isAppRoute && !isAuthRoute && !isApiRoute && !isWebhookRoute) {
    try {
      const { shopify } = await import("~/shopify.server");
      shopify.addDocumentResponseHeaders(request, responseHeaders);
    } catch (error) {
      console.error('[ENTRY] Error adding Shopify headers:', error);
    }
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