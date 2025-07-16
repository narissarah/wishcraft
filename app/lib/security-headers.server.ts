/**
 * Security Headers Configuration for WishCraft
 * Implements comprehensive security headers for Shopify 2025 compliance
 */

export interface SecurityHeadersOptions {
  nonce?: string;
  shop?: string;
  development?: boolean;
}

/**
 * Generate security headers for responses
 */
export function getSecurityHeaders(requestOrOptions: Request | SecurityHeadersOptions = {}): Record<string, string> {
  let options: SecurityHeadersOptions = {};
  
  if (requestOrOptions instanceof Request) {
    // Extract options from Request
    const url = new URL(requestOrOptions.url);
    options = {
      shop: url.searchParams.get('shop') || undefined,
      development: process.env.NODE_ENV !== 'production'
    };
  } else {
    options = requestOrOptions;
  }
  const { nonce, shop, development = false } = options;
  
  const headers: Record<string, string> = {
    // Content Security Policy
    'Content-Security-Policy': generateCSP({ nonce, shop, development }),
    
    // Security headers
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    
    // HSTS (only in production)
    ...(development ? {} : {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    })
  };
  
  return headers;
}

function generateCSP({ nonce, shop, development }: SecurityHeadersOptions): string {
  // Enhanced CSP for 2025 compliance - removes 'unsafe-inline' and uses nonce-based approach
  const directives = [
    "default-src 'self'",
    // Script sources with nonce-based CSP (2025 compliant)
    `script-src 'self' ${nonce ? `'nonce-${nonce}'` : "'strict-dynamic'"} https://cdn.shopify.com https://js.shopifycs.com`,
    // Style sources with nonce-based CSP (removes unsafe-inline)
    `style-src 'self' ${nonce ? `'nonce-${nonce}'` : "'strict-dynamic'"} https://cdn.shopify.com https://fonts.googleapis.com`,
    // Font sources for Polaris and Google Fonts
    "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.shopify.com",
    // Image sources including Shopify CDN
    "img-src 'self' data: https: blob: https://*.shopifycdn.com",
    // Connect sources for GraphQL and API calls
    "connect-src 'self' https://*.myshopify.com https://*.shopifycs.com wss://*.myshopify.com",
    // Frame sources for embedded app
    "frame-src 'self' https://*.myshopify.com https://admin.shopify.com",
    // Object and base restrictions
    "object-src 'none'",
    "base-uri 'self'",
    // Media sources
    "media-src 'self' https://*.shopifycdn.com",
    // Worker sources
    "worker-src 'self' blob:"
  ];
  
  if (shop) {
    // Frame ancestors for specific shop domain
    directives.push(`frame-ancestors https://${shop}.myshopify.com https://admin.shopify.com`);
  } else {
    // General frame ancestors for all Shopify domains
    directives.push("frame-ancestors https://*.myshopify.com https://admin.shopify.com");
  }
  
  if (development) {
    // Additional development sources
    directives.push("connect-src 'self' ws: wss: https://*.myshopify.com http://localhost:* https://localhost:*");
  }
  
  return directives.join('; ');
}

/**
 * Generate a cryptographic nonce for CSP
 */
export function generateNonce(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('base64');
}