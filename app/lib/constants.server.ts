/**
 * Minimal constants for WishCraft
 * Re-exports from centralized config for backward compatibility
 */

import { SHOPIFY_CONFIG } from "~/config/shopify.config";

// API Configuration - Re-export from centralized config
export const API_CONFIG = {
  TIMEOUT: SHOPIFY_CONFIG.API_TIMEOUT,
  RETRIES: 3,
  SHOPIFY_API_VERSION: SHOPIFY_CONFIG.API_VERSION,
  CACHE_TTL: SHOPIFY_CONFIG.CACHE.REGISTRY_TTL,
} as const;

// Validation limits - Re-export from centralized config
export const VALIDATION = {
  REGISTRY_TITLE_MAX: SHOPIFY_CONFIG.VALIDATION.REGISTRY_TITLE_MAX,
  REGISTRY_DESCRIPTION_MAX: SHOPIFY_CONFIG.VALIDATION.REGISTRY_DESCRIPTION_MAX,
  EMAIL_MAX: 255,
  NAME_MAX: 100,
  PHONE_MAX: 50,
  ACCESS_CODE_MIN: 4,
  ACCESS_CODE_MAX: 20,
} as const;