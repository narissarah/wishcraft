/**
 * Simplified Server Utilities for WishCraft
 * Essential utilities without duplication
 */

import bcrypt from 'bcrypt';
import { json } from "@remix-run/node";

// Basic constants
export const API_TIMEOUT = 30000; // 30 seconds
export const SHOPIFY_API_VERSION = "2025-07";
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 250;

// Registry limits
export const REGISTRY_LIMITS = {
  MAX_ITEMS: 250,
  MAX_TITLE_LENGTH: 255,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_COLLABORATORS: 50
} as const;

// Hashing utilities
const SALT_ROUNDS = 10;

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