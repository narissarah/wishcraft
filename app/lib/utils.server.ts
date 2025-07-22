/**
 * Unified Server-side Utilities for WishCraft
 * Consolidates utils, constants, error handling, circuit breaker, job processing, and response utilities
 */

import bcrypt from 'bcrypt';
import { json } from "@remix-run/node";
import { log } from '~/lib/logger.server';
import { db } from "~/lib/db.server";
import crypto from "crypto";

// ============================================
// Constants
// ============================================

// API Configuration
export const API_TIMEOUT = 30000;
export const API_RETRIES = 3;
export const SHOPIFY_API_VERSION = '2025-07';

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
const SALT_ROUNDS = 10;

// Registry Limits
export const REGISTRY_LIMITS = {
  MAX_ITEMS: 250,
  MAX_TITLE_LENGTH: 255,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_COLLABORATORS: 50
} as const;

// ============================================
// Error Classes
// ============================================

// Standard error types
export class AppError extends Error {
  constructor(
    message: string,
    public code: string = 'APP_ERROR',
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class ShopifyError extends AppError {
  constructor(message: string, statusCode: number = 422) {
    super(message, 'SHOPIFY_ERROR', statusCode);
    this.name = 'ShopifyError';
  }
}

// ============================================
// Utility Functions
// ============================================

// ============================================
// Error Handling Utilities
// ============================================

// Simple retry function
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  throw new Error('Retry failed');
}

// Error response helper
export function errorResponse(error: unknown, defaultMessage: string = 'An error occurred') {
  const message = error instanceof Error ? error.message : defaultMessage;
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  
  log.error(message, { error });
  
  return json({ error: message }, { status: statusCode });
}

// ============================================
// Response Utilities - Import from dedicated module
// ============================================

// Re-export from api-response.server.ts to maintain compatibility
export { apiResponse as responses } from "./api-response.server";

// Helper for handling webhook responses
export function handleWebhookResponse(success: boolean, message?: string): Response {
  const { apiResponse } = require("./api-response.server");
  if (success) {
    return apiResponse.success(null, { message });
  }
  return apiResponse.error("WEBHOOK_ERROR", message || "Webhook processing failed", 500);
}

// Helper for parsing webhook payloads
export async function parseWebhookPayload<T = any>(request: Request): Promise<T> {
  const text = await request.text();
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error("Invalid JSON payload");
  }
}

// ============================================
// GDPR COMPLIANCE HANDLERS - Moved to gdpr-simple.server.ts
// ============================================

import { 
  exportCustomerData, 
  handleCustomerDataRedaction, 
  deleteShopData 
} from './gdpr-simple.server';

// GDPR functions are now imported from gdpr-simple.server.ts  
export { exportCustomerData, handleCustomerDataRedaction, deleteShopData };

// ============================================
// Basic Security Utilities
// ============================================

// Hash password utility
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password utility
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

