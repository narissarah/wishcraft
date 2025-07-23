/**
 * Centralized Constants for WishCraft
 * Consolidates all configuration values and constants
 */

// ============================================
// API Configuration
// ============================================

export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  RETRIES: 3,
  SHOPIFY_API_VERSION: "2025-07",
  MAX_REQUEST_SIZE: "2mb",
  BATCH_SIZE: 100,
  CACHE_TTL: 300, // 5 minutes
} as const;

// ============================================
// Rate Limiting Configuration
// ============================================

export const RATE_LIMITS = {
  // General API rate limits
  API_GENERAL: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // requests per window
  },
  
  // Authentication endpoints
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // attempts per window
  },
  
  // Webhook endpoints
  WEBHOOKS: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // webhooks per window
  },
  
  // Analytics endpoints
  ANALYTICS: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200, // events per window
  },
  
  // Registry creation
  REGISTRY_CREATE: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // registries per window
  },
  
  // Item operations
  ITEMS: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // item operations per window
  },
} as const;

// ============================================
// Database Configuration
// ============================================

export const DATABASE_CONFIG = {
  CONNECTION_POOL_MAX: 10,
  CONNECTION_TIMEOUT: 30000,
  POOL_TIMEOUT: 10000,
  STATEMENT_CACHE_SIZE: 100,
  SLOW_QUERY_THRESHOLD: 1000, // 1 second
  RETRY_ATTEMPTS: 3,
  RETRY_BASE_DELAY: 500,
  RETRY_MAX_DELAY: 5000,
} as const;

// ============================================
// Security Configuration
// ============================================

export const SECURITY_CONFIG = {
  // Encryption
  ENCRYPTION_ALGORITHM: "aes-256-gcm",
  IV_LENGTH: 16,
  SALT_LENGTH: 32,
  
  // Hashing
  BCRYPT_ROUNDS: 12,
  
  // Token lengths
  MIN_SECRET_LENGTH: 32,
  TOKEN_LENGTH: 32,
  NONCE_LENGTH: 16,
  
  // Session
  SESSION_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
  
  // CSP
  CSP_REPORT_URI: "/api/csp-report",
  
  // CORS
  ALLOWED_ORIGINS: process.env.NODE_ENV === "production" 
    ? ["https://admin.shopify.com", "https://*.myshopify.com"]
    : ["http://localhost:3000", "https://admin.shopify.com", "https://*.myshopify.com"],
} as const;

// ============================================
// Performance Thresholds (Shopify 2025-07)
// ============================================

export const PERFORMANCE_THRESHOLDS = {
  CLS: 0.1,     // Cumulative Layout Shift must be < 0.1
  INP: 200,     // Interaction to Next Paint must be < 200ms
  LCP: 2500,    // Largest Contentful Paint must be < 2.5s
  FCP: 1800,    // First Contentful Paint should be < 1.8s
  TTFB: 600,    // Time to First Byte should be < 600ms
  
  // Custom thresholds
  MEMORY_WARNING: 512 * 1024 * 1024, // 512MB
  MEMORY_CRITICAL: 1024 * 1024 * 1024, // 1GB
} as const;

// ============================================
// Validation Constants
// ============================================

export const VALIDATION = {
  // Registry
  REGISTRY_SLUG_MIN: 3,
  REGISTRY_SLUG_MAX: 100,
  REGISTRY_TITLE_MAX: 200,
  REGISTRY_DESCRIPTION_MAX: 2000,
  
  // Items
  ITEM_QUANTITY_MAX: 999999,
  ITEM_PRICE_MAX: 999999.99,
  ITEM_NOTES_MAX: 1000,
  
  // Gift messages
  GIFT_MESSAGE_MAX: 2000,
  
  // User data
  NAME_MAX: 100,
  EMAIL_MAX: 254,
  PHONE_MAX: 20,
  
  // Address
  ADDRESS_LINE_MAX: 255,
  CITY_MAX: 100,
  ZIP_MAX: 20,
  
  // Access codes
  ACCESS_CODE_MIN: 4,
  ACCESS_CODE_MAX: 50,
} as const;

// ============================================
// Business Logic Constants
// ============================================

export const BUSINESS_RULES = {
  // Registry limits
  MAX_ITEMS_PER_REGISTRY: 100,
  MAX_COLLABORATORS_PER_REGISTRY: 10,
  MAX_ADDRESSES_PER_REGISTRY: 5,
  
  // Purchase limits
  MAX_GROUP_CONTRIBUTORS: 50,
  MIN_GROUP_GIFT_AMOUNT: 5.00,
  
  // Data retention (GDPR compliance)
  DATA_RETENTION_DAYS: 90,
  
  // Audit log retention
  AUDIT_LOG_RETENTION_DAYS: 365,
  
  // Session cleanup
  INACTIVE_SESSION_DAYS: 30,
} as const;

// ============================================
// Feature Flags
// ============================================

export const FEATURES = {
  ANALYTICS_ENABLED: process.env.ANALYTICS_ENABLED === "true",
  GROUP_GIFTING_ENABLED: process.env.GROUP_GIFTING_ENABLED !== "false",
  COLLABORATION_ENABLED: process.env.COLLABORATION_ENABLED !== "false",
  EMAIL_NOTIFICATIONS_ENABLED: process.env.EMAIL_NOTIFICATIONS_ENABLED !== "false",
  PERFORMANCE_MONITORING_ENABLED: process.env.PERFORMANCE_MONITORING_ENABLED !== "false",
  DEBUG_MODE: process.env.NODE_ENV === "development",
} as const;

// ============================================
// Error Messages
// ============================================

export const ERROR_MESSAGES = {
  // Generic
  INTERNAL_ERROR: "An internal error occurred",
  VALIDATION_FAILED: "Validation failed",
  UNAUTHORIZED: "Unauthorized access",
  FORBIDDEN: "Access forbidden",
  NOT_FOUND: "Resource not found",
  RATE_LIMITED: "Too many requests",
  
  // Authentication
  INVALID_CREDENTIALS: "Invalid credentials",
  SESSION_EXPIRED: "Session has expired",
  INVALID_TOKEN: "Invalid authentication token",
  
  // Registry
  REGISTRY_NOT_FOUND: "Registry not found",
  REGISTRY_ACCESS_DENIED: "Access to registry denied",
  INVALID_REGISTRY_SLUG: "Invalid registry slug format",
  
  // Items
  ITEM_NOT_FOUND: "Item not found",
  ITEM_OUT_OF_STOCK: "Item is out of stock",
  INVALID_QUANTITY: "Invalid quantity specified",
  
  // Database
  DATABASE_CONNECTION_FAILED: "Database connection failed",
  DATABASE_QUERY_FAILED: "Database query failed",
  CONSTRAINT_VIOLATION: "Data constraint violation",
  
  // External services
  SHOPIFY_API_ERROR: "Shopify API error",
  EXTERNAL_SERVICE_UNAVAILABLE: "External service unavailable",
} as const;

// ============================================
// Success Messages
// ============================================

export const SUCCESS_MESSAGES = {
  REGISTRY_CREATED: "Registry created successfully",
  REGISTRY_UPDATED: "Registry updated successfully",
  ITEM_ADDED: "Item added to registry",
  ITEM_UPDATED: "Item updated successfully",
  ITEM_REMOVED: "Item removed from registry",
  COLLABORATOR_INVITED: "Collaborator invited successfully",
  PURCHASE_COMPLETED: "Purchase completed successfully",
  DATA_EXPORTED: "Data exported successfully",
} as const;

// ============================================
// Shopify Constants
// ============================================

export const SHOPIFY = {
  API_VERSION: "2025-07",
  
  // Required scopes for Built for Shopify
  REQUIRED_SCOPES: [
    "read_customers",
    "read_products", 
    "read_orders",
    "write_orders",
    "read_inventory"
  ],
  
  // GDPR webhook topics
  GDPR_WEBHOOKS: [
    "customers/data_request",
    "customers/redact", 
    "shop/redact"
  ],
  
  // GraphQL complexity limits
  GRAPHQL_COMPLEXITY_LIMIT: 1000,
  GRAPHQL_DEPTH_LIMIT: 15,
  
  // Pagination limits
  MAX_PAGE_SIZE: 250,
  DEFAULT_PAGE_SIZE: 50,
} as const;

// ============================================
// Utility Functions
// ============================================

export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s\-\(\)]{10,20}$/,
  REGISTRY_SLUG: /^[a-z0-9-]{3,100}$/,
  SHOPIFY_GLOBAL_ID: /^gid:\/\/shopify\//,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  URL: /^https?:\/\/.+/,
} as const;

// ============================================
// Environment Variables
// ============================================

export const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET", 
  "SHOPIFY_APP_URL",
  "SESSION_SECRET",
  "ENCRYPTION_KEY"
] as const;

export const RECOMMENDED_ENV_VARS = [
  "DATA_ENCRYPTION_KEY",
  "DATA_ENCRYPTION_SALT",
  "SEARCH_HASH_KEY",
  "COLLABORATION_TOKEN_SECRET"
] as const;

// Type helpers for better TypeScript support
export type EventType = "wedding" | "birthday" | "baby" | "graduation" | "anniversary" | "holiday" | "housewarming" | "general";
export type VisibilityType = "public" | "private" | "friends" | "password";
export type PriorityType = "high" | "medium" | "low";
export type StatusType = "active" | "paused" | "completed" | "archived";
export type ItemStatusType = "active" | "out_of_stock" | "discontinued" | "hidden";
export type PurchaseStatusType = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refunded";