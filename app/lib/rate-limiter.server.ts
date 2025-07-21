/**
 * Simple Rate Limiter
 * Replacement for removed complex rate limiter
 */

export async function check(request: Request) {
  // Basic implementation - always allow for now
  return { allowed: true };
}

export const rateLimiter = {
  check
};