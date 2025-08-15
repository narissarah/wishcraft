import type { EntryContext } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { renderToString } from "react-dom/server";
import { getSecurityHeaders } from "~/lib/security-headers.server";
import { shopify } from "~/shopify.server";
// Environment validation removed - not exported from validation.server

// Environment validation handled at startup

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const url = new URL(request.url);
  
  // Skip Shopify headers for auth routes to prevent authentication errors
  if (!url.pathname.startsWith('/auth/')) {
    // CRITICAL: Add Shopify document response headers for proper embedded app authentication
    shopify.addDocumentResponseHeaders(request, responseHeaders);
  }
  
  // Add performance timing
  const startTime = Date.now();
  
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