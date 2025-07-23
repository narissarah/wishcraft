/**
 * Minimal constants for WishCraft
 * Only includes values that are actually used
 */

// API Configuration - Only used values
export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  RETRIES: 3,
  SHOPIFY_API_VERSION: "2025-07",
  CACHE_TTL: 300, // 5 minutes
} as const;

// Validation limits - Only used values
export const VALIDATION = {
  REGISTRY_TITLE_MAX: 100,
  REGISTRY_DESCRIPTION_MAX: 2000,
  EMAIL_MAX: 255,
  NAME_MAX: 100,
  PHONE_MAX: 50,
  ACCESS_CODE_MIN: 4,
  ACCESS_CODE_MAX: 20,
} as const;