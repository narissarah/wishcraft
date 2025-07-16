/**
 * Environment Variable Validation - Critical Security Fix
 * Prevents runtime failures from missing environment variables
 */

import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  
  // Shopify Configuration
  SHOPIFY_API_KEY: z.string().min(1, 'SHOPIFY_API_KEY is required'),
  SHOPIFY_API_SECRET: z.string().min(1, 'SHOPIFY_API_SECRET is required'),
  SHOPIFY_SCOPES: z.string().min(1, 'SHOPIFY_SCOPES is required'),
  SHOPIFY_APP_URL: z.string().url('SHOPIFY_APP_URL must be a valid URL'),
  SHOPIFY_WEBHOOK_SECRET: z.string().min(1, 'SHOPIFY_WEBHOOK_SECRET is required'),
  
  // Security
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
  
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
    
    console.log('✅ Environment variables validated successfully');
    return validatedEnv;
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variable validation failed:');
      console.error('='.repeat(50));
      
      error.errors.forEach((err) => {
        console.error(`🔴 ${err.path.join('.')}: ${err.message}`);
      });
      
      console.error('='.repeat(50));
      console.error('Please set the required environment variables and restart the application.');
      console.error('See .env.example for reference.');
      
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
    console.error('❌ Production environment validation failed:');
    failures.forEach(failure => {
      console.error(`🔴 ${failure.message}`);
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
  } catch {
    return false;
  }
}

/**
 * Generate secure random values for missing secrets
 */
export function generateSecureValue(length: number = 64): string {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
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
      console.log(`⚠️  Generated ${secret} for development (set in .env for persistence)`);
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
      issues: ['Environment validation failed', error.message]
    };
  }
}