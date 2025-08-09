/**
 * Simplified Error Handling for WishCraft
 * A single AppError class with status codes for all error types
 */

import { json } from "@remix-run/node";

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = "AppError";
  }
}


/**
 * Common error creators for consistency
 */
export const Errors = {
  badRequest: (message: string) => new AppError(message, 400, "BAD_REQUEST"),
  unauthorized: (message = "Unauthorized") => new AppError(message, 401, "UNAUTHORIZED"),
  forbidden: (message = "Forbidden") => new AppError(message, 403, "FORBIDDEN"),
  notFound: (message = "Not found") => new AppError(message, 404, "NOT_FOUND"),
  conflict: (message: string) => new AppError(message, 409, "CONFLICT"),
  rateLimited: (message = "Too many requests") => new AppError(message, 429, "RATE_LIMITED"),
  internal: (message = "Internal server error") => new AppError(message, 500, "INTERNAL_ERROR"),
  unavailable: (message = "Service unavailable") => new AppError(message, 503, "SERVICE_UNAVAILABLE"),
};