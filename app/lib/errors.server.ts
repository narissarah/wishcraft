/**
 * Simple Error Handling for WishCraft
 * Simplified from 600-line error-handling-unified.server.ts
 */

import { json } from "@remix-run/node";
import { log } from "./logger.server";

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