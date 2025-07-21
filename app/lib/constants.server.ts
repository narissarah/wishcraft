/**
 * Essential Configuration Constants
 * Simplified from over-engineered constants-unified.server.ts
 */

// API Configuration
export const API_TIMEOUT = 30000;
export const API_RETRIES = 3;
export const SHOPIFY_API_VERSION = '2025-01';

// Rate Limits (per Shopify guidelines)
export const RATE_LIMITS = {
  API_CALLS: 40,        // per 2 seconds (Shopify limit)
  WEBHOOKS: 100,        // per minute
  UPLOADS: 5            // per minute
} as const;

// Cache TTL
export const CACHE_TTL = {
  SHORT: 60,            // 1 minute
  DEFAULT: 300,         // 5 minutes  
  LONG: 3600            // 1 hour
} as const;

// Pagination
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 250;

// Security
export const MIN_SECRET_LENGTH = 32;
export const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

// Registry Limits
export const REGISTRY_LIMITS = {
  MAX_ITEMS: 250,
  MAX_TITLE_LENGTH: 255,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_COLLABORATORS: 50
} as const;