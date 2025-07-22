/**
 * Environment Validation for WishCraft - Shopify 2025-07 Compliant
 * Validates all required environment variables for secure deployment
 */

import { z } from "zod";

// Define the schema for required environment variables
const EnvironmentSchema = z.object({
  // Shopify Configuration (REQUIRED)
  SHOPIFY_API_KEY: z.string().min(1, "Shopify API Key is required"),
  SHOPIFY_API_SECRET: z.string().min(1, "Shopify API Secret is required"),
  SHOPIFY_WEBHOOK_SECRET: z.string().min(1, "Shopify Webhook Secret is required"),
  SHOPIFY_APP_URL: z.string().url("Shopify App URL must be a valid URL"),
  
  // Database Configuration (REQUIRED)
  DATABASE_URL: z.string().min(1, "Database URL is required"),
  
  // Security & Encryption (REQUIRED)
  SESSION_SECRET: z.string().min(32, "Session secret must be at least 32 characters"),
  ENCRYPTION_KEY: z.string().min(1, "Encryption key is required"),
  ENCRYPTION_SALT: z.string().min(1, "Encryption salt is required"),
  DATA_ENCRYPTION_KEY: z.string().min(1, "Data encryption key is required"),
  DATA_ENCRYPTION_SALT: z.string().min(1, "Data encryption salt is required"),
  SEARCH_HASH_KEY: z.string().min(1, "Search hash key is required"),
  COLLABORATION_TOKEN_SECRET: z.string().min(1, "Collaboration token secret is required"),
  
  // Environment Configuration
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  
  // Optional Configuration
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  REDIS_URL: z.string().optional(),
  GA_MEASUREMENT_ID: z.string().optional(),
});

export type ValidatedEnvironment = z.infer<typeof EnvironmentSchema>;

/**
 * Validates environment variables and returns validated configuration
 * Throws error if validation fails
 */
export function validateEnvironment(): ValidatedEnvironment {
  try {
    return EnvironmentSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map(issue => {
        const path = issue.path.join('.');
        return `${path}: ${issue.message}`;
      });
      
      throw new Error(
        `Environment validation failed:\n${missingVars.join('\n')}\n\n` +
        `Please ensure all required environment variables are set in your deployment platform.`
      );
    }
    throw error;
  }
}

/**
 * Validates critical security configuration
 */
export function validateSecurityConfig(env: ValidatedEnvironment): void {
  // Check encryption key lengths
  if (env.ENCRYPTION_KEY.length < 32) {
    throw new Error("ENCRYPTION_KEY must be at least 32 characters for AES-256");
  }
  
  if (env.DATA_ENCRYPTION_KEY.length < 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be at least 32 characters for AES-256");
  }
  
  // Validate Shopify App URL format
  if (!env.SHOPIFY_APP_URL.startsWith('https://')) {
    throw new Error("SHOPIFY_APP_URL must use HTTPS in production");
  }
  
  // Check for development/test secrets in production
  if (env.NODE_ENV === 'production') {
    const devSecrets = [
      'test_secret',
      'dev_secret', 
      'localhost',
      'development',
      'changeme'
    ];
    
    const secrets = [
      env.SESSION_SECRET,
      env.ENCRYPTION_KEY,
      env.DATA_ENCRYPTION_KEY,
      env.SHOPIFY_API_SECRET,
      env.SHOPIFY_WEBHOOK_SECRET
    ];
    
    for (const secret of secrets) {
      for (const devPattern of devSecrets) {
        if (secret.toLowerCase().includes(devPattern)) {
          throw new Error(`Production secrets cannot contain development patterns like '${devPattern}'`);
        }
      }
    }
  }
}

/**
 * Get validated environment with security checks
 */
export function getValidatedEnvironment(): ValidatedEnvironment {
  const env = validateEnvironment();
  validateSecurityConfig(env);
  return env;
}