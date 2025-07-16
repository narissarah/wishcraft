/**
 * Unified Configuration Constants
 * Consolidates all configuration constants, thresholds, and limits
 * Eliminates duplicate constant definitions across the codebase
 */

export const TIMEOUTS = {
  // Database timeouts
  DATABASE_QUERY: 30000,
  DATABASE_CONNECTION: 10000,
  DATABASE_TRANSACTION: 60000,
  
  // HTTP timeouts
  HTTP_REQUEST: 30000,
  HTTP_WEBHOOK: 10000,
  HTTP_SHOPIFY_API: 30000,
  
  // Cache timeouts
  CACHE_DEFAULT: 300000, // 5 minutes
  CACHE_SHORT: 60000,    // 1 minute
  CACHE_LONG: 3600000,   // 1 hour
  
  // Health check timeout
  HEALTH_CHECK: 5000,
  
  // Circuit breaker timeouts
  CIRCUIT_BREAKER: 60000,
  
  // Rate limiter window
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  
  // Session timeout
  SESSION_TIMEOUT: 2592000000, // 30 days
  
  // JWT expiration
  JWT_EXPIRATION: 86400000, // 24 hours
  
  // File upload timeout
  FILE_UPLOAD: 120000, // 2 minutes
  
  // Webhook processing timeout
  WEBHOOK_PROCESSING: 30000
} as const;

export const LIMITS = {
  // API Rate limits
  API_GENERAL: 60,           // requests per minute
  API_AUTH: 10,              // auth requests per 15 minutes
  API_WEBHOOK: 100,          // webhook requests per minute
  API_UPLOAD: 5,             // upload requests per minute
  
  // Database limits
  DB_QUERY_LIMIT: 1000,      // max records per query
  DB_CONNECTION_POOL: 10,    // max database connections
  DB_TRANSACTION_SIZE: 500,  // max operations per transaction
  
  // File upload limits
  FILE_SIZE_MAX: 10485760,   // 10MB
  FILE_COUNT_MAX: 10,        // max files per upload
  
  // Text field limits
  TEXT_SHORT: 100,           // short text fields
  TEXT_MEDIUM: 500,          // medium text fields
  TEXT_LONG: 2000,           // long text fields
  TEXT_DESCRIPTION: 2000,    // description fields
  TEXT_NOTES: 1000,          // notes fields
  TEXT_SEARCH: 100,          // search queries
  
  // Registry limits
  REGISTRY_ITEMS_MAX: 100,   // max items per registry
  REGISTRY_TITLE_MAX: 255,   // max title length
  REGISTRY_DESC_MAX: 2000,   // max description length
  
  // Collaboration limits
  COLLABORATORS_MAX: 10,     // max collaborators per registry
  
  // Pagination limits
  PAGE_SIZE_DEFAULT: 20,
  PAGE_SIZE_MAX: 100,
  
  // Cache limits
  CACHE_KEY_MAX: 250,        // max cache key length
  CACHE_VALUE_MAX: 1048576,  // 1MB max cache value
  
  // Retry limits
  RETRY_ATTEMPTS_MAX: 3,
  RETRY_DELAY_MAX: 60000,    // 1 minute
  
  // Webhook limits
  WEBHOOK_PAYLOAD_MAX: 2097152, // 2MB
  WEBHOOK_RETRIES_MAX: 5,
  
  // Email limits
  EMAIL_RECIPIENTS_MAX: 100,
  EMAIL_SUBJECT_MAX: 200,
  EMAIL_BODY_MAX: 50000,
  
  // Performance limits
  MEMORY_USAGE_MAX: 0.85,    // 85% max memory usage
  CPU_USAGE_MAX: 0.90,       // 90% max CPU usage
  
  // Batch processing limits
  BATCH_SIZE_DEFAULT: 100,
  BATCH_SIZE_MAX: 1000,
  
  // Cleanup limits
  CLEANUP_BATCH_SIZE: 500,
  CLEANUP_RETENTION_DAYS: 30
} as const;

export const PERFORMANCE_THRESHOLDS = {
  // API Response time thresholds (milliseconds)
  API_RESPONSE: {
    EXCELLENT: 200,
    GOOD: 500,
    ACCEPTABLE: 1000,
    WARNING: 1500,
    CRITICAL: 2000
  },
  
  // Database query thresholds
  DB_QUERY: {
    EXCELLENT: 50,
    GOOD: 100,
    ACCEPTABLE: 500,
    WARNING: 1000,
    CRITICAL: 2000
  },
  
  // Core Web Vitals thresholds
  WEB_VITALS: {
    LCP: {
      GOOD: 2500,
      NEEDS_IMPROVEMENT: 4000
    },
    FID: {
      GOOD: 100,
      NEEDS_IMPROVEMENT: 300
    },
    CLS: {
      GOOD: 0.1,
      NEEDS_IMPROVEMENT: 0.25
    },
    INP: {
      GOOD: 200,
      NEEDS_IMPROVEMENT: 500
    },
    TTFB: {
      GOOD: 800,
      NEEDS_IMPROVEMENT: 1800
    }
  },
  
  // Memory usage thresholds
  MEMORY: {
    GOOD: 0.60,      // 60%
    WARNING: 0.75,   // 75%
    CRITICAL: 0.85   // 85%
  },
  
  // CPU usage thresholds
  CPU: {
    GOOD: 0.50,      // 50%
    WARNING: 0.70,   // 70%
    CRITICAL: 0.90   // 90%
  },
  
  // Error rate thresholds
  ERROR_RATE: {
    GOOD: 0.01,      // 1%
    WARNING: 0.05,   // 5%
    CRITICAL: 0.10   // 10%
  },
  
  // P95 response time thresholds
  P95: {
    EXCELLENT: 500,
    GOOD: 1000,
    WARNING: 1500,
    CRITICAL: 2000
  }
} as const;

export const RETRY_CONFIGS = {
  // Database retry configuration
  DATABASE: {
    MAX_ATTEMPTS: 3,
    DELAYS: [1000, 2000, 5000], // Exponential backoff
    RETRYABLE_ERRORS: [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'P2024', // Prisma timeout
      'P2034'  // Prisma connection error
    ]
  },
  
  // API retry configuration
  API: {
    MAX_ATTEMPTS: 3,
    DELAYS: [500, 1000, 2000],
    RETRYABLE_STATUS_CODES: [408, 429, 500, 502, 503, 504]
  },
  
  // Webhook retry configuration
  WEBHOOK: {
    MAX_ATTEMPTS: 5,
    DELAYS: [1000, 2000, 5000, 10000, 30000],
    RETRYABLE_STATUS_CODES: [408, 429, 500, 502, 503, 504]
  },
  
  // Shopify API retry configuration
  SHOPIFY: {
    MAX_ATTEMPTS: 3,
    DELAYS: [1000, 5000, 15000],
    RETRYABLE_STATUS_CODES: [408, 429, 500, 502, 503, 504],
    RATE_LIMIT_DELAY: 1000
  },
  
  // Email retry configuration
  EMAIL: {
    MAX_ATTEMPTS: 3,
    DELAYS: [2000, 5000, 10000],
    RETRYABLE_ERRORS: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']
  },
  
  // Circuit breaker configuration
  CIRCUIT_BREAKER: {
    MAX_ATTEMPTS: 5,
    DELAYS: [1000, 2000, 5000, 10000, 30000],
    FAILURE_THRESHOLD: 5,
    RECOVERY_TIMEOUT: 60000
  }
} as const;

export const CACHE_CONFIGS = {
  // Redis cache configuration
  REDIS: {
    DEFAULT_TTL: 300, // 5 minutes
    SHORT_TTL: 60,    // 1 minute
    LONG_TTL: 3600,   // 1 hour
    MAX_MEMORY_POLICY: 'allkeys-lru',
    MAX_CONNECTIONS: 10
  },
  
  // Memory cache configuration
  MEMORY: {
    DEFAULT_TTL: 300000, // 5 minutes
    MAX_SIZE: 1000,
    MAX_AGE: 3600000     // 1 hour
  },
  
  // HTTP cache configuration
  HTTP: {
    STATIC_ASSETS: 86400,    // 24 hours
    API_RESPONSES: 300,      // 5 minutes
    USER_DATA: 60,           // 1 minute
    PUBLIC_DATA: 3600        // 1 hour
  }
} as const;

export const SECURITY_CONFIGS = {
  // Password requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SYMBOLS: true,
    SALT_ROUNDS: 12
  },
  
  // JWT configuration
  JWT: {
    ALGORITHM: 'HS256',
    EXPIRATION: '24h',
    REFRESH_EXPIRATION: '7d',
    ISSUER: 'wishcraft',
    AUDIENCE: 'wishcraft-users'
  },
  
  // Session configuration
  SESSION: {
    COOKIE_NAME: 'wishcraft_session',
    MAX_AGE: 86400000, // 24 hours
    SECURE: true,
    HTTP_ONLY: true,
    SAME_SITE: 'lax'
  },
  
  // Rate limiting configuration
  RATE_LIMITING: {
    WINDOW_MS: 900000,    // 15 minutes
    MAX_REQUESTS: 100,
    SKIP_SUCCESSFUL: false,
    SKIP_FAILED: false
  },
  
  // CSRF configuration
  CSRF: {
    TOKEN_LENGTH: 32,
    COOKIE_NAME: 'csrf_token',
    HEADER_NAME: 'X-CSRF-Token'
  },
  
  // Encryption configuration
  ENCRYPTION: {
    ALGORITHM: 'aes-256-gcm',
    KEY_LENGTH: 32,
    IV_LENGTH: 16,
    TAG_LENGTH: 16
  }
} as const;

export const MONITORING_CONFIGS = {
  // Health check configuration
  HEALTH_CHECK: {
    INTERVAL: 60000,     // 1 minute
    TIMEOUT: 5000,       // 5 seconds
    RETRIES: 3,
    ENDPOINTS: [
      '/health',
      '/health/db',
      '/health/cache',
      '/health/shopify'
    ]
  },
  
  // Metrics collection configuration
  METRICS: {
    COLLECTION_INTERVAL: 30000,  // 30 seconds
    RETENTION_DAYS: 30,
    BATCH_SIZE: 100,
    FLUSH_INTERVAL: 60000        // 1 minute
  },
  
  // Alerting configuration
  ALERTING: {
    COOLDOWN_PERIOD: 300000,     // 5 minutes
    MAX_ALERTS_PER_HOUR: 10,
    ESCALATION_TIMEOUT: 3600000, // 1 hour
    NOTIFICATION_CHANNELS: ['email', 'slack', 'webhook']
  },
  
  // Logging configuration
  LOGGING: {
    LEVEL: 'info',
    MAX_FILE_SIZE: 10485760,     // 10MB
    MAX_FILES: 5,
    RETENTION_DAYS: 30,
    STRUCTURED: true
  }
} as const;

export const SHOPIFY_CONFIGS = {
  // API configuration
  API: {
    VERSION: '2025-07',
    TIMEOUT: 30000,
    RETRIES: 3,
    RATE_LIMIT: 40 // requests per 2 seconds
  },
  
  // Webhook configuration
  WEBHOOKS: {
    TIMEOUT: 10000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 5000,
    VERIFY_SSL: true
  },
  
  // OAuth configuration
  OAUTH: {
    SCOPES: [
      'read_products',
      'read_orders',
      'read_customers',
      'write_orders',
      'read_inventory',
      'write_inventory'
    ],
    REDIRECT_URI: '/auth/shopify/callback',
    STATE_LENGTH: 32
  },
  
  // GraphQL configuration
  GRAPHQL: {
    MAX_QUERY_COMPLEXITY: 1000,
    MAX_QUERY_DEPTH: 10,
    TIMEOUT: 30000,
    BATCH_SIZE: 50
  }
} as const;

export const DATABASE_CONFIGS = {
  // Connection configuration
  CONNECTION: {
    POOL_SIZE: 10,
    TIMEOUT: 30000,
    IDLE_TIMEOUT: 600000,    // 10 minutes
    MAX_LIFETIME: 3600000    // 1 hour
  },
  
  // Query configuration
  QUERY: {
    TIMEOUT: 30000,
    MAX_EXECUTION_TIME: 60000,
    SLOW_QUERY_THRESHOLD: 5000,
    BATCH_SIZE: 1000
  },
  
  // Migration configuration
  MIGRATION: {
    TIMEOUT: 300000,         // 5 minutes
    BATCH_SIZE: 1000,
    LOCK_TIMEOUT: 600000     // 10 minutes
  },
  
  // Backup configuration
  BACKUP: {
    RETENTION_DAYS: 30,
    SCHEDULE: '0 2 * * *',   // Daily at 2 AM
    COMPRESSION: true,
    ENCRYPTION: true
  }
} as const;

// Export type definitions for type safety
export type TimeoutKey = keyof typeof TIMEOUTS;
export type LimitKey = keyof typeof LIMITS;
export type PerformanceThresholdKey = keyof typeof PERFORMANCE_THRESHOLDS;
export type RetryConfigKey = keyof typeof RETRY_CONFIGS;
export type CacheConfigKey = keyof typeof CACHE_CONFIGS;
export type SecurityConfigKey = keyof typeof SECURITY_CONFIGS;
export type MonitoringConfigKey = keyof typeof MONITORING_CONFIGS;
export type ShopifyConfigKey = keyof typeof SHOPIFY_CONFIGS;
export type DatabaseConfigKey = keyof typeof DATABASE_CONFIGS;

// Utility functions for accessing configurations
export const getTimeout = (key: TimeoutKey): number => TIMEOUTS[key];
export const getLimit = (key: LimitKey): number => LIMITS[key];
export const getPerformanceThreshold = (key: PerformanceThresholdKey) => PERFORMANCE_THRESHOLDS[key];
export const getRetryConfig = (key: RetryConfigKey) => RETRY_CONFIGS[key];
export const getCacheConfig = (key: CacheConfigKey) => CACHE_CONFIGS[key];
export const getSecurityConfig = (key: SecurityConfigKey) => SECURITY_CONFIGS[key];
export const getMonitoringConfig = (key: MonitoringConfigKey) => MONITORING_CONFIGS[key];
export const getShopifyConfig = (key: ShopifyConfigKey) => SHOPIFY_CONFIGS[key];
export const getDatabaseConfig = (key: DatabaseConfigKey) => DATABASE_CONFIGS[key];

// Environment-specific configuration overrides
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        LOGGING: { ...MONITORING_CONFIGS.LOGGING, LEVEL: 'warn' },
        RATE_LIMITING: { ...SECURITY_CONFIGS.RATE_LIMITING, MAX_REQUESTS: 60 },
        TIMEOUTS: { ...TIMEOUTS, HTTP_REQUEST: 20000 }
      };
    case 'development':
      return {
        LOGGING: { ...MONITORING_CONFIGS.LOGGING, LEVEL: 'debug' },
        RATE_LIMITING: { ...SECURITY_CONFIGS.RATE_LIMITING, MAX_REQUESTS: 1000 },
        TIMEOUTS: { ...TIMEOUTS, HTTP_REQUEST: 60000 }
      };
    case 'test':
      return {
        LOGGING: { ...MONITORING_CONFIGS.LOGGING, LEVEL: 'error' },
        RATE_LIMITING: { ...SECURITY_CONFIGS.RATE_LIMITING, MAX_REQUESTS: 10000 },
        TIMEOUTS: { ...TIMEOUTS, HTTP_REQUEST: 5000 }
      };
    default:
      return {};
  }
};

// Configuration validation
export const validateConfig = (config: any, requiredKeys: string[]): boolean => {
  return requiredKeys.every(key => config[key] !== undefined);
};

// Configuration merger utility
export const mergeConfigs = <T extends Record<string, any>>(base: T, override: Partial<T>): T => {
  return { ...base, ...override };
};