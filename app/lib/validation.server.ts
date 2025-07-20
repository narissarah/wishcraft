/**
 * Validation Utilities
 * Common validation functions for Shopify app
 */

import crypto from "crypto";

/**
 * Validate Shopify domain format
 */
export function isValidShopDomain(shop: string): boolean {
  if (!shop || typeof shop !== 'string') {
    return false;
  }
  
  // Remove protocol if present
  shop = shop.replace(/^https?:\/\//, '');
  
  // Check if it's a valid myshopify.com domain
  const shopifyDomainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  
  return shopifyDomainRegex.test(shop);
}

/**
 * Validate request origin for CSRF protection
 */
export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  
  if (!origin && !referer) {
    return false;
  }
  
  const allowedOrigins = [
    process.env.SHOPIFY_APP_URL,
    "https://admin.shopify.com",
    /^https:\/\/.*\.myshopify\.com$/,
  ].filter(Boolean) as (string | RegExp)[];
  
  const requestOrigin = origin || new URL(referer!).origin;
  
  return allowedOrigins.some(allowed => {
    if (typeof allowed === "string") {
      return requestOrigin === allowed;
    }
    return allowed.test(requestOrigin);
  });
}

/**
 * Generate secure random tokens
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("base64url");
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate Shopify webhook HMAC
 */
export function isValidWebhookHmac(rawBody: string, hmacHeader: string, secret: string): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(hmacHeader)
  );
}