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
  
  // CRITICAL: Only add Shopify headers for embedded app routes
  // The library throws an error if we try to add headers on auth routes
  if (url.pathname.startsWith('/app')) {
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
  
  // CRITICAL: Only add Shopify headers for app routes
  // Skip for auth, API, and webhook routes to prevent errors
  const isAppRoute = url.pathname.startsWith('/app');
  
  if (isAppRoute && !isAuthRoute && !isApiRoute && !isWebhookRoute) {
    try {
      // Lazy load only when absolutely needed
      const shopifyModule = await import("~/shopify.server");
      if (shopifyModule.shopify && typeof shopifyModule.shopify.addDocumentResponseHeaders === 'function') {
        shopifyModule.shopify.addDocumentResponseHeaders(request, responseHeaders);
      }
    } catch (error) {
      // Silently fail - some routes might not need Shopify headers
      if (process.env.NODE_ENV === 'development') {
        console.log("[ENTRY] Shopify headers not added for:", url.pathname);
      }
    }
  }
  
  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}