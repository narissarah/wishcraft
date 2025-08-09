/**
 * Content Security Policy configuration for WishCraft
 * Simplified CSP generation for Shopify embedded apps
 */

import crypto from "crypto";

/**
 * Generate a CSP nonce
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Generate CSP header for Shopify embedded apps
 */
export function generateCSP(nonce: string, shop?: string | null): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://cdn.shopify.com 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}' https://cdn.shopify.com`,
    "font-src 'self' https://cdn.shopify.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.myshopify.com wss://*.myshopify.com",
    "frame-src 'self' https://*.myshopify.com https://admin.shopify.com",
    "object-src 'none'",
    "base-uri 'self'",
  ];

  // Add frame-ancestors for embedding
  if (shop) {
    directives.push(`frame-ancestors https://${shop}.myshopify.com https://admin.shopify.com`);
  } else {
    directives.push("frame-ancestors https://*.myshopify.com https://admin.shopify.com");
  }

  return directives.join('; ');
}