/**
 * Simplified Server Utilities for WishCraft
 * Essential utilities without duplication
 */

import bcrypt from 'bcrypt';
import { json } from "@remix-run/node";
import { SHOPIFY_CONFIG } from "~/config/shopify.config";

// Re-export from centralized config for backward compatibility
export const API_TIMEOUT = SHOPIFY_CONFIG.API_TIMEOUT;
export const SHOPIFY_API_VERSION = SHOPIFY_CONFIG.API_VERSION;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = SHOPIFY_CONFIG.VALIDATION.MAX_ITEMS_PER_REGISTRY;

// Registry limits - use centralized config
export const REGISTRY_LIMITS = {
  MAX_ITEMS: SHOPIFY_CONFIG.VALIDATION.MAX_ITEMS_PER_REGISTRY,
  MAX_TITLE_LENGTH: SHOPIFY_CONFIG.VALIDATION.REGISTRY_TITLE_MAX,
  MAX_DESCRIPTION_LENGTH: SHOPIFY_CONFIG.VALIDATION.REGISTRY_DESCRIPTION_MAX,
  MAX_COLLABORATORS: SHOPIFY_CONFIG.VALIDATION.MAX_COLLABORATORS
} as const;

// Hashing utilities
const SALT_ROUNDS = SHOPIFY_CONFIG.SECURITY.SALT_ROUNDS;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Response helpers removed - use apiResponse from api-response.server.ts instead

// Pagination helper
export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE))));
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// URL helpers
export function buildShopifyUrl(shop: string, path: string): string {
  return `https://${shop}.myshopify.com${path}`;
}

export function isValidShopDomain(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(shop) && shop.length <= 60;
}