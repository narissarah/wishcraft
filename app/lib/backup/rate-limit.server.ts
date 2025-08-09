/**
 * Simple rate limiting for WishCraft
 * In-memory rate limiting with automatic cleanup
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Simple in-memory store
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if request should be rate limited
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 60,
  windowMs: number = 60000 // 1 minute
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const resetAt = now + windowMs;
  
  const entry = rateLimitStore.get(identifier);
  
  if (!entry || entry.resetAt < now) {
    // New window
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }
  
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  
  // Increment count
  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Rate limit configurations
 */
export const RATE_LIMITS = {
  api: { limit: 60, window: 60000 }, // 60 requests per minute
  auth: { limit: 10, window: 900000 }, // 10 requests per 15 minutes
  webhook: { limit: 100, window: 60000 }, // 100 requests per minute
};