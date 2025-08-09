/**
 * Centralized Shopify configuration
 * Single source of truth for all Shopify-related constants
 */

export const SHOPIFY_CONFIG = {
  // API Configuration
  API_VERSION: "2025-07",
  API_TIMEOUT: 30000, // 30 seconds
  
  // Rate Limits
  RATE_LIMITS: {
    GENERAL: { limit: 60, window: 60 * 1000 }, // 60 requests per minute
    AUTH: { limit: 10, window: 15 * 60 * 1000 }, // 10 requests per 15 minutes
    ANALYTICS: { limit: 120, window: 60 * 1000 }, // 120 requests per minute
  },
  
  // Validation Limits
  VALIDATION: {
    REGISTRY_TITLE_MAX: 100,
    REGISTRY_DESCRIPTION_MAX: 2000,
    MAX_ITEMS_PER_REGISTRY: 250,
    MAX_COLLABORATORS: 50,
    MAX_MESSAGE_LENGTH: 1000,
    MIN_PASSWORD_LENGTH: 8,
  },
  
  // Performance Thresholds (Core Web Vitals)
  PERFORMANCE: {
    CLS_THRESHOLD: 0.1,
    INP_THRESHOLD: 200, // milliseconds
    LCP_THRESHOLD: 2500, // milliseconds
    FCP_THRESHOLD: 1800, // milliseconds
    TTFB_THRESHOLD: 600, // milliseconds
  },
  
  // Security Settings
  SECURITY: {
    SESSION_COOKIE_NAME: "__session",
    SALT_ROUNDS: 10,
    TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
    MIN_SECRET_LENGTH: 32,
  },
  
  // Cache Settings
  CACHE: {
    SHOP_TTL: 3600, // 1 hour
    REGISTRY_TTL: 300, // 5 minutes
    PRODUCT_TTL: 1800, // 30 minutes
  },
  
  // Webhook Topics
  WEBHOOKS: {
    APP_UNINSTALLED: "APP_UNINSTALLED",
    CUSTOMERS_CREATE: "CUSTOMERS_CREATE",
    CUSTOMERS_DATA_REQUEST: "CUSTOMERS_DATA_REQUEST",
    CUSTOMERS_REDACT: "CUSTOMERS_REDACT",
    SHOP_REDACT: "SHOP_REDACT",
    PRODUCTS_UPDATE: "PRODUCTS_UPDATE",
    ORDERS_CREATE: "ORDERS_CREATE",
    INVENTORY_LEVELS_UPDATE: "INVENTORY_LEVELS_UPDATE",
  },
} as const;

// Type exports for TypeScript
export type ShopifyConfig = typeof SHOPIFY_CONFIG;
export type WebhookTopic = typeof SHOPIFY_CONFIG.WEBHOOKS[keyof typeof SHOPIFY_CONFIG.WEBHOOKS];