/**
 * Environment Variable Validation - Critical Security Fix
 * Prevents runtime failures from missing environment variables
 */

import { z } from 'zod';
import { log } from './logger.server';
import { generateRandomString } from './crypto-utils.server';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  
  // Shopify Configuration
  SHOPIFY_API_KEY: z.string().min(1, 'SHOPIFY_API_KEY is required'),
  SHOPIFY_API_SECRET: z.string().min(1, 'SHOPIFY_API_SECRET is required'),
  SHOPIFY_SCOPES: z.string().min(1, 'SHOPIFY_SCOPES is required'),
  SHOPIFY_APP_URL: z.string().url('SHOPIFY_APP_URL must be a valid URL'),
  SHOPIFY_WEBHOOK_SECRET: z.string().min(1, 'SHOPIFY_WEBHOOK_SECRET is required'),
  
  // Security - CRITICAL ENVIRONMENT VARIABLES
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters for AES-256'),
  ENCRYPTION_SALT: z.string().min(32, 'ENCRYPTION_SALT must be at least 32 characters for secure key derivation'),
  DATA_ENCRYPTION_KEY: z.string().min(32, 'DATA_ENCRYPTION_KEY must be at least 32 characters for PII encryption'),
  DATA_ENCRYPTION_SALT: z.string().min(32, 'DATA_ENCRYPTION_SALT must be at least 32 characters for PII security'),
  
  // Collaboration Security
  COLLABORATION_TOKEN_SECRET: z.string().min(32, 'COLLABORATION_TOKEN_SECRET must be at least 32 characters').optional(),
  
  // Search Security
  SEARCH_HASH_KEY: z.string().min(32, 'SEARCH_HASH_KEY must be at least 32 characters for secure email indexing'),
  
  // Optional Environment Variables
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  
  // Redis (optional)
  REDIS_URL: z.string().url().optional(),
  
  // Performance Monitoring (optional)
  PERFORMANCE_WEBHOOK_URL: z.string().url().optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  ALERT_EMAIL_RECIPIENTS: z.string().optional(),
  
  // Logging (optional)
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // Backup Configuration (optional)
  POSTGRES_BACKUP_RETENTION_DAYS: z.string().default('30'),
  POSTGRES_BACKUP_SCHEDULE: z.string().default('0 2 * * *'),
  POSTGRES_BACKUP_COMPRESSION: z.string().default('true'),
  POSTGRES_BACKUP_ENCRYPTION: z.string().default('true'),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

let validatedEnv: ValidatedEnv;

/**
 * Validate environment variables on startup
 * Throws detailed error messages for missing/invalid variables
 */
export function validateEnvironment(): ValidatedEnv {
  try {
    validatedEnv = envSchema.parse(process.env);
    
    // Additional validation for production environment
    if (validatedEnv.NODE_ENV === 'production') {
      validateProductionEnvironment(validatedEnv);
    }
    
    log.info('Environment variables validated successfully');
    return validatedEnv;
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.error('Environment variable validation failed', error, {
        missingVariables: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      });
      
      process.exit(1);
    }
    
    throw error;
  }
}

/**
 * Additional validation for production environment
 */
function validateProductionEnvironment(env: ValidatedEnv) {
  const productionChecks = [
    {
      condition: env.SHOPIFY_APP_URL.includes('localhost'),
      message: 'SHOPIFY_APP_URL cannot be localhost in production'
    },
    {
      condition: env.DATABASE_URL.includes('localhost'),
      message: 'DATABASE_URL should not be localhost in production'
    },
    {
      condition: !env.ENCRYPTION_SALT || env.ENCRYPTION_SALT.length < 64,
      message: 'ENCRYPTION_SALT must be at least 64 characters in production for maximum security'
    },
    {
      condition: !env.DATA_ENCRYPTION_SALT || env.DATA_ENCRYPTION_SALT.length < 64,
      message: 'DATA_ENCRYPTION_SALT must be at least 64 characters in production for PII protection'
    },
    {
      condition: env.SESSION_SECRET === env.ENCRYPTION_KEY,
      message: 'SESSION_SECRET and ENCRYPTION_KEY must be different in production'
    },
    {
      condition: env.DATA_ENCRYPTION_KEY === env.ENCRYPTION_KEY,
      message: 'DATA_ENCRYPTION_KEY and ENCRYPTION_KEY must be different for security isolation'
    },
    {
      condition: env.SESSION_SECRET.length < 64,
      message: 'SESSION_SECRET should be at least 64 characters in production'
    },
    {
      condition: env.ENCRYPTION_KEY.length < 64,
      message: 'ENCRYPTION_KEY should be at least 64 characters in production'
    }
  ];
  
  const failures = productionChecks.filter(check => check.condition);
  
  if (failures.length > 0) {
    log.error('Production environment validation failed', {
      failures: failures.map(f => f.message)
    });
    process.exit(1);
  }
}

/**
 * Get validated environment variables
 * Must call validateEnvironment() first
 */
export function getValidatedEnv(): ValidatedEnv {
  if (!validatedEnv) {
    throw new Error('Environment not validated. Call validateEnvironment() first.');
  }
  return validatedEnv;
}

/**
 * Check if specific environment variable is set
 */
export function isEnvSet(key: keyof ValidatedEnv): boolean {
  return validatedEnv?.[key] !== undefined;
}

/**
 * Get environment variable with type safety
 */
export function getEnv<K extends keyof ValidatedEnv>(key: K): ValidatedEnv[K] {
  if (!validatedEnv) {
    throw new Error('Environment not validated. Call validateEnvironment() first.');
  }
  return validatedEnv[key];
}

/**
 * Runtime environment check for critical operations
 */
export function requireEnv<K extends keyof ValidatedEnv>(key: K, context: string): ValidatedEnv[K] {
  const value = getEnv(key);
  if (!value) {
    throw new Error(`Required environment variable ${String(key)} not set for ${context}`);
  }
  return value;
}

/**
 * Validate database connection URL format
 */
export function validateDatabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
  } catch (error) {
    log.warn('Invalid database URL format', { url: url?.substring(0, 20), error: (error as Error).message });
    return false;
  }
}

/**
 * Generate secure random values for missing secrets
 */
export function generateSecureValue(length: number = 64): string {
  return generateRandomString(length);
}

/**
 * Environment setup helper for development
 */
export function setupDevelopmentEnv(): void {
  const requiredSecrets = ['SESSION_SECRET', 'ENCRYPTION_KEY'];
  
  requiredSecrets.forEach(secret => {
    if (!process.env[secret]) {
      const generated = generateSecureValue();
      process.env[secret] = generated;
      log.info(`Generated ${secret} for development`, { hint: 'Set in .env for persistence' });
    }
  });
}

/**
 * Health check for environment configuration
 */
export function environmentHealthCheck(): {
  healthy: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  try {
    const env = getValidatedEnv();
    
    // Check database connectivity
    if (!validateDatabaseUrl(env.DATABASE_URL)) {
      issues.push('Invalid DATABASE_URL format');
    }
    
    // Check Shopify configuration
    if (!env.SHOPIFY_API_KEY || !env.SHOPIFY_API_SECRET) {
      issues.push('Missing Shopify API credentials');
    }
    
    // Check security configuration
    if (env.SESSION_SECRET.length < 32) {
      issues.push('SESSION_SECRET too short');
    }
    
    if (env.ENCRYPTION_KEY.length < 32) {
      issues.push('ENCRYPTION_KEY too short');
    }
    
    return {
      healthy: issues.length === 0,
      issues
    };
    
  } catch (error) {
    return {
      healthy: false,
      issues: ['Environment validation failed', error instanceof Error ? error.message : 'Unknown error']
    };
  }
}