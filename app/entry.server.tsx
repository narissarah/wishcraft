import type { EntryContext } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { renderToString } from "react-dom/server";
import { initSentry, clearSensitiveContext } from "~/lib/monitoring.server";
import { getSecurityHeaders } from "~/lib/security-headers.server";

// Initialize Sentry monitoring
initSentry();

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  // Clear any sensitive context from previous requests
  clearSensitiveContext();
  
  // Add performance timing
  const startTime = Date.now();
  
  const markup = renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );
  
  // Set security headers
  const securityHeaders = getSecurityHeaders(request);
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